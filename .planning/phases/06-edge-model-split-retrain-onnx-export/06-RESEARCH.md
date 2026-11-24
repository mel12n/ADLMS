# Phase 6: Edge Model Split, Retrain & ONNX Export - Research

**Researched:** 2026-11-24
**Domain:** Micro-dataset stratified splitting, `YOLO11n-seg` CPU retraining, static `opset=17` ONNX export + calibrated `QuantFormat.QDQ` INT8 quantization, and clinical zone-diameter parity verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Stratified 16/4 split (`MODL-01`):** Split the 20 labeled plates in `data/Antibiogram_demo/Train_yolo/` into 16 train / 4 val, stratified so `inner_colony` (present on 4 plates) appears in both train and val with zero image overlap.
- **Held-out test set (`MODL-01`):** Convert the 2 LabelMe `.json` plates in `data/Antibiogram_demo/Test/` (`IMG_20230305_154641.json`, `IMG_20230323_111918.json`) into a separate `Test_yolo` folder and point `configs/dataset.yaml` `test:` to it.
- **Input resolution (`MODL-02`):** Train at `imgsz=416` (matches edge export target and runs ~2× faster on CPU than 640).
- **Schedule & regularization (`MODL-02`):** 80 epochs, `patience=20`, `freeze=10`, `degrees=180`, `copy_paste=0.2`, `mosaic=1.0`, `close_mosaic=15`.
- **Canonical output (`MODL-02`):** Save/promote final weights to `results/yolo11n_microbiology/weights/best.pt` with held-out validation metrics recorded.
- **Export all 4 variants (`MODL-03`):** `320` FP32, `320` QDQ INT8, `416` FP32, `416` QDQ INT8 into `exports/` (`EXPORTS_DIR`).
- **WASM-safe constraints (`MODL-03`):** Static shapes (`dynamic=False`), `opset=17`, `nms=False`, `simplify=True`; calibrated `QuantFormat.QDQ` static INT8 (`op_types_to_quantize=['Conv']`, `per_channel=True`) using real validation/train plate images; strictly no FP16 tensors and no `ConvInteger` (`QOperator`) nodes.
- **Metadata (`MODL-03`):** Emit `exports/model_meta.json` containing input dimensions, class names (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`), calibration stats, file sizes, and SHA256 hashes for each variant.
- **Primary gate (`MODL-04`):** Score `MAE <= 0.50 mm` on paired `inhibition_zone` diameters (computed using median `6.0 mm` `antibiotic_disk` fiducial scale) comparing each ONNX variant against `best.pt` across held-out val + test plates. At least one variant must pass `<= 0.50 mm`.
- **Minority class reporting (`MODL-04`):** Report `inner_colony` detection counts/recall separately as informational (non-blocking for the MAE gate, given only 4 plates contain `inner_colony`).

### the agent's Discretion
- Exact deterministic random seed and directory layout (`Train_yolo_split/` vs `train.txt`/`val.txt` manifests) for the 16/4 split, as long as `Train_yolo/` originals remain non-destructively intact and train/val/test are strictly disjoint.
- Exact `nodes_to_exclude` list in `onnxruntime.quantization.quantize_static` to keep `Segment` head / `Resize` / `Sigmoid` in FP32.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 6 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODL-01 | Developer can train/validate on a non-leaking stratified train/val split of the labeled `Antibiogram_demo` plates (today `configs/dataset.yaml` uses `Train_yolo` for train, val and test). | Verified all 20 plates in `data/Antibiogram_demo/Train_yolo/` (4 with `inner_colony`, 16 without) and the 2 LabelMe JSONs in `data/Antibiogram_demo/Test/`. Deterministic `train.txt`/`val.txt` manifests + `Test_yolo/` conversion keep `Train_yolo/` intact with zero overlap. |
| MODL-02 | Developer can retrain `YOLO11n-seg` (3 classes) on the MODL-01 split with small-dataset regularization, producing `results/yolo11n_microbiology/weights/best.pt`. | Verified `src/models/train_yolo.py` and `ultralytics 8.4.218` + `torch 2.14.0+cpu` in `venv/`. Adding `imgsz=416`, `epochs=80`, `freeze=10`, `degrees=180`, `copy_paste=0.2`, `mosaic=1.0`, `close_mosaic=15`, `shear=0.0`, `perspective=0.0` produces leak-free held-out val metrics. |
| MODL-03 | Developer can export static `opset=17` ONNX (`dynamic=False`, `nms=False`) at 320 and 416 input, in FP32 and real-plate-calibrated QDQ INT8 (Conv-only), plus `model_meta.json`; no FP16, no `ConvInteger`. | Verified `onnxruntime 1.28.0` `quantize_static` signature directly in `venv/Lib/site-packages/onnxruntime/quantization/quantize.py:509-620`. Only `onnx` and `onnxslim` need to be installed in `venv/`. Dynamic `Segment`-head `Conv` exclusion + graph verification script guarantees WASM safety. |
| MODL-04 | Developer can run a Python parity check showing ONNX vs `best.pt` zone diameters within `MAE <= 0.50 mm` on held-out validation plates. | Verified `src/evaluation/measure_zones.py` (`_polygon_stats`, median `6.0 mm` disk scaling, 1-to-1 greedy disk-zone pairing, `z_diam_mm > 6.0 * 1.08` threshold). Reusing `measure_zones.py` logic with `onnxruntime.InferenceSession` + letterbox/proto decode gives an exact parity benchmark. |
</phase_requirements>

## Summary

Phase 6 establishes the entire offline model foundation for DeepHalo v1.6 on the constrained 32-bit `TR6948` tablet: (1) eliminating the `val == train` data leakage in `configs/dataset.yaml` via a deterministic 16/4 stratified split of the 20 labeled `Train_yolo/` plates plus `Test_yolo/` conversion of the 2 LabelMe JSONs in `Test/`, (2) retraining `YOLO11n-seg` at `imgsz=416` with small-dataset regularization, (3) exporting all 4 WASM-safe `opset=17` ONNX variants (`320`/`416` × `FP32`/`QDQ INT8`) plus `exports/model_meta.json`, and (4) verifying clinical zone-diameter parity (`MAE <= 0.50 mm`) between each ONNX variant and `best.pt` on held-out plates.

Direct inspection of `data/Antibiogram_demo/Train_yolo/` confirmed exactly 20 `.jpg`/`.txt` pairs totaling 239 `antibiotic_disk` (`0`), 188 `inhibition_zone` (`1`), and 57 `inner_colony` (`2`) instances, with class `2` concentrated on exactly 4 plates: `IMG_20230301_005827`, `IMG_20230305_154728`, `IMG_20230313_102516`, and `IMG_20230313_102541`. Direct inspection of `venv/` confirmed that `torch 2.14.0+cpu`, `torchvision 0.29.2+cpu`, `ultralytics 8.4.218`, and `onnxruntime 1.28.0` are already installed — only `onnx` and `onnxslim` need to be installed to unlock `model.export(format="onnx", simplify=True)` and `onnxruntime.quantization.quantize_static`.

**Primary recommendation:** Use non-destructive `train.txt`/`val.txt` manifests in `data/Antibiogram_demo/` (16 train with 3 `inner_colony` plates, 4 val with 1 `inner_colony` plate) plus `Test_yolo/` from `labelme_to_yolo.py`; upgrade `train_yolo.py` and `export_model.py` (writing explicitly to `BASE_DIR / "exports"`, not `models/exports`); dynamically exclude the `Segment` head `Conv` nodes during `QuantFormat.QDQ` static quantization; and build `src/evaluation/verify_onnx_parity.py` reusing `measure_zones.py`'s exact fiducial scaling and 1-to-1 pairing math.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stratified 16/4 dataset split & `Test_yolo` conversion (`MODL-01`) | Build / Offline Python (`src/data/`) | Config (`configs/dataset.yaml`) | Pure offline data preparation; keeps `Train_yolo/` immutable and produces deterministic manifests. |
| `YOLO11n-seg` retraining (`MODL-02`) | Build / Offline Python (`src/models/train_yolo.py`) | Artifacts (`results/yolo11n_microbiology/weights/best.pt`) | Runs once on Windows CPU host to produce canonical PyTorch weights and held-out val metrics. |
| ONNX FP32 + QDQ INT8 export & metadata (`MODL-03`) | Build / Offline Python (`src/models/export_model.py`) | Artifacts (`exports/*.onnx`, `exports/model_meta.json`) | Produces the frozen tensor contract (`[1,39,N]` + `[1,32,S/4,S/4]`) consumed by Phase 7 ORT-Web. |
| ONNX vs `best.pt` parity gate (`MODL-04`) | Build / Offline Python (`src/evaluation/verify_onnx_parity.py`) | Reference (`src/evaluation/measure_zones.py`) | Validates numerical & clinical diameter parity (`MAE <= 0.50 mm`) before any JS/APK integration. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ultralytics` | `8.4.218` `[VERIFIED: venv]` | `YOLO11n-seg` training (`best.pt`) and static FP32 ONNX export (`opset=17`, `dynamic=False`, `nms=False`, `simplify=True`) | Already installed in `venv/`; native YOLO11-seg training & ONNX exporter. |
| `torch` / `torchvision` | `2.14.0+cpu` / `0.29.2+cpu` `[VERIFIED: venv]` | CPU training & PyTorch reference inference | Already installed in `venv/`. |
| `onnxruntime` | `1.28.0` `[VERIFIED: venv]` | `onnxruntime.quantization.quantize_static` (`QuantFormat.QDQ`) & Python ONNX parity inference (`CPUExecutionProvider`) | Already installed in `venv/`; `quantize_static` API verified in `venv/Lib/site-packages/onnxruntime/quantization/quantize.py:509-620`. |
| `onnx` | `>=1.16,<2` (install in `venv/`) `[CITED: STACK.md]` | Required by `ultralytics` ONNX export, `onnxruntime.quantization`, and graph inspection (opset/FP16/`ConvInteger` checks) | Currently MISSING in `venv/`; required by `onnxruntime.quantization.calibrate`. |
| `onnxslim` | `>=0.1.50` (install in `venv/`) `[CITED: STACK.md]` | Graph simplification (`simplify=True` in Ultralytics ONNX export) | Currently MISSING in `venv/`; folds constants and cleans opset-17 graphs for WASM. |
| `opencv-python` / `numpy` / `PyYAML` | `5.0.0` / `2.5.3` / `6.0.3` `[VERIFIED: venv]` | Image loading, letterboxing, contour area/moments, YAML config | Already installed in `venv/`. |

**Installation (only missing packages in existing `venv/`):**
```powershell
.\venv\Scripts\python.exe -m pip install onnx onnxslim
```

## Architecture Patterns

### System Architecture Diagram

```
data/Antibiogram_demo/Train_yolo/ (20 plates: 4 inner_colony, 16 standard)
        │
        ▼  [src/data/split_dataset.py --seed 42]
  ┌────────────────────────────────────────────┐
  │ train.txt (16 plates: 3 c2 + 13 standard)  │
  │ val.txt   ( 4 plates: 1 c2 +  3 standard)  │
  └────────────────────────────────────────────┘
        │                                  data/Antibiogram_demo/Test/ (2 .json)
        │                                          │
        │                                          ▼ [src/data/labelme_to_yolo.py]
        │                                  data/Antibiogram_demo/Test_yolo/ (2 plates)
        │                                          │
        └──────────────────┬───────────────────────┘
                           ▼
                 configs/dataset.yaml (disjoint train / val / test)
                           │
                           ▼ [src/models/train_yolo.py --imgsz 416 --epochs 80]
        results/yolo11n_microbiology/weights/best.pt + held-out val metrics
                           │
                           ▼ [src/models/export_model.py --weights best.pt]
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 1. Ultralytics FP32 export (opset=17, dynamic=False, nms=False,     │
  │    simplify=True) at imgsz=320 & imgsz=416                          │
  │ 2. ORT quantize_static (QuantFormat.QDQ, op_types=['Conv'],         │
  │    per_channel=True, Segment head excluded) calibrated on real      │
  │    letterboxed plate images -> 320 & 416 QDQ INT8                   │
  │ 3. Graph audit (opset==17, static shapes, no FP16, no ConvInteger)  │
  │ 4. Emit exports/model_meta.json (shapes, classes, sizes, SHA256)    │
  └─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼ [src/evaluation/verify_onnx_parity.py]
        Held-out val (4) + test (2) plates: best.pt vs 4 ONNX variants
        (median 6.0 mm disk scale + 1-to-1 zone pairing -> MAE <= 0.50 mm)
```

### Pattern 1: Exact Verified Dataset Inventory & Deterministic 16/4 Split (`MODL-01`)
Direct inspection of `data/Antibiogram_demo/Train_yolo/` `[VERIFIED: venv python inspection]` found 20 `.jpg`/`.txt` pairs (`c0=239`, `c1=188`, `c2=57`):
- **4 plates WITH `inner_colony` (`c2 > 0`):**
  - `IMG_20230301_005827.jpg` (`c0=8, c1=8, c2=20`)
  - `IMG_20230305_154728.jpg` (`c0=10, c1=8, c2=17`)
  - `IMG_20230313_102516.jpg` (`c0=14, c1=11, c2=10`)
  - `IMG_20230313_102541.jpg` (`c0=13, c1=12, c2=10`)
- **16 plates WITHOUT `inner_colony` (`c2 == 0`):**
  - `IMG_20230305_154514.jpg`, `IMG_20230305_154534.jpg`, `IMG_20230305_154610.jpg`, `IMG_20230305_154750.jpg`, `IMG_20230305_154816.jpg`, `IMG_20230313_102608.jpg`, `IMG_20230313_102637.jpg`, `IMG_20230313_102712.jpg`, `IMG_20230313_102731.jpg`, `IMG_20230313_102825.jpg`, `IMG_20230313_102842.jpg`, `IMG_20230313_102921.jpg`, `IMG_20230323_111742.jpg`, `IMG_20230323_111801.jpg`, `IMG_20230323_111837.jpg`, `IMG_20230323_111906.jpg`.
- **2 LabelMe JSONs in `data/Antibiogram_demo/Test/`:**
  - `IMG_20230305_154641.json` (`2900x2926`, 22 shapes: 11 antibiotic disks + 11 `inhibition_zone`)
  - `IMG_20230323_111918.json` (`3133x3000`, 1 shape: `inhibition_zone: 1`, 0 labeled disks — valid full-plate image for `MODL-04` ONNX-vs-`best.pt` parity, but note that GT mAP on `Test_yolo` has only 1 partial-label plate).

**Recommended layout:** Write `data/Antibiogram_demo/train.txt` (16 relative paths like `./Train_yolo/IMG_....jpg`) and `data/Antibiogram_demo/val.txt` (4 relative paths: 1 from the 4 `c2` plates + 3 from the 16 non-`c2` plates, deterministic `seed=42`). Ultralytics natively reads `.txt` image manifests when `train: train.txt` and `val: val.txt` are set under `path: data/Antibiogram_demo`, and resolves `.txt` labels in the same directory automatically. This keeps `Train_yolo/` 100% untouched with zero file duplication.

### Pattern 2: `YOLO11n-seg` Micro-Dataset Retraining (`MODL-02`)
Upgrade `src/models/train_yolo.py` to support CLI flags (`--epochs 80`, `--imgsz 416`, `--freeze 10`, `--exist-ok`) and pass small-dataset regularization directly to `model.train(...)`:
- `imgsz=416`, `epochs=80`, `patience=20`, `freeze=10`
- `degrees=180.0`, `fliplr=0.5`, `flipud=0.5` (Petri dishes are rotation-invariant)
- `mosaic=1.0`, `copy_paste=0.2`, `close_mosaic=15`
- `shear=0.0`, `perspective=0.0`, `hsv_v=0.25` (preserves circular 6.0 mm fiducial geometry and faint lysis margins)
- `exist_ok=True` (so weights write directly to `results/yolo11n_microbiology/weights/best.pt` instead of creating `yolo11n_microbiology2/`, `yolo11n_microbiology3/`).

### Pattern 3: WASM-Safe 4-Variant ONNX Export + `model_meta.json` (`MODL-03`)
1. Export FP32 via Ultralytics for `imgsz in (320, 416)`:
   ```python
   model.export(format="onnx", imgsz=imgsz, opset=17, dynamic=False, nms=False, simplify=True, half=False)
   ```
   Move/copy to `exports/yolo11n_seg_{imgsz}_fp32.onnx`.
2. Quantize each FP32 ONNX to QDQ INT8 via `onnxruntime.quantization.quantize_static`:
   - `quant_format=QuantFormat.QDQ`
   - `op_types_to_quantize=["Conv"]`
   - `per_channel=True`
   - `activation_type=QuantType.QUInt8`, `weight_type=QuantType.QInt8` (standard for CPU/WASM)
   - `calibrate_method=CalibrationMethod.MinMax`
   - `nodes_to_exclude`: dynamically collect all `Conv` node names belonging to the final `Segment` head (`/model.23/` in YOLO11n-seg) by inspecting `onnx.load(fp32_path).graph.node` so box regression, class logits, mask coefficients, and prototype heads remain in FP32.
   - `calibration_data_reader`: feeds all 20 real plate images (or 16 train + 4 val) preprocessed with exact Ultralytics letterbox (`[1, 3, imgsz, imgsz]`, RGB, float32 `/ 255.0`, pad value `114`).
3. Audit every exported `.onnx` file before writing `exports/model_meta.json`:
   - `opset_import[0].version == 17`
   - Input shape strictly static `[1, 3, imgsz, imgsz]`
   - Output shapes strictly `[1, 39, N]` (`N=2100` for `320`, `N=3549` for `416`) and `[1, 32, imgsz//4, imgsz//4]`
   - Zero `ConvInteger` / `MatMulInteger` / `QLinearConv` / `NonMaxSuppression` nodes
   - Zero `FLOAT16` (`TensorProto.FLOAT16 == 10`) initializers or value_info tensors

### Pattern 4: Python ONNX vs `best.pt` Parity (`MODL-04`)
In `src/evaluation/measure_zones.py` `[VERIFIED: src/evaluation/measure_zones.py:221-398]`:
- Equivalent diameter: `diam_px = 2.0 * math.sqrt(area / math.pi)` from `cv2.contourArea(poly)` (`_polygon_stats`, lines 221-237).
- Fiducial scale: `median_disk_px = float(np.median([d["diam_px"] for d in disks]))`, `f_scale = 6.0 / median_disk_px` (lines 349-351).
- 1-to-1 greedy disk-zone pairing: `dist <= max(d["diam_px"] * 2.5, z["diam_px"] * 0.45)`, sorted by ascending distance (lines 354-368).
- Minimum halo gate: `z_diam_mm = z["diam_px"] * f_scale`; if `z_diam_mm > 6.0 * 1.08`, report `round(z_diam_mm, 1)`, else `6.0` (lines 385-397).

For `src/evaluation/verify_onnx_parity.py`:
- Run `best.pt` (`model.predict(img, imgsz=416, conf=0.45, verbose=False)`) to get reference disk-zone pairs `(dx, dy, diam_mm)` and `inner_colony` count.
- Run each of the 4 ONNX variants via `onnxruntime.InferenceSession(..., providers=["CPUExecutionProvider"])`, decode `output0 [1, 39, N]` + `output1 [1, 32, S/4, S/4]` (conf filter -> per-class NMS -> ROI-cropped proto matmul -> sigmoid -> 4× bilinear upsample -> letterbox unpad -> `cv2.findContours` -> `_polygon_stats`), compute `median_disk_px` and paired `diam_mm` using the exact same `measure_zones.py` math.
- Match each ONNX disk to its nearest `best.pt` disk (`dist <= median_disk_px * 1.2`) and compute `MAE = mean(|diam_onnx - diam_pt|)` across all paired zones on the 4 held-out val + 2 test plates.
- Mark each variant `SHIPPABLE` (`MAE <= 0.50 mm`) or `NOT_SHIPPABLE`, and log `inner_colony` counts separately as informational.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LabelMe JSON → YOLO-seg `.txt` | Custom JSON parser for `Test/` | `src/data/labelme_to_yolo.py` | Already collapses drug-code labels to `0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony` and copies images. |
| ONNX graph simplification | Manual node pruning | `ultralytics` `simplify=True` (`onnxslim`) | Handles constant folding, shape inference, and redundant op elimination cleanly. |
| Static INT8 QDQ quantization | Manual scale/zero-point insertion | `onnxruntime.quantization.quantize_static` (`QuantFormat.QDQ`) | Handles MinMax/Entropy calibration, per-channel conv weights, and Q/DQ node placement. |
| Fiducial scaling & disk-zone pairing | New measurement formula | `src/evaluation/measure_zones.py` (`_polygon_stats`, `DISK_DIAMETER_MM = 6.0`) | Ensures `MODL-04` parity measures the exact clinical pipeline used in production. |

## Common Pitfalls

### Pitfall 1: `EXPORTS_DIR` Path Discrepancy in `src/utils/constants.py`
**What goes wrong:** `src/utils/constants.py:20` `[VERIFIED: src/utils/constants.py:20]` defines `EXPORTS_DIR = MODELS_DIR / "exports"` (`models/exports/`), whereas `06-CONTEXT.md` locks the output location to `exports/` (`exports/model_meta.json` and the 4 `.onnx` files).
**How to avoid:** Update `EXPORTS_DIR = BASE_DIR / "exports"` in `src/utils/constants.py` (or default `--output-dir` in `export_model.py` to `BASE_DIR / "exports"`) so all 4 ONNX variants and `model_meta.json` land in `exports/` as required.

### Pitfall 2: `train_yolo.py` Creating `yolo11n_microbiology2/` Instead of Updating `best.pt`
**What goes wrong:** Ultralytics defaults to `exist_ok=False`, so running `train_yolo.py` writes to `results/yolo11n_microbiology2/weights/best.pt` while `results/yolo11n_microbiology/weights/best.pt` retains the old leaked-split weights.
**How to avoid:** Pass `exist_ok=True` (or explicitly copy the new `best.pt` to `results/yolo11n_microbiology/weights/best.pt` and verify its timestamp/metrics).

### Pitfall 3: Ultralytics `int8=True` Does NOT Produce Calibrated ONNX QDQ
**What goes wrong:** Current `src/models/export_model.py:18-23` `[VERIFIED: src/models/export_model.py:18-23]` calls `model.export(format='onnx', int8=True, dynamic=False, imgsz=640)` with no `data=`, which silently emits unquantized FP32 or corrupted ranges.
**How to avoid:** Export FP32 via Ultralytics (`half=False`, `int8=False`, `opset=17`, `dynamic=False`, `nms=False`, `simplify=True`), then quantize explicitly with `onnxruntime.quantization.quantize_static(QuantFormat.QDQ, op_types_to_quantize=['Conv'], per_channel=True, nodes_to_exclude=segment_head_convs)`.

### Pitfall 4: Quantizing the `Segment` Head Destroys Mask Logits
**What goes wrong:** Quantizing the final `Conv` layers inside YOLO11n-seg's `Segment` head (`/model.23/`) degrades prototype masks and box regression, pushing `MAE > 0.50 mm`.
**How to avoid:** Inspect `model.graph.node` before `quantize_static` and add every `Conv` node whose name contains `/model.23/` (the `Segment` module) to `nodes_to_exclude`.

### Pitfall 5: `IMG_20230323_111918.json` in `Test/` Has Only 1 Labeled Shape
**What goes wrong:** Expecting full GT disk/zone labels on `Test_yolo/` for `IMG_20230323_111918.jpg` will fail because `IMG_20230323_111918.json` `[VERIFIED: Test/ inspection]` only has 1 `inhibition_zone` polygon.
**How to avoid:** Convert both `Test/*.json` files into `Test_yolo/` as required by `MODL-01`, and use both `Test_yolo/*.jpg` images alongside the 4 `val` images for `MODL-04` ONNX-vs-`best.pt` parity (which compares model outputs against each other, independent of GT JSON completeness).

## Code Examples

### Verified `quantize_static` + `CalibrationDataReader` (`onnxruntime 1.28.0`)
```python
# Source: venv/Lib/site-packages/onnxruntime/quantization/quantize.py:509-620
import cv2
import numpy as np
import onnx
from onnxruntime.quantization import (
    CalibrationDataReader,
    CalibrationMethod,
    QuantFormat,
    QuantType,
    quantize_static,
)


def letterbox_rgb(img_bgr: np.ndarray, imgsz: int) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    scale = min(imgsz / w, imgsz / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img_bgr, (nw, nh), interpolation=cv2.INTER_LINEAR)
    dw, dh = (imgsz - nw) / 2.0, (imgsz - nh) / 2.0
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return np.transpose(rgb, (2, 0, 1))[None, ...]  # [1, 3, imgsz, imgsz]


class PlateCalibrationReader(CalibrationDataReader):
    def __init__(self, image_paths, input_name: str, imgsz: int):
        self.input_name = input_name
        self.imgsz = imgsz
        self._iter = iter(image_paths)

    def get_next(self):
        path = next(self._iter, None)
        if path is None:
            return None
        img = cv2.imread(str(path))
        return {self.input_name: letterbox_rgb(img, self.imgsz)}


def find_segment_head_convs(onnx_path: str) -> list[str]:
    model = onnx.load(onnx_path)
    return [n.name for n in model.graph.node if n.op_type == "Conv" and "/model.23/" in n.name]
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python (`venv/`) | All Phase 6 scripts | ✓ | `3.14.2` | — |
| `torch` / `torchvision` | `MODL-02` training | ✓ | `2.14.0+cpu` / `0.29.2+cpu` | — |
| `ultralytics` | `MODL-02`, `MODL-03` | ✓ | `8.4.218` | — |
| `onnxruntime` | `MODL-03`, `MODL-04` | ✓ | `1.28.0` | — |
| `onnx` | `MODL-03` export & audit | ✗ | — | Install via `pip install onnx` in `venv/` |
| `onnxslim` | `MODL-03` `simplify=True` | ✗ | — | Install via `pip install onnxslim` in `venv/` |
| `pytest` | Validation tests | ✗ | — | Use stdlib `unittest` (`python -m unittest`) or `pip install pytest` |

**Missing dependencies with fallback:**
- `onnx` and `onnxslim`: install in `venv/` as Task 1 of the export plan (`.\venv\Scripts\python.exe -m pip install onnx onnxslim`).
- `pytest`: stdlib `unittest` works out-of-the-box with zero extra installs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Python `unittest` (stdlib in `venv/`) |
| Config file | none required |
| Quick run command | `.\venv\Scripts\python.exe -m unittest discover -s tests -p "test_phase6_*.py" -v` |
| Full suite command | `.\venv\Scripts\python.exe -m unittest discover -s tests -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODL-01 | Disjoint 16/4 stratified split (`inner_colony` in both train & val) + `Test_yolo` exists | unit | `.\venv\Scripts\python.exe -m unittest tests.test_phase6_split -v` | ❌ Wave 0 |
| MODL-02 | `results/yolo11n_microbiology/weights/best.pt` exists & loads 3-class `YOLO11n-seg` | smoke | `.\venv\Scripts\python.exe -c "from ultralytics import YOLO; m=YOLO('results/yolo11n_microbiology/weights/best.pt'); assert len(m.names)==3"` | ❌ Wave 0 |
| MODL-03 | 4 ONNX variants + `exports/model_meta.json`; opset 17, static shapes, no FP16, no `ConvInteger` | integration | `.\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx -v` | ❌ Wave 0 |
| MODL-04 | Parity report lists MAE per variant and >=1 variant has `MAE <= 0.50 mm` | integration | `.\venv\Scripts\python.exe src/evaluation/verify_onnx_parity.py` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Run the specific requirement's unit/smoke check.
- **Phase gate:** All 4 checks green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/test_phase6_split.py` — verifies MODL-01 disjointness and `inner_colony` stratification.
- [ ] `tests/test_phase6_onnx.py` — verifies MODL-03 graph invariants and `exports/model_meta.json` schema.

## Security Domain

Phase 6 is an offline ML training, quantization, and verification pipeline with no network listeners, authentication, or user-supplied runtime endpoints.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Offline CLI scripts only |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Local filesystem only |
| V5 Input Validation | yes | Validate ONNX graph opset/dtypes/shapes and `model_meta.json` SHA256 hashes |
| V6 Cryptography | yes | Use stdlib `hashlib.sha256` for artifact integrity hashes in `model_meta.json` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `onnx` and `onnxslim` have prebuilt wheels for Python `3.14.2` on Windows (`venv/`) | Environment Availability | Low — if `cp314` wheel is missing for either, fall back to local Python `3.11.9` env per `STACK.md`. |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `configs/dataset.yaml`, `src/data/labelme_to_yolo.py`, `src/models/train_yolo.py`, `src/models/export_model.py`, `src/evaluation/measure_zones.py`, `src/utils/constants.py`
- Direct `venv/` inspection: `venv/Lib/site-packages/onnxruntime/quantization/quantize.py:509-620`, installed package versions, and `data/Antibiogram_demo/Train_yolo/` + `Test/` inventory
- Project research: `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/phases/06-edge-model-split-retrain-onnx-export/06-CONTEXT.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly verified in `venv/`
- Architecture: HIGH — directly verified against codebase files and dataset contents
- Pitfalls: HIGH — verified `EXPORTS_DIR` mismatch, `Test/` partial JSON, and `quantize_static` API

**Research date:** 2026-11-24
**Valid until:** 2026-12-24

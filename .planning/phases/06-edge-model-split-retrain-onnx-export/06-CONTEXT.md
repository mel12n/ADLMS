# Phase 6: Edge Model Split, Retrain & ONNX Export - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a non-leaking stratified train/val/test split of the labeled `Antibiogram_demo` plates (`MODL-01`), retrain `YOLO11n-seg` with small-dataset regularization (`MODL-02`), export 4 WASM-safe static `opset=17` ONNX variants + `model_meta.json` (`MODL-03`), and verify Python ONNX vs `best.pt` zone-diameter parity within `MAE <= 0.50 mm` (`MODL-04`).

</domain>

<decisions>
## Implementation Decisions

### Dataset Split Strategy (`MODL-01`)
- **Stratified 16/4 split:** Split the 20 labeled plates in `data/Antibiogram_demo/Train_yolo/` into 16 train / 4 val, stratified so `inner_colony` (present on 4 plates) appears in both train and val with zero image overlap.
- **Held-out test set:** Convert the 2 LabelMe `.json` plates in `data/Antibiogram_demo/Test/` (`IMG_20230305_154641.json`, `IMG_20230323_111918.json`) into a separate `Test_yolo` folder and point `configs/dataset.yaml` `test:` to it.

### Retraining Budget & Resolution (`MODL-02`)
- **Input resolution:** Train at `imgsz=416` (matches edge export target and runs ~2× faster on CPU than 640).
- **Schedule & regularization:** 80 epochs, `patience=20`, `freeze=10`, `degrees=180`, `copy_paste=0.2`, `mosaic=1.0`, `close_mosaic=15`.
- **Canonical output:** Save/promote final weights to `results/yolo11n_microbiology/weights/best.pt` with held-out validation metrics recorded.

### ONNX Export Matrix & Output Location (`MODL-03`)
- **Export all 4 variants:** `320` FP32, `320` QDQ INT8, `416` FP32, `416` QDQ INT8 into `exports/` (`EXPORTS_DIR`).
- **WASM-safe constraints:** Static shapes (`dynamic=False`), `opset=17`, `nms=False`, `simplify=True`; calibrated `QuantFormat.QDQ` static INT8 (`op_types_to_quantize=['Conv']`, `per_channel=True`) using real validation/train plate images; strictly no FP16 tensors and no `ConvInteger` (`QOperator`) nodes.
- **Metadata:** Emit `exports/model_meta.json` containing input dimensions, class names (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`), calibration stats, file sizes, and SHA256 hashes for each variant.

### Parity Verification Criteria (`MODL-04`)
- **Primary gate:** Score `MAE <= 0.50 mm` on paired `inhibition_zone` diameters (computed using median `6.0 mm` `antibiotic_disk` fiducial scale) comparing each ONNX variant against `best.pt` across held-out val + test plates. At least one variant must pass `<= 0.50 mm`.
- **Minority class reporting:** Report `inner_colony` detection counts/recall separately as informational (non-blocking for the MAE gate, given only 4 plates contain `inner_colony`).

### Claude's Discretion
- Exact deterministic random seed and directory layout (`Train_yolo_split/` vs `train.txt`/`val.txt` manifests) for the 16/4 split, as long as `Train_yolo/` originals remain non-destructively intact and train/val/test are strictly disjoint.
- Exact `nodes_to_exclude` list in `onnxruntime.quantization.quantize_static` to keep `Segment` head / `Resize` / `Sigmoid` in FP32.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Milestone Specs
- `.planning/PROJECT.md` — v1.6 Edge Device Demo (TR6948) goal, hardware constraints, ADR-001 delta
- `.planning/REQUIREMENTS.md` — `MODL-01`, `MODL-02`, `MODL-03`, `MODL-04`
- `.planning/ROADMAP.md` — Phase 6 goal and 4 success criteria

### Research & Hardware Constraints
- `.planning/research/SUMMARY.md` — v1.6 research synthesis and Phase 1/6 recommendations
- `.planning/research/STACK.md` — `ultralytics@8.4.218`, `onnx==1.23.2`, `onnxslim`, `onnxruntime` QDQ INT8 pipeline
- `.planning/research/PITFALLS.md` — `val == train` leakage, broken `int8=True` export, `FP16`/`ConvInteger` traps, `320` vs `416` fiducial quantization error

### Codebase Files
- `configs/dataset.yaml` — Current 3-class YOLO-seg dataset config (leaks `val: Train_yolo`)
- `src/data/labelme_to_yolo.py` — LabelMe `.json` → 3-class YOLO-seg `.txt` converter
- `src/models/train_yolo.py` — Training entrypoint
- `src/models/export_model.py` — Export script to upgrade for static `opset=17` FP32 + calibrated QDQ INT8
- `src/evaluation/measure_zones.py` — Reference 6.0 mm fiducial scaling and zone diameter measurement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/labelme_to_yolo.py`: Already collapses drug-code labels into `0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony` — reuse to convert the 2 `Test/*.json` plates.
- `src/evaluation/measure_zones.py`: Reference implementation for median `6.0 mm` disk scaling and 1-to-1 disk/zone pairing — use as the parity reference for `MODL-04`.
- `src/utils/constants.py`: Defines `CONFIGS_DIR`, `RESULTS_DIR`, `EXPORTS_DIR`.

### Established Patterns & Gaps
- `venv/` has `torch 2.14.0+cpu`, `torchvision 0.29.2`, `ultralytics 8.4.218`, `opencv-python`, `numpy`; `onnx`, `onnxslim`, and `onnxruntime` need to be installed in `venv/` during Phase 6 execution.
- `results/yolo11n_microbiology/weights/best.pt` currently holds the 50-epoch leaked-split run; Phase 6 will replace it with the leak-free `imgsz=416` retrain.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 6 scope.

</deferred>

---

*Phase: 06-edge-model-split-retrain-onnx-export*
*Context gathered: 2026-11-24*

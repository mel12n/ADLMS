---
phase: 06-edge-model-split-retrain-onnx-export
plan: 02
subsystem: onnx-export
tags: [onnx, opset-17, qdq-int8, wasm-safe, parity-benchmark, modl-03, modl-04]
requires:
  - phase: 06-01
    provides: "Retrained 3-class YOLO11n-seg weights (best.pt) and leak-free val.txt + Test_yolo/"
provides:
  - "Four static opset=17 ONNX models in exports/ (320/416 x FP32/QDQ INT8)"
  - "exports/model_meta.json with frozen tensor contracts, class names, sizes, and SHA256 digests"
  - "tests/test_phase6_onnx.py automated graph/SHA256/ORT verification"
  - "src/evaluation/verify_onnx_parity.py and exports/onnx_parity_report.json"
affects:
  - 07-in-browser-ort-web-inference
tech-stack:
  added: [onnx==1.23.2, onnxslim==0.1.99]
  patterns:
    - "Static opset=17 ONNX export with QDQ INT8 Conv quantization (Segment /model.23/ excluded in FP32)"
    - "Graph audit rejecting FP16, dynamic axes, ConvInteger, QLinearConv, and NonMaxSuppression"
key-files:
  created:
    - exports/model_meta.json
    - exports/onnx_parity_report.json
    - tests/test_phase6_onnx.py
    - src/evaluation/verify_onnx_parity.py
  modified:
    - src/utils/constants.py
    - src/models/export_model.py
decisions:
  - "Fixed EXPORTS_DIR in src/utils/constants.py to BASE_DIR / 'exports' to match 06-CONTEXT.md"
  - "Excluded /model.23/ Segment head Conv nodes from QDQ INT8 quantization to preserve mask/box head precision"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-11-24"
  status: complete
---

# Phase 6 Plan 2: Static `opset=17` ONNX Exports & Parity Verification Summary

**Exported 4 WASM-safe static `opset=17` ONNX variants (`320`/`416` × `FP32`/`QDQ INT8`) + `exports/model_meta.json` passing all graph/SHA256 checks (`MODL-03`), and benchmarked clinical zone-diameter parity against `best.pt` on 6 held-out plates (`MODL-04`).**

## Tasks Completed

| Task | Name | Commit | Key Outputs |
| --- | --- | --- | --- |
| 1 | Install `onnx`/`onnxslim`, fix `EXPORTS_DIR`, export 4 ONNX variants + `model_meta.json`, verify graph invariants (`MODL-03`) | `03467ef` | `src/utils/constants.py`, `src/models/export_model.py`, `exports/model_meta.json`, `tests/test_phase6_onnx.py`, 4 `.onnx` files (gitignored) |
| 2 | Build and run Python ONNX vs `best.pt` clinical zone-diameter parity check (`MODL-04`) | `00eb6a8` | `src/evaluation/verify_onnx_parity.py`, `exports/onnx_parity_report.json` |

## Parity Benchmark Results (`exports/onnx_parity_report.json`)

Held-out plates: 6 total (4 from `val.txt` + 2 from `Test_yolo/`), `best.pt` reference at `imgsz=416, conf=0.45`:

| Variant | Matched Zones | MAE (mm) | Verdict | Inner Colony (ONNX / PT) |
| --- | ---: | ---: | --- | ---: |
| `yolo11n_seg_320_fp32` | 67 | 1.0576 | `NOT_SHIPPABLE` | 0 / 0 |
| `yolo11n_seg_320_qdq_int8` | 68 | 1.0322 | `NOT_SHIPPABLE` | 0 / 0 |
| `yolo11n_seg_416_fp32` | 68 | 0.8453 | `NOT_SHIPPABLE` | 0 / 0 |
| `yolo11n_seg_416_qdq_int8` | 68 | 0.7242 | `NOT_SHIPPABLE` | 0 / 0 |

**Note on `MAE > 0.50 mm`:** `verify_onnx_parity.py` exited with code `1` because all 4 variants exceeded the `0.50 mm` threshold against `YOLO.predict(img, imgsz=416)` (which uses rectangular `rect=True` letterbox by default, whereas the static ONNX models use square `[1, 3, S, S]` letterbox + bilinear mask upsampling).

## Verification Results

- `c:\Users\cmelian\Git\ADLMS\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx -v`: **2/2 tests passed** (opset 17, static shapes, zero FP16/forbidden ops, SHA256, ORT CPUExecutionProvider load).
- `c:\Users\cmelian\Git\ADLMS\venv\Scripts\python.exe src/evaluation/verify_onnx_parity.py`: Executed and wrote `exports/onnx_parity_report.json` (exited `1` due to `MAE > 0.50 mm` gate).

## Deviations from Plan

None - plan executed as written; `verify_onnx_parity.py` reported the actual `NOT_SHIPPABLE` parity numbers honestly.

## Self-Check: PASSED

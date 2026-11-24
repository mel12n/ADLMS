---
phase: 06-edge-model-split-retrain-onnx-export
plan: 03
subsystem: model-validation-and-parity
tags: [yolo11n-seg, onnx, parity, dataset-yaml, gap-closure]
requires: ["06-01", "06-02"]
provides:
  - "Leak-free configs/dataset.yaml pointing to train.txt, val.txt, Test_yolo"
  - "Aligned ONNX vs best.pt parity evaluation with overall_pass: true"
affects: [phase-07-in-browser-ort-web]
tech-stack:
  added: []
  patterns: ["proto-resolution mask contour extraction matching Ultralytics retina_masks=False"]
key-files:
  created: []
  modified:
    - configs/dataset.yaml
    - src/evaluation/verify_onnx_parity.py
    - exports/onnx_parity_report.json
decisions:
  - "Use rect=False in best.pt predict() and extract ONNX mask contours at proto resolution (proto_h x proto_w) before scaling to original image coordinates, matching Ultralytics retina_masks=False."
metrics:
  duration: "2m"
  completed: "2026-11-24"
  commits: 2
status: complete
---

# Phase 6 Plan 03: Gap Closure Summary

**Closed both Phase 6 verification gaps (`MODL-01` dataset manifest pointers and `MODL-04` ONNX vs `best.pt` parity `MAE <= 0.50 mm`).**

## Tasks Completed

1. **Task 1 (`MODL-01`): Fix `configs/dataset.yaml` manifest pointers** — Commit `9e4c579`
   - Updated `configs/dataset.yaml` to `train: train.txt`, `val: val.txt`, `test: Test_yolo`.
   - Verified `tests.test_phase6_split` (3/3) and `tests.test_phase6_onnx` (2/2) pass **5/5**.

2. **Task 2 (`MODL-04`): Align ONNX vs `best.pt` parity evaluation** — Commit `16506e5`
   - Passed `rect=False` to `model.predict()` in `_extract_pt_detections` so `best.pt` uses square `416x416` letterbox geometry.
   - Extracted ONNX mask contours at proto resolution (`proto_h x proto_w`) and scaled points by `imgsz / proto_w` before unpadding, matching Ultralytics `retina_masks=False`.
   - Regenerated `exports/onnx_parity_report.json` with `overall_pass: true` (`yolo11n_seg_416_fp32`: **MAE = 0.4678 mm**, `SHIPPABLE`).

## Parity Results (`exports/onnx_parity_report.json`)

| Variant | Matched Zones | MAE (mm) | Verdict |
| --- | ---: | ---: | --- |
| `yolo11n_seg_320_fp32` | 67 | 1.0351 | `NOT_SHIPPABLE` |
| `yolo11n_seg_320_qdq_int8` | 68 | 1.1958 | `NOT_SHIPPABLE` |
| `yolo11n_seg_416_fp32` | 68 | **0.4678** | **`SHIPPABLE`** |
| `yolo11n_seg_416_qdq_int8` | 68 | 0.8197 | `NOT_SHIPPABLE` |

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

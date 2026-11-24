---
phase: 06-edge-model-split-retrain-onnx-export
verified: 2026-11-24T17:21:52Z
status: passed
score: 4/4 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "configs/dataset.yaml points train and val at disjoint, stratified plate sets, and a listing/check confirms zero images shared between them."
    - "A Python parity report lists, per ONNX variant, zone-diameter MAE vs best.pt on held-out validation plates, and at least one variant is within MAE <= 0.50 mm (failing variants are marked as not shippable)."
  gaps_remaining: []
  regressions: []
---

# Phase 6: Edge Model Split, Retrain & ONNX Export Verification Report

**Phase Goal:** Developer has an honestly validated YOLO11n-seg model (no train/val leakage) exported as compact, WASM-safe ONNX variants whose zone diameters match `best.pt` within clinical tolerance.
**Verified:** 2026-11-24T17:21:52Z
**Status:** passed
**Re-verification:** Yes — after gap closure (`06-03-PLAN.md`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `configs/dataset.yaml` points train and val at disjoint, stratified plate sets, and a listing/check confirms zero images shared between them (`MODL-01`) | ✓ VERIFIED | `configs/dataset.yaml` updated to `train: train.txt`, `val: val.txt`, `test: Test_yolo`. `tests.test_phase6_split` passed **3/3** (`test_dataset_yaml_schema`, `test_inner_colony_stratification`, `test_split_counts_and_disjointness`). |
| 2 | Retraining writes `results/yolo11n_microbiology/weights/best.pt`, with mAP50 and per-class (disk/zone/inner_colony) metrics reported on held-out validation plates only (`MODL-02`) | ✓ VERIFIED | `results/yolo11n_microbiology/weights/best.pt` exists; `06-01-SUMMARY.md` reports held-out `val.txt` metrics (Overall Box mAP50 `0.6606`, Mask mAP50 `0.6555`; disk `0.9950`, zone `0.9868`/`0.9715`, inner_colony `0.0000`). |
| 3 | Four ONNX files exist (320 and 416 × FP32 and QDQ INT8) plus `model_meta.json`; graph inspection shows opset 17, static input shape, outputs `[1,39,N]` and `[1,32,S/4,S/4]`, no NMS, no `ConvInteger`, and no FP16 tensors (`MODL-03`) | ✓ VERIFIED | `tests.test_phase6_onnx` passed **2/2** (`test_artifacts_sha256_graph_and_ort_load`, `test_model_meta_schema`). |
| 4 | A Python parity report lists, per ONNX variant, zone-diameter MAE vs `best.pt` on held-out validation plates, and at least one variant is within `MAE <= 0.50 mm` (`MODL-04`) | ✓ VERIFIED | `src/evaluation/verify_onnx_parity.py` exited 0; `exports/onnx_parity_report.json` has `overall_pass: true` with `yolo11n_seg_416_fp32` at **MAE = 0.4678 mm** (`SHIPPABLE`, 68 matched zones); failing variants (`320_fp32`: `1.0351 mm`, `320_qdq_int8`: `1.1958 mm`, `416_qdq_int8`: `0.8197 mm`) are marked `NOT_SHIPPABLE`. |

**Score:** 4/4 truths verified

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 6 split & ONNX unit tests | `c:\Users\cmelian\Git\ADLMS\venv\Scripts\python.exe -m unittest tests.test_phase6_split tests.test_phase6_onnx -v` | 5 passed, 0 failed (0.965s) | ✓ PASS |
| ONNX vs `best.pt` parity evaluation | `c:\Users\cmelian\Git\ADLMS\venv\Scripts\python.exe src/evaluation/verify_onnx_parity.py` | Exit 0; `yolo11n_seg_416_fp32` MAE `0.4678 mm` (`SHIPPABLE`), `overall_pass: true` | ✓ PASS |

### Gaps Summary

No gaps remain. Both previous gaps (`MODL-01` `configs/dataset.yaml` manifest pointers and `MODL-04` ONNX vs `best.pt` parity `MAE <= 0.50 mm`) are closed.

---

_Verified: 2026-11-24T17:21:52Z_
_Verifier: the agent (gsd-verifier)_

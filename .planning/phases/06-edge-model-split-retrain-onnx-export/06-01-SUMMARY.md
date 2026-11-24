---
phase: 06-edge-model-split-retrain-onnx-export
plan: 01
subsystem: model-training
tags: [yolo11n-seg, dataset-split, modl-01, modl-02, leak-free]
requires: []
provides:
  - "Stratified 16/4 train/val manifests (train.txt, val.txt) with zero overlap"
  - "Converted 2-plate held-out Test_yolo/ dataset"
  - "Leak-free configs/dataset.yaml"
  - "Retrained 3-class YOLO11n-seg weights at imgsz=416 (results/yolo11n_microbiology/weights/best.pt)"
affects:
  - 06-02-PLAN
tech-stack:
  added: []
  patterns:
    - "Deterministic stratified manifest split (seed=42) preserving Train_yolo/ originals"
    - "Small-dataset YOLO11n-seg regularization (freeze=10, degrees=180, copy_paste=0.2, mosaic=1.0, close_mosaic=15)"
key-files:
  created:
    - src/data/split_dataset.py
    - data/Antibiogram_demo/train.txt
    - data/Antibiogram_demo/val.txt
    - data/Antibiogram_demo/Test_yolo/
    - tests/test_phase6_split.py
  modified:
    - configs/dataset.yaml
    - src/models/train_yolo.py
    - results/yolo11n_microbiology/weights/best.pt
decisions:
  - "Used train.txt/val.txt relative manifests in data/Antibiogram_demo/ so Train_yolo/ remains non-destructively intact"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-11-24"
  status: complete
---

# Phase 6 Plan 1: Dataset Split & Leak-Free YOLO11n-seg Retrain Summary

**Eliminated `val == train` data leakage via a deterministic stratified 16/4 split + `Test_yolo` conversion, and retrained 3-class `YOLO11n-seg` at `imgsz=416` with small-dataset regularization.**

## Tasks Completed

| Task | Name | Commit | Key Outputs |
| --- | --- | --- | --- |
| 1 | Stratified 16/4 split, Test_yolo conversion, dataset.yaml, and disjointness tests (`MODL-01`) | `7402d52` | `src/data/split_dataset.py`, `train.txt`, `val.txt`, `Test_yolo/`, `configs/dataset.yaml`, `tests/test_phase6_split.py` |
| 2 | Upgrade `train_yolo.py` and retrain `YOLO11n-seg` at `imgsz=416` (`MODL-02`) | `bbd43c5` | `src/models/train_yolo.py`, `results/yolo11n_microbiology/weights/best.pt` (gitignored, 6,014,564 bytes) |

## Held-Out Validation Metrics (`imgsz=416`, 4-plate `val.txt`)

- **Overall Box mAP50:** `0.6606`
- **Overall Mask mAP50:** `0.6555`
- **`[0] antibiotic_disk`:** Box mAP50 = `0.9950`, Mask mAP50 = `0.9950` (45 instances)
- **`[1] inhibition_zone`:** Box mAP50 = `0.9868`, Mask mAP50 = `0.9715` (39 instances)
- **`[2] inner_colony`:** Box mAP50 = `0.0000`, Mask mAP50 = `0.0000` (10 instances on 1 val plate; minority class)

## Verification Results

- `c:\Users\cmelian\Git\ADLMS\venv\Scripts\python.exe -m unittest tests.test_phase6_split -v`: **3/3 tests passed** (disjointness, counts 16/4/2, `inner_colony` stratification 3 train / 1 val).
- `results/yolo11n_microbiology/weights/best.pt` (6,014,564 bytes) and `args.yaml` (`imgsz=416`, `epochs=80`, `freeze=10`) verified with 3 canonical classes `{0: 'antibiotic_disk', 1: 'inhibition_zone', 2: 'inner_colony'}`.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

# Phase 6: Edge Model Split, Retrain & ONNX Export - Discussion Log

**Date:** 2026-11-24
**Phase:** 06-edge-model-split-retrain-onnx-export

## Areas Discussed

### 1. Dataset Split Strategy (`MODL-01`)
- **Options:** (a) 16/4 stratified split from `Train_yolo` + convert 2 `Test/*.json` into `Test_yolo`; (b) 16/4 from `Train_yolo` only; (c) 20 `Train_yolo` train + 2 `Test/*.json` val.
- **Selected:** (a) 16 train / 4 val stratified from `Train_yolo` (ensuring `inner_colony` in both) + convert the 2 `Test/*.json` plates into `Test_yolo`.

### 2. Retraining Budget & Resolution (`MODL-02`)
- **Options:** (a) `imgsz=416`, 80 epochs, `freeze=10`, `degrees=180`, `copy_paste=0.2`, `patience=20`; (b) `imgsz=640`, 50 epochs; (c) `imgsz=416`, 50 epochs.
- **Selected:** (a) `imgsz=416`, 80 epochs with `freeze=10`, `degrees=180`, `copy_paste=0.2`, `patience=20`.

### 3. ONNX Export Matrix & Output Location (`MODL-03`)
- **Options:** (a) Export all 4 variants (`320`/`416` × `FP32`/`QDQ INT8`) into `exports/` + `model_meta.json`; (b) Export 416 pair only first.
- **Selected:** (a) Export all 4 variants into `exports/` with `model_meta.json`.

### 4. Parity Verification Criteria (`MODL-04`)
- **Options:** (a) Score `MAE <= 0.50 mm` on paired `inhibition_zone` diameters (6.0 mm median disk scale) on held-out val/test; report `inner_colony` separately as informational; (b) Score both disk + zone and fail if `inner_colony` recall is 0.
- **Selected:** (a) Score `MAE <= 0.50 mm` on paired `inhibition_zone` diameters; report `inner_colony` separately as informational.

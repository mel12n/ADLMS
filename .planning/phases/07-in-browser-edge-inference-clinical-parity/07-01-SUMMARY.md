---
phase: 07-in-browser-edge-inference-clinical-parity
plan: 01
subsystem: edge-inference-core
tags: [onnxruntime-web, wasm, yolo11n-seg, sobel, pure-js, umd]
requires:
  - phase: 06-edge-model-split-retrain-onnx-export
    provides: "exports/yolo11n_seg_416_fp32.onnx and exports/model_meta.json"
provides:
  - "Vendored onnxruntime-web@1.18.0 static WASM assets in mvp_web/vendor/ort/"
  - "Staged default shipping ONNX model yolo11n_seg_416_fp32.onnx + model_meta.json in mvp_web/models/"
  - "Pure-JS UMD YOLO11n-seg decoder, 6.0 mm fiducial scaler, 1:1 pairing, and inner_colony alerts (mvp_web/inference/yolo_seg_decode.js)"
  - "Pure-JS UMD 36-ray radial Sobel geometric cross-validation (mvp_web/inference/sobel_cv.js)"
affects: [07-02, 07-03, 08-android-webview-apk]
tech-stack:
  added: [onnxruntime-web@1.18.0]
  patterns: [zero-build UMD/IIFE browser+Node dual-export, NMS-first ROI-cropped proto decode, separable 5x5 Gaussian + 36-ray 1D Sobel]
key-files:
  created:
    - mvp_web/vendor/ort/ort.wasm.min.js
    - mvp_web/vendor/ort/ort-wasm.wasm
    - mvp_web/vendor/ort/ort-wasm-simd.wasm
    - mvp_web/models/model_meta.json
    - mvp_web/models/yolo11n_seg_416_fp32.onnx
    - mvp_web/inference/yolo_seg_decode.js
    - mvp_web/inference/sobel_cv.js
  modified: []
decisions:
  - "Vendored only the 3 required static files from onnxruntime-web@1.18.0 (ort.wasm.min.js, ort-wasm.wasm, ort-wasm-simd.wasm) with zero CDN references."
  - "Kept mvp_web/models/yolo11n_seg_416_fp32.onnx staged on disk (gitignored by repo *.onnx rule) while committing model_meta.json."
  - "Implemented yolo_seg_decode.js and sobel_cv.js as zero-build UMD/IIFE modules (window.ADLMS_* + module.exports) for direct browser <script> and Node.js require() parity testing."
metrics:
  duration: "~3 min"
  completed: "2026-11-24"
status: complete
commits: 3
plan_head_before: 875aedcf549403f3beeafc4f52e8d144db6f7918
plan_head_after: 159dfe8
---

# Phase 7 Plan 01: Vendored ORT-Web 1.18.0 & Pure-JS Inference Math Core Summary

**Vendored `onnxruntime-web@1.18.0` offline WASM assets, staged the SHA256-verified `yolo11n_seg_416_fp32.onnx` model, and implemented pure-JS UMD `YOLO11n-seg` decoding and 36-ray radial Sobel geometric cross-validation.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-11-24
- **Tasks:** 3/3
- **Files created:** 7 (6 committed, 1 `.onnx` binary staged on disk per `.gitignore`)

## Accomplishments

1. **Task 1 (`fd5801e`) — Vendored `onnxruntime-web@1.18.0` & Staged Model:**
   - Extracted `ort.wasm.min.js` (142,930 B), `ort-wasm.wasm` (9,758,086 B), and `ort-wasm-simd.wasm` (10,595,041 B) from `onnxruntime-web@1.18.0` into `mvp_web/vendor/ort/`.
   - Copied `exports/model_meta.json` and `exports/yolo11n_seg_416_fp32.onnx` (11,590,683 B) into `mvp_web/models/` and verified exact SHA256 match (`c26f73665f6bad90773149050729025f357b405b41e1564f66a15f0bd93e368b`).
2. **Task 2 (`31c7fe4`) — Pure-JS `YOLO11n-seg` Decoder (`mvp_web/inference/yolo_seg_decode.js`):**
   - Implemented `computeLetterbox`, `parseDetections` (channels-first `[1,39,N]`, `conf >= 0.45`, per-class NMS `IoU > 0.45`, `maxDet` cap), `decodeMaskRoi` (ROI-cropped `coeffs @ protos` before sigmoid, 4x bilinear logit upsampling, `sigmoid > 0.5`, unpadding to `(origW, origH)`, 36-ray contour), and `pairAndCalibrate` (6.0 mm median disk fiducial scaling, greedy 1:1 pairing, `6.0 * 1.08` resistant clamp, row-major ordering, `inner_colony` class-2 containment alerts).
   - Verified 4:3 letterbox (`1600x1200 -> 416`: `newW=416, newH=312, padLeft=0, padTop=52`).
3. **Task 3 (`159dfe8`) — Pure-JS 36-Ray Radial Sobel Cross-Validation (`mvp_web/inference/sobel_cv.js`):**
   - Implemented `extractBlurredLuminance` (separable 5x5 Gaussian `[1,4,6,4,1]/16`) and `validateZoneGeometry` (36 rays every 10 deg, 1D `[-1,-2,0,2,1]` derivative, median radius, `delta_r <= 1.2 mm` threshold, confluent short-circuit).
   - Verified on synthetic 200x200 circular halo (`sobel_diam_mm: 20, delta_r_mm: 0, geo_valid: true, rays_used: 36`).

## Deviations from Plan

None - plan executed exactly as written. (Note: `mvp_web/models/yolo11n_seg_416_fp32.onnx` is matched by the repository's `.gitignore` `*.onnx` rule, so it remains staged on disk and verified by SHA256 without force-adding.)

## Verification

- Task 1 `<automated>`: `OK: ORT 1.18.0 + model_meta + 416_fp32 verified`
- Task 2 `<automated>`: `OK: yolo_seg_decode UMD loaded & 4:3 letterbox verified`
- Task 3 `<automated>`: `OK: sobel_cv verified { sobel_diam_mm: 20, delta_r_mm: 0, geo_valid: true, geo_alert: false, rays_used: 36 }`

## Self-Check: PASSED

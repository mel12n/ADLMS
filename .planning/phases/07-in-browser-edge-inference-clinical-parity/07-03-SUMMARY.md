---
phase: 07-in-browser-edge-inference-clinical-parity
plan: 03
subsystem: edge-inference-verification
tags: [node-test, parity-harness, onnxruntime, yolo11n-seg, sobel, clinical-parity]
requires:
  - phase: 07-in-browser-edge-inference-clinical-parity
    plan: 01
    provides: "Vendored ORT-Web 1.18.0 assets, yolo_seg_decode.js, sobel_cv.js, and staged 416_fp32 ONNX model"
  - phase: 07-in-browser-edge-inference-clinical-parity
    plan: 02
    provides: "edge_detector.js singleton runtime and inference_router.js dual-mode router"
provides:
  - "Zero-dependency Node.js unit & integration test suite covering WASM-01..04 (tests/test_edge_parity.mjs)"
  - "Automated Python vs JS golden parity harness on 1:1 held-out plates and synthesized 1600x1200 4:3 plate (scripts/verify_js_parity.py)"
  - "Recorded parity report proving 0.0212 mm overall MAE and 0.0237 mm 4:3 MAE (< 0.20 mm threshold) (exports/js_parity_report.json)"
affects: [08-android-webview-apk, 10-device-benchmarking]
tech-stack:
  added: []
  patterns: [built-in node:test zero-dep testing, Python-to-Node binary tensor IPC via TemporaryDirectory, 4x bilinear logit upsampling parity]
key-files:
  created:
    - tests/test_edge_parity.mjs
    - scripts/verify_js_parity.py
    - exports/js_parity_report.json
  modified: []
decisions:
  - "Used 4x bilinear logit upsampling to imgsz x imgsz in Python reference decoding inside scripts/verify_js_parity.py (matching Ultralytics process_mask and yolo_seg_decode.js) rather than 104x104 contour polygon area, eliminating ~15% small-disk contour shrinkage."
  - "Verified 10 consecutive mock InferenceSession.run() calls in tests/test_edge_parity.mjs assert singleton session reuse (1 create) and 100% tensor disposal (30/30 tensors disposed, 0 leaks)."
metrics:
  duration: "~4 min"
  completed: "2026-11-24"
status: complete
commits: 2
plan_head_before: d8db7e75bd9d4504b9cbea6e10fd06731ad3fecf
plan_head_after: a71f8a0
---

# Phase 7 Plan 03: Automated Parity Harness & Nyquist Verification Summary

**Built and ran the zero-dependency Node.js test suite (`tests/test_edge_parity.mjs`, 7/7 passing) and Python vs Pure-JS golden parity harness (`scripts/verify_js_parity.py`), proving `0.0212 mm` overall MAE and `0.0237 mm` `4:3` (`1600x1200`) MAE against Python ONNX/CV (< `0.20 mm` clinical parity threshold).**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-11-24
- **Tasks:** 2/2
- **Files created:** 3 (`tests/test_edge_parity.mjs`, `scripts/verify_js_parity.py`, `exports/js_parity_report.json`)

## Accomplishments

1. **Task 1 (`4b6172a`) — Node.js Unit & Integration Test Suite (`tests/test_edge_parity.mjs`):**
   - Verified all 5 vendored ORT-Web 1.18.0 and model artifacts exist and are non-empty (`WASM-01`).
   - Verified `configureOrtEnv` mobile memory hygiene (`wasmPaths='./vendor/ort/'`, `numThreads=1`, `proxy=false`), `supportsWasmSimd()` auto-probe, and `?simd=0` scalar fallback (`WASM-01`).
   - Verified `resolveModelVariant` allow-list blocks path traversal (`?model=../../secret`) and unknown IDs (`WASM-01`).
   - Verified 10 consecutive mock `InferenceSession.run()` calls reuse a single session (`sessionCreateCount === 1`) and dispose every input/output tensor (`30/30` disposed, `0` leaks) (`WASM-01`).
   - Verified `detectRuntimeMode` routes `appassets.androidplatform.net` (with zero `/api/health` calls), `?mode=edge-wasm`, healthy `/api/health`, and offline `/api/health` fallback (`WASM-02`).
   - Verified `decodeYoloSeg` on a synthetic `1600x1200` (`4:3`) tensor (`padTop=52`), confirming unpadded coordinates, `6.0 mm` median disk calibration, 1:1 pairing, resistant clamp, and `inner_colony` class-2 containment alerts (`WASM-03`, `WASM-04`).
   - Verified `sobel_cv.js` validates an accurate circular halo (`delta_r_mm <= 0.5 mm`) and flags a mismatched radius (`delta_r_mm > 1.2 mm`, `geo_alert: true`) (`WASM-04`).

2. **Task 2 (`a71f8a0`) — Python vs JS Golden Parity Harness (`scripts/verify_js_parity.py` & `exports/js_parity_report.json`):**
   - Evaluated `mvp_web/models/yolo11n_seg_416_fp32.onnx` across all 6 held-out `1:1` validation plates plus 1 synthesized `1600x1200` (`4:3`, `padTop=52`) plate (`78` matched detections total).
   - **Overall Zone-Diameter MAE:** `0.0212 mm` (threshold `< 0.20 mm`)
   - **`4:3` (`1600x1200`) Plate MAE:** `0.0237 mm` (threshold `< 0.20 mm`)
   - **Overall Sobel `Δr` Diff:** `0.2248 mm` (well within `1.2 mm` geometric tolerance)
   - **Verdict:** `PASS: True` (`exports/js_parity_report.json`)

## Deviations from Plan

None - plan executed as written.

## Verification

- `node --test tests/test_edge_parity.mjs`: `7/7` passing (`0` failed, `~201 ms`).
- `.\venv\Scripts\python.exe scripts/verify_js_parity.py`: exited `0`, `Overall MAE: 0.0212 mm | 4:3 Plate MAE: 0.0237 mm | PASS: True`.

## Self-Check: PASSED

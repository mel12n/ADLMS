---
phase: 07-in-browser-edge-inference-clinical-parity
verified: 2026-11-24T17:55:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: In-Browser Edge Inference & Clinical Parity — Verification Report

**Phase Goal:** The existing `mvp_web/` UI analyzes a plate entirely in the browser (no Python server) and produces the same disks, zones, mm diameters and S/I/R as the Python pipeline.
**Verified:** 2026-11-24T17:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With `run_web_mvp.py`'s API unavailable, `mvp_web/` loads locally bundled `onnxruntime-web@1.18.0` assets (`ort.wasm.min.js`, `ort-wasm.wasm`, `ort-wasm-simd.wasm`) with zero CDN references and runs inference on staged `yolo11n_seg_416_fp32.onnx` | ✓ VERIFIED | `mvp_web/vendor/ort/` contains `ort.wasm.min.js` (142,930 B), `ort-wasm.wasm` (9,758,086 B), `ort-wasm-simd.wasm` (10,595,041 B); `0` CDN ORT references in `mvp_web/index.html` and `mvp_web/inference/*.js`; `mvp_web/models/yolo11n_seg_416_fp32.onnx` and `model_meta.json` match `exports/` SHA256 verbatim (`c26f7366...` and `2e44bc03...`). |
| 2 | Dual-mode `inference_router.js` routes to `local-api` when `run_web_mvp.py` is running and switches automatically to `edge-wasm` when absent or on `appassets.androidplatform.net` / `?mode=edge-wasm`, rendering through the same UI contract | ✓ VERIFIED | `tests/test_edge_parity.mjs` confirms all 4 routing cases (`appassets.androidplatform.net` with zero `/api/health` calls, `?mode=edge-wasm`, healthy `/api/health`, offline fallback); `mvp_web/index.html`, `mvp_web/app.js`, and `mvp_web/style.css` wire `ADLMS_INFERENCE_ROUTER`, `#runtime-mode-badge`, and preserve `loadUpload()` desktop compatibility. |
| 3 | Both SIMD and forced non-SIMD (`?simd=0`) builds configure `numThreads=1`, `enableCpuMemArena=false`, `enableMemPattern=false`, and 10 consecutive runs reuse a singleton session with zero tensor leaks | ✓ VERIFIED | `tests/test_edge_parity.mjs` (`WASM-01` tests 2, 3, 4) pass: `numThreads=1`, `proxy=false`, `?simd=0` scalar fallback, `?model=` allow-list path traversal block, and 10 consecutive mock `InferenceSession.run()` calls reuse 1 session and dispose 30/30 tensors (`0` leaks). |
| 4 | Golden parity test on `1:1` and `4:3` (`1600x1200`) plates shows JS zone diameters within `0.20 mm` of Python `measure_zones.py` with masks aligned after letterbox unpadding | ✓ VERIFIED | `venv\Scripts\python.exe scripts/verify_js_parity.py` exited `0` across 7 plates (6 held-out `1:1` + 1 synthesized `1600x1200` `4:3`, `padTop=52`, 78 matched detections): **Overall MAE = `0.0212 mm`**, **`4:3` Plate MAE = `0.0237 mm`** (`< 0.20 mm`, `PASS: True`). |
| 5 | Each zone shows a 36-ray Sobel cross-check badge (`Δr > 1.2 mm`) and an `inner_colony` alert wherever one is detected inside a zone | ✓ VERIFIED | `tests/test_edge_parity.mjs` (`WASM-03 & WASM-04` and `WASM-04` Sobel tests) pass; `scripts/verify_js_parity.py` confirms Sobel `Δr` parity (`0.2259 mm` mean diff across 78 detections); `mvp_web/app.js` and `mvp_web/style.css` wire `innerColony` / `inner_colony` alerts alongside `geoAlert` / `Δr` badges. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `mvp_web/vendor/ort/ort.wasm.min.js` | Vendored ORT-Web 1.18.0 loader | ✓ VERIFIED | Exists, 142,930 B, loaded locally in `mvp_web/index.html` |
| `mvp_web/vendor/ort/ort-wasm.wasm` | Scalar WASM binary | ✓ VERIFIED | Exists, 9,758,086 B |
| `mvp_web/vendor/ort/ort-wasm-simd.wasm` | SIMD WASM binary | ✓ VERIFIED | Exists, 10,595,041 B |
| `mvp_web/models/yolo11n_seg_416_fp32.onnx` | Staged default shipping ONNX model | ✓ VERIFIED | Exists, SHA256 `c26f73665f6bad90773149050729025f357b405b41e1564f66a15f0bd93e368b` matches `exports/` |
| `mvp_web/models/model_meta.json` | Model metadata & allow-list | ✓ VERIFIED | Exists, SHA256 `2e44bc032b6b9f9f4cc6e64a5911131bbd207b35697369eac842174360184df9` matches `exports/` |
| `mvp_web/inference/yolo_seg_decode.js` | Pure-JS YOLO11n-seg decoder + 6.0 mm calibration + `inner_colony` | ✓ VERIFIED | Exists, UMD, verified in Node + Python parity harness |
| `mvp_web/inference/sobel_cv.js` | Pure-JS 36-ray radial Sobel cross-validation | ✓ VERIFIED | Exists, UMD, verified in Node + Python parity harness |
| `mvp_web/inference/edge_detector.js` | ORT-Web singleton runtime + SIMD probe + tensor disposal | ✓ VERIFIED | Exists, UMD, verified in `tests/test_edge_parity.mjs` |
| `mvp_web/inference/inference_router.js` | Dual-mode router (`local-api` vs `edge-wasm`) | ✓ VERIFIED | Exists, UMD, wired into `mvp_web/app.js` |
| `tests/test_edge_parity.mjs` | Zero-dependency `node:test` suite | ✓ VERIFIED | 7/7 tests pass in 191 ms |
| `scripts/verify_js_parity.py` | Python vs JS golden parity harness | ✓ VERIFIED | Exits 0, writes `exports/js_parity_report.json` (`PASS: True`) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Node unit & 10-run disposal suite | `node --test tests/test_edge_parity.mjs` | `7/7` pass, `0` fail (`191 ms`) | ✓ PASS |
| Python vs JS golden parity (`1:1` + `4:3`) | `venv\Scripts\python.exe scripts/verify_js_parity.py` | `Overall MAE: 0.0212 mm \| 4:3 MAE: 0.0237 mm \| PASS: True` | ✓ PASS |
| ORT asset & SHA256 / CDN / UI wiring check | Python verification script | All 3 ORT files present, ONNX+meta SHA256 exact match, `0` ORT CDN refs, all UI hooks present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `WASM-01` | 07-01, 07-02, 07-03 | Local `onnxruntime-web@1.18.0` (SIMD + scalar, `numThreads=1`, mem arena/pattern off, tensor disposal) | ✓ SATISFIED | Vendored files verified; `tests/test_edge_parity.mjs` tests 1–4 pass |
| `WASM-02` | 07-02, 07-03 | Same `mvp_web/` UI on desktop (`run_web_mvp.py`) and APK (local ORT-Web) via `inference_router.js` | ✓ SATISFIED | `inference_router.js` wired into `app.js`/`index.html`/`style.css`; test 5 passes |
| `WASM-03` | 07-01, 07-03 | Pure-JS mask decode from `[1,39,N]` + `[1,32,S/4,S/4]` (NMS, ROI-cropped proto, 4× upsampling, letterbox unpad) | ✓ SATISFIED | `yolo_seg_decode.js` verified via test 6 and `verify_js_parity.py` (`0.0212 mm` MAE) |
| `WASM-04` | 07-01, 07-02, 07-03 | 6.0 mm median disk scale, 1:1 pairing, 36-ray Sobel (`Δr <= 1.2 mm`), `inner_colony` alerts within `0.2 mm` of Python | ✓ SATISFIED | `verify_js_parity.py` (`0.0212 mm` overall, `0.0237 mm` 4:3); tests 6–7 pass; UI badges wired |

### Gaps Summary

No gaps found. All automated parity checks, asset integrity checks, and UI wiring checks passed. Phase 7 goal is achieved and ready for Phase 8 (Offline Android WebView Wrapper APK).

---

_Verified: 2026-11-24T17:55:00Z_
_Verifier: the agent (gsd-verifier)_

---
phase: 11-pipeline-precision-upgrade-fase-3-report
verified: 2026-11-27T12:38:45Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-01-PLAN.md"
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-01-SUMMARY.md"
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-02-PLAN.md"
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-02-SUMMARY.md"
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-03-PLAN.md"
  - ".planning/phases/11-pipeline-precision-upgrade-fase-3-report/11-03-SUMMARY.md"
  - "mvp_web/app.js"
  - "mvp_web/index.html"
  - "mvp_web/inference/edge_detector.js"
  - "mvp_web/inference/plate_roi.js"
  - "mvp_web/inference/sobel_cv.js"
  - "mvp_web/inference/yolo_seg_decode.js"
  - "src/data/preprocess.py"
  - "src/evaluation/cross_validation.py"
  - "streamlit_app.py"
  - "tests/test_phase11_precision.mjs"
  - "tests/test_phase11_python_parity.py"
covered_digest: "v4:sha256:84a01136520a129b458f9a1050797d33da4735bab3e136bf04bcffba9bb910ed"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 11: Pipeline Precision Upgrade & Fase 3 Report Verification Report

**Phase Goal:** Apply the professor's technical feedback and precision criteria (`ROI -> CLAHE -> Inference` ordering, Petri dish ROI crop before `416x416` inference to eliminate Field-of-View scale shrinkage, Sobel radial threshold/refinement aligned with clinical `<= 1.0 mm` diameter risk, perspective/eccentricity check or rectification, and real ONNX neural prototype activation map for XAI) across `mvp_web/` and Python preprocessing, then document the iteration in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`.
**Verified:** 2026-11-27T12:38:45Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Automatic Petri dish ROI isolation precedes CLAHE and `416x416` inference (`ROI -> CLAHE -> Inference`) in both `src/data/preprocess.py` / `streamlit_app.py` and the `mvp_web/` edge pipeline, eliminating table-margin Field-of-View shrinkage. | ✓ VERIFIED | `mvp_web/inference/plate_roi.js` (`detectPlateRoi`, `FILL_SKIP_THRESH = 0.85`, `applyTileClaheLuminance`) wired in `mvp_web/app.js:281` and `mvp_web/inference/edge_detector.js:345-351` (clean RGB ROI to `preprocessImageToNchw`, post-ROI 8x8 CLAHE + 3x3 blur to Sobel/refinement). `src/data/preprocess.py:57-88` and `streamlit_app.py` run ROI strictly before CLAHE. Proven by `tests/test_phase11_precision.mjs` (`P11-ROI` 4/4 PASS, 640x480 in `22.78 ms`) and `tests/test_phase11_python_parity.py` (6/6 OK). |
| 2 | Fiducial `6.0 mm` disk calibration and 36-ray Sobel cross-validation threshold are audited and tightened against clinical `<= 1.0 mm` diameter risk (Hombach et al., 2014), reducing systematic underestimation observed in `Mediciones.csv`. | ✓ VERIFIED | `mvp_web/inference/sobel_cv.js:15` (`DELTA_R_THRESHOLD_MM = 0.5`) and `refineDiskDiameterPx()` (L219-298); `src/evaluation/cross_validation.py:19` (`GEOMETRIC_DELTA_THRESHOLD_MM = 0.5`); `mvp_web/inference/yolo_seg_decode.js` (`DEFAULT_ZONE_MASK_THRESH = 0.38` for `cls === 1`); `mvp_web/inference/edge_detector.js:356-397` preserves `raw_yolo_diam_mm` and recalibrates paired zones with refined `median_disk_px`; `mvp_web/app.js:1022` uses `>0,5` fallback. Proven by `P11-PREC`, `P11-INT`, Python parity (6/6), and E2E (3/3). |
| 3 | Perspective/tilt distortion is explicitly handled (eccentricity/perspective check or projective rectification before ROI crop). | ✓ VERIFIED | `mvp_web/inference/plate_roi.js` fits polar-sampled ellipse covariance (`b/a`), computes `tiltDeg = arccos(b/a)`, sets `tiltWarning` for `> 5°`, and applies affine aspect-ratio compensation in `extractRoiCanvas()`. `mvp_web/index.html:115` (`#tel-tilt-badge`) and `mvp_web/app.js:971` surface the tilt badge in the fiducial telemetry bar. Proven by `P11-ROI` (`b/a = 0.90` test) and `P11-INT`. |
| 4 | XAI visualization uses genuine neural activation (`sigmoid(coeffs @ protos)` from `yolo_seg_decode.js`) rather than purely heuristic rings, while keeping `yolo11n_seg_416_fp32` memory-safe on TR6948. | ✓ VERIFIED | `mvp_web/inference/yolo_seg_decode.js:240-253` accumulates `sigmoid(coeffs @ protos)` into a `104x104` `Float32Array` `neural_xai_map`; `mvp_web/inference/edge_detector.js` forwards it; `mvp_web/app.js:346` stores `state.neuralXaiMap` and renders it via a reusable `104x104` offscreen canvas (retaining heuristic fallback for presets). `test_edge_parity.mjs` confirms 10 consecutive runs with 0 tensor leaks. |
| 5 | Iteration results, architectural changes, and empirical justification are documented in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`. | ✓ VERIFIED | `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md` updated with `v1.1` / Phase 11 architecture (`ROI -> CLAHE`, `0.5 mm` Sobel / Hombach et al. 2014, elliptical tilt compensation, `104x104` `neural_xai_map`) and real measured test outputs while preserving `[PENDIENTE DE CAPTURA DE DATOS]` for uncaptured lab metrics. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `mvp_web/inference/plate_roi.js` | Pure-JS ROI + `>85%` skip + tilt + 8x8 CLAHE | ✓ VERIFIED | 655 lines, UMD/IIFE (`window.ADLMS_PLATE_ROI` + `module.exports`), wired into `index.html`, `app.js`, and `edge_detector.js`. |
| `mvp_web/inference/sobel_cv.js` | `DELTA_R_THRESHOLD_MM = 0.5` + `refineDiskDiameterPx()` | ✓ VERIFIED | 307 lines, `0.5 mm` radial threshold, `geo_status`, `refineDiskDiameterPx()` wired into `edge_detector.js`. |
| `mvp_web/inference/yolo_seg_decode.js` | `zoneMaskThreshold = 0.38` + `104x104` `neural_xai_map` | ✓ VERIFIED | 482 lines, class-conditional `0.38` zone threshold and `neural_xai_map` `Float32Array` accumulation in `decodeMaskRoi()`. |
| `mvp_web/inference/edge_detector.js` | Clean RGB YOLO + post-ROI CLAHE + disk refinement + XAI forwarding | ✓ VERIFIED | 448 lines, feeds clean RGB ROI to `preprocessImageToNchw()`, applies post-ROI CLAHE + 3x3 blur, refines `6.0 mm` disk, forwards `neural_xai_map`. |
| `mvp_web/app.js` & `mvp_web/index.html` | ROI canvas sharing, `#tel-tilt-badge`, `0.5 mm` fallback, live `neural_xai_map` | ✓ VERIFIED | Script load order `image_scaler.js -> plate_roi.js -> edge_detector.js -> app.js`; `#tel-tilt-badge` at `index.html:115`; `ADLMS_PLATE_ROI` & `neural_xai_map` wired in `app.js`. |
| `src/data/preprocess.py` & `streamlit_app.py` | `ROI -> CLAHE` ordering + `>85%` skip fallback | ✓ VERIFIED | `crop_plate_roi()` runs strictly before `apply_clahe()` with `(2 * r) / min(h, w) > 0.85` skip and coordinate clamping; `streamlit_app.py` runs `apply_plate_roi()` before `apply_optical_clahe()`. |
| `src/evaluation/cross_validation.py` | `GEOMETRIC_DELTA_THRESHOLD_MM = 0.5` | ✓ VERIFIED | Line 19 sets `0.5` (`1.0 mm` diameter clinical risk). |
| `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md` | Phase 11 / `v1.1` documentation | ✓ VERIFIED | 394 lines, documents `v1.1` architecture, Hombach et al. (2014) rationale, and verified test results without fabricated data. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `mvp_web/index.html` | `mvp_web/inference/plate_roi.js` | `<script src="inference/plate_roi.js">` (L375) | ✓ WIRED | Loaded after `image_scaler.js` and before `edge_detector.js` and `app.js`. |
| `mvp_web/app.js` | `window.ADLMS_PLATE_ROI` | `loadUpload()` (L281) | ✓ WIRED | Shares cropped/tilt-compensated clean RGB canvas with `edge_detector.js`. |
| `mvp_web/inference/edge_detector.js` | `plate_roi.js` & `sobel_cv.js` | `applyTileClaheLuminance` + `refineDiskDiameterPx` (L345-397) | ✓ WIRED | Post-ROI CLAHE luminance feeds high-res `6.0 mm` disk refinement and 36-ray Sobel. |
| `mvp_web/inference/yolo_seg_decode.js` | `mvp_web/app.js` | `neural_xai_map` (`104x104` `Float32Array`) | ✓ WIRED | Forwarded through `edge_detector.js` to `state.neuralXaiMap` (L346) and rendered in `computeHeat()`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 11 + Edge + Benchmark JS suites | `node --test tests/test_edge_parity.mjs tests/test_phase10_benchmark.mjs tests/test_phase11_precision.mjs` | **24/24 PASS** (`0` fail, `357.5 ms`; `detectPlateRoi` 640x480 in `22.78 ms`) | ✓ PASS |
| Python Phase 11 parity suite | `.\venv\Scripts\python.exe -m unittest tests.test_phase11_python_parity -v` | **6/6 OK** (`0.138 s`) | ✓ PASS |
| Python End-to-End pipeline suite | `.\venv\Scripts\python.exe tests/test_end_to_end_pipeline.py` | **3/3 PASS** (`ALL END-TO-END VERIFICATION TESTS PASSED.`) | ✓ PASS |
| Edge asset sync dry-run | `.\venv\Scripts\python.exe scripts/sync_edge_assets.py --dry-run` | **36 files, 33.99 MB total** (includes `inference/plate_roi.js` `20.7 KB` & `yolo11n_seg_416_fp32.onnx` `11319.0 KB`) | ✓ PASS |

### Anti-Patterns & Deferred Items

- **Debt markers (`TBD|FIXME|XXX`):** 0 found across all 9 modified implementation files.
- **Pre-existing out-of-scope failure (logged in `.planning/phases/11-pipeline-precision-upgrade-fase-3-report/deferred-items.md`):** `tests/test_phase9_tablet_formulary.mjs:69` (`APK CSS must hide .bg-glow`) fails due to pre-existing commit `6d2f48aa26fbe9b0e15233431c3463d85cfcd2a3` generalizing `.bg-glow { display: none !important; }` in `mvp_web/style.css:1454`. Not caused by Phase 11; tracked for dedicated UI test maintenance.

### Gaps Summary

None. All 5 ROADMAP success criteria and all Phase 11 decisions (`D-01`..`D-10`) are implemented, wired, and verified against live test runs.

---

_Verified: 2026-11-27T12:38:45Z_
_Verifier: the agent (gsd-verifier)_

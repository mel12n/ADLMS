# Phase 11: Pipeline Precision Upgrade & Fase 3 Report - Context

**Gathered:** 2026-11-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply the professor's Phase 2 technical feedback and empirical precision criteria to the ADLMS inference and preprocessing pipeline (`ROI -> CLAHE -> Inference`, high-resolution `6.0 mm` disk calibration + stricter Sobel 36-ray cross-validation, elliptical perspective compensation + UI tilt alert, and genuine ONNX neural prototype activation map for XAI) while preserving the locked `yolo11n_seg_416_fp32` TR6948 memory/latency envelope, and document the complete iteration in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`.

</domain>

<decisions>
## Implementation Decisions

### 1. Automatic Petri Dish ROI -> CLAHE -> Inference Ordering
- **D-01:** Implement automatic circular Petri dish ROI detection in both pure-JS (`mvp_web/`) and OpenCV Python (`src/data/preprocess.py`, `streamlit_app.py`), with a safe fallback that skips cropping when the plate already fills `> 85%` of the frame (matching `Antibiogram_demo/Train` framing).
- **D-02:** Feed the **clean RGB ROI crop** (without CLAHE) into `yolo11n_seg_416_fp32` (`416x416` letterbox) to avoid domain shift against `best.pt` weights trained without CLAHE.
- **D-03:** Apply **CLAHE strictly AFTER ROI isolation** (`ROI -> CLAHE`) for high-resolution (`<= 1024 px`) Sobel 36-ray radial profiling, disk edge refinement, and optical visualization, and fix the inverted `CLAHE -> ROI` order in `src/data/preprocess.py` and `streamlit_app.py`.

### 2. High-Resolution 6.0 mm Fiducial Calibration & Sobel 36-Ray Cross-Validation
- **D-04:** Implement a hybrid refinement strategy: refine the `6.0 mm` paper disk diameter on the high-resolution (`<= 1024 px`) ROI so `px_per_mm` is not inflated by `104x104` mask prototype dilation.
- **D-05:** Tighten the 36-ray radial Sobel geometric discrepancy alert threshold from `1.2 mm` radius (`2.4 mm` diameter) to **`0.5 mm` radius (`1.0 mm` diameter)** across both `mvp_web/inference/sobel_cv.js` and `src/evaluation/cross_validation.py`, aligned with Hombach et al. (2014) clinical risk (`1.0 mm` error can shift `S <-> R`).
- **D-06:** Evaluate lowering the inhibition-zone mask threshold (`maskThreshold` in `0.35–0.40` vs `0.50`) in `yolo_seg_decode.js` to counteract systematic halo underestimation documented in `Mediciones.csv`, while keeping raw YOLO + Sobel measurements traceable.

### 3. Perspective / Tilt Handling
- **D-07:** Detect elliptical eccentricity of the Petri dish contour (`b/a` ratio) during ROI extraction; apply lightweight geometric aspect-ratio compensation (ellipse -> circle) before inference when moderate tilt is detected, and surface a visual tilt warning in the fiducial telemetry UI when estimated inclination exceeds `~5°`.

### 4. Genuine Neural XAI (ONNX Prototype Activation Map) & Fase 3 Documentation
- **D-08:** Expose the continuous neural probability field `sigmoid(coeffs @ protos)` already computed inside `mvp_web/inference/yolo_seg_decode.js` (`FP32` `/model.23/` segment head) and render it as the live XAI activation heatmap in `mvp_web/app.js`, retaining the existing heuristic heatmap strictly as a fallback for pre-loaded preset plates without live ONNX tensors.
- **D-09:** Document the complete Phase 11 iteration (architecture changes, `ROI -> CLAHE`, Sobel `0.5 mm` radio / `1.0 mm` diámetro justification, perspective compensation, real ONNX XAI map, and real before/after measured metrics without fabricated data) in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`.

### 5. Subagent Model Routing Policy (Phase 11)
- **D-10:** Use **Neon** for thinking/reading/research/planning/verification subagents and **Hydrogen** for writing/execution/documentation subagents.

### the agent's Discretion
- Exact pure-JS circular/elliptical Petri dish boundary detector algorithm (e.g., radial gradient/edge circle-ellipse fit on downscaled luminance) as long as it runs in `< 100 ms` on TR6948 with zero external dependencies and passes parity/unit tests.
- Exact `tileGridSize` / `clipLimit` tuning for JS/Python CLAHE after ROI cropping.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Precision Criteria & Professor Feedback
- `.planning/HALO_PRECISION_IMPROVEMENT_CRITERIA.md` — Empirical diagnosis of systematic underestimation (`-12%` to `-29%` on 13/15 measurements) and prioritized improvement criteria
- `Mediciones.csv` — 15 paired `app` vs `human` measurements across 3 phone-captured plates with table margin
- `C:\Users\cmelian\Git\Anteproyecto\f2_retroalimentacion_profesor.md` — Structured Phase 2 professor feedback (`ROI -> CLAHE`, Sobel `1.2 mm` vs Hombach `1.0 mm`, perspective, Grad-CAM/FP32)
- `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md` — Target Fase 3 academic progress report to update with Phase 11 iteration results

### Edge Runtime & Locked Model Contract
- `mvp_web/models/model_meta.json` — Locked shipping variant `yolo11n_seg_416_fp32` (`[1,3,416,416]`, `output0 [1,39,3549]`, `output1 [1,32,104,104]`)
- `exports/tr6948_benchmark_report.md` — TR6948 empirical benchmark (`FP32` `0.4678 mm` MAE vs `QDQ INT8` `0.8197 mm`, `0 lmkd`)
- `.planning/research/PITFALLS.md` — TR6948 968 MB RAM / WebView 119 memory hygiene constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mvp_web/image_scaler.js`: Caps uploaded/captured images at `<= 1024 px` via Canvas 2D; natural entry point or upstream partner for `plate_roi.js`
- `mvp_web/inference/edge_detector.js`: Manages ORT-Web session, `preprocessImageToNchw()`, and `extractOriginalRgba()`
- `mvp_web/inference/yolo_seg_decode.js`: Already computes `coeffs @ protos` and `sigmoid(val)` in `decodeMaskRoi()` (L182-226)
- `mvp_web/inference/sobel_cv.js` & `src/evaluation/cross_validation.py`: 36-ray radial Sobel cross-validation (`DELTA_R_THRESHOLD_MM = 1.2`)
- `src/data/preprocess.py` & `streamlit_app.py`: Existing OpenCV `apply_clahe()` and `crop_plate_roi()` currently in inverted order (`CLAHE -> ROI`)

### Established Patterns
- Zero-build UMD/IIFE JS modules (`window.ADLMS_*` + `module.exports`) testable via `node --test`
- SRP line-count discipline (`telemetry_ui.js`, `image_scaler.js`, `formulary_ui.js`)
- `scripts/sync_edge_assets.py` syncs `mvp_web/` into `android/app/src/main/assets/mvp_web/`

### Integration Points
- `mvp_web/index.html` script load order before `app.js`
- `mvp_web/app.js` (`loadUpload`, `computeHeat`, `rebuildBase`, `renderPanel` fiducial telemetry bar)
- `tests/test_edge_parity.mjs` and `scripts/verify_js_parity.py` for automated parity regression checks

</code_context>

<specifics>
## Specific Ideas

- The 3 plates in `Mediciones.csv` were captured with a phone leaving table margin around the Petri dish, which caused `1024 px -> 416x416` letterbox compression to shrink `6.0 mm` disks to `~3.8` prototype pixels (`104x104`), directly driving the ~20% `px/mm` overestimation.
- Keep `yolo11n_seg_416_fp32` as the locked model (no retraining required for Phase 11).

</specifics>

<deferred>
## Deferred Ideas

- Full projective 4-point homography requiring external fiducial markers or live `getUserMedia` AR reticle (belongs to Milestone 1.5 / Phase 2.8)
- Retraining `YOLO11n-seg` at `640x640` or migrating to native Android LiteRT/NCNN INT8 (belongs to Phase 3 / future milestone)

</deferred>

---

*Phase: 11-Pipeline Precision Upgrade & Fase 3 Report*
*Context gathered: 2026-11-27*

# Phase 11: Pipeline Precision Upgrade & Fase 3 Report - Research

**Researched:** 2026-11-27
**Domain:** Edge Computer Vision (Pure-JS Canvas/TypedArray ROI + CLAHE + ONNX Prototype XAI), Python/OpenCV Parity, Clinical Microbiology AST Precision
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Implement automatic circular Petri dish ROI detection in both pure-JS (`mvp_web/`) and OpenCV Python (`src/data/preprocess.py`, `streamlit_app.py`), with a safe fallback that skips cropping when the plate already fills `> 85%` of the frame (matching `Antibiogram_demo/Train` framing).
- **D-02:** Feed the **clean RGB ROI crop** (without CLAHE) into `yolo11n_seg_416_fp32` (`416x416` letterbox) to avoid domain shift against `best.pt` weights trained without CLAHE.
- **D-03:** Apply **CLAHE strictly AFTER ROI isolation** (`ROI -> CLAHE`) for high-resolution (`<= 1024 px`) Sobel 36-ray radial profiling, disk edge refinement, and optical visualization, and fix the inverted `CLAHE -> ROI` order in `src/data/preprocess.py` and `streamlit_app.py`.
- **D-04:** Implement a hybrid refinement strategy: refine the `6.0 mm` paper disk diameter on the high-resolution (`<= 1024 px`) ROI so `px_per_mm` is not inflated by `104x104` mask prototype dilation.
- **D-05:** Tighten the 36-ray radial Sobel geometric discrepancy alert threshold from `1.2 mm` radius (`2.4 mm` diameter) to **`0.5 mm` radius (`1.0 mm` diameter)** across both `mvp_web/inference/sobel_cv.js` and `src/evaluation/cross_validation.py`, aligned with Hombach et al. (2014) clinical risk (`1.0 mm` error can shift `S <-> R`).
- **D-06:** Evaluate lowering the inhibition-zone mask threshold (`maskThreshold` in `0.35–0.40` vs `0.50`) in `yolo_seg_decode.js` to counteract systematic halo underestimation documented in `Mediciones.csv`, while keeping raw YOLO + Sobel measurements traceable.
- **D-07:** Detect elliptical eccentricity of the Petri dish contour (`b/a` ratio) during ROI extraction; apply lightweight geometric aspect-ratio compensation (ellipse -> circle) before inference when moderate tilt is detected, and surface a visual tilt warning in the fiducial telemetry UI when estimated inclination exceeds `~5°`.
- **D-08:** Expose the continuous neural probability field `sigmoid(coeffs @ protos)` already computed inside `mvp_web/inference/yolo_seg_decode.js` (`FP32` `/model.23/` segment head) and render it as the live XAI activation heatmap in `mvp_web/app.js`, retaining the existing heuristic heatmap strictly as a fallback for pre-loaded preset plates without live ONNX tensors.
- **D-09:** Document the complete Phase 11 iteration (architecture changes, `ROI -> CLAHE`, Sobel `0.5 mm` radio / `1.0 mm` diámetro justification, perspective compensation, real ONNX XAI map, and real before/after measured metrics without fabricated data) in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`.
- **D-10:** Use **Neon** for thinking/reading/research/planning/verification subagents and **Hydrogen** for writing/execution/documentation subagents.

### the agent's Discretion
- Exact pure-JS circular/elliptical Petri dish boundary detector algorithm (e.g., radial gradient/edge circle-ellipse fit on downscaled luminance) as long as it runs in `< 100 ms` on TR6948 with zero external dependencies and passes parity/unit tests.
- Exact `tileGridSize` / `clipLimit` tuning for JS/Python CLAHE after ROI cropping.

### Deferred Ideas (OUT OF SCOPE)
- Full projective 4-point homography requiring external fiducial markers or live `getUserMedia` AR reticle (belongs to Milestone 1.5 / Phase 2.8)
- Retraining `YOLO11n-seg` at `640x640` or migrating to native Android LiteRT/NCNN INT8 (belongs to Phase 3 / future milestone)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **P11-ROI** | Automatic Petri dish ROI detection (`> 85%` skip fallback) + elliptical tilt compensation (`b/a`, `arccos(b/a)`, `> 5°` UI warning) + post-ROI tile CLAHE (`8x8`) in pure-JS (`mvp_web/inference/plate_roi.js`) | Section 3.1 (Pure-JS SRP module design & `< 100 ms` downscaled radial boundary fit) |
| **P11-PARITY** | Fix `CLAHE -> ROI` to `ROI -> CLAHE` in `src/data/preprocess.py` and `streamlit_app.py`; tighten Sobel threshold to `0.5 mm` radius (`1.0 mm` diameter) in `sobel_cv.js` and `cross_validation.py` | Section 3.2 (Exact line-level Python & JS parity edits) |
| **P11-PREC** | High-res (`<= 1024 px`) `6.0 mm` disk diameter refinement + `inhibition_zone` `maskThreshold` (`0.38` vs `0.50`) in `yolo_seg_decode.js` & `edge_detector.js` | Section 3.3 (Radial luminance disk edge refinement & non-breaking decoder options) |
| **P11-XAI** | Genuine neural XAI activation map (`sigmoid(coeffs @ protos)`) from `yolo_seg_decode.js` rendered in `app.js` (`computeHeat`) with preset fallback | Section 3.4 (104x104 continuous probability grid export & canvas rendering) |
| **P11-DOC** | Document Phase 11 iteration and real measured verification outputs in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md` | Section 3.5 (Exact section map in `f3_s09cmelian_avance.md`) |
</phase_requirements>

## Summary

Phase 11 upgrades the ADLMS inference and preprocessing pipeline to resolve the systematic `-12%` to `-29%` halo underestimation diagnosed in [HALO_PRECISION_IMPROVEMENT_CRITERIA.md](file:///c:/Users/cmelian/Git/ADLMS/.planning/HALO_PRECISION_IMPROVEMENT_CRITERIA.md) and [Mediciones.csv](file:///c:/Users/cmelian/Git/ADLMS/Mediciones.csv), while directly addressing the professor's Phase 2 technical observations in [f2_retroalimentacion_profesor.md](file:///c:/Users/cmelian/Git/Anteproyecto/f2_retroalimentacion_profesor.md). All improvements operate within the locked `yolo11n_seg_416_fp32` model and TR6948 (`968 MB` RAM, WebView 119, zero-build JS) envelope with zero new external dependencies.

**Primary recommendation:** Build a single zero-build SRP module `mvp_web/inference/plate_roi.js` (`window.ADLMS_PLATE_ROI` + `module.exports`) that runs radial-edge circle/ellipse detection on a `160x160` downscaled luminance buffer (`< 15 ms` on desktop, `< 60 ms` on TR6948), crops & aspect-corrects the Petri dish cleanly before `yolo11n_seg_416_fp32`, and applies `8x8` tile CLAHE strictly post-ROI for high-res (`<= 1024 px`) `6.0 mm` disk edge refinement and 36-ray Sobel cross-validation (`0.5 mm` radius threshold). Expose the `104x104` continuous `sigmoid(coeffs @ protos)` field from `yolo_seg_decode.js` for genuine neural XAI rendering in `app.js`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Image downscale (`<= 1024 px`) | Browser / Client (`image_scaler.js`) | — | Prevents TR6948 WebView OOM before any pixel processing |
| Petri dish ROI + tilt detection + aspect-ratio compensation | Browser / Client (`inference/plate_roi.js`) | Python Track B (`src/data/preprocess.py`, `streamlit_app.py`) | Isolates dish before `416x416` letterbox so `6.0 mm` disks are not shrunk by table margins |
| Post-ROI `8x8` tile CLAHE | Browser / Client (`inference/plate_roi.js`) | Python Track B (`src/data/preprocess.py`, `streamlit_app.py`) | Enhances agar/lawn contrast for high-res Sobel & disk refinement without shifting YOLO RGB domain |
| Clean RGB `416x416` ONNX inference + `104x104` XAI map | Browser / Client (`edge_detector.js`, `yolo_seg_decode.js`) | — | Locked `yolo11n_seg_416_fp32` contract; `sigmoid(coeffs @ protos)` already computed in decoder |
| High-res `6.0 mm` disk refinement + `0.5 mm` Sobel CV | Browser / Client (`sobel_cv.js`, `edge_detector.js`) | Python (`src/evaluation/cross_validation.py`) | Sub-millimeter calibration & Hombach (2014) clinical safety threshold |
| Tilt warning telemetry + Neural XAI rendering | Browser / Client (`app.js`, `index.html`) | — | Surfaces `> 5°` tilt alert and live neural probability map in clinical UI |

## Standard Stack

Zero new external packages are required. Everything uses existing runtime primitives:
- **Frontend (Track A & Android WebView):** Vanilla ES2022 zero-build UMD/IIFE modules (`window.ADLMS_*` + `module.exports`), Canvas 2D, `Float32Array`/`Uint8ClampedArray`, `onnxruntime-web@1.18.0` (vendored). [VERIFIED: `mvp_web/inference/edge_detector.js:1-12`]
- **Backend / Scientific (Track B):** Python 3, `opencv-python` (`cv2`), `numpy`, `Pillow` (`PIL`). [VERIFIED: `src/data/preprocess.py:1-2`, `src/evaluation/cross_validation.py:16-17`]
- **Testing:** Node.js built-in `node:test` (`node --test tests/test_edge_parity.mjs`), Python `pytest` / `scripts/verify_js_parity.py`. [VERIFIED: `tests/test_edge_parity.mjs:1-16`]

## Architecture Patterns & Exact Contracts

### 3.1 Pure-JS SRP Module: `mvp_web/inference/plate_roi.js`

Attach `window.ADLMS_PLATE_ROI` in browsers and `module.exports` in Node.js (matching `image_scaler.js` and `sobel_cv.js`). Load in `mvp_web/index.html` right after `image_scaler.js` and before `edge_detector.js` / `app.js`.

**Pipeline Data Flow:**
```
Upload/Camera (<= 1024 px Canvas)
  │
  ▼
detectPlateRoi(rgba, width, height)  ──[downscale to ~160px longest edge, < 15-60ms]──┐
  │                                                                                   │
  ├─ fillRatio > 0.85 (plate already fills frame) ──► skipCrop = true, pass-through   │
  └─ fillRatio <= 0.85 ──► crop tight square around (cx, cy, rx, ry) + 4% margin      │
       │                                                                              │
       ├─ aspectRatio = b / a (minor / major), tiltDeg = arccos(b / a) * 180 / PI     │
       ├─ if tiltDeg > 2.0 && b/a >= 0.75: scale minor axis to match major axis       │
       └─ tiltWarning = tiltDeg > 5.0  ──► surface in fiducial telemetry UI           │
  │                                                                                   │
  ├──► Clean RGB ROI Canvas ──► edge_detector.js (416x416 letterbox -> YOLO11n-seg)   │
  └──► Post-ROI 8x8 Tile CLAHE (applyTileClahe) ──► High-res disk edge refinement     │
                                                ──► 36-ray Sobel CV (0.5 mm)          │
                                                ──► Optional visual CLAHE layer       │
```

**Fast `< 100 ms` Pure-JS Circle/Ellipse Detector (`detectPlateRoi`):**
1. Downscale luminance (`0.299 R + 0.587 G + 0.114 B`) to `dw <= 160` px (scale `s = dw / max(W, H)`).
2. Apply 1-pass separable 3x3 box/Gaussian blur on the `<= 160x160` buffer.
3. Compute gradient magnitude `|Gx| + |Gy|` and Otsu/percentile-85 edge threshold.
4. Estimate center `(cx, cy)` via radial symmetry voting or center-weighted foreground/edge centroid, then cast `72` rays (every `5°`) outward from `(cx, cy)` from `0.25 * min(dw, dh)` to `0.52 * max(dw, dh)` to find the outermost strong Petri dish rim peak along each ray.
5. Reject outlier rays using median + MAD (`|r_i - med| <= 2.5 * MAD`).
6. Fit axis-aligned / rotated ellipse radii `(a, b)` from the inlier boundary points `(x_i, y_i)` via 2x2 covariance eigenvalues (`lambda1 >= lambda2`, `a = sqrt(2 * lambda1)`, `b = sqrt(2 * lambda2)`, major-axis angle `phi = 0.5 * atan2(2*covXY, covXX - covYY)`).
7. Compute:
   - `fillRatio = (2 * a) / min(dw, dh)` (if `fillRatio > 0.85`, set `cropped: false` and return full frame `[0, 0, W, H]` per **D-01**).
   - `axisRatio = clamp(b / a, 0.5, 1.0)`.
   - `tiltDeg = Math.acos(axisRatio) * (180 / Math.PI)`.
   - `tiltWarning = tiltDeg > 5.0` (per **D-07**).
8. `extractRoiCanvas(sourceCanvasOrImg, roiResult)`:
   - If `!roiResult.cropped && !roiResult.perspectiveCompensated`, return original canvas directly (zero copy).
   - Otherwise, draw onto a reusable offscreen canvas `<= 1024 px`: if `tiltDeg > 2.0 && axisRatio >= 0.75`, rotate by `-phi`, scale minor axis by `a / b`, rotate back by `+phi` (lightweight affine ellipse -> circle compensation), and crop to the square bounding box around `(cx, cy, a * 1.04)`.

**Fast Pure-JS Tile CLAHE (`applyTileClahe(rgba, width, height, opts)`):**
- Default `tilesX = 8`, `tilesY = 8`, `clipLimit = 2.0` (matching `src/data/preprocess.py:17`).
- Compute 256-bin luminance histogram per tile, clip bins exceeding `limit = Math.max(1, Math.round(clipLimit * tilePixels / 256))`, redistribute excess uniformly, build per-tile CDF lookup table `[0..255]`.
- Bilinearly interpolate the 4 nearest tile CDFs for each pixel to obtain `L_out`, and scale RGB proportionally (`ratio = L_out / Math.max(1, L_in)`) or return `Float32Array` luminance directly for `sobel_cv.js`.
- **Memory hygiene:** Reuse scratch typed arrays or allocate only 1 luminance buffer (`<= 1024*1024*4` bytes = `4 MB` max).

**Exported API (`mvp_web/inference/plate_roi.js`):**
- `detectPlateRoi(rgba, width, height, opts)` -> `{ found, cropped, fillRatio, cx, cy, rx, ry, majorAxis, minorAxis, angleRad, axisRatio, tiltDeg, tiltWarning, perspectiveCompensated, cropBox: { x, y, w, h } }`
- `extractRoiCanvas(imgOrCanvas, roiInfo)` -> `{ canvas, width, height, roiInfo }`
- `applyTileClaheLuminance(rgba, width, height, opts)` -> `Float32Array` (enhanced luminance in `[0, 255]`)
- `applyTileClaheRgba(rgba, width, height, opts)` -> `Uint8ClampedArray` (for visual CLAHE layer in `rebuildBase()`)

### 3.2 Python & JS Parity Edits

1. **`src/data/preprocess.py`** [VERIFIED: `src/data/preprocess.py:59-74`]:
   - Currently L71-72:
     ```python
     img_clahe = apply_clahe(img)
     roi, _ = crop_plate_roi(img_clahe)
     ```
   - **Fix (D-01, D-03):** Invert to `roi, roi_meta = crop_plate_roi(img)` FIRST, then `img_clahe = apply_clahe(roi)`. Add `> 85%` fill-ratio skip fallback in `crop_plate_roi()` (`if (2 * r) / min(h, w) > 0.85: return image_bgr, (0, 0, w, h)`).
2. **`streamlit_app.py`** [VERIFIED: `streamlit_app.py:478-482`]:
   - Currently L479-482:
     ```python
     if enable_clahe:
         proc_img = apply_optical_clahe(proc_img)
     if enable_roi:
         proc_img = apply_plate_roi(proc_img)
     ```
   - **Fix (D-03):** Swap order so `if enable_roi: proc_img = apply_plate_roi(proc_img)` executes strictly BEFORE `if enable_clahe: proc_img = apply_optical_clahe(proc_img)`.
3. **`mvp_web/inference/sobel_cv.js`** [VERIFIED: `mvp_web/inference/sobel_cv.js:15,203-204`]:
   - Change `var DELTA_R_THRESHOLD_MM = 1.2;` -> `var DELTA_R_THRESHOLD_MM = 0.5;` (per **D-05**, `0.5 mm` radius = `1.0 mm` diameter, Hombach et al., 2014).
   - Update `geo_message` strings to dynamically reference `DELTA_R_THRESHOLD_MM` (`≤ 0.5 mm` / `> 0.5 mm`).
4. **`src/evaluation/cross_validation.py`** [VERIFIED: `src/evaluation/cross_validation.py:19,97`]:
   - Change `GEOMETRIC_DELTA_THRESHOLD_MM = 1.2` -> `GEOMETRIC_DELTA_THRESHOLD_MM = 0.5`.
   - Update docstring L97 (`|r_yolo - r_sobel| <= 0.5 mm`).
5. **`mvp_web/app.js`** [VERIFIED: `mvp_web/app.js:170-173`]:
   - Update fallback threshold in `buildDiscsFromPlateData()` from `deltaR <= 1.2` to `deltaR <= 0.5` and message strings `1,2 mm` -> `0,5 mm`.

### 3.3 High-Resolution `6.0 mm` Disk Refinement & Halo `maskThreshold`

**Problem:** In `yolo_seg_decode.js:226` [VERIFIED: `mvp_web/inference/yolo_seg_decode.js:225-231`], `sig > 0.5` is hardcoded for all 3 classes (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`), and `disk.diamPx` comes solely from the `104x104` prototype mask (`1` proto pixel = `~1.5 mm` on uncropped phone photos).

**Solution (D-04 & D-06):**
1. **`yolo_seg_decode.js`:**
   - Add optional `opts.zoneMaskThreshold` (default `0.38` for `cls === 1` `inhibition_zone`, while keeping `0.5` for `cls === 0` `antibiotic_disk` and `cls === 2` `inner_colony`).
   - Pass `maskThresh = det.cls === 1 ? zoneMaskThresh : 0.5` into `decodeMaskRoi(det, out1, protoH, protoW, imgsz, lb, maskThresh)`.
   - Keep `DEFAULT_ZONE_MASK_THRESH = 0.38` (within the `0.35–0.40` target range in D-06). Note: in `tests/test_edge_parity.mjs:247`, synthetic logits are `+6.0` inside and `-6.0` outside (`sigmoid(+6) = 0.9975`, `sigmoid(-6) = 0.0025`), so `0.38` preserves 100% pass rate on `test_edge_parity.mjs`!
2. **High-Res `6.0 mm` Disk Diameter Refinement (`sobel_cv.js` + `edge_detector.js`):**
   - Add `refineDiskDiameterPx(grayBlurred, width, height, cxPx, cyPx, approxDiamPx)` in `sobel_cv.js`:
     - Cast `36` rays from `(cxPx, cyPx)` across `[0.55 * approxR, 1.25 * approxR]` on the high-res (`<= 1024 px`) post-ROI blurred luminance.
     - Find the strongest **bright-to-dark** radial drop (negative 1D Sobel `dI/dr < 0`, because the white filter paper disk is brighter than the surrounding agar/halo).
     - Take the median radius across valid rays (`>= 12` rays) and clamp within `[0.70 * approxDiamPx, 1.10 * approxDiamPx]` to prevent outliers.
   - In `edge_detector.js` (`runEdgeInference`), after `decodeYoloSeg()` and `extractBlurredLuminance()` (using post-ROI CLAHE luminance):
     - Refine each disk's `disk_diam_px` on the high-res ROI, recompute `median_disk_px`, `scale_px_per_mm = median_disk_px / 6.0`, `scale_mm_per_px = 6.0 / median_disk_px`, and rescale `det.diam_mm` (`raw_yolo_diam_px * scale_mm_per_px`) while preserving `det.raw_yolo_diam_mm` for traceability (D-06).

### 3.4 Genuine Neural XAI Activation Map (D-08)

**How it works without extra ONNX inference:**
- `yolo_seg_decode.js:182-193` [VERIFIED: `mvp_web/inference/yolo_seg_decode.js:182-193`] already computes `sum += coeffs[m] * out1[m * protoPlane + pIdx]` on the `104x104` prototype grid (`out1` has shape `[1, 32, 104, 104]`).
- In `decodeYoloSeg()`, allocate a single `Float32Array(protoH * protoW)` (`104 * 104 * 4 = 43 KB` — negligible on TR6948) named `neuralXaiGrid`.
- For every decoded `inhibition_zone` (`cls === 1`) and `antibiotic_disk` (`cls === 0`), write `Math.max(neuralXaiGrid[pIdx], sigmoid(logit))` into the `104x104` grid (or compute the edge-attention probability `4 * p * (1 - p)` / continuous `p` for zones so the heatmap highlights both the zone body and the decision boundary).
- Return `neural_xai_map: { width: protoW, height: protoH, lb: { padLeft, padTop, newW, newH, imgsz }, data: neuralXaiGrid }` from `decodeYoloSeg()` and forward it in `runEdgeInference()`'s return payload.
- In `mvp_web/app.js`:
  - Store `state.neuralXaiMap = data.neural_xai_map || null` in `loadUpload()` (and clear to `null` in `loadPlate()` for preset plates).
  - In `computeHeat()` [VERIFIED: `mvp_web/app.js:375-447`]: if `state.neuralXaiMap && state.neuralXaiMap.data`, render the `104x104` grid (unpadding `padLeft`/`padTop`/`newW`/`newH` to match `state.ox, state.oy, W, H`) through `jet(v)` onto `heat` canvas with bilinear smoothing (`imageSmoothingQuality = 'high'`). Otherwise, execute the existing heuristic fallback for preset plates.

### 3.5 Exact Sections to Update in `C:\Users\cmelian\Git\Anteproyecto\f3_s09cmelian_avance.md`

Verified line ranges in [f3_s09cmelian_avance.md](file:///C:/Users/cmelian/Git/Anteproyecto/f3_s09cmelian_avance.md):
- **Section 3.2 (L82-101):** Update Mermaid flowchart and narrative step 2–3 to reflect `ROI -> CLAHE` ordering, elliptical tilt compensation, and `Δr > 0.5 mm` (`1.0 mm` diameter) Sobel threshold.
- **Section 3.4 Tabla 1 (L120-122):** Update `Δr > 1.2 mm` -> `Δr > 0.5 mm` (`1.0 mm` diámetro, Hombach et al., 2014) and add row for Petri dish ROI isolation & perspective tilt warning (`> 5°`).
- **Section 4.1 (L143-147):** Add `mvp_web/inference/plate_roi.js` as the 4th specialized edge module (`ROI -> CLAHE` + tilt estimation).
- **Section 4.3 (L164-187):** Add bullet 5 documenting Phase 11 precision upgrades (`ROI -> CLAHE`, high-res `6.0 mm` disk refinement, `maskThreshold` calibration, Sobel `0.5 mm` radius / `1.0 mm` diameter per Hombach et al., 2014, elliptical tilt compensation, and genuine `FP32` ONNX prototype activation map XAI).
- **Section 6.2 (L239-248):** Record real measured before/after automated test & parity verification metrics (keep `[SECCIÓN PENDIENTE DE CAPTURA DE DATOS]` for uncaptured clinical/NASA-TLX lab campaign — **never fabricate data** per D-09).
- **Section VII (L264, L278), Section VIII Bitácora (L313), Section IX Trazabilidad (L332):** Add `v1.1` / Phase 11 entry documenting the precision upgrade iteration and verification results.

## Common Pitfalls

### Pitfall 1: Feeding CLAHE-altered pixels into `yolo11n_seg_416_fp32`
- **What goes wrong:** `best.pt` was trained on clean RGB images; applying CLAHE before YOLO causes domain shift and false positives on agar texture.
- **How to avoid:** Enforce **D-02 / D-03**: feed clean RGB ROI canvas to `preprocessImageToNchw()`, and apply `applyTileClaheLuminance()` only to the high-res buffer used by disk edge refinement and 36-ray Sobel CV.

### Pitfall 2: Breaking `tests/test_edge_parity.mjs` with `0.5 mm` Sobel threshold or ROI mocks
- **What goes wrong:** `tests/test_edge_parity.mjs:106-125` mocks `document.createElement('canvas')` with minimal methods (`fillStyle`, `fillRect`, `drawImage`, `getImageData`). If `edge_detector.js` calls unsupported canvas methods (like `translate`/`rotate`/`scale` without checking) or fails when `ADLMS_PLATE_ROI` is not loaded in Node, existing tests will fail.
- **How to avoid:** Make `ADLMS_PLATE_ROI` optional/graceful in `edge_detector.js` (skip ROI crop when image is blank/synthetic or `roi.found === false`), and verify `tests/test_edge_parity.mjs` line 299–309 (`okRes.delta_r_mm <= 0.5`, `badRes.delta_r_mm > 1.2` — both still pass with `0.5 mm` threshold!).

### Pitfall 3: Coordinate mismatch after ROI crop in `app.js`
- **What goes wrong:** If `edge_detector.js` crops the image internally but `app.js` renders the uncropped image, all `(x, y, hx, hy)` normalized coordinates will be misaligned.
- **How to avoid:** Perform `plate_roi.detectPlateRoi()` + `plate_roi.extractRoiCanvas()` in `app.js` (`loadUpload()`) right after `image_scaler.loadAndDownscaleFile()`, set `state.img = roiResult.canvas` (and `state.roiInfo = roiResult.roiInfo`), and pass that **same** cropped/compensated clean RGB canvas to `router.analyzePlate()`. Then both display and inference share the exact same coordinate frame.

### Pitfall 4: Forgetting to sync `mvp_web/` to Android APK assets
- **What goes wrong:** `android/app/src/main/assets/mvp_web/` becomes out of sync with `mvp_web/`.
- **How to avoid:** Run `python scripts/sync_edge_assets.py` after all `mvp_web/` changes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| JS Test Runner | Node.js built-in `node:test` (`node --test`) |
| Python Verification | `python scripts/verify_js_parity.py` + `pytest` |
| Quick run command | `node --test tests/test_edge_parity.mjs tests/test_plate_roi.mjs` |
| Full suite command | `node --test tests/test_edge_parity.mjs tests/test_plate_roi.mjs && python -m py_compile src/data/preprocess.py src/evaluation/cross_validation.py streamlit_app.py` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P11-ROI | ROI detection, `> 85%` skip fallback, ellipse tilt `b/a` + `> 5°` warning, `8x8` tile CLAHE, `< 100 ms` latency | unit | `node --test tests/test_plate_roi.mjs` | ❌ Wave 0 (create) |
| P11-PARITY | `0.5 mm` Sobel threshold in JS & Python; `ROI -> CLAHE` order in `preprocess.py` & `streamlit_app.py` | unit | `node --test tests/test_edge_parity.mjs` + Python assertion | ✅ / ❌ Wave 0 |
| P11-PREC | High-res `6.0 mm` disk diameter refinement + `zoneMaskThreshold` (`0.38`) | unit | `node --test tests/test_edge_parity.mjs` | ✅ (extend) |
| P11-XAI | `neural_xai_map` (`104x104` Float32Array in `[0, 1]`) emitted by `decodeYoloSeg` | unit | `node --test tests/test_edge_parity.mjs` | ✅ (extend) |
| P11-DOC | `f3_s09cmelian_avance.md` updated with real measured results, no fabricated data | manual/grep | Verify sections & zero `1.2 mm` stale claims | ✅ |

## Security Domain

- **ASVS V5 (Input Validation):** All canvas dimensions and ROI crop bounds clamped strictly to `[0, width]` / `[0, height]` with `maxEdge <= 1024 px` to prevent OOM / DoS on TR6948.
- **No network/external dependencies:** 100% local execution; no new packages installed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly in `mvp_web/` and `src/`
- Architecture: HIGH — all integration points read verbatim from source files
- Pitfalls: HIGH — verified against `tests/test_edge_parity.mjs` and `TR6948` constraints

**Research date:** 2026-11-27
**Valid until:** 2026-12-27

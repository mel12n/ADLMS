---
phase: 11-pipeline-precision-upgrade-fase-3-report
plan: 01
subsystem: edge-inference
tags: [plate-roi, clahe, sobel-cv, yolo11n-seg, xai, pure-js]

requires:
  - phase: 10-tr6948-benchmark-variant-lock
    provides: Locked yolo11n_seg_416_fp32 ONNX runtime contract and Mediciones.csv precision diagnosis
provides:
  - Pure-JS SRP module mvp_web/inference/plate_roi.js (ROI detection, >85% skip fallback, elliptical tilt compensation, 8x8 tile CLAHE)
  - Updated mvp_web/inference/sobel_cv.js with DELTA_R_THRESHOLD_MM = 0.5 (1.0 mm diameter) and refineDiskDiameterPx()
  - Updated mvp_web/inference/yolo_seg_decode.js with zoneMaskThreshold = 0.38 default for inhibition_zone and 104x104 neural_xai_map Float32Array
  - Automated node:test unit suite tests/test_phase11_precision.mjs
affects: [11-03, edge_detector.js, app.js, index.html]

actuals:
  tokens: 11263
  tasks: 3
  commits: 4
  plan_head_before: c6a5eb1c796ad1c3b96f276a8759e54169746e60
  plan_head_after: 01d450e76a6dd6749835793396af57211c1b74de

tech-stack:
  added: []
  patterns:
    - "Zero-build UMD/IIFE SRP module (window.ADLMS_PLATE_ROI + module.exports)"
    - "Polar-sampled ellipse covariance eigenvalue decomposition (lambda1/lambda2 = a/b, lambda1+lambda2 = a*b)"
    - "Post-ROI 8x8 tile CLAHE with single Float32Array luminance buffer (<= 4 MB at 1024x1024)"
    - "Single-pass 104x104 FP32 prototype neural XAI aggregation inside decodeMaskRoi()"

key-files:
  created:
    - mvp_web/inference/plate_roi.js
    - tests/test_phase11_precision.mjs
  modified:
    - mvp_web/inference/sobel_cv.js
    - mvp_web/inference/yolo_seg_decode.js

key-decisions:
  - "Used exact polar-sampled ellipse eigenvalue relation (lambda1/lambda2 = a/b, lambda1+lambda2 = a*b) in plate_roi.js rather than sqrt(2*lambda) so b/a and tiltDeg = arccos(b/a) remain unbiased under uniform 5-degree radial sampling."
  - "Added geo_status ('OK' | 'REVISION') and crossValidateZone alias alongside validateZoneGeometry in sobel_cv.js to preserve 100% backward compatibility with edge_detector.js, test_edge_parity.mjs, and verify_js_parity.py."
  - "Accumulated neural_xai_map only for valid decoded disk (cls=0) and zone (cls=1) detections after areaInputPx > 0 check in decodeMaskRoi()."

patterns-established:
  - "ROI -> Clean RGB YOLO Inference -> Post-ROI CLAHE -> High-Res Disk Refinement & 0.5 mm Sobel CV"
  - "Class-conditional mask threshold: 0.38 for inhibition_zone (cls=1), 0.50 for antibiotic_disk (cls=0) and inner_colony (cls=2)"

requirements-completed:
  - P11-ROI
  - P11-PREC
  - P11-XAI

coverage:
  - id: D1
    description: "Pure-JS detectPlateRoi() isolates Petri dish in < 100 ms, skips when fillRatio > 0.85, detects elliptical tilt b/a and flags tiltWarning > 5 deg, and applies 8x8 tile CLAHE post-ROI."
    requirement: P11-ROI
    verification:
      - kind: unit
        ref: "tests/test_phase11_precision.mjs#P11-ROI"
        status: pass
    human_judgment: false
  - id: D2
    description: "sobel_cv.js enforces DELTA_R_THRESHOLD_MM = 0.5 (1.0 mm diameter) and exports refineDiskDiameterPx() for <= 1024 px 6.0 mm disk calibration."
    requirement: P11-PREC
    verification:
      - kind: unit
        ref: "tests/test_phase11_precision.mjs#P11-PREC"
        status: pass
    human_judgment: false
  - id: D3
    description: "yolo_seg_decode.js defaults zoneMaskThreshold = 0.38 for cls === 1 while keeping 0.50 for cls 0/2 and emits 104x104 Float32Array neural_xai_map without regressing test_edge_parity.mjs."
    requirement: P11-XAI
    verification:
      - kind: unit
        ref: "tests/test_phase11_precision.mjs#P11-PREC & P11-XAI"
        status: pass
      - kind: integration
        ref: "tests/test_edge_parity.mjs"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-27
status: complete
---

# Phase 11 Plan 01: Core Pure-JS Precision Modules Summary

**Pure-JS Petri dish ROI + elliptical tilt compensation + post-ROI 8x8 CLAHE (`plate_roi.js`), `0.5 mm` Sobel threshold + high-res `6.0 mm` disk refinement (`sobel_cv.js`), and `0.38` zone mask threshold + `104x104` `FP32` `neural_xai_map` (`yolo_seg_decode.js`) with 13/13 Node.js tests passing.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-27T12:23:25Z
- **Completed:** 2026-11-27T12:28:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `mvp_web/inference/plate_roi.js` (`window.ADLMS_PLATE_ROI` + `module.exports`) implementing `< 100 ms` radial rim detection (`<= 160 px` downscale, 72 rays, median + MAD outlier rejection, covariance ellipse fit), `> 85%` fill-ratio pass-through fallback, `arccos(b/a)` tilt warning (`> 5°`), `extractRoiCanvas()` affine aspect compensation (`<= 1024 px`), and `8x8` tile CLAHE (`applyTileClaheLuminance` + `applyTileClaheRgba`).
- Upgraded `mvp_web/inference/sobel_cv.js` to enforce `DELTA_R_THRESHOLD_MM = 0.5` (`1.0 mm` diameter per Hombach et al., 2014), return `geo_status` (`'OK'` | `'REVISION'`), export `crossValidateZone` alongside `validateZoneGeometry`, and add `refineDiskDiameterPx()` (36-ray `0.5 px` bilinear bright-to-dark drop detection clamped to `[0.70, 1.10] * approxDiamPx`).
- Upgraded `mvp_web/inference/yolo_seg_decode.js` with `DEFAULT_ZONE_MASK_THRESH = 0.38` (`opts.zoneMaskThreshold`) applied selectively to `cls === 1` (`inhibition_zone`) and single-pass `104x104` `Float32Array` `neural_xai_map` accumulation over `cls === 0` and `cls === 1` prototypes.
- Added `tests/test_phase11_precision.mjs` (6 tests) and verified all 13 tests across `tests/test_phase11_precision.mjs` and `tests/test_edge_parity.mjs` pass (`0` failures).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pure-JS SRP mvp_web/inference/plate_roi.js** - `76ae207` (`feat`)
2. **Task 2: Upgrade sobel_cv.js and yolo_seg_decode.js** - `e6c8be6` (`feat`)
3. **Task 3: Create tests/test_phase11_precision.mjs** - `01d450e` (`test`)

## Files Created/Modified
- `mvp_web/inference/plate_roi.js` - Zero-build UMD/IIFE module exporting `detectPlateRoi`, `extractRoiCanvas`, `applyTileClaheLuminance`, and `applyTileClaheRgba`
- `mvp_web/inference/sobel_cv.js` - Tightened `DELTA_R_THRESHOLD_MM = 0.5`, added `geo_status`, `crossValidateZone`, and `refineDiskDiameterPx()`
- `mvp_web/inference/yolo_seg_decode.js` - Added `DEFAULT_ZONE_MASK_THRESH = 0.38` (`opts.zoneMaskThreshold`) and `neural_xai_map` (`104x104` `Float32Array`)
- `tests/test_phase11_precision.mjs` - Unit test suite covering `P11-ROI`, `P11-PREC`, and `P11-XAI`

## Decisions Made
- **Exact polar-sampled covariance ellipse recovery:** Uniform angular ray sampling produces covariance eigenvalues with `lambda1/lambda2 = a/b` and `lambda1 + lambda2 = a*b`. Using `a = sqrt((l1+l2)*(l1/l2))` and `b = sqrt((l1+l2)*(l2/l1))` eliminates the `sqrt(b/a)` underestimation on tilted ellipses (measured `0.9019` vs true `0.9000` at `b/a = 0.90`).
- **Additive backward-compatible Sobel API:** Kept `validateZoneGeometry` as the canonical function while adding `geo_status` and exporting `crossValidateZone` and `DELTA_R_THRESHOLD_MM` so existing consumers (`edge_detector.js`, `test_edge_parity.mjs`, `verify_js_parity.py`) continue working without modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected covariance eigenvalue -> ellipse axis formula under uniform angular ray sampling**
- **Found during:** Task 1 (`mvp_web/inference/plate_roi.js`)
- **Issue:** Naive `sqrt(2 * lambda)` yielded `eb / ea = sqrt(b / a)` (`0.9487` instead of `0.9000`) for polar-sampled ellipse boundary points.
- **Fix:** Applied exact polar-sampling moment identity `a = sqrt((l1 + l2) * (l1 / l2))` and `b = sqrt((l1 + l2) * (l2 / l1))`.
- **Files modified:** `mvp_web/inference/plate_roi.js`
- **Verification:** Verified `axisRatio = 0.9019` (`tiltDeg = 25.59°`) on synthetic `150x135` tilted ellipse in `tests/test_phase11_precision.mjs`.
- **Committed in:** `76ae207`

---

**Total deviations:** 1 auto-fixed (1 math bug in ellipse axis estimation)
**Impact on plan:** Necessary for accurate `b/a` tilt estimation (`D-07`). No scope creep.

## Verification Results

Command: `node --test tests/test_phase11_precision.mjs tests/test_edge_parity.mjs`
- `tests`: 13
- `pass`: 13
- `fail`: 0
- `skipped`: 0
- `duration_ms`: 293.6736

## Issues Encountered
- Note: Concurrent Wave 1 Plan `11-02` committed `1b81f89` on `main` between Task 1 and Task 2, so `git rev-list --count c6a5eb1..HEAD` includes 3 commits from Plan `11-01` plus 1 commit from Plan `11-02` (`4` total in range).

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
- `mvp_web/inference/plate_roi.js`: FOUND
- `mvp_web/inference/sobel_cv.js`: FOUND
- `mvp_web/inference/yolo_seg_decode.js`: FOUND
- `tests/test_phase11_precision.mjs`: FOUND
- Commits `76ae207`, `e6c8be6`, `01d450e`: VERIFIED in `git log`

## Next Phase Readiness
- Wave 2 (`11-03-PLAN.md`) can now integrate `plate_roi.js`, `refineDiskDiameterPx()`, `DELTA_R_THRESHOLD_MM = 0.5`, and `neural_xai_map` into `mvp_web/inference/edge_detector.js`, `mvp_web/app.js`, and `mvp_web/index.html`.

---
*Phase: 11-pipeline-precision-upgrade-fase-3-report*
*Completed: 2026-11-27*

---
phase: 11-pipeline-precision-upgrade-fase-3-report
plan: 02
subsystem: preprocessing-and-cross-validation
tags: [opencv, clahe, roi, sobel, python-parity, streamlit, unittest]

requires:
  - phase: 10-tr6948-benchmark-variant-lock
    provides: Empirical diagnosis of halo underestimation and preprocessing parity requirements
provides:
  - ROI -> CLAHE preprocessing order with > 85% fill-ratio skip fallback in src/data/preprocess.py
  - ROI -> CLAHE preprocessing order in Track B Streamlit UI (streamlit_app.py)
  - GEOMETRIC_DELTA_THRESHOLD_MM = 0.5 (1.0 mm diameter clinical risk) in src/evaluation/cross_validation.py
  - Automated unit tests in tests/test_phase11_python_parity.py
affects: [phase-11-verification, track-b-streamlit, sobel-cross-validation]

actuals:
  tokens: 2698
  tasks: 2
  commits: 2
  plan_head_before: f1221dc925fa9cf55b71fdcbd84e5cba9f7dd004
  plan_head_after: c6a5eb1c796ad1c3b96f276a8759e54169746e60

tech-stack:
  added: []
  patterns:
    - "ROI -> CLAHE ordering across Track B Python (crop_plate_roi before apply_clahe / apply_plate_roi before apply_optical_clahe)"
    - "85% Petri dish fill-ratio skip fallback in crop_plate_roi() with coordinate clamping"
    - "0.5 mm radial Sobel discrepancy threshold (1.0 mm diameter per Hombach et al., 2014)"

key-files:
  created:
    - tests/test_phase11_python_parity.py
  modified:
    - src/data/preprocess.py
    - streamlit_app.py
    - src/evaluation/cross_validation.py

key-decisions:
  - "Enforce crop_plate_roi() strictly before apply_clahe() and skip cropping when (2 * r) / min(h, w) > 0.85 (D-01, D-03)."
  - "Clamp ROI bounding box coordinates to [0, w] / [0, h] and guard min(h, w) > 0 against malformed/empty inputs (T-11-03)."
  - "Tighten GEOMETRIC_DELTA_THRESHOLD_MM from 1.2 to 0.5 mm radius (1.0 mm diameter) in src/evaluation/cross_validation.py (D-05)."

patterns-established:
  - "Track B Python preprocessing parity with Track A pure-JS ROI -> CLAHE ordering"

requirements-completed:
  - P11-PARITY

coverage:
  - id: D1
    description: "src/data/preprocess.py executes crop_plate_roi() strictly before apply_clahe() and skips cropping when Petri dish fill ratio > 85%."
    requirement: "P11-PARITY"
    verification:
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_preprocess_pipeline_executes_roi_before_clahe"
        status: pass
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_crop_plate_roi_skips_when_fill_ratio_exceeds_85_percent"
        status: pass
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_crop_plate_roi_crops_smaller_plate"
        status: pass
    human_judgment: false
  - id: D2
    description: "streamlit_app.py executes apply_plate_roi() strictly before apply_optical_clahe()."
    requirement: "P11-PARITY"
    verification:
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_streamlit_app_executes_roi_before_clahe"
        status: pass
    human_judgment: false
  - id: D3
    description: "src/evaluation/cross_validation.py sets GEOMETRIC_DELTA_THRESHOLD_MM = 0.5 (1.0 mm diameter per Hombach et al., 2014)."
    requirement: "P11-PARITY"
    verification:
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_sobel_threshold_is_0_5_mm"
        status: pass
      - kind: unit
        ref: "tests/test_phase11_python_parity.py#test_sobel_alerts_above_0_5_mm"
        status: pass
      - kind: e2e
        ref: "tests/test_end_to_end_pipeline.py#test_end_to_end_yolo_sobel_and_http_api"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-11-27
status: complete
---

# Phase 11 Plan 02: Track B Python Parity (`ROI -> CLAHE`, `> 85%` Skip Fallback, `0.5 mm` Sobel) Summary

**Fixed inverted `CLAHE -> ROI` order to `ROI -> CLAHE` in `src/data/preprocess.py` and `streamlit_app.py`, added the `> 85%` fill-ratio skip fallback with coordinate clamping, and tightened `GEOMETRIC_DELTA_THRESHOLD_MM` to `0.5 mm` (`1.0 mm` diameter) in `src/evaluation/cross_validation.py`.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-27T12:23:32Z
- **Completed:** 2026-11-27T12:25:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Reordered `preprocess_plate_image()` in `src/data/preprocess.py` so `crop_plate_roi(img)` runs strictly before `apply_clahe(roi)`, added the `(2 * r) / min(h, w) > 0.85` skip fallback in `crop_plate_roi()`, and clamped bounding coordinates to `[0, w]` / `[0, h]` with empty-image guards (`T-11-03`).
- Reordered the image preprocessing block in `streamlit_app.py` so `apply_plate_roi(proc_img)` executes strictly before `apply_optical_clahe(proc_img)`.
- Tightened `GEOMETRIC_DELTA_THRESHOLD_MM` from `1.2` to `0.5` (`1.0 mm` diameter clinical risk per Hombach et al., 2014) in `src/evaluation/cross_validation.py` and updated its docstring.
- Added `tests/test_phase11_python_parity.py` (6 unit tests) and verified both `tests.test_phase11_python_parity` (6/6 OK) and `tests/test_end_to_end_pipeline.py` (3/3 PASS).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ROI -> CLAHE ordering in src/data/preprocess.py and streamlit_app.py, and tighten cross_validation.py to 0.5 mm** - `0105ebd` (fix)
2. **Task 2: Create Python parity unit tests tests/test_phase11_python_parity.py** - `c6a5eb1` (test)

## Files Created/Modified
- `src/data/preprocess.py` - Enforces `crop_plate_roi()` -> `apply_clahe()` order, `> 85%` fill-ratio skip fallback, `min(h, w) > 0` guard, and `[0, w]` / `[0, h]` clamping.
- `streamlit_app.py` - Swaps `apply_plate_roi()` before `apply_optical_clahe()` in the Streamlit preprocessing pipeline.
- `src/evaluation/cross_validation.py` - Sets `GEOMETRIC_DELTA_THRESHOLD_MM = 0.5` and updates `validate_zone_geometry()` docstring to `<= 0.5 mm` (`1.0 mm` diameter).
- `tests/test_phase11_python_parity.py` - 6 `unittest` cases covering the `0.5 mm` Sobel threshold, `delta_r > 0.5 mm` geometric alert, `> 85%` skip fallback (`r=185` on `400x400`), `<= 85%` crop (`r=135` on `400x400`), `ROI -> CLAHE` call order in `preprocess.py`, and `ROI -> CLAHE` source order in `streamlit_app.py`.

## Decisions Made
- None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written. (Security mitigation `T-11-03` from `<threat_model>` was applied directly in `crop_plate_roi()` by guarding `min(h, w) > 0` and clamping crop coordinates to `[0, w]` / `[0, h]`.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Track B Python parity (`P11-PARITY`) is complete and verified against both unit tests (`tests/test_phase11_python_parity.py`) and end-to-end YOLO + Sobel + EUCAST HTTP verification (`tests/test_end_to_end_pipeline.py`).

## Self-Check: PASSED
- Files verified on disk: `src/data/preprocess.py`, `streamlit_app.py`, `src/evaluation/cross_validation.py`, `tests/test_phase11_python_parity.py`.
- Commits verified in git history: `0105ebd`, `c6a5eb1`.
- Verification runs: `.\venv\Scripts\python.exe -m py_compile ...` (exit 0), `.\venv\Scripts\python.exe -m unittest tests.test_phase11_python_parity -v` (Ran 6 tests in 0.274s - OK), `.\venv\Scripts\python.exe -m unittest tests.test_phase11_python_parity tests.test_end_to_end_pipeline -v` (Ran 6 tests in 0.166s - OK), `.\venv\Scripts\python.exe tests/test_end_to_end_pipeline.py` (3/3 PASS).

---
*Phase: 11-pipeline-precision-upgrade-fase-3-report*
*Completed: 2026-11-27*

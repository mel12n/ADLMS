---
phase: 09-tablet-ux-manual-drug-formulary
plan: 03
subsystem: android-apk-sync-and-tr6948-uat
tags: [android-apk, edge-sync, tr6948, uat, offline, tablet-ux, formulary]
requires:
  - phase: 09-tablet-ux-manual-drug-formulary
    plan: 02
    provides: SRP 65-drug formulary picker, UNK auto-advance, and 4 clinical panel presets
provides:
  - Synced Android assets in android/app/src/main/assets/mvp_web/ (33 files, 33.95 MB)
  - Rebuilt offline android/app/build/outputs/apk/debug/app-debug.apk (39.18 MB) with ZIP_STORED .onnx/.wasm
  - Physical TR6948 Airplane Mode UAT sign-off across UI-01, UI-02, UI-03, and UI-04
affects: [10-benchmarking-field-validation]
tech-stack:
  added: []
  patterns: [Asset mirror sync prior to Gradle assembleDebug, floating viewport-bottom action bar in APK scroll view]
key-files:
  created: []
  modified:
    - mvp_web/style.css
decisions:
  - Floated the Placa/Resultados/Capturar action bar at the viewport bottom in APK scroll view (commit f7b491b) following TR6948 UAT feedback for thumb-reachable navigation across 1024x600 and 600x1024 orientations.
metrics:
  duration: ~20m
  completed: 2026-11-24
status: complete
actuals:
  tasks: 2
  commits: 1
  plan_head_before: c2ea77e
  plan_head_after: f7b491bffef1d8602744ad92de4189eeb70ad24a
---

# Phase 9 Plan 03: Android Asset Sync, APK Rebuild & TR6948 UAT Summary

Synced all Phase 9 `mvp_web/` assets (`image_scaler.js`, `formulary_ui.js`, updated `index.html`, `style.css`, `app.js`) into the Android project, rebuilt `android/app/build/outputs/apk/debug/app-debug.apk` with uncompressed `.onnx`/`.wasm` entries, and completed on-device Airplane Mode UAT on the physical TR6948 tablet (`UI-01..04`).

## Tasks & Commits

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Run full Node test suite, sync edge assets, and rebuild `app-debug.apk` | (generated mirror/APK) | `android/app/src/main/assets/mvp_web/*` (33 files, 33.95 MB), `android/app/build/outputs/apk/debug/app-debug.apk` (39.18 MB) |
| 2 | On-device TR6948 UAT in Airplane Mode (`1024x600` & `600x1024`) + UAT polish | `f7b491b` | `mvp_web/style.css` (floating Placa/Resultados/Capturar bottom bar) |

## Verification Results

- `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs`: **22/22 passed** (0 failures).
- `.\venv\Scripts\python.exe scripts/sync_edge_assets.py`: synced **33 files (33.95 MB)** into `android/app/src/main/assets/mvp_web/`.
- `.\android\gradlew.bat -p android assembleDebug`: **BUILD SUCCESSFUL in 15s** (JDK 17).
- APK ZIP integrity verified (`android/app/build/outputs/apk/debug/app-debug.apk`, **39.18 MB**):
  - `assets/mvp_web/image_scaler.js` (2901 B) & `assets/mvp_web/formulary_ui.js` (9929 B) present.
  - `yolo11n_seg_416_fp32.onnx` (11.05 MB), `ort-wasm-simd.wasm` (10.10 MB), and `ort-wasm.wasm` (9.31 MB) stored uncompressed (`ZIP_STORED`).
- **TR6948 UAT (Airplane Mode):** User confirmed `UI-01`, `UI-02`, `UI-03`, and `UI-04` pass on-device, including the floating Placa/Resultados/Capturar bottom bar (`f7b491b`).

## Deviations from Plan

### UAT Polish

**1. [UAT Feedback] Float Placa/Resultados/Capturar bar at viewport bottom in APK scroll view**
- **Found during:** Task 2 (TR6948 on-device UAT)
- **Fix:** Anchored the Placa/Resultados/Capturar navigation bar at the bottom of the viewport in APK scroll view for ergonomic thumb access.
- **Files modified:** `mvp_web/style.css`
- **Commit:** `f7b491b`

## Self-Check: PASSED

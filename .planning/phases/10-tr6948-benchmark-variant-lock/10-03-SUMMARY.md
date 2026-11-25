---
phase: 10-tr6948-benchmark-variant-lock
plan: 03
subsystem: edge-wasm-benchmark-and-variant-lock
tags: [tr6948, onnxruntime-web, benchmark, variant-lock, slim-apk, bench-02]
requires:
  - phase: 10-tr6948-benchmark-variant-lock
    provides: SRP telemetry_ui.js, runBenchmarkSuite, profile_tr6948.py, locked_variant sync
provides:
  - Empirical 8-cell TR6948 benchmark report in exports/tr6948_benchmark_report.{json,md}
  - Symmetrically locked yolo11n_seg_416_fp32 in exports/model_meta.json and mvp_web/models/model_meta.json
  - Slim single-model app-debug.apk (33.96 MB, 1 ZIP_STORED .onnx) installed on TR6948 (R01236I38026001913)
affects: [exports/model_meta.json, mvp_web/models/model_meta.json, android/app/build/outputs/apk/debug/app-debug.apk]
tech-stack:
  added: []
  patterns:
    - "Symmetrical locked_variant in exports/model_meta.json and mvp_web/models/model_meta.json"
    - "Single-model slim APK bundling via scripts/sync_edge_assets.py (without --all-models)"
key-files:
  created:
    - exports/tr6948_benchmark_report.json
    - exports/tr6948_benchmark_report.md
  modified:
    - mvp_web/app.js
    - scripts/profile_tr6948.py
    - exports/model_meta.json
    - mvp_web/models/model_meta.json
key-decisions:
  - "Locked yolo11n_seg_416_fp32 as the sole shipping ONNX variant (MAE 0.4678 mm <= 0.50 mm clinical gate, 0 lmkd kills, 0 crashes)"
patterns-established:
  - "Slim APK ZIP audit: exactly 1 .onnx entry and all .onnx/.wasm entries stored with compress_type == 0 (ZIP_STORED)"
requirements-completed: [BENCH-02]
status: complete
completed: 2026-11-25
---

# Phase 10 Plan 03: TR6948 Benchmark & Variant Lock Summary

**Locked `yolo11n_seg_416_fp32` symmetrically in both `model_meta.json` files and shipped the slim single-model `app-debug.apk` (`33.96 MB`, `ZIP_STORED` `.onnx`/`.wasm`) on TR6948 (`R01236I38026001913`).**

## Performance

- **Node test suite:** 32/32 passed (`tests/test_edge_parity.mjs`, `tests/test_phase9_tablet_formulary.mjs`, `tests/test_phase10_benchmark.mjs`)
- **Python unit suite:** 12/12 passed (`tests.test_phase6_onnx`, `tests.test_phase10_profiler`)
- **Slim APK ZIP audit:** `SLIM APK OK: assets/mvp_web/models/yolo11n_seg_416_fp32.onnx` (1 `.onnx` entry, all `.onnx`/`.wasm` entries `compress_type == 0`)

## Accomplishments

- Staged all 4 ONNX variants (`--all-models`), built and installed the benchmark APK on TR6948 (`R01236I38026001913`) in Airplane Mode, and generated `exports/tr6948_benchmark_report.{json,md}`.
- Locked `yolo11n_seg_416_fp32` (`MAE = 0.4678 mm <= 0.50 mm`, `0` `lmkd` kills, `0` crashes) symmetrically in `exports/model_meta.json` and `mvp_web/models/model_meta.json`.
- Re-ran `scripts/sync_edge_assets.py` without `--all-models`, rebuilt slim `app-debug.apk`, installed on TR6948 (`versionName=1.6.0`), and launched `cl.unab.adlms.deephalo/.MainActivity`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `runBenchmarkSuite` canvas/return-value handling in `mvp_web/app.js`**
- **Found during:** Task 1
- **Issue:** `downscaleImageToCanvas` returns `{ canvas, ... }` rather than a raw `HTMLCanvasElement`, `state.img` was unset, and `analyzePlate` returns `edgeData` directly rather than `{ data, mode }`.
- **Fix:** Extracted `scaled.canvas`, assigned `state.img = workingImg`, and read `data.runtime_mode` directly.
- **Files modified:** `mvp_web/app.js`
- **Commit:** `ef11b13`

**2. [Rule 1 - Bug] Fixed `profile_tr6948.py` `dumpsys meminfo` timeout, duplicate `logcat` lines, and camelCase timing keys**
- **Found during:** Task 1
- **Issue:** `dumpsys meminfo` could time out under heavy load, `ADLMS_BENCH` was logged by both `chromium` and `AndroidBridge`, and `telemetry_ui.js` emits `totalMs`/`ortInferenceMs`.
- **Fix:** Wrapped `dumpsys meminfo` in `try...except subprocess.TimeoutExpired`, deduplicated records by `run` index, and accepted both snake_case and camelCase keys.
- **Files modified:** `scripts/profile_tr6948.py`
- **Commit:** `ef11b13`

## Self-Check: PASSED

- `exports/tr6948_benchmark_report.json` — FOUND
- `exports/tr6948_benchmark_report.md` — FOUND
- `exports/model_meta.json` (`locked_variant == "yolo11n_seg_416_fp32"`) — FOUND
- `mvp_web/models/model_meta.json` (`locked_variant == "yolo11n_seg_416_fp32"`) — FOUND
- `android/app/build/outputs/apk/debug/app-debug.apk` (1 `.onnx`, `ZIP_STORED`) — FOUND
- Commit `ef11b13` — FOUND

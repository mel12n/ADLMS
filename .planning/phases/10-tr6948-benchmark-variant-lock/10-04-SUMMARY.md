---
phase: 10-tr6948-benchmark-variant-lock
plan: 04
subsystem: android-benchmark
tags: [tr6948, onnx, benchmark, variant-lock, apk]
dependency-graph:
  requires: [10-03]
  provides: [empirical-tr6948-benchmark, slim-locked-apk]
  affects: [exports/tr6948_benchmark_report.json, exports/tr6948_benchmark_report.md, android/app/build/outputs/apk/debug/app-debug.apk]
tech-stack:
  added: []
  patterns: [4-model-benchmark-apk, slim-single-model-apk]
key-files:
  created:
    - .planning/phases/10-tr6948-benchmark-variant-lock/10-04-SUMMARY.md
  modified:
    - exports/tr6948_benchmark_report.json
    - exports/tr6948_benchmark_report.md
decisions:
  - "Locked shipping variant: yolo11n_seg_416_fp32 (simd=0, MAE=0.4678 mm, warm_mean_ms=6693.0 ms, warm_ort_ms=6010.33 ms, 0 lmkd kills, 0 crashes)."
  - "Documented TR6948 32-bit armeabi-v7a hardware delta: 6010.33 ms warm ORT inference vs ADR-001 64-bit <= 2000 ms TRT target."
status: complete
metrics:
  completed_date: "2026-11-25"
---

# Phase 10 Plan 04: TR6948 Live Benchmark & Slim APK Lock Summary

Executed the live 10-plate Airplane Mode benchmark matrix on physical TR6948 (`R01236I38026001913`), locked `yolo11n_seg_416_fp32` (`simd=0`, MAE `0.4678 mm`), and rebuilt/installed the slim single-model `app-debug.apk`.

## Tasks Completed

1. **Task 1 — 4-Model Benchmark APK Build & Install:** Staged all 4 ONNX models (`320_fp32`, `320_int8`, `416_fp32`, `416_int8`) via `python scripts/sync_edge_assets.py --all-models`, built `app-debug.apk`, and installed onto `R01236I38026001913`.
2. **Task 2 — 10-Plate Airplane Mode Benchmark Matrix:** Confirmed TR6948 in Airplane Mode with screen unlocked, ran `python scripts/profile_tr6948.py --serial R01236I38026001913 --runs 10 --apply-lock`. All 8 matrix cells completed 10/10 runs with 0 `lmkd` kills and 0 crashes. Locked variant: `yolo11n_seg_416_fp32` (`simd=0`, `MAE=0.4678 mm`, `Cold 1st=13253.0 ms`, `Warm Mean=6693.0 ms`, `Warm ORT=6010.33 ms`, `Warm P95=6881.0 ms`).
   - *Note:* `Peak PSS (MB)` and `Peak RSS (MB)` reported `None` across all 8 cells in `tr6948_benchmark_report.{json,md}` (Android 8.1 `dumpsys meminfo` polling returned empty/zero).
3. **Task 3 — Slim Single-Model Asset Sync, APK Rebuild/Install & Unit Tests:** Re-synced slim assets (`python scripts/sync_edge_assets.py` -> `yolo11n_seg_416_fp32.onnx` only, 34 files, 33.96 MB), rebuilt `app-debug.apk`, installed onto `R01236I38026001913`, and verified `node --test tests/test_phase10_benchmark.mjs` (10/10 passed) and `pytest tests/test_phase10_profiler.py -v` (10 passed, 7 subtests passed).

## Commits

- `bfcb511`: `chore(10-04): record live TR6948 10-plate benchmark matrix and lock variant`

## Self-Check: PASSED

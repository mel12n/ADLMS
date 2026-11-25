---
phase: 10-tr6948-benchmark-variant-lock
plan: 02
subsystem: edge-profiling-and-asset-sync
tags: [adb, profiler, tr6948, lmkd, meminfo, onnx, sync]
requires:
  - exports/model_meta.json
  - exports/onnx_parity_report.json
provides:
  - scripts/profile_tr6948.py
  - scripts/sync_edge_assets.py
  - tests/test_phase10_profiler.py
affects:
  - android/app/src/main/assets/mvp_web/
  - exports/tr6948_benchmark_report.json
  - exports/tr6948_benchmark_report.md
tech-stack:
  added: []
  patterns:
    - "subprocess.run/Popen with shell=False and strict regex serial validation (T-10-04)"
    - "Clinical MAE <= 0.50 mm + zero-lmkd/zero-crash variant lock gating"
    - "Dynamic locked_variant resolution in sync_edge_assets.py (T-10-05)"
key-files:
  created:
    - scripts/profile_tr6948.py
    - tests/test_phase10_profiler.py
  modified:
    - scripts/sync_edge_assets.py
decisions:
  - "Enforced MAE <= 0.50 mm (SHIPPABLE) and zero lmkd/render crashes before any latency ranking in select_locked_variant."
  - "Resolved locked_variant dynamically in sync_edge_assets.py with ValueError on unknown IDs and DEFAULT_MODEL fallback when absent."
metrics:
  duration: 2m
  completed: "2026-11-25"
status: complete
actuals:
  tasks: 2
  commits: 2
---

# Phase 10 Plan 02: TR6948 ADB Profiler & Locked-Variant Asset Sync Summary

Implemented the host-side TR6948 `adb` memory/`lmkd` profiler and 8-cell benchmark orchestrator (`scripts/profile_tr6948.py`), updated `scripts/sync_edge_assets.py` to resolve `locked_variant` dynamically from `model_meta.json`, and added Wave 0 unit tests (`tests/test_phase10_profiler.py`).

## Tasks Completed

1. **Task 1 (`db62891`)**: Created `tests/test_phase10_profiler.py` (Wave 0 TDD) and `scripts/profile_tr6948.py` with `resolve_adb_binary`, `validate_serial`, `parse_meminfo_kb`, `parse_sandboxed_pids`, `parse_logcat_line`, `summarize_cell_runs` (cold Plate 1 vs warm Plates 2..N), `select_locked_variant` (MAE <= 0.50 mm + zero `lmkd`/crash gating + 32-bit vs 64-bit hardware delta note), `write_reports`, `--dry-run`, and `--apply-lock`.
2. **Task 2 (`faeb015`)**: Added `resolve_locked_model_filename` to `scripts/sync_edge_assets.py`, updated `collect_sync_plan` to bundle only the resolved locked `.onnx` model in default mode (and all 4 `.onnx` models under `--all-models`), and extended `tests/test_phase10_profiler.py`.

## Verification

- `.\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx tests.test_phase10_profiler -v`: **12/12 passed**
- `.\venv\Scripts\python.exe scripts/profile_tr6948.py --dry-run`: **8/8 matrix cells listed cleanly**
- `.\venv\Scripts\python.exe scripts/sync_edge_assets.py --dry-run`: **34 files (33.96 MB), single locked ONNX (`yolo11n_seg_416_fp32.onnx`)**

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

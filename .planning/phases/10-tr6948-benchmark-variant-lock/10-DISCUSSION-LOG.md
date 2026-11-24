# Phase 10: TR6948 Benchmark & Variant Lock - Discussion Log

**Date:** 2026-11-24
**Phase:** `10-tr6948-benchmark-variant-lock`
**Requirements:** `BENCH-01`, `BENCH-02`

## Gray Areas Presented

1. **In-App Stage Telemetry UI (`BENCH-01`):** SRP `mvp_web/telemetry_ui.js` (`<= 120 lines`) rendering per-stage timing (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`) and emitting `[ADLMS_BENCH]` structured logs.
2. **ADB Memory / `lmkd` Profiler & Report Format (`BENCH-01`, `BENCH-02`):** `scripts/profile_tr6948.py` polling `dumpsys meminfo` + `logcat` alongside `?bench=10` 10-plate runner mode to produce `exports/tr6948_benchmark_report.{json,md}`.
3. **Variant Lock Policy & Final Slim APK (`BENCH-02`):** Sync `--all-models` for matrix benchmarking across `320/416 × FP32/INT8 × SIMD/scalar`, lock the variant in `model_meta.json`, and rebuild the final slim single-model APK.

## User Selection

- Selected **Accept sensible defaults for all 3 areas and write `10-CONTEXT.md` now** (checked all 3 areas).
- Decisions locked in `10-CONTEXT.md`. Ready for `/gsd-plan-phase 10`.

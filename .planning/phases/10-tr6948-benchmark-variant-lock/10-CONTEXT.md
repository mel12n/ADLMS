# Phase 10: TR6948 Benchmark & Variant Lock - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument `mvp_web/` with per-stage inference latency telemetry (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`), add `adb` WebView renderer RSS/PSS and `lmkd` profiling (`BENCH-01`), execute the 10-plate Airplane Mode benchmark matrix on **TR6948** across `320/416 × FP32/INT8 × SIMD/scalar`, lock the optimal shipping model variant meeting `<= 2.0 s` inference (documenting any TR6948 32-bit delta vs ADR-001 64-bit baseline), `MAE <= 0.50 mm`, and zero `lmkd` kills, update `model_meta.json`, and rebuild/install the final slim single-model APK (`BENCH-02`).

</domain>

<decisions>
## Implementation Decisions

### In-App Stage Telemetry UI (`BENCH-01`)
- **SRP module boundary (`PROJECT.md` §6):** Implement stage timing display and structured log emission in a dedicated module `mvp_web/telemetry_ui.js` (`<= 120 lines`) rather than bloating `mvp_web/app.js`.
- **Per-stage metrics:** After every edge-wasm analysis, display `preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`, active model ID, and SIMD/scalar flag cleanly in-app (both in `#meta-engine` / top bar telemetry chip and debug console via `[ADLMS_BENCH] {...}` JSON lines so `adb logcat` captures them reliably).

### ADB Memory / `lmkd` Profiler & Benchmark Matrix (`BENCH-01`, `BENCH-02`)
- **Host profiler (`scripts/profile_tr6948.py`):** Python CLI that polls `adb -s R01236I38026001913 shell dumpsys meminfo cl.unab.adlms.deephalo` (extracting WebView sandboxed renderer PSS/RSS peaks and total app PSS/RSS) while tailing `adb logcat` for `lowmemorykiller` / `lmkd` / `onRenderProcessGone` crash events and `[ADLMS_BENCH]` latency payloads, writing `exports/tr6948_benchmark_report.json` and `exports/tr6948_benchmark_report.md`.
- **Deterministic 10-plate Airplane Mode runner:** Add a lightweight benchmark query mode (`?bench=10&model=<variant>&simd=<0|1>`, or one-tap Bench trigger) inside `mvp_web/` that runs 10 consecutive bundled plates automatically without manual uploads, allowing `scripts/profile_tr6948.py` to launch each `320/416 × FP32/INT8 × SIMD/scalar` combination reproducibly via `adb shell am start -d https://appassets.androidplatform.net/assets/index.html?...` (or Deep Link / intent extra handled in `MainActivity.kt` if needed).

### Variant Lock Policy & Final Slim APK (`BENCH-02`)
- **Benchmark build:** Temporarily sync all 4 ONNX variants using `scripts/sync_edge_assets.py --all-models` for the TR6948 matrix run.
- **Lock criteria & hardware note:** Lock the fastest variant meeting `MAE <= 0.50 mm` (from `exports/onnx_parity_report.json`) and zero `lmkd` kills (targeting `<= 2.0 s` inference; if TR6948's 32-bit `968 MB` CPU exceeds `2.0 s` on `416 FP32`, lock the fastest clinical-compliant variant and explicitly record the TR6948 32-bit vs ADR-001 64-bit hardware delta in the report).
- **Shipping artifact:** Record `locked_variant` in `exports/model_meta.json` and `mvp_web/models/model_meta.json` (so `edge_detector.js` defaults to it automatically), re-run `scripts/sync_edge_assets.py` (single-model slim bundle), rebuild `app-debug.apk`, and install on TR6948.

### Claude's Discretion
- Exact `adb` Activity launch mechanism (intent URL override in `MainActivity.kt` vs JS `localStorage`/button trigger) for iterating the 8 matrix combinations cleanly on Android 10 WebView.
- Exact visual formatting of the compact telemetry bar inside `#meta-engine` / `.screen-top`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/PROJECT.md` — TR6948 specs (`968 MB` RAM, 32-bit `armeabi-v7a`, Android 10), Section 5 evaluation criteria (`MAE <= 0.50 mm`, `TRT <= 2.0 s`), **Section 6 SRP Standards** (`telemetry_ui.js <= 120 lines`)
- `.planning/REQUIREMENTS.md` — `BENCH-01`, `BENCH-02`
- `.planning/ROADMAP.md` — Phase 10 goal and 4 success criteria
- `exports/onnx_parity_report.json`, `exports/model_meta.json` — Phase 6 MAE metrics per ONNX variant
- `mvp_web/inference/edge_detector.js` — Existing `stageTimings` measurement & `?model=` / `?simd=` overrides
- `scripts/sync_edge_assets.py` — `--all-models` benchmark sync vs default locked single-model sync

</canonical_refs>

<deferred>
## Deferred Ideas

None — Phase 10 completes Milestone v1.6.

</deferred>

---

*Phase: 10-tr6948-benchmark-variant-lock*
*Context gathered: 2026-11-24*

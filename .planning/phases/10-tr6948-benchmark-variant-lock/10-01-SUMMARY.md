---
phase: 10-tr6948-benchmark-variant-lock
plan: 01
subsystem: telemetry-and-android-bench
tags: [wasm, telemetry, android, webview, benchmark]
requires: []
provides:
  - "mvp_web/telemetry_ui.js (<= 120 lines, textContent-only, [ADLMS_BENCH] JSON logger)"
  - "mvp_web/app.js deterministic ?bench=N runner (runBenchmarkSuite)"
  - "mvp_web/inference/edge_detector.js meta.locked_variant support"
  - "MainActivity.kt allow-listed bench_query forwarding and [ADLMS_BENCH] logcat bridge"
  - "EdgeAssetClient.kt RENDER_PROCESS_GONE logcat marker"
affects:
  - mvp_web/telemetry_ui.js
  - mvp_web/index.html
  - mvp_web/style.css
  - mvp_web/app.js
  - mvp_web/inference/edge_detector.js
  - android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt
  - android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt
  - tests/test_phase10_benchmark.mjs
key-files:
  created:
    - mvp_web/telemetry_ui.js
    - tests/test_phase10_benchmark.mjs
  modified:
    - mvp_web/index.html
    - mvp_web/style.css
    - mvp_web/app.js
    - mvp_web/inference/edge_detector.js
    - android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt
    - android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt
decisions:
  - "Kept mvp_web/telemetry_ui.js at 84 lines (<= 120 SRP guardrail) using textContent only."
  - "Delegated #meta-engine formatting and [ADLMS_BENCH] JSON emission from app.js to ADLMS_TELEMETRY_UI."
  - "Honored meta.locked_variant in edge_detector.resolveModelVariant before DEFAULT_MODEL_ID while preserving ?model= overrides."
status: complete
metrics:
  tasks: 3
  completed_date: 2026-11-25
---

# Phase 10 Plan 01: Telemetry UI, ?bench=10 Runner, locked_variant & Android Bench Bridge Summary

Implemented in-app 4-stage inference latency telemetry (`mvp_web/telemetry_ui.js`, 84 lines), the deterministic `?bench=10` auto-runner (`mvp_web/app.js`), `locked_variant` runtime selection (`mvp_web/inference/edge_detector.js`), and the allow-listed Android WebView benchmark intent / `[ADLMS_BENCH]` logcat bridge (`MainActivity.kt`, `EdgeAssetClient.kt`).

## Verification Results

- **Node tests (`node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs`):** 32/32 passed (0 failed).
- **Android Kotlin compilation (`gradlew.bat -p android compileDebugKotlin`):** Blocked on this host because `JAVA_HOME` (`C:\Users\cmelian\AppData\Local\Android\jdk-17`) and `java` on `PATH` are not present.

## Commits

- `db628918` — Task 1 files (`mvp_web/telemetry_ui.js`, `mvp_web/index.html`, `mvp_web/style.css`, `mvp_web/app.js`, `tests/test_phase10_benchmark.mjs`)
- `84ce7b4` — `feat(10-01): honor meta.locked_variant in edge_detector.resolveModelVariant`
- `abd63a5` — `feat(10-01): add safe bench_query forwarding and [ADLMS_BENCH] logcat bridge`

## Deviations from Plan

None — plan executed as written, except `compileDebugKotlin` could not run due to missing JDK 17 on this host.

## Self-Check: PASSED

---
phase: "10"
slug: "tr6948-benchmark-variant-lock"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-24"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (`Node v26.13.1`) + Python `unittest` (`Python 3.14.2` in `venv`) |
| **Config file** | none (zero-config built-in runners) |
| **Quick run command** | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs` |
| **Full suite command** | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs && .\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx tests.test_phase10_profiler -v` |
| **Estimated runtime** | ~3 seconds (host unit tests) |

---

## Sampling Rate

- **After every task commit:** Run quick Node / Python unit tests (`< 3 s`)
- **After every plan wave:** Run full suite (`node:test` + `unittest`) + `sync_edge_assets.py --dry-run`
- **Before `/gsd-verify-work`:** Full suite must be green + physical TR6948 8-cell benchmark report generated + slim `app-debug.apk` built, ZIP-audited (`compress_type == 0`), and installed on `R01236I38026001913`
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | BENCH-01, BENCH-02 | T-10-01 | `telemetry_ui.js` (`<= 120` lines) uses `textContent` only (no `innerHTML`), normalizes stage metrics + `[ADLMS_BENCH]` JSON, and `app.js` wires `?bench=10` | unit + static | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | BENCH-02 | T-10-03 | `edge_detector.resolveModelVariant` honors `meta.locked_variant` while preserving `?model=` overrides and blocking path traversal | unit | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | BENCH-01, BENCH-02 | T-10-02 | `MainActivity.kt` restricts `bench_query` / intent URI to `EdgeAssetClient.ENTRY_URL` + `[a-zA-Z0-9_=&]+`, forwards `[ADLMS_BENCH]` logs; `EdgeAssetClient.kt` logs `RENDER_PROCESS_GONE` | compile | `.\android\gradlew.bat -p android compileDebugKotlin` | ✅ (`MainActivity.kt`) | ⬜ pending |
| 10-02-01 | 02 | 1 | BENCH-01, BENCH-02 | T-10-04 | `scripts/profile_tr6948.py` uses `shell=False` lists, parses `dumpsys meminfo` + `sandboxed_process` + `logcat` `lmkd`/`[ADLMS_BENCH]`, and gates lock on `MAE <= 0.50 mm` | unit | `.\venv\Scripts\python.exe -m unittest tests.test_phase10_profiler -v` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | BENCH-02 | T-10-05 | `scripts/sync_edge_assets.py` resolves `locked_variant` from `model_meta.json` dynamically vs `--all-models` | unit | `.\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx tests.test_phase10_profiler -v` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | BENCH-02 | — | All 4 models synced via `--all-models`, 8-cell × 10-plate Airplane Mode matrix executed on `TR6948` (`exports/tr6948_benchmark_report.{json,md}`) | on-device | `.\venv\Scripts\python.exe scripts/profile_tr6948.py --serial R01236I38026001913 --runs 10` | ✅ (wave 2) | ⬜ pending |
| 10-03-02 | 03 | 2 | BENCH-02 | T-10-06 | `locked_variant` recorded in `model_meta.json`, slim single-model `app-debug.apk` built (`ZIP_STORED` `.onnx`/`.wasm`) & installed on TR6948 | on-device + static | `.\venv\Scripts\python.exe scripts/sync_edge_assets.py` | ✅ (wave 2) | ⬜ pending |
| 10-03-03 | 03 | 2 | BENCH-01, BENCH-02 | — | Physical TR6948 spot-check of 4-stage latency readout in `#meta-engine` on `1024x600` screen in Airplane Mode | checkpoint | `adb -s R01236I38026001913 shell dumpsys package cl.unab.adlms.deephalo` | ✅ (wave 2) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_phase10_benchmark.mjs` — unit & static tests for `mvp_web/telemetry_ui.js` (`<= 120` lines, zero `innerHTML`, 4-stage formatting, `[ADLMS_BENCH]` output), `?bench=10` helpers, and `edge_detector.js` `locked_variant` resolution
- [ ] `tests/test_phase10_profiler.py` — unit tests for `scripts/profile_tr6948.py` (`dumpsys meminfo`, `lmkd`/`onRenderProcessGone`/`[ADLMS_BENCH]` parsers) and `scripts/sync_edge_assets.py` (`locked_variant` single-model vs `--all-models`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TR6948 USB Debugging Authorization & Airplane Mode toggle | BENCH-02 | Physical tablet security prompt & radio state cannot be toggled programmatically without prior auth | Unlock TR6948, accept RSA "Allow USB debugging", enable Airplane Mode, confirm `adb -s R01236I38026001913 get-state` returns `device` |
| Visual spot-check of 4-stage latency readout on `1024x600` screen | BENCH-01 | Physical screen readability & wrapping check | Open `DeepHalo` APK, run one plate, verify `preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs` fit cleanly in `#meta-engine` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

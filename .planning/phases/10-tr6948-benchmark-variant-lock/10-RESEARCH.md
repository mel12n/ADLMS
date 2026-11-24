# Phase 10: TR6948 Benchmark & Variant Lock - Research

**Researched:** 2026-11-24
**Domain:** In-Browser ORT-Web Stage Telemetry, Android 10 WebView 119 `adb` Memory/LMKD Profiling, and Empirical Model Variant Lock (`TR6948` `armeabi-v7a`)
**Confidence:** HIGH (codebase contracts, ONNX parity metrics, Android toolchain) / MEDIUM (live TR6948 `adb` execution awaits USB debugging prompt authorization and physical matrix run)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None — Phase 10 completes Milestone v1.6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **BENCH-01** | User sees per-stage latency (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`) in-app, and developer can capture WebView renderer RSS/PSS and `lmkd` events via an `adb` script. | `edge_detector.js` already computes `preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms`, `simd_enabled`, `model_variant` (`mvp_web/inference/edge_detector.js:313-320`); new SRP `mvp_web/telemetry_ui.js` (`<= 120 lines`) formats & displays all 4 stages in `#meta-engine` and emits `[ADLMS_BENCH] {...}` JSON; `MainActivity.kt` `onConsoleMessage` forwards `[ADLMS_BENCH]` cleanly to `android.util.Log.i("ADLMS_BENCH", ...)` and `EdgeAssetClient.kt` logs `onRenderProcessGone`; `scripts/profile_tr6948.py` polls `dumpsys meminfo` (both main process + any `sandboxed_process` PID) and tails `logcat`. |
| **BENCH-02** | Developer can run 10 consecutive plates in Airplane Mode on TR6948 across 320/416 × FP32/INT8 × SIMD/scalar and lock the variant meeting `<= 2.0 s` inference, `MAE <= 0.50 mm`, zero `lmkd` kills. | `mvp_web/` `?bench=10&model=<variant>&simd=<0\|1>` cycles the 4 bundled `sample_plates/*.jpg` through `ADLMS_IMAGE_SCALER` + `ADLMS_INFERENCE_ROUTER.analyzePlate`; `MainActivity.kt` accepts `--es bench_query "..."` (or `-d` URI) so `profile_tr6948.py` cold-launches all 8 matrix cells cleanly via `am force-stop` + `am start`; `sync_edge_assets.py --all-models` stages all 4 ONNX variants for benchmarking; `onnx_parity_report.json` establishes `yolo11n_seg_416_fp32` (`MAE = 0.4678 mm`) as the sole clinical-compliant Phase 6 export; `locked_variant` is written to both `model_meta.json` files, read by `edge_detector.js` and `sync_edge_assets.py`, and shipped in a slim single-model `app-debug.apk`. |
</phase_requirements>

## Summary

Phase 10 closes Milestone v1.6 by turning existing latent measurements into visible clinical telemetry (`BENCH-01`), automating an 8-cell (`320/416 × FP32/QDQ-INT8 × SIMD/scalar`) 10-plate on-device benchmark on the USB-attached `TR6948` (`R01236I38026001913`), and locking the clinical-compliant shipping model variant (`BENCH-02`).

Inspection of the codebase reveals four concrete integration facts that planning must address directly:
1. **Stage timings are already measured in `edge_detector.js`, but partially discarded in `app.js`:** `runEdgeInference` returns `preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms`, `simd_enabled`, and `model_variant` (`[VERIFIED: mvp_web/inference/edge_detector.js:313-320]`), while `app.js` currently reads only `data.inference_ms` into `#meta-engine` and `data.total_ms` into `toast()` (`[VERIFIED: mvp_web/app.js:339-349]`). Also, note that `t0` in `edge_detector.js:220` precedes `loadModelMeta` and `getOrCreateSession`, so plate 1 (`cold` session creation) includes ONNX model load/compile time in `total_ms`, whereas plates 2–10 (`warm` `_sessionCache` hit) reflect steady-state per-plate latency.
2. **Only one Phase 6 ONNX variant passes `MAE <= 0.50 mm`:** `exports/onnx_parity_report.json` shows `yolo11n_seg_416_fp32` at `mae_mm: 0.4678` (`"verdict": "SHIPPABLE"`), while `320_fp32` (`1.0351`), `320_qdq_int8` (`1.1958`), and `416_qdq_int8` (`0.8197`) are `"NOT_SHIPPABLE"` (`[VERIFIED: exports/onnx_parity_report.json:13-54]`). All 8 matrix cells must still be benchmarked on TR6948 for empirical latency/RAM/lmkd comparison and thesis evidence, and if `416_fp32` exceeds `2.0 s` on TR6948's 32-bit `armeabi-v7a` `968 MB` CPU, the lock report records the exact `TR6948` 32-bit vs ADR-001 64-bit hardware delta per `10-CONTEXT.md`.
3. **Activity query forwarding & `locked_variant` wiring are currently missing:** `MainActivity.kt` hardcodes `view.loadUrl(EdgeAssetClient.ENTRY_URL)` (`[VERIFIED: android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt:45]`) with no `intent` query/extra forwarding and no `onConsoleMessage` forwarding; `edge_detector.js` hardcodes `DEFAULT_MODEL_ID = 'yolo11n_seg_416_fp32'` without checking `meta.locked_variant` (`[VERIFIED: mvp_web/inference/edge_detector.js:15,68-89]`); and `sync_edge_assets.py` hardcodes `DEFAULT_MODEL = "yolo11n_seg_416_fp32.onnx"` without reading `model_meta.json` (`[VERIFIED: scripts/sync_edge_assets.py:20,44]`).
4. **TR6948 WebView 119 runs in single-process mode (`Multiprocess enabled: false`),** meaning renderer allocations typically live inside the `cl.unab.adlms.deephalo` main process rather than a separate `sandboxed_process` PID (`[VERIFIED: .planning/research/SUMMARY.md:10,144]`). `scripts/profile_tr6948.py` must therefore query `dumpsys meminfo cl.unab.adlms.deephalo` AND dynamically probe `ps -A` for any `sandboxed_process` child PIDs so both single-process and multi-process WebView configurations are captured accurately.

**Primary recommendation:** Build `mvp_web/telemetry_ui.js` (`<= 120` lines) + minimal `?bench=10` runner in `mvp_web/app.js`, add safe `bench_query` extra + `[ADLMS_BENCH]` `onConsoleMessage` forwarding in `MainActivity.kt`, implement `scripts/profile_tr6948.py` to run all 8 cold-started matrix combinations over `adb`, and write `locked_variant` into `model_meta.json` read by both `edge_detector.js` and `sync_edge_assets.py`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage timing capture (`preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms`) | Browser / WebView (`mvp_web/inference/edge_detector.js`) | — | Only the ORT-Web runtime owns exact tensor prep, `session.run()`, and decode/Sobel boundaries. |
| Stage telemetry rendering & `[ADLMS_BENCH]` JSON log emission | Browser / WebView (`mvp_web/telemetry_ui.js`) | Android Shell (`MainActivity.kt` `onConsoleMessage`) | Dedicated SRP UI/telemetry module (`<= 120` lines) decouples DOM formatting from `app.js`; Kotlin forwards `[ADLMS_BENCH]` lines cleanly to `logcat`. |
| Automated 10-plate Airplane Mode runner (`?bench=10`) | Browser / WebView (`mvp_web/app.js`) | Host CLI (`scripts/profile_tr6948.py`) | Browser cycles bundled `ADLMS_PLATES` through `ADLMS_IMAGE_SCALER` + `ADLMS_INFERENCE_ROUTER`; host orchestrates matrix launches via `adb`. |
| Intent query / extra forwarding & crash logging | Android Shell (`MainActivity.kt`, `EdgeAssetClient.kt`) | — | Native `Intent` extras (`bench_query`) are safely validated and appended to `ENTRY_URL`; `onRenderProcessGone` emits deterministic `logcat` marker. |
| Memory (`dumpsys meminfo`), `lmkd` monitoring & benchmark reporting | Host Python CLI (`scripts/profile_tr6948.py`) | — | Host-side `adb` polling observes OS-level PSS/RSS and `lmkd` events outside the WebView sandbox without perturbing device RAM. |
| Variant lock contract & slim APK bundling | Config & Build (`model_meta.json`, `scripts/sync_edge_assets.py`) | Browser (`edge_detector.js`) | Single source of truth (`locked_variant`) drives both default runtime selection and single-model APK asset sync. |

## Standard Stack

Phase 10 requires **no new external npm, PyPI, or Gradle packages**. All tooling is already installed or vendored in the repository:

### Core (Existing In-Repo)
| Library / Tool | Version | Purpose | Verification Status |
|----------------|---------|---------|---------------------|
| `onnxruntime-web` | `1.18.0` (vendored) | Local WASM inference (`ort.wasm.min.js`, `ort-wasm.wasm`, `ort-wasm-simd.wasm`) | `[VERIFIED: mvp_web/vendor/ort/, tests/test_edge_parity.mjs:18-31]` |
| Node.js (`node:test`) | `v26.13.1` | Zero-dependency JS unit & static guard test runner | `[VERIFIED: node --version -> v26.13.1]` |
| Python (`venv`) | `3.14.2` | Host `adb` profiler CLI (`scripts/profile_tr6948.py`) & asset sync (`scripts/sync_edge_assets.py`) | `[VERIFIED: .\venv\Scripts\python.exe --version -> Python 3.14.2]` |
| Android CLI Toolchain | JDK 17, SDK 34, AGP `8.7.3`, Kotlin `1.9.25` | `gradlew.bat -p android assembleDebug` APK rebuild | `[VERIFIED: android/build.gradle.kts:1-4, scripts/setup_android_toolchain.ps1]` |
| Android Debug Bridge (`adb.exe`) | Platform-Tools (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`) | `am force-stop`, `am start`, `dumpsys meminfo`, `logcat`, `install -r` on `R01236I38026001913` | `[VERIFIED: adb.exe exists on disk; device serial R01236I38026001913 attached]` |

### Package Legitimacy Audit
> **Not applicable:** Phase 10 installs **zero** new external packages (`npm`, `PyPI`, `crates`, or Gradle dependencies). Only existing vendored assets and standard library modules (`subprocess`, `re`, `json`, `argparse`, `time`, `pathlib`, `node:test`, `node:assert/strict`) are used.

## Architecture Patterns

### System Architecture Diagram

```
Host PC (scripts/profile_tr6948.py)
  |-- 1. adb shell am force-stop cl.unab.adlms.deephalo
  |-- 2. adb shell am start -n cl.unab.adlms.deephalo/.MainActivity
  |        --es bench_query "bench=10&model=<variant>&simd=<0|1>"
  |
  +--> Android APK (MainActivity.kt)
  |      |-- Validates bench_query (allow-listed keys: bench, model, simd)
  |      |-- Loads https://appassets.androidplatform.net/assets/index.html?<query>
  |      |-- WebChromeClient.onConsoleMessage -> Log.i("ADLMS_BENCH", msg)
  |      |-- EdgeAssetClient.onRenderProcessGone -> Log.e("ADLMS_BENCH", ...)
  |      |
  |      +--> WebView 119 (mvp_web/)
  |             |-- edge_detector.js: configureOrtEnv(?simd=) + resolveModelVariant(?model=, locked_variant)
  |             |-- app.js (?bench=10): cycles 10 bundled plates -> ADLMS_IMAGE_SCALER (<=1024px)
  |             |     -> ADLMS_INFERENCE_ROUTER.analyzePlate -> edge_detector.runEdgeInference
  |             |-- telemetry_ui.js (<=120 lines):
  |                   |-- Renders preprocessMs, ortInferenceMs, postprocessMs, totalMs in #meta-engine
  |                   +-- console.log("[ADLMS_BENCH] " + JSON.stringify({...}))
  |
  |-- 3. Concurrent host polling loop (every 0.5s):
  |      |-- adb shell dumpsys meminfo cl.unab.adlms.deephalo (+ sandboxed PID if present)
  |      +-- adb logcat (ADLMS_BENCH, chromium, lowmemorykiller, lmkd, aw_browser_terminator)
  |
  +--> Outputs: exports/tr6948_benchmark_report.json + exports/tr6948_benchmark_report.md
         |
         v
  Variant Lock -> model_meta.json ("locked_variant") -> sync_edge_assets.py -> slim app-debug.apk
```

### Recommended Project Structure
```
mvp_web/
├── telemetry_ui.js            # [NEW, <= 120 lines] SRP stage latency formatter, #meta-engine updater, [ADLMS_BENCH] logger
├── app.js                     # [MODIFIED, minimal] Wire ADLMS_TELEMETRY_UI + ?bench=10 auto-runner
├── index.html                 # [MODIFIED] Load <script src="telemetry_ui.js"></script> before app.js
├── style.css                  # [MODIFIED, optional] Compact telemetry pill/wrap styling for #meta-engine
├── inference/
│   └── edge_detector.js       # [MODIFIED] resolveModelVariant checks meta.locked_variant before fallback
└── models/
    └── model_meta.json        # [MODIFIED] Add "locked_variant": "<winner_id>" after matrix

android/app/src/main/java/cl/unab/adlms/deephalo/
├── MainActivity.kt            # [MODIFIED] Safe bench_query / intent data query forwarding + [ADLMS_BENCH] onConsoleMessage
└── EdgeAssetClient.kt         # [MODIFIED] Log.e("ADLMS_BENCH", "RENDER_PROCESS_GONE ...") in onRenderProcessGone

scripts/
├── profile_tr6948.py          # [NEW] ADB matrix runner, dumpsys meminfo PSS/RSS poller, lmkd/logcat watcher, report writer
└── sync_edge_assets.py        # [MODIFIED] Read locked_variant from model_meta.json instead of hardcoded DEFAULT_MODEL

exports/
├── model_meta.json            # [MODIFIED] Add "locked_variant": "<winner_id>"
├── tr6948_benchmark_report.json  # [NEW] Measured 8-cell TR6948 benchmark evidence
└── tr6948_benchmark_report.md    # [NEW] Human-readable benchmark & 32-bit vs ADR-001 delta report

tests/
├── test_phase10_benchmark.mjs # [NEW] Node tests for telemetry_ui.js (<=120 lines), locked_variant resolution, ?bench=10 helpers
└── test_phase10_profiler.py   # [NEW] Python unit tests for dumpsys meminfo parser, lmkd logcat parser, sync_edge_assets lock logic
```

### Pattern 1: SRP Telemetry Module (`mvp_web/telemetry_ui.js` <= 120 lines)
**What:** Isolate payload normalization, `#meta-engine` formatting, and `[ADLMS_BENCH]` structured JSON console emission in a standalone UMD/IIFE module (`window.ADLMS_TELEMETRY_UI` + `module.exports`).
**Why:** `PROJECT.md` §6 and `10-CONTEXT.md` mandate `mvp_web/telemetry_ui.js <= 120 lines` so `app.js` (already 1,333 lines) stays thin and `telemetry_ui.js` can be unit-tested in Node without DOM mocks for pure logic.
**Field normalization contract:** `edge_detector.js` returns snake_case keys (`preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms`, `model_variant`, `simd_enabled`), whereas `BENCH-01` / `10-CONTEXT.md` refer to `preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`. `telemetry_ui.js` should map:
- `preprocessMs = Number(data.preprocess_ms ?? data.preprocessMs ?? 0)`
- `ortInferenceMs = Number(data.inference_ms ?? data.ortInferenceMs ?? 0)`
- `postprocessMs = Number(data.postprocess_ms ?? data.postprocessMs ?? 0)`
- `totalMs = Number(data.total_ms ?? data.totalMs ?? 0)`
- `model = String(data.model_variant || data.model || 'unknown')`
- `simd = Boolean(data.simd_enabled ?? data.simd)`
- `mode = String(data.runtime_mode || 'edge-wasm')`

And update `#meta-engine` text via `textContent` (never `innerHTML`) e.g.:
`416_fp32 · SIMD | pre 42ms · ort 1120ms · post 85ms · tot 1247ms`
And emit:
`console.log('[ADLMS_BENCH] ' + JSON.stringify(record))`
Plus when a `?bench=N` batch completes, emit a summary line:
`console.log('[ADLMS_BENCH_DONE] ' + JSON.stringify({ runs, model, simd, ... }))` so `scripts/profile_tr6948.py` knows immediately when all 10 plates have finished instead of guessing a fixed sleep!

### Pattern 2: Cold-Start Matrix Dispatch via `MainActivity.kt` (`--es bench_query`)
**What:** In `MainActivity.kt`, read an optional string extra `bench_query` (or `intent?.data?.encodedQuery` when scheme is `https` and host is `appassets.androidplatform.net`) and sanitize/allow-list only `bench`, `model`, and `simd` parameters before appending `?` to `EdgeAssetClient.ENTRY_URL`.
**Why cold-start (`am force-stop` + `am start`) is critical:**
1. `edge_detector.js` caches `_ortConfigured` (`[VERIFIED: mvp_web/inference/edge_detector.js:21,222]`) and `_sessionCache[variant.id]` (`[VERIFIED: mvp_web/inference/edge_detector.js:20,130-143]`) for the lifetime of the WebView page. Calling `onNewIntent` without reloading would keep the old `ort.env.wasm.simd` setting and accumulate old `InferenceSession` heaps in WASM memory.
2. `am force-stop cl.unab.adlms.deephalo` followed by `am start -n cl.unab.adlms.deephalo/.MainActivity --es bench_query "bench=10&model=...&simd=..."` guarantees an isolated, zero-leak baseline for each of the 8 matrix runs (`320/416 × FP32/INT8 × SIMD/scalar`) and requires **no** `<intent-filter>` changes or Android App Link verification issues (`[VERIFIED: android/app/src/main/AndroidManifest.xml:16-25]`).
3. Also override `onNewIntent` to call `loadEntryUrl(intent)` just in case a developer manually triggers `am start` without `force-stop`.

### Pattern 3: Deterministic 10-Plate Runner (`?bench=10`) in `mvp_web/app.js`
**What:** `loadPlate()` in `mvp_web/app.js:223-257` displays pre-baked `plates_data.js` detections and does **not** execute `router.analyzePlate()`. For `BENCH-02`, when `URLSearchParams(location.search).get('bench')` is a positive integer `N` (e.g., `10`), `app.js` runs an async loop over `i = 0 .. N - 1` using `state.plates[i % state.plates.length]`:
1. Load `plate.image` (`sample_plates/gn_a.jpg`, `gp_a.jpg`, `gn_b.jpg`, `test_01.jpg`) into an `Image()` object.
2. Downscale via `ADLMS_IMAGE_SCALER.downscaleImageToCanvas(img, 1024)` (same path as `loadUpload()` in `mvp_web/app.js:267`, exercising `test_01.jpg` `2980x2956 -> 1024x1016` and `gp_a.jpg` `1083x1078 -> 1024x1019` memory hygiene).
3. Force `env: { hostname: 'appassets.androidplatform.net', search: location.search }` or call `router.analyzePlate(null, scaled.canvas, { search: location.search, organism: plate.organism, group: plate.group, standard: state.standard })`.
4. Call `ADLMS_TELEMETRY_UI.recordAnalysis(data, { plate: plate.key, runIndex: i + 1, totalRuns: N })` after each plate, update canvas/panel minimally so UI/canvas buffers are exercised identically to live usage, and clear `img.src = ''` between iterations.
5. After loop completion, call `ADLMS_TELEMETRY_UI.emitBenchDone(...)` (`[ADLMS_BENCH_DONE] {...}`).

*Note on `inference_router.js` (`mvp_web/inference/inference_router.js:107-153`):* Notice `loadUpload()` passes `{ organism, group, standard, dataUrl }` to `router.analyzePlate`, and `router.analyzePlate` passes `o` to `edgeDetector.runEdgeInference(img, o)` (`line 150`), which reads `o.search != null ? o.search : location.search`. So passing `location.search` (or simply letting `edge_detector.js` read `location.search`) works seamlessly when `MainActivity.kt` loads `https://appassets.androidplatform.net/assets/index.html?bench=10&model=...&simd=...`!

### Pattern 4: WebView Memory & `lmkd` Profiling on Android 10 (`scripts/profile_tr6948.py`)
**What:** Poll `adb -s R01236I38026001913 shell dumpsys meminfo cl.unab.adlms.deephalo` AND dynamically check `adb -s R01236I38026001913 shell ps -A -o PID,NAME` for any `sandboxed_process` / `webview` renderer process owned by the app.
**Why both are mandatory:**
- On Android multi-process WebView, `dumpsys meminfo <pkg>` reports only the browser/app process while the renderer runs in an isolated `sandboxed_process` (`[CITED: developer.android.com - dumpsys meminfo]`).
- On `TR6948`, `.planning/research/SUMMARY.md:10,144` recorded `dumpsys webviewupdate` showing `com.google.android.webview 119.0.6045.163` with `Multiprocess enabled: false` (single-process mode due to `968 MB` RAM). In single-process mode, all V8, WASM, and `<canvas>` memory is charged directly to `cl.unab.adlms.deephalo`.
- Polling `dumpsys meminfo cl.unab.adlms.deephalo` + any matching `sandboxed_process` PID captures `TOTAL PSS:` and `TOTAL RSS:` (reported in kB by Android `dumpsys meminfo`) in both single-process and multi-process regimes.
- Simultaneously, a background thread tails `adb -s R01236I38026001913 logcat -v time ADLMS_BENCH:I chromium:I lmkd:I lowmemorykiller:I ActivityManager:I *:S` (after clearing with `logcat -c` before each run) to catch:
  - `[ADLMS_BENCH] {...}` JSON payloads (one per plate)
  - `[ADLMS_BENCH_DONE] {...}` completion sentinel
  - `lowmemorykiller` / `lmkd` kills (`Killing 'cl.unab.adlms.deephalo'` or `sandboxed_process`)
  - `onRenderProcessGone` / `aw_browser_terminator` (`RENDER_PROCESS_GONE` or `Renderer process ... crash detected`)

### Anti-Patterns to Avoid
- **Do NOT put telemetry DOM formatting or benchmark orchestration inside `mvp_web/app.js`:** `app.js` is already 1,333 lines (`[VERIFIED: mvp_web/app.js]`). `PROJECT.md` §6 and `10-CONTEXT.md` strictly cap `mvp_web/telemetry_ui.js` at `<= 120 lines` and require keeping `app.js` changes to thin wiring hooks.
- **Do NOT rely solely on `chromium` logcat tag without `onConsoleMessage`:** Some Android 10 vendor WebView builds throttle or reformat `console.log` lines, or truncate long JSON strings on `chromium`. Forwarding `[ADLMS_BENCH]` in `MainActivity.kt` `WebChromeClient.onConsoleMessage` via `Log.i("ADLMS_BENCH", ...)` ensures reliable capture.
- **Do NOT switch variants without cold-restarting the app (`am force-stop`):** `_sessionCache` and `_ortConfigured` in `edge_detector.js` persist across SPA state changes; only a cold process restart resets `ort.env.wasm.simd` and frees WASM linear memory completely.
- **Do NOT hardcode `DEFAULT_MODEL` in `sync_edge_assets.py` or `edge_detector.js`:** Both currently hardcode `yolo11n_seg_416_fp32` (`[VERIFIED: scripts/sync_edge_assets.py:20, mvp_web/inference/edge_detector.js:15]`). Read `locked_variant` from `model_meta.json` so Phase 10's lock is single-source-of-truth.
- **Do NOT lock an `NOT_SHIPPABLE` (`MAE > 0.50 mm`) variant just to hit `<= 2.0 s`:** `10-CONTEXT.md` explicitly locks the policy: `MAE <= 0.50 mm` is a hard clinical gate; if `416 FP32` exceeds `2.0 s` on TR6948's 32-bit `968 MB` CPU, lock the fastest clinical-compliant variant (`MAE <= 0.50 mm`) and document the 32-bit TR6948 vs ADR-001 64-bit delta.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image downscaling in `?bench=10` | Custom offscreen canvas resize logic | `ADLMS_IMAGE_SCALER.downscaleImageToCanvas(img, 1024)` (`[VERIFIED: mvp_web/image_scaler.js:34-54]`) | Reuses exact production 1024 px memory cap tested in Phase 9. |
| ORT-Web stage timing instrumentation | New timer wrappers inside `app.js` | Existing `preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms` returned by `edge_detector.runEdgeInference` (`[VERIFIED: mvp_web/inference/edge_detector.js:313-320]`) | Already wraps exact `t0`, `tPre0..1`, `tInf0..1`, `tPost0..1` boundaries. |
| ONNX parity accuracy re-evaluation | Ad-hoc JS accuracy script | `exports/onnx_parity_report.json` from Phase 6 (`[VERIFIED: exports/onnx_parity_report.json]`) + `exports/js_parity_report.json` (`0.0212 mm` JS-vs-Python parity, `[VERIFIED: exports/js_parity_report.json:6]`) | Clinical MAE against `best.pt` is already measured across held-out plates. |
| Android APK asset mirroring | Manual file copies into `android/app/src/main/assets/` | `scripts/sync_edge_assets.py` (`--all-models` for matrix, default locked single-model for final slim APK) | Cleans stale files, enforces `noCompress` directory layout, excludes desktop `.jpg` files (`[VERIFIED: scripts/sync_edge_assets.py:37-49]`). |

## Common Pitfalls

### Pitfall 1: Cold Plate 1 `total_ms` vs Warm Plates 2–10 `total_ms`
**What goes wrong:** In `mvp_web/inference/edge_detector.js:220-230`, `var t0 = performance.now();` runs **before** `loadModelMeta()` and `getOrCreateSession()` (`InferenceSession.create()`). On plate 1, `total_ms` includes fetching and compiling the `5.1–11.1 MB` `.onnx` model into WASM (~0.5–3 s extra), whereas `preprocess_ms + inference_ms + postprocess_ms` does not.
**How to avoid:** Keep `edge_detector.js` timing intact (or record both `cold_first_ms` and `warm_mean_ms` / `warm_p95_ms` over plates 2–10 in `scripts/profile_tr6948.py` and the benchmark report) so cold session startup is cleanly separated from steady-state per-plate Turnaround Time (`TRT`).
**Warning signs:** Plate 1 `totalMs` is >2× higher than `preprocessMs + ortInferenceMs + postprocessMs`, while plates 2–10 match the sum within ~5 ms.

### Pitfall 2: 32-bit `armeabi-v7a` WASM SIMD Crash or Slowdown on TR6948
**What goes wrong:** WebView 119 on 32-bit `armeabi-v7a` supports 128-bit WASM SIMD (`v128` -> ARM NEON), but 32-bit unaligned loads or QDQ INT8 kernels can behave unexpectedly (either hitting a `SIGBUS`/renderer crash or running slower in QDQ due to unfused Quantize/Dequantize overhead).
**How to avoid:** Test all 4 variants with BOTH `simd=1` and `simd=0` (8 combinations total) via `scripts/profile_tr6948.py`, logging `onRenderProcessGone` / `lmkd` events per cell. `edge_detector.js` already implements `?simd=0` scalar fallback (`[VERIFIED: mvp_web/inference/edge_detector.js:100-101]`).
**Warning signs:** `RENDER_PROCESS_GONE` or `WebAssembly.RuntimeError` during `simd=1` runs that disappears under `simd=0`.

### Pitfall 3: `dumpsys meminfo` Units & Single-Process vs Sandboxed Renderer Process
**What goes wrong:** Parsing `dumpsys meminfo` blindly for `sandboxed_process` fails when WebView 119 on TR6948 runs in single-process mode (`Multiprocess enabled: false`), reporting `0 MB` renderer memory! Conversely, ignoring `sandboxed_process` underreports on multi-process devices. Also, `dumpsys meminfo` outputs values in **kB** (`TOTAL PSS:   123456      TOTAL RSS:   234567`), not MB.
**How to avoid:** In `scripts/profile_tr6948.py`:
1. Parse `TOTAL PSS:\s+(\d+)` and `TOTAL RSS:\s+(\d+)` from `dumpsys meminfo cl.unab.adlms.deephalo` (divide kB by `1024.0` for MB).
2. Query `adb shell ps -A -o PID,NAME` for lines containing `sandboxed_process` or `webview_service`; if any match `cl.unab.adlms.deephalo` (or active WebView renderer), query `dumpsys meminfo <pid>` as well and record `app_pss_mb`, `renderer_pss_mb` (0.0 if in-process), and `combined_pss_mb`.
**Warning signs:** `renderer_pss_mb == 0` when `app_pss_mb > 100 MB` is expected in single-process mode — explicitly annotate `webview_multiprocess: false` in the JSON/MD report.

### Pitfall 4: `test_edge_parity.mjs` Assertion Coupling to `yolo11n_seg_416_fp32`
**What goes wrong:** `tests/test_edge_parity.mjs:55-63` and `136` assert `yolo11n_seg_416_fp32` as the default when `search == ''`.
**How to avoid:** Because `exports/onnx_parity_report.json` shows `yolo11n_seg_416_fp32` (`0.4678 mm`) is the **only** Phase 6 variant meeting `MAE <= 0.50 mm` (`[VERIFIED: exports/onnx_parity_report.json:35-43]`), locking `yolo11n_seg_416_fp32` keeps `test_edge_parity.mjs` green automatically. If a different variant were ever locked in `model_meta.json`, update `test_edge_parity.mjs` assertions to read `meta.locked_variant` dynamically.

### Pitfall 5: Forgetting to Switch Back From `--all-models` Before Final APK Build
**What goes wrong:** Running `sync_edge_assets.py --all-models` bundles all 4 ONNX models (`~32.3 MB` of ONNX + `~19.4 MB` of ORT WASM -> `~57 MB` APK). Shipping that fails `BENCH-02`'s slim single-model APK requirement.
**How to avoid:** `scripts/profile_tr6948.py` (or the final Phase 10 plan step) must explicitly re-run `python scripts/sync_edge_assets.py` (WITHOUT `--all-models`), verify `android/app/src/main/assets/mvp_web/models/` contains ONLY `model_meta.json` + the single `locked_variant` `.onnx`, rebuild `app-debug.apk`, verify `compress_type == 0` for `.onnx`/`.wasm`, and `adb install -r`.

### Pitfall 6: `bench_query` Security / Open-Redirect Risk in `MainActivity.kt`
**What goes wrong:** Blindly passing `intent.data.toString()` into `webView.loadUrl(...)` could allow an arbitrary external URL (`https://evil.com`) to be loaded in a WebView with `AndroidExport` `@JavascriptInterface` attached (`[VERIFIED: android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt:40]`).
**How to avoid:** Never load an arbitrary intent URL! Always keep the origin fixed to `EdgeAssetClient.ENTRY_URL` (`https://appassets.androidplatform.net/assets/index.html`) and parse only a strict allow-list of query keys (`bench` integer `1..50`, `model` `[a-zA-Z0-9_]+`, `simd` `0|1`) from `intent?.getStringExtra("bench_query")` or `intent?.data?.encodedQuery`, constructing the final query string safely.

## Code Examples

### 1. Stage Telemetry Payload & DOM Update (`mvp_web/telemetry_ui.js` pattern, `<= 120 lines`)
```javascript
// Pure formatting + DOM #meta-engine update + [ADLMS_BENCH] structured console output
function normalizeTimings(data, extras) {
  var d = data || {};
  var ex = extras || {};
  return {
    plate: ex.plate || d.plate || null,
    run: ex.runIndex || null,
    totalRuns: ex.totalRuns || null,
    model: String(d.model_variant || d.model || 'unknown'),
    mode: String(d.runtime_mode || 'edge-wasm'),
    simd: Boolean(d.simd_enabled != null ? d.simd_enabled : d.simd),
    preprocessMs: Number(d.preprocess_ms != null ? d.preprocess_ms : (d.preprocessMs || 0)),
    ortInferenceMs: Number(d.inference_ms != null ? d.inference_ms : (d.ortInferenceMs || 0)),
    postprocessMs: Number(d.postprocess_ms != null ? d.postprocess_ms : (d.postprocessMs || 0)),
    totalMs: Number(d.total_ms != null ? d.total_ms : (d.totalMs || 0)),
    detections: Array.isArray(d.detections) ? d.detections.length : Number(d.disk_count || 0),
  };
}

function formatEngineText(t) {
  if (t.mode === 'local-api') {
    return 'Local API · YOLO11n-seg (' + t.ortInferenceMs + ' ms)';
  }
  var simdLabel = t.simd ? 'SIMD' : 'Scalar';
  return t.model + ' · ' + simdLabel +
    ' | pre ' + t.preprocessMs + 'ms · ort ' + t.ortInferenceMs +
    'ms · post ' + t.postprocessMs + 'ms · tot ' + t.totalMs + 'ms';
}
```

### 2. `edge_detector.js` `locked_variant` Resolution (`mvp_web/inference/edge_detector.js:68-89`)
```javascript
function resolveModelVariant(meta, searchStr) {
  var variants = (meta && Array.isArray(meta.variants)) ? meta.variants : [];
  if (variants.length === 0) {
    throw new Error('model_meta.json contains no variants');
  }
  var requested = parseQueryParam(searchStr, 'model');
  if (requested) {
    for (var i = 0; i < variants.length; i++) {
      if (variants[i] && variants[i].id === requested) return variants[i];
    }
  }
  var preferredId = (meta && typeof meta.locked_variant === 'string' && meta.locked_variant)
    ? meta.locked_variant
    : DEFAULT_MODEL_ID;
  for (var j = 0; j < variants.length; j++) {
    if (variants[j] && variants[j].id === preferredId) return variants[j];
  }
  return variants[0];
}
```

### 3. `MainActivity.kt` Safe Benchmark Extra & `[ADLMS_BENCH]` Logcat Bridge
```kotlin
// Inside MainActivity.kt (keeping existing FileChooserHelper & ExportBridge intact)
private fun buildEntryUrl(intent: Intent?): String {
    val rawQuery = intent?.getStringExtra("bench_query")
        ?: intent?.data?.takeIf { it.host == EdgeAssetClient.ASSET_DOMAIN }?.encodedQuery
        ?: return EdgeAssetClient.ENTRY_URL
    val allowed = Regex("^[a-zA-Z0-9_=&]+$")
    val clean = rawQuery.trim().trimStart('?')
    return if (clean.isNotEmpty() && allowed.matches(clean)) {
        "${EdgeAssetClient.ENTRY_URL}?$clean"
    } else {
        EdgeAssetClient.ENTRY_URL
    }
}

// Inside WebChromeClient:
override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
    val msg = consoleMessage?.message() ?: return false
    if (msg.startsWith("[ADLMS_BENCH")) {
        Log.i("ADLMS_BENCH", msg)
    }
    return false
}
```

### 4. `dumpsys meminfo` Parser (`scripts/profile_tr6948.py`)
```python
# Source: Android dumpsys meminfo format [CITED: developer.android.com]
PSS_RE = re.compile(r"TOTAL\s+PSS:\s+(\d+)")
RSS_RE = re.compile(r"TOTAL\s+RSS:\s+(\d+)")

def parse_meminfo_kb(output: str) -> tuple[float | None, float | None]:
    pss_m = PSS_RE.search(output)
    rss_m = RSS_RE.search(output)
    pss_mb = round(int(pss_m.group(1)) / 1024.0, 2) if pss_m else None
    rss_mb = round(int(rss_m.group(1)) / 1024.0, 2) if rss_m else None
    return pss_mb, rss_mb
```

## State of the Art

| Aspect | Current Repo State | Target Phase 10 State | Impact |
|--------|-------------------|-----------------------|--------|
| Stage latency display | Only `inference_ms` shown in `#meta-engine` (`app.js:344`) | All 4 stages (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`) via `telemetry_ui.js` (`<= 120` lines) + `[ADLMS_BENCH]` logcat JSON | Satisfies `BENCH-01` & `PROJECT.md` §6 SRP |
| Model default selection | Hardcoded `yolo11n_seg_416_fp32` in `edge_detector.js:15` and `sync_edge_assets.py:20` | Single-source `locked_variant` in `model_meta.json` read by both runtime & asset syncer | Satisfies `BENCH-02` variant lock |
| Benchmark orchestration | Manual plate selection/upload only | `?bench=10&model=<id>&simd=<0\|1>` auto-runner + `scripts/profile_tr6948.py` `adb` matrix profiler | Reproducible 8-cell Airplane Mode evidence |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yolo11n_seg_416_fp32` inference latency on TR6948 (`armeabi-v7a`, 968 MB RAM) is unknown until measured on device and may exceed `2.0 s`. | Summary / Lock Policy | Low risk to plan — `10-CONTEXT.md` explicitly handles this case: lock the fastest variant meeting `MAE <= 0.50 mm` and document the 32-bit TR6948 vs ADR-001 64-bit hardware delta. |
| A2 | Cycling the 4 bundled `mvp_web/sample_plates/*.jpg` images 10 times (`i % 4`) satisfies `BENCH-02`'s "10 consecutive plates" stability & memory-leak test without adding 6 redundant JPEGs (~2–10 MB) to the APK. | Architecture Patterns | If the user wants 10 *distinct* JPEG files bundled temporarily during benchmark mode, `sync_edge_assets.py` could stage 6 held-out plates from `data/Antibiogram_demo/` during `--all-models`, though `plates_data.js` currently lists 4 bundled plates (`[VERIFIED: mvp_web/plates_data.js]`). |
| A3 | TR6948 WebView 119 `dumpsys meminfo cl.unab.adlms.deephalo` reports `TOTAL PSS:` and `TOTAL RSS:` in kB on Android 10 (API 29). | Architecture Patterns / Environment | `dumpsys meminfo` on API 29 includes `TOTAL PSS:` and on Android 9+ includes `TOTAL RSS:` (`[CITED: developer.android.com]`); `profile_tr6948.py` will also capture raw `dumpsys` fallback if `TOTAL RSS:` column differs on TR6948's ROM. |

## Open Questions

1. **TR6948 USB Debugging Authorization State:**
   - What we know: During research, `adb.exe devices -l` saw `R01236I38026001913     authorizing transport_id:1` (`adb.exe: device still authorizing`), meaning the tablet was plugged in but had not yet accepted the host RSA debugging prompt (or screen was locked).
   - Recommendation: Include an explicit `adb devices` `device` state pre-flight check in `scripts/profile_tr6948.py` (failing fast with clear instructions to unlock TR6948 and accept USB debugging, and verify Airplane Mode is enabled before matrix execution).

## Environment Availability

| Dependency | Required By | Available | Version / Path | Fallback |
|------------|------------|-----------|----------------|----------|
| Node.js (`node`) | `node --test` Nyquist suite | ✓ | `v26.13.1` | — |
| Python (`venv\Scripts\python.exe`) | `sync_edge_assets.py`, `profile_tr6948.py` | ✓ | `Python 3.14.2` | — |
| JDK 17 | `gradlew.bat assembleDebug` | ✓ | `%LOCALAPPDATA%\Android\jdk-17` | — |
| Android SDK 34 + Gradle wrapper | APK build | ✓ | `android\gradlew.bat`, `platforms\android-34` | — |
| `adb.exe` | TR6948 profiling & APK install | ✓ | `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` | — |
| Physical TR6948 (`R01236I38026001913`) | On-device 8-cell benchmark (`BENCH-02`) | ⚠ (`authorizing`) | Connected on `transport_id:1`; awaiting USB debug authorization tap on tablet | Re-tap "Allow USB debugging" on TR6948 before running `profile_tr6948.py` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| JS Framework | `node:test` (`Node v26.13.1`) |
| Python Framework | `unittest` (`venv\Scripts\python.exe`, `Python 3.14.2`) |
| Config file | none (zero-config built-in runners) |
| Quick run command | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs` |
| Full suite command | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs && .\venv\Scripts\python.exe -m unittest tests.test_phase6_onnx tests.test_phase10_profiler -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BENCH-01 | `mvp_web/telemetry_ui.js` exists, `<= 120` lines (SRP), uses `textContent` (no `innerHTML`), normalizes `preprocessMs`/`ortInferenceMs`/`postprocessMs`/`totalMs`, formats `#meta-engine`, and emits `[ADLMS_BENCH] {...}` JSON | unit + static | `node --test tests/test_phase10_benchmark.mjs` | ❌ Wave 0 |
| BENCH-01 | `scripts/profile_tr6948.py` parses Android `dumpsys meminfo` `TOTAL PSS:` / `TOTAL RSS:` (kB -> MB), sandboxed renderer PIDs, `lmkd`/`onRenderProcessGone` logcat lines, and `[ADLMS_BENCH]` payloads | unit | `.\venv\Scripts\python.exe -m unittest tests.test_phase10_profiler -v` | ❌ Wave 0 |
| BENCH-02 | `edge_detector.resolveModelVariant(meta, search)` honors `meta.locked_variant` when `?model=` is absent/invalid and blocks path traversal; `?bench=10` URL parsing works | unit | `node --test tests/test_phase10_benchmark.mjs tests/test_edge_parity.mjs` | ❌ Wave 0 / ✅ partial |
| BENCH-02 | `scripts/sync_edge_assets.py` resolves `locked_variant` from `model_meta.json`, bundles all 4 models with `--all-models`, and bundles only `locked_variant` + `model_meta.json` in default mode | unit | `.\venv\Scripts\python.exe -m unittest tests.test_phase10_profiler -v` | ❌ Wave 0 |
| BENCH-02 | Physical TR6948 8-cell × 10-plate Airplane Mode benchmark (`exports/tr6948_benchmark_report.json` + `.md`), slim `app-debug.apk` (`ZIP_STORED` `.onnx`/`.wasm`), and `adb install -r` | on-device integration | `.\venv\Scripts\python.exe scripts/profile_tr6948.py --serial R01236I38026001913` | ❌ Wave 0 (script) |

### Sampling Rate
- **Per task commit:** Quick Node + Python unit tests (`< 2 s`)
- **Per wave merge:** Full Node + Python suites + `sync_edge_assets.py --dry-run`
- **Phase gate:** Full unit suite green + physical TR6948 8-cell benchmark report generated + slim `app-debug.apk` built, ZIP-audited (`compress_type == 0`), and installed on `R01236I38026001913`

### Wave 0 Gaps
- [ ] `tests/test_phase10_benchmark.mjs` — covers `telemetry_ui.js` (`<= 120` lines, zero `innerHTML`, 4-stage formatting, `[ADLMS_BENCH]` log output) and `edge_detector.js` `locked_variant` resolution
- [ ] `tests/test_phase10_profiler.py` — covers `profile_tr6948.py` `dumpsys meminfo` + `logcat` parsers and `sync_edge_assets.py` `locked_variant` single-model filtering

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Offline single-user clinical instrument |
| V3 Session Management | no | No server sessions |
| V4 Access Control | yes | `MainActivity.kt` must restrict `bench_query` / intent URI to `EdgeAssetClient.ENTRY_URL` origin (`appassets.androidplatform.net`) and allow-listed query chars `[a-zA-Z0-9_=&]+`, preventing external URL injection into the `@JavascriptInterface`-enabled WebView |
| V5 Input Validation | yes | `edge_detector.resolveModelVariant` validates `?model=` strictly against `model_meta.json` `variants[].id` allow-list (`[VERIFIED: mvp_web/inference/edge_detector.js:68-89]`); `telemetry_ui.js` must render DOM via `textContent` (zero `innerHTML`) |
| V6 Cryptography | no | SHA-256 verification handled in Phase 6 (`tests/test_phase6_onnx.py`) |

### Known Threat Patterns for Android WebView + Host ADB CLI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Intent URL / Extra Injection into WebView | Tampering / Elevation | Hardcode `EdgeAssetClient.ENTRY_URL` base in `MainActivity.kt`; allow-list only `bench`, `model`, `simd` query keys; reject arbitrary schemes/hosts |
| DOM XSS via `?model=` or telemetry strings | Tampering | Use `textContent` exclusively in `mvp_web/telemetry_ui.js` + strict allow-list in `resolveModelVariant` |
| Command injection in `scripts/profile_tr6948.py` | Tampering | Always pass `subprocess.run([...], shell=False)` argument lists; validate `--serial` and variant IDs against `model_meta.json` |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: mvp_web/inference/edge_detector.js:15,68-89,100-106,130-143,220-235,313-320]` — Existing `stageTimings` (`preprocess_ms`, `inference_ms`, `postprocess_ms`, `total_ms`), `?model=` allow-list, `?simd=0` scalar fallback, singleton `_sessionCache`
- `[VERIFIED: mvp_web/inference/inference_router.js:40-43,107-153]` — APK origin detection & `analyzePlate` contract
- `[VERIFIED: mvp_web/app.js:223-354,1327-1333]` — `loadPlate`, `loadUpload`, `#meta-engine` partial timing display, `ADLMS_IMAGE_SCALER` wiring
- `[VERIFIED: mvp_web/index.html:65-97,181-201,369-379]` — `#runtime-mode-badge`, `#meta-engine`, script load order
- `[VERIFIED: android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt:1-58]` & `[VERIFIED: android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt:1-66]` — WebView setup, `ENTRY_URL`, `onRenderProcessGone`
- `[VERIFIED: scripts/sync_edge_assets.py:1-110]` — `--all-models` vs `DEFAULT_MODEL` sync behavior
- `[VERIFIED: exports/model_meta.json:1-128]`, `[VERIFIED: mvp_web/models/model_meta.json:1-128]`, `[VERIFIED: exports/onnx_parity_report.json:1-56]`, `[VERIFIED: exports/js_parity_report.json:1-103]` — Exact sizes, SHA256s, and MAE parity (`yolo11n_seg_416_fp32` = `0.4678 mm`, sole `SHIPPABLE` variant)
- `[VERIFIED: tests/test_edge_parity.mjs:1-309]` & `[VERIFIED: tests/test_phase9_tablet_formulary.mjs:1-158]` — Node `node:test` conventions & SRP line-count guardrails
- `[VERIFIED: .planning/research/SUMMARY.md:10,144]` — TR6948 WebView `119.0.6045.163` `Multiprocess enabled: false` profile

### Secondary (MEDIUM confidence)
- `[CITED: developer.android.com]` — `dumpsys meminfo` (`TOTAL PSS`, `TOTAL RSS` in kB, browser vs `sandboxed_process` separation), `WebChromeClient.onConsoleMessage`, `am start --es` / `--activity-single-top`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified on disk (`Node v26.13.1`, `Python 3.14.2`, JDK 17, Android SDK 34, `adb.exe`, `22/22` Node tests + `2/2` Phase 6 ONNX tests passing today)
- Architecture: HIGH — every integration point in `edge_detector.js`, `app.js`, `MainActivity.kt`, `sync_edge_assets.py`, and `model_meta.json` read directly with line citations
- Pitfalls: HIGH — cold-vs-warm `t0`, WebView 119 single-process `dumpsys meminfo` behavior, Phase 6 `MAE <= 0.50 mm` lock constraint, and `bench_query` input validation all directly observed

**Research date:** 2026-11-24
**Valid until:** 2026-12-24 (stable local codebase & pinned toolchain)

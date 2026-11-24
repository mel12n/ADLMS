# Phase 10: TR6948 Benchmark & Variant Lock - Pattern Map

**Mapped:** 2026-11-24
**Files analyzed:** 15
**Analogs found:** 14 / 15 (1 new `adb` polling pattern falls back to `10-RESEARCH.md` for OS process polling)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `mvp_web/telemetry_ui.js` | utility / component | transform | `mvp_web/image_scaler.js` & `mvp_web/formulary_ui.js` | exact |
| `mvp_web/app.js` | controller | event-driven / batch | `mvp_web/app.js` (`loadPlate`, `loadUpload`, `probeBackend`) | exact |
| `mvp_web/index.html` | config / component | request-response | `mvp_web/index.html` (head/body scripts + `#meta-engine`) | exact |
| `mvp_web/style.css` | config | static layout | `mvp_web/style.css` (`.specimen-val`, `#runtime-mode-badge`) | exact |
| `mvp_web/inference/edge_detector.js` | service | transform | `mvp_web/inference/edge_detector.js` (`resolveModelVariant`) | exact |
| `exports/model_meta.json` | config | file-I/O | `exports/model_meta.json` | exact |
| `mvp_web/models/model_meta.json` | config | file-I/O | `mvp_web/models/model_meta.json` | exact |
| `android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt` | controller | event-driven / request-response | `android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt` | exact |
| `android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` | middleware | event-driven | `android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` | exact |
| `scripts/sync_edge_assets.py` | utility | file-I/O | `scripts/sync_edge_assets.py` | exact |
| `scripts/profile_tr6948.py` | utility | batch / file-I/O | `scripts/sync_edge_assets.py` & `scripts/verify_js_parity.py` | role-match (CLI + report; `adb` polling from `10-RESEARCH.md`) |
| `exports/tr6948_benchmark_report.json` | config (artifact) | file-I/O | `exports/onnx_parity_report.json` & `exports/js_parity_report.json` | exact |
| `exports/tr6948_benchmark_report.md` | config (artifact) | file-I/O | `scripts/verify_js_parity.py` (Markdown table summary) | role-match |
| `tests/test_phase10_benchmark.mjs` | test | transform | `tests/test_phase9_tablet_formulary.mjs` & `tests/test_edge_parity.mjs` | exact |
| `tests/test_phase10_profiler.py` | test | transform / file-I/O | `tests/test_phase6_onnx.py` | exact |

---

## Pattern Assignments

### `mvp_web/telemetry_ui.js` (utility / component, transform)

**Analogs:** `mvp_web/image_scaler.js` (`<= 120` lines SRP UMD/IIFE) and `mvp_web/formulary_ui.js` (`textContent`-only DOM rendering + dual export).

**UMD/IIFE module wrapper pattern** (`mvp_web/image_scaler.js` lines 1-13, 84-90):
```javascript
/* ADLMS — SRP Image & Canvas Downscaler (UI-02)
 * ...
 * Zero-build UMD/IIFE: attaches window.ADLMS_IMAGE_SCALER and module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_IMAGE_SCALER = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // ...
  return {
    MAX_EDGE_PX: MAX_EDGE_PX,
    computeScaledDimensions: computeScaledDimensions,
    downscaleImageToCanvas: downscaleImageToCanvas,
    loadAndDownscaleFile: loadAndDownscaleFile,
  };
});
```

**Safe DOM update pattern (`textContent`, never `innerHTML`)** (`mvp_web/formulary_ui.js` lines 129-134, 187, 227):
```javascript
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
// ...
titleEl.textContent = `Disco #${idx + 1} (${disc.code || 'UNK'}) — ${catalog.length} fármacos`;
```

**Error/Guard pattern** (`mvp_web/formulary_ui.js` lines 136-137):
```javascript
function initFormularyUI(api) {
  if (typeof document === 'undefined' || !api) return null;
```
Copy this `typeof document === 'undefined'` guard so pure functions (`normalizeTimings`, `formatEngineText`, `formatBenchLine`) run cleanly in Node `node:test` without DOM mocks, and keep total file length `<= 120` lines.

---

### `mvp_web/app.js` (controller, event-driven / batch)

**Analog:** `mvp_web/app.js` itself — specifically `loadPlate` (lines 223-257), `loadUpload` (lines 259-354), `updateRuntimeModeBadge` (lines 1199-1219), and boot block (lines 1308-1333).

**Image downscale + inference router + UI update pattern** (`mvp_web/app.js` lines 224-238, 302-350):
```javascript
const scaler = window.ADLMS_IMAGE_SCALER;
const rawW = img.naturalWidth || img.width;
const rawH = img.naturalHeight || img.height;
let workingImg = img;
let W = rawW;
let H = rawH;
if (scaler && Math.max(rawW, rawH) > (scaler.MAX_EDGE_PX || 1024)) {
  const scaled = scaler.downscaleImageToCanvas(img, scaler.MAX_EDGE_PX || 1024);
  workingImg = scaled.canvas;
  W = scaled.width;
  H = scaled.height;
}
```
```javascript
const router = window.ADLMS_INFERENCE_ROUTER;
if (!router || typeof router.analyzePlate !== 'function') {
  throw new Error('ADLMS_INFERENCE_ROUTER no cargado');
}
const data = await router.analyzePlate(file, scaled.canvas, {
  organism: state.organism,
  group: state.group,
  standard: state.standard,
  dataUrl: scaled.thumbDataUrl,
});

const activeMode = data.runtime_mode || router.getActiveMode() || 'edge-wasm';
state.backendOnline = activeMode === 'local-api';
updateRuntimeModeBadge(activeMode, data.simd_enabled);
```

**Existing `#meta-engine` update hook to delegate to `ADLMS_TELEMETRY_UI`** (`mvp_web/app.js` lines 339-345):
```javascript
const engEl = $('meta-engine');
if (engEl) {
  const label = activeMode === 'local-api'
    ? 'Local API · YOLO11n-seg'
    : `Edge WASM · ${data.model_variant || 'yolo11n_seg_416_fp32'}`;
  engEl.textContent = `${label} (${data.inference_ms} ms)`;
}
```
Replace inline formatting at lines 339-345 with a thin call to `window.ADLMS_TELEMETRY_UI.recordAnalysis(data, { el: $('meta-engine') })` (with safe fallback if absent).

**Boot trigger pattern for `?bench=N`** (`mvp_web/app.js` lines 1323-1325):
```javascript
probeBackend();
if (state.plates.length) loadPlate(state.plates[0]);
else toast('plates_data.js no encontrado: ejecute scripts/build_mvp_plates.py');
```
In `?bench=N` mode, iterate `i = 0 .. N - 1` over `state.plates[i % state.plates.length]`, loading `plate.image` (`mvp_web/plates_data.js` line 10: `"sample_plates/gn_a.jpg"`), downscaling via `ADLMS_IMAGE_SCALER.downscaleImageToCanvas(img, 1024)`, calling `router.analyzePlate(null, workingImg, { organism: plate.organism, group: plate.group, standard: state.standard, search: location.search })`, calling `ADLMS_TELEMETRY_UI.recordAnalysis(data, ...)`, clearing `img.src = ''`, and calling `ADLMS_TELEMETRY_UI.emitBenchDone(...)` after completion.

---

### `mvp_web/index.html` (config / component, request-response)

**Analog:** `mvp_web/index.html` lines 197-200 and lines 369-379.

**Telemetry target element** (`mvp_web/index.html` lines 197-200):
```html
<div class="specimen-row">
  <span class="specimen-label">Motor IA</span>
  <span class="specimen-val mono" id="meta-engine">YOLO11n-seg · Sobel 36-ray</span>
</div>
```

**Script load order pattern** (`mvp_web/index.html` lines 369-379):
```html
  <script src="breakpoints_data.js"></script>
  <script src="formulary_ui.js"></script>
  <script src="plates_data.js"></script>
  <script src="vendor/ort/ort.wasm.min.js"></script>
  <script src="inference/sobel_cv.js"></script>
  <script src="inference/yolo_seg_decode.js"></script>
  <script src="inference/edge_detector.js"></script>
  <script src="inference/inference_router.js"></script>
  <script src="image_scaler.js"></script>
  <script src="app.js"></script>
```
Insert `<script src="telemetry_ui.js"></script>` immediately before `<script src="app.js"></script>` (after `image_scaler.js`).

---

### `mvp_web/style.css` (config, static layout)

**Analog:** `mvp_web/style.css` lines 789-804.

**Existing `#meta-engine` CSS rule constraint** (`mvp_web/style.css` lines 789-804):
```css
.specimen-val {
  color: var(--text);
  font-size: 11.5px;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}

.specimen-val.mono {
  font-family: var(--mono);
  color: var(--accent-2);
  letter-spacing: 0.04em;
  font-size: 11.5px;
}
```
Notice `.specimen-val` sets `white-space: nowrap;`. Add an `#meta-engine` override (`white-space: normal; text-align: right; line-height: 1.35; max-width: 68%;`) so multi-stage telemetry (`pre · ort · post · tot`) wraps cleanly on narrow portrait screens without overflowing `.specimen-card`.

---

### `mvp_web/inference/edge_detector.js` (service, transform)

**Analog:** `mvp_web/inference/edge_detector.js` lines 15, 68-89.

**Allow-list model resolution pattern** (`mvp_web/inference/edge_detector.js` lines 15, 68-89):
```javascript
  var DEFAULT_MODEL_ID = 'yolo11n_seg_416_fp32';
// ...
  function resolveModelVariant(meta, searchStr) {
    var variants = (meta && Array.isArray(meta.variants)) ? meta.variants : [];
    if (variants.length === 0) {
      throw new Error('model_meta.json contains no variants');
    }

    var requested = parseQueryParam(searchStr, 'model');
    if (requested) {
      for (var i = 0; i < variants.length; i++) {
        if (variants[i] && variants[i].id === requested) {
          return variants[i];
        }
      }
    }

    for (var j = 0; j < variants.length; j++) {
      if (variants[j] && variants[j].id === DEFAULT_MODEL_ID) {
        return variants[j];
      }
    }
    return variants[0];
  }
```
Update lines 83-87 to prefer `(meta && typeof meta.locked_variant === 'string' && meta.locked_variant) ? meta.locked_variant : DEFAULT_MODEL_ID` so `?model=` overrides still win during benchmarks, while default/invalid queries resolve to `meta.locked_variant`.

---

### `exports/model_meta.json` and `mvp_web/models/model_meta.json` (config, file-I/O)

**Analog:** `exports/model_meta.json` lines 1-18.

**Top-level metadata schema pattern** (`exports/model_meta.json` lines 1-18):
```json
{
  "schema_version": "1.0",
  "opset": 17,
  "classes": {
    "0": "antibiotic_disk",
    "1": "inhibition_zone",
    "2": "inner_colony"
  },
```
Add `"locked_variant": "<winner_id>"` (and optional `"locked_at"` / `"locked_criteria"`) at top level in both files symmetrically. Preserve `opset`, `classes`, and `variants[]` schema unchanged so `tests/test_phase6_onnx.py` lines 20-41 continue to pass.

---

### `android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt` (controller, event-driven / request-response)

**Analog:** `android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt` lines 1-58.

**Imports & WebChromeClient / WebView setup pattern** (`MainActivity.kt` lines 1-11, 24-46):
```kotlin
package cl.unab.adlms.deephalo

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity
// ...
    @SuppressLint("SetJavaScriptEnabled")
    private fun createAndBindWebView() {
        WebView.setWebContentsDebuggingEnabled(true)
        val view = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            webViewClient = EdgeAssetClient(this@MainActivity) { recreateWebView() }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?,
                ): Boolean = fileChooserHelper.onShowFileChooser(filePathCallback)
            }
            addJavascriptInterface(exportBridge, "AndroidExport")
            setDownloadListener(exportBridge)
        }
        webView = view
        setContentView(view)
        view.loadUrl(EdgeAssetClient.ENTRY_URL)
    }
```
Extend `WebChromeClient` with `override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean` forwarding `[ADLMS_BENCH` messages via `android.util.Log.i("ADLMS_BENCH", msg)`, and replace `view.loadUrl(EdgeAssetClient.ENTRY_URL)` with `buildEntryUrl(intent)` (checking `intent?.getStringExtra("bench_query")` or `intent?.data?.takeIf { it.host == EdgeAssetClient.ASSET_DOMAIN }?.encodedQuery` against an allow-list regex, keeping `EdgeAssetClient.ENTRY_URL` as the immutable origin).

---

### `android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` (middleware, event-driven)

**Analog:** `android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` lines 37-46, 61-65.

**Render process termination handler pattern** (`EdgeAssetClient.kt` lines 37-46):
```kotlin
    override fun onRenderProcessGone(
        view: WebView?,
        detail: RenderProcessGoneDetail?,
    ): Boolean {
        (view?.parent as? ViewGroup)?.removeView(view)
        view?.destroy()
        Toast.makeText(context, "WebView renderer restarted", Toast.LENGTH_SHORT).show()
        onRendererCrashed()
        return true
    }
```
Add `android.util.Log.e("ADLMS_BENCH", "RENDER_PROCESS_GONE didCrash=${detail?.didCrash()}")` inside `onRenderProcessGone` before `onRendererCrashed()` so `adb logcat` records renderer terminations deterministically.

---

### `scripts/sync_edge_assets.py` (utility, file-I/O)

**Analog:** `scripts/sync_edge_assets.py` lines 15-60, 86-110.

**Repo path constants & model filtering pattern** (`scripts/sync_edge_assets.py` lines 15-21, 41-58):
```python
REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_WEB_DIR = REPO_ROOT / "mvp_web"
SRC_EXPORTS_DIR = REPO_ROOT / "exports"
DST_ASSETS_DIR = REPO_ROOT / "android" / "app" / "src" / "main" / "assets" / "mvp_web"

DEFAULT_MODEL = "yolo11n_seg_416_fp32.onnx"
MODEL_META = "model_meta.json"
```
```python
        # Filter models/ directory
        if rel.parts[0] == "models":
            if src_path.suffix.lower() == ".onnx":
                if not all_models and src_path.name != DEFAULT_MODEL:
                    continue
                seen_models.add(src_path.name)
            elif src_path.name != MODEL_META:
                continue
```
Add a pure helper `resolve_locked_model_filename(meta_path: Path | None = None) -> str` that reads `locked_variant` from `model_meta.json`, maps it against `variants[].id -> variants[].filename`, and falls back to `DEFAULT_MODEL` if absent. Also sync `model_meta.json` cleanly when `mvp_web/models/model_meta.json` is updated.

---

### `scripts/profile_tr6948.py` (utility, batch / file-I/O)

**Analogs:** `scripts/sync_edge_assets.py` (CLI `argparse`, `REPO_ROOT`, `main(argv) -> int`) and `scripts/verify_js_parity.py` (`subprocess.run(..., check=True, capture_output=True, text=True)`, `EXPORTS_DIR`, JSON + Markdown table output).

**CLI argument & entry pattern** (`scripts/sync_edge_assets.py` lines 86-110):
```python
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync mvp_web/ and ONNX models into android/app/src/main/assets/mvp_web/."
    )
    parser.add_argument(
        "--all-models",
        action="store_true",
        help="Bundle all 4 Phase 6 ONNX variants from mvp_web/models/ and exports/.",
    )
    return parser.parse_args(argv)

def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    # ...
```

**Report writing & Markdown table output pattern** (`scripts/verify_js_parity.py` lines 367-377):
```python
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("| Plate | Aspect | Dims | padTop | Matched | MAE (mm) | Sobel Δr Diff (mm) |")
    print("| --- | --- | --- | ---: | ---: | ---: | ---: |")
```
**Subprocess safety pattern** (`scripts/verify_js_parity.py` lines 130-148): always pass explicit argument lists to `subprocess.run([...], shell=False, ...)` / `subprocess.Popen([...], shell=False, ...)`. For `adb` `dumpsys meminfo` + `logcat` parsing logic, see `## No Analog Found` and `10-RESEARCH.md` Pattern 4 / Code Example 4.

---

### `exports/tr6948_benchmark_report.json` & `exports/tr6948_benchmark_report.md` (config / artifact, file-I/O)

**Analogs:** `exports/onnx_parity_report.json` lines 1-56 and `scripts/verify_js_parity.py` lines 355-377.

**Parity/Benchmark JSON report schema pattern** (`exports/onnx_parity_report.json` lines 10-43):
```json
{
  "plate_count": 6,
  "threshold_mae_mm": 0.5,
  "variants": [
    {
      "id": "yolo11n_seg_416_fp32",
      "imgsz": 416,
      "precision": "fp32",
      "mae_mm": 0.4678,
      "verdict": "SHIPPABLE"
    }
  ]
}
```
Include `device_serial`, `webview_multiprocess`, `threshold_trt_ms` (`2000`), `threshold_mae_mm` (`0.5`), `cells` (the 8 `model × simd` runs with cold vs warm latency stats, peak app/renderer PSS/RSS MB, `lmkd_kills`, `render_crashes`), `locked_variant`, and `hardware_delta_note` (TR6948 32-bit `armeabi-v7a` `968 MB` vs ADR-001 64-bit baseline).

---

### `tests/test_phase10_benchmark.mjs` (test, transform)

**Analogs:** `tests/test_phase9_tablet_formulary.mjs` lines 1-16, 87-98 and `tests/test_edge_parity.mjs` lines 51-63.

**Node test imports, SRP line-count guard & `innerHTML` ban pattern** (`tests/test_phase9_tablet_formulary.mjs` lines 1-16, 90-97):
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SCALER_PATH = path.join(ROOT, 'mvp_web', 'image_scaler.js');

describe('Phase 9 — UI-02: Image & Canvas Downscaler (image_scaler.js)', () => {
  it('enforces SRP guardrail: mvp_web/image_scaler.js is <= 120 lines', () => {
    assert.ok(fs.existsSync(SCALER_PATH), 'mvp_web/image_scaler.js must exist');
    const lines = fs.readFileSync(SCALER_PATH, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 120, `Expected <= 120 lines, got ${lines}`);
  });
```
```javascript
    assert.equal(/\.innerHTML\s*=/.test(src), false, 'formulary_ui.js must not use innerHTML (DOM XSS mitigation T-09-03)');
    assert.ok(src.includes('textContent'), 'formulary_ui.js must use textContent for DOM rendering');
```

**`edge_detector.resolveModelVariant` test pattern** (`tests/test_edge_parity.mjs` lines 51-63):
```javascript
test('WASM-01: resolveModelVariant blocks path traversal and unknown IDs via allow-list', () => {
  const meta = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'mvp_web/models/model_meta.json'), 'utf-8')
  );
  const blocked = edgeDetector.resolveModelVariant(meta, '?model=../../secret');
  assert.equal(blocked.id, 'yolo11n_seg_416_fp32');
```
Copy this pattern to test `meta.locked_variant` override (e.g., synthetic meta with `locked_variant: 'yolo11n_seg_320_fp32'`) while `?model=` still takes precedence when valid.

---

### `tests/test_phase10_profiler.py` (test, transform / file-I/O)

**Analog:** `tests/test_phase6_onnx.py` lines 1-20.

**Python `unittest` layout pattern** (`tests/test_phase6_onnx.py` lines 1-20):
```python
import hashlib
import json
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.utils.constants import EXPORTS_DIR


class TestPhase6Onnx(unittest.TestCase):
    def setUp(self):
        self.meta_path = EXPORTS_DIR / "model_meta.json"
        self.assertTrue(self.meta_path.exists(), f"Missing {self.meta_path}")
        self.meta = json.loads(self.meta_path.read_text(encoding="utf-8"))
```
Use `tempfile.TemporaryDirectory()` + `unittest.TestCase` to test `scripts.profile_tr6948` (`dumpsys meminfo` PSS/RSS parser, `sandboxed_process` PID parser, `logcat` `lmkd`/`RENDER_PROCESS_GONE`/`[ADLMS_BENCH]` parser, variant lock selection) and `scripts.sync_edge_assets.collect_sync_plan` (`--all-models` vs `locked_variant`).

---

## Shared Patterns

### 1. Zero-Build UMD/IIFE Browser + Node Dual Export
**Sources:** `mvp_web/image_scaler.js` (lines 6-13), `mvp_web/inference/edge_detector.js` (lines 6-13)
**Apply to:** `mvp_web/telemetry_ui.js`, `mvp_web/inference/edge_detector.js`
- Attach namespace to `window.ADLMS_*` in browser/WebView and export via `module.exports` when `typeof module === 'object' && module.exports` so Node `node:test` can `require()` modules directly without a bundler.

### 2. DOM XSS Prevention (`textContent` Only) & Input Allow-Listing
**Sources:** `mvp_web/formulary_ui.js` (lines 129-134, 227), `mvp_web/inference/edge_detector.js` (lines 68-89)
**Apply to:** `mvp_web/telemetry_ui.js`, `mvp_web/inference/edge_detector.js`, `android/.../MainActivity.kt`
- Never write `.innerHTML =` in `mvp_web/telemetry_ui.js`; render telemetry strings exclusively with `textContent`.
- Validate query parameters (`?model=`, `bench_query`) strictly against allow-lists (`variants[].id` in JS; `^[a-zA-Z0-9_=&]+$` appended to hardcoded `EdgeAssetClient.ENTRY_URL` in Kotlin).

### 3. SRP Line-Count Budget Enforcement
**Sources:** `mvp_web/image_scaler.js` (`<= 120` lines), `tests/test_phase9_tablet_formulary.mjs` (lines 12-16, 90-95)
**Apply to:** `mvp_web/telemetry_ui.js`, `tests/test_phase10_benchmark.mjs`
- Keep `mvp_web/telemetry_ui.js` strictly `<= 120` lines and enforce the line limit via static `node:test` assertion.

### 4. Python CLI Path & Subprocess Conventions
**Sources:** `scripts/sync_edge_assets.py` (lines 15-21, 86-110), `scripts/verify_js_parity.py` (lines 23-36, 130-148)
**Apply to:** `scripts/profile_tr6948.py`, `scripts/sync_edge_assets.py`
- Resolve paths from `REPO_ROOT = Path(__file__).resolve().parent.parent`; use `argparse` with `main(argv: list[str] | None = None) -> int`; pass explicit argument lists to `subprocess.run` / `Popen` (never `shell=True`).

---

## No Analog Found

Files or subsystems with no close existing match in the repository (planner should use `10-RESEARCH.md` patterns instead):

| File / Subsystem | Role | Data Flow | Reason |
|------------------|------|-----------|--------|
| `scripts/profile_tr6948.py` (`adb` `dumpsys meminfo` + `logcat` live polling) | utility | streaming / batch | No existing `adb` subprocess poller or `dumpsys meminfo` / `logcat` parser exists in `scripts/` — use `10-RESEARCH.md` Pattern 4 and Code Example 4 (`PSS_RE`, `RSS_RE`, `ps -A` `sandboxed_process` probe, `logcat -v time` tailing). |

---

## Metadata

**Analog search scope:** `mvp_web/`, `android/app/src/main/`, `scripts/`, `tests/`, `exports/` (all verified git-tracked via `git ls-files`).
**Files scanned:** 12 source/test/config files read directly.
**Pattern extraction date:** 2026-11-24

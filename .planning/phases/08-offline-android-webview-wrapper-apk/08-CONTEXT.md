# Phase 8: Offline Android WebView Wrapper APK - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the Phase 7 offline edge-inference web app (`mvp_web/`) into a minimal, installable Kotlin `WebViewAssetLoader` APK targeting the USB-attached **TR6948** tablet (`minSdk 29`, `armeabi-v7a`, Android 10, 968 MB RAM, WebView 119), supporting 100% offline execution (`appassets.androidplatform.net`), rear camera and gallery image ingestion (`onShowFileChooser` + `FileProvider`), local FHIR R4 / CSV export to Downloads (`MediaStore`), WebView renderer crash recovery (`onRenderProcessGone`), and repeatable asset syncing via `scripts/sync_edge_assets.py` (`APK-01..04`).

</domain>

<decisions>
## Implementation Decisions

### Android Build Toolchain (Windows Host)
- **Automated CLI bootstrap:** Provide an idempotent PowerShell bootstrap script (`scripts/setup_android_toolchain.ps1`) that checks for JDK 17 and Android SDK (`cmdline-tools`, `platforms;android-34`, `build-tools;34.0.0`) under `%LOCALAPPDATA%\Android\Sdk` (reusing the existing `platform-tools\adb.exe`), and downloads/installs missing components locally without requiring Android Studio UI interaction.
- **Gradle Wrapper:** Include a self-contained Gradle project under `android/` (`./gradlew assembleDebug` / `gradlew.bat assembleDebug`) so any developer or CI agent can build and `adb install -r` from CLI.

### APK Identity, Orientation & Bundled Models (`APK-01`, `APK-04`)
- **App identity & SDK:** App name `ADLMS DeepHalo`, package ID `cl.unab.adlms.deephalo`, `minSdk = 29`, `targetSdk = 34`, ABI filter `armeabi-v7a`.
- **Uncompressed binary assets:** Set `androidResources { noCompress += listOf("onnx", "wasm") }` so ONNX and WASM binaries can be streamed directly from APK assets without decompression overhead.
- **Rotation-safe orientation:** Set `android:screenOrientation="unspecified"` and `android:configChanges="orientation|screenSize|keyboardHidden"` in `AndroidManifest.xml` so TR6948 supports both `1024x600` landscape and `600x1024` portrait without reloading the WebView or dropping loaded plates.
- **Model bundling (`scripts/sync_edge_assets.py`):** Sync `mvp_web/` (excluding unused/desktop-only files if needed) plus `yolo11n_seg_416_fp32.onnx` and `model_meta.json` by default (~25 MB APK). Support an explicit `--all-models` flag to bundle all 4 Phase 6 ONNX variants (~55 MB APK) when preparing Phase 10 on-device benchmarks.

### WebView Asset Serving (`APK-01`)
- **Explicit offline MIME mapping:** Serve `assets/mvp_web/` via `WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/`, wrapping `AssetsPathHandler` with explicit MIME overrides for `.wasm` (`application/wasm`), `.js`/`.mjs` (`application/javascript`), `.onnx` (`application/octet-stream`), and `.json` (`application/json`).
- **Offline safety:** Block clear-text traffic or remote origin ambiguity (`WebView.setWebContentsDebuggingEnabled(true)` for debug builds so `chrome://inspect` works during Phase 8/10 verification).

### Camera & Gallery Capture Flow (`APK-02`)
- **Combined Android chooser:** Implement `WebChromeClient.onShowFileChooser` returning a combined `Intent.createChooser` offering both:
  1. **Rear Camera capture** (`MediaStore.ACTION_IMAGE_CAPTURE` backed by a `FileProvider` temporary JPEG URI, requesting `Manifest.permission.CAMERA` at runtime on first use), and
  2. **Gallery / Document picker** (`ACTION_GET_CONTENT` with `image/*`).
- **Cancel-safe callback cleanup:** Cancelling the chooser, failing camera capture, or denying `CAMERA` permission MUST always invoke `filePathCallback.onReceiveValue(null)` and clear the stored callback reference so subsequent `<input type="file">` taps never wedge.

### FHIR R4 / CSV Export Destination (`APK-03`)
- **Native Downloads bridge + fallback:** Expose `@JavascriptInterface` (`window.AndroidExport.saveFile(filename, mimeType, content)`) in `MainActivity.kt` AND attach a `DownloadListener` fallback so `mvp_web/app.js` triggers native saving automatically inside the APK while preserving standard Blob downloads on desktop `run_web_mvp.py`.
- **On-device location & feedback:** Write exports via `MediaStore.Downloads` into `/sdcard/Download/DeepHalo/` (verifiable via `adb shell ls /sdcard/Download/DeepHalo` and visible in Android Files), and show a native `Toast` confirmation with filename/path.

### Renderer Crash Recovery (`APK-04`)
- **Graceful reload on OOM/kill:** Implement `WebViewClient.onRenderProcessGone` to safely detach and `destroy()` the dead `WebView`, recreate/rebind a fresh `WebView` configured with `WebViewAssetLoader` + JS interfaces, reload `https://appassets.androidplatform.net/assets/index.html`, show a non-blocking recovery `Toast`, and return `true` so the Android process stays alive.

### Claude's Discretion
- Exact Kotlin source layout under `android/app/src/main/java/cl/unab/adlms/deephalo/` (e.g., `MainActivity.kt`, `EdgeAssetClient.kt`, `ExportBridge.kt`).
- Exact `gradlew` version compatible with Android Gradle Plugin 8.x and JDK 17.
- Exact `android/app/src/main/res/` launcher icons and splash/status-bar styling (`#0B1120` dark clinical background matching `mvp_web/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Milestone Specs
- `.planning/PROJECT.md` — TR6948 constraints (`968 MB` RAM, Android 10 API 29, `armeabi-v7a`, `1024x600`, WebView 119, 2 MP rear camera), `adb.exe` path `C:\Users\cmelian\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- `.planning/REQUIREMENTS.md` — `APK-01`, `APK-02`, `APK-03`, `APK-04`
- `.planning/ROADMAP.md` — Phase 8 goal and 4 success criteria

### Research & Phase 7 Outputs
- `.planning/research/STACK.md` — Kotlin `WebViewAssetLoader`, Gradle `noCompress`, `armeabi-v7a` guidance
- `.planning/research/ARCHITECTURE.md` — `appassets.androidplatform.net`, JS/WebView bridge contracts, `sync_edge_assets.py`
- `.planning/research/PITFALLS.md` — WebView 119 `.wasm` MIME pitfalls, `onShowFileChooser` wedged input, `onRenderProcessGone`, `lmkd` memory handling
- `.planning/phases/07-in-browser-edge-inference-clinical-parity/07-CONTEXT.md` & `07-02-SUMMARY.md` — Edge inference origin check (`location.hostname === 'appassets.androidplatform.net'`)

### Codebase Files
- `mvp_web/index.html`, `mvp_web/app.js` — Existing `<input type="file">`, FHIR R4 JSON export, and CSV export handlers to connect cleanly to `window.AndroidExport`
- `mvp_web/models/model_meta.json`, `exports/` — Source models and metadata synced by `scripts/sync_edge_assets.py`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mvp_web/inference/`: Offline ORT-Web `1.18.0` stack and router already detect `location.hostname === 'appassets.androidplatform.net'` automatically (`WASM-02`).
- `mvp_web/app.js`: Already generates HL7 FHIR R4 JSON (`downloadFhirReport`) and CSV (`downloadCsvReport`) payloads in memory before creating Blob downloads — ideal hook point for `window.AndroidExport?.saveFile(...)`.

### Host Environment & Gaps
- `adb.exe` (`C:\Users\cmelian\AppData\Local\Android\Sdk\platform-tools\adb.exe`) and TR6948 (`R01236I38026001913`) are connected and verified.
- Host Windows currently lacks JDK 17 and Android SDK `cmdline-tools` / `platforms;android-34` / `build-tools;34.0.0` — addressed by `scripts/setup_android_toolchain.ps1`.
- Google Fonts CDN removal and `1024x600` CSS polish belong to Phase 9 (`UI-01`), though Phase 8 can ensure offline asset loading doesn't block on missing fonts.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 8 scope (`UI-01..04` remain in Phase 9, `BENCH-01..02` remain in Phase 10).

</deferred>

---

*Phase: 08-offline-android-webview-wrapper-apk*
*Context gathered: 2026-11-24*

# Phase 8: Offline Android WebView Wrapper APK - Research

**Researched:** 2026-11-24
**Domain:** Offline Android WebView Wrapper APK (`WebViewAssetLoader`, `FileProvider`, `MediaStore.Downloads`, Gradle CLI toolchain on Windows)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Automated CLI bootstrap:** Provide an idempotent PowerShell bootstrap script (`scripts/setup_android_toolchain.ps1`) that checks for JDK 17 and Android SDK (`cmdline-tools`, `platforms;android-34`, `build-tools;34.0.0`) under `%LOCALAPPDATA%\Android\Sdk` (reusing the existing `platform-tools\adb.exe`), and downloads/installs missing components locally without requiring Android Studio UI interaction.
- **Gradle Wrapper:** Include a self-contained Gradle project under `android/` (`./gradlew assembleDebug` / `gradlew.bat assembleDebug`) so any developer or CI agent can build and `adb install -r` from CLI.
- **App identity & SDK:** App name `ADLMS DeepHalo`, package ID `cl.unab.adlms.deephalo`, `minSdk = 29`, `targetSdk = 34`, ABI filter `armeabi-v7a`.
- **Uncompressed binary assets:** Set `androidResources { noCompress += listOf("onnx", "wasm") }` so ONNX and WASM binaries can be streamed directly from APK assets without decompression overhead.
- **Rotation-safe orientation:** Set `android:screenOrientation="unspecified"` and `android:configChanges="orientation|screenSize|keyboardHidden"` in `AndroidManifest.xml` so TR6948 supports both `1024x600` landscape and `600x1024` portrait without reloading the WebView or dropping loaded plates.
- **Model bundling (`scripts/sync_edge_assets.py`):** Sync `mvp_web/` (excluding unused/desktop-only files if needed) plus `yolo11n_seg_416_fp32.onnx` and `model_meta.json` by default (~25 MB APK). Support an explicit `--all-models` flag to bundle all 4 Phase 6 ONNX variants (~55 MB APK) when preparing Phase 10 on-device benchmarks.
- **Explicit offline MIME mapping:** Serve `assets/mvp_web/` via `WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/`, wrapping `AssetsPathHandler` with explicit MIME overrides for `.wasm` (`application/wasm`), `.js`/`.mjs` (`application/javascript`), `.onnx` (`application/octet-stream`), and `.json` (`application/json`).
- **Offline safety:** Block clear-text traffic or remote origin ambiguity (`WebView.setWebContentsDebuggingEnabled(true)` for debug builds so `chrome://inspect` works during Phase 8/10 verification).
- **Combined Android chooser:** Implement `WebChromeClient.onShowFileChooser` returning a combined `Intent.createChooser` offering both:
  1. **Rear Camera capture** (`MediaStore.ACTION_IMAGE_CAPTURE` backed by a `FileProvider` temporary JPEG URI, requesting `Manifest.permission.CAMERA` at runtime on first use), and
  2. **Gallery / Document picker** (`ACTION_GET_CONTENT` with `image/*`).
- **Cancel-safe callback cleanup:** Cancelling the chooser, failing camera capture, or denying `CAMERA` permission MUST always invoke `filePathCallback.onReceiveValue(null)` and clear the stored callback reference so subsequent `<input type="file">` taps never wedge.
- **Native Downloads bridge + fallback:** Expose `@JavascriptInterface` (`window.AndroidExport.saveFile(filename, mimeType, content)`) in `MainActivity.kt` AND attach a `DownloadListener` fallback so `mvp_web/app.js` triggers native saving automatically inside the APK while preserving standard Blob downloads on desktop `run_web_mvp.py`.
- **On-device location & feedback:** Write exports via `MediaStore.Downloads` into `/sdcard/Download/DeepHalo/` (verifiable via `adb shell ls /sdcard/Download/DeepHalo` and visible in Android Files), and show a native `Toast` confirmation with filename/path.
- **Graceful reload on OOM/kill:** Implement `WebViewClient.onRenderProcessGone` to safely detach and `destroy()` the dead `WebView`, recreate/rebind a fresh `WebView` configured with `WebViewAssetLoader` + JS interfaces, reload `https://appassets.androidplatform.net/assets/index.html`, show a non-blocking recovery `Toast`, and return `true` so the Android process stays alive.

### the agent's Discretion
- Exact Kotlin source layout under `android/app/src/main/java/cl/unab/adlms/deephalo/` (e.g., `MainActivity.kt`, `EdgeAssetClient.kt`, `ExportBridge.kt`).
- Exact `gradlew` version compatible with Android Gradle Plugin 8.x and JDK 17.
- Exact `android/app/src/main/res/` launcher icons and splash/status-bar styling (`#0B1120` dark clinical background matching `mvp_web/`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 8 scope (`UI-01..04` remain in Phase 9, `BENCH-01..02` remain in Phase 10).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **APK-01** | User can install (via `adb`) and open a minimal Kotlin APK (`minSdk 29`, `armeabi-v7a`) that serves `mvp_web/` offline through `WebViewAssetLoader` with correct `.wasm`/`.js` MIME types and uncompressed `.onnx`/`.wasm`. | `EdgeAssetClient.kt` + `WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/`), `noCompress += listOf("onnx", "wasm")`, `abiFilters += "armeabi-v7a"`, `scripts/setup_android_toolchain.ps1`. |
| **APK-02** | User can capture a plate with the TR6948 rear camera or pick one from the gallery (`onShowFileChooser` + `FileProvider`, cancel-safe). | `FileChooserHelper.kt` with `ActivityResultContracts.StartActivityForResult` + `RequestPermission(CAMERA)`, `FileProvider` (`provider_paths.xml`), guaranteed `onReceiveValue(null)` on cancel/deny. |
| **APK-03** | User can save FHIR R4 JSON and CSV exports to Downloads on-device (`DownloadListener` + JS bridge + `MediaStore`). | `ExportBridge.kt` (`@JavascriptInterface saveFile`) + `DownloadListener` fallback + `MediaStore.Downloads` (`RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS + "/DeepHalo"`), wired into `mvp_web/app.js:1068-1073` `download()`. |
| **APK-04** | User's app recovers from a WebView renderer crash (`onRenderProcessGone`), and developer can sync `mvp_web/` into APK assets with `scripts/sync_edge_assets.py`. | `EdgeAssetClient.onRenderProcessGone` detaching/destroying dead WebView and rebinding fresh instance; `scripts/sync_edge_assets.py` staging `mvp_web/` + `yolo11n_seg_416_fp32.onnx` + `model_meta.json` (with `--all-models` option). |
</phase_requirements>

## Summary

Phase 8 packages the Phase 7 offline edge-inference web app (`mvp_web/`) into a minimal, single-activity Kotlin Android WebView wrapper APK (`cl.unab.adlms.deephalo`) targeting the USB-attached **TR6948** tablet (Android 10 / API 29, `armeabi-v7a`, 968 MB RAM, WebView 119). Because the host Windows machine currently has `adb.exe` (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`) but lacks JDK 17 and Android SDK `cmdline-tools` / `platforms;android-34` / `build-tools;34.0.0`, an idempotent PowerShell bootstrap (`scripts/setup_android_toolchain.ps1`) is required before `gradlew.bat assembleDebug` can compile the APK.

In accordance with **PROJECT.md Section 6 (SRP Standards)**, the Kotlin layer MUST NOT be a monolithic `MainActivity.kt`. Instead, `MainActivity.kt` remains a thin lifecycle coordinator delegating to three dedicated single-responsibility classes: `EdgeAssetClient.kt` (offline `WebViewAssetLoader` + MIME overrides + `onRenderProcessGone` recovery), `FileChooserHelper.kt` (camera/gallery `onShowFileChooser` + `FileProvider` + runtime `CAMERA` permission + cancel-safe callback), and `ExportBridge.kt` (`@JavascriptInterface` + `MediaStore.Downloads` to `/sdcard/Download/DeepHalo/` + `DownloadListener` fallback).

**Primary recommendation:** Build a lean `androidx.activity.ComponentActivity` + `androidx.webkit:webkit:1.18.0` Gradle 8.9 / AGP 8.7.3 project under `android/` with `abiFilters += "armeabi-v7a"` and `noCompress += listOf("onnx", "wasm")`, keeping `MainActivity.kt` under 120 lines.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Offline asset & MIME serving | Android Native (`EdgeAssetClient.kt`) | — | `WebViewAssetLoader` intercepts `https://appassets.androidplatform.net/assets/` and enforces `.wasm`/`.onnx`/`.js` MIME types |
| Camera & Gallery ingestion | Android Native (`FileChooserHelper.kt`) | Web (`mvp_web/index.html` `<input type="file">`) | Native `onShowFileChooser` + `FileProvider` handles runtime `CAMERA` permission and rear camera capture |
| FHIR R4 & CSV file export | Android Native (`ExportBridge.kt`) | Web (`mvp_web/app.js` `download()`) | `app.js` generates payload in memory and calls `window.AndroidExport.saveFile(...)` to write via `MediaStore.Downloads` |
| Renderer OOM crash recovery | Android Native (`EdgeAssetClient.kt` + `MainActivity.kt`) | — | `onRenderProcessGone` destroys dead `WebView` and rebinds a fresh instance so Android process survives |
| Asset & ONNX model staging | Build Tooling (`scripts/sync_edge_assets.py`) | — | Copies `mvp_web/` + `yolo11n_seg_416_fp32.onnx` + `model_meta.json` into `android/app/src/main/assets/mvp_web/` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Android Gradle Plugin (AGP)** | `8.7.3` | Android APK build system | Stable with JDK 17, `compileSdk = 34`, `minSdk = 29`, `targetSdk = 34` |
| **Gradle Wrapper** | `8.9` | Headless CLI build (`gradlew.bat assembleDebug`) | Compatible with AGP 8.7.3 and JDK 17 |
| **Eclipse Temurin JDK** | `17 LTS` | Java/Kotlin compilation runtime | Required by AGP 8.x |
| **Kotlin Android Plugin** | `1.9.25` | Kotlin compilation | Pairs cleanly with AGP 8.7.3 without Compose overhead |
| **`androidx.webkit:webkit`** | `1.18.0` | `WebViewAssetLoader` | Serves local APK assets over `https://appassets.androidplatform.net/assets/` |
| **`androidx.activity:activity-ktx`** | `1.9.3` | `ComponentActivity` + `ActivityResultContracts` | Clean `onShowFileChooser` & `CAMERA` permission callbacks without deprecated `startActivityForResult` |

**Installation (Windows Host):**
Run `scripts/setup_android_toolchain.ps1` to install JDK 17 (if missing) and Android SDK `cmdline-tools;latest`, `platforms;android-34`, `build-tools;34.0.0` under `%LOCALAPPDATA%\Android\Sdk` without overwriting existing `platform-tools\adb.exe`.

## Architecture Patterns

### Recommended Project Structure
```
android/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── gradlew.bat
├── gradle/wrapper/
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties          # distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-bin.zip
└── app/
    ├── build.gradle.kts                   # cl.unab.adlms.deephalo, minSdk 29, targetSdk 34, armeabi-v7a, noCompress
    └── src/main/
        ├── AndroidManifest.xml            # CAMERA, configChanges, FileProvider
        ├── res/
        │   ├── xml/provider_paths.xml     # <cache-path name="camera_captures" path="camera/" />
        │   └── values/themes.xml          # #0B1120 dark clinical background
        ├── assets/mvp_web/                # Populated by scripts/sync_edge_assets.py (gitignored or synced)
        └── java/cl/unab/adlms/deephalo/
            ├── MainActivity.kt            # Thin WebView lifecycle & bridge wiring (<= 120 lines)
            ├── EdgeAssetClient.kt         # WebViewAssetLoader + MIME overrides + onRenderProcessGone
            ├── FileChooserHelper.kt       # onShowFileChooser + FileProvider + CAMERA permission
            └── ExportBridge.kt            # @JavascriptInterface + DownloadListener + MediaStore.Downloads
```

### Pattern 1: `EdgeAssetClient.kt` (WebViewAssetLoader + MIME + Crash Recovery)
- Wrap `WebViewAssetLoader.AssetsPathHandler(context)` inside a custom `PathHandler` or `shouldInterceptRequest` override so `.wasm` always returns `application/wasm`, `.js`/`.mjs` returns `application/javascript`, `.onnx` returns `application/octet-stream`, and `.json` returns `application/json`.
- Override `onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean`: remove `view` from its parent `ViewGroup`, call `view.destroy()`, invoke `onRendererCrashed()` callback on `MainActivity` to instantiate and bind a fresh `WebView`, show a non-blocking `Toast`, and return `true`.

### Pattern 2: `FileChooserHelper.kt` (Cancel-Safe Camera + Gallery Chooser)
- Register two `ActivityResultLauncher`s in `FileChooserHelper` (initialized during `onCreate`):
  1. `permissionLauncher` (`RequestPermission`) for `Manifest.permission.CAMERA`.
  2. `chooserLauncher` (`StartActivityForResult`) for the combined `Intent.createChooser`.
- When `onShowFileChooser(webView, filePathCallback, fileChooserParams)` is called:
  - If an old `pendingCallback` exists, invoke `pendingCallback.onReceiveValue(null)` first.
  - Store `pendingCallback = filePathCallback`.
  - Check `ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA)`. If not granted, request it via `permissionLauncher`; if denied, invoke `pendingCallback?.onReceiveValue(null)` and clear it.
  - Create a temp file in `File(activity.cacheDir, "camera/plate_${System.currentTimeMillis()}.jpg")`, obtain `cameraUri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)`.
  - Build `cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)` and `galleryIntent = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")`.
  - Launch `Intent.createChooser(galleryIntent, "Seleccionar imagen de placa").putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))`.
  - In `chooserLauncher` result: if `RESULT_OK`, check `data?.data` (gallery) else if `cameraFile.length() > 0` use `cameraUri`; otherwise `null`. Always call `pendingCallback?.onReceiveValue(result)` and set `pendingCallback = null`.

### Pattern 3: `ExportBridge.kt` (`MediaStore.Downloads` + `app.js` hook)
- Expose `@JavascriptInterface fun saveFile(filename: String, mimeType: String, content: String)` on `ExportBridge` registered as `"AndroidExport"`.
- On API 29+ (`minSdk = 29`), insert into `MediaStore.Downloads.EXTERNAL_CONTENT_URI` with `DISPLAY_NAME = filename`, `MIME_TYPE = mimeType`, `RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS + "/DeepHalo"`, write UTF-8 bytes, and show `Toast` on UI thread (`Saved to Download/DeepHalo/$filename`).
- In `mvp_web/app.js:1068-1073` (`function download(name, text, type)`), check `if (window.AndroidExport?.saveFile)` first; otherwise fall back to desktop `URL.createObjectURL(new Blob(...))`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local asset serving | Custom `file://` URLs or embedded HTTP server | `androidx.webkit.WebViewAssetLoader` | Provides Secure Context (`https://appassets.androidplatform.net`) required for WASM/WebView APIs |
| Camera temp file URI | `file://` URI in `EXTRA_OUTPUT` | `androidx.core.content.FileProvider` | `file://` throws `FileUriExposedException` on Android 7+ |
| Downloads folder write | `WRITE_EXTERNAL_STORAGE` + `Environment.getExternalStoragePublicDirectory` | `MediaStore.Downloads` | Scoped storage compliant on Android 10 (API 29+) with zero storage permission prompts |

## Common Pitfalls

### Pitfall 1: Wedged `<input type="file">` after cancelling chooser
- **What goes wrong:** If `onShowFileChooser` returns `true` and `filePathCallback.onReceiveValue(null)` is not called on cancel/back/permission-deny, WebView permanently ignores all future `<input type="file">` clicks.
- **How to avoid:** Wrap every exit path in `FileChooserHelper.kt` with `pendingCallback?.onReceiveValue(null); pendingCallback = null`.

### Pitfall 2: Compressed `.onnx` or `.wasm` in APK
- **What goes wrong:** `aapt2` compresses `.onnx`/`.wasm` by default, forcing `AssetManager` to decompress multi-MB binaries in RAM on every read.
- **How to avoid:** `androidResources { noCompress += listOf("onnx", "wasm") }` in `android/app/build.gradle.kts`.

### Pitfall 3: Clobbering existing `platform-tools\adb.exe`
- **What goes wrong:** Re-installing Android SDK tools carelessly can overwrite or break the working `adb.exe` already connected to TR6948.
- **How to avoid:** `scripts/setup_android_toolchain.ps1` only extracts `cmdline-tools` into `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest` and runs `sdkmanager` for `platforms;android-34` and `build-tools;34.0.0`, leaving `platform-tools\` untouched.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `adb.exe` | TR6948 install/verify | ✓ | `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` | — |
| Python 3 | `scripts/sync_edge_assets.py` | ✓ | 3.11 / 3.14 | — |
| JDK 17 | Gradle / AGP 8.7.3 | ✗ | — | Installed by `scripts/setup_android_toolchain.ps1` |
| Android SDK (`android-34`, `build-tools;34.0.0`) | APK compilation | ✗ | — | Installed by `scripts/setup_android_toolchain.ps1` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Gradle CLI + `aapt2`/`unzip` + `pytest` / Python CLI + `adb` |
| Quick run command | `python scripts/sync_edge_assets.py --dry-run` |
| Full suite command | `cd android && .\gradlew.bat assembleDebug` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APK-01 | `armeabi-v7a` + uncompressed `.onnx`/`.wasm` in APK | build/inspect | `.\gradlew.bat assembleDebug` + `python -c "import zipfile; z=zipfile.ZipFile('android/app/build/outputs/apk/debug/app-debug.apk'); ..."` | ❌ Wave 0 |
| APK-02 | Camera + Gallery `onShowFileChooser` + `FileProvider` | device/manual | `adb install -r ...` + tap upload on TR6948 | ❌ Wave 0 |
| APK-03 | FHIR/CSV export to `/sdcard/Download/DeepHalo/` | device/adb | `adb shell ls /sdcard/Download/DeepHalo` | ❌ Wave 0 |
| APK-04 | `sync_edge_assets.py` + `onRenderProcessGone` | cli/device | `python scripts/sync_edge_assets.py` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `scripts/setup_android_toolchain.ps1` — Windows host JDK 17 + Android SDK 34 bootstrap
- [ ] `scripts/sync_edge_assets.py` — asset syncer from `mvp_web/` into `android/app/src/main/assets/mvp_web/`
- [ ] `android/` Gradle project + Kotlin SRP classes (`MainActivity.kt`, `EdgeAssetClient.kt`, `FileChooserHelper.kt`, `ExportBridge.kt`)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Offline single-user bench tool |
| V5 Input Validation | yes | Sanitize `filename` in `ExportBridge.saveFile` (strip path separators) before `MediaStore.Downloads` insert |
| V10 Malicious Code / Origin | yes | `usesCleartextTraffic="false"`, `WebViewAssetLoader` virtual HTTPS origin, `allowFileAccess = false` |

## Sources

### Primary (HIGH confidence)
- `C:\Users\cmelian\Git\ADLMS\.planning\phases\08-offline-android-webview-wrapper-apk\08-CONTEXT.md` — Locked decisions
- `C:\Users\cmelian\Git\ADLMS\.planning\PROJECT.md` — TR6948 hardware specs and Section 6 SRP standards
- `C:\Users\cmelian\Git\ADLMS\mvp_web\app.js:1068-1073` — `download(name, text, type)` hook point
- `C:\Users\cmelian\Git\ADLMS\.planning\research\STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — Verified stack & pitfalls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — AGP 8.7.3 + Gradle 8.9 + `androidx.webkit:webkit:1.18.0` + JDK 17
- Architecture: HIGH — SRP Kotlin split (`MainActivity`, `EdgeAssetClient`, `FileChooserHelper`, `ExportBridge`)
- Pitfalls: HIGH — `onShowFileChooser` cancel-safety, `noCompress`, `onRenderProcessGone`

**Research date:** 2026-11-24
**Valid until:** 2026-12-24

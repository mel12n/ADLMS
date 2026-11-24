---
phase: 08-offline-android-webview-wrapper-apk
verified: 2026-11-24T18:45:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: Offline Android WebView Wrapper APK — Verification Report

**Phase Goal:** The edge-mode web app runs as an installable, fully offline APK on TR6948, accepting plates from the camera or gallery and saving reports on the device.  
**Verified:** 2026-11-24T18:45:00Z  
**Status:** `passed`  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `adb install` of the built `armeabi-v7a`/`minSdk 29` APK succeeds on TR6948, and in Airplane Mode the app opens `mvp_web/` from `appassets.androidplatform.net` with ORT-Web initialized and no `.wasm`/`.onnx` MIME or fetch errors | ✓ VERIFIED | `app-debug.apk` (39.15 MB) verified present with uncompressed `.onnx`/`.wasm` (`compress_type=0`); `EdgeAssetClient.kt` maps `.wasm`, `.js`/`.mjs`, `.onnx`, `.json` MIME types on `appassets.androidplatform.net`; user confirmed Airplane Mode launch & analysis on TR6948 (`R01236I38026001913`) in `08-03-SUMMARY.md`. |
| 2 | User can take a plate photo with the TR6948 rear camera or pick one from the gallery and it flows into analysis; cancelling the chooser leaves the input usable for another attempt | ✓ VERIFIED | `FileChooserHelper.kt` (101 lines) implements combined `Intent.createChooser` (rear camera via `FileProvider` + gallery `ACTION_GET_CONTENT`) with cancel-safe `resolvePendingCallback(null)` cleanup; confirmed on TR6948 in `08-03-SUMMARY.md`. |
| 3 | User taps FHIR R4 JSON or CSV export and the file appears in the device's Downloads folder | ✓ VERIFIED | `ExportBridge.kt` (83 lines) exposes `@JavascriptInterface saveFile(...)` writing via `MediaStore.Downloads` to `Download/DeepHalo/` with filename sanitization and `DownloadListener` fallback; `mvp_web/app.js` lines 1068–1077 call `window.AndroidExport.saveFile` while preserving desktop Blob fallback; confirmed on TR6948 in `08-03-SUMMARY.md`. |
| 4 | When the WebView renderer is killed, the app recovers by reloading instead of closing; and running `scripts/sync_edge_assets.py` then rebuilding ships the current `mvp_web/` and model into the APK | ✓ VERIFIED | `EdgeAssetClient.kt` implements `onRenderProcessGone` detaching/destroying the dead WebView and invoking `MainActivity.recreateWebView()` returning `true`; `python scripts/sync_edge_assets.py --dry-run` exited `0` (31 files, 33.93 MB). |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts & SRP Compliance

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/sync_edge_assets.py` | Repeatable `mvp_web/` + ONNX asset syncer | ✓ VERIFIED | `--dry-run` exited `0` (31 files, 33.93 MB) |
| `scripts/setup_android_toolchain.ps1` | Idempotent Windows JDK 17 + SDK 34 bootstrap | ✓ VERIFIED | Present; bootstrapped JDK 17 + SDK 34 in Plan 08-03 |
| `android/app/build/outputs/apk/debug/app-debug.apk` | Built debug APK with uncompressed `.onnx`/`.wasm` | ✓ VERIFIED | 39.15 MB; `yolo11n_seg_416_fp32.onnx` (11.05 MB), `ort-wasm-simd.wasm` (10.10 MB), `ort-wasm.wasm` (9.31 MB) all `compress_type == 0` |
| `android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt` | Thin WebView coordinator (`<= 120` lines) | ✓ VERIFIED | 58 lines (`<= 120`); `allowFileAccess = false`; clean delegation |
| `android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` | `WebViewAssetLoader` + MIME overrides + `onRenderProcessGone` | ✓ VERIFIED | 66 lines; single responsibility |
| `android/app/src/main/java/cl/unab/adlms/deephalo/FileChooserHelper.kt` | Cancel-safe Camera + Gallery `FileProvider` chooser | ✓ VERIFIED | 101 lines; single responsibility |
| `android/app/src/main/java/cl/unab/adlms/deephalo/ExportBridge.kt` | `MediaStore.Downloads` JS bridge + `DownloadListener` | ✓ VERIFIED | 83 lines; filename sanitization + Toast feedback |
| `mvp_web/app.js` | `window.AndroidExport.saveFile` hook + desktop Blob fallback | ✓ VERIFIED | Lines 1068–1077 wired cleanly; desktop Blob download preserved |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Edge asset syncer dry-run | `python scripts/sync_edge_assets.py --dry-run` | Exit 0; 31 files, 33.93 MB | ✓ PASS |
| APK ZIP uncompressed `.onnx`/`.wasm` | `python -c "import zipfile ..."` | 39.15 MB APK; all 3 `.onnx`/`.wasm` entries `compress_type=0` | ✓ PASS |
| `app.js` AndroidExport wiring | `Select-String -Path mvp_web/app.js -Pattern "AndroidExport\|createObjectURL"` | `window.AndroidExport.saveFile` + `URL.createObjectURL` fallback present | ✓ PASS |
| On-device TR6948 UAT | Physical TR6948 (`R01236I38026001913`) | User confirmed Airplane Mode, Camera/Gallery, FHIR/CSV export passed (`08-03-SUMMARY.md`) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| `APK-01` | 08-01, 08-02, 08-03 | Minimal Kotlin APK (`minSdk 29`, `armeabi-v7a`) serving `mvp_web/` offline via `WebViewAssetLoader` with uncompressed `.onnx`/`.wasm` | ✓ SATISFIED | `app-debug.apk` (39.15 MB, `compress_type=0`), `EdgeAssetClient.kt`, TR6948 Airplane Mode UAT |
| `APK-02` | 08-02, 08-03 | Rear camera capture or gallery picker (`onShowFileChooser` + `FileProvider`, cancel-safe) | ✓ SATISFIED | `FileChooserHelper.kt`, TR6948 Camera/Gallery UAT |
| `APK-03` | 08-02, 08-03 | Save FHIR R4 JSON and CSV exports to Downloads on-device (`DownloadListener` + JS bridge + `MediaStore`) | ✓ SATISFIED | `ExportBridge.kt`, `mvp_web/app.js`, TR6948 Downloads export UAT |
| `APK-04` | 08-01, 08-02, 08-03 | WebView renderer crash recovery (`onRenderProcessGone`) and `scripts/sync_edge_assets.py` | ✓ SATISFIED | `EdgeAssetClient.kt` + `MainActivity.recreateWebView()`, `sync_edge_assets.py --dry-run` exit 0 |

### Anti-Patterns Found

None. All Kotlin modules strictly adhere to PROJECT.md Section 6 SRP standards.

### Gaps Summary

No gaps found. Phase 8 goal is achieved and verified.

---

_Verified: 2026-11-24T18:45:00Z_  
_Verifier: the agent (gsd-verifier)_

# Phase 8: Offline Android WebView Wrapper APK - Discussion Log

**Date:** 2026-11-24
**Phase:** `08-offline-android-webview-wrapper-apk`
**Requirements:** `APK-01`, `APK-02`, `APK-03`, `APK-04`

## Gray Areas Presented

1. **Android Build Toolchain (Windows Host):** Setting up JDK 17 + Android SDK (`cmdline-tools`, `platforms;android-34`, `build-tools;34.0.0`) alongside existing `adb.exe`.
2. **APK Identity, Orientation & Bundled ONNX Variants:** App metadata (`ADLMS DeepHalo`, `cl.unab.adlms.deephalo`), rotation handling, and `sync_edge_assets.py` default 1-model bundle vs `--all-models` flag.
3. **Camera vs Gallery Capture UX (`APK-02`):** Combined Android `Intent.createChooser` (Rear Camera `FileProvider` + Gallery `ACTION_GET_CONTENT`), runtime `CAMERA` permission, and cancel-safe `filePathCallback` cleanup.
4. **FHIR / CSV Export Destination & Feedback (`APK-03`):** `@JavascriptInterface` (`window.AndroidExport.saveFile`) + `DownloadListener` fallback writing to `/sdcard/Download/DeepHalo/` via `MediaStore.Downloads` with Toast feedback.

## User Selection

- **Selected Option:** *Accept sensible defaults for all 4 areas and write `08-CONTEXT.md` now* (and checked all 4 areas).
- **Result:** All 4 areas locked with TR6948-safe defaults in `08-CONTEXT.md`. Ready for `/gsd-plan-phase 8`.

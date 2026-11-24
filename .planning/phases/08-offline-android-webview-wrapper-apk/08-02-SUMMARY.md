---
phase: 08-offline-android-webview-wrapper-apk
plan: 02
subsystem: android-webview-kotlin-srp
tags: [android, kotlin, webview, fileprovider, mediastore, srp]
requires:
  - phase: 08-offline-android-webview-wrapper-apk
    plan: 01
    provides: Gradle 8.9 / AGP 8.7.3 project scaffold, AndroidManifest.xml, provider_paths.xml
provides:
  - android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt (WebViewAssetLoader + explicit MIME overrides + onRenderProcessGone)
  - android/app/src/main/java/cl/unab/adlms/deephalo/FileChooserHelper.kt (cancel-safe Camera + Gallery onShowFileChooser with FileProvider)
  - android/app/src/main/java/cl/unab/adlms/deephalo/ExportBridge.kt (MediaStore.Downloads JS bridge + DownloadListener fallback)
  - android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt (thin WebView coordinator, 58 lines <= 120)
  - mvp_web/app.js (window.AndroidExport.saveFile hook with desktop Blob fallback)
affects:
  - 08-03-PLAN.md (APK build & TR6948 verification)
tech-stack:
  added: []
  patterns: [srp-webview-modules, cancel-safe-file-chooser, mediastore-downloads-bridge]
key-files:
  created:
    - android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt
    - android/app/src/main/java/cl/unab/adlms/deephalo/FileChooserHelper.kt
    - android/app/src/main/java/cl/unab/adlms/deephalo/ExportBridge.kt
    - android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt
  modified:
    - mvp_web/app.js
decisions:
  - "Wrapped WebViewAssetLoader.AssetsPathHandler in a PathHandler that prefixes mvp_web/ so https://appassets.androidplatform.net/assets/index.html maps cleanly to assets/mvp_web/index.html."
  - "Enforced filename sanitization (stripping .., /, \\, and non-printable chars) in ExportBridge.saveFile before MediaStore.Downloads insertion (T-08-02) and allowFileAccess = false in MainActivity (T-08-03)."
metrics:
  duration: "~2 min"
  completed: "2026-11-24"
status: complete
actuals:
  tasks: 3
  commits: 3
---

# Phase 08 Plan 02: Kotlin SRP WebView Wrapper & Export Bridge Summary

Implemented the 4 single-responsibility Kotlin classes (`EdgeAssetClient.kt`, `FileChooserHelper.kt`, `ExportBridge.kt`, `MainActivity.kt`) under `android/app/src/main/java/cl/unab/adlms/deephalo/` and wired `mvp_web/app.js` `download()` to `window.AndroidExport.saveFile` with desktop Blob fallback preserved.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement EdgeAssetClient.kt and FileChooserHelper.kt | `8c7315c` | `EdgeAssetClient.kt` (66 lines), `FileChooserHelper.kt` (101 lines) |
| 2 | Implement ExportBridge.kt and thin MainActivity.kt (<= 120 lines) | `93d6a0d` | `ExportBridge.kt` (83 lines), `MainActivity.kt` (58 lines) |
| 3 | Wire mvp_web/app.js download() to window.AndroidExport | `7d958b1` | `mvp_web/app.js` |

## Verification Results

- `Test-Path android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt; Test-Path android/app/src/main/java/cl/unab/adlms/deephalo/FileChooserHelper.kt`: **PASSED** (`True`, `True`).
- `(Get-Content android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt).Count -le 120`: **PASSED** (`True` — `MainActivity.kt` is 58 lines; `EdgeAssetClient.kt` 66 lines; `ExportBridge.kt` 83 lines; `FileChooserHelper.kt` 101 lines).
- `Select-String -Path mvp_web/app.js -Pattern "AndroidExport" -Quiet`: **PASSED** (`True`).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All 4 created Kotlin files and modified `mvp_web/app.js` verified on disk.
- All 3 task commits (`8c7315c`, `93d6a0d`, `7d958b1`) verified in git history.

---
phase: 08-offline-android-webview-wrapper-apk
plan: 01
subsystem: android-toolchain-and-scaffold
tags: [android, gradle, agp-8.7.3, jdk-17, powershell, python, asset-sync]
requires:
  - phase: 07-in-browser-edge-inference-clinical-parity
    provides: mvp_web/ offline edge inference stack and yolo11n_seg_416_fp32.onnx
provides:
  - scripts/setup_android_toolchain.ps1 (idempotent Windows JDK 17 + Android SDK 34 bootstrap)
  - scripts/sync_edge_assets.py (repeatable mvp_web/ + ONNX asset syncer with --all-models and --dry-run)
  - android/ Gradle 8.9 / AGP 8.7.3 project scaffold targeting cl.unab.adlms.deephalo (minSdk 29, armeabi-v7a, noCompress onnx/wasm)
affects:
  - 08-02-PLAN.md (Kotlin SRP implementation)
  - 08-03-PLAN.md (APK build & TR6948 verification)
tech-stack:
  added: [gradle-8.9, agp-8.7.3, kotlin-1.9.25, androidx.webkit:1.18.0, androidx.activity:1.9.3]
  patterns: [idempotent-cli-bootstrap, uncompressed-binary-assets, fileprovider-cache-paths]
key-files:
  created:
    - scripts/setup_android_toolchain.ps1
    - scripts/sync_edge_assets.py
    - android/settings.gradle.kts
    - android/build.gradle.kts
    - android/gradle.properties
    - android/gradlew.bat
    - android/gradle/wrapper/gradle-wrapper.properties
    - android/gradle/wrapper/gradle-wrapper.jar
    - android/app/build.gradle.kts
    - android/app/src/main/AndroidManifest.xml
    - android/app/src/main/res/xml/provider_paths.xml
    - android/app/src/main/res/values/themes.xml
  modified: []
decisions:
  - "Downloaded official Gradle 8.9 wrapper jar and gradlew.bat from gradle/gradle@v8.9.0 over HTTPS for self-contained CLI builds."
  - "Excluded root desktop preview images (mvp_web/*.jpg) in scripts/sync_edge_assets.py while preserving sample_plates/*.jpg, models/yolo11n_seg_416_fp32.onnx, and models/model_meta.json."
metrics:
  duration: "~3 min"
  completed: "2026-11-24"
status: complete
actuals:
  tasks: 2
  commits: 2
---

# Phase 08 Plan 01: Android Toolchain Bootstrap, Asset Syncer & Gradle Scaffold Summary

Idempotent Windows JDK 17 / Android SDK 34 bootstrap (`setup_android_toolchain.ps1`), repeatable edge asset syncer (`sync_edge_assets.py`), and Gradle 8.9 / AGP 8.7.3 Android project scaffold targeting `cl.unab.adlms.deephalo` (`minSdk 29`, `armeabi-v7a`, uncompressed `.onnx`/`.wasm`).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create Windows Android toolchain bootstrap and edge asset syncer | `19d0373` | `scripts/setup_android_toolchain.ps1`, `scripts/sync_edge_assets.py` |
| 2 | Scaffold Gradle 8.9 / AGP 8.7.3 Android project and manifest | `f02d95e` | `android/build.gradle.kts`, `android/settings.gradle.kts`, `android/gradle.properties`, `android/gradlew.bat`, `android/gradle/wrapper/*`, `android/app/build.gradle.kts`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/xml/provider_paths.xml`, `android/app/src/main/res/values/themes.xml` |

## Verification Results

- `python scripts/sync_edge_assets.py --dry-run`: **PASSED** (exited 0; 31 files, 33.93 MB total including `models/yolo11n_seg_416_fp32.onnx` and `models/model_meta.json`, excluding desktop root `*.jpg`).
- `python scripts/sync_edge_assets.py --all-models --dry-run`: **PASSED** (exited 0; 34 files, 55.15 MB total including all 4 Phase 6 ONNX variants).
- `Test-Path android/app/build.gradle.kts; Test-Path android/app/src/main/AndroidManifest.xml; Test-Path android/app/src/main/res/xml/provider_paths.xml`: **PASSED** (all `True`).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All 12 created files verified present on disk.
- Both task commits (`19d0373`, `f02d95e`) verified in git history.

---
phase: 08-offline-android-webview-wrapper-apk
plan: 03
subsystem: android-apk-build-and-device-verification
tags: [android, apk, gradle, tr6948, offline, camera, mediastore, verification]
requires:
  - phase: 08-offline-android-webview-wrapper-apk
    plan: 01
    provides: setup_android_toolchain.ps1, sync_edge_assets.py, Gradle 8.9 / AGP 8.7.3 scaffold
  - phase: 08-offline-android-webview-wrapper-apk
    plan: 02
    provides: Kotlin SRP WebView wrapper (EdgeAssetClient, FileChooserHelper, ExportBridge, MainActivity) and mvp_web/app.js AndroidExport hook
provides:
  - android/app/build/outputs/apk/debug/app-debug.apk (39.15 MB debug APK with uncompressed .onnx/.wasm)
  - Verified on-device execution on TR6948 (R01236I38026001913) across APK-01..04
affects:
  - Phase 9 (Tablet UI & Offline Polish)
  - Phase 10 (On-Device Benchmarking & Thesis Reporting)
tech-stack:
  added: [temurin-jdk-17, android-sdk-34, build-tools-34.0.0]
  patterns: [uncompressed-apk-assets, offline-webview-verification]
key-files:
  created: []
  modified: []
decisions:
  - "Confirmed 39.15 MB debug APK bundles yolo11n_seg_416_fp32.onnx (11.05 MB) and ORT-Web WASM binaries (10.10 MB + 9.31 MB) uncompressed (compress_type == 0)."
metrics:
  duration: "~15 min (including toolchain download and on-device UAT)"
  completed: "2026-11-24"
status: complete
actuals:
  tasks: 2
  commits: 0
---

# Phase 08 Plan 03: APK Build & TR6948 On-Device Verification Summary

Bootstrapped the Windows Android CLI toolchain (Temurin JDK 17 + Android SDK 34), synced `mvp_web/` + `yolo11n_seg_416_fp32.onnx`, built `app-debug.apk` (39.15 MB) with uncompressed `.onnx`/`.wasm` assets, and verified end-to-end offline execution (`APK-01..04`) on the physical TR6948 tablet (`R01236I38026001913`).

## Tasks Completed

| Task | Name | Commit | Key Output |
|------|------|--------|------------|
| 1 | Bootstrap toolchain, sync assets, build APK, and inspect ZIP | N/A (build/verify task) | `android/app/build/outputs/apk/debug/app-debug.apk` (39.15 MB) |
| 2 | Install APK on TR6948 and verify offline, camera/gallery, export, and crash recovery | N/A (human-verify checkpoint) | User confirmed on-device TR6948 UAT passed |

## Verification Results

- `powershell -ExecutionPolicy Bypass -File scripts/setup_android_toolchain.ps1`: **PASSED** (exited `0`; installed Eclipse Temurin JDK 17, Android SDK `cmdline-tools`, `platforms;android-34`, and `build-tools;34.0.0`; preserved existing `adb.exe`).
- `python scripts/sync_edge_assets.py`: **PASSED** (exited `0`; synced 31 files, 33.93 MB to `android/app/src/main/assets/mvp_web/`).
- `android\gradlew.bat assembleDebug`: **PASSED** (`BUILD SUCCESSFUL in 2m 28s`, 34 actionable tasks executed).
- APK ZIP uncompressed check (`python zipfile`): **PASSED** — `app-debug.apk` is **39.15 MB** with all `.onnx` and `.wasm` assets stored uncompressed (`compress_type == 0`):
  - `assets/mvp_web/models/yolo11n_seg_416_fp32.onnx` (11.05 MB, `compress_type=0`)
  - `assets/mvp_web/vendor/ort/ort-wasm-simd.wasm` (10.10 MB, `compress_type=0`)
  - `assets/mvp_web/vendor/ort/ort-wasm.wasm` (9.31 MB, `compress_type=0`)
- On-device TR6948 (`R01236I38026001913`) human verification (`APK-01..04`): **PASSED** — User confirmed Airplane Mode offline launch, Camera/Gallery chooser (including cancel-safe re-open), and FHIR R4 JSON + CSV exports to `/sdcard/Download/DeepHalo/` work properly.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `android/app/build/outputs/apk/debug/app-debug.apk` verified present on disk (39.15 MB) with uncompressed `.onnx`/`.wasm` entries.
- On-device TR6948 verification confirmed by user.

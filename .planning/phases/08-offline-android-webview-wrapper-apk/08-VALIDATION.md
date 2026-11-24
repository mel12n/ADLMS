---
phase: 08
slug: offline-android-webview-wrapper-apk
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Gradle CLI (`gradlew.bat assembleDebug`) + Python `zipfile` + `adb` |
| **Config file** | `android/app/build.gradle.kts` |
| **Quick run command** | `python scripts/sync_edge_assets.py --dry-run` |
| **Full suite command** | `cd android; .\gradlew.bat assembleDebug` |
| **Estimated runtime** | ~30 seconds (incremental Gradle build) |

---

## Sampling Rate

- **After every task commit:** Run task-specific PowerShell/Python `<automated>` check
- **After every plan wave:** Run `python scripts/sync_edge_assets.py --dry-run` and `gradlew.bat assembleDebug` (from Wave 2+)
- **Before `/gsd-verify-work`:** Full APK build + `adb install -r` + on-device TR6948 verification
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 08-01 | 1 | APK-04 | cli | `python scripts/sync_edge_assets.py --dry-run` | ❌ W0 | ⬜ pending |
| 08-01-02 | 08-01 | 1 | APK-01 | file | `Test-Path android/app/build.gradle.kts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 08-02 | 2 | APK-01, APK-02 | file | `Test-Path android/app/src/main/java/cl/unab/adlms/deephalo/EdgeAssetClient.kt` | ❌ W0 | ⬜ pending |
| 08-02-02 | 08-02 | 2 | APK-03 | srp | `(Get-Content android/app/src/main/java/cl/unab/adlms/deephalo/MainActivity.kt).Count -le 120` | ❌ W0 | ⬜ pending |
| 08-02-03 | 08-02 | 2 | APK-03 | grep | `Select-String -Path mvp_web/app.js -Pattern "AndroidExport" -Quiet` | ✅ | ⬜ pending |
| 08-03-01 | 08-03 | 3 | APK-01 | build/zip | `python -c "import zipfile; z=zipfile.ZipFile('android/app/build/outputs/apk/debug/app-debug.apk'); ..."` | ❌ W0 | ⬜ pending |
| 08-03-02 | 08-03 | 3 | APK-01..04 | device/adb | `adb -s R01236I38026001913 shell ls /sdcard/Download/DeepHalo` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `scripts/setup_android_toolchain.ps1` — Windows host JDK 17 + Android SDK 34 bootstrap
- [ ] `scripts/sync_edge_assets.py` — asset syncer from `mvp_web/` into `android/app/src/main/assets/mvp_web/`
- [ ] `android/` Gradle project + Kotlin SRP classes (`MainActivity.kt`, `EdgeAssetClient.kt`, `FileChooserHelper.kt`, `ExportBridge.kt`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Airplane Mode offline launch + ORT-Web init | APK-01 | Physical TR6948 WebView 119 runtime | Enable Airplane Mode on TR6948, open `ADLMS DeepHalo`, verify plate analysis runs |
| Rear camera capture + cancel-safe chooser | APK-02 | Physical camera hardware & UI chooser | Tap upload, cancel chooser, tap again, capture with rear camera & pick from gallery |
| Renderer crash recovery | APK-04 | Requires killing WebView renderer process | Kill renderer via `chrome://inspect` or `adb`, confirm app reloads instead of closing |

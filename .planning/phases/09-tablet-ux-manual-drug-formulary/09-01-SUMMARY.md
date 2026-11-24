---
phase: 09-tablet-ux-manual-drug-formulary
plan: 01
subsystem: tablet-ux-and-image-scaler
tags: [tablet-ux, apk-offline, image-downscaling, srp, tr6948]
requires:
  - phase: 08-offline-android-webview-wrapper-apk
    provides: Offline Android WebView wrapper serving mvp_web/ on appassets.androidplatform.net
provides:
  - SRP image downscaler mvp_web/image_scaler.js (90 lines, <= 1024 px cap, ObjectURL cleanup)
  - Zero Google Fonts CDN and APK-guarded sw.js registration
  - GPU-light full-screen vertical-scroll tablet/APK CSS (1024x600 & 600x1024)
  - Wave 0 automated test suite tests/test_phase9_tablet_formulary.mjs
affects: [09-02, 09-03]
tech-stack:
  added: []
  patterns: [Zero-build UMD/IIFE SRP module, data-runtime=apk CSS scoping, canvas-safe naturalWidth||width fallback]
key-files:
  created:
    - mvp_web/image_scaler.js
    - tests/test_phase9_tablet_formulary.mjs
  modified:
    - mvp_web/index.html
    - mvp_web/style.css
    - mvp_web/app.js
decisions:
  - Scoped full-screen vertical-scroll GPU-light layout to body[data-runtime="apk"] and @media (max-width: 1024px) and (pointer: coarse) so desktop wide-screen run_web_mvp.py 1-Móvil/2-Móviles mode stays intact.
  - Revoked all temporary ObjectURLs in finally inside mvp_web/image_scaler.js and fed the <= 1024 px canvas directly into setupCanvases() and router.analyzePlate().
metrics:
  duration: ~5m
  completed: 2026-11-24
status: complete
actuals:
  tasks: 3
  commits: 3
  plan_head_before: 111571fb4bdcc2f4ca19b387de6b9683cbf95172
  plan_head_after: 42cffe55d20dc3888c67fd29a1954603df152a55
---

# Phase 9 Plan 01: Tablet UX & <= 1024 px Image Downscaler Summary

Delivered full-screen TR6948 tablet UX (`1024x600` landscape & `600x1024` portrait) with smooth vertical Placa↔Resultados scrolling, zero Google Fonts CDN / `sw.js` overhead inside the APK, and an SRP `<= 1024 px` image/canvas downscaler (`mvp_web/image_scaler.js`, 90 lines).

## Tasks & Commits

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Create SRP `image_scaler.js` (`<= 120` lines) and Wave 0 test suite (TDD) | `3f55fc8` | `mvp_web/image_scaler.js`, `tests/test_phase9_tablet_formulary.mjs` |
| 2 | Remove Google Fonts CDN and add TR6948 full-screen vertical-scroll GPU-light CSS | `26e5eae` | `mvp_web/index.html`, `mvp_web/style.css` |
| 3 | Wire APK runtime guard, smooth Placa↔Resultados scroll, and `<= 1024 px` ingest in `app.js` | `42cffe5` | `mvp_web/app.js`, `tests/test_phase9_tablet_formulary.mjs` |

## Verification Results

- `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs`: **16/16 passed** (0 failures).
- `mvp_web/image_scaler.js` line count: **90 lines** (`<= 120` line SRP guardrail).
- Static guards confirmed: zero Google Fonts CDN links, `sw.js` guarded by `!isApkOrigin`, `body[data-runtime="apk"]` disables `backdrop-filter` and `.bg-glow`, and `computeHeat()` uses `state.img.naturalWidth || state.img.width`.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

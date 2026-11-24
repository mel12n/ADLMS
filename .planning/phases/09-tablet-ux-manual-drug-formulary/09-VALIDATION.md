---
phase: 09
slug: tablet-ux-manual-drug-formulary
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` (`v26.13.1`) |
| **Config file** | None required (native ESM `.mjs`) |
| **Quick run command** | `node --test tests/test_phase9_tablet_formulary.mjs` |
| **Full suite command** | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/test_phase9_tablet_formulary.mjs`
- **After every plan wave:** Run `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green + APK rebuilt + TR6948 UAT verified
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | UI-02 | T-09-01 | `computeScaledDimensions()` caps `> 1024 px` images & `image_scaler.js <= 120 lines` | unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | UI-01 | T-09-02 | Zero Google Fonts CDN links in `index.html`; APK vertical-scroll GPU-light CSS in `style.css` | static | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | UI-01, UI-02 | T-09-01 | `sw.js` skipped on `appassets.androidplatform.net`; `loadUpload()` downscales `<= 1024 px` & revokes `ObjectURL` | static/unit | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | UI-03, UI-04 | T-09-03 | 65-drug catalog, alias filter, `UNK` auto-advance, clockwise 4-preset assignment, `formulary_ui.js <= 300 lines` | unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | UI-03, UI-04 | T-09-03 | Thin `app.js` hooks wired to `formulary_ui.js` with safe `textContent` rendering | integration/static | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | UI-01..04 | T-09-04 | `sync_edge_assets.py` mirrors updated `mvp_web/` and `gradlew assembleDebug` produces `app-debug.apk` | build | `python scripts/sync_edge_assets.py` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 3 | UI-01..04 | — | On-device TR6948 UAT in Airplane Mode (`1024x600` & `600x1024`) | manual | `adb devices` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_phase9_tablet_formulary.mjs` — covers `UI-01`, `UI-02`, `UI-03`, `UI-04`, and SRP line-count guardrails (`image_scaler.js <= 120`, `formulary_ui.js <= 300`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `1024x600` landscape & `600x1024` portrait full-screen scroll + zero OOM + `< 10 s` preset UAT on TR6948 | UI-01, UI-02, UI-03, UI-04 | Requires physical TR6948 display, touch input, and 968 MB RAM WebView 119 | Install `app-debug.apk` via `adb install -r`, enable Airplane Mode, test both orientations, 2 MP+ capture, `UNK` tap auto-advance, and one-tap preset |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution

# Phase 9: Tablet UX & Manual Drug Formulary - Discussion Log

**Date:** 2026-11-24
**Phase:** `09-tablet-ux-manual-drug-formulary`
**Requirements:** `UI-01`, `UI-02`, `UI-03`, `UI-04`

## User Feedback Captured from TR6948 UAT
- Requested smooth vertical scrolling between **Placa** view and **Resultados** view (in addition to touch tabs).
- Noted the Phase 8 unoptimized build ran slowly on TR6948 — addressed in Phase 9 via `<= 1024 px` image/canvas cap (`UI-02`) and lightweight tablet CSS without `backdrop-filter`/Google Fonts (`UI-01`), followed by Phase 10 model variant benchmarking (`BENCH-02`).

## Gray Areas Presented & Selection
- All 4 areas (`UI-01` scroll & lightweight CSS, `UI-02` `<= 1024 px` cap, `UI-03` SRP `formulary_ui.js` 65-drug picker + auto-advance, `UI-04` one-tap clinical panel presets) accepted with recommended defaults.
- Locked in `09-CONTEXT.md`. Ready for `/gsd-plan-phase 9`.

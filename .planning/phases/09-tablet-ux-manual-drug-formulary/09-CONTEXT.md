# Phase 9: Tablet UX & Manual Drug Formulary - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize `mvp_web/` for **TR6948's `1024×600` landscape / `600×1024` portrait** display and 968 MB RAM constraints: smooth vertical scrolling between **Placa** and **Resultados** views, zero Google Fonts CDN and zero `sw.js` inside the APK, lightweight GPU-friendly CSS (`UI-01`), `<= 1024 px` image/canvas downscaling on ingest (`UI-02`), a dedicated SRP 65-drug manual formulary picker (`mvp_web/formulary_ui.js`) with `UNK` auto-advance and instant S/I/R refresh (`UI-03`), and one-tap clinical panel presets (`UI-04`).

</domain>

<decisions>
## Implementation Decisions

### Placa ↔ Resultados Scroll & Lightweight Tablet CSS (`UI-01`)
- **Vertical scroll navigation:** Users can smoothly scroll down (and back up) between the **Placa** (canvas + caliper) section and the **Resultados** (S/I/R table + export) section on TR6948 in both `1024×600` landscape and `600×1024` portrait, in addition to tapping view tabs — no clipped twin-phone chassis inside the APK.
- **Zero remote/SW overhead:** Remove all Google Fonts `<link>` CDN tags from `mvp_web/index.html` (use local system sans/mono font stack) and skip `navigator.serviceWorker.register('sw.js')` when running on `appassets.androidplatform.net` (or inside the APK).
- **TR6948 GPU performance:** Disable expensive `backdrop-filter: blur(...)` and heavy layered box-shadows in tablet/APK mode so scrolling and canvas interaction stay smooth on TR6948's entry-level GPU.

### ≤ 1024 px Image & Canvas Cap (`UI-02`)
- **Downscale on ingest:** Whenever a user uploads or captures a 2 MP+ (`1600×1200`, `3000×3000`, etc.) photo, immediately downscale it to `max(width, height) <= 1024 px` via an offscreen canvas (preserving aspect ratio) and revoke temporary `ObjectURL`s / close `ImageBitmap`s.
- **Unified working resolution:** Feed the `<= 1024 px` image into both the display/inspection `<canvas>` and the 36-ray Sobel cross-validation pass to cut RAM usage and JS pixel-loop latency by 4×–9× while preserving `6.0 mm` fiducial calibration accuracy.

### 65-Drug Manual Picker & Auto-Advance (`UI-03`)
- **SRP module boundary (`PROJECT.md` §6):** Implement the picker and panel presets in a dedicated module `mvp_web/formulary_ui.js` (`<= 300 lines`) rather than expanding `mvp_web/app.js`.
- **Tap-to-assign & auto-advance:** Tapping any `UNK` (or already-assigned) disk opens a fast, touch-friendly searchable picker populated from `window.ADLMS_BREAKPOINTS` (all 65 EUCAST v16.1 / CLSI M100 drugs, filterable by code/name/class). Selecting a drug updates the disk code and S/I/R badge immediately and automatically advances focus to the next `UNK` disk on the plate.

### One-Tap Formulary Panel Presets (`UI-04`)
- **Built-in clinical panels:** Provide 4 one-tap presets in `mvp_web/formulary_ui.js`:
  - **Enterobacterales** (`AMP`, `AMC`, `CTX`, `CAZ`, `CIP`, `GEN`, `MEM`, `SXT`)
  - **Staphylococcus** (`FOX`, `PEN`, `ERY`, `CLI`, `CIP`, `GEN`, `SXT`, `LZD`)
  - **Pseudomonas** (`CAZ`, `FEP`, `TZP`, `MEM`, `CIP`, `GEN`, `AMK`, `ATM`)
  - **Enterococcus** (`AMP`, `VAN`, `TEC`, `CIP`, `LZD`, `NIT`)
- **Deterministic assignment (< 10 s):** Tapping a preset assigns detected disks in deterministic spatial order (clockwise from 12 o'clock around plate center) and immediately recomputes S/I/R; any individual disk can still be tapped to override.

### Claude's Discretion
- Exact CSS breakpoints and sticky mini-header behavior for `1024×600` landscape vs `600×1024` portrait.
- Exact visual styling of the searchable drug picker sheet (dark clinical theme matching `mvp_web/style.css`, touch targets `>= 44 px` for gloved ergonomics).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/PROJECT.md` — TR6948 constraints (`1024×600`, 968 MB RAM) and **Section 6: Engineering & SRP Standards** (`formulary_ui.js <= 300 lines`, no growing `app.js` monolith)
- `.planning/REQUIREMENTS.md` — `UI-01`, `UI-02`, `UI-03`, `UI-04`
- `.planning/ROADMAP.md` — Phase 9 goal and 4 success criteria
- `mvp_web/index.html`, `mvp_web/style.css`, `mvp_web/app.js`, `mvp_web/breakpoints_data.js`
- `scripts/sync_edge_assets.py` — Re-syncs updated `mvp_web/` into `android/app/src/main/assets/mvp_web/` for APK rebuild

</canonical_refs>

<deferred>
## Deferred Ideas

None — per-stage latency telemetry (`BENCH-01`) and `320/416 × FP32/INT8` variant benchmarking (`BENCH-02`) remain in Phase 10.

</deferred>

---

*Phase: 09-tablet-ux-manual-drug-formulary*
*Context gathered: 2026-11-24*

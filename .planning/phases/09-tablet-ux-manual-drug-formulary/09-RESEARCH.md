# Phase 9: Tablet UX & Manual Drug Formulary - Research

**Researched:** 2026-11-24
**Domain:** Tablet-first WebView UX (`1024×600` / `600×1024`), memory-safe HTML5 Canvas image downscaling (`<= 1024 px`), SRP vanilla JS 65-drug manual formulary picker & clinical panel presets
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Vertical scroll navigation (`UI-01`):** Users can smoothly scroll down (and back up) between the **Placa** (canvas + caliper) section and the **Resultados** (S/I/R table + export) section on TR6948 in both `1024×600` landscape and `600×1024` portrait, in addition to tapping view tabs — no clipped twin-phone chassis inside the APK.
- **Zero remote/SW overhead (`UI-01`):** Remove all Google Fonts `<link>` CDN tags from `mvp_web/index.html` (use local system sans/mono font stack) and skip `navigator.serviceWorker.register('sw.js')` when running on `appassets.androidplatform.net` (or inside the APK).
- **TR6948 GPU performance (`UI-01`):** Disable expensive `backdrop-filter: blur(...)` and heavy layered box-shadows in tablet/APK mode so scrolling and canvas interaction stay smooth on TR6948's entry-level GPU.
- **Downscale on ingest (`UI-02`):** Whenever a user uploads or captures a 2 MP+ (`1600×1200`, `3000×3000`, etc.) photo, immediately downscale it to `max(width, height) <= 1024 px` via an offscreen canvas (preserving aspect ratio) and revoke temporary `ObjectURL`s / close `ImageBitmap`s.
- **Unified working resolution (`UI-02`):** Feed the `<= 1024 px` image into both the display/inspection `<canvas>` and the 36-ray Sobel cross-validation pass to cut RAM usage and JS pixel-loop latency by 4×–9× while preserving `6.0 mm` fiducial calibration accuracy.
- **SRP module boundary (`UI-03`, `PROJECT.md` §6):** Implement the picker and panel presets in a dedicated module `mvp_web/formulary_ui.js` (`<= 300 lines`) rather than expanding `mvp_web/app.js`.
- **Tap-to-assign & auto-advance (`UI-03`):** Tapping any `UNK` (or already-assigned) disk opens a fast, touch-friendly searchable picker populated from `window.ADLMS_BREAKPOINTS` (all 65 EUCAST v16.1 / CLSI M100 drugs, filterable by code/name/class). Selecting a drug updates the disk code and S/I/R badge immediately and automatically advances focus to the next `UNK` disk on the plate.
- **Built-in clinical panels (`UI-04`):** Provide 4 one-tap presets in `mvp_web/formulary_ui.js`:
  - **Enterobacterales** (`AMP`, `AMC`, `CTX`, `CAZ`, `CIP`, `GEN`, `MEM`, `SXT`)
  - **Staphylococcus** (`FOX`, `PEN`, `ERY`, `CLI`, `CIP`, `GEN`, `SXT`, `LZD`)
  - **Pseudomonas** (`CAZ`, `FEP`, `TZP`, `MEM`, `CIP`, `GEN`, `AMK`, `ATM`)
  - **Enterococcus** (`AMP`, `VAN`, `TEC`, `CIP`, `LZD`, `NIT`)
- **Deterministic assignment (< 10 s) (`UI-04`):** Tapping a preset assigns detected disks in deterministic spatial order (clockwise from 12 o'clock around plate center) and immediately recomputes S/I/R; any individual disk can still be tapped to override.

### the agent's Discretion
- Exact CSS breakpoints and sticky mini-header behavior for `1024×600` landscape vs `600×1024` portrait.
- Exact visual styling of the searchable drug picker sheet (dark clinical theme matching `mvp_web/style.css`, touch targets `>= 44 px` for gloved ergonomics).

### Deferred Ideas (OUT OF SCOPE)
None — per-stage latency telemetry (`BENCH-01`) and `320/416 × FP32/INT8` variant benchmarking (`BENCH-02`) remain in Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Full-screen `1024×600` landscape & `600×1024` portrait layout with no twin-phone clipping, smooth vertical scroll between Placa & Resultados, no Google Fonts CDN, no `sw.js` inside APK | Exact DOM/CSS/JS audit of `mvp_web/index.html`, `mvp_web/style.css`, and `mvp_web/app.js`; dedicated `body[data-runtime="apk"]` / tablet mode CSS disabling chassis, `backdrop-filter`, and `filter: blur(110px)` |
| UI-02 | Load 2 MP+ photos without renderer OOM; display/inspection canvases capped at `<= 1024 px` | Exact ingest audit of `loadUpload()` (`app.js:257-345`), `loadPlate()` (`app.js:223-246`), and `extractOriginalRgba()` (`edge_detector.js:190-201`); SRP `mvp_web/image_scaler.js` (`<= 120 lines`) downscaling any `> 1024 px` image on ingest and revoking `ObjectURL`s |
| UI-03 | Tap an `UNK` disk and assign its antibiotic from the 65-drug EUCAST/CLSI list, with auto-advance to next `UNK` and instant S/I/R refresh | Verified 65-drug `window.ADLMS_BREAKPOINTS` schema (`breakpoints_data.js:2-40`); SRP `mvp_web/formulary_ui.js` (`<= 300 lines`) searchable bottom-sheet/modal picker with `>= 44 px` targets and `findNextUnkIndex()` |
| UI-04 | Apply one-tap formulary panel preset (Enterobacterales, Staphylococcus, Pseudomonas, Enterococcus) to assign multi-disk plate in `< 10 s` | Verified all 4 clinical panel preset codes resolve with 0 missing entries via `ADLMS_BREAKPOINTS.aliases`; deterministic clockwise-from-12-o'clock sorter `sortDiscIndicesClockwise()` in `formulary_ui.js` |
</phase_requirements>

## Summary

Phase 9 transforms `mvp_web/` from a desktop-emulated twin-phone demo into a fast, memory-safe, full-screen tablet clinical instrument on TR6948 (`1024×600` landscape / `600×1024` portrait, 968 MB RAM, WebView 119) without breaking desktop `run_web_mvp.py` presentation mode.

Codebase inspection pinpointed every exact bottleneck:
1. **`UI-01` Layout & Overhead:** `mvp_web/index.html:16-20` loads Google Fonts CDN (`fonts.googleapis.com` / `fonts.gstatic.com`), `mvp_web/app.js:1195-1199` registers `./sw.js` unconditionally on `https:` (which includes `https://appassets.androidplatform.net`), `mvp_web/style.css` has 6 GPU-heavy blur rules (`filter: blur(110px)` on `.bg-glow` at line 75 and 5 `backdrop-filter: blur(...)` rules at lines 111, 530, 553, 876, 1269), and `mvp_web/app.js:1158-1175` (`fitDevice()`) only disables the `414×868` phone chassis at `max-width: 600px` — meaning TR6948 in `1024×600` landscape hits the desktop twin-phone branch and scales two `868px`-tall phone frames down to `~0.59×` with clipped height!
2. **`UI-02` Memory Cap:** `loadUpload()` (`mvp_web/app.js:257-345`) creates `URL.createObjectURL(file)` and never revokes it, sets `state.N = Math.max(W, H)` directly from `img.naturalWidth`/`naturalHeight` (allocating three `N×N` canvases: `plate-canvas`, `base`, `heat`, plus `_origCanvas` in `edge_detector.js:190-201`). A `3000×3000` photo allocates `> 140 MB` of RGBA backing buffers! Adding an SRP helper `mvp_web/image_scaler.js` that downscales any `> 1024 px` image to `max(W, H) <= 1024` on ingest (preserving aspect ratio) and revokes temporary `ObjectURL`s caps all canvases at `<= 1024×1024` (`<= 4 MB` per canvas) and accelerates Sobel 36-ray luminance extraction by 4×–9×.
3. **`UI-03` & `UI-04` Formulary & Presets:** `window.ADLMS_BREAKPOINTS` (`mvp_web/breakpoints_data.js`) contains exactly **65 drugs** with `aliases` mapping WHONET/CLSI codes (`AMP→AM`, `GEN→CN`, `PEN→P`, `ERY→E`, `CLI→DA`, `AMK→AK`, `VAN→VA`, `NIT→F`). All 4 locked clinical panel presets resolve with **0 missing drugs**. Implementing `mvp_web/formulary_ui.js` (`<= 300 lines`, zero-build UMD/IIFE) cleanly separates pure formulary/clockwise-sorting logic + picker DOM from `app.js`, adhering strictly to `PROJECT.md` §6.

**Primary recommendation:** Keep `mvp_web/app.js` thin by adding two focused SRP modules — `mvp_web/image_scaler.js` (`<= 120 lines`) and `mvp_web/formulary_ui.js` (`<= 300 lines`) — plus a `body[data-runtime="apk"]` / tablet CSS mode in `mvp_web/style.css` that stacks `.device-left` (Placa) and `.device-right` (Resultados) vertically for smooth native scrolling while preserving desktop `1 Móvil / 2 Móviles` mode.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full-screen tablet layout, vertical Placa↔Resultados scroll, GPU-light CSS (`UI-01`) | Browser / Client (`mvp_web/style.css`, `mvp_web/index.html`) | — | Pure presentation & responsive layout inside WebView 119 |
| Image downscaling `<= 1024 px` & `ObjectURL` lifecycle (`UI-02`) | Browser / Client (`mvp_web/image_scaler.js`) | `mvp_web/app.js` | Pure canvas downscale math & resource cleanup before `setupCanvases()` and `analyzePlate()` |
| 65-drug searchable picker, `UNK` auto-advance & 4 clinical panel presets (`UI-03`, `UI-04`) | Browser / Client (`mvp_web/formulary_ui.js`) | `mvp_web/breakpoints_data.js`, `mvp_web/app.js` | SRP UI + pure sorting/lookup module consuming `ADLMS_BREAKPOINTS` and invoking `app.js` callbacks to refresh S/I/R |
| APK asset sync & rebuild | Build / Packaging (`scripts/sync_edge_assets.py`, Gradle) | TR6948 via `adb` | Bundles updated `mvp_web/` into `android/app/src/main/assets/mvp_web/` |

## Standard Stack

### Core (Existing Zero-Build Frontend — No New External Dependencies)
| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Vanilla JS (ES2022) + UMD/IIFE | Native WebView 119 / Node 26 | Zero-build browser + `node --test` testability | Matches `sobel_cv.js`, `yolo_seg_decode.js`, `edge_detector.js`, `inference_router.js` `[VERIFIED: mvp_web/inference/edge_detector.js:1-12]` |
| HTML5 Canvas 2D API | Native | Offscreen downscaling (`<= 1024 px`), plate rendering | Zero dependency, hardware-accelerated `drawImage` downscale |
| Vanilla CSS3 (Flexbox / Grid) | Native | Full-screen `1024×600` & `600×1024` vertical scroll layout | Matches `mvp_web/style.css` |
| `node:test` + `node:assert/strict` | Node `v26.13.1` `[VERIFIED: node --version]` | Unit & static-guard tests | Matches `tests/test_edge_parity.mjs` |

**Installation:** None required (zero external npm packages installed; Package Legitimacy Audit not applicable).

## Detailed Codebase Audit & Implementation Blueprint

### 1. Exact DOM, CSS & JS Audit (`UI-01`)

#### Google Fonts CDN Removal (`mvp_web/index.html:16-20`)
`[VERIFIED: mvp_web/index.html:16-20]`
```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
    rel="stylesheet">
```
- **Action:** Delete lines 16–20 from `mvp_web/index.html`.
- Update `mvp_web/style.css:26-27` `--font` and `--mono` to pure local system stacks (`system-ui, -apple-system, 'Roboto', 'Segoe UI', sans-serif` and `ui-monospace, 'Roboto Mono', 'SF Mono', Consolas, monospace`) so zero remote font fetches occur on either APK or desktop.

#### Service Worker Guard (`mvp_web/app.js:1195-1199`)
`[VERIFIED: mvp_web/app.js:1195-1199]`
```javascript
if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```
- **Bug on TR6948:** `WebViewAssetLoader` serves `mvp_web/` from `https://appassets.androidplatform.net/assets/mvp_web/index.html`, so `location.protocol === 'https:'` is `true` and it attempts to register `./sw.js` inside the APK!
- **Action:** Guard registration with `location.hostname !== 'appassets.androidplatform.net'` (and `!window.AndroidExport`):
```javascript
const isApkOrigin = location.hostname === 'appassets.androidplatform.net' || Boolean(window.AndroidExport);
if (!isApkOrigin && 'serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
```

#### GPU-Heavy Blur Rules (`mvp_web/style.css`)
`[VERIFIED: Select-String mvp_web/style.css]`
- Line 75: `.bg-glow { filter: blur(110px); }`
- Line 111: `.stage-toolbar { backdrop-filter: blur(12px); }`
- Line 530: `backdrop-filter: blur(8px);`
- Line 553: `backdrop-filter: blur(8px);`
- Line 876: `backdrop-filter: blur(14px);`
- Line 1269: `.modal { backdrop-filter: blur(6px); }`

#### Full-Screen Tablet Mode (`1024×600` & `600×1024`) + Vertical Scroll Between Placa & Resultados
- **Detection:** In `mvp_web/app.js` on boot, set `document.body.dataset.runtime = isApkOrigin ? 'apk' : 'web'`. Also apply full-screen tablet CSS for `body[data-runtime="apk"]` AND `@media (max-width: 1024px) and (pointer: coarse)` (or `(max-height: 640px)`) so both the APK on TR6948 (`1024×600` landscape and `600×1024` portrait) and touch tablets get the full-screen layout, while desktop browsers (`run_web_mvp.py` at `>= 1025px` with fine pointer) keep the `1 Móvil / 2 Móviles` emulator toolbar intact.
- **Vertical scroll architecture in `body[data-runtime="apk"]`:**
  - Hide `.stage-toolbar`, `.device-island`, `.status-bar`, `.home-indicator`, and `.bg-glow` (`display: none`).
  - Disable `backdrop-filter: none !important` and heavy `box-shadow: none` on `.device`, `.modal`, `.viewer-hint`, etc.
  - Set `html, body { height: auto; min-height: 100%; overflow-y: auto; scroll-behavior: smooth; }`.
  - Set `.stage { flex-direction: column; align-items: stretch; padding: 0; gap: 0; min-height: 100dvh; }`.
  - Show **both** `.device-left` (Placa) and `.device-right` (Resultados) stacked vertically (`display: flex !important; width: 100%; max-width: none; height: auto; padding: 0; border-radius: 0; background: var(--bg); box-shadow: none;`), with `.screen { height: auto; border-radius: 0; overflow: visible; }` and `.screen-scroll { overflow: visible; height: auto; }`.
  - Keep `.viewer-frame` sized comfortably for `1024×600` landscape (`max-width: min(460px, 100%); margin: 0 auto;`) so the plate canvas + caliper + formulary controls fit cleanly without horizontal overflow.
  - Keep a sticky bottom `.tab-bar` (on `.device-left`, hide duplicate `.tab-bar` on `.device-right` in APK mode) where tapping **Placa** smoothly scrolls to `.device-left` (`scrollIntoView({ behavior: 'smooth', block: 'start' })`) and tapping **Resultados** smoothly scrolls to `#results-panel` (`scrollIntoView({ behavior: 'smooth', block: 'start' })`), while the user can also freely swipe/scroll vertically between both sections at any time!
  - Update `fitDevice()` (`mvp_web/app.js:1158-1175`) to return early (clearing `transform` and `margin`) whenever `document.body.dataset.runtime === 'apk'` or `mobileNative` is true.

---

### 2. Exact Image & Canvas Cap (`UI-02`)

#### Audit of Image/Canvas Allocation Sites
1. `loadUpload(file)` (`mvp_web/app.js:257-345`):
   - Creates `url = URL.createObjectURL(file)` (`line 258`) — **never revoked!**
   - Sets `state.N = Math.max(W, H)` (`line 274`) — uncapped!
   - Calls `setupCanvases()` (`line 282`, `347-349`) which allocates `plate-canvas`, `base`, and `heat` at `state.N × state.N`.
   - Calls `router.analyzePlate(file, img, ...)` (`line 295`) passing the raw uncapped `img`.
2. `loadPlate(plate)` (`mvp_web/app.js:223-246`):
   - Sets `state.N = Math.max(W, H)` (`line 229`) — should also cap via `Math.min(1024, Math.max(W, H))` or downscale if any preset image exceeds `1024 px`.
3. `extractOriginalRgba(img, origW, origH)` (`mvp_web/inference/edge_detector.js:190-201`):
   - Allocates `_origCanvas` at `origW × origH` (`img.naturalWidth || img.width`). Because `edge_detector.js` reads `img.naturalWidth || img.width`, passing the downscaled `<= 1024 px` `HTMLCanvasElement` (or downscaled `HTMLImageElement`) from `loadUpload()` automatically caps `_origCanvas`, `extractOriginalRgba`, and `sobel.extractBlurredLuminance()` to `<= 1024 px` with **zero changes required** to `edge_detector.js`!

#### SRP Helper: `mvp_web/image_scaler.js` (`<= 120 lines`)
Zero-build UMD/IIFE attaching `window.ADLMS_IMAGE_SCALER` and `module.exports`:
- `MAX_EDGE_PX = 1024`
- `computeScaledDimensions(width, height, maxEdge = 1024)`:
  - Pure math function (directly unit-testable in Node.js):
  - If `Math.max(width, height) <= maxEdge`: returns `{ width, height, scale: 1, downscaled: false }`.
  - Otherwise: `scale = maxEdge / Math.max(width, height)`, `width = Math.round(width * scale)`, `height = Math.round(height * scale)`, returns `{ width, height, scale, downscaled: true }`.
- `downscaleImageToCanvas(img, maxEdge = 1024)`:
  - Uses `computeScaledDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge)`.
  - Draws `img` onto a `canvas` of `(target.width, target.height)` with `imageSmoothingQuality = 'high'`.
  - Returns `{ canvas, width: target.width, height: target.height, origWidth, origHeight, downscaled: target.downscaled }`.
- `loadAndDownscaleFile(file, maxEdge = 1024)`:
  - Creates `objectUrl = URL.createObjectURL(file)`, loads `Image`, calls `downscaleImageToCanvas(img, maxEdge)`, and **always** calls `URL.revokeObjectURL(objectUrl)` in `finally` (and clears `img.src = ''`).
  - Also generates a lightweight `thumbDataUrl` (`canvas.toDataURL('image/jpeg', 0.85)`) for the plate-picker chip and `local-api` fallback, so no raw 2 MP+ `FileReader` `dataUrl` or dangling `ObjectURL` is retained in RAM.
- Note for `computeHeat()` (`mvp_web/app.js:370`): `state.img` may be an `HTMLCanvasElement` (where `naturalWidth` is `undefined`, only `width`/`height` exist). Update `app.js:370` to use `(state.img.naturalWidth || state.img.width)` and `(state.img.naturalHeight || state.img.height)`.

---

### 3. SRP Formulary Picker & Clinical Panel Presets (`UI-03`, `UI-04`)

#### Verified `window.ADLMS_BREAKPOINTS` Data Shape
`[VERIFIED: mvp_web/breakpoints_data.js:2-70 + node verification]`
- Total drugs: **65** (`Object.keys(window.ADLMS_BREAKPOINTS.drugs).length === 65`).
- Top-level keys: `version`, `source_file`, `groups`, `aliases`, `drugs`, `intrinsic_rules`.
- Each drug entry in `drugs[code]`:
  `{ code, name, atc, loinc, unit, potency, note, eucast: { [group]: { s, r, disk_ug, source_row } }, clsi: { ... } }`
- `aliases` maps common WHONET/CLSI codes to canonical `drugs` keys (e.g. `"AMP": "AM"`, `"GEN": "CN"`, `"PEN": "P"`, `"ERY": "E"`, `"CLI": "DA"`, `"AMK": "AK"`, `"VAN": "VA"`, `"NIT": "F"`).
- All 4 locked panel presets verified against `breakpoints_data.js` with **0 missing drugs**:
  - **Enterobacterales:** `['AMP', 'AMC', 'CTX', 'CAZ', 'CIP', 'GEN', 'MEM', 'SXT']`
  - **Staphylococcus:** `['FOX', 'PEN', 'ERY', 'CLI', 'CIP', 'GEN', 'SXT', 'LZD']`
  - **Pseudomonas:** `['CAZ', 'FEP', 'TZP', 'MEM', 'CIP', 'GEN', 'AMK', 'ATM']`
  - **Enterococcus:** `['AMP', 'VAN', 'TEC', 'CIP', 'LZD', 'NIT']`

#### SRP Module: `mvp_web/formulary_ui.js` (`<= 300 lines`)
Zero-build UMD/IIFE attaching `window.ADLMS_FORMULARY_UI` and `module.exports`.
Split cleanly into **pure functions** (100% unit-testable in Node.js) and **thin DOM controller**:

1. **Pure exported functions:**
   - `CLINICAL_PANELS`: the 4 locked panel definitions `{ id, label, group, codes }`.
   - `buildDrugCatalog(breakpoints)`: returns sorted array of all 65 drugs `{ code, name, atc, potency, groups, searchText }` (including reverse aliases so searching `"AMP"` or `"Ampicilina"` matches `AM`).
   - `filterDrugCatalog(catalog, query, activeGroup)`: case-insensitive substring match on `code`, `aliases`, `name`, and `groups`; optionally prioritizes drugs with breakpoints for `activeGroup`.
   - `sortDiscIndicesClockwise(discs, centerX, centerY)`:
     - Computes angle from 12 o'clock clockwise: `angle = (Math.atan2(d.cx - centerX, -(d.cy - centerY)) + 2 * Math.PI) % (2 * Math.PI)`.
     - Returns array of original disc indices sorted ascending by `angle` (deterministic 12 o'clock → 3 → 6 → 9).
   - `findNextUnkIndex(discs, afterIndex)`:
     - Searches circularly from `(afterIndex + 1) % n` for the next disc where `String(d.code || '').toUpperCase().startsWith('UNK')` (or `!d.code`). Returns `-1` if all discs are assigned.
   - `applyPanelPresetToDiscs(discs, panelId, breakpoints, centerX, centerY)`:
     - Pure function: orders disc indices via `sortDiscIndicesClockwise()`, assigns `panel.codes[k]` (resolving canonical `key = aliases[code] || code` and `name = drugs[key].name`) to `discs[orderedIdx[k]]` for `k < Math.min(orderedIdx.length, panel.codes.length)`. Returns `{ assignedCount, panel }`.

2. **Thin DOM controller (`initFormularyUI(api)`):**
   - `api` injected from `app.js`: `{ getState, assignDiscDrug, applyPanelPreset, selectDisc, toast }`.
   - Renders a compact **Panel Presets bar** (4 one-tap buttons: `Enterobacterales`, `Staphylococcus`, `Pseudomonas`, `Enterococcus`, min-height `44px`) in the Resultados section (just above the caliper/table) and a **"Cambiar fármaco" / tap-on-code** trigger on the caliper header (`#cal-code`) and on any `UNK` row/disc tap.
   - Renders a dark-clinical **searchable bottom-sheet / modal picker** (`#formulary-modal`) with:
     - Search input (`min-height: 44px`, instant filter across all 65 drugs by code/alias/name/group).
     - Touch-friendly drug list items (`min-height: 48px`, showing `code`, `name`, `potency`, and whether a breakpoint exists for the active organism group).
     - On drug selection: calls `api.assignDiscDrug(discIndex, drug)` → updates `disc.code`, `disc.key`, `disc.name`, recomputes S/I/R (`renderPanel()` + `scheduleRender()`), then calls `findNextUnkIndex(discs, discIndex)`. If another `UNK` exists, automatically advances `state.sel` to it and keeps the picker open (updating its header to the next `UNK` disc) for rapid sequential assignment; if none remain, closes the picker and shows a confirmation toast!

## Common Pitfalls

### Pitfall 1: `state.img.naturalWidth` is `undefined` on `HTMLCanvasElement`
- **What goes wrong:** After downscaling to an offscreen `<canvas>` and storing it in `state.img`, `app.js:370` (`computeHeat`) reads `state.img.naturalWidth` which is `undefined` on a canvas, resulting in `NaN` draw dimensions and a blank Grad-CAM layer.
- **How to avoid:** Use `state.img.naturalWidth || state.img.width` and `state.img.naturalHeight || state.img.height` everywhere `state.img` is read.

### Pitfall 2: `ObjectURL` Memory Leak on Repeated 2 MP Captures
- **What goes wrong:** `URL.createObjectURL(file)` in `loadUpload()` pins the raw 2 MP+ JPEG blob in WebView memory until page unload, causing `lmkd` kills on TR6948's 968 MB RAM after 5–10 captures.
- **How to avoid:** Always call `URL.revokeObjectURL(url)` in `finally` inside `image_scaler.js` immediately after drawing to the `<= 1024 px` canvas.

### Pitfall 3: `UNK` Code Matching vs. Aliases
- **What goes wrong:** `edge_detector.js` emits `code: "UNK"` (or `"UNK-1"`). Preset codes like `AMP`, `GEN`, `VAN`, `NIT`, `PEN`, `ERY`, `CLI`, `AMK` are aliases in `ADLMS_BREAKPOINTS.aliases`, not direct keys in `ADLMS_BREAKPOINTS.drugs`.
- **How to avoid:** Always resolve `const key = aliases[code] || code;` before looking up `drugs[key]` so `evaluate(disc)` immediately finds the EUCAST v16.1 / CLSI M100 breakpoint.

### Pitfall 4: Breaking Desktop `run_web_mvp.py` Twin-Phone Mode
- **What goes wrong:** Applying full-screen vertical-scroll CSS unconditionally breaks the desktop `1 Móvil / 2 Móviles (Defensa)` presentation view.
- **How to avoid:** Scope tablet/APK full-screen vertical-scroll CSS to `body[data-runtime="apk"]` and `@media (max-width: 1024px) and (pointer: coarse)` (plus `@media (max-width: 600px)`), leaving desktop wide screens (`> 1024px` with mouse) untouched.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` (`v26.13.1`) `[VERIFIED: node --version]` |
| Config file | None required (native ESM `.mjs`) |
| Quick run command | `node --test tests/test_phase9_tablet_formulary.mjs` |
| Full suite command | `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Zero Google Fonts `<link>` in `index.html`; `sw.js` skipped on `appassets.androidplatform.net`; APK CSS disables `backdrop-filter` and chassis | static / unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ Wave 0 |
| UI-02 | `computeScaledDimensions()` caps `1600×1200`, `3000×3000`, `4000×3000` to `<= 1024 px` preserving aspect ratio, leaves `<= 1024 px` unchanged | unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ Wave 0 |
| UI-03 | `buildDrugCatalog()` loads all 65 drugs; `filterDrugCatalog()` matches code/alias/name; `findNextUnkIndex()` auto-advances circularly; `formulary_ui.js <= 300 lines` | unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ Wave 0 |
| UI-04 | `sortDiscIndicesClockwise()` orders disks clockwise from 12 o'clock; all 4 presets assign valid `ADLMS_BREAKPOINTS` drugs with 0 missing codes | unit | `node --test tests/test_phase9_tablet_formulary.mjs` | ❌ Wave 0 |
| UI-01..04 | On-device TR6948 APK rebuild (`sync_edge_assets.py` + `gradlew assembleDebug` + `adb install -r`) & UAT in `1024×600` landscape + `600×1024` portrait | manual-only (physical tablet) | `python scripts/sync_edge_assets.py && ... && adb install -r android/app/build/outputs/apk/debug/app-debug.apk` | ✅ scripts exist |

### Sampling Rate
- **Per task commit:** `node --test tests/test_phase9_tablet_formulary.mjs`
- **Per wave merge:** `node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs`
- **Phase gate:** Full Node test suite green + APK rebuilt + TR6948 UAT verified

### Wave 0 Gaps
- [ ] `tests/test_phase9_tablet_formulary.mjs` — covers `UI-01`, `UI-02`, `UI-03`, `UI-04`, and SRP line-count guardrail (`formulary_ui.js <= 300 lines`, `image_scaler.js <= 120 lines`).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Offline single-user local clinical demo |
| V5 Input Validation | yes | Escape/use `textContent` (not raw `innerHTML` with user search input) in `formulary_ui.js` search & drug list rendering to prevent DOM XSS |
| Privacy (Law 21.719) | yes | Zero Google Fonts CDN calls; 100% offline local fonts & local assets |

## Sources

### Primary (HIGH confidence)
- `mvp_web/index.html` (lines 1-382) — verified Google Fonts `<link>` at lines 16-20, script load order at lines 372-379
- `mvp_web/style.css` (lines 1-300, 1100-1435, blur grep) — verified 6 blur/backdrop-filter locations and responsive breakpoints
- `mvp_web/app.js` (lines 1-1201) — verified `loadUpload()`, `setupCanvases()`, `evaluate()`, `renderPanel()`, `fitDevice()`, `sw.js` registration
- `mvp_web/breakpoints_data.js` (lines 1-120 + Node verification) — verified 65 drugs, `aliases`, and 0 missing codes across all 4 clinical panel presets
- `mvp_web/inference/edge_detector.js` & `mvp_web/inference/inference_router.js` — verified `extractOriginalRgba()` and `analyzePlate()` image contract

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero-build vanilla JS/CSS already proven in Phases 7 & 8
- Architecture: HIGH — every DOM ID, CSS rule, and JS hook verified directly in-repo
- Pitfalls: HIGH — `naturalWidth` on canvas, `ObjectURL` leak, and `CODE_ALIASES` resolution verified directly in-repo

**Research date:** 2026-11-24
**Valid until:** 2026-12-24

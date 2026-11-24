# Phase 2.7: Clinical Precision Mobile Design System & Installable PWA Shell

**Phase ID:** 2.7-mobile-pwa-shell  
**Milestone:** Milestone 1.5 (v1.5) — DeepHalo Mobile User UI App & Installable PWA  
**Goal:** Evolve `mvp_web/` into an installable, 100% offline-capable Mobile PWA (`manifest.webmanifest` + `sw.js`) with a Clinical Precision Dark Instrument design system (`/impeccable` `Operate` mode + `/design-taste-frontend` dials `4/4/7`), gloved-friendly touch ergonomics (`>= 44×44 px`), live 6.0 mm fiducial telemetry, single-plate clinical focus (no multi-plate carousel on the mobile screen), and seamless switching between **Single-Phone App Mode** (real mobile tab navigation) and **Twin-Phone Defense Mode** (side-by-side thesis showcase).  
**Date:** 2026-11-19  

---

## 1. Executive Summary & Architectural Alignment

Per [f2_s04cmelian.md](file:///D:/Cristian/Ing%20Informatica/Trimestre%209/Anteproyecto/Semana%204/f2_s04cmelian.md) (§4.3 & §7.2) and [UI-SPEC.md](file:///d:/Bots/ADLMS/.planning/UI-SPEC.md):
1. **100% Mobile-Only & Offline-First Edge PWA:** DeepHalo targets entry-level smartphones ($\ge 2\text{ GB}$ RAM, 64-bit ARMv8-A with ARM NEON / WebAssembly, Android 9.0+ / iOS 13.0+, $< 150\text{ MB}$ RAM, $< 600\text{ ms}$ inference). Adding a Web App Manifest and offline Service Worker guarantees zero-network execution inside hospital containment laboratories.
2. **Gloved Two-Touch Ergonomics (*Protocolo de Interacción de Dos Toques*):** All primary interactive controls (`Placa` / `Resultados` / `Capturar` tabs, `CLAHE` / `ROI` / `Grad-CAM` toggles, `±0.5 mm` caliper steppers, and `Validar y enviar a LIS`) enforce $\ge 44\text{--}48\text{ px}$ touch targets with high-contrast `1px` structural hairlines and tabular monospace (`JetBrains Mono`) readouts to prevent occupational asthenopia.
3. **Single-Phone App Flow + Twin-Phone Defense Toggle:**
   - **On Real Smartphones (`< 640 px` or installed PWA):** Runs full-screen (`100dvh`, zero phone bezel) as a single mobile app where the bottom tab bar switches cleanly between **Placa** and **Resultados** views.
   - **On PC / Laptop Browser (`>= 640 px`):** Provides a top-corner stage switcher pill allowing instant toggling between **Modo App (1 Móvil)** (to test the real single-device mobile tab workflow) and **Modo Defensa (2 Móviles)** (synchronized dual-phone showcase for thesis evaluation).

---

## 2. Work Breakdown & Execution Waves

### Wave 1: Offline Mobile PWA Infrastructure (`manifest.webmanifest` & `sw.js`)
* **Task 1.1:** Create `mvp_web/manifest.webmanifest`:
  * Configure `name`, `short_name` (`DeepHalo`), `display: "standalone"`, `orientation: "portrait"`, `background_color: "#06090f"`, `theme_color: "#06090f"`, and SVG/PNG app icons from `mvp_web/icons/` / `mvp_web/logos/`.
* **Task 1.2:** Create `mvp_web/sw.js` (Offline-First Service Worker):
  * Pre-cache core shell assets (`./`, `./index.html`, `./style.css`, `./app.js`, `./plates_data.js`, `./manifest.webmanifest`, and `./sample_plates/gn_a.jpg`, `./sample_plates/gp_a.jpg`, `./sample_plates/gn_b.jpg`).
  * Serve cached assets offline with network-fallback so the app operates 100% disconnected after initial load.

### Wave 2: DOM Architecture & Fiducial Telemetry Bar (`mvp_web/index.html`)
* **Task 2.1:** Add PWA metadata (`<link rel="manifest" href="manifest.webmanifest">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) to `<head>`.
* **Task 2.2:** Add the floating desktop **Stage Mode Switcher** (`#stage-toolbar`) above `.stage`:
  * Toggle button between **Vista App · 1 Móvil** (`data-layout="single"`) and **Vista Defensa · 2 Móviles** (`data-layout="twin"`), plus a live telemetry badge (`ARM NEON / Wasm · < 600 ms · Offline PWA`).
* **Task 2.3:** Preserve the **strictly single-plate mobile screen** (do **not** add a sample-plate carousel inside the mobile screen; in real clinical use the device processes one captured plate at a time via **Capturar**).
* **Task 2.4:** Add the **Compact Fiducial & Scale Telemetry Bar** (`#fiducial-telemetry`) inside the mobile viewer header displaying:
  * Fiducial anchor: `Disco 6,0 mm` (`#tel-disc-px` median px)
  * Spatial scale factor: `$F_{\text{scale}}$` (`#tel-scale` in `px/mm` and `mm/px`)
  * Active clinical standard quick-chip (`#btn-toggle-std-left`) synchronized with `#btn-toggle-std`.

### Wave 3: Clinical Precision Dark Instrument Design System (`mvp_web/style.css`)
* **Task 3.1:** Apply the **Clinical Precision Dark Instrument** token palette (`/impeccable` `Operate` mode + `/design-taste-frontend` dials `4/4/7`):
  * `--bg: #06090f`, `--surface: #0b101b`, `--elev: #111827`, `--surface-hover: #172033`, crisp `1px` hairlines (`rgba(148, 163, 184, 0.14)`), and high-contrast clinical S/I/R tokens (`#10b981`, `#f59e0b`, `#f43f5e`).
  * Enforce `font-variant-numeric: tabular-nums` on all numeric readouts and `font-style: italic` on all bacterial taxonomy strings.
* **Task 3.2:** Style `#stage-toolbar` and `#fiducial-telemetry` with crisp `1px` instrument borders and tabular monospace metrics.
* **Task 3.3:** Implement `[data-layout="single"]` and mobile (`<= 959px` / `<= 600px`) single-device view switching:
  * In `data-layout="single"` (or `< 960px`), hide the inactive `.device` panel (`[data-active-tab="placa"]` shows `.device-left`, `[data-active-tab="resultados"]` shows `.device-right`) so the user experiences a true single-phone tab switch instead of scrolling past two stacked 868 px phone frames.
  * On actual mobile viewports (`<= 600px`), strip the outer `.device` bezel/island/home-indicator and fill `100dvh` cleanly with sticky top bar and bottom tab bar.

### Wave 4: View-State Sync, Telemetry & Service Worker Registration (`mvp_web/app.js`)
* **Task 4.1:** Implement single-phone vs. twin-phone mode switching (`setLayoutMode('single' | 'twin')`) and mobile tab switching (`setActiveMobileTab('placa' | 'resultados')`):
  * Wire both bottom tab bars (`Placa`, `Resultados`, `Capturar`) so tapping `Resultados` in Single-Phone or Mobile mode immediately switches the active screen to `Resultados` (and in Twin-Phone mode highlights/focuses the right device).
  * Update `fitDevice()` to scale 1 phone width (`414 px`) when `data-layout="single"` and 2 phone widths (`868 px`) when `data-layout="twin"`.
* **Task 4.2:** Populate `#fiducial-telemetry` dynamically inside `renderPanel()` whenever a plate loads:
  * Compute and display median 6.0 mm disc size in pixels (`(state.scale * 6.0).toFixed(1) px`), `state.scale.toFixed(2) px/mm`, and `(1 / state.scale).toFixed(3) mm/px`.
* **Task 4.3:** Register `sw.js` (`navigator.serviceWorker.register('sw.js')`) cleanly when served over HTTP/localhost.

---

## 3. Verification Protocol & Quality Gates

| Check | Action | Expected Result |
|---|---|---|
| **Single-Plate Clinical View** | Load `http://localhost:8000` | Mobile screen shows only the active plate (no multi-plate carousel inside the device); new plates are loaded exclusively via `Capturar`. |
| **Fiducial Telemetry** | Inspect `#fiducial-telemetry` | Shows exact median disc pixels (`px`), `px/mm`, and `mm/px` derived from the 6.0 mm fiducial anchor in tabular monospace. |
| **Single-Phone ↔ Twin-Phone Toggle** | Click `#btn-layout-single` / `#btn-layout-twin` | Switches smoothly between 1 centered mobile phone (with live bottom-tab switching between *Placa* and *Resultados*) and 2 synchronized side-by-side phones. |
| **PWA & Offline Readiness** | Check `manifest.webmanifest` & `sw.js` | Valid JSON manifest and service worker registration without console errors. |

---

## 4. Reversibility & Risk Assessment
* **Reversibility Rating:** `two-way-door` (pure frontend additions in `mvp_web/`, Git-tracked, preserves Twin-Phone showcase mode 100%).
* **Runtime Dependencies Added:** Zero (100% vanilla ES2022 + CSS + HTML5 Canvas + Web Standards PWA).

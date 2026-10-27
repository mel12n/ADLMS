# UI-SPEC — DeepHalo / ADLMS Web MVP: Twin Mobile Showcase

Design contract and implementation plan for the Twin Mobile layout of the Phase 2.5 Web MVP.
Approved brief: 2026-10-25.

---

## 1. Architectural Vision: Twin Mobile Showcase

The user experience transitions from a "Mobile Device + Desktop Sidebar" layout to a **Twin Mobile Showcase (Doble Dispositivo Móvil)**:
- **Left Phone (Screen 1 — Módulo de Adquisición & Visor de Placa):**
  Represents the primary operational view on the mobile device during bench inspection. Housed in a realistic 414 × 868 px smartphone chassis.
  - Fixed top: Dynamic island, status bar (9:41, battery, signal), application header (DeepHalo brand mark + Edge AI badge).
  - **Scrollable screen content (`.screen-scroll`):** Smooth vertical scroll container allowing technologists to inspect all components:
    1. Sample plate carousel (Kirby-Bauer thumb chips).
    2. Square Petri plate canvas (zoom 1–4×, pinch/pan gestures, halo rings without diameter text).
    3. Clinical S/I/R color legend.
    4. Layer controls (CLAHE, ROI, Grad-CAM heatmap over bacterial growth, opacity slider).
    5. S/I/R metric summary cards (S, I [Intermedio], R) + quick shortcut button.
    6. Ficha clínica de la muestra (`.specimen-card`): ID muestra (cadena numérica extendida) y Microorganismo taxonómico en cursiva biológica.
  - Fixed bottom: iOS-style bottom tab bar (Active: *Placa*, *Resultados*, *Capturar*) and home indicator.

- **Right Phone (Screen 2 — Módulo de Calibre, Interpretación & LIS):**
  Represents the clinical interpretation and laboratory validation view, housed inside an **identical mobile smartphone chassis** (414 × 868 px).
  - Fixed top: Dynamic island, status bar (9:41, battery, signal), mobile app header ("Resultados", ID muestra / Microorganismo, and interactive `CLSI`/`EUCAST` standard switch chip).
  - **Scrollable screen content (`.screen-scroll`):**
    1. Selected antibiotic digital caliper (drug code, name, category pill, `−` / `+` stepper buttons, large digital numeric readout, fine slider, clinical breakpoints, reset link).
    2. Antibiotic table header (`Antimicrobiano`, `Halo mm`, `Cat.`).
    3. Interactive antibiotic rows list (`.rows`): Click/tap highlights halo on Phone 1 and loads into caliper.
    4. Unified primary action button: `Validar y enviar a LIS` (full width, gradient teal/sky, launches HL7 FHIR R4 modal).
    5. Structured clinical notes box (`.note-box`): Formatted bullet points for Medidas, Grad-CAM, and Puntos de corte de referencia.
  - Fixed bottom: iOS-style bottom tab bar (Active: *Resultados*, *Placa*, *Capturar*) and home indicator.

---

## 2. Layout & Responsive Geometry Contract

| Viewport | Layout Strategy | Sizing & Alignment |
|---|---|---|
| **Wide Desktop (≥ 960 px)** | Twin Mobile Stage | `display: flex; gap: 40px; justify-content: center; align-items: center;` Both phones scaled proportionally via CSS transform / `fitDevice()` to guarantee zero vertical cut-off on laptop screens ($\le 900\text{ px}$ height). |
| **Tablet & Small Desktop (800–959 px)** | Twin Mobile Auto-Fit | Scaled down proportionally (scale factor $f = \min(1, (W - 40) / 880)$) maintaining twin side-by-side view, or switchable tabs. |
| **Real Mobile (< 800 px)** | Single Native View | Single full-bleed mobile viewport with sticky bottom tab bar switching between *Placa* and *Resultados* views. |

---

## 3. Detailed Component & DOM Architecture

```html
<main class="stage">
  <!-- ============ LEFT PHONE: Screen 1 (Placa & Detección) ============ -->
  <section class="device device-left" aria-label="Dispositivo móvil 1: Visor y Detección">
    <div class="device-island" aria-hidden="true"></div>
    <div class="screen">
      <div class="status-bar" aria-hidden="true">...</div>
      <header class="app-bar">...</header>
      
      <!-- Internal Scroll Container -->
      <div class="screen-scroll" id="screen-scroll-left">
        <div class="plate-picker" id="plate-picker" role="tablist">...</div>
        <section class="viewer" aria-label="Visor de placa">...</section>
        <section class="layers" aria-label="Capas de análisis">...</section>
        <section class="summary" aria-label="Resumen S-I-R">...</section>
        <div class="specimen-card" id="specimen-card">...</div>
      </div>
      
      <nav class="tab-bar">
        <button class="tab active" data-tab="placa">...</button>
        <button class="tab" data-tab="resultados">...</button>
        <button class="tab" data-tab="capturar">...</button>
      </nav>
      <div class="home-indicator" aria-hidden="true"></div>
    </div>
  </section>

  <!-- ============ RIGHT PHONE: Screen 2 (Calibre & LIS) ============ -->
  <section class="device device-right" aria-label="Dispositivo móvil 2: Calibre y LIS">
    <div class="device-island" aria-hidden="true"></div>
    <div class="screen">
      <div class="status-bar" aria-hidden="true">...</div>
      <header class="app-bar app-bar-right">
        <div class="brand">
          <div class="brand-mark brand-mark-secondary">...</div>
          <div>
            <h2>Resultados</h2>
            <p id="panel-sub">—</p>
          </div>
        </div>
        <button class="chip chip-std" id="btn-toggle-std" title="Alternar CLSI / EUCAST">
          <i class="dot"></i><span id="std-label">CLSI</span>
        </button>
      </header>
      
      <!-- Internal Scroll Container -->
      <div class="screen-scroll" id="screen-scroll-right">
        <div class="caliper" id="caliper">...</div>
        <div class="table-container">
          <div class="table-head">...</div>
          <ul class="rows" id="rows">...</ul>
        </div>
        <div class="actions">
          <button class="btn-primary wide" id="btn-validate-lis">Validar y enviar a LIS</button>
        </div>
        <div class="note-box" id="note">...</div>
      </div>
      
      <nav class="tab-bar">
        <button class="tab" data-tab="placa">...</button>
        <button class="tab active" data-tab="resultados">...</button>
        <button class="tab" data-tab="capturar">...</button>
      </nav>
      <div class="home-indicator" aria-hidden="true"></div>
    </div>
  </section>
</main>
```

---

## 4. Interaction & Synchronization Model

1. **Bi-directional State Sync:**
   - Selecting a plate in Phone 1 updates the plate canvas in Phone 1 AND immediately updates the specimen ID, organism name, antibiotic table, and caliper in Phone 2.
   - Touching/tapping a halo on Phone 1 highlights the row on Phone 2 and sets the digital caliper.
   - Clicking a row on Phone 2 smoothly selects and pulses the halo on Phone 1.
   - Adjusting the caliper (stepper or slider) on Phone 2 updates the halo circle diameter on Phone 1 in real time.
2. **Scroll Ergonomics:**
   - `.screen-scroll` has `overflow-y: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;`.
   - The scroll container preserves smooth momentum scrolling without disturbing the device chassis, status bar, or bottom navigation bar.
3. **Dual Device Dynamic Scaling (`fitDevice`):**
   - Automatically computes scale factor $f = \min(1, (H_{\text{window}} - 48) / 868, (W_{\text{window}} - 64) / 880)$ on desktop.
   - Ensures both mockups are crisp, centered, and fully within view regardless of display resolution.

---

## 5. Implementation Phases (Execution Waves)

* **Wave 1: DOM Restructuring (`mvp_web/index.html`)**
  - Wrap the left screen content inside `<div class="screen-scroll" id="screen-scroll-left">`.
  - Transform `<aside class="panel">` into `<section class="device device-right">` with status bar, app bar, `.screen-scroll`, tab bar, and home indicator.
* **Wave 2: CSS Architecture & Polish (`mvp_web/style.css`)**
  - Define `.stage` for twin devices (`display: flex; gap: 36px;`).
  - Implement `.screen-scroll` with flex child sizing (`flex: 1; overflow-y: auto; overflow-x: hidden;`).
  - Adapt `.caliper`, `.rows`, `.table-head`, `.actions`, and `.note-box` for mobile screen container padding.
  - Update media queries for responsive stacking and full-bleed mobile views.
* **Wave 3: JavaScript Sync & Scaling Engine (`mvp_web/app.js`)**
  - Update `fitDevice()` to query and scale both `.device` elements uniformly.
  - Update clock update (`tickClock()`) to synchronize status bars on both devices.
  - Connect tab-bar navigation between devices (e.g. tapping "Resultados" on Phone 1 focuses/scrolls to Phone 2; tapping "Placa" on Phone 2 focuses Phone 1).
* **Wave 4: Verification & Visual Quality Gate**
  - Run local HTTP server and execute browser subagent validation.
  - Test scrolling on Phone 1, verify caliper and table on Phone 2, check HL7 FHIR modal and standard toggle.
  - Record session video and capture screenshots.

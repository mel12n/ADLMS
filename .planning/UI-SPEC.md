# UI-SPEC — DeepHalo / ADLMS Milestone 1.5: Clinical User UI App & Responsive PWA

**Status:** Approved Design Contract (Milestone 1.5 — Phases 2.7 to 2.10)  
**Date:** 2026-11-19  
**Design Skills Applied:** `/gsd-ui-phase` + `/impeccable` (`Operate` Mode) + `/design-taste-frontend`  

---

## 0. Design Read & Skill Configuration

> **Design Read:** *"Reading this as: a clinical microbiology diagnostic workstation & mobile capture PWA for Medical Technologists, with a Clinical Precision Dark Instrument language, leaning toward high-contrast obsidian/slate surfaces, 1px structural hairlines, tabular monospace telemetry, and strict S/I/R clinical color semantics."*

### Skill Dials (`/design-taste-frontend` + `/impeccable`)
* **Surface Mode (`/impeccable`):** `Operate` — task completion, submillimeter reading accuracy, zero cognitive clutter, native-grade touch & pointer affordances.
* **`DESIGN_VARIANCE: 4`** — Disciplined, orthogonal instrument geometry. Asymmetry comes only from the functional split between the high-resolution Petri canvas and the dense telemetry/caliper rail.
* **`MOTION_INTENSITY: 4`** — Purposeful, physics-backed micro-feedback (`cubic-bezier(0.22, 1, 0.36, 1)`, 160–220 ms) for halo selection, caliper stepping, and layer cross-fades. Zero decorative infinite loops.
* **`VISUAL_DENSITY: 7`** — Cockpit/instrument density. Metrics, scale factors ($F_{\text{scale}}$), breakpoint thresholds, and audit deltas ($\Delta\text{mm}$) breathe inside crisp `1px` hairline grids rather than bloated nested cards.

---

## 1. Visual Token System (Clinical Precision Dark Instrument)

| Token Category | CSS Variable | Value | Usage Contract |
|---|---|---|---|
| **Canvas / Bench Void** | `--bg-void` | `#06090f` | Root viewport & optical darkroom backdrop behind the Petri dish |
| **Primary Instrument Surface** | `--bg-surface-1` | `#0b101b` | Main workstation panels & mobile screen background |
| **Elevated Control Surface** | `--bg-surface-2` | `#111827` | Active caliper module, specimen drawer, modal headers |
| **Interactive Hover / Subtle** | `--bg-surface-3` | `#172033` | Row hover state, inactive segmented controls |
| **Structural Hairline** | `--border-hairline` | `rgba(148, 163, 184, 0.14)` | `1px solid` panel dividers, table rows, card outlines |
| **Active Focus Border** | `--border-focus` | `#38bdf8` | Selected antibiotic row, active input ring, caliper focus |
| **Primary Text** | `--text-primary` | `#f1f5f9` | Headings, drug names, primary millimeter readouts |
| **Secondary Text** | `--text-secondary` | `#94a3b8` | Clinical metadata, breakpoint ranges, axis labels |
| **Muted / Technical Label** | `--text-muted` | `#64748b` | Uppercase micro-labels (`0.08em` tracking, max 1 per panel) |
| **Instrument Accent (Primary)** | `--accent-instrument` | `#0ea5e9` → `#14b8a6` | Fiducial lock, active tool toggle, primary LIS action |
| **Clinical Susceptible (`S`)** | `--clinical-s` | `#10b981` | Emerald badge, halo ring (`S`), count indicator |
| **Clinical Intermediate (`I`)** | `--clinical-i` | `#f59e0b` | Amber badge, halo ring (`I` / increased exposure) |
| **Clinical Resistant (`R`)** | `--clinical-r` | `#f43f5e` | Crimson badge, halo ring (`R`), critical alert |

### Typography Contract
* **UI & Clinical Labels:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (`400`, `500`, `600`, `700`).
* **Metric & Telemetry Readouts:** `'JetBrains Mono', monospace` with `font-variant-numeric: tabular-nums` mandatory on all diameters (`mm`), scale factors (`mm/px`), pixel radii, sample IDs, and LOINC/SNOMED codes.
* **Biological Taxonomy:** Italic (`font-style: italic`) mandatory for all organism names (*Escherichia coli*, *Staphylococcus aureus*, *Klebsiella pneumoniae*).

---

## 2. Mobile-Only Architecture & Entry-Level Device Envelope (Section 4.3 & 7.2 of `f2_s04cmelian.md`)

Because DeepHalo is **100% a mobile application** used by Medical Technologists wearing **nitrile/latex gloves** at the laboratory bench, there is **no desktop workstation layout**. All design, performance, and interaction engineering targets the entry-level mobile hardware baseline and the **Two-Touch Gloved Clinical Workflow** (*Protocolo de Interacción de Dos Toques*):

### 2.1 Entry-Level Mobile Hardware & Runtime Budget
* **SoC & Compute:** 64-bit ARMv8-A+ CPU with **ARM NEON SIMD** (`Unisoc T606/T612/T616`, `MediaTek Helio A22/G35/G36/G85/G99`, `Snapdragon 480/680/685`) — **0% NPU or GPU dependency**.
* **RAM & Storage Envelope:** Runs on **$\ge 2\text{ GB}$ RAM** smartphones (including **Android Go Edition** phones costing $\$65\text{--}\$90\text{ USD}$ / $\$65.000\text{--}\$85.000\text{ CLP}$). Model binary is **$3.8\text{ MB}$** (`< 4 MB` INT8 vs. `12.8 MB` FP32; $\ge 30\text{ MB}$ free storage required), volatile inference memory is **$\approx 45\text{--}50\text{ MB}$** (hard cap $< 150\text{ MB}$), and CPU inference latency is **$\approx 550\text{--}600\text{ ms}$** ($\text{TRT} \le 2.0\text{ s}$).
* **Optical Sensor & Working Distance:** Rear camera **$\ge 5\text{ MP}$ or $8\text{ MP}$** with basic autofocus at **$10\text{--}15\text{ cm}$** (no OIS needed thanks to internal $6.0 \pm 0.1\text{ mm}$ fiducial disc calibration).
* **OS & Browser:** **Android 9.0+ (API 28+)** or **iOS 13.0+** with modern WebView / WebAssembly (`Wasm`).

### 2.2 Gloved Two-Touch Ergonomics & Viewport Modes
1. **Protocolo de Interacción de Dos Toques (Gloved Operation):**
   * **Toque 1 (Adquisición y Análisis Desatendido):** Oversized shutter/capture trigger ($\ge 56\text{ px}$ height) or circular auto-lock → executes CLAHE L\*a\*b\*, Hough ROI, YOLO11n INT8 inference, 6.0 mm fiducial scaling, 36-ray Sobel geometric cross-validation ($\Delta r \le 1.2\text{ mm}$), EUCAST/CLSI intrinsic resistance check, and Grad-CAM projection in $< 600\text{--}800\text{ ms}$.
   * **Toque 2 (Confirmación y Despacho Hospitalario):** Single oversized CTA (`Validar y enviar a LIS`) → signs and exports the HL7 FHIR R4 `Bundle` (`DiagnosticReport` + `Observation`, `TIS = 100%`) and tabular `.csv`.
   * **Exception Gesture ("Sticky Caliper"):** Direct touch-drag on the halo perimeter ring (or oversized `±0.5 mm` stepper buttons) when $\Delta r > 1.2\text{ mm}$, coalescent halos, or intrinsic resistance alerts occur.
2. **On a Real Smartphone (`< 800 px` or installed PWA):**
   * Renders **full-screen native-feel** (`100dvh`, `viewport-fit=cover`, safe-area insets, zero fake phone bezel).
3. **On a Desktop / Laptop Browser (`>= 800 px`, for development & thesis presentation):**
   * Renders inside the realistic **414 × 868 px smartphone chassis** centered on the stage (`fitDevice()` auto-scaling), with a corner pill to switch between **Single-Phone Mode** and **Twin-Phone Showcase Mode**.

---

## 3. Core Functional Screens & Component Contracts (Phases 2.7 – 2.10)

### 3.1 Screen 1: Guided Camera Capture & Perspective Alignment (`Capturar`)
* **Purpose:** Solve perspective distortion and lighting issues *at acquisition time* before inference.
* **Components:**
  1. **Source Switcher:** Live Camera (`navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`) or Local File / Drag-and-Drop plate upload.
  2. **Petri Alignment Reticle Overlay:** SVG circular target ring (`90 mm` dish boundary) with crosshair center and 4 quadrant ticks.
  3. **Perspective & Tilt Indicator:**
     * Uses `DeviceOrientationEvent` (on mobile) or ellipse aspect-ratio analysis ($e = b/a$ of the detected plate rim on uploaded photos).
     * Displays live angular status pill: `Ortogonal (±1.2° · Óptimo)` (Emerald) vs. `Inclinación detectada (>5° · Rectificación homográfica activa)` (Amber).
  4. **Pre-Flight Readiness Strip:** 3 instant checks before confirming capture:
     * `Encuadre circular ROI`
     * `Normalización CLAHE L*a*b*`
     * `Anclaje fiducial 6.0 mm`

### 3.2 Screen 2: Interactive Plate Inspector & Direct On-Canvas Caliper (`Placa`)
* **Purpose:** High-precision optical verification and direct manipulation of inhibition zones.
* **Components:**
  1. **Direct Canvas Radial Handles:** When a halo is selected, render two high-contrast drag handles (`0°` and `180°` or along the radial measurement axis) on the halo ring so the user can drag the radius directly on the canvas with live `mm` tooltip feedback.
  2. **Fiducial Calibration Badge:** Floating HUD pill in the corner of the canvas showing `Ref: Disco 6.0 mm (71.4 px) · 1 px = 0.084 mm`.
  3. **Optical Layers Toolbar:** One-line segmented controls for `CLAHE`, `ROI`, `Grad-CAM` (`α` slider `0.10–0.90`), and zoom reset.

### 3.3 Screen 3: Digital Caliper & Susceptibility Breakpoint Table (`Resultados`)
* **Purpose:** Rapid clinical review, submillimeter manual override, and CLSI/EUCAST categorization.
* **Components:**
  1. **Digital Caliper Module:**
     * Drug code (`CIP-5`), full name (`Ciprofloxacino 5 µg`), active S/I/R badge, and `AUDITADO` tag when modified from raw AI reading.
     * Tactile `−0.5` / `+0.5 mm` stepper buttons, direct numeric input (`tabular-nums`), fine range slider (`6.0–45.0 mm`), and breakpoint reference bar (`R < 22 · I 22–25 · S ≥ 26 mm`).
  2. **Susceptibility Table:**
     * Columns: `Código / Antimicrobiano`, `Halo (mm)`, `Estado / Audit`, `Cat.`
     * Clicking any row highlights and centers the corresponding halo on the Petri canvas.

### 3.4 Screen 4: Specimen Intake, Audit Trail & HL7 FHIR R4 Report Studio
* **Purpose:** Complete clinical governance (NCh-ISO 15189:2022) and LIS interoperability.
* **Components:**
  1. **Editable Specimen Card:** Sample ID input, Organism selector (*E. coli ATCC 25922*, *S. aureus ATCC 29213*, *K. pneumoniae BLEE*, *P. aeruginosa ATCC 27853*, or custom), Gram group, and Technologist identifier.
  2. **Audit Log Drawer:** Lists every manual adjustment (`[21:05:12] CIP-5 ajustado 24.0 mm → 25.5 mm por TM · Motivo: Borde de inhibición difuso`).
  3. **HL7 FHIR R4 & Clinical Report Modal:** Tabs for **Resumen Clínico (Imprimible)** and **Payload HL7 FHIR R4 (`DiagnosticReport` JSON)** with 1-click Copy and `.json` Download.

---

## 4. Pre-Flight Quality Gates (`/design-taste-frontend` + `/impeccable`)

- [ ] **No nested card-inside-card clutter:** Group related metrics with `1px` hairlines (`--border-hairline`), not stacked drop-shadow boxes.
- [ ] **Tabular numbers everywhere:** Every numeric readout (`mm`, `px`, `%`, timestamps, sample IDs) uses `JetBrains Mono` with `font-variant-numeric: tabular-nums` so digits never jitter while dragging the caliper.
- [ ] **WCAG AA contrast:** All buttons, badges, and table cells meet $\ge 4.5:1$ text contrast; primary CTA fits on a single line across desktop and mobile.
- [ ] **Zero external runtime dependencies:** Runs 100% locally via `python run_web_mvp.py` (`http://localhost:8000`) with zero build step required.

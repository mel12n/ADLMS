# ADLMS: Project Roadmap (ROADMAP.md)

## Milestone 1: Anteproyecto & MVP Proof of Concept (Weeks 1–4) — [COMPLETED]

- [x] **Phase 1: Problem Definition & Research Foundations (Weeks 1–2)**
  - [x] Clinical problem identification: AST inter-operator variability & AMR escalation.
  - [x] State of the art review (CLSI M100, EUCAST v16.0, ISO 15189, Chilean Law 21.719).
  - [x] Formal proposal formulation: DeepHalo / Suite ADLMS.
  - [x] Delivery of Phase 1 Anteproyecto report (`f1_s02cmelian.pdf`).

- [x] **Phase 2: Technical Evidence, Metric Definition & Architecture (Weeks 3–4)**
  - [x] Deep literature review of 19 peer-reviewed papers (Frontiers, Nature Comms, ICCV, etc.).
  - [x] Architectural mapping of ADLMS repository (Graphify analysis: 309 nodes, 306 edges).
  - [x] Definition of 3-dimensional evaluation metric matrix (AI Model, Web App, User Impact).
  - [x] Submission of Phase 2 Anteproyecto report (`f2_s04cmelian.md`).

- [x] **Phase 2.5: Dual-Hybrid MVP Construction (Completed)**
  - [x] **Track A:** Standalone Interactive Web MVP (`mvp_web/`) with Canvas image processing, 6.0 mm disc calibration, interactive caliper, Grad-CAM heatmap, and HL7 FHIR JSON export.
  - [x] **Track B:** Python Streamlit Application (`streamlit_app.py`) for cloud-ready scientific deployment.
  - [x] One-click launcher and sample plate integration from `Antibiogram_demo/Test/`.

- [x] **Phase 2.6: Repository Reorganization & Architectural Housekeeping (Completed)**
  - [x] Consolidate academic and thesis deliverables in `docs/academic/`.
  - [x] Move developer and operational manuals into `docs/guides/`.
  - [x] Move utility scripts into `scripts/` with robust path resolution.
  - [x] Consolidate demo datasets under `data/`.
  - [x] Add Python package initializers (`__init__.py`) across `src/`.
  - [x] Author flagship root `README.md` and clean `.gitignore`.

---

## Milestone 1.5: DeepHalo Mobile User UI App & Installable PWA (Parallel Track during Dataset Labeling) — [CURRENT]

> **Design Engineering Skills Contract:** Combines `/gsd-ui-phase` (UI-SPEC design contract), `/impeccable` (`Operate` mode — precision mobile instrument UX, thumb-zone ergonomics, native affordances), and `/design-taste-frontend` (`DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 7` — Clinical Precision Dark Instrument).

- [x] **Phase 2.7: Clinical Precision Mobile Design System & Installable PWA Shell (Completed)**
  - [x] Evolve `mvp_web/` into an installable **100% Mobile-First PWA** (`manifest.webmanifest` + `sw.js`) that runs full-screen on phones (`<= 600 px`) and inside a mobile chassis preview on desktop (with a toggle between **1 Móvil (App)** and **2 Móviles (Defensa)**).
  - [x] Implement the **Clinical Precision Dark Instrument** mobile token system (obsidian/slate surfaces, `1px` crisp structural hairlines, tabular `JetBrains Mono` readouts, thumb-friendly 46–48 px touch targets, S/I/R semantic accents).
  - [x] Compact mobile fiducial telemetry bar (`6,0 mm` anchor px, $F_{\text{scale}}$ `px/mm`, resolution `mm/px`, synced CLSI/EUCAST toggle).

- [ ] **Phase 2.8: Guided Mobile Camera Capture & Perspective Alignment Assistant**
  - [ ] Dedicated **Capturar** mobile screen supporting live camera preview (`getUserMedia`) and local photo/gallery plate ingestion.
  - [ ] Circular Petri dish alignment reticle with real-time tilt/perspective indicator (device orientation / ellipse eccentricity gauge) and perspective rectification preview.
  - [ ] Pre-capture optical quality checklist (framing, CLAHE illumination check, 6.0 mm disc detection readiness).

- [ ] **Phase 2.9: Mobile Plate Inspector & Direct Touch Digital Caliper**
  - [ ] Direct on-canvas radial touch/drag handles on the selected inhibition halo so technologists can resize diameters directly on the Petri plate view as well as via the `±0.5 mm` digital caliper.
  - [ ] Enhanced multi-layer optical inspector (Original vs. CLAHE toggle, ROI circular mask, Grad-CAM XAI activation overlay with opacity control, pinch/zoom Loupe).
  - [ ] Synchronized S/I/R susceptibility table with live delta tracking ($\Delta\text{mm}$ vs. raw AI measurement) and instant **CLSI M100 ↔ EUCAST v16.0** breakpoint comparison.

- [ ] **Phase 2.10: Mobile Specimen Intake, Technologist Audit Trail & HL7 FHIR R4 Export**
  - [ ] Mobile Specimen Intake drawer (Sample ID, Organism selector with ATCC & clinical strains, Gram panel filter, Technologist ID).
  - [ ] Human-in-the-Loop Audit Trail logging every manual caliper override (`AUDITED_BY_TECHNOLOGIST`, timestamp, before/after mm).
  - [ ] Mobile Clinical Report sheet and validated HL7 FHIR R4 (`DiagnosticReport` + `Observation`) JSON export.

---

## Milestone 2: Technical Implementation & Validation (Weeks 5–9)

- [ ] **Phase 3: Deep Learning Pipeline & Model Training (Weeks 5–7)**
  - [ ] Full training of YOLO11n on full AGAR and Kirby-Bauer datasets.
  - [ ] Quantization to INT8 using Post-Training Quantization (PTQ) with KL divergence.
  - [ ] Validation of radial metric error: achieve $\text{MAE} \le 0.50\text{ mm}$ and $\text{mAP@0.5} \ge 0.90$.
  - [ ] Export to ONNX Runtime Mobile and LiteRT.

- [ ] **Phase 4: Clinical Decision Engine & LIS Integration (Weeks 8–9)**
  - [ ] Automated integration with live HL7 FHIR endpoints.
  - [ ] Real-world validation with paired manual caliper measurements ($n = 100$ isolates).
  - [ ] User Usability testing with Medical Technologists: measure SUS score ($\ge 80$) and bench time reduction ($\ge 65\%$).

---

## Milestone 3: Project Consolidation & Defense (Weeks 10–13)

- [ ] **Phase 5: Project Consolidation & Defense (Weeks 10–13)**
  - [ ] Integration of feedback from cross-evaluation commission.
  - [ ] Final thesis report preparation and oral defense.

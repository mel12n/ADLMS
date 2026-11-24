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

## Milestone 1.5: DeepHalo Mobile User UI App & Installable PWA (Parallel Track during Dataset Labeling) — [PAUSED: Phases 2.8–2.10 pending; superseded as current by Milestone 1.6]

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

---

## Milestone 1.6 (v1.6): Edge Device Demo (TR6948) — [CURRENT]

**Goal:** The `run_web_mvp.py` demo flow (upload/capture plate → YOLO11n-seg segmentation → 6.0 mm disk calibration → EUCAST v16.1 S/I/R → FHIR/CSV report) runs fully offline on the USB-attached TR6948 (Android 10, 32-bit `armeabi-v7a`, 968 MB RAM, WebView 119) with no PC at runtime.

**Requirements:** `.planning/REQUIREMENTS.md` → "Milestone v1.6 Requirements" (18 requirements). **Research:** `.planning/research/SUMMARY.md`.

> Phase numbering continues after Phase 5. Dependency chain: frozen ONNX contract → in-browser decoder → APK shell → tablet UX → on-device benchmark.

### Phases

- [ ] **Phase 6: Edge Model Split, Retrain & ONNX Export** - Leak-free split, retrained YOLO11n-seg, WASM-safe ONNX variants with Python parity
- [ ] **Phase 7: In-Browser Edge Inference & Clinical Parity** - `mvp_web/` analyzes plates via local ORT-Web with mm/S/I/R matching Python
- [ ] **Phase 8: Offline Android WebView Wrapper APK** - Installable offline APK on TR6948 with camera/gallery input and on-device export
- [ ] **Phase 9: Tablet UX & Manual Drug Formulary** - 1024x600 tablet layout, memory-safe canvases, manual drug picker and panel presets
- [ ] **Phase 10: TR6948 Benchmark & Variant Lock** - Measured latency/RAM/MAE on device and locked shipping model variant

### Phase Details

### Phase 6: Edge Model Split, Retrain & ONNX Export
**Goal**: Developer has an honestly validated YOLO11n-seg model (no train/val leakage) exported as compact, WASM-safe ONNX variants whose zone diameters match `best.pt` within clinical tolerance.
**Depends on**: Nothing (first v1.6 phase; builds on the 20 labeled plates in `data/Antibiogram_demo/Train_yolo` and the ADR-005 3-class schema)
**Requirements**: MODL-01, MODL-02, MODL-03, MODL-04
**Success Criteria** (what must be TRUE):
  1. `configs/dataset.yaml` points train and val at disjoint, stratified plate sets, and a listing/check confirms zero images shared between them.
  2. Retraining writes `results/yolo11n_microbiology/weights/best.pt`, with mAP50 and per-class (disk/zone/inner_colony) metrics reported on held-out validation plates only, replacing the leaked 0.66 / 0.99 figures.
  3. Four ONNX files exist (320 and 416 × FP32 and real-plate-calibrated QDQ INT8) plus `model_meta.json`; graph inspection shows opset 17, static input shape, outputs `[1,39,N]` and `[1,32,S/4,S/4]`, no NMS, no `ConvInteger`, and no FP16 tensors.
  4. A Python parity report lists, per ONNX variant, zone-diameter MAE vs `best.pt` on held-out validation plates, and at least one variant is within `MAE <= 0.50 mm` (failing variants are marked as not shippable).
**Plans**: TBD

### Phase 7: In-Browser Edge Inference & Clinical Parity
**Goal**: The existing `mvp_web/` UI analyzes a plate entirely in the browser (no Python server) and produces the same disks, zones, mm diameters and S/I/R as the Python pipeline.
**Depends on**: Phase 6 (frozen ONNX tensor contract + `model_meta.json`)
**Requirements**: WASM-01, WASM-02, WASM-03, WASM-04
**Success Criteria** (what must be TRUE):
  1. With `run_web_mvp.py`'s API unavailable, a user in desktop Chrome uploads a plate and sees disk/zone mask overlays, mm diameters and S/I/R, while the network panel shows only locally bundled `onnxruntime-web@1.18.0` assets (no CDN, no `/api/analyze`).
  2. With the `run_web_mvp.py` API running, the same UI uses the server automatically; when it is absent (or on the APK origin) the inference router switches to local ORT-Web with no user action, and both paths render through the same result contract.
  3. Both the SIMD and forced non-SIMD wasm builds load with `numThreads=1`, and 10 consecutive analyses complete without steadily growing WASM/JS memory (tensors disposed, arena/pattern off).
  4. A golden parity test on 1:1 and 4:3 plates shows JS zone diameters within 0.2 mm of `measure_zones.py`, with masks aligned to the original photo after letterbox unpadding.
  5. Each zone shows a 36-ray Sobel cross-check badge (flagged when `Δr > 1.2 mm`) and an `inner_colony` alert wherever one is detected inside a zone.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Offline Android WebView Wrapper APK
**Goal**: The edge-mode web app runs as an installable, fully offline APK on TR6948, accepting plates from the camera or gallery and saving reports on the device.
**Depends on**: Phase 7 (working edge-wasm web bundle)
**Requirements**: APK-01, APK-02, APK-03, APK-04
**Success Criteria** (what must be TRUE):
  1. `adb install` of the built `armeabi-v7a`/`minSdk 29` APK succeeds on TR6948, and in Airplane Mode the app opens `mvp_web/` from the `appassets.androidplatform.net` origin with ORT-Web initialized and no `.wasm`/`.onnx` MIME or fetch errors in `chrome://inspect`.
  2. User can take a plate photo with the TR6948 rear camera or pick one from the gallery and it flows into analysis; cancelling the chooser leaves the input usable for another attempt.
  3. User taps FHIR R4 JSON or CSV export and the file appears in the device's Downloads folder (verifiable with `adb shell ls /sdcard/Download`).
  4. When the WebView renderer is killed, the app recovers by reloading instead of closing; and running `scripts/sync_edge_assets.py` then rebuilding ships the current `mvp_web/` and model into the APK.
**Plans**: TBD
**UI hint**: yes

### Phase 9: Tablet UX & Manual Drug Formulary
**Goal**: On TR6948's 1024x600 screen, a technologist goes from photo to a fully assigned, interpreted plate comfortably — no OCR, no clipped layout, no memory crashes.
**Depends on**: Phase 8 (camera → ORT-Web → canvas working inside the APK)
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Inside the APK on TR6948, both 1024x600 landscape and 600x1024 portrait render full-screen with no clipped twin-phone chassis, no requests to Google Fonts, and no service worker registered.
  2. User can load 2 MP camera photos (1600x1200) and larger gallery images repeatedly without a renderer crash; display/inspection canvases never exceed 1024 px.
  3. User taps an `UNK` disk, picks its antibiotic from the 65-drug EUCAST/CLSI list, sees S/I/R update immediately, and selection auto-advances to the next `UNK` disk.
  4. User applies a one-tap panel preset (e.g. Enterobacterales, Staphylococcus) and a multi-disk plate is fully assigned in under 10 s from the first tap.
**Plans**: TBD
**UI hint**: yes

### Phase 10: TR6948 Benchmark & Variant Lock
**Goal**: Measured on-device evidence shows the full demo runs on TR6948 within latency, accuracy and memory limits, and the shipping model variant is locked.
**Depends on**: Phase 9 (complete end-to-end flow in the APK)
**Requirements**: BENCH-01, BENCH-02
**Success Criteria** (what must be TRUE):
  1. After each analysis the user sees `preprocessMs`, `ortInferenceMs`, `postprocessMs` and `totalMs` in-app.
  2. Running the `adb` profiling script during a session produces a log with WebView renderer RSS/PSS peaks and any `lmkd` kill events.
  3. A benchmark report covers 10 consecutive plates in Airplane Mode for each 320/416 × FP32/INT8 × SIMD/scalar combination, with latency, peak PSS, MAE and `lmkd` kills per variant.
  4. The locked variant meets `<= 2.0 s` inference, `MAE <= 0.50 mm` and zero `lmkd` kills, and it is the variant bundled in the APK (recorded in `model_meta.json`/config).
**Plans**: TBD
**UI hint**: yes

### Progress (v1.6)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Edge Model Split, Retrain & ONNX Export | 0/TBD | Not started | - |
| 7. In-Browser Edge Inference & Clinical Parity | 0/TBD | Not started | - |
| 8. Offline Android WebView Wrapper APK | 0/TBD | Not started | - |
| 9. Tablet UX & Manual Drug Formulary | 0/TBD | Not started | - |
| 10. TR6948 Benchmark & Variant Lock | 0/TBD | Not started | - |

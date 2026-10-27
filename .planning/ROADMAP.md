# ADLMS: Project Roadmap (ROADMAP.md)

## Milestone 1: Anteproyecto & MVP Proof of Concept (Weeks 1–4) — [CURRENT]

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

- [x] **Phase 2.6: Repository Reorganization & Architectural Housekeeping**
  - [x] Consolidate academic and thesis deliverables in `docs/academic/`.
  - [x] Move developer and operational manuals into `docs/guides/`.
  - [x] Move utility scripts into `scripts/` with robust path resolution.
  - [x] Consolidate demo datasets under `data/`.
  - [x] Add Python package initializers (`__init__.py`) across `src/`.
  - [x] Author flagship root `README.md` and clean `.gitignore`.

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

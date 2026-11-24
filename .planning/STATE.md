# ADLMS: Project State (STATE.md)

## Current Status
* **Current Phase:** Phase 2.8 — Guided Mobile Camera Capture & Perspective Alignment Assistant (READY TO PLAN)
* **Active Milestone:** Milestone 1.5 (v1.5) — DeepHalo Mobile User UI App & PWA (Parallel Track while dataset labeling completes)
* **Last Completed Phase:** Phase 2.7 (Clinical Precision Mobile Design System & Installable PWA Shell) — 100% Complete
* **Next Action:** Run `/gsd-plan-phase 2.8` to design the Guided Mobile Camera Capture & Perspective Alignment screen while dataset labeling continues.

---

## Architectural Decisions Log (ADR)

1. **ADR-001: Selection of YOLO11n INT8 on ARM NEON CPU (Zero NPU Dependency) over Classical CV and U-Net**
   * *Decision:* Adopt YOLO11n (~2.58M params, ~1.8 GMACs) quantized to INT8 (PTQ with Kullback-Leibler calibration) running 100% on standard 64-bit ARMv8-A CPUs via **ARM NEON SIMD** / WebAssembly, explicitly discarding dedicated NPU dependency.
   * *Rationale:* Resolves the tradeoff between submillimeter precision ($\text{MAE} = 0.42\text{ mm} \le 0.50\text{ mm}$ threshold, $<0.8\%$ PTQ degradation), entry-level mobile CPU latency ($\approx 550\text{--}600\text{ ms}$, $< 800\text{ ms}$ ceiling), binary weight ($3.8\text{ MB}$ INT8 vs. $12.8\text{ MB}$ FP32), and volatile RAM ($\approx 45\text{--}50\text{ MB}$ active, $< 150\text{ MB}$ ceiling). Enables operation on $\$65\text{--}\$90\text{ USD}$ entry-level phones ($\ge 2\text{ GB}$ RAM, Android Go Edition, Android 9.0+ / iOS 13.0+, $\ge 5\text{--}8\text{ MP}$ camera at $10\text{--}15\text{ cm}$). U-Net is discarded due to excessive RAM ($> 600\text{ MB}$) and latency ($5\text{--}8\text{ s}$); classical Hough + Otsu is discarded due to clinical MAE failure ($1.8\text{--}2.5\text{ mm}$, $>25\%$ failure rate).

2. **ADR-002: Dual-Track Architecture for Academic and Production Synergy**
   * *Decision:* Build Track A (Interactive Web MVP No-Code) for Phase 2 evaluation, and Track B (On-Device Edge AI Suite) for production TRL 5.
   * *Rationale:* Fully satisfies the academic rubric mandate for a web MVP while preserving the long-term Edge AI on-device roadmap.

3. **ADR-003: Human-in-the-Loop Clinical Safety Paradigm**
   * *Decision:* Always require explicit technologist confirmation prior to generating and dispatching HL7 FHIR payloads.
   * *Rationale:* Aligns with ESCMID guidelines (*Greutmann et al., 2024*) and NCh-ISO 15189:2022 clinical governance standards.

4. **ADR-004: Milestone 1.5 Parallel User UI Track & Clinical Precision Dark Instrument Design Contract**
   * *Decision:* Evolve `mvp_web/` into a full Responsive Web App / PWA (full-screen mobile app on phones + multi-panel Clinical Workstation on desktop, retaining Twin-Phone mode as a presentation toggle) governed by `/gsd-ui-phase`, `/impeccable` (`Operate` mode), and `/design-taste-frontend` (`DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 7`).
   * *Rationale:* Enables parallel frontend progress (camera alignment UI, direct canvas caliper, specimen intake, audit log, FHIR report studio) while manual dataset labeling of `Antibiogram_demo/Train` proceeds.

5. **ADR-005: Canonical 3-Class Segmentation Schema with Non-Destructive Drug-Code Collapsing**
   * *Decision:* Standardize YOLO11n-seg training (`configs/dataset.yaml`, `src/data/labelme_to_yolo.py`, `src/models/train_yolo.py`) on 3 canonical classes (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`). Preserve individual disk drug-code labels (`tgc_15`, `lev_5`, `fox_30`, etc.) in the source LabelMe `.json` files, collapsing them into `antibiotic_disk` at YOLO-seg `.txt` export time.
   * *Rationale:* Prevents class dilution across 40+ low-count drug codes on a 20–80 plate dataset while retaining `inner_colony` detection for CLSI/EUCAST resistant-subpopulation assessment and keeping drug-code ground truth intact for future OCR/classifier stages. First 20 prototype plates (484 shapes: 239 disks, 188 zones, 57 inner colonies) are converted and isolated with matching `.jpg` images in `data/Antibiogram_demo/Train_yolo/`.

6. **ADR-006: Live End-to-End Inference Pipeline from `best.pt` + EUCAST v16.1 Workbook to `run_web_mvp.py`**
   * *Decision:* Parse `src/evaluation/v_16.1_Breakpoint_Tables.xlsx` natively (`src/evaluation/eucast_breakpoints.py`), implement Section 4.6 Dual Cross-Validation (`src/evaluation/cross_validation.py`: 36-ray radial Sobel $\Delta r \le 1.2\text{ mm}$ + EUCAST intrinsic resistance alerts), boost Clinical Formulary OCR in `src/evaluation/measure_zones.py`, and serve live `POST /api/analyze` inference from `run_web_mvp.py` into `mvp_web/` (Track A) and `streamlit_app.py` (Track B).
   * *Rationale:* Connects the trained `YOLO11n-seg` model (`results/yolo11n_microbiology/weights/best.pt`) directly to the interactive clinician Web MVP and ensures clinical decisions match EUCAST v16.1 (2026-06-24) and NCh-ISO 15189:2022 audit logging (`AUDITED_BY_TECHNOLOGIST`).

---

## Technical Debt & Gaps
* [ ] Full training on large dataset needs to be executed on desktop PC / Colab GPU (Phase 3).
* [ ] Live LIS endpoint integration currently simulated via local FHIR R4 JSON export (Phase 4).

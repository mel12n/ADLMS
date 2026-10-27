# ADLMS: Project State (STATE.md)

## Current Status
* **Current Phase:** Phase 2.6 — Repository Reorganization & Architectural Housekeeping (COMPLETED & VERIFIED)
* **Active Milestone:** Milestone 1 (Anteproyecto & MVP Proof of Concept) — 100% Complete
* **Last Completed Phase:** Phase 2.6 (Repository Reorganization) — Clean modular repository layout established
* **Next Action:** Prepare Milestone 2 / Phase 3 (Deep Learning Pipeline & YOLO11n GPU Training).

---

## Architectural Decisions Log (ADR)

1. **ADR-001: Selection of YOLO11n INT8 over Classical CV and U-Net**
   * *Decision:* Adopt YOLO11n quantized to INT8 with C3k2 backbone and decoupled heads.
   * *Rationale:* Resolves the tradeoff between submillimeter precision ($\text{MAE} \le 0.45\text{ mm}$) and mobile CPU latency ($< 800\text{ ms}$), with a memory footprint $< 150\text{ MB}$. U-Net is discarded due to excessive RAM ($> 600\text{ MB}$) and latency ($> 5\text{ s}$). Classical Hough circle transform is discarded due to failure with irregular biological halos.

2. **ADR-002: Dual-Track Architecture for Academic and Production Synergy**
   * *Decision:* Build Track A (Interactive Web MVP No-Code) for Phase 2 evaluation, and Track B (On-Device Edge AI Suite) for production TRL 5.
   * *Rationale:* Fully satisfies the academic rubric mandate for a web MVP while preserving the long-term Edge AI on-device roadmap.

3. **ADR-003: Human-in-the-Loop Clinical Safety Paradigm**
   * *Decision:* Always require explicit technologist confirmation prior to generating and dispatching HL7 FHIR payloads.
   * *Rationale:* Aligns with ESCMID guidelines (*Greutmann et al., 2024*) and NCh-ISO 15189:2022 clinical governance standards.

---

## Technical Debt & Gaps
* [ ] Full training on large dataset needs to be executed on desktop PC / Colab GPU (Phase 3).
* [ ] Live LIS endpoint integration currently simulated via local FHIR R4 JSON export (Phase 4).

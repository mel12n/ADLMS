# ADLMS: Requirements Specification (REQUIREMENTS.md)

## 1. Functional Requirements (FR)

### FR-1: Image Ingestion & Preset Library
* **FR-1.1:** The system shall allow users to upload arbitrary photographic images (JPEG, PNG, WebP) of agar plates captured at the laboratory bench.
* **FR-1.2:** The system shall provide a built-in library of representative Kirby-Bauer plate presets from the `Antibiogram_demo` dataset (*E. coli*, *S. aureus*, *P. aeruginosa*, *K. pneumoniae*) for one-click testing without requiring immediate sample preparation.
* **FR-1.3:** Drag-and-drop file interface with real-time thumbnail preview.

### FR-2: Adaptive Optical Normalization (CLAHE) & ROI Isolation
* **FR-2.1:** The system shall apply Contrast Limited Adaptive Histogram Equalization (CLAHE) on the luminance channel to eliminate uneven bench lighting, shadows, and tube reflections.
* **FR-2.2:** The system shall detect the circular outer perimeter of the Petri dish using Hough Circle Transform geometry and isolate the Region of Interest (ROI), eliminating background workbench noise.
* **FR-2.3:** Provide a visual Before/After comparison toggle for optical validation.

### FR-3: Fiducial Metric Calibration (6.0 mm Disc Anchor)
* **FR-3.1:** The system shall automatically detect commercial antibiotic filter paper discs and use their standardized 6.0 mm nominal diameter to compute the exact spatial scale factor:
  $$F_{\text{scale}} = \frac{6.0\text{ mm}}{D_{\text{disc\_pixels}}}$$
* **FR-3.2:** The scale calibration shall render all resulting zone measurements strictly in physical millimeters, independent of smartphone distance or camera zoom.

### FR-4: Inhibition Zone Detection & Metric Regression
* **FR-4.1:** The system shall locate all antibiotic discs present on the plate and determine the radial extent of the clear lysis halo surrounding each disc.
* **FR-4.2:** For each detected assay, the system shall report:
  * Antibiotic name and nominal potency (e.g., Ciprofloxacin $5\,\mu\text{g}$, Cefotaxime $30\,\mu\text{g}$).
  * Measured diameter in physical millimeters ($\pm 0.1\text{ mm}$).
  * Circular overlay rendered directly on the Canvas with coordinate labels.

### FR-5: Human-in-the-Loop Interactive Caliper Editing
* **FR-5.1:** The technologist shall be able to click on any detected halo on the Canvas to inspect its radius and boundary contour.
* **FR-5.2:** The user shall be provided with interactive caliper handles (slider or drag handle) to manually expand, contract, or re-center the halo boundary in cases of irregular growth or swarming colonies.
* **FR-5.3:** All manual overrides shall be tagged with an `AUDITED_BY_TECHNOLOGIST` audit status in the generated report.

### FR-6: Post-Hoc XAI Explainability (Grad-CAM Heatmap)
* **FR-6.1:** The system shall provide an interactive Grad-CAM heatmap visualization overlay ($\alpha = 0.4$, JET colormap).
* **FR-6.2:** The heatmap shall highlight class-discriminative activation regions, confirming to the clinician that the detection focuses on true bacterial lysis boundaries rather than plastic plate scratches or marker labels.

### FR-7: Clinical Decision Support (EUCAST v16.0 / CLSI M100)
* **FR-7.1:** The system shall match the measured millimeters against clinical breakpoint tables (EUCAST 2026 v16.0 and CLSI M100).
* **FR-7.2:** The system shall categorize each test into:
  * **S (Susceptible):** Standard dosage regimen effective.
  * **I (Susceptible, Increased Exposure):** High dosage regimen required.
  * **R (Resistant):** Ineffective antimicrobials; therapeutic failure expected.
* **FR-7.3:** Visual badge indicators using clinical alert colors (Emerald for S, Amber for I, Crimson for R).

### FR-8: Healthcare Interoperability Middleware (HL7 FHIR R4)
* **FR-8.1:** The system shall serialize the validated antibiogram results into a compliant HL7 FHIR Release 4 JSON payload.
* **FR-8.2:** The payload shall generate an `Observation` resource for each tested antibiotic and assemble them into a master `DiagnosticReport` resource.
* **FR-8.3:** Standard terminologies must be included: LOINC code `18769-0` (Microbial susceptibility test) and SNOMED CT terminology for clinical findings.
* **FR-8.4:** One-click copy and JSON download functionality.

---

## 2. Non-Functional Requirements (NFR)

* **NFR-1 (Latency & Performance):** End-to-end rendering and calculation must execute in $\text{TRT} \le 2.0\text{ seconds}$ on standard client devices.
* **NFR-2 (Zero-Install Portability):** The standalone web MVP shall run in any modern web browser without requiring prior installation of Python, CUDA, PyTorch, or Docker.
* **NFR-3 (Privacy by Design):** All image processing and FHIR bundle generation must happen 100% locally on the client or local machine, ensuring full compliance with Chilean Law N° 21.719 and HIPAA de-identification requirements.
* **NFR-4 (Visual Excellence & Ergonomics):** Dark-mode glassmorphic user interface designed for high-contrast visibility in laboratory environments, with legible typography and responsive layout.

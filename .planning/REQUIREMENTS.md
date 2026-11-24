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

### FR-9: 100% Mobile-First App / Installable PWA Shell (Milestone 1.5)
* **FR-9.1:** The web application (`mvp_web/`) shall operate as a 100% mobile-native-feel Web App / PWA (`manifest.webmanifest` + offline service worker) that runs full-screen on smartphones and renders inside an interactive smartphone chassis when previewed on a desktop/laptop browser.
* **FR-9.2:** Provide a simple preview toggle on desktop between **Single-Phone App Mode** (testing the real 3-tab mobile flow on one screen) and **Twin-Phone Presentation Mode** (academic defense side-by-side view).

### FR-10: Guided Camera Capture & Perspective Alignment Assistant (Milestone 1.5)
* **FR-10.1:** Dedicated **Capturar** screen supporting both live device camera stream (`getUserMedia`) and drag-and-drop / file picker plate ingestion.
* **FR-10.2:** Circular Petri dish alignment reticle (`90 mm` nominal aspect guide) with live perspective/tilt feedback (device orientation sensor + elliptical eccentricity check) warning the operator when camera tilt exceeds $\pm 5^\circ$.
* **FR-10.3:** Pre-flight quality checklist badge verifying plate framing, illumination uniformity (CLAHE preview), and 6.0 mm fiducial disc visibility before committing capture.

### FR-11: Interactive Plate Inspector, Dual Cross-Validation & Sticky Caliper (Milestone 1.5)
* **FR-11.1:** Live fiducial telemetry displaying median detected 6.0 mm disc diameter in pixels, computed scale factor ($F_{\text{scale}}$ in $\text{px/mm}$ and $\text{mm/px}$), and perspective eccentricity score.
* **FR-11.2:** **Geometric Cross-Validation (YOLO11n vs. 36-Ray Radial Sobel Gradient):** Compare neural radius ($\hat{r}_{\text{yolo}}$) against the median radial Sobel gradient profile ($\hat{r}_{\text{sobel}}$ across 36 rays every $10^\circ$). Validate in green when $\Delta r = |\hat{r}_{\text{yolo}} - \hat{r}_{\text{sobel}}| \le 1.2\text{ mm}$; if $\Delta r > 1.2\text{ mm}$, block auto-dispatch and flag a geometric discrepancy requiring manual technologist review.
* **FR-11.3:** **Biological & Phenotypic Cross-Validation (Intrinsic Resistance Engine):** Cross-check measured phenotypes against EUCAST/CLSI intrinsic resistance rules (e.g., *Klebsiella pneumoniae* constitutional `SHV-1` resistance to Ampicillin), overriding discordant `S` readings and raising a high-priority clinical alert (`Alerta EUCAST: Resistencia Intrínseca - Fenotipo Clínicamente Discordante`).
* **FR-11.4:** **Two-Touch Gloved Clinical Workflow & Direct "Sticky Caliper" Gesture:** Enable 90% of routine plates to complete in **2 touches** with nitrile/latex gloves (**Touch 1:** Capture & `< 600 ms` automated analysis; **Touch 2:** `Validar y enviar a LIS`), with a direct on-canvas touch-drag **Sticky Caliper** gesture (plus `±0.5 mm` steppers) for exception plates.

### FR-12: Specimen Intake, Audit Trail & Clinical Report Studio (Milestone 1.5)
* **FR-12.1:** Editable specimen intake drawer/card (16-digit anonymized Sample ID under Chilean Law N° 21.719, Isolate Organism selector with ATCC/clinical strains, Gram group, Technologist ID).
* **FR-12.2:** Immutable session audit trail recording every manual caliper override (`AUDITED_BY_TECHNOLOGIST`, timestamp, previous vs. new diameter, geometric/biological alert resolution) per NCh-ISO 15189:2022 clauses 7.3.3 & 7.4.1.5.
* **FR-12.3:** Clinical Report Studio modal providing 100% syntactically valid (`TIS = 100%`) HL7 FHIR R4 `Bundle` (`DiagnosticReport` + `Observation` resources with LOINC `18769-0` and SNOMED CT `70549008`), 1-click clipboard copy, `.json` download, and `.csv` tabular export.

---

## 2. Non-Functional Requirements (NFR)

* **NFR-1 (Latency & Performance):** End-to-end rendering and calculation must execute in $\text{TRT} \le 2.0\text{ seconds}$, with pure INT8 Edge AI inference running in **$550\text{--}600\text{ ms}$** ($\le 800\text{ ms}$ ceiling) at $\approx 1.8\text{ GMACs}$ per static plate image on standard mobile ARM CPUs.
* **NFR-2 (Zero-Install Portability & NPU Independence):** 100% decoupled from dedicated NPUs or GPUs. Executes on any standard mobile CPU via **ARM NEON SIMD** instructions or browser **WebAssembly (Wasm)** without requiring cloud servers, Python, CUDA, or proprietary chip vendor SDKs.
* **NFR-3 (Privacy by Design):** All image processing and FHIR bundle generation must happen 100% locally/offline on the client device, ensuring full compliance with Chilean Law N° 21.719 and NCh-ISO 15189:2022.
* **NFR-4 (Visual Excellence & Gloved Ergonomics):** Dark-mode clinical instrument UI designed to prevent occupational asthenopia (visual fatigue across 8–12 h shifts, targeting $\text{NASA-TLX} \le 35\text{ pts}$, $\text{SUS} \ge 80\text{ pts}$, and $\text{RTM} \ge 65\%$ bench time reduction from $\sim 180\text{ s}$ to $< 60\text{ s}$), with oversized touch targets operable with nitrile/latex gloves.
* **NFR-5 (Clinical Precision Dark Instrument Contract):** Adhere to `/impeccable` (`Operate` mode) and `/design-taste-frontend` (`DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 7`): obsidian/slate surfaces (`#070b12` / `#0d131f`), sharp `1px` structural hairlines, tabular monospace metric readouts (`JetBrains Mono`), WCAG AA contrast on all interactive controls, and strict clinical semantic accents (Emerald `S`, Amber `I`, Crimson `R`, Sky/Teal instrument focus).
* **NFR-6 (Minimum Target Mobile Device & Entry-Level Hardware Baseline — Section 4.3 of Phase 2 Report):**
  * **Processor (SoC):** 64-bit ARMv8-A or higher with native **ARM NEON SIMD** vector extensions; zero NPU/GPU required. Compatible with entry-level commercial chipsets ($\approx \$65\text{--}\$90\text{ USD}$ / $\$65.000\text{--}\$85.000\text{ CLP}$ phones, $>96\%$ compatibility across smartphones manufactured since 2019):
    * **Unisoc:** `T606`, `T612`, `T616` (e.g., *Xiaomi Redmi A3*, *Motorola Moto E13*, *ZTE Blade A53*)
    * **MediaTek:** `Helio A22`, `G35`, `G36`, `G85`, `G88`, `G99` (e.g., *Xiaomi Redmi 13C*, *Samsung Galaxy A15*)
    * **Qualcomm:** `Snapdragon 480`, `680`, `685`, `4 Gen 1`
    * *Only exclusion:* Obsolete 32-bit ARMv7 devices (pre-2015) or devices with $< 1.5\text{ GB}$ RAM.
  * **Volatile Memory (RAM):** **Minimum $2\text{ GB}$ total RAM** (fully compatible with **Android Go Edition**; $3\text{--}4\text{ GB}$ suggested when running multiple concurrent hospital background apps). The INT8 engine (`LiteRT` / `ONNX Runtime`) allocates only **$\approx 45\text{--}50\text{ MB}$** of volatile RAM during inference (hard ceiling $< 150\text{ MB}$), leaving $> 1.1\text{ GB}$ free for the OS and eliminating Android *Low Memory Killer* (OOM) termination risks.
  * **Optical Sensor (Camera):** Standard rear camera **$\ge 5\text{ MP}$ or $8\text{ MP}$** with basic autofocus at a **$10\text{--}15\text{ cm}$** working distance. No high-end sensor or Optical Image Stabilization (OIS) is required because the $6.0 \pm 0.1\text{ mm}$ filter paper disc serves as the intra-image fiducial anchor.
  * **Operating System & Web Runtime:** **Android 9.0+ (Pie / API 28+)** or **iOS 13.0+**, equipped with a modern WebView or browser supporting **WebAssembly (Wasm)**.
  * **Free Storage:** **$\ge 30\text{ MB}$** available storage (the PTQ INT8 quantized YOLO11n binary weighs only **$3.8\text{ MB}$** / $< 4\text{ MB}$ vs. $12.8\text{ MB}$ in FP32, with $< 0.8\%$ metric degradation via Kullback-Leibler divergence calibration).

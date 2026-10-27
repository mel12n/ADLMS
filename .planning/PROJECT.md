# ADLMS: Advanced Deep Learning Microbiology Suite (DeepHalo)
## Project Context & Vision

> **Status:** Active  
> **Milestone:** MVP v1.0 (Phase 2 Deliverable & Proof of Concept)  
> **Course / Academic Program:** Anteproyecto (ACIF3003) — Universidad Andrés Bello  
> **Architecture:** Dual-Hybrid Edge AI & Web MVP (Standalone Glassmorphism Canvas + Python Streamlit)  

---

## 1. Project Overview & Vision
ADLMS (Advanced Deep Learning Microbiology Suite), materialized in the user-facing application **DeepHalo**, is an AI-driven clinical microbiology support system for the automated reading, interpretation, and electronic reporting of antimicrobial disk diffusion assays (Kirby-Bauer test).

The system addresses the critical bottleneck of manual caliper/ruler measurement in clinical laboratories, which suffers from:
1. **Inter-operator variability (10% to 25% discordance)** in reading zone diameters.
2. **Analysis latency (up to 3–5 minutes per plate)**, creating turn-around delays in septicemia cases.
3. **Typographical transcription errors (1% to 3% error rate)** when manually copying diameters from bench to Laboratory Information Systems (LIS).
4. **Global Antimicrobial Resistance (AMR) escalation**, fueled by delayed susceptibility reports that force prolonged empirical broad-spectrum antibiotic usage.

---

## 2. Core Capabilities & Value Proposition
* **Automated Optical Normalization:** Contrast Limited Adaptive Histogram Equalization (CLAHE in CIE L\*a\*b\* space) to eliminate fluorescent tube reflections and shadows on agar surfaces.
* **Physical Fiducial Anchor:** Uses the standardized 6.0 mm diameter of commercial paper discs to establish a mathematically rigorous pixel-to-millimeter scale factor ($F_{\text{scale}}$), making measurements independent of shooting distance.
* **Single-Stage Edge AI Inference:** YOLO11n quantized to INT8 (post-training quantization with Kullback-Leibler calibration) detecting 4 core classes: `colony`, `inhibition_zone`, `antibiotic_disk`, `empty_plate`.
* **Post-Hoc Explainability (XAI):** Grad-CAM heatmaps superimposing class-discriminative activation gradients over the zone margin, enabling **Human-in-the-Loop** verification by Medical Technologists.
* **Clinical Decision Support:** Integrated breakpoint engine applying EUCAST v16.0 / CLSI M100 criteria to categorize isolates into Susceptible (S), Susceptible at increased exposure (I), and Resistant (R).
* **Healthcare Interoperability Middleware:** Direct export of HL7 FHIR Release 4 standard JSON payloads (`DiagnosticReport` and `Observation` resources) with LOINC (`18769-0`) and SNOMED CT (`70549008`) terminologies.
* **Privacy by Design:** Strict adherence to Chilean Law N° 21.719 on Personal Data Protection through 100% on-device/client-side local inference without third-party cloud data transmission.

---

## 3. Technology Stack (Dual-Hybrid MVP)

### Track A: Standalone High-End Web MVP (`mvp_web/`)
* **Frontend:** HTML5, Canvas API, Vanilla JavaScript (ES2022).
* **UI/UX & Aesthetics:** Vanilla CSS, sleek dark-mode glassmorphism, responsive grid, micro-animations, Inter font.
* **Image Processing Engine:** In-browser Canvas image processing (LAB CLAHE filter emulation, Hough circle estimation, metric caliper ruler, Grad-CAM jet colormap renderer).
* **Zero Dependency Guarantee:** Runs directly in any modern browser via local HTTP server or static hosting.

### Track B: Python Streamlit Application (`streamlit_app.py`)
* **Framework:** Streamlit (Python 3.10+).
* **Data & Image Processing:** NumPy, Pillow, OpenCV (fallback-resilient), Matplotlib.
* **Deployment Target:** Streamlit Community Cloud / Hugging Face Spaces.
* **Backend Modules:** Direct import of `src.data.preprocess`, `src.models.export_model`, and `src.evaluation.grad_cam`.

---

## 4. Key Constraints & Guardrails
* **Clinical Safety:** The system never operates as an autonomous diagnostic agent; it functions strictly as a Human-in-the-Loop clinical decision support system.
* **Submillimeter Accuracy:** Radial Mean Absolute Error must satisfy $\text{MAE} \le 0.50\text{ mm}$ to prevent classification errors in EUCAST category "I".
* **Latency Threshold:** Complete end-to-end processing pipeline from image upload to report generation must render in $\text{TRT} \le 2.0\text{ seconds}$.
* **Compliance:** NCh-ISO 15189:2022 trace audit log requirement and Chilean Law N° 21.719 privacy compliance.

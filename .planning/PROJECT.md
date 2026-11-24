# ADLMS: Advanced Deep Learning Microbiology Suite (DeepHalo)
## Project Context & Vision

> **Status:** Active  
> **Milestone:** Milestone 1.6 (v1.6) — Edge Device Demo (TR6948)  
> **Course / Academic Program:** Anteproyecto (ACIF3003) — Universidad Andrés Bello  
> **Architecture:** Dual-Hybrid Edge AI & Mobile Web App / PWA + Offline Android WebView Wrapper (TR6948)

---

## Current Milestone: v1.6 Edge Device Demo (TR6948)

**Goal:** Deliver the `run_web_mvp.py` demo experience (upload/capture plate → YOLO11n-seg segmentation → mm calibration via 6.0 mm disk → EUCAST v16.1 S/I/R → report) running fully on-device on the USB-attached TR6948 with no PC required at runtime.

**Target features:**
- Train `YOLO11n-seg` on the 20 labeled plates in `data/Antibiogram_demo/Train_yolo` (`configs/dataset.yaml`, `src/models/train_yolo.py`) → `results/yolo11n_microbiology/weights/best.pt`.
- Export to compact ONNX (320–416 px input, INT8 or FP16) sized to fit TR6948's ~1 GB RAM budget (~22 MB free, 726 MB swap at idle).
- Port mask decoding, disk/zone radial measurement, 6.0 mm fiducial scale factor, and EUCAST v16.1 breakpoint lookup (from `configs/eucast_v16_1_breakpoints.json`) to browser JavaScript, using manual drug selection instead of EasyOCR.
- Bundle `mvp_web/` + `onnxruntime-web` (WASM, single-thread, no SIMD assumptions) offline inside a minimal Android WebView wrapper APK (`armeabi-v7a`, `minSdk 29`) installed via `adb`.
- Benchmark end-to-end latency and peak RAM on the physical TR6948 device.

**Device Constraints & ADR-001 Delta (TR6948 Hardware Profile):**
- Captured via `adb` on 2026-11-20 & 2026-11-24: `TR6948` (Allwinner `sun50iw10p1`), Android 10 (API 29), 32-bit `armeabi-v7a` (`armv8l` kernel with NEON/vfpv4), `968 MB` total RAM (`~22 MB` free + `726 MB` swap), `1024x600@160dpi`, `2 MP` back camera, Chrome `81.0.4044.138` (no modern WASM SIMD), Android System WebView `119.0.6045.163`.
- Conflicts with ADR-001's production baseline (64-bit ARMv8-A, $\ge 2\text{ GB}$ RAM): v1.6 explicitly targets this constrained 32-bit ~1 GB demo hardware via a WebView 119 wrapper APK and single-threaded non-SIMD WASM fallback.  

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
* **Single-Stage Edge AI Inference:** YOLO11n-seg quantized to INT8 (post-training quantization with Kullback-Leibler calibration) segmenting 3 core clinical classes: `0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony` (raw drug codes preserved in source `.json` labels and collapsed to `antibiotic_disk` during YOLO-seg export).
* **Post-Hoc Explainability (XAI):** Grad-CAM heatmaps superimposing class-discriminative activation gradients over the zone margin, enabling **Human-in-the-Loop** verification by Medical Technologists.
* **Clinical Decision Support:** Integrated breakpoint engine parsing official EUCAST v16.1 (`src/evaluation/v_16.1_Breakpoint_Tables.xlsx`) + CLSI M100 criteria with 36-ray Sobel geometric cross-validation ($\Delta r \le 1.2\text{ mm}$) and EUCAST intrinsic resistance alerts (`src/evaluation/cross_validation.py`).
* **Live Edge Backend & Web MVP (`run_web_mvp.py`):** Local threaded HTTP server serving `mvp_web/` and exposing `/api/health` + `/api/analyze` for live `YOLO11n-seg` segmentation, WHONET Clinical Formulary OCR, and EUCAST v16.1 interpretation.
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

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

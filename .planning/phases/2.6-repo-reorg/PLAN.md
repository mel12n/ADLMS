# Phase 2.6: Repository Reorganization & Architectural Housekeeping

**Phase ID:** 2.6-repo-reorg  
**Goal:** Transform `d:\Bots\ADLMS` into a clean, enterprise-grade, publication-ready repository by modularizing documentation, utility scripts, and datasets while maintaining seamless 1-click execution for all applications.  
**Author:** Antigravity Pairing Agent  
**Date:** 2026-10-26  

---

## 1. Executive Summary & Target Structure

### 1.1 Before State (Root Clutter)
```text
D:\Bots\ADLMS\
├── acif200_s12_MelianC.md    <-- Root clutter (105 KB academic deliverable)
├── Poyecto.md                <-- Root clutter (37 KB thesis proposal)
├── antigravity_skills.md     <-- Root clutter (11 KB guide)
├── desktop_setup_guide.md    <-- Root clutter (3 KB guide)
├── MILESTONES.md             <-- Root clutter (2.5 KB milestone list)
├── build_code_map.py         <-- Root clutter (utility script)
├── build_mvp_plates.py       <-- Root clutter (utility script)
├── codebase_map.json         <-- Root clutter (generated map)
├── AGAR_demo/                <-- Loose dataset directory
├── Antibiogram_demo/         <-- Loose dataset directory
├── graphify-out/             <-- Loose analysis artifacts
├── configs/
├── mvp_web/
├── src/
├── requirements.txt
├── run_app.bat
├── run_web_mvp.py
└── streamlit_app.py
```

### 1.2 After State (Standard Clean Repository Layout)
```text
D:\Bots\ADLMS\
├── .antigravity/                   # IDE agent metadata & conversation checkpoints
├── .git/                           # Version control
├── .gitignore                      # Clean ignore rules (cache, temp files, bytecode)
├── .planning/                      # GSD roadmap, specifications, and state
├── configs/                        # System & model configuration files (dataset.yaml)
├── data/                           # [Unified Data Layer]
│   ├── AGAR_demo/                  # AGAR benchmark sample plates
│   └── Antibiogram_demo/           # Hand-annotated Kirby-Bauer training/test plates
├── docs/                           # [Unified Documentation Layer]
│   ├── academic/                   # Official thesis deliverables & proposals
│   │   ├── acif200_s12_MelianC.md  # Anteproyecto Phase 2 Report
│   │   └── Proyecto_Propuesta.md   # Project formulation proposal (renamed from Poyecto.md)
│   ├── architecture/               # System architecture & milestones
│   │   ├── MILESTONES.md           # Milestone roadmap & tracking
│   │   └── graphify/               # Graphify AST analysis outputs
│   └── guides/                     # Setup & developer manuals
│       ├── desktop_setup_guide.md  # GPU desktop & PyTorch CUDA setup
│       └── antigravity_skills.md   # Antigravity agent customization guide
├── mvp_web/                        # Standalone Web Application (HTML5, Canvas, CSS, JS, logos)
├── scripts/                        # [Developer & Build Utilities]
│   ├── build_code_map.py           # Codebase AST graph analyzer
│   ├── build_mvp_plates.py         # MVP sample plate extractor & builder
│   └── codebase_map.json           # Cached codebase mapping
├── src/                            # Core Python Application Package
│   ├── __init__.py                 # Root package initializer
│   ├── data/                       # Preprocessing & augmentation pipelines
│   ├── evaluation/                 # Metrics & Grad-CAM analysis
│   ├── models/                     # Model architecture, training & ONNX export
│   └── utils/                      # Clinical constants & helpers
├── README.md                       # [Flagship Document] Comprehensive project manual & quickstart
├── requirements.txt                # Python environment dependencies
├── run_app.bat                     # 1-Click interactive launcher (Track A / Track B)
├── run_web_mvp.py                  # Standalone Web MVP server runner
└── streamlit_app.py                # Scientific Streamlit dashboard
```

---

## 2. Work Breakdown & Execution Waves

### Wave 1: Directory Scaffolding & Documentation Migration
* **Task 1.1:** Create folder structure:
  * `docs/academic/`
  * `docs/architecture/`
  * `docs/guides/`
  * `scripts/`
  * `data/`
* **Task 1.2:** Move academic deliverables:
  * Move `acif200_s12_MelianC.md` $\rightarrow$ `docs/academic/acif200_s12_MelianC.md`.
  * Move `Poyecto.md` $\rightarrow$ `docs/academic/Proyecto_Propuesta.md`.
* **Task 1.3:** Move guides & architecture docs:
  * Move `desktop_setup_guide.md` $\rightarrow$ `docs/guides/desktop_setup_guide.md`.
  * Move `antigravity_skills.md` $\rightarrow$ `docs/guides/antigravity_skills.md`.
  * Move `MILESTONES.md` $\rightarrow$ `docs/architecture/MILESTONES.md`.
  * Move `graphify-out/` $\rightarrow$ `docs/architecture/graphify/`.

### Wave 2: Utility Scripts Migration & Path Hardening
* **Task 2.1:** Move utility scripts to `scripts/`:
  * Move `build_code_map.py` $\rightarrow$ `scripts/build_code_map.py`.
  * Move `build_mvp_plates.py` $\rightarrow$ `scripts/build_mvp_plates.py`.
  * Move `codebase_map.json` $\rightarrow$ `scripts/codebase_map.json`.
* **Task 2.2:** Update path resolutions in `scripts/build_mvp_plates.py`:
  * Update `BASE = Path(__file__).resolve().parent.parent`.
  * Add multi-path search for `Antibiogram_demo`: check `BASE / "data" / "Antibiogram_demo"` first, with fallback to `BASE / "Antibiogram_demo"`.
  * Keep `OUT_DIR = BASE / "mvp_web"`.
* **Task 2.3:** Update path resolutions in `scripts/build_code_map.py`:
  * Default root directory to `Path(__file__).resolve().parent.parent` so executing from any directory resolves the repo root correctly.

### Wave 3: Dataset Consolidation under `data/`
* **Task 3.1:** Move `Antibiogram_demo/` into `data/Antibiogram_demo/`.
* **Task 3.2:** Move `AGAR_demo/` into `data/AGAR_demo/`.
* **Task 3.3:** Verify `src/utils/constants.py` aligns with `DATA_DIR = BASE_DIR / "data"`.
* **Task 3.4:** Update `configs/dataset.yaml` to reference paths relative to `data/`.

### Wave 4: Python Package Modernization & Gitignore Polish
* **Task 4.1:** Add `__init__.py` files across all `src/` modules:
  * `src/__init__.py`
  * `src/data/__init__.py`
  * `src/evaluation/__init__.py`
  * `src/models/__init__.py`
  * `src/utils/__init__.py`
* **Task 4.2:** Polish `.gitignore`:
  * Ignore `__pycache__/`, `*.pyc`, `.pytest_cache/`, `results/`, `runs/`, `.venv/`, `.DS_Store`.

### Wave 5: Flagship `README.md` Creation & Launcher Validation
* **Task 5.1:** Author root `README.md`:
  * DeepHalo & ADLMS overview (Clinical problem, AMR, Kirby-Bauer, ISO 15189).
  * Architecture overview (Track A Web MVP & Track B Streamlit).
  * Clean repository directory map.
  * Quickstart guide (1-click `run_app.bat`, manual commands, prerequisites).
  * Clinical standards adherence (CLSI M100, EUCAST v16.0, HL7 FHIR R4).
* **Task 5.2:** Verify root launchers (`run_app.bat`, `run_web_mvp.py`, `streamlit_app.py`) remain functional without broken imports.

---

## 3. Verification Protocol & Quality Gates

| Check | Tool / Action | Expected Result |
|---|---|---|
| **Root Cleanliness** | `list_dir(d:\Bots\ADLMS)` | Exactly 4 root code files (`README.md`, `requirements.txt`, `run_app.bat`, `run_web_mvp.py`, `streamlit_app.py`) and standard clean directories (`data/`, `docs/`, `mvp_web/`, `scripts/`, `src/`, `configs/`, `.planning/`). |
| **Dataset Extraction** | `python scripts/build_mvp_plates.py` | Exits with 0, successfully builds `mvp_web/plates_data.js` using `data/Antibiogram_demo/Train`. |
| **Codebase Mapping** | `python scripts/build_code_map.py` | Exits with 0, generates `scripts/codebase_map.json` mapping all Python files. |
| **Web MVP Execution** | `python run_web_mvp.py` | Starts HTTP server on port 8000 serving `mvp_web/index.html` seamlessly. |
| **Git Integrity** | `git status` | Tracked moves verified cleanly without untracked phantom files. |

---

## 4. Reversibility & Risk Assessment
* **Reversibility Rating:** `two-way-door` (Git-tracked repository).
* **Data Loss Risk:** Zero. All moves will be executed sequentially with verification checks.
* **Compatibility:** All script path lookups will feature backward-compatible fallbacks.

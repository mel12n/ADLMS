# Graph Report - ADLMS  (2026-09-24)

## Corpus Check
- 17 files · ~6,108,513 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: (none) 1)

## Summary
- 309 nodes · 306 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `35bc4c7a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- |
- 2. Skill Specifications
- constants.py
- Proposed Changes
- SISTEMA AUTOMATIZADO DE SOPORTE ANALÍTICO MÓVIL BASADO EN EDGE AI E INTELIGENCIA ARTIFICIAL EXPLICABLE PARA LA INTERPRETACIÓN DE ENSAYOS EN EL LABORATORIO DE MICROBIOLOGÍA CLÍNICA
- Deep Learning Model for Microbiology Laboratory Image Analysis (ADLMS)
- Desktop PC (Intel i7) Setup & Training Guide
- augment.py
- build_code_map.py
- generate_gradcam_heatmap

## God Nodes (most connected - your core abstractions)
1. `|` - 175 edges
2. `2. Skill Specifications` - 10 edges
3. `Desktop PC (Intel i7) Setup & Training Guide` - 8 edges
4. `Proposed Changes` - 7 edges
5. `Deep Learning Model for Microbiology Laboratory Image Analysis (ADLMS)` - 6 edges
6. `Phase 2 — Data Pipeline` - 6 edges
7. `SISTEMA AUTOMATIZADO DE SOPORTE ANALÍTICO MÓVIL BASADO EN EDGE AI E INTELIGENCIA ARTIFICIAL EXPLICABLE PARA LA INTERPRETACIÓN DE ENSAYOS EN EL LABORATORIO DE MICROBIOLOGÍA CLÍNICA` - 6 edges
8. `Google Antigravity Skill Definitions (`SKILLS.md`)` - 5 edges
9. `AG-SKILL-07: Discord Rate Limit & Resiliency Audit` - 5 edges
10. `preprocess_plate_image()` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "|"
Cohesion: 0.01
Nodes (174): |, ≥ 0.95., 1, 10, 11, 12, 13, 14 (+166 more)

### Community 1 - "2. Skill Specifications"
Cohesion: 0.05
Nodes (38): 1. Core Agent Capabilities, 2. Skill Specifications, 3. Global Guardrails & Rules, AG-SKILL-01: Code Base Refactoring & Modernization, AG-SKILL-02: Automated Test & Artifact Generation, AG-SKILL-03: Autonomous CLI & Subagent Orchestration, AG-SKILL-04: Root Cause Analysis & Debugging Loop, AG-SKILL-05: Architecture Mapping & ADR Documentation (+30 more)

### Community 2 - "constants.py"
Cohesion: 0.09
Nodes (19): convert_agar_json_to_yolo(), Parse AGAR per-image JSON files and convert annotations to YOLO format. Input…, ensure_directories(), generate_synthetic_agar_samples(), main(), Create full dataset directory structure., Generate synthetic agar plate images with bacterial colonies and inhibition…, apply_clahe() (+11 more)

### Community 3 - "Proposed Changes"
Cohesion: 0.09
Nodes (22): [NEW] [augment.py](file:///media/mel12n/Datos/git/ADLMS/src/data/augment.py), [NEW] [build_code_map.py](file:///media/mel12n/Datos/git/ADLMS/build_code_map.py), [NEW] [coco_to_yolo.py](file:///media/mel12n/Datos/git/ADLMS/src/data/coco_to_yolo.py), [NEW] [codebase_map.json](file:///media/mel12n/Datos/git/ADLMS/codebase_map.json), [NEW] [dataset.yaml](file:///media/mel12n/Datos/git/ADLMS/configs/dataset.yaml), [NEW] [download_agar.py](file:///media/mel12n/Datos/git/ADLMS/src/data/download_agar.py), [NEW] [evaluate.py](file:///media/mel12n/Datos/git/ADLMS/src/evaluation/evaluate.py), [NEW] [export_model.py](file:///media/mel12n/Datos/git/ADLMS/src/models/export_model.py) (+14 more)

### Community 4 - "SISTEMA AUTOMATIZADO DE SOPORTE ANALÍTICO MÓVIL BASADO EN EDGE AI E INTELIGENCIA ARTIFICIAL EXPLICABLE PARA LA INTERPRETACIÓN DE ENSAYOS EN EL LABORATORIO DE MICROBIOLOGÍA CLÍNICA"
Cohesion: 0.14
Nodes (13): a. Optimización de Visión Computacional en el Borde (Edge AI), b. Ruptura de la Opacidad Algorítmica (Inteligencia Artificial Explicable - XAI), c. Arquitectura Decoupled e Interoperabilidad de Datos Médicos, Facultad de Ingeniería, II. Índice, III. Introducción a la problemática, Ingeniería Civil Informática Advance, IV. Definición y fundamentación de la problemática (+5 more)

### Community 5 - "Deep Learning Model for Microbiology Laboratory Image Analysis (ADLMS)"
Cohesion: 0.15
Nodes (12): Additional Key References from the Document, Automated Tests, Deep Learning Model for Microbiology Laboratory Image Analysis (ADLMS), Hardware Analysis (Resolved), Image Bank / Datasets, Machine Inventory, Manual Verification, Open Questions (+4 more)

### Community 6 - "Desktop PC (Intel i7) Setup & Training Guide"
Cohesion: 0.20
Nodes (9): Desktop PC (Intel i7) Setup & Training Guide, Monitoring Progress, Prerequisites, Step 1: Transfer the Project, Step 2: Install Dependencies, Step 3: Add the Full AGAR Dataset, Step 4: Convert Annotations to YOLO Format, Step 5: Start the Full Training (+1 more)

### Community 7 - "augment.py"
Cohesion: 0.40
Nodes (4): get_training_augmentation(), get_validation_augmentation(), Simple resize for validation images., Data augmentation pipeline tailored for microbiology agar plate images.…

## Knowledge Gaps
- **238 isolated node(s):** `YOLO Repository`, `Image Bank / Datasets`, `Additional Key References from the Document`, `Machine Inventory`, `Recommended Training Strategy` (+233 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 254 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Proposed Changes` connect `Proposed Changes` to `Deep Learning Model for Microbiology Laboratory Image Analysis (ADLMS)`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `YOLO Repository`, `Image Bank / Datasets`, `Additional Key References from the Document` to the rest of the system?**
  _238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `|` be split into smaller, more focused modules?**
  _Cohesion score 0.011560693641618497 - nodes in this community are weakly interconnected._
- **Should `2. Skill Specifications` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `constants.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08923076923076922 - nodes in this community are weakly interconnected._
- **Should `Proposed Changes` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `SISTEMA AUTOMATIZADO DE SOPORTE ANALÍTICO MÓVIL BASADO EN EDGE AI E INTELIGENCIA ARTIFICIAL EXPLICABLE PARA LA INTERPRETACIÓN DE ENSAYOS EN EL LABORATORIO DE MICROBIOLOGÍA CLÍNICA` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
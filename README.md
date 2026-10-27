# DeepHalo · Suite ADLMS
### Antibiograma Automatizado Asistido por Inteligencia Artificial

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Computer Vision](https://img.shields.io/badge/YOLO-11n%20Edge%20AI-00ffff.svg)](https://ultralytics.com/)
[![Clinical Standard](https://img.shields.io/badge/Standard-CLSI%20M100%20%2F%20EUCAST%20v16.0-10b981.svg)](https://clsi.org/)
[![Health Interoperability](https://img.shields.io/badge/HL7-FHIR%20Release%204-firebrick.svg)](https://hl7.org/fhir/)
[![Regulations](https://img.shields.io/badge/Normativa-ISO%2015189%20%7C%20Ley%2021.719%20Chile-slate.svg)](https://www.minsal.cl/)

---

## 1. Descripción del Proyecto

**DeepHalo / Suite ADLMS** (*Automated Disk Diffusion Antibiogram Suite*) es una plataforma de apoyo diagnóstico para la interpretación asistida por computadora de pruebas de susceptibilidad antimicrobiana (AST) por el método de difusión en disco (**Kirby-Bauer**).

### Problema Clínico
* **Variabilidad inter-operador:** La medición manual con regla o pie de metro introduce desviaciones subjetivas de $\pm 2$ a $4\text{ mm}$ en la lectura de halos de inhibición, generando discrepancias de categorización clínica (Sensible, Intermedio, Resistente).
* **Escalada de la Resistencia Antimicrobiana (RAM):** La OMS y el Ministerio de Salud de Chile (MINSAL) exigen una vigilancia epidemiológica trazable, interoperable con sistemas LIS/HIS hospitalarios y alineada a las normas internacionales **CLSI M100** y **EUCAST v16.0**.
* **Propuesta DeepHalo:** Adquisición de imágenes mediante smartphone, detección mediante visión artificial en el dispositivo (*Edge AI*), calibración fiducial a partir del disco de $6.0\text{ mm}$, explicabilidad Grad-CAM del crecimiento bacteriano, ajuste con calibre digital interactivo y exportación estandarizada en **HL7 FHIR R4**.

---

## 2. Arquitectura de Ejecución Dual

El repositorio implementa una arquitectura híbrida en dos modalidades:

```
                                  ┌─────────────────────────────┐
                                  │   Placa de Petri / Imagen   │
                                  └──────────────┬──────────────┘
                                                 │
                         ┌───────────────────────┴───────────────────────┐
                         ▼                                               ▼
         ┌───────────────────────────────┐               ┌───────────────────────────────┐
         │     TRACK A: MVP Web Native   │               │   TRACK B: Python Streamlit   │
         │  (Cero Instalación / Browser) │               │   (Entorno Científico Cloud)  │
         ├───────────────────────────────┤               ├───────────────────────────────┤
         │ • HTML5 Canvas + WebGL        │               │ • PyTorch + OpenCV            │
         │ • Calibre Digital Háptico     │               │ • Ultralytics YOLO11n         │
         │ • Grad-CAM Lawn Heatmap       │               │ • Grad-CAM Explainability     │
         │ • Generador HL7 FHIR JSON     │               │ • Visualización Interactiva   │
         └───────────────┬───────────────┘               └───────────────┬───────────────┘
                         │                                               │
                         └───────────────────────┬───────────────────────┘
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │  Validación y Envío a LIS   │
                                  └─────────────────────────────┘
```

* **Track A — Standalone Web MVP (`mvp_web/`):** Aplicación web para navegador móvil y escritorio sin dependencias de backend. Utiliza HTML5 Canvas para el renderizado de halos y simulación fiducial en tiempo real.
* **Track B — Suite Científica Streamlit (`streamlit_app.py`):** Panel interactivo en Python con procesamiento avanzado mediante OpenCV, PyTorch y generación de reportes clínicos.

---

## 3. Inicio Rápido (Quickstart)

### Opción 1: Lanzador Interactivo (Windows 1-Click)
Haz doble clic en **`run_app.bat`** en la raíz del repositorio:
```cmd
D:\Bots\ADLMS> run_app.bat
===================================================================
              DeepHalo / Suite ADLMS AST MVP
===================================================================
Seleccione el modo de ejecucion:
  [1] Track A: MVP Web Standalone (Navegador Local, Cero Instalacion)
  [2] Track B: Streamlit App (Requiere dependencias Python)
  [3] Salir
```

### Opción 2: Ejecución Manual desde Terminal

#### Requisitos Previos:
```bash
python -m venv venv
venv\Scripts\activate          # En Windows
pip install -r requirements.txt
```

#### Ejecutar Track A (Servidor Web MVP):
```bash
python run_web_mvp.py
# Se abrirá automáticamente en: http://localhost:8000/index.html
```

#### Ejecutar Track B (Streamlit):
```bash
streamlit run streamlit_app.py
# Se abrirá automáticamente en: http://localhost:8501
```

---

## 4. Estructura del Repositorio

```text
d:\Bots\ADLMS\
├── .planning/                  # Roadmap, especificaciones y gestión de fases GSD
├── configs/                    # Configuraciones de datasets y modelos (dataset.yaml)
├── data/                       # [Capa de Datos Unificada]
│   ├── AGAR_demo/              # Benchmark AGAR de morfología bacteriana
│   └── Antibiogram_demo/       # Placas de antibiograma anotadas en formato YOLO
├── docs/                       # [Documentación del Proyecto]
│   ├── academic/               # Informes formales de tesis y anteproyecto
│   │   ├── acif200_s12_MelianC.md
│   │   └── Proyecto_Propuesta.md
│   ├── architecture/           # Hitos y reportes de arquitectura AST
│   │   ├── MILESTONES.md
│   │   └── graphify/
│   └── guides/                 # Guías de configuración de entorno y aceleración GPU
│       ├── desktop_setup_guide.md
│       └── antigravity_skills.md
├── mvp_web/                    # Aplicación Web Standalone (Track A)
│   ├── index.html              # Visor dual móvil de placa y resultados
│   ├── logo_showcase.html      # Explorador interactivo de isotipos
│   ├── style.css               # Sistema de diseño clínico Dark Lab
│   ├── app.js                  # Lógica de calibración e interoperabilidad FHIR
│   ├── logos/                  # Isotipos vectoriales oficiales (SVG 100x100)
│   └── sample_plates/          # Imágenes de muestra calibradas
├── scripts/                    # [Herramientas de Construcción y Mapeo]
│   ├── build_mvp_plates.py     # Generador de plates_data.js desde data/
│   ├── build_code_map.py       # Analizador AST de la base de código
│   └── codebase_map.json       # Grafo JSON de dependencias internas
├── src/                        # [Paquete Python Core]
│   ├── __init__.py             # Inicializador del paquete
│   ├── data/                   # Preprocesamiento, augmentación y descarga
│   ├── evaluation/             # Evaluación métrica y Grad-CAM
│   ├── models/                 # Entrenamiento de YOLO11n y exportación ONNX
│   └── utils/                  # Constantes clínicas y directorios base
├── README.md                   # Este manual
├── requirements.txt            # Dependencias del entorno Python
├── run_app.bat                 # Lanzador rápido interactivo
├── run_web_mvp.py              # Runner del servidor web local
└── streamlit_app.py            # Aplicación científica Streamlit
```

---

## 5. Normativas y Gobernanza de Datos

* **Estándar Clínico:** Puntos de corte para Enterobacterales y *Staphylococcus aureus* según **CLSI M100** (predeterminado) y **EUCAST v16.0**.
* **Interoperabilidad:** Exportación de observaciones en formato **HL7 FHIR Release 4** (`Observation` con códigos LOINC, valores cuantitativos en mm y categorización cualitativa S/I/R).
* **Protección de Datos:** Cumplimiento con la **Ley 21.719 (Chile)** sobre protección de datos personales y sensibles de salud mediante identificadores anonimizados de 16 dígitos y procesamiento local en el dispositivo (*Edge Computing*).
* **Calidad de Laboratorio:** Alineado con directrices de validación de métodos diagnósticos **NCh-ISO 15189:2022**.

---

## 6. Autores y Licencia

* **Autor:** Cristian Melián (Universidad / Proyecto de Título en Ingeniería Informática)
* **Licencia:** MIT License.

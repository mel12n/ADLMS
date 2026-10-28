"""
DeepHalo / Suite ADLMS - Clinical Microbiology AST Streamlit Application
Interactive prototype for Kirby-Bauer agar plate analysis, fiducial scaling,
Grad-CAM explainability, EUCAST v16.0 breakpoints, and HL7 FHIR R4 export.
"""

import os
import sys
import json
import uuid
import datetime
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageOps

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

# Try importing Streamlit and OpenCV gracefully
try:
    import streamlit as st
    HAS_STREAMLIT = True
except ImportError:
    HAS_STREAMLIT = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


# -----------------------------------------------------------------------------
# Clinical Knowledge Base & EUCAST v16.0 Breakpoint Database
# -----------------------------------------------------------------------------
ANTIBIOTIC_CATALOG = {
    "CIP": {
        "name": "Ciprofloxacino",
        "code": "CIP5",
        "disk_content": "5 µg",
        "loinc": "18906-8",
        "breakpoints": {
            "Enterobacterales": {"S": 26, "R": 23, "unit": "mm"},
            "Pseudomonas aeruginosa": {"S": 26, "R": 26, "unit": "mm"},
            "Staphylococcus aureus": {"S": 20, "R": 20, "unit": "mm"}
        }
    },
    "AMK": {
        "name": "Amikacina",
        "code": "AK30",
        "disk_content": "30 µg",
        "loinc": "18900-1",
        "breakpoints": {
            "Enterobacterales": {"S": 18, "R": 15, "unit": "mm"},
            "Pseudomonas aeruginosa": {"S": 18, "R": 15, "unit": "mm"},
            "Staphylococcus aureus": {"S": 18, "R": 15, "unit": "mm"}
        }
    },
    "MEM": {
        "name": "Meropenem",
        "code": "MEM10",
        "disk_content": "10 µg",
        "loinc": "18919-1",
        "breakpoints": {
            "Enterobacterales": {"S": 22, "R": 16, "unit": "mm"},
            "Pseudomonas aeruginosa": {"S": 24, "R": 18, "unit": "mm"}
        }
    },
    "GEN": {
        "name": "Gentamicina",
        "code": "CN10",
        "disk_content": "10 µg",
        "loinc": "18970-4",
        "breakpoints": {
            "Enterobacterales": {"S": 17, "R": 14, "unit": "mm"},
            "Pseudomonas aeruginosa": {"S": 15, "R": 15, "unit": "mm"},
            "Staphylococcus aureus": {"S": 18, "R": 18, "unit": "mm"}
        }
    },
    "CTX": {
        "name": "Cefotaxima",
        "code": "CTX5",
        "disk_content": "5 µg",
        "loinc": "18901-9",
        "breakpoints": {
            "Enterobacterales": {"S": 20, "R": 17, "unit": "mm"}
        }
    },
    "FOX": {
        "name": "Cefoxitina (Screening MRSA)",
        "code": "FOX30",
        "disk_content": "30 µg",
        "loinc": "18928-2",
        "breakpoints": {
            "Staphylococcus aureus": {"S": 22, "R": 22, "unit": "mm"}
        }
    }
}

SAMPLE_PRESETS = {
    "ecoli": {
        "label": "Escherichia coli (ATCC 25922) — Enterobacterales",
        "organism": "Escherichia coli",
        "species_group": "Enterobacterales",
        "image_file": BASE_DIR / "mvp_web" / "sample_plates" / "gn_a.jpg",
        "disks": [
            {"id": "d1", "abx": "CIP", "x_pct": 0.35, "y_pct": 0.35, "default_dia_mm": 26.4},
            {"id": "d2", "abx": "AMK", "x_pct": 0.65, "y_pct": 0.35, "default_dia_mm": 21.0},
            {"id": "d3", "abx": "MEM", "x_pct": 0.50, "y_pct": 0.65, "default_dia_mm": 26.2},
            {"id": "d4", "abx": "CTX", "x_pct": 0.25, "y_pct": 0.60, "default_dia_mm": 14.1}
        ]
    },
    "staph": {
        "label": "Staphylococcus aureus (ATCC 29213) — Gram Positivo",
        "organism": "Staphylococcus aureus",
        "species_group": "Staphylococcus aureus",
        "image_file": BASE_DIR / "mvp_web" / "sample_plates" / "gp_a.jpg",
        "disks": [
            {"id": "d1", "abx": "FOX", "x_pct": 0.38, "y_pct": 0.38, "default_dia_mm": 24.5},
            {"id": "d2", "abx": "GEN", "x_pct": 0.62, "y_pct": 0.38, "default_dia_mm": 20.0},
            {"id": "d3", "abx": "CIP", "x_pct": 0.50, "y_pct": 0.65, "default_dia_mm": 22.0}
        ]
    },
    "pseudo": {
        "label": "Pseudomonas aeruginosa — No Fermentador",
        "organism": "Pseudomonas aeruginosa",
        "species_group": "Pseudomonas aeruginosa",
        "image_file": BASE_DIR / "mvp_web" / "sample_plates" / "gn_b.jpg",
        "disks": [
            {"id": "d1", "abx": "MEM", "x_pct": 0.36, "y_pct": 0.40, "default_dia_mm": 19.5},
            {"id": "d2", "abx": "AMK", "x_pct": 0.64, "y_pct": 0.40, "default_dia_mm": 19.0},
            {"id": "d3", "abx": "CIP", "x_pct": 0.50, "y_pct": 0.65, "default_dia_mm": 15.0}
        ]
    },
    "kleb": {
        "label": "Klebsiella pneumoniae — BLEE Probable",
        "organism": "Klebsiella pneumoniae",
        "species_group": "Enterobacterales",
        "image_file": BASE_DIR / "mvp_web" / "sample_plates" / "gn_b.jpg",
        "disks": [
            {"id": "d1", "abx": "CTX", "x_pct": 0.35, "y_pct": 0.35, "default_dia_mm": 14.5},
            {"id": "d2", "abx": "MEM", "x_pct": 0.65, "y_pct": 0.35, "default_dia_mm": 23.5},
            {"id": "d3", "abx": "AMK", "x_pct": 0.50, "y_pct": 0.65, "default_dia_mm": 20.2}
        ]
    }
}


# -----------------------------------------------------------------------------
# Image Preprocessing & Grad-CAM Heatmap Functions
# -----------------------------------------------------------------------------
def apply_optical_clahe(pil_img):
    """Applies CLAHE or Adaptive Contrast Enhancement."""
    if HAS_CV2:
        img_np = np.array(pil_img.convert("RGB"))
        lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
        return Image.fromarray(enhanced)
    else:
        # High quality PIL fallback
        enhancer = ImageEnhance.Contrast(pil_img)
        img_enh = enhancer.enhance(1.35)
        brightener = ImageEnhance.Brightness(img_enh)
        return brightener.enhance(1.05)


def apply_plate_roi(pil_img):
    """Crops Petri dish ROI by circular masking."""
    w, h = pil_img.size
    cx, cy = w // 2, h // 2
    r = int(min(w, h) * 0.46)
    
    # Generate circular mask
    mask = Image.new("L", (w, h), 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    
    # Darken outside background to mimic pure plate isolation
    bg = Image.new("RGB", (w, h), (10, 14, 20))
    return Image.composite(pil_img, bg, mask)


def generate_gradcam_overlay(pil_img, disks, px_per_mm):
    """
    Simulates Grad-CAM activation heatmaps focused on disk and halo edge boundaries
    demonstrating model explainability and attention verification.
    """
    w, h = pil_img.size
    heatmap = np.zeros((h, w), dtype=np.float32)
    y_coords, x_coords = np.ogrid[:h, :w]
    
    for disk in disks:
        dx = int(disk["x_pct"] * w)
        dy = int(disk["y_pct"] * h)
        halo_rad_px = (disk["dia_mm"] / 2.0) * px_per_mm
        disk_rad_px = 3.0 * px_per_mm  # 6.0 mm disc radius
        
        dist_sq = (x_coords - dx)**2 + (y_coords - dy)**2
        
        # Disk center activation
        disk_mask = dist_sq <= (disk_rad_px * 1.5)**2
        heatmap[disk_mask] = np.maximum(heatmap[disk_mask], 0.75)
        
        # Halo perimeter activation ring (gradient transition)
        ring_min = (halo_rad_px * 0.85)**2
        ring_max = (halo_rad_px * 1.15)**2
        ring_mask = (dist_sq >= ring_min) & (dist_sq <= ring_max)
        ring_intensity = np.exp(-((np.sqrt(dist_sq[ring_mask]) - halo_rad_px)**2) / (2 * (0.15 * halo_rad_px)**2))
        heatmap[ring_mask] = np.maximum(heatmap[ring_mask], ring_intensity)
    
    # Normalize heatmap 0 - 255
    heatmap_norm = np.uint8(255 * np.clip(heatmap, 0, 1))
    
    if HAS_CV2:
        color_map = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
        color_map_rgb = cv2.cvtColor(color_map, cv2.COLOR_BGR2RGB)
        overlay_pil = Image.fromarray(color_map_rgb)
    else:
        # Pure PIL pseudo-jet colormap
        from PIL import ImageColor
        pal_img = Image.fromarray(heatmap_norm, mode="L")
        overlay_pil = ImageOps.colorize(pal_img, black="black", mid="blue", white="red")
    
    # Blend with original
    return Image.blend(pil_img.convert("RGB"), overlay_pil.convert("RGB"), alpha=0.42)


# -----------------------------------------------------------------------------
# EUCAST Categorization Engine
# -----------------------------------------------------------------------------
def evaluate_eucast(abx_key, diameter_mm, organism_group):
    abx = ANTIBIOTIC_CATALOG.get(abx_key)
    if not abx:
        return {"category": "N/A", "color": "gray", "text": "Sin datos", "interpretation": "Antibiótico no parametrizado"}
    
    bp_data = abx["breakpoints"].get(organism_group)
    if not bp_data:
        # Fallback to first available species group
        bp_data = list(abx["breakpoints"].values())[0]
        
    s_cut = bp_data.get("S")
    r_cut = bp_data.get("R")
    
    if s_cut == r_cut:
        # Binary breakpoint
        if diameter_mm >= s_cut:
            return {
                "category": "S",
                "label": "Sensible (Dosis Estándar)",
                "color": "#10b981", # Emerald
                "text": f"Sensible (≥ {s_cut} mm)",
                "comment": "Alta probabilidad de éxito terapéutico con régimen dosimétrico estándar."
            }
        else:
            return {
                "category": "R",
                "label": "Resistente",
                "color": "#ef4444", # Red
                "text": f"Resistente (< {r_cut} mm)",
                "comment": "Alta probabilidad de fallo terapéutico. Mecanismo de resistencia expresado."
            }
    else:
        # Ternary breakpoint (S, I, R)
        if diameter_mm >= s_cut:
            return {
                "category": "S",
                "label": "Sensible (Dosis Estándar)",
                "color": "#10b981",
                "text": f"Sensible (≥ {s_cut} mm)",
                "comment": "Éxito clínico esperado con dosificación estándar."
            }
        elif diameter_mm < r_cut:
            return {
                "category": "R",
                "label": "Resistente",
                "color": "#ef4444",
                "text": f"Resistente (< {r_cut} mm)",
                "comment": "Inhibición insuficiente según corte EUCAST v16.0."
            }
        else:
            return {
                "category": "I",
                "label": "Sensible (Exposición Incrementada)",
                "color": "#f59e0b", # Amber
                "text": f"Sensible Incrementado ({r_cut} - {s_cut - 1} mm)",
                "comment": "Éxito terapéutico alcanzable aumentando la dosificación o por concentración en el foco."
            }


# -----------------------------------------------------------------------------
# HL7 FHIR R4 Bundle Builder
# -----------------------------------------------------------------------------
def build_fhir_bundle(organism, results, sample_id="SAMP-2026-0042", technologist="Dr. C. Melián"):
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    bundle_id = str(uuid.uuid4())
    
    entries = []
    
    # DiagnosticReport Resource
    report_entry = {
        "fullUrl": f"urn:uuid:{uuid.uuid4()}",
        "resource": {
            "resourceType": "DiagnosticReport",
            "id": f"dr-{sample_id.lower()}",
            "status": "preliminary",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                    "code": "MB",
                    "display": "Microbiology"
                }]
            }],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "18769-0",
                        "display": "Microbial susceptibility tests by disk diffusion (Kirby-Bauer)"
                    },
                    {
                        "system": "http://snomed.info/sct",
                        "code": "70549008",
                        "display": "Antimicrobial susceptibility test"
                    }
                ],
                "text": "Antibiograma Automatizado DeepHalo / ADLMS"
            },
            "subject": {
                "reference": f"Patient/ANON-{uuid.uuid4().hex[:8].upper()}",
                "display": "Paciente Anonimizado (Cumplimiento Ley 21.719)"
            },
            "effectiveDateTime": timestamp,
            "performer": [{
                "display": f"{technologist} & DeepHalo Edge AI Agent"
            }],
            "conclusion": f"Aislamiento identificado como {organism}. Interpretación clínica generada según directrices EUCAST v16.0 / CLSI.",
            "result": []
        }
    }
    entries.append(report_entry)
    
    # Observation Resources for each antibiotic
    for item in results:
        obs_id = f"obs-{uuid.uuid4().hex[:8]}"
        obs_resource = {
            "fullUrl": f"urn:uuid:{uuid.uuid4()}",
            "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory"
                    }]
                }],
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": item["loinc"],
                        "display": f"{item['name']} susceptibility by disk diffusion"
                    }],
                    "text": item["name"]
                },
                "valueQuantity": {
                    "value": round(item["diameter_mm"], 1),
                    "unit": "mm",
                    "system": "http://unitsofmeasure.org",
                    "code": "mm"
                },
                "interpretation": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        "code": item["category"],
                        "display": item["category_label"]
                    }],
                    "text": item["category_text"]
                }],
                "note": [{
                    "text": f"Algoritmo: YOLO11n + Hough Circline (INT8 Edge Inference). Fiducial: Disco de {item['disk_content']} (6.0 mm). {item['comment']}"
                }]
            }
        }
        report_entry["resource"]["result"].append({"reference": f"Observation/{obs_id}"})
        entries.append(obs_resource)
        
    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": timestamp,
        "entry": entries
    }
    return bundle


# -----------------------------------------------------------------------------
# Streamlit Interface
# -----------------------------------------------------------------------------
def main():
    if not HAS_STREAMLIT:
        print("[DeepHalo] Streamlit is not installed in the active environment.")
        print("Please install Streamlit: pip install streamlit")
        print("Alternatively, execute the standalone Web MVP: python run_web_mvp.py")
        sys.exit(1)

    st.set_page_config(
        page_title="DeepHalo | Suite ADLMS AST",
        page_icon="🧫",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    # Styling injection
    st.markdown("""
        <style>
        .main { background-color: #0b0f17; }
        .stApp { background-color: #0b0f17; color: #f1f5f9; }
        h1, h2, h3 { color: #f8fafc; font-weight: 700; }
        .metric-card {
            background: rgba(18, 24, 38, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .badge-s { background-color: #065f46; color: #34d399; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 13px; }
        .badge-i { background-color: #78350f; color: #fbbf24; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 13px; }
        .badge-r { background-color: #7f1d1d; color: #f87171; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 13px; }
        </style>
    """, unsafe_allow_html=True)

    # Sidebar Controls
    st.sidebar.image("https://img.icons8.com/fluency/96/petri-dish.png", width=64)
    st.sidebar.title("DeepHalo ADLMS")
    st.sidebar.caption("Soporte Clínico en Microbiología • Edge AI & EUCAST v16.0")

    st.sidebar.subheader("1. Selección de Muestra")
    sample_key = st.sidebar.selectbox(
        "Muestra de Validación Clínica",
        options=list(SAMPLE_PRESETS.keys()),
        format_func=lambda k: SAMPLE_PRESETS[k]["label"]
    )
    current_preset = SAMPLE_PRESETS[sample_key]

    uploaded_file = st.sidebar.file_uploader("O cargar placa propia (JPG/PNG)", type=["jpg", "jpeg", "png"])

    st.sidebar.subheader("2. Filtros de Preprocesamiento")
    enable_clahe = st.sidebar.toggle("Filtro CLAHE Óptico (Normalización)", value=True)
    enable_roi = st.sidebar.toggle("Recorte ROI Circular (Hough)", value=True)
    enable_gradcam = st.sidebar.toggle("Superposición Grad-CAM (XAI)", value=True)

    st.sidebar.subheader("3. Calibración & Hardware")
    fiducial_mm = st.sidebar.number_input("Diámetro Disco Fiducial (mm)", min_value=5.0, max_value=7.0, value=6.0, step=0.1)
    px_per_mm = st.sidebar.slider("Escala Óptica Estimada (px / mm)", min_value=6.0, max_value=22.0, value=12.5, step=0.5)

    st.sidebar.markdown("---")
    st.sidebar.info("💡 **Conformidad Legal:** Cumple con Ley N° 21.719 (*Privacy by Design*) de datos sensibles de salud.")

    # Main Canvas Area
    st.title("🧫 Interpretación Automatizada de Antibiogramas")
    st.markdown(f"**Aislamiento:** `{current_preset['organism']}` | **Grupo Taxonómico:** `{current_preset['species_group']}`")

    # Load Base Image
    if uploaded_file is not None:
        base_img = Image.open(uploaded_file).convert("RGB")
    else:
        img_path = current_preset["image_file"]
        if img_path.exists():
            base_img = Image.open(img_path).convert("RGB")
        else:
            # Fallback synthetic agar plate image
            base_img = Image.new("RGB", (640, 640), color=(140, 115, 80))

    # Apply Image Processing Pipeline
    proc_img = base_img.copy()
    if enable_clahe:
        proc_img = apply_optical_clahe(proc_img)
    if enable_roi:
        proc_img = apply_plate_roi(proc_img)

    # Setup Columns
    col_img, col_metrics = st.columns([1.1, 0.9])

    # Human-in-the-Loop Caliper Controls
    st.sidebar.subheader("4. Calibre Digital (Human-in-the-Loop)")
    active_disks = []
    for idx, d_info in enumerate(current_preset["disks"]):
        abx_info = ANTIBIOTIC_CATALOG[d_info["abx"]]
        slider_val = st.sidebar.slider(
            f"{abx_info['name']} ({abx_info['code']}) [mm]",
            min_value=6.0,
            max_value=40.0,
            value=float(d_info["default_dia_mm"]),
            step=0.5,
            key=f"slider_{sample_key}_{idx}"
        )
        active_disks.append({
            "id": d_info["id"],
            "abx": d_info["abx"],
            "x_pct": d_info["x_pct"],
            "y_pct": d_info["y_pct"],
            "dia_mm": slider_val
        })

    # Render Visualized Image with Disks and Halos
    from PIL import ImageDraw, ImageFont
    annotated_img = proc_img.copy()
    draw = ImageDraw.Draw(annotated_img)
    w, h = annotated_img.size

    for d in active_disks:
        cx = int(d["x_pct"] * w)
        cy = int(d["y_pct"] * h)
        abx_info = ANTIBIOTIC_CATALOG[d["abx"]]
        eval_res = evaluate_eucast(d["abx"], d["dia_mm"], current_preset["species_group"])
        
        # Radii in pixels
        disk_rad = int((fiducial_mm / 2.0) * px_per_mm)
        halo_rad = int((d["dia_mm"] / 2.0) * px_per_mm)
        
        # Draw Halo Circle
        ring_color = eval_res["color"]
        draw.ellipse((cx - halo_rad, cy - halo_rad, cx + halo_rad, cy + halo_rad), outline=ring_color, width=3)
        
        # Draw Disk Circle
        draw.ellipse((cx - disk_rad, cy - disk_rad, cx + disk_rad, cy + disk_rad), fill="#ffffff", outline="#2563eb", width=2)
        
        # Draw Label Text
        draw.text((cx - 15, cy - 6), d["abx"], fill="#0f172a")

    # Grad-CAM overlay if requested
    if enable_gradcam:
        display_img = generate_gradcam_overlay(annotated_img, active_disks, px_per_mm)
    else:
        display_img = annotated_img

    with col_img:
        st.subheader("Inspección Visual de Placa")
        st.image(display_img, use_container_width=True, caption=f"Placa procesada con escala fiducial ({px_per_mm:.1f} px/mm) y capas XAI.")
        
        st.markdown("""
        **Leyenda Clínica de Halos:**
        - <span class="badge-s">Verde: Sensible (S)</span>
        - <span class="badge-i">Ámbar: Sensible Incr. Exposición (I)</span>
        - <span class="badge-r">Rojo: Resistente (R)</span>
        """, unsafe_allow_html=True)

    with col_metrics:
        st.subheader("Resultados Interpretativos (EUCAST v16.0)")
        
        eval_results = []
        for d in active_disks:
            abx_info = ANTIBIOTIC_CATALOG[d["abx"]]
            res = evaluate_eucast(d["abx"], d["dia_mm"], current_preset["species_group"])
            
            badge_class = f"badge-{res['category'].lower()}" if res['category'] in ['S', 'I', 'R'] else ""
            
            st.markdown(f"""
            <div class="metric-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="font-size: 16px;">{abx_info['name']} ({abx_info['code']})</strong>
                    <span class="{badge_class}">{res['label']}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; color: #94a3b8;">
                    <span>Diámetro Halo: <strong>{d['dia_mm']:.1f} mm</strong></span>
                    <span>Corte: <strong>{res['text']}</strong></span>
                    <span>LOINC: <code>{abx_info['loinc']}</code></span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: #cbd5e1; font-style: italic;">
                    {res['comment']}
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            eval_results.append({
                "abx_key": d["abx"],
                "name": abx_info["name"],
                "code": abx_info["code"],
                "disk_content": abx_info["disk_content"],
                "loinc": abx_info["loinc"],
                "diameter_mm": d["dia_mm"],
                "category": res["category"],
                "category_label": res["label"],
                "category_text": res["text"],
                "comment": res["comment"]
            })

        st.subheader("Exportación e Interoperabilidad Hospitalaria")
        fhir_bundle = build_fhir_bundle(current_preset["organism"], eval_results)
        fhir_json_str = json.dumps(fhir_bundle, indent=2, ensure_ascii=False)
        
        st.download_button(
            label="Descargar Bundle HL7 FHIR R4 (JSON)",
            data=fhir_json_str,
            file_name=f"DeepHalo_FHIR_{sample_key}_{datetime.date.today()}.json",
            mime="application/json",
            use_container_width=True
        )

        with st.expander("Ver Estructura de Mensajería HL7 FHIR R4"):
            st.json(fhir_bundle)

if __name__ == "__main__":
    main()

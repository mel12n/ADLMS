"""Build the synchronized plate bundle used by the DeepHalo / ADLMS web MVP.

Runs the trained YOLO11n-seg model (``results/yolo11n_microbiology/weights/best.pt``),
36-ray radial Sobel geometric cross-validation, and official EUCAST v16.1 breakpoints
on the curated Clinical Microbiology demo plates (plus the live Test plate via EasyOCR),
and exports ``mvp_web/plates_data.js`` and ``mvp_web/breakpoints_data.js``.

Usage:
    venv\\Scripts\\python.exe scripts/build_mvp_plates.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List

from PIL import Image
from ultralytics import YOLO

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from src.evaluation.eucast_breakpoints import export_breakpoints_json
from src.evaluation.measure_zones import (
    DEFAULT_MODEL_PATH,
    analyze_plate_image,
    load_whonet_codes,
)

TRAIN_DIR = BASE / "data" / "Antibiogram_demo" / "Train"
TEST_DIR = BASE / "data" / "Antibiogram_demo" / "Test"
OUT_DIR = BASE / "mvp_web"
IMG_DIR = OUT_DIR / "sample_plates"
PLATES_JS = OUT_DIR / "plates_data.js"

PLATES = [
    {
        "key": "gn_a",
        "src_path": TRAIN_DIR / "IMG20230321083329.jpg",
        "title": "Placa 01 · Panel Gram negativo (YOLO11n-seg)",
        "short": "GN-01",
        "group": "Enterobacterales",
        "sampleId": "2026102508332914",
        "organism": "Escherichia coli (ATCC 25922)",
        "use_preset_codes": True,
    },
    {
        "key": "gp_a",
        "src_path": TRAIN_DIR / "IMG20230320104623.jpg",
        "title": "Placa 02 · Panel Gram positivo (YOLO11n-seg)",
        "short": "GP-02",
        "group": "Staphylococcus",
        "sampleId": "2026102510462381",
        "organism": "Staphylococcus aureus (ATCC 29213)",
        "use_preset_codes": True,
    },
    {
        "key": "gn_b",
        "src_path": TRAIN_DIR / "IMG20230321083340.jpg",
        "title": "Placa 03 · Panel BLEE / Resistencia Intrínseca",
        "short": "GN-03",
        "group": "Enterobacterales",
        "sampleId": "2026102508334092",
        "organism": "Klebsiella pneumoniae (BLEE)",
        "use_preset_codes": True,
    },
    {
        "key": "test_01",
        "src_path": TEST_DIR / "IMG20230323111029.jpg",
        "title": "Placa 04 · Test Ciego + OCR WHONET en vivo",
        "short": "TEST-04",
        "group": "Enterobacterales",
        "sampleId": "2026102511102904",
        "organism": "Escherichia coli (aislamiento clínico)",
        "use_preset_codes": False,
    },
]


def _load_existing_preset_codes() -> Dict[str, List[Dict[str, Any]]]:
    """Load verified disk position/code labels from existing ``plates_data.js`` if available."""
    presets: Dict[str, List[Dict[str, Any]]] = {}
    if not PLATES_JS.is_file():
        return presets
    raw = PLATES_JS.read_text(encoding="utf-8", errors="ignore")
    marker = "window.ADLMS_PLATES ="
    if marker not in raw:
        return presets
    try:
        json_part = raw.split(marker, 1)[1].strip().rstrip(";")
        data = json.loads(json_part)
        for plate in data:
            if plate.get("key") and plate.get("discs"):
                presets[plate["key"]] = [
                    {"x": d["x"], "y": d["y"], "code": d["code"]}
                    for d in plate["discs"]
                    if d.get("code") and d.get("code") != "UNK"
                ]
    except Exception:
        pass
    return presets


def main() -> None:
    # Ensure breakpoints_data.js is up to date from v_16.1_Breakpoint_Tables.xlsx
    export_breakpoints_json()

    existing_presets = _load_existing_preset_codes()
    model = YOLO(str(DEFAULT_MODEL_PATH))
    whonet_codes = load_whonet_codes()

    reader = None
    try:
        import easyocr

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    except Exception:
        reader = None

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for old in IMG_DIR.glob("*.jpg"):
        old.unlink()

    bundle: List[Dict[str, Any]] = []
    for p in PLATES:
        src = p["src_path"]
        if not src.is_file():
            print(f"[SKIP] Missing image: {src}")
            continue

        dst = IMG_DIR / f"{p['key']}.jpg"
        shutil.copyfile(src, dst)
        with Image.open(src) as im:
            width, height = im.size

        preset_labels = existing_presets.get(p["key"]) if p["use_preset_codes"] else None
        analysis = analyze_plate_image(
            image_source=src,
            model=model,
            reader=reader,
            whonet_codes=whonet_codes,
            organism=p["organism"],
            organism_group=p["group"],
            standard="EUCAST",
            enable_ocr=reader is not None,
            ocr_angles=16,
            preset_disc_labels=preset_labels,
        )

        discs = []
        zones = []
        px_per_mm = analysis["scale_px_per_mm"] or (min(width, height) / 140.0)
        for det in analysis["detections"]:
            discs.append(
                {
                    "code": det["code"],
                    "abxCode": det["abx_code"],
                    "abxName": det["abx_name"],
                    "x": det["x"],
                    "y": det["y"],
                    "w": det["w"],
                    "h": det["h"],
                    "hx": det["hx"],
                    "hy": det["hy"],
                    "mm": det["diam_mm"],
                    "sobelMm": det["sobel_mm"],
                    "deltaR": det["delta_r_mm"],
                    "geoValid": det["geo_valid"],
                    "geoAlert": det["geo_alert"],
                    "geoMessage": det["geo_message"],
                    "bioAlert": det["bio_alert"],
                    "bioMessage": det["bio_message"],
                    "ocrScore": det["ocr_score"],
                    "contour": det["zone_contour"],
                }
            )
            if det["diam_mm"] > 6.5:
                zw = (det["diam_mm"] * px_per_mm) / width
                zh = (det["diam_mm"] * px_per_mm) / height
                zones.append({"x": det["hx"], "y": det["hy"], "w": round(zw, 5), "h": round(zh, 5)})

        bundle.append(
            {
                "key": p["key"],
                "title": p["title"],
                "short": p["short"],
                "group": p["group"],
                "sampleId": p["sampleId"],
                "organism": p["organism"],
                "image": f"sample_plates/{p['key']}.jpg",
                "source": str(src.relative_to(BASE)).replace("\\", "/"),
                "width": width,
                "height": height,
                "scalePxPerMm": analysis["scale_px_per_mm"],
                "scaleMmPerPx": analysis["scale_mm_per_px"],
                "medianDiskPx": analysis["median_disk_px"],
                "inferenceMs": analysis["inference_ms"],
                "modelSource": "YOLO11n-seg (best.pt) + Sobel 36-ray",
                "discs": discs,
                "zones": zones,
            }
        )
        print(
            f"{p['key']}: {len(discs)} discs, scale={analysis['scale_px_per_mm']} px/mm, "
            f"YOLO={analysis['inference_ms']} ms, geo_alerts={analysis['summary']['geo_alerts']}"
        )

    js = "// AUTO-GENERATED by scripts/build_mvp_plates.py (YOLO11n-seg + Sobel + EUCAST v16.1)\n"
    js += "window.ADLMS_PLATES = " + json.dumps(bundle, indent=1, ensure_ascii=False) + ";\n"
    PLATES_JS.write_text(js, encoding="utf-8")
    print("Wrote", PLATES_JS)


if __name__ == "__main__":
    main()

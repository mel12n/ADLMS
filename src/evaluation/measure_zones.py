"""Run YOLO11n-seg inference, identify antibiotic disks via WHONET + Clinical Formulary OCR,
cross-validate halos via 36-ray radial Sobel gradients, and interpret S/I/R via EUCAST v16.1.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import math
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.evaluation.cross_validation import validate_zone_geometry
from src.evaluation.eucast_breakpoints import (
    DEFAULT_WHONET_PATH,
    DEFAULT_XLSX_PATH,
    canonical_code,
    evaluate_susceptibility,
    get_breakpoint_db,
    normalize_group,
)

DISK_DIAMETER_MM = 6.0
CLASS_DISK = 0
CLASS_ZONE = 1
DEFAULT_MODEL_PATH = BASE_DIR / "results" / "yolo11n_microbiology" / "weights" / "best.pt"

# Active clinical microbiology laboratory Kirby-Bauer formulary (priority boost over rare WHONET codes)
COMMON_CLINICAL_CODES = {
    "AK", "AM", "AMC", "AMP", "ATM", "C", "CAZ", "CIP", "CN", "CRO", "CTX",
    "CXM", "DA", "E", "ETP", "F", "FD", "FEP", "FOX", "IPM", "LEV", "LZD",
    "MEM", "MH", "MUP", "MXF", "NOR", "P", "PRL", "QD", "RD", "S", "SAM",
    "SXT", "TE", "TEC", "TGC", "TOB", "TZP", "VA", "VAN", "AMK", "GEN",
    "CLI", "ERY", "NIT", "PEN", "QDA", "RIF", "PIP", "LVX", "MFX", "LNZ",
}

# Expected standard disk potencies (ug or U) for clinical formulary codes
CLINICAL_POTENCY_HINTS: Dict[str, set] = {
    "AM": {"10", "2"}, "AMC": {"30", "20", "10"}, "SAM": {"20", "10"},
    "PRL": {"30", "100"}, "TZP": {"36", "30", "6", "110"}, "CTX": {"5", "30"},
    "CRO": {"30"}, "CAZ": {"10", "30"}, "FEP": {"30"}, "FOX": {"30"},
    "CXM": {"30"}, "ATM": {"30"}, "IPM": {"10"}, "MEM": {"10"}, "ETP": {"10"},
    "CIP": {"5"}, "LEV": {"5"}, "NOR": {"10"}, "MXF": {"5"},
    "AK": {"30"}, "CN": {"10", "30"}, "TOB": {"10"}, "SXT": {"25"},
    "F": {"100", "300"}, "TGC": {"15"}, "P": {"1", "10"}, "VA": {"5", "30"},
    "QD": {"15"}, "LZD": {"10", "30"}, "RD": {"5"}, "DA": {"2", "5"}, "E": {"15"},
    "FD": {"10"}, "MUP": {"200"}, "TE": {"30"}, "TEC": {"30"}, "MH": {"30"},
}

CAT_BGR = {
    "S": (129, 185, 16),   # Emerald #10b981
    "I": (11, 158, 245),   # Amber   #f59e0b
    "R": (94, 63, 244),    # Crimson #f43f5e
    "NA": (139, 116, 100), # Slate   #64748b
}


def load_whonet_codes(table_path: Path = DEFAULT_WHONET_PATH) -> Dict[str, Tuple[str, set]]:
    """Load human clinical WHONET_ABX_CODE / EUCAST_CODE -> (ANTIBIOTIC name, potency_nums) mapping."""
    codes: Dict[str, Tuple[str, set]] = {}
    if table_path.is_file():
        with table_path.open("r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                if (row.get("HUMAN") or "").strip().upper() != "X":
                    continue
                if not ((row.get("CLSI") or "").strip() or (row.get("EUCAST") or "").strip()):
                    continue
                name = (row.get("ANTIBIOTIC") or "").strip()
                pot_nums = set(re.findall(r"\d+", row.get("POTENCY") or ""))
                for col in ("WHONET_ABX_CODE", "EUCAST_CODE"):
                    code = (row.get(col) or "").strip().upper()
                    if code and code.isalpha() and 1 <= len(code) <= 4:
                        if code not in codes:
                            codes[code] = (name, set(pot_nums))
                        else:
                            codes[code][1].update(pot_nums)

    # Guarantee all clinical formulary disk codes & standard potencies are present
    for fcode, pots in CLINICAL_POTENCY_HINTS.items():
        if fcode not in codes:
            codes[fcode] = (fcode, set(pots))
        else:
            codes[fcode][1].update(pots)
    return codes


def _token_variants(tok: str) -> List[str]:
    """Generate OCR character-confusion variants (O/0, I/L/1, Q/C, R/P, etc.)."""
    variants = [tok]
    # Common stamped-ink OCR swaps on circular filter disks
    swaps = [
        ("0", "O"), ("O", "C"), ("Q", "C"), ("1", "L"),
        ("1", "I"), ("8", "B"), ("5", "S"), ("X", "K"),
    ]
    for src, dst in swaps:
        if src in tok:
            variants.append(tok.replace(src, dst))
    return list(dict.fromkeys(variants))


def identify_disk_code(
    orig_img: np.ndarray,
    dx: float,
    dy: float,
    disk_diam_px: float,
    reader,
    whonet_codes: Dict[str, Tuple[str, set]],
    ocr_angles: int = 16,
) -> Tuple[str, str, float, str]:
    """Crop high-res disk patch, run multi-angle OCR, and match WHONET + Clinical Formulary.

    Returns ``(canonical_abx_code, whonet_name, best_score, detected_potency)``.
    """
    if reader is None or not whonet_codes:
        return "UNK", "", 0.0, ""

    h, w = orig_img.shape[:2]
    half = int(max(32, disk_diam_px * 0.65))
    x1, y1 = max(0, int(dx) - half), max(0, int(dy) - half)
    x2, y2 = min(w, int(dx) + half), min(h, int(dy) + half)
    crop = orig_img[y1:y2, x1:x2]
    if crop.size == 0:
        return "UNK", "", 0.0, ""

    if min(crop.shape[:2]) < 180:
        scale = 180.0 / min(crop.shape[:2])
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(4, 4))
    crop_proc = clahe.apply(gray)

    best_code = "UNK"
    best_score = 0.0
    best_pot = ""
    all_codes = list(whonet_codes.keys())
    formulary_codes = [c for c in COMMON_CLINICAL_CODES if c in whonet_codes]
    ch, cw = crop_proc.shape[:2]
    center = (cw / 2.0, ch / 2.0)

    n_angles = max(4, ocr_angles)
    step_deg = 360.0 / n_angles

    for i in range(n_angles):
        angle = i * step_deg
        if angle == 0:
            rot = crop_proc
        else:
            mat = cv2.getRotationMatrix2D(center, angle, 1.0)
            rot = cv2.warpAffine(crop_proc, mat, (cw, ch), borderMode=cv2.BORDER_REPLICATE)

        ocr_hits = reader.readtext(
            rot,
            detail=1,
            paragraph=False,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        )
        full_text = " ".join(str(t).upper() for _, t, _ in ocr_hits)
        seen_nums = set(re.findall(r"\d+", full_text))

        for _, text, conf in ocr_hits:
            tokens = re.findall(r"[A-Z0-9]{1,4}", str(text).upper())
            for raw_tok in tokens:
                alpha_only = re.sub(r"[^A-Z]", "", raw_tok)
                if len(alpha_only) < 1:
                    continue
                for tok in _token_variants(alpha_only):
                    if tok in whonet_codes:
                        pot_match = seen_nums & whonet_codes[tok][1]
                        pot_bonus = 0.30 if pot_match else 0.0
                        form_bonus = 0.22 if tok in COMMON_CLINICAL_CODES else 0.0
                        score = float(conf) + pot_bonus + form_bonus
                        if score > best_score:
                            best_code = tok
                            best_score = score
                            best_pot = sorted(pot_match)[0] if pot_match else ""
                    elif len(tok) >= 2:
                        # Prioritize clinical lab formulary fuzzy matches first (prevents TMX beating CTX, PRX beating PRL)
                        f_matches = difflib.get_close_matches(tok, formulary_codes, n=2, cutoff=0.58)
                        for fm in f_matches:
                            ratio = difflib.SequenceMatcher(None, tok, fm).ratio()
                            pot_match = seen_nums & whonet_codes[fm][1]
                            pot_bonus = 0.30 if pot_match else 0.0
                            score = (float(conf) * ratio * 0.92) + pot_bonus + 0.18
                            if score > best_score:
                                best_code = fm
                                best_score = score
                                best_pot = sorted(pot_match)[0] if pot_match else ""

                        w_matches = difflib.get_close_matches(tok, all_codes, n=1, cutoff=0.65)
                        for wm in w_matches:
                            ratio = difflib.SequenceMatcher(None, tok, wm).ratio()
                            pot_match = seen_nums & whonet_codes[wm][1]
                            pot_bonus = 0.28 if pot_match else 0.0
                            score = (float(conf) * ratio * 0.80) + pot_bonus
                            if score > best_score:
                                best_code = wm
                                best_score = score
                                best_pot = sorted(pot_match)[0] if pot_match else ""

    norm_code = canonical_code(best_code) if best_code != "UNK" else "UNK"
    whonet_name = whonet_codes.get(best_code, ("", set()))[0]
    if not best_pot and norm_code in CLINICAL_POTENCY_HINTS:
        best_pot = sorted(CLINICAL_POTENCY_HINTS[norm_code])[0]
    return norm_code, whonet_name, round(best_score, 3), best_pot


def _polygon_stats(poly: np.ndarray) -> Optional[Tuple[float, float, float]]:
    """Return (cx, cy, equivalent_diameter_px) for a 2D polygon contour."""
    if len(poly) < 3:
        return None
    pts = poly.astype(np.float32)
    area = float(cv2.contourArea(pts))
    if area <= 0.0:
        return None
    m = cv2.moments(pts)
    if m["m00"] > 0.0:
        cx = float(m["m10"] / m["m00"])
        cy = float(m["m01"] / m["m00"])
    else:
        cx = float(pts[:, 0].mean())
        cy = float(pts[:, 1].mean())
    diam_px = 2.0 * math.sqrt(area / math.pi)
    return cx, cy, diam_px


def _simplify_normalized_contour(poly: np.ndarray, width: int, height: int) -> List[List[float]]:
    """Simplify a polygon contour to compact normalized [[x, y], ...] coordinates."""
    if poly is None or len(poly) < 3 or width <= 0 or height <= 0:
        return []
    pts = poly.astype(np.float32).reshape(-1, 1, 2)
    peri = cv2.arcLength(pts, True)
    approx = cv2.approxPolyDP(pts, max(1.5, 0.012 * peri), True).reshape(-1, 2)
    return [[round(float(x) / width, 4), round(float(y) / height, 4)] for x, y in approx]


def analyze_plate_image(
    image_source: Union[str, Path, np.ndarray],
    model: Optional[YOLO] = None,
    model_path: Union[str, Path] = DEFAULT_MODEL_PATH,
    reader=None,
    whonet_codes: Optional[Dict[str, Tuple[str, set]]] = None,
    whonet_path: Union[str, Path] = DEFAULT_WHONET_PATH,
    xlsx_path: Union[str, Path] = DEFAULT_XLSX_PATH,
    conf: float = 0.45,
    organism: str = "Escherichia coli",
    organism_group: str = "",
    standard: str = "EUCAST",
    enable_ocr: bool = True,
    ocr_angles: int = 8,
    preset_disc_labels: Optional[List[Dict[str, Any]]] = None,
    output_image_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Run full YOLO11n-seg -> fiducial calibration -> Sobel cross-validation -> EUCAST v16.1 pipeline."""
    t_start = time.perf_counter()

    if isinstance(image_source, np.ndarray):
        orig_img = image_source
        img_name = "capture.jpg"
    else:
        img_path = Path(image_source)
        orig_img = cv2.imread(str(img_path))
        if orig_img is None:
            raise ValueError(f"Could not load image at {img_path}")
        img_name = img_path.name

    h, w = orig_img.shape[:2]

    if model is None:
        model = YOLO(str(model_path))

    if enable_ocr and whonet_codes is None:
        whonet_codes = load_whonet_codes(whonet_path)
    elif not enable_ocr:
        whonet_codes = {}

    if enable_ocr and reader is None and whonet_codes:
        import easyocr

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    t_inf0 = time.perf_counter()
    results = model.predict(source=orig_img, conf=conf, verbose=False)
    inference_ms = (time.perf_counter() - t_inf0) * 1000.0
    result = results[0] if results else None

    disks: List[Dict[str, Any]] = []
    zones: List[Dict[str, Any]] = []

    if result is not None and result.masks is not None and result.boxes is not None:
        classes = result.boxes.cls.cpu().numpy().astype(int)
        confs = result.boxes.conf.cpu().numpy().astype(float)
        polys = result.masks.xy

        for cls_id, det_conf, poly in zip(classes, confs, polys):
            stats = _polygon_stats(poly)
            if stats is None:
                continue
            cx, cy, diam_px = stats
            entry = {
                "cx": cx,
                "cy": cy,
                "diam_px": diam_px,
                "conf": det_conf,
                "poly": poly,
            }
            if cls_id == CLASS_DISK:
                disks.append(entry)
            elif cls_id == CLASS_ZONE:
                zones.append(entry)

    db = get_breakpoint_db(xlsx_path=Path(xlsx_path), whonet_path=Path(whonet_path))
    resolved_group = normalize_group(organism_group or organism)
    std = (standard or "EUCAST").upper()

    if not disks:
        return {
            "image_name": img_name,
            "width": w,
            "height": h,
            "scale_px_per_mm": 0.0,
            "scale_mm_per_px": 0.0,
            "median_disk_px": 0.0,
            "disk_count": 0,
            "zone_count": len(zones),
            "inference_ms": round(inference_ms, 1),
            "total_ms": round((time.perf_counter() - t_start) * 1000.0, 1),
            "organism": organism,
            "organism_group": resolved_group,
            "standard": std,
            "eucast_version": db["version"],
            "summary": {"S": 0, "I": 0, "R": 0, "NA": 0, "geo_alerts": 0, "bio_alerts": 0},
            "detections": [],
        }

    median_disk_px = float(np.median([d["diam_px"] for d in disks]))
    px_per_mm = median_disk_px / DISK_DIAMETER_MM
    f_scale = DISK_DIAMETER_MM / median_disk_px

    # Pair each disk cleanly with at most one closest inhibition_zone (1-to-1 greedy assignment)
    pairs: List[Tuple[float, int, int]] = []
    for di, d in enumerate(disks):
        for zi, z in enumerate(zones):
            dist = math.hypot(d["cx"] - z["cx"], d["cy"] - z["cy"])
            # Zone center must lie reasonably near the disk center
            if dist <= max(d["diam_px"] * 2.5, z["diam_px"] * 0.45):
                pairs.append((dist, di, zi))
    pairs.sort(key=lambda item: item[0])

    assigned_zone: Dict[int, int] = {}
    used_zones = set()
    for _, di, zi in pairs:
        if di not in assigned_zone and zi not in used_zones:
            assigned_zone[di] = zi
            used_zones.add(zi)

    # Sort disks top-to-bottom, left-to-right for deterministic panel ordering
    disk_order = sorted(range(len(disks)), key=lambda i: (round(disks[i]["cy"] / max(1, h * 0.12)), disks[i]["cx"]))

    annotated = orig_img.copy()
    detections: List[Dict[str, Any]] = []
    summary = {"S": 0, "I": 0, "R": 0, "NA": 0, "geo_alerts": 0, "bio_alerts": 0}
    used_presets = set()

    for idx, di in enumerate(disk_order, start=1):
        d = disks[di]
        dx, dy, d_diam_px = d["cx"], d["cy"], d["diam_px"]
        zi = assigned_zone.get(di)

        if zi is not None:
            z = zones[zi]
            z_diam_mm = z["diam_px"] * f_scale
            if z_diam_mm > DISK_DIAMETER_MM * 1.08:
                diam_mm = round(z_diam_mm, 1)
                hx, hy = z["cx"], z["cy"]
                zone_poly = z["poly"]
            else:
                diam_mm = DISK_DIAMETER_MM
                hx, hy = dx, dy
                zone_poly = None
        else:
            diam_mm = DISK_DIAMETER_MM
            hx, hy = dx, dy
            zone_poly = None

        # Disk antibiotic code resolution: preset fallback or live OCR
        preset_code = None
        if preset_disc_labels:
            best_p, best_pd = None, float("inf")
            for pi, p in enumerate(preset_disc_labels):
                if pi in used_presets:
                    continue
                dist = math.hypot(p["x"] * w - dx, p["y"] * h - dy)
                if dist < d_diam_px * 1.4 and dist < best_pd:
                    best_pd = dist
                    best_p = (pi, p)
            if best_p is not None:
                used_presets.add(best_p[0])
                preset_code = best_p[1]["code"]

        if preset_code:
            abx_code = canonical_code(preset_code)
            raw_pot = preset_code.split("-")[1] if "-" in preset_code else ""
            pot_val = raw_pot
            ocr_score = 1.0
        else:
            abx_code, _, ocr_score, pot_val = identify_disk_code(
                orig_img, dx, dy, d_diam_px, reader, whonet_codes, ocr_angles=ocr_angles
            )

        # Geometric cross-validation (Section 4.6: 36-ray radial Sobel gradient)
        geo = validate_zone_geometry(
            image_bgr_or_gray=orig_img,
            disk_cx=dx,
            disk_cy=dy,
            disk_radius_px=d_diam_px / 2.0,
            yolo_diam_mm=diam_mm,
            f_scale_mm_per_px=f_scale,
            zone_cx=hx,
            zone_cy=hy,
        )

        # Clinical breakpoint & intrinsic resistance evaluation (EUCAST v16.1 / CLSI M100)
        eval_res = evaluate_susceptibility(
            abx_code=abx_code if abx_code != "UNK" else "",
            diameter_mm=diam_mm,
            organism_group=resolved_group,
            standard=std,
            organism_name=organism,
            db=db,
        )

        cat = eval_res["category"]
        summary[cat] = summary.get(cat, 0) + 1
        if geo["geo_alert"]:
            summary["geo_alerts"] += 1
        if eval_res["bio_alert"]:
            summary["bio_alerts"] += 1

        drug_meta = db["drugs"].get(eval_res["code"], {})
        pot_label = pot_val or (drug_meta.get("potency") or "").split("-")[0]
        display_code = f"{eval_res['code']}-{pot_label}" if pot_label and eval_res["code"] != "UNK" else eval_res["code"]
        if abx_code == "UNK":
            display_code = "UNK"

        det_record = {
            "id": idx,
            "code": display_code,
            "abx_code": eval_res["code"] if abx_code != "UNK" else "UNK",
            "abx_name": drug_meta.get("name") or eval_res["name"] or "Disco no identificado",
            "potency": pot_label,
            "x": round(dx / w, 5),
            "y": round(dy / h, 5),
            "w": round(d_diam_px / w, 5),
            "h": round(d_diam_px / h, 5),
            "hx": round(hx / w, 5),
            "hy": round(hy / h, 5),
            "diam_mm": diam_mm,
            "rounded_mm": round(diam_mm),
            "sobel_mm": geo["sobel_diam_mm"],
            "delta_r_mm": geo["delta_r_mm"],
            "geo_valid": geo["geo_valid"],
            "geo_alert": geo["geo_alert"],
            "geo_message": geo["geo_message"],
            "category": cat,
            "category_label": eval_res["category_label"],
            "bp_text": eval_res["bp_text"],
            "in_atu": eval_res["in_atu"],
            "atu_message": eval_res["atu_message"],
            "bio_alert": eval_res["bio_alert"],
            "bio_message": eval_res["bio_message"],
            "ocr_score": ocr_score,
            "disk_conf": round(d["conf"], 3),
            "zone_contour": _simplify_normalized_contour(zone_poly, w, h) if zone_poly is not None else [],
        }
        detections.append(det_record)

        # Draw annotated visualization
        cv2.polylines(annotated, [d["poly"].astype(np.int32)], True, (255, 130, 30), 2)
        color_bgr = CAT_BGR.get(cat, CAT_BGR["NA"])
        if zone_poly is not None:
            cv2.polylines(annotated, [zone_poly.astype(np.int32)], True, color_bgr, 3)

        tag_cat = cat if cat != "NA" else "-"
        label = f"{display_code}: {diam_mm:.1f}mm [{tag_cat}]"
        tx, ty = max(10, int(dx) - 80), max(28, int(dy) - int(d_diam_px * 0.55) - 6)
        cv2.putText(annotated, label, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 4, cv2.LINE_AA)
        cv2.putText(annotated, label, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.65, color_bgr, 2, cv2.LINE_AA)

    if output_image_path is not None:
        output_image_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_image_path), annotated)

    total_ms = (time.perf_counter() - t_start) * 1000.0
    return {
        "image_name": img_name,
        "width": w,
        "height": h,
        "scale_px_per_mm": round(px_per_mm, 3),
        "scale_mm_per_px": round(f_scale, 4),
        "median_disk_px": round(median_disk_px, 2),
        "disk_count": len(disks),
        "zone_count": len(zones),
        "inference_ms": round(inference_ms, 1),
        "total_ms": round(total_ms, 1),
        "organism": organism,
        "organism_group": resolved_group,
        "standard": std,
        "eucast_version": db["version"],
        "summary": summary,
        "detections": detections,
    }


def _collect_image_paths(source: str) -> List[Path]:
    src = Path(source)
    if src.is_file():
        return [src]
    if src.is_dir():
        exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        return sorted(p for p in src.iterdir() if p.suffix.lower() in exts)
    raise FileNotFoundError(f"Source path not found: {source}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure Kirby-Bauer inhibition zones in mm using YOLO11n-seg, Sobel cross-validation, and EUCAST v16.1."
    )
    parser.add_argument("source", type=str, help="Path to an image file or directory of images.")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL_PATH), help="Path to YOLO11n-seg weights.")
    parser.add_argument("--conf", type=float, default=0.45, help="Detection confidence threshold.")
    parser.add_argument("--output", type=Path, default=Path("runs/segment/measured"), help="Output directory.")
    parser.add_argument("--whonet", type=Path, default=DEFAULT_WHONET_PATH, help="Path to WHONET Antibiotics.txt.")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX_PATH, help="Path to EUCAST v16.1 XLSX workbook.")
    parser.add_argument("--organism", type=str, default="Escherichia coli", help="Isolate species name.")
    parser.add_argument("--group", type=str, default="", help="EUCAST taxonomic group override.")
    parser.add_argument("--standard", choices=["EUCAST", "CLSI"], default="EUCAST", help="Breakpoint standard.")
    parser.add_argument("--no-ocr", action="store_true", help="Disable OCR antibiotic disk identification.")
    parser.add_argument("--ocr-angles", type=int, default=16, help="Number of rotation angles for disk OCR.")
    args = parser.parse_args()

    model = YOLO(args.model)
    whonet_codes = {} if args.no_ocr else load_whonet_codes(args.whonet)
    reader = None
    if not args.no_ocr and whonet_codes:
        import easyocr

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    for img_path in _collect_image_paths(args.source):
        out_file = args.output / img_path.name
        report = analyze_plate_image(
            image_source=img_path,
            model=model,
            reader=reader,
            whonet_codes=whonet_codes,
            whonet_path=args.whonet,
            xlsx_path=args.xlsx,
            conf=args.conf,
            organism=args.organism,
            organism_group=args.group,
            standard=args.standard,
            enable_ocr=not args.no_ocr,
            ocr_angles=args.ocr_angles,
            output_image_path=out_file,
        )

        print(
            f"\n[{report['image_name']}] Organism: {report['organism']} ({report['organism_group']}) | "
            f"Std: {report['standard']} | Scale: {report['scale_mm_per_px']:.4f} mm/px "
            f"({report['scale_px_per_mm']:.2f} px/mm) | Disks: {report['disk_count']} | "
            f"YOLO: {report['inference_ms']:.0f} ms"
        )
        for d in report["detections"]:
            geo_tag = f"Δr={d['delta_r_mm']:.2f}mm" + ("" if d["geo_valid"] else " [!]")
            alerts = " ".join(x for x in (d["bio_message"], d["atu_message"]) if x)
            print(
                f"  #{d['id']:02d} | {d['code']:<8} ({d['abx_name'][:22]:<22}) | "
                f"{d['diam_mm']:5.1f} mm | {geo_tag:<14} | [{d['category']:<2}] | {d['bp_text']} {alerts}"
            )
        print(f"  Summary: S={report['summary']['S']} I={report['summary']['I']} R={report['summary']['R']} NA={report['summary']['NA']}")
        print(f"  Saved annotated image -> {out_file}")


if __name__ == "__main__":
    main()

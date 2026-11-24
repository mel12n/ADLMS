import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.evaluation.measure_zones import DISK_DIAMETER_MM, _polygon_stats
from src.models.export_model import letterbox_rgb
from src.utils.constants import DATA_DIR, EXPORTS_DIR, RESULTS_DIR


def _load_heldout_plates() -> list[Path]:
    demo_dir = DATA_DIR / "Antibiogram_demo"
    plates: list[Path] = []
    val_txt = demo_dir / "val.txt"
    if val_txt.exists():
        for line in val_txt.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            p = Path(line)
            if not p.is_absolute():
                p = (demo_dir / p).resolve()
            if p.exists():
                plates.append(p)
    test_dir = demo_dir / "Test_yolo"
    if test_dir.exists():
        plates.extend(sorted(test_dir.glob("*.jpg")))
    return plates


def _pair_disks_and_zones(disks: list[dict], zones: list[dict]) -> list[dict]:
    if not disks:
        return []
    median_disk_px = float(np.median([d["diam_px"] for d in disks]))
    f_scale = DISK_DIAMETER_MM / median_disk_px

    candidates = []
    for di, d in enumerate(disks):
        for zi, z in enumerate(zones):
            dist = math.hypot(d["cx"] - z["cx"], d["cy"] - z["cy"])
            if dist <= max(d["diam_px"] * 2.5, z["diam_px"] * 0.45):
                candidates.append((dist, di, zi))
    candidates.sort(key=lambda x: x[0])

    used_d, used_z = set(), set()
    paired = []
    for _, di, zi in candidates:
        if di in used_d or zi in used_z:
            continue
        used_d.add(di)
        used_z.add(zi)
        d = disks[di]
        z = zones[zi]
        z_diam_mm = z["diam_px"] * f_scale
        if z_diam_mm <= DISK_DIAMETER_MM * 1.08:
            z_diam_mm = DISK_DIAMETER_MM
        paired.append(
            {
                "cx": d["cx"],
                "cy": d["cy"],
                "diam_mm": float(z_diam_mm),
            }
        )

    for di, d in enumerate(disks):
        if di not in used_d:
            paired.append(
                {
                    "cx": d["cx"],
                    "cy": d["cy"],
                    "diam_mm": float(DISK_DIAMETER_MM),
                }
            )
    return paired


def _stats_dict(poly: np.ndarray):
    res = _polygon_stats(poly)
    if res is None:
        return None
    cx, cy, diam_px = res
    return {"cx": cx, "cy": cy, "diam_px": diam_px}


def _extract_pt_detections(model: YOLO, img_bgr: np.ndarray, conf: float = 0.45):
    res = model.predict(img_bgr, imgsz=416, conf=conf, verbose=False)[0]
    disks, zones, colonies = [], [], []
    if res.masks is None or res.boxes is None:
        return disks, zones, colonies
    classes = res.boxes.cls.cpu().numpy().astype(int)
    for cls_id, poly in zip(classes, res.masks.xy):
        if len(poly) < 3:
            continue
        stats = _stats_dict(poly)
        if stats is None:
            continue
        if cls_id == 0:
            disks.append(stats)
        elif cls_id == 1:
            zones.append(stats)
        elif cls_id == 2:
            colonies.append(stats)
    return disks, zones, colonies


def _extract_onnx_detections(
    sess: ort.InferenceSession,
    img_bgr: np.ndarray,
    imgsz: int,
    conf: float = 0.45,
    iou: float = 0.45,
):
    orig_h, orig_w = img_bgr.shape[:2]
    tensor, scale, (pad_left, pad_top) = letterbox_rgb(img_bgr, imgsz)
    input_name = sess.get_inputs()[0].name
    out0, out1 = sess.run(None, {input_name: tensor})

    preds = out0[0].T  # (N, 39)
    protos = out1[0]  # (32, S/4, S/4)
    proto_h, proto_w = protos.shape[1], protos.shape[2]
    protos_flat = protos.reshape(32, -1)

    boxes_xywh = preds[:, :4]
    cls_scores = preds[:, 4:7]
    mask_coeffs = preds[:, 7:39]

    max_scores = cls_scores.max(axis=1)
    cls_ids = cls_scores.argmax(axis=1)
    keep = max_scores >= conf
    if not np.any(keep):
        return [], [], []

    boxes_xywh = boxes_xywh[keep]
    max_scores = max_scores[keep]
    cls_ids = cls_ids[keep]
    mask_coeffs = mask_coeffs[keep]

    disks, zones, colonies = [], [], []
    for c in (0, 1, 2):
        c_mask = cls_ids == c
        if not np.any(c_mask):
            continue
        c_boxes = boxes_xywh[c_mask]
        c_scores = max_scores[c_mask]
        c_coeffs = mask_coeffs[c_mask]

        xywh_tl = np.column_stack(
            [
                c_boxes[:, 0] - c_boxes[:, 2] / 2.0,
                c_boxes[:, 1] - c_boxes[:, 3] / 2.0,
                c_boxes[:, 2],
                c_boxes[:, 3],
            ]
        )
        indices = cv2.dnn.NMSBoxes(
            xywh_tl.tolist(), c_scores.tolist(), conf, iou
        )
        if len(indices) == 0:
            continue
        for idx in np.array(indices).flatten():
            cx, cy, bw, bh = c_boxes[idx]
            x1 = max(0, int(math.floor(cx - bw / 2.0)))
            y1 = max(0, int(math.floor(cy - bh / 2.0)))
            x2 = min(imgsz, int(math.ceil(cx + bw / 2.0)))
            y2 = min(imgsz, int(math.ceil(cy + bh / 2.0)))
            if x2 <= x1 or y2 <= y1:
                continue

            raw_mask = (c_coeffs[idx] @ protos_flat).reshape(proto_h, proto_w)
            prob_mask = 1.0 / (1.0 + np.exp(-np.clip(raw_mask, -40.0, 40.0)))
            up_mask = cv2.resize(
                prob_mask, (imgsz, imgsz), interpolation=cv2.INTER_LINEAR
            )
            roi_mask = np.zeros((imgsz, imgsz), dtype=np.uint8)
            roi_mask[y1:y2, x1:x2] = (up_mask[y1:y2, x1:x2] > 0.5).astype(
                np.uint8
            )

            contours, _ = cv2.findContours(
                roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if not contours:
                continue
            largest = max(contours, key=cv2.contourArea)
            if len(largest) < 3:
                continue
            pts = largest.reshape(-1, 2).astype(np.float32)
            pts[:, 0] = np.clip((pts[:, 0] - pad_left) / scale, 0, orig_w)
            pts[:, 1] = np.clip((pts[:, 1] - pad_top) / scale, 0, orig_h)
            stats = _stats_dict(pts)
            if stats is None:
                continue
            if c == 0:
                disks.append(stats)
            elif c == 1:
                zones.append(stats)
            elif c == 2:
                colonies.append(stats)

    return disks, zones, colonies


def run_parity_benchmark(
    weights_path: Path, meta_path: Path, output_path: Path
) -> int:
    plates = _load_heldout_plates()
    if not plates:
        raise RuntimeError("No held-out plates found in val.txt or Test_yolo/")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    pt_model = YOLO(str(weights_path))

    pt_refs = {}
    pt_colony_total = 0
    for p in plates:
        img = cv2.imread(str(p))
        disks, zones, colonies = _extract_pt_detections(pt_model, img)
        pt_colony_total += len(colonies)
        median_px = (
            float(np.median([d["diam_px"] for d in disks])) if disks else 0.0
        )
        pt_refs[p.name] = {
            "paired": _pair_disks_and_zones(disks, zones),
            "median_disk_px": median_px,
            "inner_colony_count": len(colonies),
        }

    variant_results = []
    any_shippable = False

    for v in meta["variants"]:
        onnx_path = EXPORTS_DIR / v["filename"]
        sess = ort.InferenceSession(
            str(onnx_path), providers=["CPUExecutionProvider"]
        )
        abs_errors = []
        onnx_colony_total = 0
        for p in plates:
            img = cv2.imread(str(p))
            disks, zones, colonies = _extract_onnx_detections(
                sess, img, v["imgsz"]
            )
            onnx_colony_total += len(colonies)
            onnx_paired = _pair_disks_and_zones(disks, zones)
            ref = pt_refs[p.name]
            ref_paired = ref["paired"]
            tol = ref["median_disk_px"] * 1.2
            if tol <= 0 or not ref_paired:
                continue

            for op in onnx_paired:
                best_dist = float("inf")
                best_ref = None
                for rp in ref_paired:
                    dist = math.hypot(op["cx"] - rp["cx"], op["cy"] - rp["cy"])
                    if dist < best_dist:
                        best_dist = dist
                        best_ref = rp
                if best_ref is not None and best_dist <= tol:
                    abs_errors.append(abs(op["diam_mm"] - best_ref["diam_mm"]))

        mae = float(np.mean(abs_errors)) if abs_errors else None
        verdict = (
            "SHIPPABLE"
            if (mae is not None and mae <= 0.50 and len(abs_errors) > 0)
            else "NOT_SHIPPABLE"
        )
        if verdict == "SHIPPABLE":
            any_shippable = True

        variant_results.append(
            {
                "id": v["id"],
                "imgsz": v["imgsz"],
                "precision": v["precision"],
                "matched_zones": len(abs_errors),
                "mae_mm": round(mae, 4) if mae is not None else None,
                "verdict": verdict,
                "inner_colony_count": onnx_colony_total,
                "pt_inner_colony_count": pt_colony_total,
            }
        )

    report = {
        "heldout_plates": [p.name for p in plates],
        "plate_count": len(plates),
        "threshold_mae_mm": 0.50,
        "pt_inner_colony_total": pt_colony_total,
        "variants": variant_results,
        "overall_pass": any_shippable,
    }
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("| Variant | Matched Zones | MAE (mm) | Verdict | Inner Colony (ONNX / PT) |")
    print("| --- | ---: | ---: | --- | ---: |")
    for r in variant_results:
        mae_str = f"{r['mae_mm']:.4f}" if r["mae_mm"] is not None else "N/A"
        print(
            f"| {r['id']} | {r['matched_zones']} | {mae_str} | {r['verdict']} | "
            f"{r['inner_colony_count']} / {r['pt_inner_colony_count']} |"
        )

    return 0 if any_shippable else 1


if __name__ == "__main__":
    code = run_parity_benchmark(
        weights_path=RESULTS_DIR / "yolo11n_microbiology" / "weights" / "best.pt",
        meta_path=EXPORTS_DIR / "model_meta.json",
        output_path=EXPORTS_DIR / "onnx_parity_report.json",
    )
    sys.exit(code)

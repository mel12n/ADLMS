"""Golden Parity Harness: Python ONNX/CV vs Pure-JS (yolo_seg_decode.js + sobel_cv.js).

Compares Python onnxruntime + measure_zones/cross_validation reference decoding
against mvp_web/inference/yolo_seg_decode.js and mvp_web/inference/sobel_cv.js
on held-out 1:1 validation plates AND a synthesized 1600x1200 (4:3) plate.
Writes exports/js_parity_report.json and exits 0 iff MAE < 0.20 mm on both.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.evaluation.cross_validation import validate_zone_geometry
from src.evaluation.measure_zones import DISK_DIAMETER_MM
from src.evaluation.verify_onnx_parity import (
    _load_heldout_plates,
    _pair_disks_and_zones,
)
from src.models.export_model import letterbox_rgb
from src.utils.constants import EXPORTS_DIR

MODEL_PATH = ROOT / "mvp_web" / "models" / "yolo11n_seg_416_fp32.onnx"
REPORT_PATH = EXPORTS_DIR / "js_parity_report.json"
IMGSZ = 416
MAE_THRESHOLD_MM = 0.20

JS_RUNNER = r"""
const fs = require('fs');
const path = require('path');

const [rootDir, tmpDir, origWStr, origHStr, imgszStr, nAnchorsStr, protoHStr, protoWStr] = process.argv.slice(1);
const origW = Number(origWStr);
const origH = Number(origHStr);
const imgsz = Number(imgszStr);
const nAnchors = Number(nAnchorsStr);
const protoH = Number(protoHStr);
const protoW = Number(protoWStr);

const decoder = require(path.join(rootDir, 'mvp_web/inference/yolo_seg_decode.js'));
const sobel = require(path.join(rootDir, 'mvp_web/inference/sobel_cv.js'));

const out0Buf = fs.readFileSync(path.join(tmpDir, 'output0.bin'));
const out1Buf = fs.readFileSync(path.join(tmpDir, 'output1.bin'));
const rgbaBuf = fs.readFileSync(path.join(tmpDir, 'rgba.bin'));

const out0 = new Float32Array(out0Buf.buffer, out0Buf.byteOffset, out0Buf.byteLength / 4);
const out1 = new Float32Array(out1Buf.buffer, out1Buf.byteOffset, out1Buf.byteLength / 4);
const rgba = new Uint8Array(rgbaBuf.buffer, rgbaBuf.byteOffset, rgbaBuf.byteLength);

const lb = decoder.computeLetterbox(origW, origH, imgsz);
const decoded = decoder.decodeYoloSeg(out0, out1, [1, 39, nAnchors], [1, 32, protoH, protoW], lb);
const grayBlurred = sobel.extractBlurredLuminance(rgba, origW, origH);

const fScale = decoded.scale_mm_per_px;
for (const det of decoded.detections) {
  const diskRadiusPx = (det.disk_diam_px || decoded.median_disk_px || 20) * 0.5;
  const cv = sobel.validateZoneGeometry(
    grayBlurred,
    origW,
    origH,
    det.hx_px,
    det.hy_px,
    diskRadiusPx,
    det.diam_mm,
    fScale
  );
  det.sobel_diam_mm = cv.sobel_diam_mm;
  det.delta_r_mm = cv.delta_r_mm;
  det.geo_valid = cv.geo_valid;
}

process.stdout.write(JSON.stringify({
  lb,
  scale_px_per_mm: decoded.scale_px_per_mm,
  scale_mm_per_px: decoded.scale_mm_per_px,
  median_disk_px: decoded.median_disk_px,
  disk_count: decoded.disk_count,
  zone_count: decoded.zone_count,
  inner_colony_count: decoded.inner_colony_count,
  detections: decoded.detections
}));
"""


def _synthesize_4_3_plate(img_bgr: np.ndarray, target_w: int = 1600, target_h: int = 1200) -> np.ndarray:
    """Pad a 1:1 plate into a 1600x1200 (4:3) frame so letterbox padTop > 0 is exercised."""
    h, w = img_bgr.shape[:2]
    scale = min(target_w / w, target_h / h)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))
    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((target_h, target_w, 3), 114, dtype=np.uint8)
    x0 = (target_w - new_w) // 2
    y0 = (target_h - new_h) // 2
    canvas[y0 : y0 + new_h, x0 : x0 + new_w] = resized
    return canvas


def _run_js_decoder_and_sobel(
    out0: np.ndarray,
    out1: np.ndarray,
    img_bgr: np.ndarray,
    imgsz: int,
) -> Dict[str, Any]:
    orig_h, orig_w = img_bgr.shape[:2]
    rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGBA)
    n_anchors = int(out0.shape[2])
    proto_h = int(out1.shape[2])
    proto_w = int(out1.shape[3])

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        np.ascontiguousarray(out0, dtype=np.float32).tofile(tmp / "output0.bin")
        np.ascontiguousarray(out1, dtype=np.float32).tofile(tmp / "output1.bin")
        np.ascontiguousarray(rgba, dtype=np.uint8).tofile(tmp / "rgba.bin")

        proc = subprocess.run(
            [
                "node",
                "-e",
                JS_RUNNER,
                str(ROOT),
                str(tmp),
                str(orig_w),
                str(orig_h),
                str(imgsz),
                str(n_anchors),
                str(proto_h),
                str(proto_w),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(proc.stdout)


def _extract_py_reference_detections(
    out0: np.ndarray,
    out1: np.ndarray,
    orig_w: int,
    orig_h: int,
    imgsz: int,
    scale: float,
    pad_left: int,
    pad_top: int,
    conf: float = 0.45,
    iou: float = 0.45,
) -> Tuple[List[Dict[str, float]], List[Dict[str, float]], List[Dict[str, float]]]:
    """Python reference ONNX decoder with 4x bilinear logit upsampling to imgsz x imgsz."""
    preds = out0[0].T  # (N, 39)
    protos = out1[0]   # (32, proto_h, proto_w)
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

    disks: List[Dict[str, float]] = []
    zones: List[Dict[str, float]] = []
    colonies: List[Dict[str, float]] = []

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
        indices = cv2.dnn.NMSBoxes(xywh_tl.tolist(), c_scores.tolist(), conf, iou)
        if len(indices) == 0:
            continue
        for idx in np.array(indices).flatten():
            cx, cy, bw, bh = c_boxes[idx]
            ix1 = max(0, min(imgsz - 1, int(math.floor(cx - bw / 2.0))))
            iy1 = max(0, min(imgsz - 1, int(math.floor(cy - bh / 2.0))))
            ix2 = max(0, min(imgsz - 1, int(math.ceil(cx + bw / 2.0)) - 1))
            iy2 = max(0, min(imgsz - 1, int(math.ceil(cy + bh / 2.0)) - 1))
            if ix2 < ix1 or iy2 < iy1:
                continue

            raw_logits = (c_coeffs[idx] @ protos_flat).reshape(proto_h, proto_w)
            up_logits = cv2.resize(raw_logits, (imgsz, imgsz), interpolation=cv2.INTER_LINEAR)
            roi_bin = (up_logits[iy1 : iy2 + 1, ix1 : ix2 + 1] > 0.0)
            area_in = int(roi_bin.sum())
            if area_in == 0:
                continue

            ys, xs = np.nonzero(roi_bin)
            cx_in = float(xs.mean() + ix1 + 0.5)
            cy_in = float(ys.mean() + iy1 + 0.5)
            cx_orig = float(np.clip((cx_in - pad_left) / scale, 0, orig_w))
            cy_orig = float(np.clip((cy_in - pad_top) / scale, 0, orig_h))
            area_orig = area_in / (scale * scale)
            diam_px = 2.0 * math.sqrt(area_orig / math.pi)
            stats = {"cx": cx_orig, "cy": cy_orig, "diam_px": diam_px}
            if c == 0:
                disks.append(stats)
            elif c == 1:
                zones.append(stats)
            elif c == 2:
                colonies.append(stats)

    return disks, zones, colonies


def _evaluate_plate(
    sess: ort.InferenceSession,
    name: str,
    aspect_label: str,
    img_bgr: np.ndarray,
) -> Tuple[Dict[str, Any], List[float], List[float]]:
    orig_h, orig_w = img_bgr.shape[:2]
    tensor, scale, (pad_left, pad_top) = letterbox_rgb(img_bgr, IMGSZ)
    input_name = sess.get_inputs()[0].name
    out0, out1 = sess.run(None, {input_name: tensor})

    # Python reference detections + pairing (4x bilinear logit upsampling)
    py_disks, py_zones, py_colonies = _extract_py_reference_detections(
        out0, out1, orig_w, orig_h, IMGSZ, scale, pad_left, pad_top
    )
    py_paired = _pair_disks_and_zones(py_disks, py_zones)
    py_median_disk_px = float(np.median([d["diam_px"] for d in py_disks])) if py_disks else 0.0
    py_f_scale = DISK_DIAMETER_MM / py_median_disk_px if py_median_disk_px > 0 else 0.0

    # Pure-JS detections + Sobel
    js_res = _run_js_decoder_and_sobel(out0, out1, img_bgr, IMGSZ)
    js_dets = js_res["detections"]

    tol = max(py_median_disk_px * 1.2, 20.0)
    diam_errors: List[float] = []
    sobel_delta_r_diffs: List[float] = []

    for jd in js_dets:
        best_dist = float("inf")
        best_py = None
        for pd in py_paired:
            dist = math.hypot(jd["cx_px"] - pd["cx"], jd["cy_px"] - pd["cy"])
            if dist < best_dist:
                best_dist = dist
                best_py = pd
        if best_py is not None and best_dist <= tol:
            diam_errors.append(abs(float(jd["diam_mm"]) - float(best_py["diam_mm"])))
            py_cv = validate_zone_geometry(
                img_bgr,
                best_py["cx"],
                best_py["cy"],
                py_median_disk_px * 0.5,
                best_py["diam_mm"],
                py_f_scale,
            )
            sobel_delta_r_diffs.append(
                abs(float(jd["delta_r_mm"]) - float(py_cv["delta_r_mm"]))
            )

    plate_mae = float(np.mean(diam_errors)) if diam_errors else None
    plate_sobel_diff = float(np.mean(sobel_delta_r_diffs)) if sobel_delta_r_diffs else None

    plate_report = {
        "plate": name,
        "aspect": aspect_label,
        "dimensions": f"{orig_w}x{orig_h}",
        "letterbox_pad_top": js_res["lb"]["padTop"],
        "py_disks": len(py_disks),
        "js_disks": js_res["disk_count"],
        "py_inner_colonies": len(py_colonies),
        "js_inner_colonies": js_res["inner_colony_count"],
        "matched_detections": len(diam_errors),
        "mae_mm": round(plate_mae, 4) if plate_mae is not None else None,
        "sobel_delta_r_mae_mm": round(plate_sobel_diff, 4) if plate_sobel_diff is not None else None,
    }
    return plate_report, diam_errors, sobel_delta_r_diffs


def main() -> int:
    if not MODEL_PATH.exists():
        print(f"ERROR: Model not found at {MODEL_PATH}", file=sys.stderr)
        return 1

    plates = _load_heldout_plates()
    if not plates:
        print("ERROR: No held-out plates found in data/Antibiogram_demo/val.txt or Test_yolo/", file=sys.stderr)
        return 1

    sess = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])

    plate_reports: List[Dict[str, Any]] = []
    all_diam_errors: List[float] = []
    all_sobel_diffs: List[float] = []

    for p in plates:
        img_bgr = cv2.imread(str(p))
        if img_bgr is None:
            continue
        rep, d_errs, s_diffs = _evaluate_plate(sess, p.name, "1:1", img_bgr)
        plate_reports.append(rep)
        all_diam_errors.extend(d_errs)
        all_sobel_diffs.extend(s_diffs)

    # Synthesize 1600x1200 (4:3) plate from the first held-out plate so padTop > 0 is verified
    first_img = cv2.imread(str(plates[0]))
    img_4_3 = _synthesize_4_3_plate(first_img, 1600, 1200)
    rep_4_3, errs_4_3, sobel_4_3 = _evaluate_plate(
        sess, f"{plates[0].stem}_synth_1600x1200.jpg", "4:3", img_4_3
    )
    plate_reports.append(rep_4_3)
    all_diam_errors.extend(errs_4_3)
    all_sobel_diffs.extend(sobel_4_3)

    overall_mae = float(np.mean(all_diam_errors)) if all_diam_errors else 999.0
    mae_4_3 = rep_4_3["mae_mm"] if rep_4_3["mae_mm"] is not None else 999.0
    overall_sobel_diff = float(np.mean(all_sobel_diffs)) if all_sobel_diffs else 999.0

    passed = (
        len(all_diam_errors) > 0
        and overall_mae < MAE_THRESHOLD_MM
        and mae_4_3 < MAE_THRESHOLD_MM
        and rep_4_3["letterbox_pad_top"] > 0
    )

    report = {
        "model": MODEL_PATH.name,
        "imgsz": IMGSZ,
        "threshold_mae_mm": MAE_THRESHOLD_MM,
        "total_matched_detections": len(all_diam_errors),
        "overall_mae_mm": round(overall_mae, 4),
        "plate_4_3_mae_mm": round(mae_4_3, 4),
        "overall_sobel_delta_r_mae_mm": round(overall_sobel_diff, 4),
        "pass": passed,
        "plates": plate_reports,
    }

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("| Plate | Aspect | Dims | padTop | Matched | MAE (mm) | Sobel Δr Diff (mm) |")
    print("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for r in plate_reports:
        print(
            f"| {r['plate']} | {r['aspect']} | {r['dimensions']} | {r['letterbox_pad_top']} | "
            f"{r['matched_detections']} | {r['mae_mm']} | {r['sobel_delta_r_mae_mm']} |"
        )
    print(
        f"\nOverall MAE: {report['overall_mae_mm']:.4f} mm | "
        f"4:3 Plate MAE: {report['plate_4_3_mae_mm']:.4f} mm | "
        f"Threshold: < {MAE_THRESHOLD_MM:.2f} mm | PASS: {passed}"
    )

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())

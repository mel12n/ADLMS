import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
import onnx
from onnx import TensorProto
from onnxruntime.quantization import (
    CalibrationDataReader,
    CalibrationMethod,
    QuantFormat,
    QuantType,
    quantize_static,
)
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import BASE_DIR, DATA_DIR, EXPORTS_DIR, RESULTS_DIR

EXPECTED_N = {320: 2100, 416: 3549}
FORBIDDEN_OPS = {"ConvInteger", "MatMulInteger", "QLinearConv", "NonMaxSuppression"}
CANONICAL_CLASSES = {
    "0": "antibiotic_disk",
    "1": "inhibition_zone",
    "2": "inner_colony",
}


def letterbox_rgb(img_bgr: np.ndarray, imgsz: int, pad_val: int = 114):
    """Resize and pad BGR image to [1, 3, imgsz, imgsz] RGB float32 in [0, 1]."""
    h, w = img_bgr.shape[:2]
    scale = min(imgsz / h, imgsz / w)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    dw = (imgsz - new_w) / 2.0
    dh = (imgsz - new_h) / 2.0
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))

    padded = cv2.copyMakeBorder(
        resized,
        top,
        bottom,
        left,
        right,
        cv2.BORDER_CONSTANT,
        value=(pad_val, pad_val, pad_val),
    )
    rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)
    chw = np.transpose(rgb, (2, 0, 1)).astype(np.float32) / 255.0
    return np.ascontiguousarray(chw[None, ...]), scale, (left, top)


def _resolve_manifest_paths() -> list[Path]:
    demo_dir = DATA_DIR / "Antibiogram_demo"
    paths: list[Path] = []
    for name in ("train.txt", "val.txt"):
        manifest = demo_dir / name
        if not manifest.exists():
            continue
        for line in manifest.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            p = Path(line)
            if not p.is_absolute():
                p = (demo_dir / p).resolve()
            if p.exists():
                paths.append(p)
    return paths


class PlateCalibrationReader(CalibrationDataReader):
    """Calibration data reader yielding preprocessed plate tensors."""

    def __init__(self, image_paths: list[Path], imgsz: int, input_name: str = "images"):
        self.image_paths = image_paths
        self.imgsz = imgsz
        self.input_name = input_name
        self._idx = 0

    def get_next(self):
        while self._idx < len(self.image_paths):
            path = self.image_paths[self._idx]
            self._idx += 1
            img = cv2.imread(str(path))
            if img is None:
                continue
            tensor, _, _ = letterbox_rgb(img, self.imgsz)
            return {self.input_name: tensor}
        return None

    def rewind(self):
        self._idx = 0


def _static_shape(value_info) -> list[int]:
    dims = []
    for d in value_info.type.tensor_type.shape.dim:
        if d.HasField("dim_value"):
            dims.append(int(d.dim_value))
        else:
            raise AssertionError(
                f"Dynamic axis '{d.dim_param}' found on tensor '{value_info.name}'"
            )
    return dims


def audit_onnx_graph(onnx_path: Path, imgsz: int) -> dict:
    """Verify opset=17, static shapes, zero FP16 tensors, and zero forbidden ops."""
    model = onnx.load(str(onnx_path))

    opsets = {op.domain: op.version for op in model.opset_import}
    default_opset = opsets.get("", opsets.get("ai.onnx"))
    if default_opset != 17:
        raise AssertionError(f"{onnx_path.name}: expected opset 17, got {default_opset}")

    if len(model.graph.input) != 1:
        raise AssertionError(
            f"{onnx_path.name}: expected 1 input, got {len(model.graph.input)}"
        )
    in_shape = _static_shape(model.graph.input[0])
    expected_in = [1, 3, imgsz, imgsz]
    if in_shape != expected_in:
        raise AssertionError(
            f"{onnx_path.name}: expected input shape {expected_in}, got {in_shape}"
        )

    if len(model.graph.output) != 2:
        raise AssertionError(
            f"{onnx_path.name}: expected 2 outputs, got {len(model.graph.output)}"
        )
    out0_shape = _static_shape(model.graph.output[0])
    out1_shape = _static_shape(model.graph.output[1])
    expected_out0 = [1, 39, EXPECTED_N[imgsz]]
    expected_out1 = [1, 32, imgsz // 4, imgsz // 4]
    if out0_shape != expected_out0:
        raise AssertionError(
            f"{onnx_path.name}: expected output0 {expected_out0}, got {out0_shape}"
        )
    if out1_shape != expected_out1:
        raise AssertionError(
            f"{onnx_path.name}: expected output1 {expected_out1}, got {out1_shape}"
        )

    for init in model.graph.initializer:
        if init.data_type == TensorProto.FLOAT16:
            raise AssertionError(
                f"{onnx_path.name}: FLOAT16 initializer found: {init.name}"
            )
    for vi in (
        list(model.graph.input)
        + list(model.graph.output)
        + list(model.graph.value_info)
    ):
        if vi.type.tensor_type.elem_type == TensorProto.FLOAT16:
            raise AssertionError(f"{onnx_path.name}: FLOAT16 tensor found: {vi.name}")

    for node in model.graph.node:
        if node.op_type in FORBIDDEN_OPS:
            raise AssertionError(
                f"{onnx_path.name}: forbidden op '{node.op_type}' in node '{node.name}'"
            )

    return {
        "input_shape": in_shape,
        "output_shapes": [out0_shape, out1_shape],
    }


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def export_all_variants(weights_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    calib_paths = _resolve_manifest_paths()
    if not calib_paths:
        raise RuntimeError("No calibration images found in train.txt / val.txt")

    variants_meta = []
    excluded_counts = {}

    for imgsz in (320, 416):
        model = YOLO(str(weights_path))
        exported = Path(
            model.export(
                format="onnx",
                imgsz=imgsz,
                opset=17,
                dynamic=False,
                nms=False,
                simplify=True,
                half=False,
            )
        )
        fp32_path = output_dir / f"yolo11n_seg_{imgsz}_fp32.onnx"
        if exported.resolve() != fp32_path.resolve():
            shutil.move(str(exported), str(fp32_path))

        fp32_shapes = audit_onnx_graph(fp32_path, imgsz)

        fp32_model = onnx.load(str(fp32_path))
        input_name = fp32_model.graph.input[0].name
        nodes_to_exclude = [
            n.name
            for n in fp32_model.graph.node
            if n.op_type == "Conv" and "/model.23/" in n.name
        ]
        excluded_counts[str(imgsz)] = len(nodes_to_exclude)

        qdq_path = output_dir / f"yolo11n_seg_{imgsz}_qdq_int8.onnx"
        reader = PlateCalibrationReader(calib_paths, imgsz=imgsz, input_name=input_name)
        quantize_static(
            model_input=str(fp32_path),
            model_output=str(qdq_path),
            calibration_data_reader=reader,
            quant_format=QuantFormat.QDQ,
            op_types_to_quantize=["Conv"],
            per_channel=True,
            activation_type=QuantType.QUInt8,
            weight_type=QuantType.QInt8,
            calibrate_method=CalibrationMethod.MinMax,
            nodes_to_exclude=nodes_to_exclude,
        )
        qdq_shapes = audit_onnx_graph(qdq_path, imgsz)

        for variant_id, path, precision, shapes in (
            (f"yolo11n_seg_{imgsz}_fp32", fp32_path, "fp32", fp32_shapes),
            (f"yolo11n_seg_{imgsz}_qdq_int8", qdq_path, "qdq_int8", qdq_shapes),
        ):
            variants_meta.append(
                {
                    "id": variant_id,
                    "filename": path.name,
                    "imgsz": imgsz,
                    "precision": precision,
                    "input_shape": shapes["input_shape"],
                    "output_shapes": shapes["output_shapes"],
                    "size_bytes": path.stat().st_size,
                    "sha256": _sha256_file(path),
                }
            )

    meta = {
        "schema_version": "1.0",
        "opset": 17,
        "classes": CANONICAL_CLASSES,
        "calibration": {
            "image_count": len(calib_paths),
            "method": "MinMax",
            "quant_format": "QDQ",
            "excluded_segment_conv_nodes": excluded_counts,
        },
        "variants": variants_meta,
    }
    meta_path = output_dir / "model_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Exported 4 ONNX variants and wrote {meta_path}")
    return meta_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Export 4 WASM-safe static opset=17 ONNX variants"
    )
    parser.add_argument(
        "--weights",
        type=Path,
        default=RESULTS_DIR / "yolo11n_microbiology" / "weights" / "best.pt",
        help="Path to best.pt weights",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=EXPORTS_DIR,
        help="Output directory for ONNX artifacts and model_meta.json",
    )
    args = parser.parse_args()
    export_all_variants(args.weights, args.output_dir)

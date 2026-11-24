import hashlib
import json
import sys
import unittest
from pathlib import Path

import onnxruntime as ort

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.models.export_model import audit_onnx_graph
from src.utils.constants import EXPORTS_DIR


class TestPhase6Onnx(unittest.TestCase):
    def setUp(self):
        self.meta_path = EXPORTS_DIR / "model_meta.json"
        self.assertTrue(self.meta_path.exists(), f"Missing {self.meta_path}")
        self.meta = json.loads(self.meta_path.read_text(encoding="utf-8"))

    def test_model_meta_schema(self):
        self.assertEqual(self.meta.get("opset"), 17)
        self.assertEqual(
            self.meta.get("classes"),
            {
                "0": "antibiotic_disk",
                "1": "inhibition_zone",
                "2": "inner_colony",
            },
        )
        variants = self.meta.get("variants", [])
        self.assertEqual(len(variants), 4)
        ids = {v["id"] for v in variants}
        self.assertEqual(
            ids,
            {
                "yolo11n_seg_320_fp32",
                "yolo11n_seg_320_qdq_int8",
                "yolo11n_seg_416_fp32",
                "yolo11n_seg_416_qdq_int8",
            },
        )

    def test_artifacts_sha256_graph_and_ort_load(self):
        for v in self.meta["variants"]:
            onnx_path = EXPORTS_DIR / v["filename"]
            self.assertTrue(onnx_path.exists(), f"Missing {onnx_path}")
            self.assertEqual(onnx_path.stat().st_size, v["size_bytes"])

            h = hashlib.sha256()
            with onnx_path.open("rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            self.assertEqual(h.hexdigest(), v["sha256"])

            shapes = audit_onnx_graph(onnx_path, v["imgsz"])
            self.assertEqual(shapes["input_shape"], v["input_shape"])
            self.assertEqual(shapes["output_shapes"], v["output_shapes"])

            sess = ort.InferenceSession(
                str(onnx_path), providers=["CPUExecutionProvider"]
            )
            self.assertEqual(len(sess.get_inputs()), 1)
            self.assertEqual(len(sess.get_outputs()), 2)


if __name__ == "__main__":
    unittest.main()

"""Phase 11 Python parity unit tests (Track B: ROI -> CLAHE, > 85% skip fallback, 0.5 mm Sobel)."""

from __future__ import annotations

import ast
import sys
import unittest
from pathlib import Path
from unittest import mock

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.data import preprocess
from src.evaluation import cross_validation


class TestPhase11PythonParity(unittest.TestCase):
    def test_sobel_threshold_is_0_5_mm(self) -> None:
        """D-05: 0.5 mm radius (1.0 mm diameter per Hombach et al., 2014)."""
        self.assertEqual(cross_validation.GEOMETRIC_DELTA_THRESHOLD_MM, 0.5)

    def test_sobel_alerts_above_0_5_mm(self) -> None:
        """Verify validate_zone_geometry flags delta_r > 0.5 mm as geometric alert."""
        h, w = 300, 300
        img = np.full((h, w, 3), 210, dtype=np.uint8)
        cx, cy = 150, 150
        # Draw dark bacterial lawn outside radius 80 px (16.0 mm diameter at 0.1 mm/px)
        yy, xx = np.ogrid[:h, :w]
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        img[dist > 80.0] = (45, 45, 45)

        res_alert = cross_validation.validate_zone_geometry(
            image_bgr_or_gray=img,
            disk_cx=cx,
            disk_cy=cy,
            disk_radius_px=30.0,
            yolo_diam_mm=17.4,  # 8.7 mm radius vs 8.0 mm true -> delta_r = 0.7 mm > 0.5 mm
            f_scale_mm_per_px=0.1,
        )
        self.assertTrue(res_alert["geo_alert"])
        self.assertFalse(res_alert["geo_valid"])
        self.assertIn("0.5 mm", res_alert["geo_message"])

        res_ok = cross_validation.validate_zone_geometry(
            image_bgr_or_gray=img,
            disk_cx=cx,
            disk_cy=cy,
            disk_radius_px=30.0,
            yolo_diam_mm=16.0,  # 8.0 mm radius vs 8.0 mm true -> delta_r <= 0.5 mm
            f_scale_mm_per_px=0.1,
        )
        self.assertFalse(res_ok["geo_alert"])
        self.assertTrue(res_ok["geo_valid"])

    def test_crop_plate_roi_skips_when_fill_ratio_exceeds_85_percent(self) -> None:
        """D-01: Synthetic 400x400 image with r=185 Petri dish (>85% fill) skips crop."""
        img = np.full((400, 400, 3), 25, dtype=np.uint8)
        cv2.circle(img, (200, 200), 185, (215, 210, 195), thickness=-1)
        cv2.circle(img, (200, 200), 185, (245, 245, 245), thickness=2)

        cropped, box = preprocess.crop_plate_roi(img)
        self.assertEqual(cropped.shape, img.shape)
        self.assertEqual(box, (0, 0, 400, 400))

    def test_crop_plate_roi_crops_smaller_plate(self) -> None:
        """D-01: Plate filling <= 85% (e.g. r=135 in 400x400, 67.5%) is cropped to ROI."""
        img = np.full((400, 400, 3), 25, dtype=np.uint8)
        cv2.circle(img, (200, 200), 135, (215, 210, 195), thickness=-1)
        cv2.circle(img, (200, 200), 135, (245, 245, 245), thickness=2)

        cropped, box = preprocess.crop_plate_roi(img)
        x1, y1, x2, y2 = box
        self.assertLess(cropped.shape[0], 400)
        self.assertLess(cropped.shape[1], 400)
        self.assertGreaterEqual(x1, 0)
        self.assertGreaterEqual(y1, 0)
        self.assertLessEqual(x2, 400)
        self.assertLessEqual(y2, 400)

    def test_preprocess_pipeline_executes_roi_before_clahe(self) -> None:
        """D-03: preprocess_plate_image executes crop_plate_roi strictly before apply_clahe."""
        call_order: list[str] = []
        dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)

        def fake_roi(img: np.ndarray):
            call_order.append("crop_plate_roi")
            return img, (0, 0, img.shape[1], img.shape[0])

        def fake_clahe(img: np.ndarray):
            call_order.append("apply_clahe")
            return img

        with (
            mock.patch.object(preprocess.cv2, "imread", return_value=dummy_img),
            mock.patch.object(preprocess, "crop_plate_roi", side_effect=fake_roi),
            mock.patch.object(preprocess, "apply_clahe", side_effect=fake_clahe),
        ):
            out = preprocess.preprocess_plate_image("dummy_plate.jpg", target_size=(64, 64))

        self.assertEqual(call_order, ["crop_plate_roi", "apply_clahe"])
        self.assertEqual(out.shape, (64, 64, 3))

    def test_streamlit_app_executes_roi_before_clahe(self) -> None:
        """D-03: streamlit_app.py runs apply_plate_roi strictly before apply_optical_clahe."""
        app_path = BASE_DIR / "streamlit_app.py"
        src = app_path.read_text(encoding="utf-8")

        # Locate the main preprocessing block where proc_img is transformed
        block_start = src.index("proc_img = base_img.copy()")
        block_end = src.index("col_img, col_metrics", block_start)
        block = src[block_start:block_end]

        roi_idx = block.index("apply_plate_roi(")
        clahe_idx = block.index("apply_optical_clahe(")
        self.assertLess(
            roi_idx,
            clahe_idx,
            "streamlit_app.py must call apply_plate_roi() before apply_optical_clahe()",
        )

        # Ensure streamlit_app.py remains syntactically valid AST
        ast.parse(src, filename=str(app_path))


if __name__ == "__main__":
    unittest.main()

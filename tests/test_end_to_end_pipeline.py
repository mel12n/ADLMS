"""End-to-end verification tests for EUCAST v16.1, dual cross-validation,
YOLO11n-seg zone measurement, and the live Web MVP inference HTTP server.
"""

from __future__ import annotations

import base64
import json
import sys
import threading
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from run_web_mvp import ENGINE, Handler, ThreadedHTTPServer
from src.evaluation.cross_validation import validate_intrinsic_resistance
from src.evaluation.eucast_breakpoints import (
    DEFAULT_JSON_OUT,
    DEFAULT_JS_OUT,
    DEFAULT_XLSX_PATH,
    evaluate_susceptibility,
    parse_eucast_xlsx,
)
from src.evaluation.measure_zones import DEFAULT_MODEL_PATH, analyze_plate_image


def test_eucast_v16_1_xlsx_parsing_and_intrinsic_rules():
    assert DEFAULT_XLSX_PATH.is_file(), "EUCAST v16.1 workbook must exist"
    db = parse_eucast_xlsx()
    drugs = db["drugs"]

    assert drugs["CTX"]["eucast"]["Enterobacterales"]["s"] == 20
    assert drugs["CTX"]["eucast"]["Enterobacterales"]["r"] == 17
    assert drugs["CRO"]["eucast"]["Enterobacterales"]["s"] == 27
    assert drugs["FEP"]["eucast"]["Enterobacterales"]["s"] == 27
    assert drugs["FOX"]["eucast"]["Staphylococcus"]["s"] == 22

    # Intrinsic resistance rule (Section 4.6): K. pneumoniae + Ampicillin 26 mm -> override S to R
    kp = evaluate_susceptibility("AM", 26.0, "Enterobacterales", "EUCAST", "Klebsiella pneumoniae")
    assert kp["category"] == "R"
    assert kp["bio_alert"] is True
    assert "Resistencia Intrínseca" in kp["bio_message"]

    ecoli_ctx = evaluate_susceptibility("CTX", 21.0, "Enterobacterales", "EUCAST", "Escherichia coli")
    assert ecoli_ctx["category"] == "S"
    assert ecoli_ctx["bio_alert"] is False

    bio_noop = validate_intrinsic_resistance("IPM", "S", "Escherichia coli")
    assert bio_noop["bio_alert"] is False


def test_web_mvp_generated_bundles_exist():
    assert DEFAULT_JSON_OUT.is_file()
    assert DEFAULT_JS_OUT.is_file()
    plates_js = BASE_DIR / "mvp_web" / "plates_data.js"
    assert plates_js.is_file()
    data = json.loads(plates_js.read_text(encoding="utf-8").split("window.ADLMS_PLATES =", 1)[1].strip().rstrip(";"))
    assert len(data) >= 4
    assert all(p["scalePxPerMm"] > 0 for p in data)
    test_plate = next(p for p in data if p["key"] == "test_01")
    codes = {d["abxCode"] for d in test_plate["discs"]}
    assert {"CTX", "PRL", "SAM", "IPM"}.issubset(codes)


def test_end_to_end_yolo_sobel_and_http_api():
    test_img_path = BASE_DIR / "data" / "Antibiogram_demo" / "Test" / "IMG20230323111029.jpg"
    assert DEFAULT_MODEL_PATH.is_file(), "Trained best.pt weights must exist"
    assert test_img_path.is_file(), "Test plate image must exist"

    res_fast = analyze_plate_image(
        image_source=test_img_path,
        organism="Escherichia coli",
        organism_group="Enterobacterales",
        standard="EUCAST",
        enable_ocr=False,
    )
    assert res_fast["disk_count"] == 12
    assert res_fast["scale_px_per_mm"] > 10.0
    assert len(res_fast["detections"]) == 12
    assert all("delta_r_mm" in d and "sobel_mm" in d for d in res_fast["detections"])

    # Spin up real HTTP server on ephemeral port to verify run_web_mvp.py end-to-end
    srv = ThreadedHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=5) as r:
            health = json.loads(r.read().decode("utf-8"))
        assert health["status"] == "ok" and health["model_exists"] is True

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/breakpoints_data.js", timeout=5) as r:
            assert b"ADLMS_BREAKPOINTS" in r.read(256)

        img_b64 = base64.b64encode(test_img_path.read_bytes()).decode("ascii")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/analyze",
            data=json.dumps({
                "image_base64": f"data:image/jpeg;base64,{img_b64}",
                "organism": "Klebsiella pneumoniae (BLEE)",
                "group": "Enterobacterales",
                "standard": "EUCAST",
                "enable_ocr": False,
            }).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            live = json.loads(r.read().decode("utf-8"))
        assert live["disk_count"] == 12
        assert live["standard"] == "EUCAST"
        assert live["inference_ms"] > 0
    finally:
        srv.shutdown()
        srv.server_close()


if __name__ == "__main__":
    for fn in (
        test_eucast_v16_1_xlsx_parsing_and_intrinsic_rules,
        test_web_mvp_generated_bundles_exist,
        test_end_to_end_yolo_sobel_and_http_api,
    ):
        fn()
        print(f"[PASS] {fn.__name__}")
    print("ALL END-TO-END VERIFICATION TESTS PASSED.")

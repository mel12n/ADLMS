"""Runner & Live Inference API Server for DeepHalo / Suite ADLMS Web MVP.

Serves the standalone Mobile PWA (``mvp_web/``) on ``http://localhost:8000`` and
exposes live endpoints powered by the trained YOLO11n-seg model, 36-ray radial Sobel
geometric cross-validation, EasyOCR + WHONET disk identification, and official
EUCAST v16.1 + CLSI M100 breakpoints:
  - ``GET  /api/health``  -> runtime diagnostics (YOLO weights, EUCAST table, EasyOCR)
  - ``POST /api/analyze`` -> live Kirby-Bauer inference on uploaded plate images
"""

from __future__ import annotations

import base64
import http.server
import json
import os
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.evaluation.eucast_breakpoints import (
    DEFAULT_WHONET_PATH,
    DEFAULT_XLSX_PATH,
    get_breakpoint_db,
)
from src.evaluation.measure_zones import (
    DEFAULT_MODEL_PATH,
    analyze_plate_image,
    load_whonet_codes,
)

PORT = int(os.environ.get("ADLMS_PORT", "8000"))
WEB_DIR = BASE_DIR / "mvp_web"


class InferenceEngine:
    """Thread-safe lazy singleton holding YOLO11n-seg, EasyOCR, WHONET, and EUCAST v16.1."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._reader = None
        self._whonet: Optional[Dict[str, Any]] = None
        self._db: Optional[Dict[str, Any]] = None

    def ensure_loaded(self, need_ocr: bool = True) -> None:
        with self._lock:
            if self._db is None:
                self._db = get_breakpoint_db(DEFAULT_XLSX_PATH, DEFAULT_WHONET_PATH)
            if self._model is None and DEFAULT_MODEL_PATH.is_file():
                from ultralytics import YOLO

                self._model = YOLO(str(DEFAULT_MODEL_PATH))
            if self._whonet is None:
                self._whonet = load_whonet_codes(DEFAULT_WHONET_PATH)
            if need_ocr and self._reader is None:
                import easyocr

                self._reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    def health(self) -> Dict[str, Any]:
        db = self._db or get_breakpoint_db(DEFAULT_XLSX_PATH, DEFAULT_WHONET_PATH)
        return {
            "status": "ok",
            "model_path": str(DEFAULT_MODEL_PATH.relative_to(BASE_DIR)),
            "model_exists": DEFAULT_MODEL_PATH.is_file(),
            "model_loaded": self._model is not None,
            "ocr_loaded": self._reader is not None,
            "eucast_version": db.get("version", "EUCAST v16.1"),
            "drug_count": len(db.get("drugs", {})),
            "edge_spec": "YOLO11n-seg + Sobel 36-ray + EUCAST v16.1 (Privacy-by-Design local)",
        }

    def analyze(
        self,
        img_bgr: np.ndarray,
        organism: str = "Escherichia coli",
        organism_group: str = "Enterobacterales",
        standard: str = "EUCAST",
        enable_ocr: bool = True,
        ocr_angles: int = 8,
    ) -> Dict[str, Any]:
        self.ensure_loaded(need_ocr=enable_ocr)
        if self._model is None:
            raise FileNotFoundError(f"Trained YOLO weights not found at {DEFAULT_MODEL_PATH}")
        with self._lock:
            return analyze_plate_image(
                image_source=img_bgr,
                model=self._model,
                reader=self._reader if enable_ocr else None,
                whonet_codes=self._whonet,
                whonet_path=DEFAULT_WHONET_PATH,
                xlsx_path=DEFAULT_XLSX_PATH,
                organism=organism,
                organism_group=organism_group,
                standard=standard,
                enable_ocr=enable_ocr,
                ocr_angles=ocr_angles,
            )


ENGINE = InferenceEngine()


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/health":
            self._send_json(ENGINE.health())
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/api/analyze":
            self._send_json({"error": "Not found"}, status=404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 25 * 1024 * 1024:
                self._send_json({"error": "Payload vacío o mayor a 25 MB"}, status=400)
                return

            body = self.rfile.read(length)
            payload = json.loads(body.decode("utf-8"))
            img_b64 = payload.get("image_base64") or ""
            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            if not img_b64:
                self._send_json({"error": "Falta image_base64 en la solicitud"}, status=400)
                return

            img_bytes = base64.b64decode(img_b64)
            np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
            img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                self._send_json({"error": "No se pudo decodificar la imagen enviada"}, status=400)
                return

            organism = payload.get("organism") or "Escherichia coli"
            group = payload.get("group") or ""
            standard = payload.get("standard") or "EUCAST"
            enable_ocr = bool(payload.get("enable_ocr", True))
            ocr_angles = int(payload.get("ocr_angles", 8))

            result = ENGINE.analyze(
                img_bgr=img_bgr,
                organism=organism,
                organism_group=group,
                standard=standard,
                enable_ocr=enable_ocr,
                ocr_angles=ocr_angles,
            )
            self._send_json(result, status=200)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status=500)


def run() -> None:
    os.chdir(str(WEB_DIR))
    url = f"http://localhost:{PORT}/index.html"

    # Warm up YOLO model + EUCAST v16.1 breakpoints in background so browser uploads respond fast
    threading.Thread(target=lambda: ENGINE.ensure_loaded(need_ocr=False), daemon=True).start()

    print("=" * 68)
    print("  DeepHalo / Suite ADLMS - Clinical Microbiology AST Web MVP + AI")
    print("=" * 68)
    print(f" Serving directory : {WEB_DIR}")
    print(f" Local URL         : {url}")
    print(f" YOLO11n-seg model : {DEFAULT_MODEL_PATH}")
    print(f" EUCAST v16.1 xlsx : {DEFAULT_XLSX_PATH.name}")
    print(" Live API          : GET /api/health · POST /api/analyze")
    print(" Press Ctrl+C to terminate the local server.")
    print("=" * 68)

    webbrowser.open(url)

    with ThreadedHTTPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down DeepHalo Web Server. Goodbye!")
            httpd.server_close()


if __name__ == "__main__":
    run()

#!/usr/bin/env python3
"""Wave 0 unit tests for Phase 10 TR6948 profiler and edge asset sync."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


class TestProfileTr6948(unittest.TestCase):
    def test_validate_serial_accepts_valid_and_rejects_injection(self) -> None:
        from scripts.profile_tr6948 import validate_serial

        self.assertEqual(validate_serial("R01236I38026001913"), "R01236I38026001913")
        self.assertEqual(validate_serial("192.168.1.50:5555"), "192.168.1.50:5555")
        self.assertEqual(validate_serial("emulator-5554"), "emulator-5554")

        for bad in ["", "   ", "abc def", "abc;rm -rf", "abc&calc", "abc|cat", "abc$HOME"]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    validate_serial(bad)

    def test_resolve_adb_binary_explicit_and_fallback(self) -> None:
        from scripts.profile_tr6948 import resolve_adb_binary

        with tempfile.TemporaryDirectory() as tmp:
            fake_adb = Path(tmp) / "adb.exe"
            fake_adb.write_text("stub", encoding="utf-8")
            self.assertEqual(resolve_adb_binary(str(fake_adb)), str(fake_adb))

        with mock.patch("shutil.which", return_value="/usr/bin/adb"):
            self.assertEqual(resolve_adb_binary(None), "/usr/bin/adb")

    def test_parse_meminfo_kb(self) -> None:
        from scripts.profile_tr6948 import parse_meminfo_kb

        sample = """
Applications Memory Usage (in Kilobytes):
Uptime: 123456 Realtime: 123456

** MEMINFO in pid 4321 [cl.unab.adlms.deephalo] **
                   Pss  Private  Private  SwapPss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------
  Native Heap    45120    45000       12        0    51200    48000     3200
        TOTAL   184320   120000    32000        0   102400    90000    12400

        TOTAL PSS:   184320            TOTAL RSS:   245760      TOTAL SWAP PSS:        0
"""
        pss_mb, rss_mb = parse_meminfo_kb(sample)
        self.assertEqual(pss_mb, round(184320 / 1024.0, 2))
        self.assertEqual(rss_mb, round(245760 / 1024.0, 2))

        self.assertEqual(parse_meminfo_kb("No process found for: cl.unab.adlms.deephalo"), (None, None))
        self.assertEqual(parse_meminfo_kb(""), (None, None))

    def test_parse_sandboxed_pids(self) -> None:
        from scripts.profile_tr6948 import parse_sandboxed_pids

        ps_out = """
PID   NAME
1234  cl.unab.adlms.deephalo
1288  com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0
1300  com.android.chrome:sandboxed_process1
1405  cl.unab.adlms.deephalo:webview_service
"""
        pids = parse_sandboxed_pids(ps_out, "cl.unab.adlms.deephalo")
        self.assertEqual(pids, [1288, 1405])

        self.assertEqual(parse_sandboxed_pids("PID NAME\n1234 cl.unab.adlms.deephalo\n", "cl.unab.adlms.deephalo"), [])

    def test_parse_logcat_line(self) -> None:
        from scripts.profile_tr6948 import parse_logcat_line

        bench_line = '11-25 10:00:01.123 I/ADLMS_BENCH( 4321): [ADLMS_BENCH] {"run": 1, "model": "yolo11n_seg_416_fp32", "simd": 1, "ort_ms": 1800.5, "total_ms": 2100.2}'
        kind, payload = parse_logcat_line(bench_line)
        self.assertEqual(kind, "bench_run")
        self.assertEqual(payload["run"], 1)
        self.assertEqual(payload["ort_ms"], 1800.5)

        done_line = '11-25 10:00:25.456 I/ADLMS_BENCH( 4321): [ADLMS_BENCH_DONE] {"model": "yolo11n_seg_416_fp32", "simd": 1, "runs": 10}'
        kind, payload = parse_logcat_line(done_line)
        self.assertEqual(kind, "bench_done")
        self.assertEqual(payload["runs"], 10)

        lmkd_line = "11-25 10:00:10.000 I/lowmemorykiller(  234): Killing 'cl.unab.adlms.deephalo' (4321), adj 0, to free 12345kB"
        kind, payload = parse_logcat_line(lmkd_line)
        self.assertEqual(kind, "lmkd")

        crash_line = "11-25 10:00:11.000 E/chromium( 4321): [ERROR:aw_browser_terminator.cc(155)] Renderer process (1288) crash detected (code -1)."
        kind, payload = parse_logcat_line(crash_line)
        self.assertEqual(kind, "render_crash")

        other_line = "11-25 10:00:12.000 D/ActivityManager(  500): Displayed cl.unab.adlms.deephalo/.MainActivity"
        kind, payload = parse_logcat_line(other_line)
        self.assertEqual(kind, "other")
        self.assertIsNone(payload)

    def test_summarize_cell_runs_cold_vs_warm(self) -> None:
        from scripts.profile_tr6948 import summarize_cell_runs

        records = [
            {"run": 1, "ort_ms": 4000.0, "total_ms": 4500.0},
            {"run": 2, "ort_ms": 2000.0, "total_ms": 2200.0},
            {"run": 3, "ort_ms": 2100.0, "total_ms": 2300.0},
            {"run": 4, "ort_ms": 1900.0, "total_ms": 2100.0},
        ]
        summary = summarize_cell_runs(
            records=records,
            pss_samples=[150.0, 185.5, 170.0],
            rss_samples=[210.0, 240.0],
            lmkd_events=[],
            crash_events=[],
        )
        self.assertEqual(summary["completed_runs"], 4)
        self.assertEqual(summary["cold_first_ms"], 4500.0)
        self.assertEqual(summary["warm_mean_ms"], 2200.0)
        self.assertEqual(summary["warm_ort_mean_ms"], 2000.0)
        self.assertEqual(summary["warm_p95_ms"], 2300.0)
        self.assertEqual(summary["peak_pss_mb"], 185.5)
        self.assertEqual(summary["peak_rss_mb"], 240.0)
        self.assertEqual(summary["lmkd_kills"], 0)
        self.assertEqual(summary["render_crashes"], 0)

    def test_select_locked_variant_enforces_mae_and_zero_lmkd(self) -> None:
        from scripts.profile_tr6948 import select_locked_variant

        parity_report = {
            "threshold_mae_mm": 0.50,
            "variants": [
                {"id": "yolo11n_seg_320_fp32", "mae_mm": 1.0351, "verdict": "NOT_SHIPPABLE"},
                {"id": "yolo11n_seg_416_fp32", "mae_mm": 0.4678, "verdict": "SHIPPABLE"},
            ],
        }
        cells = [
            {
                "variant_id": "yolo11n_seg_320_fp32",
                "simd": 1,
                "completed_runs": 10,
                "expected_runs": 10,
                "lmkd_kills": 0,
                "render_crashes": 0,
                "warm_ort_mean_ms": 900.0,
                "warm_mean_ms": 1000.0,
            },
            {
                "variant_id": "yolo11n_seg_416_fp32",
                "simd": 1,
                "completed_runs": 10,
                "expected_runs": 10,
                "lmkd_kills": 0,
                "render_crashes": 0,
                "warm_ort_mean_ms": 2150.0,
                "warm_mean_ms": 2350.0,
            },
            {
                "variant_id": "yolo11n_seg_416_fp32",
                "simd": 0,
                "completed_runs": 10,
                "expected_runs": 10,
                "lmkd_kills": 0,
                "render_crashes": 0,
                "warm_ort_mean_ms": 2600.0,
                "warm_mean_ms": 2800.0,
            },
        ]
        lock = select_locked_variant(cells, parity_report, threshold_trt_ms=2000.0, threshold_mae_mm=0.50)
        self.assertEqual(lock["locked_variant"], "yolo11n_seg_416_fp32")
        self.assertEqual(lock["simd"], 1)
        self.assertFalse(lock["within_trt_2s"])
        self.assertIn("32-bit", lock["hardware_delta_note"])

    def test_write_reports(self) -> None:
        from scripts.profile_tr6948 import write_reports

        report = {
            "device": {"serial": "R01236I38026001913", "package": "cl.unab.adlms.deephalo"},
            "lock_decision": {
                "locked_variant": "yolo11n_seg_416_fp32",
                "simd": 1,
                "mae_mm": 0.4678,
                "within_trt_2s": False,
                "hardware_delta_note": "TR6948 32-bit 968 MB exceeds 2000 ms TRT.",
            },
            "cells": [
                {
                    "variant_id": "yolo11n_seg_416_fp32",
                    "simd": 1,
                    "mae_mm": 0.4678,
                    "verdict": "SHIPPABLE",
                    "completed_runs": 10,
                    "expected_runs": 10,
                    "cold_first_ms": 4200.0,
                    "warm_mean_ms": 2350.0,
                    "warm_ort_mean_ms": 2150.0,
                    "warm_p95_ms": 2500.0,
                    "peak_pss_mb": 190.5,
                    "peak_rss_mb": 245.0,
                    "lmkd_kills": 0,
                    "render_crashes": 0,
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            json_path = Path(tmp) / "report.json"
            md_path = Path(tmp) / "report.md"
            write_reports(report, json_path, md_path)
            self.assertTrue(json_path.is_file())
            self.assertTrue(md_path.is_file())
            loaded = json.loads(json_path.read_text(encoding="utf-8"))
            self.assertEqual(loaded["lock_decision"]["locked_variant"], "yolo11n_seg_416_fp32")
            md_text = md_path.read_text(encoding="utf-8")
            self.assertIn("yolo11n_seg_416_fp32", md_text)
            self.assertIn("32-bit", md_text)


if __name__ == "__main__":
    unittest.main()

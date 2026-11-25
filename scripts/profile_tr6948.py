#!/usr/bin/env python3
"""Host-side ADB memory/lmkd profiler and 8-cell benchmark orchestrator for TR6948.

Usage:
    python scripts/profile_tr6948.py [--serial R01236I38026001913] [--runs 10] [--dry-run] [--apply-lock]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPORTS_DIR = REPO_ROOT / "exports"
MVP_WEB_MODELS_DIR = REPO_ROOT / "mvp_web" / "models"
MODEL_META_PATH = EXPORTS_DIR / "model_meta.json"
WEB_MODEL_META_PATH = MVP_WEB_MODELS_DIR / "model_meta.json"
PARITY_REPORT_PATH = EXPORTS_DIR / "onnx_parity_report.json"
BENCHMARK_JSON_PATH = EXPORTS_DIR / "tr6948_benchmark_report.json"
BENCHMARK_MD_PATH = EXPORTS_DIR / "tr6948_benchmark_report.md"

DEFAULT_SERIAL = "R01236I38026001913"
DEFAULT_PACKAGE = "cl.unab.adlms.deephalo"
DEFAULT_ACTIVITY = ".MainActivity"
SERIAL_RE = re.compile(r"^[A-Za-z0-9._:-]+$")
MEMINFO_PSS_RE = re.compile(r"TOTAL PSS:\s+(\d+)")
MEMINFO_RSS_RE = re.compile(r"TOTAL RSS:\s+(\d+)")
BENCH_TAG_RE = re.compile(r"\[ADLMS_BENCH\]\s*(\{.*\})")
BENCH_DONE_TAG_RE = re.compile(r"\[ADLMS_BENCH_DONE\]\s*(\{.*\})")


def validate_serial(serial: str) -> str:
    """Validate ADB device serial against strict allow-list regex (T-10-04)."""
    if not serial or not SERIAL_RE.fullmatch(serial):
        raise ValueError(f"Invalid ADB serial {serial!r}; must match {SERIAL_RE.pattern}")
    return serial


def resolve_adb_binary(explicit_path: str | None = None) -> str:
    """Resolve adb executable path from explicit arg, PATH, or Windows Android SDK."""
    if explicit_path:
        p = Path(explicit_path)
        if p.is_file():
            return str(p)
        raise FileNotFoundError(f"Explicit adb binary not found: {explicit_path}")

    which_adb = shutil.which("adb")
    if which_adb:
        return which_adb

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        sdk_adb = Path(local_app_data) / "Android" / "Sdk" / "platform-tools" / "adb.exe"
        if sdk_adb.is_file():
            return str(sdk_adb)

    raise FileNotFoundError(
        "adb binary not found on PATH or at %LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe. "
        "Pass --adb-path explicitly."
    )


def parse_meminfo_kb(text: str) -> tuple[float | None, float | None]:
    """Extract (TOTAL PSS MB, TOTAL RSS MB) from `adb shell dumpsys meminfo` output."""
    if not text:
        return None, None
    pss_match = MEMINFO_PSS_RE.search(text)
    rss_match = MEMINFO_RSS_RE.search(text)
    pss_mb = round(int(pss_match.group(1)) / 1024.0, 2) if pss_match else None
    rss_mb = round(int(rss_match.group(1)) / 1024.0, 2) if rss_match else None
    return pss_mb, rss_mb


def parse_sandboxed_pids(ps_output: str, package_name: str) -> list[int]:
    """Extract integer PIDs for WebView sandboxed_process / webview_service lines."""
    pids: list[int] = []
    for line in ps_output.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("PID"):
            continue
        parts = stripped.split(None, 1)
        if len(parts) < 2 or not parts[0].isdigit():
            continue
        pid = int(parts[0])
        name = parts[1]
        if "sandboxed_process" in name and (package_name in name or "webview" in name):
            pids.append(pid)
        elif f"{package_name}:webview_service" in name:
            pids.append(pid)
    return pids


def parse_logcat_line(line: str) -> tuple[str, dict[str, Any] | None]:
    """Classify a logcat line into bench_run, bench_done, lmkd, render_crash, or other."""
    done_match = BENCH_DONE_TAG_RE.search(line)
    if done_match:
        try:
            return "bench_done", json.loads(done_match.group(1))
        except json.JSONDecodeError:
            return "bench_done", {"raw": line}

    bench_match = BENCH_TAG_RE.search(line)
    if bench_match:
        try:
            return "bench_run", json.loads(bench_match.group(1))
        except json.JSONDecodeError:
            return "bench_run", {"raw": line}

    lower = line.lower()
    if ("lowmemorykiller" in lower or "lmkd" in lower) and (
        "killing" in lower or "sandboxed_process" in lower or "adlms" in lower
    ):
        return "lmkd", {"raw": line.strip()}

    if "render_process_gone" in lower or "aw_browser_terminator" in lower or "renderer process" in lower:
        return "render_crash", {"raw": line.strip()}

    return "other", None


def _percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, math.ceil((pct / 100.0) * len(ordered)) - 1))
    return round(ordered[idx], 2)


def summarize_cell_runs(
    records: list[dict[str, Any]],
    pss_samples: list[float],
    rss_samples: list[float],
    lmkd_events: list[dict[str, Any]],
    crash_events: list[dict[str, Any]],
) -> dict[str, Any]:
    """Separate cold Plate 1 latency from warm Plates 2..N and compute memory/kill metrics."""
    ordered = sorted(records, key=lambda r: int(r.get("run", 0)))
    cold_first_ms = round(float(ordered[0].get("total_ms", 0.0)), 2) if ordered else None
    warm = ordered[1:] if len(ordered) > 1 else []
    warm_totals = [float(r["total_ms"]) for r in warm if "total_ms" in r]
    warm_orts = [float(r["ort_ms"]) for r in warm if "ort_ms" in r]

    return {
        "completed_runs": len(ordered),
        "cold_first_ms": cold_first_ms,
        "warm_mean_ms": round(sum(warm_totals) / len(warm_totals), 2) if warm_totals else None,
        "warm_p95_ms": _percentile(warm_totals, 95.0),
        "warm_ort_mean_ms": round(sum(warm_orts) / len(warm_orts), 2) if warm_orts else None,
        "peak_pss_mb": round(max(pss_samples), 2) if pss_samples else None,
        "peak_rss_mb": round(max(rss_samples), 2) if rss_samples else None,
        "lmkd_kills": len(lmkd_events),
        "render_crashes": len(crash_events),
    }


def select_locked_variant(
    cells: list[dict[str, Any]],
    parity_report: dict[str, Any],
    threshold_trt_ms: float = 2000.0,
    threshold_mae_mm: float = 0.50,
) -> dict[str, Any]:
    """Select fastest clinical-compliant (MAE <= 0.50 mm) zero-lmkd variant."""
    parity_by_id = {v["id"]: v for v in parity_report.get("variants", [])}
    eligible: list[dict[str, Any]] = []

    for cell in cells:
        vid = cell["variant_id"]
        parity = parity_by_id.get(vid, {})
        mae_mm = parity.get("mae_mm")
        verdict = parity.get("verdict")
        if mae_mm is None or mae_mm > threshold_mae_mm or verdict != "SHIPPABLE":
            continue
        if cell.get("lmkd_kills", 0) != 0 or cell.get("render_crashes", 0) != 0:
            continue
        if cell.get("completed_runs", 0) != cell.get("expected_runs", 0):
            continue
        if cell.get("warm_ort_mean_ms") is None:
            continue
        eligible.append({**cell, "mae_mm": mae_mm, "verdict": verdict})

    if not eligible:
        return {
            "locked_variant": None,
            "simd": None,
            "mae_mm": None,
            "within_trt_2s": False,
            "hardware_delta_note": "No clinical-compliant (MAE <= 0.50 mm) zero-lmkd cell completed all runs.",
        }

    best = min(
        eligible,
        key=lambda c: (float(c["warm_ort_mean_ms"]), float(c.get("warm_mean_ms") or float("inf"))),
    )
    warm_ort = float(best["warm_ort_mean_ms"])
    within_2s = warm_ort <= threshold_trt_ms
    delta_note = (
        f"TR6948 32-bit armeabi-v7a (968 MB RAM) warm ORT inference is {warm_ort:.2f} ms "
        f"vs ADR-001 64-bit <= {threshold_trt_ms:.0f} ms TRT target."
        if not within_2s
        else f"TR6948 warm ORT inference ({warm_ort:.2f} ms) meets <= {threshold_trt_ms:.0f} ms TRT."
    )

    return {
        "locked_variant": best["variant_id"],
        "simd": best["simd"],
        "mae_mm": best["mae_mm"],
        "warm_ort_mean_ms": best["warm_ort_mean_ms"],
        "warm_mean_ms": best.get("warm_mean_ms"),
        "peak_pss_mb": best.get("peak_pss_mb"),
        "within_trt_2s": within_2s,
        "hardware_delta_note": delta_note,
    }


def write_reports(report: dict[str, Any], json_path: Path, md_path: Path) -> None:
    """Write formatted JSON and Markdown benchmark reports."""
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    lock = report.get("lock_decision", {})
    device = report.get("device", {})
    lines = [
        "# TR6948 On-Device Benchmark Report",
        "",
        f"- **Device Serial:** `{device.get('serial', 'unknown')}`",
        f"- **Package:** `{device.get('package', DEFAULT_PACKAGE)}`",
        f"- **Locked Variant:** `{lock.get('locked_variant')}` (simd={lock.get('simd')}, MAE={lock.get('mae_mm')} mm)",
        f"- **Within 2.0s TRT:** `{lock.get('within_trt_2s')}`",
        f"- **Hardware Delta Note:** {lock.get('hardware_delta_note', '')}",
        "",
        "| Variant | SIMD | MAE (mm) | Verdict | Runs | Cold 1st (ms) | Warm Mean (ms) | Warm ORT (ms) | Warm P95 (ms) | Peak PSS (MB) | Peak RSS (MB) | lmkd | Crashes |",
        "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for c in report.get("cells", []):
        lines.append(
            f"| `{c.get('variant_id')}` | {c.get('simd')} | {c.get('mae_mm')} | {c.get('verdict')} | "
            f"{c.get('completed_runs')}/{c.get('expected_runs')} | {c.get('cold_first_ms')} | "
            f"{c.get('warm_mean_ms')} | {c.get('warm_ort_mean_ms')} | {c.get('warm_p95_ms')} | "
            f"{c.get('peak_pss_mb')} | {c.get('peak_rss_mb')} | {c.get('lmkd_kills')} | {c.get('render_crashes')} |"
        )
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _run_adb(adb_bin: str, serial: str, args: list[str], timeout: float = 30.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [adb_bin, "-s", serial, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        shell=False,
        check=False,
    )


def _preflight_device(adb_bin: str, serial: str) -> dict[str, Any]:
    state = _run_adb(adb_bin, serial, ["get-state"])
    if state.returncode != 0 or state.stdout.strip() != "device":
        raise RuntimeError(
            f"ADB device {serial!r} not ready (rc={state.returncode}, stdout={state.stdout.strip()!r}, "
            f"stderr={state.stderr.strip()!r}). Unlock screen and accept USB debugging prompt."
        )
    airplane = _run_adb(adb_bin, serial, ["shell", "settings", "get", "global", "airplane_mode_on"])
    webview = _run_adb(adb_bin, serial, ["shell", "dumpsys", "webviewupdate"])
    multiprocess = "Multiprocess enabled: true" in webview.stdout
    return {
        "serial": serial,
        "airplane_mode_on": airplane.stdout.strip(),
        "webview_multiprocess": multiprocess,
    }


def _run_cell(
    adb_bin: str,
    serial: str,
    package: str,
    activity: str,
    variant_id: str,
    simd: int,
    runs: int,
    timeout_s: float,
    poll_interval_s: float,
) -> dict[str, Any]:
    _run_adb(adb_bin, serial, ["shell", "am", "force-stop", package])
    _run_adb(adb_bin, serial, ["logcat", "-c"])

    records: list[dict[str, Any]] = []
    lmkd_events: list[dict[str, Any]] = []
    crash_events: list[dict[str, Any]] = []
    pss_samples: list[float] = []
    rss_samples: list[float] = []
    done_event = threading.Event()

    logcat_proc = subprocess.Popen(
        [
            adb_bin,
            "-s",
            serial,
            "logcat",
            "-v",
            "time",
            "ADLMS_BENCH:I",
            "chromium:I",
            "lmkd:I",
            "lowmemorykiller:I",
            "ActivityManager:I",
            "*:S",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=False,
    )

    def _tail_logcat() -> None:
        assert logcat_proc.stdout is not None
        for line in logcat_proc.stdout:
            kind, payload = parse_logcat_line(line)
            if kind == "bench_run" and payload:
                records.append(payload)
            elif kind == "bench_done":
                done_event.set()
            elif kind == "lmkd" and payload:
                lmkd_events.append(payload)
            elif kind == "render_crash" and payload:
                crash_events.append(payload)

    tail_thread = threading.Thread(target=_tail_logcat, daemon=True)
    tail_thread.start()

    try:
        bench_query = f"bench={runs}&model={variant_id}&simd={simd}"
        _run_adb(
            adb_bin,
            serial,
            ["shell", "am", "start", "-n", f"{package}/{activity}", "--es", "bench_query", bench_query],
        )

        deadline = time.monotonic() + timeout_s
        while not done_event.is_set() and time.monotonic() < deadline:
            mem = _run_adb(adb_bin, serial, ["shell", "dumpsys", "meminfo", package], timeout=10.0)
            pss_mb, rss_mb = parse_meminfo_kb(mem.stdout)
            if pss_mb is not None:
                pss_samples.append(pss_mb)
            if rss_mb is not None:
                rss_samples.append(rss_mb)
            if lmkd_events or crash_events:
                break
            time.sleep(poll_interval_s)
    finally:
        logcat_proc.terminate()
        try:
            logcat_proc.wait(timeout=3.0)
        except subprocess.TimeoutExpired:
            logcat_proc.kill()
        _run_adb(adb_bin, serial, ["shell", "am", "force-stop", package])

    summary = summarize_cell_runs(records, pss_samples, rss_samples, lmkd_events, crash_events)
    summary["variant_id"] = variant_id
    summary["simd"] = simd
    summary["expected_runs"] = runs
    return summary


def apply_lock_to_meta(locked_variant: str) -> None:
    """Persist locked_variant into exports/model_meta.json and mvp_web/models/model_meta.json."""
    for meta_path in (MODEL_META_PATH, WEB_MODEL_META_PATH):
        if meta_path.is_file():
            data = json.loads(meta_path.read_text(encoding="utf-8"))
            data["locked_variant"] = locked_variant
            meta_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TR6948 ADB 8-cell benchmark & memory/lmkd profiler.")
    parser.add_argument("--serial", default=DEFAULT_SERIAL)
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--package", default=DEFAULT_PACKAGE)
    parser.add_argument("--activity", default=DEFAULT_ACTIVITY)
    parser.add_argument("--adb-path", default=None)
    parser.add_argument("--timeout-s", type=float, default=180.0)
    parser.add_argument("--poll-interval-s", type=float, default=0.5)
    parser.add_argument("--apply-lock", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    serial = validate_serial(args.serial)

    model_meta = json.loads(MODEL_META_PATH.read_text(encoding="utf-8"))
    parity_report = json.loads(PARITY_REPORT_PATH.read_text(encoding="utf-8"))
    variant_ids = [v["id"] for v in model_meta.get("variants", [])]
    matrix = [(vid, simd) for vid in variant_ids for simd in (1, 0)]

    if args.dry_run:
        print(f"[DRY-RUN] Serial={serial} Package={args.package} Runs={args.runs} Matrix={len(matrix)} cells")
        for idx, (vid, simd) in enumerate(matrix, start=1):
            print(f"  {idx}. model={vid} simd={simd}")
        return 0

    adb_bin = resolve_adb_binary(args.adb_path)
    device_info = _preflight_device(adb_bin, serial)
    device_info["package"] = args.package

    parity_by_id = {v["id"]: v for v in parity_report.get("variants", [])}
    cells: list[dict[str, Any]] = []
    for vid, simd in matrix:
        cell = _run_cell(
            adb_bin=adb_bin,
            serial=serial,
            package=args.package,
            activity=args.activity,
            variant_id=vid,
            simd=simd,
            runs=args.runs,
            timeout_s=args.timeout_s,
            poll_interval_s=args.poll_interval_s,
        )
        parity = parity_by_id.get(vid, {})
        cell["mae_mm"] = parity.get("mae_mm")
        cell["verdict"] = parity.get("verdict")
        cells.append(cell)

    lock_decision = select_locked_variant(cells, parity_report)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "device": device_info,
        "lock_decision": lock_decision,
        "cells": cells,
    }
    write_reports(report, BENCHMARK_JSON_PATH, BENCHMARK_MD_PATH)

    if args.apply_lock and lock_decision.get("locked_variant"):
        apply_lock_to_meta(lock_decision["locked_variant"])

    return 0


if __name__ == "__main__":
    sys.exit(main())

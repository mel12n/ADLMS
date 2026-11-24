#!/usr/bin/env python3
"""Sync mvp_web/ and ONNX edge models into Android APK assets.

Usage:
    python scripts/sync_edge_assets.py [--all-models] [--dry-run]
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_WEB_DIR = REPO_ROOT / "mvp_web"
SRC_EXPORTS_DIR = REPO_ROOT / "exports"
DST_ASSETS_DIR = REPO_ROOT / "android" / "app" / "src" / "main" / "assets" / "mvp_web"

DEFAULT_MODEL = "yolo11n_seg_416_fp32.onnx"
MODEL_META = "model_meta.json"


def collect_sync_plan(all_models: bool = False) -> list[tuple[Path, Path]]:
    """Build deterministic list of (source_file, destination_file) pairs."""
    if not SRC_WEB_DIR.is_dir():
        raise FileNotFoundError(f"Source directory not found: {SRC_WEB_DIR}")

    plan: list[tuple[Path, Path]] = []
    seen_models: set[str] = set()

    for src_path in sorted(SRC_WEB_DIR.rglob("*")):
        if not src_path.is_file():
            continue
        rel = src_path.relative_to(SRC_WEB_DIR)

        # Exclude desktop-only root preview images (*.jpg directly in mvp_web/)
        if len(rel.parts) == 1 and src_path.suffix.lower() == ".jpg":
            continue

        # Filter models/ directory
        if rel.parts[0] == "models":
            if src_path.suffix.lower() == ".onnx":
                if not all_models and src_path.name != DEFAULT_MODEL:
                    continue
                seen_models.add(src_path.name)
            elif src_path.name != MODEL_META:
                continue

        plan.append((src_path, DST_ASSETS_DIR / rel))

    # When --all-models is requested, also include any ONNX variants from exports/
    if all_models and SRC_EXPORTS_DIR.is_dir():
        for onnx_path in sorted(SRC_EXPORTS_DIR.glob("*.onnx")):
            if onnx_path.name not in seen_models:
                seen_models.add(onnx_path.name)
                plan.append((onnx_path, DST_ASSETS_DIR / "models" / onnx_path.name))

    return plan


def execute_sync(plan: list[tuple[Path, Path]], dry_run: bool = False) -> int:
    """Copy planned files to destination (cleaning stale files first)."""
    total_bytes = sum(src.stat().st_size for src, _ in plan)
    mode = "DRY-RUN" if dry_run else "SYNC"
    print(f"[{mode}] Destination: {DST_ASSETS_DIR}")

    if not dry_run:
        if DST_ASSETS_DIR.exists():
            shutil.rmtree(DST_ASSETS_DIR)
        DST_ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    for src, dst in plan:
        size_kb = src.stat().st_size / 1024.0
        rel_dst = dst.relative_to(DST_ASSETS_DIR)
        print(f"  {rel_dst.as_posix():<48} {size_kb:9.1f} KB")
        if not dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    total_mb = total_bytes / (1024.0 * 1024.0)
    print(f"[{mode}] {len(plan)} files, {total_mb:.2f} MB total.")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync mvp_web/ and ONNX models into android/app/src/main/assets/mvp_web/."
    )
    parser.add_argument(
        "--all-models",
        action="store_true",
        help="Bundle all 4 Phase 6 ONNX variants from mvp_web/models/ and exports/.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned file copies and total size without writing to disk.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    plan = collect_sync_plan(all_models=args.all_models)
    return execute_sync(plan, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())

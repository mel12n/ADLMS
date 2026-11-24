"""Convert LabelMe JSON annotations (polygon and circle shapes) to YOLO-seg format."""

import argparse
import json
import math
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

CANONICAL_CLASSES: Dict[str, int] = {
    "antibiotic_disk": 0,
    "inhibition_zone": 1,
    "inner_colony": 2,
}


def normalize_label(raw_label: str, collapse_disks: bool = True) -> str:
    """Normalize a raw LabelMe shape label to canonical class names."""
    cleaned = raw_label.strip().lower().replace(" ", "_")
    if collapse_disks and cleaned not in {"inhibition_zone", "inner_colony"}:
        return "antibiotic_disk"
    return cleaned


def circle_to_polygon(points: List[List[float]], num_vertices: int = 32) -> List[Tuple[float, float]]:
    """Convert a LabelMe 2-point circle [center, edge] into an N-vertex polygon."""
    if len(points) < 2:
        raise ValueError(f"Circle shape requires 2 points, got {len(points)}")
    cx, cy = points[0]
    px, py = points[1]
    radius = math.hypot(px - cx, py - cy)
    return [
        (
            cx + radius * math.cos(2.0 * math.pi * i / num_vertices),
            cy + radius * math.sin(2.0 * math.pi * i / num_vertices),
        )
        for i in range(num_vertices)
    ]


def normalize_points(
    points: List[Tuple[float, float]], width: int, height: int
) -> List[float]:
    """Normalize (x, y) pixel coordinates to [0.0, 1.0] and flatten."""
    coords: List[float] = []
    for x, y in points:
        nx = max(0.0, min(1.0, x / width))
        ny = max(0.0, min(1.0, y / height))
        coords.extend((nx, ny))
    return coords


def _find_matching_image(json_path: Path, data: dict) -> Optional[Path]:
    """Locate the image matching a LabelMe JSON file."""
    image_path_raw = data.get("imagePath")
    if image_path_raw:
        candidate = json_path.parent / Path(image_path_raw).name
        if candidate.is_file():
            return candidate
    for ext in (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"):
        candidate = json_path.with_suffix(ext)
        if candidate.is_file():
            return candidate
    return None


def convert_file(
    json_path: Path,
    output_dir: Path,
    class_to_id: Dict[str, int],
    circle_vertices: int = 32,
    collapse_disks: bool = True,
) -> int:
    """Convert a single LabelMe JSON file to a YOLO-seg .txt file. Returns shape count."""
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    width = data["imageWidth"]
    height = data["imageHeight"]
    lines: List[str] = []

    for shape in data.get("shapes", []):
        label = normalize_label(shape["label"], collapse_disks=collapse_disks)
        if label not in class_to_id:
            class_to_id[label] = len(class_to_id)
        class_id = class_to_id[label]

        shape_type = shape.get("shape_type", "polygon")
        raw_points = shape.get("points", [])

        if shape_type == "circle":
            pts = circle_to_polygon(raw_points, num_vertices=circle_vertices)
        elif shape_type == "polygon":
            if len(raw_points) < 3:
                continue
            pts = [(p[0], p[1]) for p in raw_points]
        else:
            continue

        norm = normalize_points(pts, width, height)
        coord_str = " ".join(f"{v:.6f}" for v in norm)
        lines.append(f"{class_id} {coord_str}")

    output_dir.mkdir(parents=True, exist_ok=True)
    out_txt = output_dir / f"{json_path.stem}.txt"
    out_txt.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    if output_dir.resolve() != json_path.parent.resolve():
        src_img = _find_matching_image(json_path, data)
        if src_img is not None:
            dst_img = output_dir / src_img.name
            if not dst_img.exists():
                shutil.copy2(src_img, dst_img)

    return len(lines)


def convert_directory(
    input_dir: Path,
    output_dir: Path,
    circle_vertices: int = 32,
    yaml_path: Optional[Path] = None,
    collapse_disks: bool = True,
) -> Dict[str, int]:
    """Convert all LabelMe .json files in input_dir to YOLO-seg .txt files."""
    class_to_id: Dict[str, int] = dict(CANONICAL_CLASSES) if collapse_disks else {}
    json_files = sorted(input_dir.glob("*.json"))
    total_shapes = 0

    for json_path in json_files:
        total_shapes += convert_file(
            json_path,
            output_dir,
            class_to_id,
            circle_vertices=circle_vertices,
            collapse_disks=collapse_disks,
        )

    if yaml_path is not None:
        names = {idx: name for name, idx in class_to_id.items()}
        yaml_data = {
            "path": str(output_dir.resolve()),
            "names": names,
        }
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        with yaml_path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(yaml_data, f, sort_keys=False)

    print(f"Converted {len(json_files)} files ({total_shapes} shapes) -> {output_dir}")
    print(f"Classes ({len(class_to_id)}): {class_to_id}")
    return class_to_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert LabelMe JSONs to YOLO-seg format.")
    parser.add_argument("input_dir", type=Path, help="Directory containing LabelMe .json files.")
    parser.add_argument("output_dir", type=Path, help="Directory to write YOLO .txt label files.")
    parser.add_argument("--circle-vertices", type=int, default=32, help="Vertices per circle.")
    parser.add_argument("--yaml", type=Path, default=None, help="Optional output data.yaml path.")
    parser.add_argument(
        "--no-collapse-disks",
        action="store_true",
        help="Keep raw drug-code labels as separate classes instead of collapsing to antibiotic_disk.",
    )
    args = parser.parse_args()

    convert_directory(
        args.input_dir,
        args.output_dir,
        circle_vertices=args.circle_vertices,
        yaml_path=args.yaml,
        collapse_disks=not args.no_collapse_disks,
    )


if __name__ == "__main__":
    main()

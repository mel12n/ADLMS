import argparse
import random
from pathlib import Path


def has_class(label_path: Path, class_id: int = 2) -> bool:
    """Return True if the YOLO-seg label file contains at least one instance of class_id."""
    if not label_path.is_file():
        return False
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if parts and int(parts[0]) == class_id:
            return True
    return False


def split_dataset(
    source_dir: Path,
    out_dir: Path,
    val_count: int = 4,
    seed: int = 42,
) -> tuple[list[Path], list[Path]]:
    """Deterministically split source_dir plates into stratified train/val manifests."""
    jpg_files = sorted(source_dir.glob("*.jpg"))
    if not jpg_files:
        raise FileNotFoundError(f"No .jpg files found in {source_dir}")

    inner_colony_plates: list[Path] = []
    standard_plates: list[Path] = []

    for jpg in jpg_files:
        label_path = jpg.with_suffix(".txt")
        if not label_path.is_file():
            raise FileNotFoundError(f"Missing label file for {jpg}: {label_path}")
        if has_class(label_path, class_id=2):
            inner_colony_plates.append(jpg)
        else:
            standard_plates.append(jpg)

    rng = random.Random(seed)
    rng.shuffle(inner_colony_plates)
    rng.shuffle(standard_plates)

    # Stratified selection: proportional inner_colony count (at least 1 if available)
    n_inner_val = max(1, round(len(inner_colony_plates) * val_count / len(jpg_files))) if inner_colony_plates else 0
    n_inner_val = min(n_inner_val, len(inner_colony_plates), val_count)
    n_std_val = val_count - n_inner_val

    val_plates = sorted(inner_colony_plates[:n_inner_val] + standard_plates[:n_std_val], key=lambda p: p.name)
    train_plates = sorted(inner_colony_plates[n_inner_val:] + standard_plates[n_std_val:], key=lambda p: p.name)

    out_dir.mkdir(parents=True, exist_ok=True)
    source_folder_name = source_dir.name

    train_manifest = out_dir / "train.txt"
    val_manifest = out_dir / "val.txt"

    train_manifest.write_text(
        "\n".join(f"./{source_folder_name}/{p.name}" for p in train_plates) + "\n",
        encoding="utf-8",
    )
    val_manifest.write_text(
        "\n".join(f"./{source_folder_name}/{p.name}" for p in val_plates) + "\n",
        encoding="utf-8",
    )

    train_inner = sum(1 for p in train_plates if has_class(p.with_suffix(".txt"), 2))
    val_inner = sum(1 for p in val_plates if has_class(p.with_suffix(".txt"), 2))

    print(
        f"Split complete (seed={seed}): "
        f"train={len(train_plates)} plates ({train_inner} inner_colony), "
        f"val={len(val_plates)} plates ({val_inner} inner_colony)"
    )
    print(f"Manifests written to {train_manifest} and {val_manifest}")
    return train_plates, val_plates


def main() -> None:
    parser = argparse.ArgumentParser(description="Deterministic stratified train/val manifest generator")
    parser.add_argument("--source", type=Path, default=Path("data/Antibiogram_demo/Train_yolo"))
    parser.add_argument("--out-dir", type=Path, default=Path("data/Antibiogram_demo"))
    parser.add_argument("--val-count", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    split_dataset(
        source_dir=args.source,
        out_dir=args.out_dir,
        val_count=args.val_count,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()

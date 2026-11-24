import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parent.parent
DATASET_YAML = ROOT / "configs" / "dataset.yaml"
DATA_DIR = ROOT / "data" / "Antibiogram_demo"


def _read_manifest_stems(manifest_path: Path) -> list[str]:
    lines = [line.strip() for line in manifest_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    stems = []
    for rel in lines:
        img_path = (DATA_DIR / rel).resolve()
        if not img_path.is_file():
            raise AssertionError(f"Manifest image does not exist: {img_path}")
        stems.append(img_path.stem)
    return stems


def _has_class_2(label_path: Path) -> bool:
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if parts and int(parts[0]) == 2:
            return True
    return False


class TestPhase6Split(unittest.TestCase):
    def test_dataset_yaml_schema(self) -> None:
        cfg = yaml.safe_load(DATASET_YAML.read_text(encoding="utf-8"))
        self.assertEqual(cfg["path"], "data/Antibiogram_demo")
        self.assertEqual(cfg["train"], "train.txt")
        self.assertEqual(cfg["val"], "val.txt")
        self.assertEqual(cfg["test"], "Test_yolo")
        self.assertEqual(
            cfg["names"],
            {0: "antibiotic_disk", 1: "inhibition_zone", 2: "inner_colony"},
        )

    def test_split_counts_and_disjointness(self) -> None:
        train_stems = _read_manifest_stems(DATA_DIR / "train.txt")
        val_stems = _read_manifest_stems(DATA_DIR / "val.txt")

        test_dir = DATA_DIR / "Test_yolo"
        test_jpgs = sorted(test_dir.glob("*.jpg"))
        test_txts = sorted(test_dir.glob("*.txt"))
        test_stems = [p.stem for p in test_jpgs]

        self.assertEqual(len(train_stems), 16)
        self.assertEqual(len(val_stems), 4)
        self.assertEqual(len(test_jpgs), 2)
        self.assertEqual(len(test_txts), 2)

        train_set = set(train_stems)
        val_set = set(val_stems)
        test_set = set(test_stems)

        self.assertEqual(len(train_set & val_set), 0, "train and val overlap")
        self.assertEqual(len(train_set & test_set), 0, "train and test overlap")
        self.assertEqual(len(val_set & test_set), 0, "val and test overlap")

    def test_inner_colony_stratification(self) -> None:
        train_lines = [
            line.strip()
            for line in (DATA_DIR / "train.txt").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        val_lines = [
            line.strip()
            for line in (DATA_DIR / "val.txt").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

        train_inner = sum(
            1 for rel in train_lines if _has_class_2((DATA_DIR / rel).with_suffix(".txt"))
        )
        val_inner = sum(
            1 for rel in val_lines if _has_class_2((DATA_DIR / rel).with_suffix(".txt"))
        )

        self.assertGreaterEqual(train_inner, 1)
        self.assertEqual(train_inner, 3)
        self.assertGreaterEqual(val_inner, 1)
        self.assertEqual(val_inner, 1)


if __name__ == "__main__":
    unittest.main()

from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SPLITS_DIR = DATA_DIR / "splits"

TRAIN_IMG_DIR = SPLITS_DIR / "train" / "images"
TRAIN_LBL_DIR = SPLITS_DIR / "train" / "labels"
VAL_IMG_DIR = SPLITS_DIR / "val" / "images"
VAL_LBL_DIR = SPLITS_DIR / "val" / "labels"
TEST_IMG_DIR = SPLITS_DIR / "test" / "images"
TEST_LBL_DIR = SPLITS_DIR / "test" / "labels"

CONFIGS_DIR = BASE_DIR / "configs"
MODELS_DIR = BASE_DIR / "models"
CHECKPOINTS_DIR = MODELS_DIR / "checkpoints"
EXPORTS_DIR = MODELS_DIR / "exports"
RESULTS_DIR = BASE_DIR / "results"

# Image processing constants
IMAGE_SIZE = (640, 640)

# Class definitions
CLASS_NAMES = {
    0: "colony",
    1: "inhibition_zone",
    2: "antibiotic_disk",
    3: "empty_plate"
}

# URLs & Datasets
AGAR_ZENODO_RECORD_URL = "https://zenodo.org/records/21237433"
AGAR_DEMO_URL = "https://zenodo.org/records/21237433/files/AGAR_demo.zip"
# OpenDataLab / AGAR official dataset mirror links
AGAR_FULL_DESCR = "AGAR (Annotated Germs for Automated Recognition) Dataset"

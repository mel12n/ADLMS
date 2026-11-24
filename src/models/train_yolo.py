import argparse
import sys
from pathlib import Path

import torch
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import CONFIGS_DIR, RESULTS_DIR


def train_yolo_microbiology(
    epochs: int = 80,
    imgsz: int = 416,
    batch: int | None = None,
    freeze: int = 10,
    patience: int = 20,
    model_name: str = "yolo11n-seg.pt",
    exist_ok: bool = True,
):
    """
    Train YOLO11n-seg model on microbiology dataset with small-dataset regularization.
    Auto-detects CPU vs GPU environment.
    """
    device = 0 if torch.cuda.is_available() else "cpu"
    if batch is None:
        batch = 16 if device == 0 else 8

    print(
        f"Starting {model_name} training on device={device} "
        f"(epochs={epochs}, imgsz={imgsz}, batch={batch}, freeze={freeze}, patience={patience})..."
    )

    model = YOLO(model_name)
    config_path = str(CONFIGS_DIR / "dataset.yaml")

    results = model.train(
        data=config_path,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        patience=patience,
        freeze=freeze,
        degrees=180.0,
        fliplr=0.5,
        flipud=0.5,
        mosaic=1.0,
        copy_paste=0.2,
        close_mosaic=15,
        shear=0.0,
        perspective=0.0,
        hsv_v=0.25,
        save=True,
        exist_ok=exist_ok,
        project=str(RESULTS_DIR),
        name="yolo11n_microbiology",
        workers=4 if device == "cpu" else 8,
    )

    best_pt = RESULTS_DIR / "yolo11n_microbiology" / "weights" / "best.pt"
    print(f"Training finished. Running held-out validation on {best_pt}...")
    val_metrics = YOLO(str(best_pt)).val(data=config_path, imgsz=imgsz, split="val")

    box_map50 = float(val_metrics.box.map50)
    mask_map50 = float(val_metrics.seg.map50)
    print(f"\nHeld-out val summary (imgsz={imgsz}):")
    print(f"  Overall Box mAP50:  {box_map50:.4f}")
    print(f"  Overall Mask mAP50: {mask_map50:.4f}")
    names = val_metrics.names
    for idx, cls_name in names.items():
        cls_box = float(val_metrics.box.ap50[idx]) if idx < len(val_metrics.box.ap50) else 0.0
        cls_mask = float(val_metrics.seg.ap50[idx]) if idx < len(val_metrics.seg.ap50) else 0.0
        print(f"  [{idx}] {cls_name}: Box mAP50={cls_box:.4f}, Mask mAP50={cls_mask:.4f}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLO11n-seg on microbiology dataset")
    parser.add_argument("--epochs", type=int, default=80, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=416, help="Input image size")
    parser.add_argument("--batch", type=int, default=None, help="Batch size")
    parser.add_argument("--freeze", type=int, default=10, help="Number of backbone layers to freeze")
    parser.add_argument("--patience", type=int, default=20, help="Early stopping patience")
    parser.add_argument("--model", type=str, default="yolo11n-seg.pt", help="Pretrained YOLO weights")
    parser.add_argument(
        "--exist-ok",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Overwrite existing results/yolo11n_microbiology directory",
    )
    args = parser.parse_args()

    train_yolo_microbiology(
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        freeze=args.freeze,
        patience=args.patience,
        model_name=args.model,
        exist_ok=args.exist_ok,
    )

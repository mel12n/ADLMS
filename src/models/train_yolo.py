import sys
from pathlib import Path
import torch
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import CONFIGS_DIR, RESULTS_DIR

def train_yolo_microbiology(epochs=100, imgsz=640, batch=None, model_name="yolo11n-seg.pt"):
    """
    Train YOLO11n-seg model on microbiology dataset.
    Auto-detects CPU vs GPU environment.
    """
    device = 0 if torch.cuda.is_available() else 'cpu'
    if batch is None:
        batch = 16 if device == 0 else 8

    print(f"Starting {model_name} training on device: {device} (batch size: {batch})...")
    
    # Load pretrained YOLO11n-seg lightweight segmentation model
    model = YOLO(model_name)
    
    config_path = str(CONFIGS_DIR / "dataset.yaml")
    
    results = model.train(
        data=config_path,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        patience=20,
        save=True,
        project=str(RESULTS_DIR),
        name="yolo11n_microbiology",
        workers=4 if device == 'cpu' else 8,
    )
    
    print("Training process finished.")
    return results

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train YOLO11n-seg on microbiology dataset")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=None, help="Batch size")
    parser.add_argument("--model", type=str, default="yolo11n-seg.pt", help="Pretrained YOLO weights")
    args = parser.parse_args()
    
    train_yolo_microbiology(epochs=args.epochs, batch=args.batch, model_name=args.model)

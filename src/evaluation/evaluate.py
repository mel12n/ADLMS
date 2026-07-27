import sys
from pathlib import Path
import torch
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import CONFIGS_DIR, RESULTS_DIR

def evaluate_model(model_weights_path, data_yaml=None):
    """
    Evaluate trained YOLO11n model against test set.
    Calculates mAP@0.5, mAP@0.5:0.95, and Recall (Sensitivity).
    """
    if data_yaml is None:
        data_yaml = str(CONFIGS_DIR / "dataset.yaml")
        
    print(f"Loading model weights from {model_weights_path}...")
    model = YOLO(model_weights_path)
    
    metrics = model.val(data=data_yaml, split='test')
    
    print("\n--- Evaluation Metrics Summary ---")
    print(f"mAP50:     {metrics.box.map50:.4f}")
    print(f"mAP50-95:  {metrics.box.map:.4f}")
    print(f"Recall (Sensitivity): {metrics.box.mp:.4f}")
    print(f"Precision: {metrics.box.mr:.4f}")
    
    return metrics

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Evaluate YOLO11n model performance")
    parser.add_argument("--weights", type=str, required=True, help="Path to best.pt weights file")
    args = parser.parse_args()
    
    evaluate_model(args.weights)

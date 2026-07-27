import sys
from pathlib import Path
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import EXPORTS_DIR

def export_model_for_edge(weights_path, format_type='onnx', int8_quantize=True):
    """
    Export trained PyTorch YOLO model to Edge AI formats:
    - ONNX Runtime
    - TFLite (with optional INT8 post-training quantization)
    """
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Exporting model {weights_path} to {format_type.upper()} format (INT8: {int8_quantize})...")
    
    model = YOLO(weights_path)
    exported_path = model.export(
        format=format_type,
        int8=int8_quantize,
        dynamic=False,
        imgsz=640
    )
    
    print(f"Export successful. Artifact saved to: {exported_path}")
    return exported_path

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Export YOLO11 model to ONNX / TFLite")
    parser.add_argument("--weights", type=str, required=True, help="Path to best.pt file")
    parser.add_argument("--format", type=str, default="onnx", choices=["onnx", "tflite"], help="Export format")
    args = parser.parse_args()
    
    export_model_for_edge(args.weights, format_type=args.format)

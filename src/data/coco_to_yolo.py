import os
import json
import shutil
from pathlib import Path
import cv2
import sys
import glob

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import RAW_DATA_DIR, SPLITS_DIR

def convert_agar_json_to_yolo(input_dir, train_img_dir, train_lbl_dir):
    """
    Parse AGAR per-image JSON files and convert annotations to YOLO format.
    Input structure: data/raw/AGAR_representative/higher-resolution/bright/
    """
    json_files = glob.glob(os.path.join(input_dir, "**", "*.json"), recursive=True)
    print(f"Found {len(json_files)} JSON annotation files in {input_dir}")

    processed_count = 0
    empty_count = 0
    uncountable_count = 0

    for json_path in json_files:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        img_path = json_path.replace('.json', '.jpg')
        if not os.path.exists(img_path):
            continue

        file_name = os.path.basename(img_path)
        dst_img_path = Path(train_img_dir) / file_name
        dst_txt_path = Path(train_lbl_dir) / file_name.replace('.jpg', '.txt')

        colonies_num = data.get('colonies_number', 0)
        labels = data.get('labels', [])

        if colonies_num == -1:
            uncountable_count += 1
            continue  # Skip uncountable plates for object detection for now

        # We need image dimensions for YOLO normalization
        img = cv2.imread(img_path)
        if img is None:
            continue
        img_h, img_w = img.shape[:2]

        shutil.copy(img_path, dst_img_path)

        with open(dst_txt_path, 'w', encoding='utf-8') as label_file:
            if colonies_num == 0:
                # Empty plate
                label_file.write(f"3 0.5 0.5 1.0 1.0\n")
                empty_count += 1
            else:
                for lbl in labels:
                    x = lbl['x']
                    y = lbl['y']
                    w = lbl['width']
                    h = lbl['height']

                    x_center = (x + w / 2.0) / img_w
                    y_center = (y + h / 2.0) / img_h
                    norm_w = w / img_w
                    norm_h = h / img_h

                    # Class 0: Colony
                    line = f"0 {x_center:.6f} {y_center:.6f} {norm_w:.6f} {norm_h:.6f}\n"
                    label_file.write(line)

        processed_count += 1

    print(f"Conversion complete.")
    print(f"Processed valid images: {processed_count}")
    print(f"Empty plates: {empty_count}")
    print(f"Skipped uncountable plates: {uncountable_count}")

if __name__ == "__main__":
    demo_extracted_dir = RAW_DATA_DIR / "AGAR_representative"
    train_img = SPLITS_DIR / "train" / "images"
    train_lbl = SPLITS_DIR / "train" / "labels"
    
    if demo_extracted_dir.exists():
        convert_agar_json_to_yolo(str(demo_extracted_dir), train_img, train_lbl)
    else:
        print(f"Extracted dataset not found at {demo_extracted_dir}.")


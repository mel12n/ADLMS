import os
import json
import shutil
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import RAW_DATA_DIR, SPLITS_DIR

def coco_to_yolo_bbox(img_width, img_height, bbox):
    """
    Convert COCO bounding box [x_min, y_min, width, height]
    to YOLO format [x_center, y_center, width, height] normalized (0 to 1).
    """
    x_min, y_min, w, h = bbox
    x_center = (x_min + w / 2.0) / img_width
    y_center = (y_min + h / 2.0) / img_height
    norm_w = w / img_width
    norm_h = h / img_height
    return [x_center, y_center, norm_w, norm_h]

def convert_coco_json_to_yolo(json_path, image_dir, output_img_dir, output_lbl_dir, val_split=0.2):
    """
    Parse COCO JSON file and convert annotations to YOLO format.
    Splits into train / validation sets.
    """
    if not os.path.exists(json_path):
        print(f"Annotation file not found: {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    images = {img['id']: img for img in data.get('images', [])}
    categories = {cat['id']: idx for idx, cat in enumerate(data.get('categories', []))}

    # Group annotations by image_id
    image_annotations = {}
    for ann in data.get('annotations', []):
        img_id = ann['image_id']
        image_annotations.setdefault(img_id, []).append(ann)

    print(f"Loaded {len(images)} images and {len(data.get('annotations', []))} annotations.")

    processed_count = 0
    for img_id, img_info in images.items():
        file_name = img_info['file_name']
        img_w = img_info['width']
        img_h = img_info['height']

        src_img_path = Path(image_dir) / file_name
        if not src_img_path.exists():
            continue

        txt_name = Path(file_name).stem + ".txt"
        dst_txt_path = Path(output_lbl_dir) / txt_name
        dst_img_path = Path(output_img_dir) / file_name

        # Copy image
        shutil.copy(src_img_path, dst_img_path)

        # Write YOLO label file
        anns = image_annotations.get(img_id, [])
        with open(dst_txt_path, 'w', encoding='utf-8') as label_file:
            for ann in anns:
                cat_id = ann['category_id']
                yolo_class = categories.get(cat_id, 0)
                yolo_bbox = coco_to_yolo_bbox(img_w, img_h, ann['bbox'])
                line = f"{yolo_class} " + " ".join(f"{coord:.6f}" for coord in yolo_bbox) + "\n"
                label_file.write(line)

        processed_count += 1

    print(f"Successfully converted {processed_count} images & annotations to YOLO format.")

if __name__ == "__main__":
    demo_json = RAW_DATA_DIR / "AGAR_demo" / "annotations.json"
    demo_images = RAW_DATA_DIR / "AGAR_demo" / "images"
    train_img = SPLITS_DIR / "train" / "images"
    train_lbl = SPLITS_DIR / "train" / "labels"
    
    if demo_json.exists():
        convert_coco_json_to_yolo(demo_json, demo_images, train_img, train_lbl)
    else:
        print(f"No COCO JSON found at {demo_json}. Run download_agar.py first.")

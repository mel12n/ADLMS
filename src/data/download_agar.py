import os
import sys
import json
import zipfile
import cv2
import numpy as np
import requests
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import RAW_DATA_DIR, DATA_DIR, SPLITS_DIR

def ensure_directories():
    """Create full dataset directory structure."""
    dirs = [
        RAW_DATA_DIR,
        DATA_DIR / "processed",
        SPLITS_DIR / "train" / "images",
        SPLITS_DIR / "train" / "labels",
        SPLITS_DIR / "val" / "images",
        SPLITS_DIR / "val" / "labels",
        SPLITS_DIR / "test" / "images",
        SPLITS_DIR / "test" / "labels",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    print("Dataset directory structure initialized successfully.")

def generate_synthetic_agar_samples(output_dir, num_samples=15):
    """
    Generate synthetic agar plate images with bacterial colonies and inhibition zones
    for offline testing and verification of the YOLO pipeline.
    """
    demo_dir = Path(output_dir) / "AGAR_demo"
    img_dir = demo_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)

    coco_data = {
        "images": [],
        "annotations": [],
        "categories": [
            {"id": 0, "name": "colony"},
            {"id": 1, "name": "inhibition_zone"},
            {"id": 2, "name": "antibiotic_disk"},
            {"id": 3, "name": "empty_plate"}
        ]
    }

    ann_id = 0
    np.random.seed(42)

    for i in range(num_samples):
        # Create agar dish canvas (amber/yellow background)
        img = np.ones((640, 640, 3), dtype=np.uint8) * 230
        cv2.circle(img, (320, 320), 290, (180, 210, 240), -1)  # Agar dish surface
        cv2.circle(img, (320, 320), 295, (100, 100, 100), 5)   # Dish rim

        img_id = i
        file_name = f"sample_agar_{i:03d}.jpg"
        
        coco_data["images"].append({
            "id": img_id,
            "file_name": file_name,
            "width": 640,
            "height": 640
        })

        is_empty = (i % 5 == 0)
        if is_empty:
            # Empty plate category
            coco_data["annotations"].append({
                "id": ann_id,
                "image_id": img_id,
                "category_id": 3,
                "bbox": [30, 30, 580, 580]
            })
            ann_id += 1
        else:
            # Generate random colonies
            num_colonies = np.random.randint(5, 20)
            for c in range(num_colonies):
                cx = np.random.randint(100, 540)
                cy = np.random.randint(100, 540)
                radius = np.random.randint(6, 18)
                color = (np.random.randint(200, 255), np.random.randint(240, 255), np.random.randint(200, 255))
                
                cv2.circle(img, (cx, cy), radius, color, -1)
                cv2.circle(img, (cx, cy), radius, (50, 50, 50), 1)

                bbox = [cx - radius, cy - radius, radius * 2, radius * 2]
                coco_data["annotations"].append({
                    "id": ann_id,
                    "image_id": img_id,
                    "category_id": 0,  # colony
                    "bbox": bbox
                })
                ann_id += 1

            # Generate AST disk & inhibition zone for AST plates
            if i % 2 == 1:
                cx, cy = 320, 320
                disk_r = 15
                zone_r = 55

                # Inhibition zone halo
                cv2.circle(img, (cx, cy), zone_r, (160, 190, 220), -1)
                # Antibiotic paper disk
                cv2.circle(img, (cx, cy), disk_r, (255, 255, 255), -1)
                cv2.circle(img, (cx, cy), disk_r, (0, 0, 0), 1)

                # Inhibition zone annotation
                coco_data["annotations"].append({
                    "id": ann_id,
                    "image_id": img_id,
                    "category_id": 1,  # inhibition_zone
                    "bbox": [cx - zone_r, cy - zone_r, zone_r * 2, zone_r * 2]
                })
                ann_id += 1

                # Antibiotic disk annotation
                coco_data["annotations"].append({
                    "id": ann_id + 1,
                    "image_id": img_id,
                    "category_id": 2,  # antibiotic_disk
                    "bbox": [cx - disk_r, cy - disk_r, disk_r * 2, disk_r * 2]
                })
                ann_id += 2

        # Save synthetic image
        cv2.imwrite(str(img_dir / file_name), img)

    # Save COCO JSON annotations file
    with open(demo_dir / "annotations.json", 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2)

    print(f"Generated {num_samples} synthetic agar plate samples with annotations in {demo_dir}")

def main():
    ensure_directories()
    generate_synthetic_agar_samples(RAW_DATA_DIR, num_samples=20)
    print("\nDataset preparation setup complete.")
    print("Official AGAR Dataset link: https://agar.neurosys.com/")

if __name__ == "__main__":
    main()

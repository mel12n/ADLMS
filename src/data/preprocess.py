import cv2
import numpy as np
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.utils.constants import IMAGE_SIZE

def apply_clahe(image_bgr):
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
    to normalize lighting variations across agar plate images.
    """
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    
    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

def crop_plate_roi(image_bgr):
    """
    Detect the circular agar plate boundary and crop to ROI to remove desk/table noise.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    
    # Hough Circle Transform to find agar plate boundary
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=100,
        param1=50,
        param2=30,
        minRadius=int(min(image_bgr.shape[:2]) * 0.3),
        maxRadius=int(max(image_bgr.shape[:2]) * 0.5)
    )
    
    if circles is not None:
        circles = np.round(circles[0, :]).astype("int")
        # Select largest circle
        largest_circle = max(circles, key=lambda c: c[2])
        x, y, r = largest_circle
        
        # Bounding square around circle
        x1 = max(0, x - r)
        y1 = max(0, y - r)
        x2 = min(image_bgr.shape[1], x + r)
        y2 = min(image_bgr.shape[0], y + r)
        
        cropped = image_bgr[y1:y2, x1:x2]
        return cropped, (x1, y1, x2, y2)
    
    return image_bgr, (0, 0, image_bgr.shape[1], image_bgr.shape[0])

def preprocess_plate_image(image_path, target_size=IMAGE_SIZE):
    """
    Full OpenCV preprocessing pipeline:
    1. Read image
    2. Apply CLAHE for illumination correction
    3. Extract plate ROI
    4. Resize to target YOLO dimensions (640x640)
    """
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not load image at {image_path}")
        
    img_clahe = apply_clahe(img)
    roi, _ = crop_plate_roi(img_clahe)
    resized = cv2.resize(roi, target_size, interpolation=cv2.INTER_AREA)
    return resized

if __name__ == "__main__":
    print("Preprocess pipeline ready. Target size:", IMAGE_SIZE)

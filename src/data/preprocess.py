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
    Skips cropping when the detected Petri dish already fills > 85% of the frame.
    """
    if image_bgr is None or image_bgr.size == 0:
        return image_bgr, (0, 0, 0, 0)

    h, w = image_bgr.shape[:2]
    if min(h, w) <= 0:
        return image_bgr, (0, 0, w, h)

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
        minRadius=int(min(h, w) * 0.3),
        maxRadius=int(max(h, w) * 0.5)
    )

    if circles is not None:
        circles = np.round(circles[0, :]).astype("int")
        # Select largest circle
        largest_circle = max(circles, key=lambda c: c[2])
        x, y, r = int(largest_circle[0]), int(largest_circle[1]), int(largest_circle[2])

        # Skip cropping when the plate already fills > 85% of the frame (Antibiogram_demo framing)
        if (2 * r) / min(h, w) > 0.85:
            return image_bgr, (0, 0, w, h)

        # Bounding square around circle clamped to [0, w] / [0, h]
        x1 = max(0, min(w, x - r))
        y1 = max(0, min(h, y - r))
        x2 = max(0, min(w, x + r))
        y2 = max(0, min(h, y + r))

        if x2 <= x1 or y2 <= y1:
            return image_bgr, (0, 0, w, h)

        cropped = image_bgr[y1:y2, x1:x2]
        return cropped, (x1, y1, x2, y2)

    return image_bgr, (0, 0, w, h)

def preprocess_plate_image(image_path, target_size=IMAGE_SIZE):
    """
    Full OpenCV preprocessing pipeline (ROI -> CLAHE):
    1. Read image
    2. Extract plate ROI (skips crop when plate fills > 85% of frame)
    3. Apply CLAHE strictly after ROI isolation for illumination correction
    4. Resize to target YOLO dimensions (640x640)
    """
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not load image at {image_path}")

    roi, _ = crop_plate_roi(img)
    img_clahe = apply_clahe(roi)
    resized = cv2.resize(img_clahe, target_size, interpolation=cv2.INTER_AREA)
    return resized

if __name__ == "__main__":
    print("Preprocess pipeline ready. Target size:", IMAGE_SIZE)

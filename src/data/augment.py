import albumentations as A
import cv2

def get_training_augmentation(img_size=640):
    """
    Data augmentation pipeline tailored for microbiology agar plate images.
    Rotations and flips simulate different hand orientations on the bench.
    Brightness and contrast adjustments simulate camera sensor variations.
    """
    return A.Compose([
        A.Resize(img_size, img_size),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomRotate90(p=0.5),
        A.ShiftScaleRotate(shift_limit=0.0625, scale_limit=0.1, rotate_limit=45, p=0.5),
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=10, p=0.3),
        A.GaussianBlur(blur_limit=(3, 5), p=0.2),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['category_ids']))

def get_validation_augmentation(img_size=640):
    """Simple resize for validation images."""
    return A.Compose([
        A.Resize(img_size, img_size),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['category_ids']))

if __name__ == "__main__":
    aug = get_training_augmentation()
    print("Augmentation pipeline initialized successfully.")

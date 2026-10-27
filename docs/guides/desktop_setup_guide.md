# Desktop PC (Intel i7) Setup & Training Guide

This guide contains the exact steps to migrate this project to your main Desktop PC (Intel Core i7 10th Gen, AMD RX 6600) and perform the full YOLOv11 training for the microbiology laboratory project.

## Prerequisites

Ensure your Desktop PC has the following installed:
- **Python 3.10 or newer** (Miniconda is highly recommended)
- **Git**

## Step 1: Transfer the Project

Since we have already committed our progress, you can either push this to GitHub and clone it on your Desktop, or simply copy the entire `ADLMS` folder via a USB drive.

**If using GitHub:**
```bash
git clone https://github.com/YOUR_USERNAME/ADLMS.git
cd ADLMS
```

## Step 2: Install Dependencies

Open a terminal on your Desktop PC, navigate to the `ADLMS` folder, and install the required Python libraries. Since your Desktop PC has an AMD GPU (RX 6600), we will use the CPU for training which your i7 will handle very well.

```bash
# Create a fresh conda environment (optional but recommended)
conda create -n agar_env python=3.11 -y
conda activate agar_env

# Install dependencies (CPU optimized)
pip install -r requirements.txt
```

## Step 3: Add the Full AGAR Dataset

We built a synthetic demo on the laptop, but for the Desktop, you want the real dataset.

1. Download the **full AGAR dataset** (both bright and dark, high/low resolution) from [https://agar.neurosys.com/](https://agar.neurosys.com/).
2. Extract the downloaded zip file into the `data/raw/` folder. It should look like this:
   `ADLMS/data/raw/AGAR_representative/higher-resolution/...`

## Step 4: Convert Annotations to YOLO Format

Run the custom script we built to convert the AGAR JSON files into YOLO bounding box format. It will automatically detect the images and generate the normalized `.txt` label files in `data/splits/train/`.

```bash
python3 src/data/coco_to_yolo.py
```
*Note: Make sure the output says "Processed valid images: [Number]" to confirm it found your full dataset.*

## Step 5: Start the Full Training

With the dataset converted, you are ready to train the AI model. 
By default, the script will train the lightweight `YOLO11n` model which is perfect for CPU training.

```bash
# Run training for 100 epochs
python3 src/models/train_yolo.py --epochs 100 --batch 16
```

### Monitoring Progress
The training script will save the results, weights, and validation charts automatically into the `results/yolo11n_microbiology/` folder.
- **Best Model Weights**: `results/yolo11n_microbiology/weights/best.pt`
- **Training Metrics**: `results/yolo11n_microbiology/results.csv` (or `.png` charts).

---

## Step 6 (Future): Evaluation and Export
Once training finishes, you can evaluate the model and export it to a lighter format (like TFLite) for deployment.

```bash
# Evaluate the trained model
yolo val model=results/yolo11n_microbiology/weights/best.pt data=configs/dataset.yaml

# Export to TFLite (Optional, for mobile/edge deployment)
yolo export model=results/yolo11n_microbiology/weights/best.pt format=tflite
```

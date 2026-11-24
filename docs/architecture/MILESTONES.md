# ADLMS Project Milestones

This document outlines the roadmap and milestones for the Antibiogram Deep Learning Mobile System, going from dataset creation to mobile deployment.

## Phase 1: Dataset Preparation (In Progress)
**Goal:** Prepare a robust baseline dataset for YOLO object detection.
- [x] Set up local Python environment and install `labelImg` / `labelme`.
- [x] Configure classes (`LEV-5`, `TGC-15`, `inhibition_zone`, etc.).
- [x] Fix Python 3.12+ compatibility issues with `labelImg`.
- [ ] Complete annotations for images in `data/Antibiogram_demo/Train` (target: 60–80 plates for prototype).
- [ ] Create `dataset.yaml` mapping the indices to the target classes.

## Phase 1.5: Mobile User UI App & Installable PWA (Parallel Track — Active)
**Goal:** Advance the user-facing DeepHalo mobile application (`mvp_web/`) into a complete mobile PWA while dataset labeling is completed.
- [x] **Phase 2.7:** Clinical Precision Dark Instrument mobile design system, installable Mobile PWA (`manifest.webmanifest` + `sw.js`), fiducial telemetry bar, full-screen on phones + Single/Twin phone frame toggle on desktop.
- [ ] **Phase 2.8:** Guided Camera Capture & Perspective Alignment Assistant (live camera / upload, Petri ring reticle, tilt/ellipse perspective indicator, 6.0 mm fiducial check).
- [ ] **Phase 2.9:** Interactive Plate Inspector & Direct Canvas Digital Caliper (on-canvas radial drag handles, fiducial `mm/px` telemetry, CLAHE/ROI/Grad-CAM layers, CLSI/EUCAST live delta table).
- [ ] **Phase 2.10:** Specimen Intake editor, NCh-ISO 15189 technologist audit log (`AUDITED_BY_TECHNOLOGIST`), and HL7 FHIR R4 / printable report studio.

## Phase 2: Model Training & Validation
**Goal:** Train a YOLO11n model to accurately detect disks and inhibition zones.
- [ ] Configure `src/models/train_yolo.py` with the correct hyperparameters.
- [ ] Run the initial training loop ("baseline model") on the 81 images.
- [ ] Evaluate the model's performance (mAP, loss) on a test set.
- [ ] (Optional) Apply Data Augmentation to increase robustness if the model struggles with lighting or shadows.

## Phase 3: Clinical Measurement Logic
**Goal:** Write the mathematical logic that interprets the AI's predictions and calculates the clinical inhibition zone diameter.
- [ ] **Create `src/models/predict_and_measure.py`**
- [ ] **Logic Step 1:** Run YOLO inference on a new photo.
- [ ] **Logic Step 2:** Extract the `[X_center, Y_center]` coordinates for all detected disks.
- [ ] **Logic Step 3:** Extract the boundaries `[X_min, Y_min, X_max, Y_max]` for all detected `inhibition_zone` halos.
- [ ] **Logic Step 4:** Pair each disk with its halo by calculating the shortest distance between disk centers and halo boundaries.
- [ ] **Logic Step 5:** Calculate the shortest radius to the nearest growth (closest edge of the halo box).
- [ ] **Logic Step 6:** Multiply the shortest radius by 2 to get the pixel diameter.
- [ ] **Logic Step 7:** Convert pixel diameter to millimeters (mm) based on a known reference (e.g., standard 6mm paper disk).

## Phase 4: Mobile Export & Deployment
**Goal:** Export the trained model for use in a mobile application.
- [ ] Run `src/models/export_model.py` to convert the `.pt` PyTorch weights to a mobile-friendly format (NCNN, TFLite, or CoreML depending on the target OS).
- [ ] Integrate the model and the measurement logic into the mobile app frontend.
- [ ] Perform real-world testing with the phone camera in a laboratory setting.

# Feature Research: DeepHalo v1.6 Edge Device Demo (TR6948)

**Domain:** Offline On-Device Clinical Microbiology AST (Kirby-Bauer) WebView + ORT-Web Edge AI Demo  
**Researched:** 2026-11-24  
**Confidence:** HIGH (codebase integration & constraints) / MEDIUM (browser WASM & WebView 119 runtime mechanics)

> **Scope Boundary (Milestone v1.6 Delta):**  
> `mvp_web/` already ships the Mobile-First PWA UI (`index.html`, `style.css`), Canvas optical inspector (CLAHE filter, ROI clip, Grad-CAM jet overlay, pinch/zoom), interactive sticky caliper (`±0.5 mm`, drag handle, `AUDITED_BY_TECHNOLOGIST` log), EUCAST v16.1 / CLSI M100 breakpoint engine (`breakpoints_data.js`: 65 drugs, 8 taxonomic groups, 23 aliases, 7 intrinsic resistance rules), and HL7 FHIR R4 JSON / CSV export (`app.js`). Server-side inference already runs in `run_web_mvp.py` + `src/evaluation/measure_zones.py`.  
> This research covers **only the new v1.6 features** required to run that complete demo flow **100% offline on the TR6948 Android 10 device** (`armeabi-v7a`, 968 MB RAM, `1024x600@160dpi`, WebView `119.0.6045.163`) with no PC connected at runtime.

---

## Feature Landscape

### Table Stakes (Non-Negotiable for v1.6 Edge Demo)

Missing any of these leaves the TR6948 APK broken, unusable on the physical screen, or unable to complete the end-to-end demo without a PC.

| Feature | Why Expected | Complexity | Notes & Dependencies |
|---------|--------------|------------|----------------------|
| **Offline `onnxruntime-web` WASM Inference Engine** | Replaces `POST /api/analyze` (`run_web_mvp.py`) when the tablet/device has no PC server. Must execute `YOLO11n-seg` ONNX (320–416 px) inside WebView 119. | HIGH | Bundle `ort.min.js` + local `.wasm` files inside APK assets; set `ort.env.wasm.wasmPaths` locally and `numThreads = 1` (Android WebView lacks `SharedArrayBuffer` / `crossOriginIsolated`). Probe SIMD capability at boot and fall back safely to non-SIMD `ort-wasm.wasm` if needed. |
| **In-Browser YOLO11n-seg Post-Processing (NMS + Mask Decoding + 6.0 mm Calibration)** | Raw ONNX tensors (`output0` boxes/coeffs + `output1` `[1, 32, H/4, W/4]` prototypes) mean nothing clinically until decoded into disk/zone polygons and scaled in `mm`. | HIGH | Port `analyze_plate_image()` core math from `src/evaluation/measure_zones.py` to JS (`mvp_web/ort_inference.js` or Web Worker): score thresholding, class-split NMS (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`), `32 × proto` linear combination + sigmoid + bbox crop, contour/area equivalent diameter (`2 * sqrt(area / pi)`), median 6.0 mm disk fiducial scaling (`F_scale`), and 1-to-1 greedy disk-to-zone pairing. |
| **Offline Android WebView 119 Wrapper APK (`WebViewAssetLoader`)** | Opening `file://` in Android breaks `fetch()` for `.onnx`/`.wasm` and ES module loading; Chrome 81 on TR6948 is too old for reliable modern WASM. | MEDIUM | Minimal Kotlin/Java Android app (`minSdk 29`, `armeabi-v7a`) wrapping Android System WebView `119.0.6045.163`. Serve `mvp_web/` + model + ORT WASM via `androidx.webkit.WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/` with explicit `application/wasm` MIME type. |
| **Native WebView File Picker & Camera Capture (`onShowFileChooser`)** | Currently `mvp_web/index.html` uses `<input type="file">`; bare Android WebView silently ignores file inputs unless `WebChromeClient.onShowFileChooser` is implemented. | MEDIUM | Override `onShowFileChooser` in Kotlin with `ActivityResultContracts`, `Intent.ACTION_GET_CONTENT`, and `MediaStore.ACTION_IMAGE_CAPTURE` backed by `FileProvider` (`CAMERA` permission in manifest) so the TR6948 2 MP back camera or local test plate gallery works offline. |
| **Manual Antibiotic Drug Selection UI (Replacing EasyOCR)** | `YOLO11n-seg` collapses all drugs into class `0: antibiotic_disk` (ADR-005). Without EasyOCR, every newly detected disk initially appears as `UNK` with `NA` clinical interpretation until assigned a drug code. | MEDIUM | Tapping any `UNK` (or misassigned) disk/row opens a compact drug picker drawing from `window.ADLMS_BREAKPOINTS.drugs` (65 drugs) prioritized by `COMMON_CLINICAL_CODES` and filtered/grouped by active organism (`Enterobacterales`, `Staphylococcus`, etc.), immediately re-running `evaluate(disc)` and `renderPanel()`. |
| **`1024x600@160dpi` Landscape Responsive Layout & Offline Assets** | Currently `mvp_web/style.css` only exits the scaled twin-phone chassis below `max-width: 600px` (`@media (max-width: 959px)`/`600px`). On a `1024x600` landscape screen, `mvp_web/` renders two shrunken phone frames (`fitDevice()`) and `index.html` tries to load Google Fonts over HTTPS. | MEDIUM | Add a compact landscape workstation / WebView layout (`1024x600` has `600px` vertical height, `1dp = 1px` at `160dpi`): side-by-side Petri canvas (left, ~520×520) + Results/Caliper/Drug-Assign rail (right), zero fake phone bezels, `44–48px` touch targets, and system/local font stack fallback with zero external CDN requests. |
| **WebView-Compatible FHIR JSON / CSV Export (`DownloadListener` + `MediaStore`)** | Currently `download()` in `mvp_web/app.js` uses `URL.createObjectURL(new Blob(...))` + `<a download>`. Android WebView `DownloadManager` fails on `blob:` URLs, breaking the "LIS" export step. | LOW | Bridge `blob:` downloads via `DownloadListener` + `@JavascriptInterface` (`AndroidBridge.saveFileFromBase64`) writing to `MediaStore.Downloads` (Android 10 API 29 requires no legacy `WRITE_EXTERNAL_STORAGE`), plus keeping clipboard copy working. |
| **On-Device Latency & Peak RAM Benchmarking Telemetry** | Milestone v1.6 explicitly requires verified end-to-end latency and peak RAM on the physical TR6948 (`~22 MB` free + `726 MB` swap at idle) to prove edge feasibility. | LOW | Instrument JS stage timers (`performance.now()` for image decode/resize, tensor prep, `session.run()`, mask decode/geometry, total TRT) displayed in an unobtrusive telemetry badge/drawer, paired with an `adb` profiling script targeting the WebView **Renderer PID** (`dumpsys meminfo <renderer_pid>`). |

---

### Differentiators (High-Value Demo Polish)

Features that elevate the live TR6948 defense/demo above a basic tech prototype without jeopardizing the ~1 GB RAM budget.

| Feature | Value Proposition | Complexity | Notes & Dependencies |
|---------|-------------------|------------|----------------------|
| **One-Tap Formulary Panel Presets + Quick-Assign Queue** | Assigning 6–12 `UNK` disks one by one from 65 drugs takes ~30–60 s in a live demo. A standard panel preset (`Enterobacterales Gram−`, `Staphylococcus Gram+`) or "Auto-advance to next `UNK` disk" cuts assignment to `< 10 s`. | LOW | When a drug is picked for `UNK #1`, automatically select the next unassigned `UNK` disk on the canvas (`autoAdvance`). Optionally offer a 1-tap "Apply Standard Panel Order" or recent-drugs chip bar (`CIP-5`, `CRO-30`, `AMC-30`, `MEM-10`, `FOX-30`, `VA-5`) filtered by `state.group`. |
| **In-Browser 36-Ray Radial Sobel Geometric Cross-Validation** | Preserves ADR-006 clinical safety offline: cross-checks YOLO's mask diameter against luminance gradient (`|r_yolo - r_sobel| <= 1.2 mm`) and flags `geoAlert` / `Δr` badges in `mvp_web/app.js`. | MEDIUM | Port `validate_zone_geometry()` from `src/evaluation/cross_validation.py` to JS operating on the downscaled RGBA `ImageData` already decoded for preprocessing (avoiding extra full-res image buffers). Runs in `< 15 ms` for 12 disks. |
| **`inner_colony` (Class 2) Resistant-Subpopulation Alert Badge** | `YOLO11n-seg` is trained on 3 classes including `2: inner_colony` (ADR-005). Surfacing detected inner colonies inside an inhibition zone directly implements EUCAST/CLSI heteroresistance warnings (like AntibiogramJ's manual microcolony flag, but automated). | LOW | During JS post-processing, map Class 2 `inner_colony` centroids into paired `inhibition_zone` radii (`dist(colony, zone_center) < zone_radius`); attach `hasInnerColony: true` flag to the disk record and render a warning pill in `renderPanel()` / `renderCaliper()`. |
| **Bundled Offline Demo Plates + Live Inference Switcher** | Guarantees instant fallback and reproducibility during defense presentations: pre-loaded `plates_data.js` samples + an "Analyze Plate Image with On-Device YOLO" trigger even on bundled sample plates (`gn_a.jpg`, etc.). | LOW | Keep `plates_data.js` sample chips working offline, and add a "Re-run On-Device ORT" button or capture/gallery flow so evaluators can see both instant cached plates and live 100% offline WASM inference side-by-side. |
| **Graceful Memory & Thermal Guardrail (Auto-Downscale + Session Reuse)** | Prevents OOM kills in the WebView Renderer on TR6948 (`968 MB` total RAM, `726 MB` swap) when a user picks a large photo (`test_01.jpg` is `2.3 MB` compressed, potentially 12+ MP decoded). | LOW | Keep a single lazy-initialized `ort.InferenceSession` singleton; downsample input `HTMLImageElement` on an offscreen `<canvas>` directly to model input (`320×320` or `416×416`) plus an inspection buffer capped at `<= 1000 px` (`state.N <= 1000`), and explicitly call `tensor.dispose()` after `session.run()`. |

---

### Anti-Features (Explicitly Do NOT Build in v1.6)

Features that look attractive on paper but will blow up TR6948 RAM, latency, or APK complexity for zero demo gain.

| Anti-Feature | Why Requested | Why Problematic on TR6948 | Alternative |
|--------------|---------------|---------------------------|-------------|
| **On-Device EasyOCR / Tesseract.js / PaddleOCR in Browser** | Eliminates manual drug selection by reading stamped disk ink (`CIP 5`). | EasyOCR/PyTorch doesn't run in browser JS; Tesseract.js/PaddleOCR WASM loads another 10–30 MB of weights + dictionaries, runs 8–16 rotated crops per disk (~80–160 OCR passes per plate), causing multi-second freezes and OOM crashes inside TR6948's `~22 MB` free / `726 MB` swap envelope. Furthermore, TR6948's `2 MP` camera often blurs 6 mm disk typography. | **Manual Drug Selection UI** (searchable clinical formulary + recent chips + auto-advance across `UNK` disks). |
| **Multi-Threaded WASM (`numThreads > 1` / `ort-wasm-simd-threaded`)** | Faster CPU inference on multi-core ARM SoCs. | Android WebView does **not** reliably support `crossOriginIsolated` / `SharedArrayBuffer`, causing threaded ORT-Web initialization to fail or hang; plus multiple thread workers multiply linear WASM memory heaps on a 32-bit `armeabi-v7a` (`< 2–3 GB` virtual address space, `968 MB` RAM) device. | **Single-threaded WASM (`ort.env.wasm.numThreads = 1`)** with runtime SIMD probe (`ort-wasm-simd.wasm` if supported, else `ort-wasm.wasm` fallback) and `320–416 px` input size. |
| **Live Real-Time Camera Stream Inference (`getUserMedia` + 30 FPS YOLO)** | Looks flashy for a live camera feed. | Continuous `320×320` WASM segmentation on a `sun50iw10p1` 32-bit CPU without NPU at `~500–2000 ms/frame` freezes the UI/WebView, thermal-throttles the SoC, and `getUserMedia` inside Android WebView requires extra `onPermissionRequest` handling and often yields low-res/unfocused frames on 2 MP tablet cameras. | **Snap-and-Analyze Still Capture** via native Android camera intent (`onShowFileChooser` / `MediaStore.ACTION_IMAGE_CAPTURE`) or gallery image picker, running one deterministic inference pass per plate. |
| **Heavy Frontend Framework Rewrite (React / Vite / Capacitor / Cordova)** | "Modernizes" `mvp_web/` or packages APK via CLI tooling. | `mvp_web/` is already zero-build Vanilla ES2022 (`app.js`, `style.css`). Adding Capacitor/Cordova/React bloats APK size, breaks `run_web_mvp.py`'s zero-build static serving, and introduces toolchain friction on Windows for a minimal demo wrapper. | **Minimal Native Android Studio / Gradle WebView Shell** (~150 lines of Kotlin) directly copying `mvp_web/` into `app/src/main/assets/www/`. |
| **Full-Resolution `640×640` FP32 ONNX Model in Browser** | Matches desktop `best.pt` resolution and precision. | FP32 `YOLO11n-seg` at `640×640` (`~11–13 MB` weights + `4×` activation & prototype memory `[1, 32, 160, 160]` = ~3.3 MB per tensor + intermediate conv buffers) risks hitting Android WebView's Low Memory Killer (LMK) on 968 MB RAM and takes multiple seconds on single-thread non-SIMD WASM. | **Compact `320×320` or `416×416` INT8 / FP16 ONNX** (prototype grid `80×80` or `104×104`, `4×` fewer pixels per mask than `160×160`), with explicit tensor disposal. |
| **Automated Live LIS/HTTP Server Sync** | Sends FHIR bundles to hospital server. | Violates the 100% offline zero-PC demo goal and requires hospital network credentials / backend infrastructure (already deferred to Milestone 2 Phase 4). | **Offline HL7 FHIR R4 JSON + CSV local file save** to Android `Downloads` via `MediaStore` + in-modal JSON preview. |

---

## Feature Dependencies

```
[1. Train & Export Compact YOLO11n-seg ONNX (320-416px, INT8/FP16)]
        │
        ├──required by──> [2. ORT-Web Offline WASM Session + JS Mask Decoder & 6.0mm Calibration]
        │                         │
        │                         ├──required by──> [3. Manual Drug Selection UI (UNK -> 65-drug EUCAST)]
        │                         │                         │
        │                         │                         └──enhances──> [existing: evaluate(), auditLog, buildFhir()]
        │                         │
        │                         ├──enhances──> [4. JS 36-Ray Sobel Cross-Validation & inner_colony Flag]
        │                         │
        │                         └──required by──> [5. In-App Latency & ADB Renderer RAM Telemetry]
        │
[6. Minimal Android WebView 119 APK (WebViewAssetLoader + application/wasm)]
        │
        ├──required by──> [2. ORT-Web Offline WASM Session] (provides HTTPS Secure Context & MIME type)
        ├──required by──> [7. WebChromeClient.onShowFileChooser (Gallery + 2MP Camera Intent)]
        ├──required by──> [8. DownloadListener + AndroidBridge MediaStore Export]
        └──requires──>    [9. 1024x600@160dpi Landscape CSS & Offline Font Fallback]
```

### Dependency Notes

- **Feature 2 requires Feature 1 & Feature 6:** `onnxruntime-web` cannot run until a compact `yolo11n-seg.onnx` (`320–416 px`, 3 classes) is exported from `results/yolo11n_microbiology/weights/best.pt`, and Android WebView cannot `fetch()` or `instantiateStreaming()` `.wasm`/`.onnx` over `file://`; it requires `WebViewAssetLoader` serving `application/wasm` over `https://appassets.androidplatform.net/`.
- **Feature 3 requires Feature 2 (and existing `breakpoints_data.js`):** Because `YOLO11n-seg` only predicts `0: antibiotic_disk` without drug identity (ADR-005), every live detection needs a drug code before `evaluate(disc)` and `buildFhir()` in `mvp_web/app.js` can produce S/I/R interpretations. Manual selection replaces `identify_disk_code()` (`EasyOCR`) in `src/evaluation/measure_zones.py`.
- **Feature 7 & Feature 8 depend on Feature 6:** Replacing the `<input type="file">` and `blob:` download stubs in `mvp_web/app.js` only works inside the APK once `WebChromeClient.onShowFileChooser` and `DownloadListener` / `AndroidBridge` are wired in the Android shell (while preserving standard browser behavior when served by `run_web_mvp.py` on desktop).
- **Feature 9 blocks live usability on TR6948:** Without updating `mvp_web/style.css` and `mvp_web/app.js` (`fitDevice()`), the `1024×600` viewport triggers desktop twin-phone scaling instead of full-screen single-screen operation, making touch targets and canvas inspection too small to demo.

---

## MVP Definition (v1.6 Edge Device Demo)

### Launch With (v1.6 Core Demo — P1)

Minimum viable feature set to demonstrate a 100% offline Kirby-Bauer reading on the USB-attached TR6948 with no PC at runtime:

- [ ] **Compact `YOLO11n-seg` ONNX model** (`320–416 px`, INT8 or FP16) + local `onnxruntime-web` WASM assets (`numThreads = 1`, non-SIMD fallback).
- [ ] **JS Inference & Geometry Engine** (`ort_inference.js`): image canvas preprocessing, ORT session singleton with `tensor.dispose()`, NMS, prototype mask decoding (`32 × H/4 × W/4`), equivalent diameter, 6.0 mm median disk fiducial scaling, and 1-to-1 disk-to-zone pairing.
- [ ] **Manual Drug Selection UI**: click any `UNK` disk/row → pick from searchable/grouped clinical formulary (`breakpoints_data.js`) → instant S/I/R & intrinsic-resistance evaluation + `autoAdvance` to next `UNK`.
- [ ] **Offline Android WebView 119 APK** (`armeabi-v7a`, `minSdk 29`) with `WebViewAssetLoader` (`application/wasm` MIME), `onShowFileChooser` (gallery + camera intent), and `AndroidBridge` `MediaStore` download for FHIR JSON/CSV.
- [ ] **`1024x600@160dpi` Landscape Responsive Layout + Offline Assets**: side-by-side canvas + results/caliper view at `1024×600`, Google Fonts removed/local fallback, `run_web_mvp.py` compatibility preserved via runtime mode detection (API if reachable or local ORT-Web toggle).
- [ ] **On-Device Benchmark Telemetry**: JS stage timers (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`) visible in UI + `adb` Renderer PID RAM capture script.

### Add After Validation (v1.6.x Polish — P2)

Add once the core ONNX + APK pipeline runs reliably inside TR6948's RAM budget:

- [ ] **In-Browser 36-Ray Radial Sobel Cross-Validation (`cross_validation.py` port)** — restores `Δr ≤ 1.2 mm` geometric warning badges offline.
- [ ] **`inner_colony` (Class 2) Alert Pill** — maps detected inner colonies onto paired inhibition zones and surfaces EUCAST/CLSI heteroresistance flags.
- [ ] **One-Tap Formulary Panel Presets** — quick-assign standard disk panels (e.g., *E. coli* urinary/systemic panel) to cut multi-disk assignment time during demos.

### Future Consideration (v2+ / Milestone 2)

Defer until post-v1.6 (requires higher-RAM hardware or larger labeled dataset):

- [ ] **On-device automated drug-code classifier / tiny CNN** (trained directly on cropped disk patches from labeled dataset, replacing EasyOCR without heavy text-recognition overhead).
- [ ] **Multi-threaded WASM / NNAPI / LiteRT native acceleration** on 64-bit ARMv8-A `>= 2 GB` RAM production devices (per ADR-001).
- [ ] **Live hospital HL7 FHIR R4 server POST** (Phase 4).

---

## Feature Prioritization Matrix

| Feature | Demo Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Offline `onnxruntime-web` WASM inference + JS mask/mm decoder | HIGH | HIGH | **P1** |
| Minimal Android WebView 119 APK (`WebViewAssetLoader`, `onShowFileChooser`, `MediaStore`) | HIGH | MEDIUM | **P1** |
| Manual antibiotic drug selection UI (`UNK` → 65-drug formulary) | HIGH | MEDIUM | **P1** |
| `1024x600@160dpi` landscape CSS + offline font/asset bundling | HIGH | LOW | **P1** |
| On-device latency telemetry + `adb` Renderer RAM benchmark | HIGH | LOW | **P1** |
| JS 36-ray radial Sobel geometric cross-validation | MEDIUM | MEDIUM | **P2** |
| `inner_colony` Class 2 alert badge | MEDIUM | LOW | **P2** |
| One-tap formulary panel presets + recent drug chips | MEDIUM | LOW | **P2** |
| Tiny disk-patch CNN drug classifier (replacing manual/OCR) | HIGH | HIGH | **P3** |

---

## Competitor & Reference Feature Analysis

| Feature | AntibiogramJ (Desktop Java) | Commercial Automated Readers (e.g., BIOMIC V3 / SIRscan) | DeepHalo v1.6 (TR6948 Offline Edge Demo) |
|---------|-----------------------------|----------------------------------------------------------|------------------------------------------|
| **Execution Environment** | Desktop JVM (Windows/macOS/Linux) | Dedicated benchtop workstation + calibrated light-box | **Offline Android 10 WebView 119 APK** on `$50`-class 32-bit `968 MB` hardware (no PC) |
| **Zone Segmentation** | Classical thresholding / Hough circle | Proprietary CV + calibrated lighting box | **YOLO11n-seg ONNX (`onnxruntime-web` WASM)** + 6.0 mm fiducial anchor |
| **Drug Identification** | Template / OCR + manual dropdown override wizard | Fixed cartridge template + OCR | **Manual Clinical Formulary Picker** (`65` EUCAST/CLSI drugs, `autoAdvance` on `UNK`) — skips heavy OCR to fit `968 MB` RAM |
| **Manual Verification UX** | Slider + numeric mm input + add/remove disk + microcolony checkbox | Mouse-drag circle resize | **Direct Canvas drag handle + `±0.5 mm` gloved stepper + `AUDITED_BY_TECHNOLOGIST` log** |
| **Clinical Rules & Export** | CLSI / EUCAST CSV | LIS middleware (HL7/ASTM) | **EUCAST v16.1 + CLSI M100 + 7 Intrinsic Resistance Rules + offline HL7 FHIR R4 JSON & CSV** |

---

## Sources

- **Codebase Evidence (HIGH confidence):**
  - `PROJECT.md` — TR6948 hardware profile (`sun50iw10p1`, Android 10 API 29, `armeabi-v7a`, `968 MB` RAM / `~22 MB` free + `726 MB` swap, `1024x600@160dpi`, `2 MP` camera, WebView `119.0.6045.163`) and v1.6 goals.
  - `run_web_mvp.py` & `src/evaluation/measure_zones.py` — current live `/api/analyze` flow, 6.0 mm scaling, 1-to-1 disk/zone pairing, `COMMON_CLINICAL_CODES`, EasyOCR reliance.
  - `src/evaluation/cross_validation.py` — 36-ray radial Sobel validation (`Δr <= 1.2 mm`) and 7 EUCAST intrinsic resistance rules.
  - `mvp_web/app.js`, `mvp_web/index.html`, `mvp_web/style.css`, `mvp_web/breakpoints_data.js`, `mvp_web/sw.js` — existing PWA UI, `65` drugs / `8` groups / `23` aliases, `@media (max-width: 600px)` gap, Google Fonts CDN link, `blob:` download pattern.
  - `configs/dataset.yaml` & `STATE.md` (ADR-005) — 3 canonical YOLO11n-seg classes (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`).
- **External / Ecosystem Research (MEDIUM confidence, verified across multiple docs):**
  - ONNX Runtime Web WASM offline configuration (`wasmPaths`, `numThreads = 1` without `crossOriginIsolated` / `SharedArrayBuffer`): [onnxruntime.ai](https://onnxruntime.ai/docs/tutorials/web/) & community implementation reports.
  - Android `WebViewAssetLoader` (`application/wasm` MIME type), `WebChromeClient.onShowFileChooser` + `FileProvider`, `DownloadListener` + `@JavascriptInterface` `MediaStore` for `blob:` downloads, and Chromium Renderer PID profiling (`adb shell dumpsys meminfo <pid>`, `chrome://inspect`): [developer.android.com](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader), [developer.android.com/topic/performance/memory](https://developer.android.com/topic/performance/memory), Chromium Android WebView `SharedArrayBuffer` constraints.
  - YOLO11-seg ONNX dual-tensor output decoding (`output0` + `[1, 32, H/4, W/4]` prototypes, linear combination + sigmoid + crop): Ultralytics / HuggingFace / ONNX Runtime Web segmentation guides.
  - Kirby-Bauer manual assignment & Human-in-the-Loop UX benchmarks: AntibiogramJ (`Alonso et al.`, open-source disk diffusion reading tool).

---
*Feature research for: DeepHalo v1.6 Edge Device Demo (TR6948)*  
*Researched: 2026-11-24*

# Architecture Research

**Domain:** On-Device Edge AI Medical Imaging & Offline Android WebView Wrapper (DeepHalo / ADLMS v1.6 — TR6948 Edge Device Demo)
**Researched:** 2026-11-24
**Confidence:** HIGH (codebase integration points directly verified; ONNX Runtime Web, Ultralytics YOLO11-seg, and AndroidX `WebViewAssetLoader` behaviors verified against official documentation)

---

## Standard Architecture

### System Overview

The v1.6 architecture extends the existing DeepHalo dual-hybrid system (`run_web_mvp.py` + `mvp_web/`) with a **single-source web frontend** capable of running in two seamless inference modes:
1. **Desktop Live Mode (`run_web_mvp.py`):** Calls `POST /api/analyze` -> Python `YOLO11n-seg` (`best.pt`) + 36-ray Sobel + EasyOCR.
2. **On-Device Offline Edge Mode (`mvp_web/` + Android APK):** Runs `onnxruntime-web` (WASM, single-thread) directly inside Android System WebView `119` served via `WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/`), replacing EasyOCR with 1-tap manual antibiotic selection against the synchronized EUCAST v16.1 breakpoint table.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 OFFLINE TRAINING & EXPORT PIPELINE (PC / Build)              │
├──────────────────────────────────────────────────────────────────────────────┤
│  data/Antibiogram_demo/Train_yolo (20 plates, 3 classes)                     │
│       │                                                                      │
│       ▼                                                                      │
│  src/models/train_yolo.py  ──► results/yolo11n_microbiology/weights/best.pt  │
│       │                                                                      │
│       ▼                                                                      │
│  src/models/export_model.py (--imgsz 320|416, opset=17, INT8/FP16)           │
│       ├──► models/exports/yolo11n-seg-edge.onnx + model_meta.json            │
│       └──► scripts/sync_edge_assets.py ──► mvp_web/models/ + android/assets/ │
│                                                                              │
│  src/evaluation/eucast_breakpoints.py                                        │
│       ├──► configs/eucast_v16_1_breakpoints.json (canonical JSON)            │
│       └──► mvp_web/breakpoints_data.js (zero-fetch JS mirror)                │
└───────────────────────────────────────┬──────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┴──────────────────────────────┐
         ▼ (Desktop / Dev)                                             ▼ (TR6948 Offline APK)
┌──────────────────────────────┐                       ┌──────────────────────────────────────┐
│      run_web_mvp.py          │                       │  Android Wrapper (android/, minSdk 29)│
│  HTTP :8000 + /api/analyze   │                       │  WebView 119 + WebViewAssetLoader    │
│  (PyTorch + EasyOCR + Sobel) │                       │  https://appassets.androidplatform.  │
└──────────────┬───────────────┘                       │  net/assets/  (+ MIME & FileProvider)│
               │                                       └──────────────────┬───────────────────┘
               └──────────────────────────┬───────────────────────────────┘
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     SHARED WEB FRONTEND (mvp_web/)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  app.js (UI, Canvas, Sticky Caliper, EUCAST/CLSI, FHIR R4)                   │
│       │                                                                      │
│       ▼                                                                      │
│  inference/inference_router.js  [Mode Switch: 'backend' vs 'edge-wasm']      │
│       ├── backend  ──► fetch('/api/analyze')                                 │
│       └── edge-wasm ──► inference/edge_detector.js (ort.InferenceSession)    │
│                              ├── Letterbox Canvas -> Float32 NCHW [1,3,S,S]  │
│                              ├── WASM Single-Thread (numThreads=1)           │
│                              ├── inference/yolo_seg_decode.js                │
│                              │     ├── NMS on output0 [1, 39, N]             │
│                              │     ├── ROI Crop x Proto output1 [1,32,S/4,S/4]│
│                              │     ├── 6.0 mm Fiducial Scale & 1:1 Pairing   │
│                              │     └── Optional 36-ray JS Sobel Check        │
│                              └── Manual Drug Picker (window.ADLMS_BREAKPOINTS)│
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Status | Responsibility | Implementation |
|-----------|--------|----------------|----------------|
| `src/models/train_yolo.py` | **MODIFIED** | Train `YOLO11n-seg` on `configs/dataset.yaml` (`3` classes) with configurable `--imgsz` (`320` or `416` for edge) | Ultralytics `YOLO("yolo11n-seg.pt").train(...)` |
| `src/models/export_model.py` | **MODIFIED** | Export `best.pt` to compact static-shape ONNX (`opset=17`, `dynamic=False`, `nms=False`), apply weight-only INT8 / FP16 quantization, emit `model_meta.json` | Ultralytics `model.export(format="onnx")` + `onnxruntime.quantization` |
| `scripts/sync_edge_assets.py` | **NEW** | Stage ONNX model + `onnxruntime-web` WASM/JS binaries + `mvp_web/` into `android/app/src/main/assets/web/` | Python CLI asset-sync script |
| `mvp_web/inference/inference_router.js` | **NEW** | Probe runtime environment (`appassets.androidplatform.net` vs `localhost:8000` `/api/health`) and route `analyzePlate()` to either `POST /api/analyze` or `edge_detector.js` | Vanilla ES module returning unified detection JSON |
| `mvp_web/inference/edge_detector.js` | **NEW** | Configure `ort.env.wasm` (`numThreads=1`, `wasmPaths`, SIMD probe/toggle), hold singleton `ort.InferenceSession`, run letterbox preprocessing & tensor lifecycle | `onnxruntime-web` WASM runtime wrapper |
| `mvp_web/inference/yolo_seg_decode.js` | **NEW** | Decode `output0` (`[1, 39, N]`) + `output1` (`[1, 32, Pm, Pm]`), run class-aware NMS, crop-before-sigmoid mask reconstruction, 6.0 mm calibration, and disk-zone pairing | Pure JS `Float32Array` math + optional JS 36-ray Sobel |
| `mvp_web/app.js` & `mvp_web/index.html` | **MODIFIED** | Integrate `inference_router.js`, expose mode status badge / manual override toggle, add 1-tap antibiotic code selector in `#caliper` (replacing EasyOCR on edge), skip `sw.js` inside APK | Vanilla JS ES2022 + HTML5 |
| `mvp_web/vendor/ort/` | **NEW** | Self-hosted `onnxruntime-web` JS + `.wasm` binaries (offline zero-CDN bundle) | Copied from pinned `onnxruntime-web/dist/` |
| `mvp_web/models/` | **NEW** | Staged edge ONNX model (`yolo11n-seg-edge.onnx`) and `model_meta.json` | Copied by `export_model.py` / `sync_edge_assets.py` |
| `android/` | **NEW** | Minimal native Kotlin Android APK shell (`minSdk 29`, `armeabi-v7a`) wrapping `mvp_web/` via `WebViewAssetLoader` + `FileProvider` camera chooser | Android Gradle project (`androidx.webkit`) |
| `run_web_mvp.py` | **EXISTING (unchanged)** | Serves `mvp_web/` on `:8000` and handles `GET /api/health` + `POST /api/analyze` | Python `ThreadingMixIn` HTTP server |

---

## Recommended Project Structure

```
ADLMS/
├── configs/
│   ├── dataset.yaml                        # [EXISTING] 3 classes: 0:antibiotic_disk, 1:inhibition_zone, 2:inner_colony
│   └── eucast_v16_1_breakpoints.json       # [EXISTING] Canonical EUCAST v16.1 + CLSI M100 JSON
├── src/
│   ├── models/
│   │   ├── train_yolo.py                   # [MODIFIED] Add --imgsz (320/416/640) & edge-friendly defaults
│   │   └── export_model.py                 # [MODIFIED] Static ONNX export + INT8/FP16 quantization + model_meta.json
│   └── evaluation/
│       ├── eucast_breakpoints.py           # [EXISTING] Generates both JSON & mvp_web/breakpoints_data.js
│       └── measure_zones.py                # [EXISTING] Reference Python schema for unified JSON output
├── scripts/
│   ├── build_mvp_plates.py                 # [EXISTING]
│   └── sync_edge_assets.py                 # [NEW] Stages mvp_web/ + ORT binaries + .onnx into android/.../assets/
├── mvp_web/
│   ├── index.html                          # [MODIFIED] Add mode chip + manual drug selector in #caliper + load ort/module
│   ├── app.js                              # [MODIFIED] Use inference_router.js, manual drug picker, APK SW guard
│   ├── style.css                           # [MODIFIED] Compact styling for mode badge & drug selector
│   ├── breakpoints_data.js                 # [EXISTING] Synced from configs/eucast_v16_1_breakpoints.json
│   ├── sw.js                               # [MODIFIED] Exclude .onnx/.wasm heavy binaries or bypass inside APK
│   ├── vendor/
│   │   └── ort/                            # [NEW] Self-hosted onnxruntime-web JS + .wasm (no CDN)
│   ├── models/
│   │   ├── yolo11n-seg-edge.onnx           # [NEW] Staged quantized ONNX artifact (320 or 416)
│   │   └── model_meta.json                 # [NEW] { imgsz, classes, confThresh, iouThresh, quantType }
│   └── inference/
│       ├── inference_router.js             # [NEW] Mode switch: 'backend' (/api/analyze) <-> 'edge-wasm'
│       ├── edge_detector.js                # [NEW] Letterbox preprocess + ort.InferenceSession singleton
│       └── yolo_seg_decode.js              # [NEW] output0/output1 decode + NMS + ROI mask + 6.0mm calibration
└── android/                                # [NEW] Minimal offline WebView wrapper APK (TR6948)
    ├── build.gradle.kts
    ├── settings.gradle.kts
    └── app/
        ├── build.gradle.kts                # minSdk=29, targetSdk=34, abiFilters("armeabi-v7a"), noCompress onnx/wasm
        └── src/main/
            ├── AndroidManifest.xml         # CAMERA permission, largeHeap="true", FileProvider
            ├── res/xml/file_paths.xml      # FileProvider external-files-path for camera captures
            ├── java/cl/adlms/deephalo/
            │   └── MainActivity.kt         # WebViewAssetLoader + MIME overrides + onShowFileChooser
            └── assets/
                └── web/                    # Synced mirror of mvp_web/ via scripts/sync_edge_assets.py
```

### Structure Rationale

- **Keeping `mvp_web/` as the Single Source of Truth:** Desktop (`run_web_mvp.py`), PWA, and Android APK all run the exact same `mvp_web/` codebase. `android/app/src/main/assets/web/` is treated strictly as a build artifact populated by `scripts/sync_edge_assets.py`, never hand-edited.
- **Isolating ONNX/WASM logic in `mvp_web/inference/`:** `app.js` already owns 1,152 lines of Canvas rendering, gesture zoom/pan, caliper editing, and HL7 FHIR R4 serialization. Putting tensor prep, ORT session management, and YOLO11-seg mask decoding into `mvp_web/inference/` keeps `app.js` clean and allows lazy-loading `onnxruntime-web` only when edge mode is active.
- **No Native JNI / C++ in `android/`:** Because `onnxruntime-web` executes inside Android System WebView 119's V8/WASM engine, `android/` remains a ~150-line Kotlin wrapper with zero NDK/C++ build complexity while still targeting `armeabi-v7a`.

---

## Architectural Patterns

### Pattern 1: Unified Inference Router & Schema Parity

**What:** Abstract the difference between `run_web_mvp.py` (`POST /api/analyze`) and on-device `onnxruntime-web` behind a single `analyzePlateImage(imageElOrFile, options)` contract in `mvp_web/inference/inference_router.js` that emits the exact JSON shape already consumed by `loadUpload()` in `mvp_web/app.js`.
**When to use:** Always — preserves zero-regression compatibility with desktop `run_web_mvp.py` while enabling 100% offline execution on TR6948.
**Trade-offs:** Slightly constrains the JS decoder to compute the same normalized fields (`x, y, w, h, hx, hy, diam_mm, zone_contour`), which is beneficial because `buildDiscsFromPlateData()` and `buildFhir()` require zero branching downstream.

**Example:**
```javascript
// mvp_web/inference/inference_router.js
export async function detectRuntimeMode() {
  const isApkOrigin = location.hostname === 'appassets.androidplatform.net';
  if (isApkOrigin) return 'edge-wasm';

  const override = new URLSearchParams(location.search).get('mode')
    || localStorage.getItem('adlms_inference_mode');
  if (override === 'edge-wasm' || override === 'backend') return override;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 600);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const info = await res.json();
      if (info.model_exists) return 'backend';
    }
  } catch {}
  return 'edge-wasm';
}
```

### Pattern 2: Memory-Bounded YOLO11n-seg Browser Decoder (ROI-Crop-Before-Sigmoid)

**What:** Export YOLO11n-seg at `imgsz = 320` (or `416`) with static shapes (`dynamic=False`, `nms=False`). In JS, filter `output0` (`[1, 39, N]`) and run NMS **first**, then reconstruct masks **only** for the surviving `K` detections (`~10–25` objects) inside each detection's bounding box in prototype-mask space (`80×80` at `320 px` or `104×104` at `416 px`).
**When to use:** Mandatory for 968 MB RAM / ~22 MB free RAM devices like TR6948.
**Trade-offs:** Avoids allocating `K × 320 × 320` float buffers; requires mapping bounding box coordinates `[x1, y1, x2, y2]` cleanly to proto grid `[0..Pm-1]` (`scale = 0.25`) before sigmoid and area summation.

**Tensor & Math Specification:**
- **Input tensor:** `images` — `float32`, shape `[1, 3, S, S]`, RGB `[0.0 .. 1.0]`, letterboxed with pad value `114 / 255`.
- **Output 0 (`output0`):** `float32`, shape `[1, 4 + nc + 32, N]`:
  - `nc = 3` (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`) -> `4 + 3 + 32 = 39` channels.
  - `N = (S/8)^2 + (S/16)^2 + (S/32)^2`: `N = 2100` for `S = 320`; `N = 3549` for `S = 416`.
  - Channel layout per anchor `a`: `[cx, cy, w, h, cls0, cls1, cls2, coeff0..coeff31]`.
- **Output 1 (`output1`):** `float32`, shape `[1, 32, S/4, S/4]` (`[1, 32, 80, 80]` for `S = 320`; `[1, 32, 104, 104]` for `S = 416`).
- **Equivalent diameter & contour:**
  - Inside proto box `[px1..px2, py1..py2]`, count pixels where `sigmoid(dot(coeffs, proto[:, py, px])) > 0.5` -> `area_proto`.
  - Convert to original image pixels: `area_orig = area_proto * (4 / letterboxScale)^2`; `diam_px = 2 * Math.sqrt(area_orig / Math.PI)`.
  - Sample boundary perimeter (36 radial rays from mask centroid inside the binary ROI mask) to produce compact `zone_contour` `[[x_norm, y_norm], ...]` without needing a full-resolution polygonizer like OpenCV `findContours`.
- **Explicit Tensor Disposal:** Call `.dispose()` on input and output `ort.Tensor` instances immediately after copying typed arrays to prevent WASM heap growth across repeated captures.

### Pattern 3: Offline `WebViewAssetLoader` + MIME Override + `noCompress`

**What:** Host `mvp_web/` from Android APK `assets/web/` using `androidx.webkit.WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/`, paired with a `WebViewClientCompat` that forces `application/wasm` on `.wasm` and `application/javascript` on `.mjs`/`.js`, and `noCompress` in Gradle for `.onnx` and `.wasm`.
**When to use:** Always for offline WASM + ES module WebView apps on Android 10 (API 29)+.
**Trade-offs:** Adds ~100 lines of Kotlin + `androidx.webkit` dependency, completely eliminating `file://` CORS failures, `SharedArrayBuffer` dependency errors, and double-decompression RAM spikes.

**Example (`MainActivity.kt` key interception):**
```kotlin
val assetLoader = WebViewAssetLoader.Builder()
    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
    .build()

webView.webViewClient = object : WebViewClientCompat() {
    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val resp = assetLoader.shouldInterceptRequest(request.url) ?: return null
        val path = request.url.path ?: ""
        when {
            path.endsWith(".wasm", ignoreCase = true) -> {
                resp.mimeType = "application/wasm"
                resp.encoding = null
            }
            path.endsWith(".mjs", ignoreCase = true) || path.endsWith(".js", ignoreCase = true) -> {
                resp.mimeType = "application/javascript"
            }
            path.endsWith(".onnx", ignoreCase = true) -> {
                resp.mimeType = "application/octet-stream"
            }
        }
        return resp
    }
}
// Entry point:
webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
```

### Pattern 4: Manual Drug Assignment Replacing EasyOCR via Synchronized EUCAST v16.1 Bundle

**What:** Skip EasyOCR completely in `edge-wasm` mode. Assign placeholder labels `UNK-01..UNK-NN` to detected disks, and add a fast 1-tap antibiotic selector inside the `#caliper` card in `mvp_web/index.html` + `app.js` populated from `window.ADLMS_BREAKPOINTS` (generated from `configs/eucast_v16_1_breakpoints.json` by `src/evaluation/eucast_breakpoints.py`).
**When to use:** On constrained edge devices (TR6948) where running an additional text-detection + CRNN OCR model in WASM would blow the RAM and `< 2.0 s` latency budgets.
**Trade-offs:** Technologist taps each detected disk row (or taps a quick-assign chip filtered to the active organism's clinical formulary) before pressing `Validar y enviar a LIS`; all EUCAST v16.1 breakpoints, ATU warnings, intrinsic resistance rules, and HL7 FHIR R4 coding (`LOINC`/`ATC`) work identically once the disk code is chosen.

---

## Data Flow

### 1. Training & Export Artifact Flow

```
data/Antibiogram_demo/Train_yolo/*.{jpg,txt} + configs/dataset.yaml
   │
   ▼  src/models/train_yolo.py (--imgsz 320|416, --epochs 100)
results/yolo11n_microbiology/weights/best.pt
   │
   ▼  src/models/export_model.py (--weights ... --imgsz 320|416 --quant int8|fp16)
models/exports/yolo11n-seg-edge.onnx  +  models/exports/model_meta.json
   │
   ▼  scripts/sync_edge_assets.py
   ├──► mvp_web/models/yolo11n-seg-edge.onnx + model_meta.json
   └──► android/app/src/main/assets/web/  (full mvp_web/ mirror + vendor/ort/)
```

### 2. On-Device Browser Inference Flow (TR6948 Offline APK)

```
User taps "Capturar" -> WebChromeClient.onShowFileChooser -> FileProvider camera/gallery URI
   │
   ▼  loadUpload(file) in mvp_web/app.js
inference_router.js (mode === 'edge-wasm')
   │
   ▼  edge_detector.js
1. Draw image onto offscreen letterbox canvas (320×320 or 416×416, pad #727272)
2. Convert RGBA Uint8 -> Float32Array [1, 3, S, S] (RGB / 255.0)
3. ort.InferenceSession.run({ images: inputTensor })  [WASM, numThreads=1]
   │
   ▼  yolo_seg_decode.js
4. Parse output0 [1, 39, N] -> conf filter (>=0.40) -> class-aware NMS (IoU 0.45)
5. For each surviving disk (cls 0) & zone (cls 1):
   - Crop output1 [1, 32, S/4, S/4] to det bbox -> linear combo + sigmoid > 0.5
   - Compute centroid (cx, cy), equivalent diameter diam_px, & 36-ray contour
   - Un-letterbox to normalized [0..1] image coords
6. 6.0 mm fiducial calibration: scale = median(disk.diam_px) / 6.0
7. Greedy 1-to-1 disk <-> zone pairing -> diam_mm (clamped to 6.0 mm if <= 6.48 mm)
8. Return unified JSON payload -> state.discs[] (code='UNK' initially)
   │
   ▼  mvp_web/app.js (existing clinical engine)
9. Technologist taps disk -> picks drug from EUCAST v16.1 formulary -> evaluate(disc)
10. Live S/I/R + Intrinsic Resistance + ATU + Sticky Caliper + HL7 FHIR R4 Bundle
```

### 3. Desktop Fallback Flow (`run_web_mvp.py`)

```
User opens http://localhost:8000/index.html
   │
   ▼  detectRuntimeMode() -> GET /api/health returns 200 { model_exists: true }
mode === 'backend'
   │
   ▼  loadUpload(file) -> POST /api/analyze (base64 image)
Python InferenceEngine -> YOLO11n-seg (best.pt) + EasyOCR + 36-ray Sobel + EUCAST v16.1
   │
   ▼  JSON response -> identical buildDiscsFromPlateData() path in mvp_web/app.js
```
*(Developers can also force `?mode=edge-wasm` in desktop Chrome to validate WASM inference parity without building an APK.)*

---

## Scaling & Hardware Envelope Considerations (TR6948 Constraints)

This milestone targets a single physical edge demo unit rather than multi-tenant cloud scale. The bottleneck is **volatile RAM & 32-bit CPU budget on TR6948**:

| Resource | TR6948 Baseline (`adb` captured) | Target Budget for v1.6 | First Bottleneck & Mitigation |
|----------|----------------------------------|------------------------|-------------------------------|
| **RAM** | `968 MB` total (`~22 MB` free + `726 MB` swap) | `< 120 MB` peak WebView delta | **First bottleneck:** Decoding full camera image + keeping multiple canvases + ORT session + compressed APK asset buffers. **Mitigation:** Downscale camera JPEG via `createImageBitmap` / offscreen canvas to `<= 1024 px` for display, use `320×320` ONNX input, set `android:largeHeap="true"`, `noCompress "onnx", "wasm"`, and call `tensor.dispose()` immediately after inference. |
| **CPU / WASM** | `armeabi-v7a` (`armv8l` kernel), WebView `119` | `<= 2.0 s` end-to-end (`<= 1.2 s` inference target) | **Second bottleneck:** Multi-threaded WASM fails without COOP/COEP headers and increases thread memory; non-SIMD WASM is ~2–3× slower on `640×640`. **Mitigation:** Pin `ort.env.wasm.numThreads = 1`; benchmark `imgsz=320` vs `416`; test `ort.env.wasm.simd` feature-probe (`false` fallback guaranteed if needed). |
| **Model Artifact Size** | Constrained flash & RAM | `<= 5 MB` `.onnx` file | **Third bottleneck:** FP32 `yolo11n-seg.onnx` (~11.5 MB) inflates APK & RAM load time. **Mitigation:** Weight-only INT8 (`quantize_dynamic`) or FP16 export (~3.2–5.5 MB). |

---

## Anti-Patterns

### Anti-Pattern 1: Loading `mvp_web/` via `file:///android_asset/`
**What people do:** Call `webView.loadUrl("file:///android_asset/web/index.html")`.
**Why it's wrong:** Chromium blocks ES module imports (`type="module"`), `fetch('./models/yolo11n-seg-edge.onnx')`, and `WebAssembly.instantiateStreaming()` on `file://` origins due to strict Same-Origin / CORS rules.
**Do this instead:** Serve assets via `WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/web/` with explicit `.wasm` (`application/wasm`) and `.mjs`/`.js` (`application/javascript`) MIME overrides.

### Anti-Pattern 2: Enabling `ort.env.wasm.numThreads > 1` Without COOP/COEP
**What people do:** Leave `numThreads` at default (`navigator.hardwareConcurrency`) in `onnxruntime-web`.
**Why it's wrong:** `WebViewAssetLoader` does not emit `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp` by default, so `SharedArrayBuffer` is `undefined`, causing worker-spawn errors or silent slow fallback and higher memory usage on 968 MB RAM.
**Do this instead:** Explicitly set `ort.env.wasm.numThreads = 1` before calling `ort.InferenceSession.create(...)`.

### Anti-Pattern 3: Running Sigmoid & Upscaling on Full `160×160` or `640×640` Masks for All 8,400 Anchors
**What people do:** Multiply `[N, 32] × [32, Pm*Pm]` before NMS or upscale every mask to original image resolution before computing area.
**Why it's wrong:** Causes multi-second GC pauses and OOM crashes inside 32-bit Android WebView.
**Do this instead:** Filter by confidence and run NMS **first** on `output0`, then compute the 32-channel dot product + sigmoid **only** inside each surviving detection's bounding box in proto space (`80×80` or `104×104`), and compute equivalent diameter directly from scaled proto-pixel area.

### Anti-Pattern 4: Compressing `.onnx` and `.wasm` Inside the APK or Caching Them in `sw.js`
**What people do:** Rely on default Android `aapt` compression and let `sw.js` pre-cache/runtime-cache multi-MB `.onnx`/`.wasm` files inside APK WebView.
**Why it's wrong:** Forces Android to decompress assets into RAM buffers and duplicates 10+ MB into WebView CacheStorage on a device with ~22 MB free RAM.
**Do this instead:** Add `noCompress += listOf("onnx", "wasm")` in `android/app/build.gradle.kts`, and disable `sw.js` registration when `location.hostname === 'appassets.androidplatform.net'`.

### Anti-Pattern 5: Porting EasyOCR / Tesseract.js to Browser WASM
**What people do:** Attempt to run OCR in JS/WASM on rotated 6 mm disk crops to keep automatic drug code labeling offline.
**Why it's wrong:** Adds 15–30 MB of OCR weights, 8–16× multi-angle inference latency per disk (easily >10 seconds on TR6948), and still requires technologist verification.
**Do this instead:** In `edge-wasm` mode, emit `UNK` disk codes and provide a 1-tap clinical formulary selector in `#caliper` backed by the already-loaded `window.ADLMS_BREAKPOINTS` catalog.

---

## Integration Points

### External Services & Native Bridges

| Boundary | Integration Pattern | Notes |
|----------|---------------------|-------|
| `WebView` <-> `APK Assets` | `WebViewAssetLoader` + `AssetsPathHandler` at `https://appassets.androidplatform.net/assets/web/` | Must override `.wasm` -> `application/wasm` and `.mjs`/`.js` -> `application/javascript` in `shouldInterceptRequest` |
| `<input type="file">` <-> `TR6948 Camera/Gallery` | `WebChromeClient.onShowFileChooser` + `FileProvider` (`content://` URI) | Must call `filePathCallback?.onReceiveValue(null)` on cancel; request `CAMERA` runtime permission for API 29 |
| `onnxruntime-web` <-> `mvp_web/vendor/ort/` | Self-hosted `ort.wasm.min.js` + `.wasm` files via `ort.env.wasm.wasmPaths` | Zero CDN requests; pin exact filenames from installed `onnxruntime-web` `dist/` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `export_model.py` -> `mvp_web/models/` | Build-time file artifact (`yolo11n-seg-edge.onnx` + `model_meta.json`) | `model_meta.json` prevents JS letterbox `imgsz` drift if training size changes between `320` and `416` |
| `eucast_breakpoints.py` -> `mvp_web/breakpoints_data.js` | Build-time JS mirror of `configs/eucast_v16_1_breakpoints.json` | Single source of truth; no extra async `fetch()` required at runtime |
| `mvp_web/app.js` <-> `inference_router.js` | Async JS call `analyzePlate(fileOrImg, opts)` | Returns exact schema of `POST /api/analyze` (`scale_px_per_mm`, `detections[]`, `inference_ms`) |
| `inference_router.js` <-> `run_web_mvp.py` | HTTP `GET /api/health`, `POST /api/analyze` | 600 ms health probe timeout; falls back cleanly to `edge-wasm` when offline |

---

## Suggested Build Order (Dependency-Driven)

1. **Step 1 — Train & Benchmark Edge `YOLO11n-seg` (`src/models/train_yolo.py`):**
   - Train on `data/Antibiogram_demo/Train_yolo` (`configs/dataset.yaml`) at `imgsz=320` (and compare `416`) -> produce `results/yolo11n_microbiology/weights/best.pt`.
   - *Why first:* Validates that 3-class segmentation (`antibiotic_disk`, `inhibition_zone`, `inner_colony`) reaches acceptable disk/zone accuracy at edge resolution before writing export/JS decoding around fixed tensor dimensions.
2. **Step 2 — Export & Quantize Compact ONNX (`src/models/export_model.py`):**
   - Export static-shape ONNX (`opset=17`, `dynamic=False`, `nms=False`), quantize (INT8 dynamic / FP16), verify `output0` (`[1, 39, N]`) & `output1` (`[1, 32, S/4, S/4]`) shapes with Python `onnxruntime` against `best.pt`, and emit `model_meta.json`.
   - *Why second:* Locks exact tensor contract, quantization accuracy delta, and artifact byte size (`<= 5 MB`).
3. **Step 3 — Browser Inference & Decoder Modules (`mvp_web/inference/` + `mvp_web/vendor/ort/`):**
   - Implement `edge_detector.js`, `yolo_seg_decode.js`, and `inference_router.js`. Validate in desktop Chrome with `?mode=edge-wasm` against Python `measure_zones.py` outputs on `mvp_web/sample_plates/` (`MAE <= 0.50 mm` parity check).
   - *Why third:* Fast iteration on desktop DevTools before introducing Android APK packaging latency.
4. **Step 4 — `mvp_web/` Mode Switch & Manual Drug Selector (`app.js`, `index.html`, `sw.js`):**
   - Wire `inference_router.js` into `loadUpload()`, add mode badge/toggle, add 1-tap drug code selector in `#caliper` backed by `window.ADLMS_BREAKPOINTS`, and guard `sw.js` for APK origin.
5. **Step 5 — Offline Android APK Wrapper & Sync Script (`android/` + `scripts/sync_edge_assets.py`):**
   - Build minimal Kotlin `WebViewAssetLoader` + `FileProvider` APK (`minSdk 29`, `armeabi-v7a`, `largeHeap`, `noCompress`), sync `mvp_web/`, install via `adb` onto TR6948, and benchmark cold-start, peak `dumpsys meminfo`, and end-to-end latency.

---

## Sources

- Existing repository files inspected directly: `run_web_mvp.py`, `src/models/train_yolo.py`, `src/models/export_model.py`, `src/evaluation/measure_zones.py`, `src/evaluation/eucast_breakpoints.py`, `src/evaluation/cross_validation.py`, `configs/dataset.yaml`, `configs/eucast_v16_1_breakpoints.json`, `mvp_web/app.js`, `mvp_web/index.html`, `mvp_web/sw.js`, `mvp_web/breakpoints_data.js`, `scripts/build_mvp_plates.py`, `.planning/PROJECT.md`.
- **ONNX Runtime Web WASM configuration & v1.19/1.20 binary layout:** [onnxruntime.ai](https://onnxruntime.ai/docs/api/js/interfaces/Env.WebAssemblyFlags.html) (Medium confidence, cross-verified via WebSearch).
- **Ultralytics YOLO11-seg ONNX output tensor specification (`output0` / `output1`):** [docs.ultralytics.com](https://docs.ultralytics.com/modes/export/) (Medium confidence, cross-verified via WebSearch).
- **AndroidX `WebViewAssetLoader`, MIME-type overrides, and API 29 `FileProvider` `onShowFileChooser`:** [developer.android.com](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader) (Medium confidence, cross-verified via WebSearch).

---
*Architecture research for: DeepHalo / ADLMS v1.6 — Edge Device Demo (TR6948)*
*Researched: 2026-11-24*

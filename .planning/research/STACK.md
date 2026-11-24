# Stack Research

**Domain:** On-device edge AI inference (`YOLO11n-seg` -> ONNX -> `onnxruntime-web` WASM) + offline Android WebView wrapper APK for constrained 32-bit ARMv7 hardware (`TR6948`)
**Researched:** 2026-11-24
**Confidence:** MEDIUM-HIGH (exact package registries, device `adb` telemetry, and repo files verified directly; WebView 119 WASM execution speed/RAM on TR6948 requires on-device Phase-level benchmark)

---

## Hardware & Host Reality Check (Observed Baseline)

Before selecting versions, two verified facts constrain every stack choice for v1.6:

1. **Target Device (`TR6948`, verified via `adb` on 2026-11-24):**
   - **CPU / ABI:** 4-core ARM Cortex-A53 (`ARMv8 Processor rev 4 (v8l)`, `neon`, `vfpv4`), running **32-bit `armeabi-v7a`** on Android 10 (API 29).
   - **Memory Pressure:** `968 MB` total RAM (`947 MB` used, **`21 MB` free** at idle) + `726 MB` swap (`87 MB` used, `638 MB` free, zram).
   - **WebView Runtime:** `com.google.android.webview` **`119.0.6045.163`** (`targetSdkVersion: 34`), with **`Multiprocess enabled: false`**. Because WebView runs **in-process**, Android ART, WebView V8, Canvas bitmaps, and ONNX Runtime WASM linear memory all share **one 32-bit process address space**.
2. **Windows Build Host (`c:\Users\cmelian\Git\ADLMS`):**
   - **Present:** `node v26.13.1`, `npm 12.0.2`, Python `3.14.2` (`venv/` has `torch 2.14.0+cpu`, `onnxruntime 1.28.0`, `opencv-python 5.0.0.93`) + Python `3.11.9`, and `adb.exe` (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`, currently attached to `TR6948`).
   - **Missing (must install for v1.6):** `ultralytics`, `torchvision`, `onnx`, `onnxslim` in Python; **JDK 17**, **Android SDK `platforms;android-34`**, **`build-tools;34.0.0`**, and **Gradle** (full Android Studio IDE is **not** required).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **`onnxruntime-web`** | **`1.18.0`** (pinned) | Client-side ONNX inference via WASM in `mvp_web/` | **`1.18.0` is the last release shipping non-SIMD `ort-wasm.wasm` (`9.31 MB`) and single-thread SIMD `ort-wasm-simd.wasm` (`10.10 MB`) plus UMD `ort.wasm.min.js` (`0.14 MB`).** Releases `1.19.0`–`1.31.1` dropped `ort-wasm.wasm` and only ship `ort-wasm-simd-threaded.wasm` (`14.16 MB` in `1.31.1`) via ESM `.mjs` loaders. Pinning `1.18.0` guarantees zero-bundler `<script>` integration, strict `numThreads = 1` + `simd = false` fallback compatibility (even on Chrome 81), and a smaller WASM binary on 32-bit RAM. |
| **`ultralytics`** | **`8.4.218`** (or `>=8.3.0,<9`) | Training `YOLO11n-seg` (`best.pt`) and static FP32 ONNX export | Native YOLO11-seg training & ONNX export with `opset=17`, `simplify=True`, `dynamic=False`. Latest PyPI release (`8.4.218`) works with `torch` + `onnxslim`. |
| **`onnx` + `onnxslim` + `onnxruntime`** | `onnx==1.23.2`, `onnxslim==0.1.99`, `onnxruntime>=1.28.0` | Graph simplification & **QDQ INT8** static quantization | Required because Ultralytics' `int8=True` export flag does **not** perform ONNX Runtime INT8 calibration on `.onnx` exports. Using `onnxruntime.quantization.quantize_static` with `QuantFormat.QDQ` + `op_types_to_quantize=['Conv']` shrinks `yolo11n-seg` from ~10–11 MB (FP32) to ~3.2 MB without emitting `ConvInteger` nodes that crash WASM. |
| **Android WebView Wrapper (`androidx.webkit:webkit`)** | **`1.18.0`** | Offline `WebViewAssetLoader` serving `mvp_web/` + `.wasm`/`.onnx` | Serves local `assets/www/` over virtual `https://appassets.androidplatform.net/assets/` (Secure Context, zero `file://` CORS failures). Plain `android.app.Activity` + `androidx.webkit:webkit:1.18.0` (avoiding heavy AppCompat/Jetpack Compose dependencies) minimizes APK size and ART heap overhead on 968 MB RAM. |
| **Android Gradle Plugin (AGP) + Gradle** | **AGP `8.7.3` + Gradle `8.9`** (or AGP `9.5.1` + Gradle `9.6.0`) | Headless CLI APK build (`assembleDebug` / `assembleRelease`) | AGP `8.7.3` + Gradle `8.9` is rock-solid on JDK 17 with `compileSdk 34` / `minSdk 29` / `targetSdk 34` and zero AGP 9.x breaking Variant API changes. |
| **Pure-JS YOLO11-seg Decoder (`mvp_web/edge_inference.js`)** | ES2022 (zero deps) | Letterbox preprocess, NMS, `output0`/`output1` mask decode, 6.0 mm scale | Avoids loading `opencv.js` (~8–10 MB extra WASM + separate heap) inside the 32-bit single-process WebView. `Float32Array` + `OffscreenCanvas`/`HTMLCanvasElement` decodes `[1, 32, 80, 80]` prototype masks in <20 ms. |

### Supporting Libraries & Configuration Choices

| Library / Setting | Version / Value | Purpose | When to Use |
|-------------------|-----------------|---------|-------------|
| **Model Input Resolution** | **`imgsz=320`** (default) / `416` (stretch) | Controls RAM, latency, and disk pixel resolution | Use **`320`** as baseline: `2100` anchors and `[1, 32, 80, 80]` masks (4× fewer MACs & tensor bytes than `640`, ~19 px per 6.0 mm disk on full Petri plate). Test `416` (`3549` anchors, `[1, 32, 104, 104]`) only if `320` fails the `MAE <= 0.50 mm` target. |
| **Quantization Strategy** | **Static `QDQ` INT8 on `Conv` only** (+ FP32 baseline artifact) | Cuts ONNX download/memory ~3× while preserving mask accuracy | Export `320` FP32 first as ground truth; then run `quantize_static` (`QuantFormat.QDQ`, `per_channel=True`, `op_types_to_quantize=['Conv']`) keeping `Resize`, `Sigmoid`, and prototype dot-product layers in FP32. |
| **ORT Web Session Flags** | `numThreads=1`, `simd=false`, `enableMemPattern=false`, `enableCpuMemArena=false` | Prevents 32-bit OOM (`RangeError: WebAssembly.memory()`) | Mandatory for TR6948's `Multiprocess enabled: false` WebView. Disabling `MemPattern` and `CpuMemArena` stops ORT from pre-reserving large contiguous arenas in fragmented 32-bit virtual address space. |
| **`aapt` `noCompress` (`build.gradle`)** | `noCompress += listOf("onnx", "wasm", "jpg")` | Zero-copy `AssetManager` streaming | Prevents Android from compressing `.onnx` / `.wasm` inside the APK, allowing `AssetManager.open()` without decompressing multi-MB binaries in RAM. |
| **Manual Drug Selector UI (`mvp_web/app.js`)** | Vanilla ES2022 `<select>` using `window.ADLMS_BREAKPOINTS` | Replaces Python EasyOCR on-device | `breakpoints_data.js` already bundles EUCAST v16.1 + CLSI M100 + intrinsic resistance rules offline. Add per-disk code dropdown in the caliper panel (`UNK` default -> technologist picks `CIP`, `CTX`, `MEM`, etc.). |
| **Upload Bitmap Cap (`mvp_web/app.js`)** | `MAX_CANVAS_DIM = 1024` | Caps 3 RGBA display canvases (`canvas`, `base`, `heat`) | TR6948's back camera is `1600x1200` (2 MP). Currently `app.js` sets `state.N = Math.max(W, H)`; capping `N <= 1024` saves ~19 MB of uncompressed RGBA canvas RAM on-device. |

### Development Tools (Windows Host Setup)

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **Eclipse Temurin JDK** | **17 LTS** (`EclipseAdoptium.Temurin.17.JDK`) | Required runtime for AGP 8.x/9.x & Gradle | Not currently installed. Install via `winget install EclipseAdoptium.Temurin.17.JDK` and set `JAVA_HOME`. |
| **Android SDK Command-Line Tools** | `commandlinetools-win` (latest) + `platforms;android-34` + `build-tools;34.0.0` | Headless APK compilation | Place under `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\` alongside existing `platform-tools\adb.exe`; run `sdkmanager` to install `platforms;android-34` and `build-tools;34.0.0`. |
| **Gradle Wrapper** | `8.9` (`gradle-8.9-bin.zip`) | Reproducible APK builds without global Gradle install | Checked into `android/` (`gradlew.bat`), bootstrapped via `gradle wrapper` or downloaded wrapper jar. |
| **Python Export Env** | Python `3.11.9` (recommended) or `venv` Python `3.14.2` | Train `YOLO11n-seg` & export/quantize ONNX | `torchvision` on PyPI lacks a `cp314` wheel (only available on `download.pytorch.org/whl/cpu` as `0.29.1+cpu`), whereas local Python `3.11.9` has universal PyPI wheel support for `ultralytics`, `torch`, `torchvision`, `onnx`, `onnxslim`, `onnxruntime`. |

---

## Installation

### 1. Python Training & ONNX Quantization Toolchain (Windows)

```powershell
# Option A (Recommended clean env on installed Python 3.11.9 to avoid cp314 wheel friction):
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" -m venv .venv-export
.\.venv-export\Scripts\python.exe -m pip install --upgrade pip
.\.venv-export\Scripts\python.exe -m pip install --extra-index-url https://download.pytorch.org/whl/cpu `
  torch torchvision ultralytics==8.4.218 onnx==1.23.2 onnxslim==0.1.99 onnxruntime>=1.28.0

# Option B (Install missing packages into existing Python 3.14 venv using PyTorch CPU index):
.\venv\Scripts\python.exe -m pip install --extra-index-url https://download.pytorch.org/whl/cpu `
  torchvision ultralytics==8.4.218 onnx==1.23.2 onnxslim==0.1.99
```

### 2. Vendor `onnxruntime-web@1.18.0` into `mvp_web/vendor/ort/`

```powershell
# Fetch pinned 1.18.0 assets locally (zero bundler / offline APK ready)
mkdir mvp_web\vendor\ort -Force
npm pack onnxruntime-web@1.18.0
# Extract dist/ort.wasm.min.js, dist/ort-wasm.wasm, and optionally dist/ort-wasm-simd.wasm
# into mvp_web/vendor/ort/ (remove tarball afterwards)
```

### 3. Minimal Headless Android Build Toolchain (Windows)

```powershell
# 1. Install JDK 17
winget install --id EclipseAdoptium.Temurin.17.JDK -e

# 2. Download commandlinetools-win from developer.android.com/studio#command-line-tools-only
#    Extract so sdkmanager.bat lives at:
#    %LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat

# 3. Install compileSdk 34 & build-tools (platform-tools/adb.exe is already present)
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" `
  "platforms;android-34" "build-tools;34.0.0"

# 4. Build & deploy to USB-attached TR6948
cd android
.\gradlew.bat assembleDebug
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **`onnxruntime-web@1.18.0`** (`ort-wasm.wasm`, non-SIMD, 1 thread) | **`onnxruntime-web@1.31.1`** (`ort-wasm-simd-threaded.wasm`) | Only if targeting 64-bit WebViews (API 30+, Chrome 91+) where WASM SIMD (`v128`) and `SharedArrayBuffer` COOP/COEP headers are guaranteed and non-SIMD fallback is not needed. |
| **`onnxruntime-web` WASM (single-thread)** | **WebGL / WebGPU EP** in `onnxruntime-web` | WebGL EP is officially **deprecated** in ORT Web and fails on many 3D/Resize/Grid ops used by YOLO11-seg; WebGPU is unavailable in Android WebView 119 on Mali/PowerVR/Allwinner Android 10 drivers. |
| **Android WebView Wrapper + `onnxruntime-web`** | **Native Kotlin/JNI `onnxruntime-android` (`libonnxruntime.so`)** | Use native `onnxruntime-android` (`com.microsoft.onnxruntime:onnxruntime-android`) **only if** WebView WASM inference exceeds the `2.0 s` latency budget or hits 32-bit OOM in benchmarking; native JNI adds a JSBridge layer and splits the `mvp_web/` codebase, whereas WebView wrapper keeps 100% shared JS logic. |
| **QDQ Static INT8 (`Conv` only) @ `imgsz=320`** | **FP32 ONNX @ `imgsz=320` or `416`** | Use FP32 (`~10.5 MB` file) if INT8 quantization degrades segmentation mask `MAE > 0.50 mm` on the 20-plate dataset—because `yolo11n-seg` is tiny (~2.8M params), `imgsz=320` FP32 may still fit inside TR6948's memory budget if `enableMemPattern`/`enableCpuMemArena` are disabled. |
| **Pure-JS Canvas + `Float32Array` mask decoder** | **`opencv.js` (~8–10 MB WASM)** | Never needed for v1.6—only Sobel 36-ray validation uses OpenCV in Python, and bounding-box mask decoding + area-based equivalent diameter requires only `Float32Array` math and `CanvasRenderingContext2D`. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`onnxruntime-web >= 1.19.0` (`1.19.2` – `1.31.1`)** | Removed `ort-wasm.wasm` (non-SIMD) and `ort-wasm-simd.wasm` (single-threaded), shipping only `ort-wasm-simd-threaded.wasm` (`14.16 MB` in `1.31.1`) with `.mjs` dynamic loaders. Breaks the explicit non-SIMD requirement. | **`onnxruntime-web@1.18.0`** with `ort.wasm.min.js` + `ort-wasm.wasm` (`9.31 MB`). |
| **`onnxruntime.quantization.quantize_dynamic` (`QOperator`)** | Generates `ConvInteger` / `MatMulInteger` nodes that lack WASM kernel implementations in `onnxruntime-web`, throwing `Could not find an implementation for ConvInteger` at session creation. | **`quantize_static` with `QuantFormat.QDQ`** and `op_types_to_quantize=['Conv']`. |
| **`model.export(format="onnx", half=True)` (FP16)** | WASM CPU backend has no native FP16 execution kernels, causing export/load errors or expensive FP16→FP32 cast overhead on ARMv7. | **Static FP32 ONNX** (`half=False`) or **QDQ INT8**. |
| **`imgsz=640` on TR6948** | `8400` anchors + `[1, 32, 160, 160]` prototypes multiply activation RAM and MACs by 4× vs `320`, risking multi-second stalls or OOM in WebView's single 32-bit process. | **`imgsz=320`** (or **`416`** max if precision requires). |
| **`file:///android_asset/` URLs in Android WebView** | Blocked by CORS for `fetch('model.onnx')` and `fetch('ort-wasm.wasm')`; lacks Secure Context (`https://`), breaking `WebAssembly.instantiateStreaming` and Service Workers. | **`androidx.webkit.WebViewAssetLoader`** (`https://appassets.androidplatform.net/assets/`) with explicit `application/wasm` MIME override in `shouldInterceptRequest`. |
| **EasyOCR / Tesseract.js on TR6948** | EasyOCR is Python-only; Tesseract.js + English traineddata adds >15 MB WASM/model overhead and 5–10 s latency on 8 rotated disk crops inside 21 MB free RAM. | **Manual antibiotic `<select>`** in `mvp_web/app.js` backed by existing `breakpoints_data.js`. |
| **Multi-threaded WASM (`numThreads > 1`)** | Requires COOP/COEP headers and spawns Web Workers that duplicate WASM memory/heaps inside TR6948's 32-bit process (`Multiprocess enabled: false`). | **`ort.env.wasm.numThreads = 1`**. |

---

## Stack Patterns by Variant

**If `imgsz=320` QDQ INT8 achieves `MAE <= 0.50 mm` and `< 2.0 s` on TR6948:**
- Ship `yolo11n-seg-320-qdq.onnx` (~3.2 MB) with `ort-wasm.wasm` (`simd = false`, `numThreads = 1`).
- Keeps total APK size under ~18 MB (`mvp_web/` + `ort-wasm.wasm` + `model.onnx` + `webkit:1.18.0`).

**If `imgsz=320` QDQ INT8 loses halo edge precision (`MAE > 0.50 mm`):**
- Fall back first to **`imgsz=320` FP32** (~10.5 MB) or **`imgsz=416` QDQ INT8** before changing runtime architecture.
- Because `TR6948` WebView `119.0.6045.163` runs on V8 with ARMv7 NEON (`vfpv4`), you can also enable `ort-wasm-simd.wasm` (`ort.env.wasm.simd = true` gated behind `WebAssembly.validate(...)` SIMD probe) to recover 2–3× inference speed without changing the `1.18.0` package.

**If WebView WASM hits 32-bit OOM or exceeds 3 s latency even at `imgsz=320`:**
- Swap only the inference provider behind the WebView `JavascriptInterface` to native `com.microsoft.onnxruntime:onnxruntime-android` (`armeabi-v7a` AAR, bypassing WebView V8 linear memory limits) while keeping all `mvp_web/` UI, calibration, and EUCAST logic intact.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `onnxruntime-web@1.18.0` | `ort-wasm.wasm@1.18.0` / `ort-wasm-simd.wasm@1.18.0` | JS glue and `.wasm` binaries **must** match exact patch version `1.18.0`. |
| `ultralytics@8.4.218` | `onnx==1.23.2` + `onnxslim==0.1.99` | Export with `opset=17, simplify=True, dynamic=False` for full ORT `1.18.0` WASM op compatibility. |
| `onnxruntime@1.28.0+` (Python quantizer) | `onnxruntime-web@1.18.0` | Use `QuantFormat.QDQ` + `opset=17`; do **not** emit opset > 19 or `QOperator` (`ConvInteger`) nodes. |
| `AGP 8.7.3` | `Gradle 8.9` + `JDK 17` + `compileSdk 34` | `androidx.webkit:webkit:1.18.0` works cleanly with `minSdk 29`, `targetSdk 34`. |
| `mvp_web/sw.js` | `WebViewAssetLoader` (`https://appassets.androidplatform.net`) | Remember to add `ort.wasm.min.js`, `ort-wasm.wasm`, `edge_inference.js`, and `.onnx` model to `PRECACHE_ASSETS` (or exclude `.onnx`/`.wasm` from SW cache inside APK so they aren't duplicated in Cache Storage on 13 GB `/data`). |

---

## Sources

- **npm / jsDelivr package registry inspection (`onnxruntime-web@1.18.0` vs `1.19.2`, `1.20.1`, `1.31.1`)** — Verified exact `dist/` file lists and byte sizes (`ort-wasm.wasm` present in `1.18.0`, removed in `>=1.19.0`). *(HIGH — direct registry output)*
- **PyPI package registry inspection (`ultralytics==8.4.218`, `onnx==1.23.2`, `onnxslim==0.1.99`, `onnxruntime==1.32.0`, `torchvision`)** — Verified versions and Python `3.14` vs `3.11` Windows wheel availability. *(HIGH — direct registry output)*
- **ADB Device Inspection (`TR6948`, `R01236I38026001913`)** — Verified `cat /proc/cpuinfo` (ARMv8 `v8l`, `neon`, `vfpv4`), `free -m` (`968 MB` RAM, `21 MB` free, `726 MB` swap), `dumpsys webviewupdate` (`com.google.android.webview 119.0.6045.163`, `targetSdkVersion: 34`, `Multiprocess enabled: false`). *(HIGH — direct hardware telemetry)*
- **Repository Code Audit** — Verified `src/models/train_yolo.py`, `src/models/export_model.py`, `src/evaluation/measure_zones.py`, `configs/dataset.yaml`, `mvp_web/app.js`, `mvp_web/sw.js`, `requirements.txt`. *(HIGH — direct codebase read)*
- **ONNX Runtime Web / Ultralytics / AndroidX WebKit Documentation (via WebSearch, verified)** — Verified `ort.env.wasm` flags, `enableMemPattern`/`enableCpuMemArena` 32-bit OOM mitigation, `QuantFormat.QDQ` vs `ConvInteger`, `WebViewAssetLoader` `.wasm` MIME override, `androidx.webkit:webkit:1.18.0`, AGP/Gradle/JDK 17 matrix. *(MEDIUM — `classify-confidence --provider websearch --verified`)*

---
*Stack research for: ADLMS / DeepHalo v1.6 Edge Device Demo (TR6948)*
*Researched: 2026-11-24*

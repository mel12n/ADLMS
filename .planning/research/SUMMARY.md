# Project Research Summary

**Project:** DeepHalo / ADLMS v1.6 — Edge Device Demo (TR6948)
**Domain:** Offline On-Device Clinical Microbiology AST (`YOLO11n-seg` -> ONNX -> `onnxruntime-web` WASM + Android 10 WebView 119 Wrapper APK)
**Researched:** 2026-11-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

DeepHalo v1.6 adapts an existing hybrid Kirby-Bauer disk diffusion web application (`mvp_web/` + Python `run_web_mvp.py`) into a 100% offline, zero-PC edge AI system running on a resource-constrained Android 10 tablet (`TR6948`: 4-core Cortex-A53 running 32-bit `armeabi-v7a`, `968 MB` total RAM with only `~21–22 MB` free + `726 MB` zram swap at idle, `1024x600@160dpi` display, `2 MP` camera, and System WebView `119.0.6045.163` in **single-process mode**). Experts build this class of edge imaging demo by keeping the existing vanilla web UI as a single source of truth, swapping the server inference call behind a thin router for client-side single-threaded WASM inference (`onnxruntime-web`), replacing heavy OCR dependencies with a fast manual formulary selector tied to the bundled EUCAST v16.1 / CLSI M100 engine, and packaging the static bundle inside a minimal Kotlin `WebViewAssetLoader` shell with zero native C++/JNI bridges.

The recommended approach pairs **pinned `onnxruntime-web@1.18.0`** (the final release retaining non-SIMD `ort-wasm.wasm` fallback alongside single-thread `ort-wasm-simd.wasm` and UMD `ort.wasm.min.js`) with a compact **`YOLO11n-seg` static ONNX export (`opset=17`, `imgsz=320` or `416`)** and a pure-JS post-processor (`Float32Array` ROI-crop-before-sigmoid + 4x bilinear logit upsampling + 6.0 mm fiducial scaling). Crucially, three existing repository gaps must be fixed before deployment: `configs/dataset.yaml` currently leaks `val == train` on 20 plates, `src/models/export_model.py` calls `int8=True` without a calibration dataset, and `mvp_web/style.css` defaults to a desktop `868px`-tall twin-phone frame that clips on `1024x600`.

The primary operational risk is **32-bit native OOM termination (`lmkd`)** inside WebView 119's single-process address space (`Multiprocess enabled: false`), where ART, V8, three display canvases, and WASM linear memory share `< 2–3 GB` virtual space on `968 MB` physical RAM. This is mitigated through strict memory hygiene (`enableCpuMemArena: false`, `enableMemPattern: false`, `numThreads = 1`, explicit `tensor.dispose()`, `<= 1024 px` canvas cap, `noCompress` for `.onnx`/`.wasm`, disabling `sw.js` inside the APK, and mandatory `onRenderProcessGone()` recovery), plus empirical on-device benchmarking on `TR6948` comparing `320` vs `416` and `FP32` vs calibrated `QDQ INT8` (never `FP16` or `ConvInteger` dynamic quantization).

## Key Findings

### Recommended Stack

The Windows build host already provides `node v26.13.1`, Python `3.14.2` (`venv/`), Python `3.11.9`, and `adb.exe` attached to `TR6948`, but still requires `ultralytics`, `torchvision`, `onnx`, `onnxslim`, **JDK 17**, **Android SDK `platforms;android-34` + `build-tools;34.0.0`**, and **Gradle `8.9`**. Full Android Studio IDE is unnecessary. See [STACK.md](./STACK.md) for exact install commands and version matrix.

**Core technologies:**
- **`onnxruntime-web@1.18.0` (pinned):** Client-side WASM inference — last release shipping non-SIMD `ort-wasm.wasm` (`9.31 MB`) + single-thread `ort-wasm-simd.wasm` (`10.10 MB`) + UMD `ort.wasm.min.js`; versions `>= 1.19.0` removed scalar non-SIMD binaries.
- **`ultralytics@8.4.218` + `onnx==1.23.2` + `onnxslim==0.1.99` + `onnxruntime>=1.28.0`:** Training and static ONNX export/quantization — exports `opset=17`, `dynamic=False`, `nms=False` and supports calibrated `QuantFormat.QDQ` static INT8 (`op_types_to_quantize=['Conv']`) without emitting unsupported `ConvInteger` nodes or slow `FP16` ops.
- **Pure-JS YOLO11-seg Decoder (`mvp_web/inference/`):** ES2022 `Float32Array` + Canvas math — eliminates `opencv.js` (`~8–10 MB` extra WASM heap) while decoding `output0`/`output1` masks, 6.0 mm median calibration, and optional 36-ray Sobel geometry.
- **Minimal Android Shell (`androidx.webkit:webkit:1.18.0`, AGP `8.7.3`, Gradle `8.9`, JDK `17`):** Offline `WebViewAssetLoader` wrapper (`minSdk 29`, `targetSdk 34`, `armeabi-v7a`) — serves local `assets/` on `https://appassets.androidplatform.net/` with `.wasm` MIME override and zero AppCompat/Compose bloat.

### Expected Features

`mvp_web/` already implements the optical inspector (CLAHE, Grad-CAM overlay, pinch/zoom), sticky caliper (`±0.5 mm`, audit log), EUCAST v16.1 / CLSI M100 engine (`65` drugs, `8` groups, `7` intrinsic resistance rules), and FHIR R4 / CSV builder. v1.6 delivers the offline edge delta summarized in [FEATURES.md](./FEATURES.md).

**Must have (table stakes):**
- **Offline `onnxruntime-web` WASM Engine** (`numThreads=1`, local `.wasm`, non-SIMD fallback) replacing `POST /api/analyze`.
- **In-Browser YOLO11n-seg Post-Processing** (conf filter, class-split NMS, ROI-cropped prototype mask decoding with sub-proto bilinear upsampling, 6.0 mm median disk fiducial calibration, 1:1 disk-zone pairing).
- **Minimal Android WebView 119 APK (`WebViewAssetLoader`)** with `application/wasm` MIME override and `noCompress` for `.onnx`/`.wasm`.
- **Native File Picker & 2 MP Camera Capture (`onShowFileChooser` + `FileProvider`)** supporting both camera capture and local gallery fallback with cancel-safe callback cleanup.
- **Manual Antibiotic Drug Selection UI** replacing EasyOCR (`UNK` -> 65-drug searchable/grouped EUCAST picker + `autoAdvance`).
- **`1024x600@160dpi` Landscape Responsive Layout & Offline Assets** eliminating twin-phone clipping and external Google Fonts CDN calls.
- **WebView-Compatible FHIR JSON / CSV Export (`DownloadListener` + `MediaStore`)** replacing broken `blob:` URL downloads.
- **On-Device Latency & Peak RAM Telemetry** (JS stage timers + `adb shell dumpsys meminfo <renderer_pid>` script).

**Should have (competitive demo polish — add after P1 RAM gate passes):**
- **One-Tap Formulary Panel Presets + Quick-Assign Chips** (*Enterobacterales*, *Staphylococcus*) cutting multi-disk assignment under 10 s.
- **In-Browser 36-Ray Radial Sobel Geometric Cross-Validation** (`Δr <= 1.2 mm` clinical safety badge on downscaled RGBA buffer).
- **`inner_colony` (Class 2) Resistant-Subpopulation Alert Badge** surfacing EUCAST heteroresistance warnings inside paired zones.
- **Bundled Offline Demo Plates + Live ORT-Web Re-Run Trigger** ensuring zero-fail live defense fallback.

**Defer (v2+ / Milestone 2):**
- On-device tiny disk-patch CNN drug classifier; multi-threaded WASM / NNAPI / LiteRT on 64-bit `>= 2 GB` RAM hardware; live hospital HL7 FHIR R4 HTTP server sync. **Explicitly banned in v1.6:** EasyOCR/Tesseract.js in browser, `numThreads > 1` (`SharedArrayBuffer` unsupported in WebView), 30 FPS live `getUserMedia` YOLO streaming, React/Capacitor rewrite, and `640x640` FP32 ONNX.

### Architecture Approach

The system uses a **Single-Source Frontend + Dual-Mode Inference Router** ([ARCHITECTURE.md](./ARCHITECTURE.md)). `mvp_web/` remains unchanged as the canonical UI for both desktop (`run_web_mvp.py`) and the Android APK (`android/app/src/main/assets/web/` synced via `scripts/sync_edge_assets.py`). An `inference_router.js` module checks the origin (`appassets.androidplatform.net` -> `'edge-wasm'`; otherwise probes `/api/health` with a 600 ms timeout) and returns the exact normalized JSON contract expected by `loadUpload()` in `mvp_web/app.js`, keeping EUCAST evaluation, sticky caliper, and FHIR R4 export completely shared.

**Major components:**
1. **Training & Export Pipeline (`src/models/train_yolo.py`, `export_model.py`, `scripts/sync_edge_assets.py`)** — Trains `YOLO11n-seg` on a leak-free split, exports static `opset=17` FP32 & calibrated QDQ INT8 `.onnx` + `model_meta.json`, and stages assets into `mvp_web/` and `android/`.
2. **Browser Edge Inference Layer (`mvp_web/inference/{inference_router,edge_detector,yolo_seg_decode}.js`)** — Manages singleton `ort.InferenceSession`, letterbox preprocessing, `tensor.dispose()`, pre-NMS filtering, ROI-cropped prototype decoding, 6.0 mm scaling, and manual `UNK` emission.
3. **Clinical UI & Offline Adaptation (`mvp_web/{index.html,style.css,app.js,sw.js}`)** — Adds `1024x600` landscape split layout, manual drug picker + presets inside `#caliper`, canvas downscale cap, offline fonts, and APK `sw.js` bypass.
4. **Minimal Android WebView Wrapper (`android/.../MainActivity.kt`)** — ~150-line Kotlin shell hosting `WebViewAssetLoader`, MIME overrides, `onRenderProcessGone`, `onShowFileChooser` + `FileProvider`, and `MediaStore` export bridge.

### Critical Pitfalls

Full details and recovery playbooks are documented in [PITFALLS.md](./PITFALLS.md):

1. **32-Bit WebView Renderer `lmkd` OOM Kills (`968 MB` RAM, `~22 MB` free)** — Native WASM, V8, and `<canvas>` buffers bypass Android's Java heap (`largeHeap` does not save the renderer). Avoid by capping `imgsz` at `320`/`416`, setting `enableCpuMemArena: false` & `enableMemPattern: false`, calling `tensor.dispose()`, capping display canvas `N <= 640–1024`, disabling `sw.js` in APK, and overriding `onRenderProcessGone()`.
2. **Dataset Leakage (`val == train` on 20 Plates) & Broken `export_model.py`** — `configs/dataset.yaml` validates on `Train_yolo`, and `export_model.py` calls `int8=True` without `data=`. Fix with a stratified `16/4` (or 5-fold) split, `freeze=10`, `copy_paste=0.2`, `degrees=180`, `close_mosaic=15`, and real plate calibration for QDQ INT8.
3. **FP16 / Unfused INT8 Traps & `320` Fiducial Quantization Error** — Never deploy FP16 to WASM CPU (2–5× slower); never use `quantize_dynamic` (`ConvInteger` crashes ORT-Web). At `imgsz=320` (`80x80` proto), a `6.0 mm` disk is only `~4.3 proto px` wide, risking `±1.4–2.8 mm` scaling error unless the JS decoder **bilinearly upsamples (4×) the cropped logit patch before thresholding** and validates `MAE <= 0.50 mm` against `416`.
4. **JS Mask Decoding Bugs (`output0` stride, sigmoid order, `4:3` letterbox)** — `YOLO11n-seg` outputs channels-first `output0 [1, 39, N]` and `output1 [1, 32, S/4, S/4]`. Run NMS first, compute `dot(coeffs, proto)` inside the proto bbox on raw logits *before* `sigmoid()`, crop outside-bbox after sigmoid, and unpad `(x - dw) / scale` for `1600x1200` (`4:3`) camera photos.
5. **Android 10 WebView Integration Traps & `1024x600` Layout Clipping** — `file://` blocks `.wasm`/`.onnx` fetch; `WebViewAssetLoader` mis-guesses `.wasm` MIME on API 29; `SharedArrayBuffer` never works in WebView (`numThreads=1` invariant); `onShowFileChooser` locks permanently if `null` isn't returned on cancel; and `mvp_web/style.css` renders clipped `868px`-tall twin phones at `1024x600` unless an explicit tablet/APK media rule is added.

## Implications for Roadmap

Based on dependencies and risk containment across all four research streams, a **5-phase** structure is recommended:

### Phase 1: Leak-Free Edge Model Training & Calibrated ONNX Export
**Rationale:** Model input resolution (`320` vs `416`) and quantization format (`FP32` vs calibrated `QDQ INT8`) lock the tensor contract, binary footprint, and clinical accuracy baseline (`MAE <= 0.50 mm`) before any JS decoder or Android packaging is written.
**Delivers:** Stratified train/val split in `configs/dataset.yaml`; updated `train_yolo.py` (`freeze=10`, rotation/copy-paste augmentations, `100+` epochs); fixed `export_model.py` producing static `opset=17` `FP32` and calibrated `QDQ INT8` (`Conv` only) `.onnx` artifacts at `imgsz=320` and `416` + `model_meta.json`; Python-level ONNX vs `best.pt` parity report.
**Addresses:** Compact `YOLO11n-seg` ONNX model artifact (Table Stakes).
**Avoids:** `val == train` 20-plate overfitting (Pitfall 6), broken `int8=True` export & `FP16`/`ConvInteger` traps (Pitfall 3), `320` vs `416` blind spots (Pitfall 8).

### Phase 2: In-Browser `onnxruntime-web` Inference & Geometry Engine
**Rationale:** Iterating on WASM loading, tensor lifecycle, and `Float32Array` mask math in desktop Chrome DevTools (`?mode=edge-wasm`) against Python `measure_zones.py` golden outputs is 10× faster than debugging inside an APK.
**Delivers:** Vendored `onnxruntime-web@1.18.0` in `mvp_web/vendor/ort/`; `mvp_web/inference/{inference_router,edge_detector,yolo_seg_decode}.js`; pre-NMS filtering, ROI-cropped prototype decoding with 4× bilinear logit upsampling, `4:3` letterbox unpadding, 6.0 mm median fiducial calibration, 1:1 pairing, and `enableCpuMemArena: false` / `tensor.dispose()`; golden parity test (`< 0.2 mm` delta vs Python on both `1:1` and `4:3` plates).
**Addresses:** Offline `onnxruntime-web` WASM engine & in-browser YOLO11n-seg post-processing (Table Stakes).
**Uses:** `onnxruntime-web@1.18.0`, pure-JS decoder (`STACK.md`).
**Avoids:** `>= 1.19` missing non-SIMD `.wasm` trap (Pitfall 2), JS sigmoid/crop/stride/`4:3` bugs (Pitfall 7), fiducial quantization drift (Pitfall 8).

### Phase 3: Offline Android WebView 119 Wrapper APK & Native Bridges
**Rationale:** With JS inference verified in Chrome, wrap `mvp_web/` in the minimal native Android shell so real WebView 119 (`armeabi-v7a`) constraints—HTTPS asset loading, `.wasm` MIME headers, camera capture, and `MediaStore` file export—can be exercised on `TR6948`.
**Delivers:** Headless build toolchain setup (JDK 17, Android SDK `android-34`, `build-tools;34.0.0`, Gradle `8.9`); `scripts/sync_edge_assets.py`; `android/` Kotlin project (`minSdk 29`, `armeabi-v7a`, `androidx.webkit:webkit:1.18.0`, `noCompress` `.onnx`/`.wasm`, `WebViewAssetLoader` with MIME overrides, `onRenderProcessGone` recovery, `onShowFileChooser` + `FileProvider` camera/gallery with cancel handling, and `DownloadListener` + `MediaStore` FHIR/CSV export).
**Addresses:** Offline APK shell, native camera/gallery picker, WebView-compatible LIS export (Table Stakes).
**Avoids:** `file://` CORS & missing `.wasm` MIME (Pitfall 4), `onShowFileChooser` lockups & `FileUriExposedException` (Pitfall 5), fatal `lmkd` renderer crashes without recovery (Pitfall 1).

### Phase 4: Tablet `1024x600` UX, Manual Drug Formulary & Offline Polish
**Rationale:** Now that end-to-end camera -> ORT-Web -> canvas works inside the APK, adapt the UI for the physical `1024x600@160dpi` screen, eliminate remaining network dependencies, and add the manual drug workflow (plus P2 clinical polish once RAM headroom is clear).
**Delivers:** `1024x600` landscape side-by-side split & `600x1024` portrait CSS (`mvp_web/style.css`); stripped Google Fonts CDN & APK `sw.js` guard; manual antibiotic picker in `#caliper` (`UNK` -> 65 EUCAST/CLSI drugs + `autoAdvance` + optional formulary presets); `MAX_CANVAS_DIM` memory cap (`<= 640–1024 px`); optional P2 JS 36-ray Sobel cross-validation & `inner_colony` alert pill.
**Addresses:** Manual drug selection UI, `1024x600` layout & offline assets, P2 clinical differentiators (Table Stakes + Differentiators).
**Avoids:** Twin-phone layout clipping at `1024x600` (Pitfall 9), high-res canvas OOM spikes (Pitfall 1), EasyOCR bloat (Anti-Feature).

### Phase 5: Physical TR6948 Benchmarking, Telemetry & Parity Sign-Off
**Rationale:** Neither desktop Chrome nor Python estimates can predict exact Cortex-A53 `armeabi-v7a` WebView 119 WASM timing, NEON SIMD stability, or `lmkd` swap pressure. A dedicated on-device verification phase locks the final model variant (`320` vs `416`, `FP32` vs `QDQ INT8`, `simd` vs scalar).
**Delivers:** In-app JS stage latency telemetry badge (`preprocessMs`, `ortInferenceMs`, `postprocessMs`, `totalMs`); `adb` profiling script (`dumpsys meminfo` on WebView Renderer PID + `logcat` `lmkd` watch); Airplane-Mode verification; 10-consecutive-plate stability & matrix benchmark report confirming `<= 2.0 s` inference, `MAE <= 0.50 mm`, and `0` `lmkd` kills.
**Addresses:** On-device latency & peak RAM benchmarking telemetry (Table Stakes).
**Avoids:** "Looks done but isn't" failures (Wi-Fi active, single-run memory blind spot, 32-bit SIMD alignment crashes).

### Phase Ordering Rationale

- **Model -> JS Decoder -> Android Shell -> Tablet UX -> Physical Benchmark** strictly follows the dependency DAG: JS tensor indexing and calibration math depend on frozen ONNX shapes (Phase 1 -> 2); APK bridges and `WebViewAssetLoader` wrap a working edge-mode web bundle (Phase 2 -> 3); tablet responsive UX and formulary presets sit cleanly atop verified camera/WASM ingestion (Phase 3 -> 4); and empirical TR6948 tuning compares candidate artifacts already wired end-to-end (Phase 4 -> 5).
- Splitting Phase 2 (Desktop Chrome `?mode=edge-wasm`) from Phase 3 (Android APK) isolates math/canvas bugs from Android Scoped Storage/MIME/Gradle issues.

### Research Flags

Phases likely needing deeper research/prototyping during planning (`/gsd-plan-phase --research-phase <N>`):
- **Phase 1 (Dataset & Quantization):** Needs a short empirical check of `data/Antibiogram_demo/` (`Valid/` and `Test/` subdirectories) to see if extra labeled/unlabeled plates exist beyond the 20 in `Train_yolo/`, and to verify exact `onnxruntime.quantization.quantize_static` `nodes_to_exclude` for YOLO11-seg's `Segment` head.
- **Phase 5 (TR6948 SIMD & Memory Matrix):** Needs on-device empirical measurement once Phases 1–3 land — specifically testing whether `ort-wasm-simd.wasm` runs crash-free on `TR6948` `armeabi-v7a` WebView 119 and whether `320` vs `416` / `FP32` vs `QDQ INT8` hits the optimal latency/RAM/MAE sweet spot.

Phases with standard, well-documented patterns (can skip deep research-phase):
- **Phase 2 (ORT-Web JS Decoder):** Tensor shapes (`[1, 39, N]`, `[1, 32, S/4, S/4]`), `measure_zones.py` reference math, and `onnxruntime-web@1.18.0` APIs are fully specified in existing code and `STACK.md`/`PITFALLS.md`.
- **Phase 3 (Android WebView 119 Shell):** `WebViewAssetLoader`, `onShowFileChooser` + `FileProvider`, `onRenderProcessGone`, and `MediaStore` exports follow standard Android API 29+ patterns already sketched in `ARCHITECTURE.md`.
- **Phase 4 (`1024x600` CSS & Drug Picker):** Pure CSS/JS work against existing `mvp_web/app.js` and `breakpoints_data.js`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | MEDIUM-HIGH | npm/PyPI versions (`onnxruntime-web@1.18.0`, `ultralytics@8.4.218`, `onnx==1.23.2`), repo Python/Node tooling, and `TR6948` `adb` specs verified directly; actual WebView 119 WASM speed/RSS on `TR6948` awaits Phase 5 benchmark. |
| **Features** | HIGH | Existing `mvp_web/` capabilities, `run_web_mvp.py`, EUCAST v16.1 catalog, and TR6948 screen/camera constraints inspected directly in repo and `PROJECT.md`. |
| **Architecture** | HIGH | Dual-mode router, `YOLO11n-seg` ONNX contracts, `mvp_web/` schema, and `WebViewAssetLoader` boundaries verified directly against repo source and official docs. |
| **Pitfalls** | MEDIUM-HIGH | Critical repo bugs (`val == train`, `export_model.py` `int8=True`, `style.css` `1024x600` clipping) and `TR6948` `Multiprocess enabled: false` / `21 MB` free RAM observed directly; 32-bit ARMv7 SIMD alignment & `lmkd` RSS thresholds derived from official docs and require physical testing. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Actual `TR6948` Inference Latency & Peak Renderer PSS:** Unknown until Phase 5 executes `yolo11n-seg` inside WebView 119 on the USB-attached tablet. *Mitigation:* Export and stage a comparison matrix (`320` vs `416`, `FP32` vs `QDQ INT8`, `simd: true` vs `false`) so tuning requires swapping only `.onnx` / ORT flags, not rewriting code.
- **Additional Plate Data in `data/Antibiogram_demo/`:** `PITFALLS.md` noted only `Train_yolo/` (20 plates) is referenced by `configs/dataset.yaml`; check `Valid/` and `Test/` folders during Phase 1 planning to maximize non-leaking validation coverage.
- **TR6948 2 MP Fixed/Close-Focus Camera Quality:** Real Petri dish close-up sharpness from `TR6948`'s `1600x1200` rear sensor has not been tested on a physical agar plate yet. *Mitigation:* Ensure Phase 3 supports both live camera intent and local gallery picker + bundled `sample_plates/` for deterministic demo fallback.
- **Windows Host Build Dependencies:** JDK 17, Android `cmdline-tools` (`platforms;android-34`, `build-tools;34.0.0`), `ultralytics`, `torchvision`, `onnx`, and `onnxslim` are not yet installed on the build PC and must be provisioned in Phase 1 / Phase 3.

## Sources

### Primary (HIGH confidence)
- **Repository Codebase & Configs** — `PROJECT.md`, `configs/dataset.yaml`, `configs/eucast_v16_1_breakpoints.json`, `src/models/{train_yolo,export_model}.py`, `src/evaluation/{measure_zones,eucast_breakpoints,cross_validation}.py`, `run_web_mvp.py`, `mvp_web/{index.html,style.css,app.js,breakpoints_data.js,sw.js}`.
- **Physical Device Telemetry (`TR6948`, serial `R01236I38026001913`)** — `adb` inspection of `/proc/cpuinfo` (`ARMv8 rev 4 (v8l)`, `neon`, `vfpv4`, 32-bit `armeabi-v7a`), `free -m` (`968 MB` RAM, `21–22 MB` free, `726 MB` swap), `dumpsys webviewupdate` (`com.google.android.webview 119.0.6045.163`, `targetSdkVersion: 34`, `Multiprocess enabled: false`).
- **Package Registries (npm / jsDelivr / PyPI)** — Direct verification of `onnxruntime-web@1.18.0` vs `1.19.2`–`1.31.1` `dist/` layouts and byte sizes; `ultralytics==8.4.218`, `onnx==1.23.2`, `onnxslim==0.1.99`, `onnxruntime>=1.28.0`, and `torchvision` Windows wheel availability.

### Secondary (MEDIUM confidence)
- **ONNX Runtime Web & Quantization Docs** — `ort.env.wasm` flags, `enableCpuMemArena`/`enableMemPattern` OOM mitigation, `QuantFormat.QDQ` vs `ConvInteger` (`QOperator`), FP16 CPU performance warnings ([onnxruntime.ai](https://onnxruntime.ai/docs/)).
- **Android Developers & Chromium WebView Docs** — `WebViewAssetLoader` `.wasm` MIME override, lack of `crossOriginIsolated`/`SharedArrayBuffer` in WebView, `WebViewClient.onRenderProcessGone`, API 29 `FileProvider` `onShowFileChooser`, `MediaStore.Downloads` export ([developer.android.com](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)).
- **Ultralytics YOLO11-seg Export & Clinical AST References** — `[1, 39, N]` + `[1, 32, H/4, W/4]` tensor format, micro-dataset augmentation (`freeze`, `copy_paste`, `close_mosaic`), and AntibiogramJ UX patterns ([docs.ultralytics.com](https://docs.ultralytics.com/modes/export/)).

---
*Research completed: 2026-11-24*
*Ready for roadmap: yes*

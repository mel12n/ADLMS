# Pitfalls Research: Edge Device Demo (TR6948)

**Domain:** On-device YOLO11n-seg + ONNX Runtime Web (WASM) inside an Android 10 WebView 119 APK on 32-bit ~1 GB RAM hardware (`TR6948`)
**Researched:** 2026-11-24
**Confidence:** MEDIUM (verified across official Android/Chromium/ONNX Runtime/Ultralytics docs, issue trackers, and direct inspection of ADLMS repo + `TR6948` `adb` telemetry)

---

## Critical Pitfalls

### Pitfall 1: WebView Renderer Killed by Android `lmkd` (OOM on 32-bit 968 MB RAM)

**What goes wrong:**
On the `TR6948` (`991,852 kB` / `968 MB` total RAM, `~22 MB` free + `726 MB` swap at idle), loading an unoptimized YOLO11n-seg ONNX model (`640x640` FP32 or unfused QDQ) alongside `mvp_web/`'s high-resolution canvases triggers the Linux Low Memory Killer daemon (`lmkd`) to silently kill the WebView's sandboxed renderer process (`SandboxedProcessService`). If `WebViewClient.onRenderProcessGone()` is not overridden and returning `true`, Android crashes the entire host APK immediately.

**Why it happens:**
1. **Native memory invisibility:** Chromium WebView allocates the WASM linear memory heap (`WebAssembly.Memory`), ONNX weights, intermediate activation tensors, V8 heap, and `<canvas>` backing stores in native memory (`malloc`/`jemalloc`), completely outside Android's Dalvik/ART Java heap (`android:largeHeap="true"` does NOT raise the renderer's native memory survival budget).
2. **ORT-Web memory arena hoarding:** By default, `ort.InferenceSession` enables `enableCpuMemArena: true` and `enableMemPattern: true`, pre-reserving and retaining peak intermediate tensor buffers. Combined with `2 MP` (`1600x1200`) camera image decoding plus `mvp_web/app.js`'s three full-size canvases (`base`, `heat`, and `plate-canvas` at `N = 1000`), native RSS balloons past `150–250 MB` and forces heavy zram/eMMC swap thrashing or immediate `lmkd` termination.
3. **640x640 tensor footprint:** At `imgsz=640`, the detection tensor (`[1, 39, 8400]` float32 = `1.31 MB`) and prototype tensor (`[1, 32, 160, 160]` float32 = `3.28 MB`) are small compared to the intermediate backbone/neck feature maps (`2.6x`–`4x` larger activations than `320x320` or `416x416`), plus JS-side `Float32Array` allocations when decoding 10–30 candidate masks.

**How to avoid:**
- Target **`imgsz=416` (or `320`)** instead of `640` for ONNX export (see Pitfall 9 on the `320` vs `416` disk-resolution tradeoff).
- Configure `ort.InferenceSession.create()` for minimal peak RAM on TR6948:
  ```js
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
    enableCpuMemArena: false,
    enableMemPattern: false,
    graphOptimizationLevel: 'all'
  });
  ```
- Explicitly call `tensor.dispose()` on all input/output `ort.Tensor` objects in a `try/finally` block after copying out only the post-NMS winning detections and decoded polygons.
- Downscale camera/uploaded `1600x1200` images in JS before creating `base`/`heat` offscreen canvases (e.g., cap display canvas `N` at `640` or `768` on TR6948 instead of `1000`), and avoid `ort.env.wasm.proxy = true` (worker cloning duplicates large `ArrayBuffer`s).
- In the Android wrapper APK, **mandatory**: override `WebViewClient.onRenderProcessGone(view, detail)`, destroy the dead `WebView`, recreate/reload a clean instance with a user notice, and return `true`.

**Warning signs:**
- White/blank WebView screen mid-inference or app closing with no Java stack trace in `logcat`.
- `logcat` shows `lowmemorykiller: Killing '...' (pid ...)` or `chromium: [ERROR:aw_browser_terminator.cc] Renderer process (...) crash detected (code -1)`.
- `adb shell dumpsys meminfo <pkg>` shows native/sandboxed renderer PSS climbing > 150 MB across repeated plate analyses.

**Phase to address:**
Model Export & Quantization Phase (input size + model footprint) and Android WebView Wrapper + Benchmarking Phases (`enableCpuMemArena: false`, `onRenderProcessGone`, `dumpsys meminfo` gate).

---

### Pitfall 2: `onnxruntime-web` >= 1.19 Removed Non-SIMD / Non-Threaded `.wasm` Files & Requires `.mjs` Glue

**What goes wrong:**
Installing the latest `onnxruntime-web` (`1.19.x` / `1.20.x`) and assuming you can load a single-threaded non-SIMD `ort-wasm.wasm` fallback—or copying only `.wasm` files without `.mjs` wrappers into Android `assets/`—causes immediate `404` / `Failed to load module script` / `CompileError` crashes at session initialization.

**Why it happens:**
1. Starting with **`onnxruntime-web@1.19.0`**, Microsoft **intentionally removed** `ort-wasm.wasm` (scalar non-SIMD) and `ort-wasm-simd.wasm` (non-threaded) from `dist/`, shipping only `ort-wasm-simd-threaded.wasm` and its mandatory companion ES module `ort-wasm-simd-threaded.mjs` (plus `.jsep.*` variants).
2. By default, `onnxruntime-web` attempts to fetch missing `.wasm` / `.mjs` assets from jsDelivr CDN—which fails completely on an offline USB-attached TR6948.
3. On `TR6948`, the OS is 32-bit `armeabi-v7a` (`armv8l` kernel with NEON/vfpv4) running **Android System WebView 119.0.6045.163** (note: pre-installed Chrome 81 lacks modern WASM SIMD, but WebView 119 enabled WASM SIMD since Chromium 91 and maps `v128` to ARM NEON). However, 32-bit ARM V8 has historically shown occasional 128-bit vector alignment crashes under heavy WASM SIMD workloads, so a scalar fallback option matters if SIMD misbehaves on `sun50iw10p1`.

**How to avoid:**
- **Make an explicit version choice up front:**
  - **Option A (Recommended first, verify on TR6948):** Use `onnxruntime-web@1.19+` / `1.20+` with `ort-wasm-simd-threaded.wasm` + `ort-wasm-simd-threaded.mjs` bundled locally, and force `ort.env.wasm.numThreads = 1; ort.env.wasm.simd = true;` so NEON SIMD accelerates convolutions without requiring `SharedArrayBuffer`.
  - **Option B (Guaranteed scalar non-SIMD fallback):** Pin **`onnxruntime-web@1.18.0`**, which is the last release still shipping `ort-wasm.wasm` (non-SIMD) and `ort-wasm-simd.wasm`. Use `wasm-feature-detect` or a startup smoke test to fall back to `ort-wasm.wasm` if WebView 119 hits a 32-bit SIMD alignment crash.
- Always bundle **both `.wasm` and `.mjs`** files from `node_modules/onnxruntime-web/dist/` into `assets/` and configure `ort.env.wasm.wasmPaths = './ort/';` (trailing slash) before calling `InferenceSession.create()`.

**Warning signs:**
- Network requests to `cdn.jsdelivr.net` in WebView devtools when offline.
- Console errors: `Failed to fetch dynamically imported module ... ort-wasm-simd-threaded.mjs` or `no available backend found`.
- Uncaught `WebAssembly.RuntimeError: memory access out of bounds` or native `SIGBUS` (alignment fault) in `logcat` on 32-bit ARMv7.

**Phase to address:**
In-Browser ORT-Web Integration Phase (pin ORT-Web version + bundle `.wasm`/`.mjs` offline) and Physical TR6948 Smoke Test Phase (verify SIMD vs non-SIMD stability on WebView 119 `armeabi-v7a`).

---

### Pitfall 3: FP16 and Unfused INT8 QDQ Performance Traps in ORT-Web WASM

**What goes wrong:**
Developers export `yolo11n-seg` to **FP16** ONNX expecting half the RAM and 2x speed, OR export **INT8 QDQ** (`QuantizeLinear`/`DeQuantizeLinear`) assuming WASM executes INT8 natively like TFLite on ARM NEON. In ONNX Runtime Web's WASM CPU provider:
- **FP16 is slower than FP32** (often 2x–5x slower) because standard WASM CPUs lack native FP16 arithmetic and emulate or upcast every op to FP32, while still paying cast overhead.
- **Unfused INT8 QDQ** (`QuantizeLinear` -> `Conv` -> `DeQuantizeLinear`) can fail graph fusion in WASM, forcing redundant pack/unpack conversions, materializing duplicated float + int8 intermediate tensors (spiking peak RAM), and dispatching slow fallback `ConvInteger` kernels—especially if SIMD is disabled.
- Additionally, **a bug already exists in `src/models/export_model.py` (lines 18–23):** it calls `model.export(format='onnx', int8=True, dynamic=False, imgsz=640)` with **no `data=` calibration dataset**. In Ultralytics, ONNX INT8 static quantization requires `quantize=8` (or `onnxruntime.quantization.quantize_static` with a `CalibrationDataReader` fed with microbiology agar plates); passing `int8=True` without `data=` either throws/skips quantization or calibrates with wrong/missing range stats, corrupting mask logits.

**How to avoid:**
- **Never deploy FP16 ONNX to the ORT-Web WASM backend.** Compare only **FP32** vs **calibrated INT8** on the actual `TR6948` WebView 119.
- If using INT8 ONNX for ORT-Web WASM:
  1. Calibrate explicitly against real microbiology plate images (using `data="configs/dataset.yaml"` or a custom `CalibrationDataReader` with letterboxed `imgsz` plate images).
  2. Leave sensitive regression/prototype mask heads unquantized if zone-edge MAE degrades (`nodes_to_exclude` for final `Detect`/`Segment` conv/proto heads).
  3. Benchmark **FP32 (`~11 MB` weights) vs INT8 QOperator vs INT8 QDQ** directly on TR6948 for both latency (`TRT <= 2.0 s` target) and peak RSS—on `yolo11n-seg` (~2.9M params), FP32 at `416x416` often runs faster and uses less peak arena churn in WASM than unfused QDQ if INT8 kernels aren't fused.
- Fix `src/models/export_model.py` to accept `--imgsz` (default `416`), `--data`, and explicit ONNX INT8 static calibration instead of hardcoding `imgsz=640, int8=True`.

**Warning signs:**
- `export_model.py` emits a `11 MB` FP32 `.onnx` file silently even though `int8_quantize=True` was passed, OR outputs an uncalibrated `.onnx` whose predicted masks are blank/saturated.
- Single-frame WASM inference takes `> 5–10 s` in FP16 or QDQ mode on TR6948.

**Phase to address:**
ONNX Export & Quantization Phase (fix `export_model.py`, produce calibrated INT8 + FP32 variants at `320`/`416`) and Benchmarking Phase (measure actual TR6948 WASM latency & MAE).

---

### Pitfall 4: Android WebView `file://` Blocking, Missing `.wasm` MIME Type, and `SharedArrayBuffer` Myth

**What goes wrong:**
1. Loading `mvp_web/index.html` via `file:///android_asset/index.html` fails silently or throws `CORS` / `TypeError: Failed to fetch` when loading `.onnx`, `.wasm`, `.mjs` ES modules, or `sw.js`, and leaves `navigator.mediaDevices` `undefined` because `file://` is **not a secure context**.
2. Switching to `androidx.webkit.WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/index.html`) fixes CORS and secure context, **but `WebViewAssetLoader` uses `URLConnection.guessContentTypeFromName()`, which often fails to map `.wasm` on Android 10 (API 29)**—returning `application/octet-stream` or `null` and causing `WebAssembly.instantiateStreaming()` to reject.
3. Injecting `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers inside `WebViewAssetLoader` **still leaves `window.crossOriginIsolated === false` and `SharedArrayBuffer === undefined`**, because Android WebView's Chromium architecture does not support cross-origin isolation. Multi-threaded WASM (`numThreads > 1`) can never work inside Android WebView.

**How to avoid:**
- Serve all offline web + model assets exclusively via `androidx.webkit.WebViewAssetLoader` on `https://appassets.androidplatform.net/assets/`.
- Override `shouldInterceptRequest` in `WebViewClientCompat` to force exact MIME types for `.wasm` (`application/wasm`), `.mjs` / `.js` (`application/javascript`), and `.onnx` (`application/octet-stream`):
  ```kotlin
  val response = assetLoader.shouldInterceptRequest(request.url)
  if (response != null) {
      val path = request.url.path ?: ""
      if (path.endsWith(".wasm")) response.mimeType = "application/wasm"
      else if (path.endsWith(".mjs")) response.mimeType = "application/javascript"
  }
  ```
- Accept single-threaded WASM (`ort.env.wasm.numThreads = 1`) as a hard architectural invariant inside WebView—do not waste time trying to enable `SharedArrayBuffer` via COOP/COEP headers.
- Remove external network dependencies from `mvp_web/index.html` (currently lines 16–20 load Google Fonts `fonts.googleapis.com`, which stalls or fails offline) and unregister/bypass `sw.js` inside the APK (or ensure `sw.js` does not intercept/corrupt large `.onnx`/`.wasm` responses from `WebViewAssetLoader`).

**Warning signs:**
- Console error: `Fetch API cannot load file:///android_asset/... URL scheme "file" is not supported`.
- Console error: `Incorrect response MIME type. Expected 'application/wasm'`.
- `window.crossOriginIsolated` logs `false` even though `COOP`/`COEP` headers appear in `shouldInterceptRequest`.

**Phase to address:**
Android WebView Wrapper APK Phase (`WebViewAssetLoader` + MIME override + offline font/SW cleanup).

---

### Pitfall 5: Broken Camera Capture (`<input type="file" capture>` and `getUserMedia`) on Android 10 WebView

**What goes wrong:**
Both camera ingestion paths fail silently in a naive Android WebView wrapper:
1. `<input type="file" accept="image/*" capture="environment">` does **nothing at all** when tapped unless `WebChromeClient.onShowFileChooser()` is implemented. Even if implemented, passing a `file://` URI in `MediaStore.EXTRA_OUTPUT` throws `FileUriExposedException` on Android 10 (API 29), or writing to external storage fails under Scoped Storage.
2. `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` throws `NotAllowedError` silently because WebView denies all web permission requests unless `WebChromeClient.onPermissionRequest()` explicitly calls `request.grant()`—**after** the native Android `Manifest.permission.CAMERA` runtime permission has been granted.

**How to avoid:**
- **For `<input type="file" capture>`:**
  - Declare `androidx.core.content.FileProvider` in `AndroidManifest.xml` with `res/xml/file_paths.xml` pointing to `<external-files-path name="camera_photos" path="Pictures" />` (app-specific directory from `getExternalFilesDir(Environment.DIRECTORY_PICTURES)`—works on Android 10 API 29 without `WRITE_EXTERNAL_STORAGE`).
  - In `WebChromeClient.onShowFileChooser`, create a temp `.jpg`, get its `content://` URI via `FileProvider.getUriForFile(...)`, pass it via `MediaStore.EXTRA_OUTPUT` with `Intent.FLAG_GRANT_WRITE_URI_PERMISSION`, combine with `Intent.ACTION_GET_CONTENT` in `Intent.ACTION_CHOOSER`, and **always** invoke `filePathCallback.onReceiveValue(null)` if the user cancels (otherwise the WebView permanently locks `<input type="file">` for the rest of the session!).
- **For `getUserMedia`:**
  - Declare `<uses-permission android:name="android.permission.CAMERA" />` in `AndroidManifest.xml`.
  - Serve via `WebViewAssetLoader` (`https://`) so `navigator.mediaDevices` exists.
  - In `WebChromeClient.onPermissionRequest`, check `PermissionRequest.RESOURCE_VIDEO_CAPTURE`, request runtime `CAMERA` permission via `ActivityCompat.requestPermissions` if not yet granted, hold the pending `PermissionRequest`, and call `request.grant(request.resources)` only after native permission succeeds.
- **TR6948 Camera Hardware Check:** TR6948's back camera is `1600x1200` (2 MP, fixed/low-end focus). Add a file/sample gallery fallback (`<input type="file">` without `capture`) in case the 2 MP camera cannot focus cleanly at `10–15 cm` over a Petri dish.

**Warning signs:**
- Tapping the camera input button produces zero UI reaction, OR tapping it a second time after cancelling does nothing (`mFilePathCallback` leaked without `onReceiveValue(null)`).
- `getUserMedia` rejects immediately with `NotAllowedError: Permission denied` without showing any Android permission dialog.

**Phase to address:**
Android WebView Wrapper APK Phase (before UI camera integration testing on TR6948).

---

### Pitfall 6: Training `YOLO11n-seg` on Only 20 Plates with `val == train` Data Leakage

**What goes wrong:**
In the current repository, `data/Antibiogram_demo/Train_yolo/` contains exactly **20 images + 20 `.txt` labels**, and `configs/dataset.yaml` sets **`train: Train_yolo`, `val: Train_yolo`, `test: Train_yolo`**. Training `src/models/train_yolo.py` as-is (`10` epochs CLI default, `freeze=0`, `val == train`) produces an illusory `mAP@0.5` near `0.95+` while actually memorizing those 20 Petri dish lighting/background patterns—causing catastrophic false negatives/positives on new TR6948 camera photos (underfitting `inner_colony` or hallucinating `inhibition_zone` contours).

**Why it happens:**
1. **`val == train` hides overfitting:** With 0 held-out validation plates, `best.pt` is selected by lowest loss on the exact 20 memorized training images, and `patience=20` early stopping never triggers on generalization failure.
2. **All weights unfrozen on 20 samples:** Training all ~2.9M parameters of `yolo11n-seg.pt` from epoch 0 overwrites COCO low-level edge detectors with noise from 20 agar textures.
3. **Class imbalance across 3 classes:** Per ADR-005, the 20 plates contain `239` `antibiotic_disk`, `188` `inhibition_zone`, and only `57` `inner_colony` instances (`~2.8` per plate, concentrated on resistant isolates). Without held-out validation or `copy_paste` augmentation, `inner_colony` underfits severely.
4. **Destructive augmentations for circular Kirby-Bauer geometry:** Aggressive `perspective`, `shear`, or `degrees` changes elliptical distortion, and `hsv_v` / `hsv_s` extremes can wash out faint translucent `inhibition_zone` margins against Mueller-Hinton agar.

**How to avoid:**
- **Fix the validation split immediately:** Use at least a **16 train / 4 val** split (stratified so `inner_colony` plates appear in `val`) or **5-fold cross-validation** across the 20 plates—never set `val: Train_yolo` for final checkpoint evaluation. (Also check `data/Antibiogram_demo/Valid` and `Test` directories to see if additional unlabeled/labeled plates can serve as held-out visual test).
- **Tune `train_yolo.py` for a 20-image micro-dataset:**
  - Freeze early backbone layers (`freeze=10`) so COCO edge/blob filters remain stable.
  - Enable `mosaic=1.0`, `copy_paste=0.2` (critical for instance segmentation), `dropout=0.15–0.2`, `degrees=180.0` (Petri dishes are rotation-invariant!), `fliplr=0.5`, `flipud=0.5`, and **`close_mosaic=15`** so the final epochs refine clean circular zone boundaries without mosaic seam artifacts.
  - Keep `shear=0.0` and `perspective=0.0` (or tiny `<= 0.0005`) so disks remain circular/fiducial-faithful; keep `hsv_v <= 0.25` so subtle zone margins are preserved.
  - Align CLI `--epochs` default (`10` is way too low; use `100–150` with proper `val` early stopping) and `--imgsz` (`416`) to match the target ONNX export size.

**Warning signs:**
- `metrics/mAP50(M)` hits `> 0.90` on `val` by epoch 20 while qualitative inference on `mvp_web/sample_plates/*.jpg` misses disks or produces ragged/hallucinated halos.
- `inner_colony` recall stays near `0.0` on unseen plates.

**Phase to address:**
Dataset Split & YOLO11n-seg Training Phase.

---

### Pitfall 7: JavaScript YOLO11-seg Mask Decoding Bugs (Sigmoid Order, Proto Cropping, Letterbox Unpad, Tensor Layout)

**What goes wrong:**
Porting Ultralytics Python mask decoding (`result.masks.xy` in `src/evaluation/measure_zones.py`) to browser JavaScript produces misaligned, ghosted, clipped, or wildly mis-scaled masks—corrupting both `median_disk_px` ($F_{\text{scale}}$) and `inhibition_zone` diameters by several millimeters.

**Why it happens:**
Four distinct bugs routinely occur in JS ports of YOLO11-seg ONNX:
1. **Sigmoid applied before linear combination (or skipped):** Applying `sigmoid()` to the 32 prototype channels *before* dot-multiplying with the 32 mask coefficients destroys the signed cancellation between prototypes. Matmul MUST run on raw logits first (`sum_m coeff[m] * proto[m, y, x]`), and `1 / (1 + Math.exp(-logit))` is applied *after*.
2. **Zeroing outside the bbox *before* sigmoid:** Setting logits outside the detection bounding box to `0` before `sigmoid()` produces `sigmoid(0) = 0.5`, leaving a `0.5` probability box halo right on the `>= 0.5` threshold boundary! You must crop in proto space (`[H/4, W/4]`) *after* sigmoid (or set outside-box logits to `-Infinity` / `-1e4` before sigmoid).
3. **Forgetting letterbox unpadding (`dw`, `dh`, `scale`):** `TR6948` captures `1600x1200` (`4:3` aspect ratio), NOT `1:1` square. Letterboxing `4:3` into `416x416` adds top/bottom padding (`dh = 52 px` each side, `scale = 416 / 1600 = 0.26`). Scaling the `[104, 104]` proto mask straight to `1600x1200` without cropping out the padded rows/columns in proto space shifts and vertically stretches every halo, breaking 1-to-1 disk-to-zone pairing (`dist <= max(d_diam*2.5, z_diam*0.45)`) and inflating `F_scale` error.
4. **YOLO11-seg output tensor shape & stride mismatch:** Unlike YOLOv5 (`[1, N, 5+C]`) or single-class outputs, 3-class `YOLO11n-seg` exports two outputs:
   - `output0`: `[1, 39, N]` (`4` box `cx,cy,w,h` + `3` class logits/scores + `32` mask coeffs; `N = 3549` at `416x416` or `N = 2100` at `320x320` or `N = 8400` at `640x640`) — **channels-first (`39 x N`)**, NOT `[1, N, 39]`! Indexing `data[i * 39 + k]` instead of `data[k * N + i]` reads garbage.
   - `output1`: `[1, 32, H/4, W/4]` (`[1, 32, 104, 104]` at `416x416`).
   - Note also: Ultralytics ONNX exports **without built-in NMS** by default (`nms=False`), so JS must run per-class NMS before mask decoding—decoding masks for all `3549` anchors before NMS will stall or OOM JS!

**How to avoid:**
- Implement a unit-tested JS post-processor verified bit-for-bit (within `< 0.2 px` / `< 0.1 mm`) against `src/evaluation/measure_zones.py` on the same plate image:
  1. Run score filtering (`conf >= 0.45`) and **NMS first** so mask decoding runs only on ~10–25 surviving instances, never on all `N` anchors.
  2. Index `output0` as `[1, 4 + num_classes + 32, N]` (`row * N + anchorIdx`), where `cx, cy, w, h` are in letterboxed input pixels (`[0, imgsz]`).
  3. Compute `proto` dot product inside the proto-space bounding box `[floor(x1/4), floor(y1/4)] .. [ceil(x2/4), ceil(y2/4)]` ONLY (skipping pixels outside the box completely saves >90% of CPU loops!), apply `sigmoid`, threshold at `0.5` (or bilinear-upsample the cropped logit patch before thresholding for sub-proto precision), and map coordinates back via `(x_input - dw) / scale`, `(y_input - dh) / scale`.
  4. Verify `disk_diam_px` calculation uses equivalent area diameter `2 * sqrt(area / pi)` matching `_polygon_stats()` in `src/evaluation/measure_zones.py` (line 236).

**Warning signs:**
- Every detected zone renders as a square crop or includes ghost silhouettes of neighboring halos.
- Measurements match on square `1:1` test images (`1000x1000`) but drift vertically on `4:3` `1600x1200` camera captures.
- `output0` yields `NaN` or `> 1000` nonsense boxes due to transposed stride indexing.

**Phase to address:**
In-Browser ORT-Web Inference & Mask Geometry Phase (with golden reference test comparing JS output vs Python `measure_zones.py` on `4:3` and `1:1` images).

---

### Pitfall 8: `imgsz=320` Proto-Mask Quantization Destroys 6.0 mm Fiducial Accuracy ($\text{MAE} \le 0.50\text{ mm}$)

**What goes wrong:**
To save RAM and speed up WASM on TR6948, lowering input size to `imgsz=320` shrinks the segmentation prototype tensor to **`80x80` (`320 / 4`)**. On a standard `90 mm` Petri dish spanning ~80% of the frame (`~256 px` in `320` space, `~64 px` in `80` proto space), a `6.0 mm` antibiotic disk is only **`~4.3 proto pixels` wide**. Measuring `disk_diam_px` from a binary `80x80` mask introduces **$\pm 1\text{--}2\text{ proto px} = \pm 1.4\text{--}2.8\text{ mm}$ quantization error on the fiducial anchor itself**—which scales proportionally into every inhibition zone (`24 mm` becomes `20–29 mm`), silently flipping `S/I/R` categories and violating the $\text{MAE} \le 0.50\text{ mm}$ clinical guardrail!

**Why it happens:**
In `measure_zones.py`, $F_{\text{scale}} = 6.0 / \text{median}(\text{disk\_diam\_px})$ depends linearly on the accuracy of the `6.0 mm` disk diameter. A `15%` error in `median_disk_px` (easy when a disk is only 4 proto pixels wide!) creates a `3.0 mm` error on a `20 mm` zone. At `imgsz=416`, proto is `104x104` (~5.6 proto px per disk—still coarse if measured purely from binary proto pixels!).

**How to avoid:**
- Prefer **`imgsz=416`** over `320` if TR6948 latency & RAM allow it (validate both on-device).
- **Never compute `disk_diam_px` from an uninterpolated binary `proto` grid!** Instead:
  - Bilinearly upsample the cropped logit patch around each disk (e.g., `4x` back to input resolution `416` or original image ROI) *before* thresholding at `0.5`, **and/or** refine the disk edge radius in the original `1600x1200` grayscale canvas using radial gradient / circle fitting (similar to the 36-ray Sobel refinement already in `src/evaluation/cross_validation.py`), using YOLO's bbox/mask center as the exact seed.
- Keep `median_disk_px` outlier rejection (filter candidate disks whose aspect ratio `w/h` deviates from circular `[0.75, 1.35]` or whose diameter is `> 2x` / `< 0.5x` the median).

**Warning signs:**
- `median_disk_px` jumps in discrete steps or varies by `> 10%` across identical distance shots.
- Individual disk diameters in `px` differ wildly (`14 px` vs `22 px`) on the same plate, skewing `F_scale`.

**Phase to address:**
Training/Export Resolution Tradeoff Phase and JS Mask Decoding + Fiducial Calibration Phase.

---

### Pitfall 9: `1024x600@160dpi` Tablet Layout Clipping in `mvp_web/`

**What goes wrong:**
Directly inspecting `mvp_web/style.css` reveals that **`mvp_web/` will severely clip and overflow on the TR6948 (`1024x600` at `160 dpi`, i.e., `1024x600` CSS pixels in landscape)**:
1. `mvp_web/style.css` only has `@media (max-width: 959px)` (line 1335) and `@media (max-width: 600px)` (line 1367), while `.device` is hardcoded to `width: 414px; height: 868px;` (lines 187–188) and `body` defaults to `data-layout="twin"` (`mvp_web/index.html` line 24).
2. In **landscape (`1024x600`)**, `1024px > 959px`, so **neither media query triggers**! WebView renders the desktop Twin-Phone Defense Emulator (two `868px`-tall iPhone bezels with `.device-island` and `.stage-toolbar` inside a `600px`-tall viewport), clipping `~368px` off the bottom (hiding the bottom tab bar, caliper controls, and FHIR export button).
3. Even if locked to **portrait (`600x1024`)**, `@media (max-width: 600px)` sits right on the `600px` boundary (any fractional DPI/scrollbar variance or `601px` viewport falls back to `@media (max-width: 959px)`, which still forces `.device { height: 868px }` and shows `.stage-toolbar`!).
4. Opening the Android soft keyboard when typing a Sample ID or selecting drugs shrinks the WebView height below `600px`, crushing `.screen-scroll` if fixed heights or `100vh` (instead of `100dvh` / flexible scroll containers) are used.

**How to avoid:**
- Add an explicit **TR6948 / compact-tablet adaptive layout** in `mvp_web/style.css`:
  - Trigger full-bleed app mode (`100vw x 100dvh`, hiding `.stage-toolbar`, `.device-island`, `.status-bar`, `.home-indicator`) whenever running inside the Android WebView wrapper (e.g., via UA / `?app=1` / `window.AndroidBridge` class on `<body>`) **OR** when `(max-height: 760px)` / `(max-width: 1024px) and (pointer: coarse)`.
  - In `1024x600` landscape, use a **2-column side-by-side split** (left: `~460px` square plate canvas + layer toggles; right: compact scrollable S/I/R disk list + manual drug selector + caliper + FHIR button) instead of stacking vertically in a `600px`-tall screen.
- Test explicitly in both `1024x600` landscape and `600x1024` portrait on the physical TR6948 via `adb` (plus Playwright `1024x600` viewport check).

**Warning signs:**
- Bottom `.tab-bar`, `LIS` export button, or digital caliper unreachable without awkward outer-page scrolling.
- Twin iPhone bezels and "2 Móviles (Defensa)" toolbar visible on the tablet screen.

**Phase to address:**
UI Adaptation & Offline Hardening Phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `val: Train_yolo` in `configs/dataset.yaml` | Zero effort to run `train_yolo.py` | Completely invalid validation metrics; silently deploys an overfit model | **Never** — must split at least 16/4 or run k-fold before exporting |
| Hardcoding `ort-wasm-simd-threaded` without verifying non-SIMD fallback | Uses latest ORT-Web `1.19+` out of the box | If 32-bit `armeabi-v7a` hits a V8 SIMD alignment fault on `sun50iw10p1`, no scalar `.wasm` exists in `>=1.19` | Only after physical TR6948 smoke test confirms 50+ consecutive inferences pass with SIMD |
| Keeping Google Fonts CDN `<link>` in `mvp_web/index.html` | Crisp Inter / JetBrains Mono on desktop | Stalls initial render or falls back unpredictably offline inside TR6948 APK | Only in online web build; strip/bundle local `.woff2` or system-ui/monospace for APK |
| Skipping `onRenderProcessGone` in `WebViewClient` | Saves 15 lines of Kotlin | Any `lmkd` kill crashes the whole demo APK during live defense | **Never** on a `968 MB` RAM device |
| Decoding `1600x1200` image at full size into multiple JS canvases (`N=1000`) | Preserves max pixels for display | Wastes `~12–20 MB` native canvas RAM per canvas on TR6948 | Only on `>= 2 GB` RAM devices (ADR-001); cap `N <= 640` on TR6948 |
| Hardcoding manual drug list without WHONET alias normalization | Faster than porting EasyOCR | Breaks EUCAST `breakpoints_data.js` lookup if user picks non-canonical code | Acceptable in v1.6 demo **only if** dropdown options emit canonical `WHONET` / `CODE_ALIASES` keys |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **`WebViewAssetLoader` + ORT-Web** | Assuming `WebViewAssetLoader` sets `application/wasm` automatically | Explicitly override `mimeType = "application/wasm"` for `.wasm` and `"application/javascript"` for `.mjs` in `shouldInterceptRequest` |
| **`WebViewAssetLoader` + `sw.js`** | Registering `mvp_web/sw.js` inside the Android WebView APK | Disable/skip ServiceWorker registration inside the APK (`WebViewAssetLoader` already serves everything offline from APK assets; `sw.js` `cache.addAll` can double-cache or fail on large `.onnx`/`.wasm` payloads) |
| **`ort.env.wasm` + Android WebView** | Setting `numThreads = 4` and injecting `COOP`/`COEP` headers expecting `SharedArrayBuffer` | Android WebView does NOT support `crossOriginIsolated`; always force `ort.env.wasm.numThreads = 1` and avoid `proxy = true` |
| **Ultralytics `export_model.py` -> ORT-Web** | Calling `model.export(format='onnx', int8=True)` with no `data=` and `imgsz=640` | Export static `imgsz=416` (or `320`) FP32 first; if quantizing to INT8, use `quantize=8, data=...` or `onnxruntime.quantization.quantize_static` with plate calibration images and exclude sensitive head nodes |
| **Android 10 `onShowFileChooser`** | Passing `Uri.fromFile()` to camera intent, or forgetting `onReceiveValue(null)` on cancel | Use `FileProvider` + `getExternalFilesDir(DIRECTORY_PICTURES)` + `FLAG_GRANT_WRITE_URI_PERMISSION`; always clear `mFilePathCallback` with `null` on cancel/error |
| **`getUserMedia` in WebView** | Calling `getUserMedia` from `file://` or without `onPermissionRequest` | Serve via `WebViewAssetLoader` (`https://`), request native `CAMERA` runtime permission, then call `request.grant()` in `WebChromeClient.onPermissionRequest` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Running JS mask decoding before NMS** | Browser freezes 5–15 s and RAM spikes decoding 3,549 (`416x416`) or 8,400 (`640x640`) masks | Filter by confidence (`>= 0.45`) and run per-class NMS first; decode masks ONLY for top `<= 30` detections | Immediately on every single inference frame |
| **Full-frame `104x104` / `160x160` matmul + resize per detection** | High GC pressure and multi-second JS post-processing on ARMv7 Cortex-A53/A7 class cores | Compute `coeffs @ proto` ONLY inside the detection's `[px1..px2, py1..py2]` proto bounding box | `> 8` detections per plate (typical plate has 6–12 disks + 6–12 zones = 12–24 masks) |
| **Leaving `enableCpuMemArena: true` + `1000x1000` canvases** | First plate succeeds (`~120 MB` RSS); 2nd or 3rd plate triggers swap thrashing or `lmkd` kill | Set `enableCpuMemArena: false`, `enableMemPattern: false`, dispose `ort.Tensor` immediately, reuse a single working canvas `<= 640px` | After 2–4 consecutive plate analyses on TR6948 (`22 MB` free RAM) |
| **Exporting FP16 ONNX for WASM** | Latency 2x–5x slower than FP32 on CPU with zero RAM benefit after upcasting | Use FP32 or benchmarked INT8 only on WASM CPU EP | On every inference on CPU-only WebView |
| **Heavy CLAHE pixel loop in JS on `1600x1200` image** | Main UI thread freezes for several seconds before YOLO even starts | Downscale image to inference/display size (`<= 640px` max side) before running JS CLAHE/canvas filters | On every `2 MP` camera photo (`1.92M` pixels vs `0.3M` pixels at `640x480`) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Enabling `setAllowFileAccessFromFileURLs(true)` & `setAllowUniversalAccessFromFileURLs(true)` to hack around `file://` CORS** | Exposes local app filesystem to arbitrary cross-file reads if any external URL/script ever loads (flagged in Android security lint/Play policies) | Keep file access disabled (`setAllowFileAccess(false)`, `setAllowFileAccessFromFileURLs(false)`) and use `WebViewAssetLoader` exclusively |
| **Granting `onPermissionRequest` for any origin (`*`)** | Any navigated external page could access camera | Check `request.origin.toString().startsWith("https://appassets.androidplatform.net")` before calling `request.grant()` |
| **Leaving `shouldOverrideUrlLoading` unguarded** | Tapping a link (or residual external href) navigates WebView to untrusted web content inside the clinical shell | Block external navigations or restrict `WebViewClient` to `appassets.androidplatform.net` |
| **Leaking patient/sample metadata outside device** | Violates Chilean Law N° 21.719 privacy-by-design guarantee | Remove external CDN/font/API calls (`fonts.googleapis.com`, `cdn.jsdelivr.net`, `/api/analyze` remote fallback) in the offline APK build |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **No loading / warm-up state during first WASM + ONNX session init** | User taps "Analizar" on TR6948 and thinks the app froze while WASM compiles and loads the model (2–6 s on 32-bit ARM) | Pre-load `InferenceSession` on startup with a clear non-blocking progress badge (`Cargando motor IA local…` -> `Motor IA listo`) and disable Analyze until ready |
| **Replacing EasyOCR without fast manual disk-code assignment UI** | Without EasyOCR on TR6948, if 8–12 detected disks all default to `"UNK"`, technologist has to hunt through 40+ antibiotics per disk | Provide a one-tap **Antibiotic Panel Preset** (e.g., *Enterobacterales EUCAST*, *Staphylococcus*, *Pseudomonas*) + ordered tap-to-assign chips on the plate |
| **No feedback when `2 MP` camera capture is blurry or poorly lit** | Fixed/slow-focus `2 MP` camera at close range blurs 6 mm disk edges, silently ruining `F_scale` | Show live alignment reticle + brightness/blur check or allow effortless re-crop/gallery fallback (`mvp_web/sample_plates/` + local photos) |
| **Assuming `device-pixel-ratio` or desktop hover tooltips work on tablet** | `title="..."` tooltips and tiny drag handles are unusable with fingers on a `1024x600@160dpi` capacitive screen | Ensure `>= 44x44 px` touch targets and visible +/-0.5 mm caliper controls alongside touch-friendly canvas zoom/pan |

---

## "Looks Done But Isn't" Checklist

- [ ] **Offline Airplane-Mode Verification:** Often tested while Wi-Fi or `adb reverse` is active — verify APK runs with **Wi-Fi OFF + Airplane Mode ON** (no `fonts.googleapis.com`, no `cdn.jsdelivr.net` for ORT-Web `.wasm`/`.mjs`).
- [ ] **Held-Out Validation Accuracy:** Often verified only on `Train_yolo` (`val == train` in `configs/dataset.yaml`) — verify `MAE <= 0.50 mm` and `inner_colony` recall on **unseen held-out plates** not used in training or calibration.
- [ ] **4:3 Camera Photo Alignment:** Often tested only on square `1:1` sample images — verify JS letterbox unpadding `(x - dw) / scale` on `1600x1200` (`4:3`) and `1200x1600` (`3:4`) photos so mask contours align pixel-for-pixel with halos.
- [ ] **Repeated Inference Stability (Memory Leak / LMKD Test):** Often tested once and declared working — run **10 consecutive camera/sample analyses** on physical `TR6948` while monitoring `adb shell dumpsys meminfo` and `logcat` for `lmkd` kills or swap stalls.
- [ ] **Camera Cancel Flow:** Often tested only on happy-path photo capture — open `<input type="file" capture>`, press Android Back/Cancel, then tap the button a second time to verify `mFilePathCallback` did not lock permanently.
- [ ] **`1024x600` Landscape & `600x1024` Portrait Layout:** Often tested only in Chrome DevTools desktop view — inspect both orientations on physical `TR6948` (and with soft keyboard open) to confirm zero clipped controls.
- [ ] **INT8 vs FP32 Parity:** Often assumed INT8 matches PyTorch `best.pt` — run side-by-side comparison of PyTorch `best.pt` vs exported ONNX (`FP32` and `INT8`) on the exact same test plates and log `MAE` delta (`< 0.50 mm`).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **`lmkd` OOM kills on `416x416` FP32/INT8** | LOW | Drop model `imgsz` to `320` (with bilinear mask upsampling / Sobel disk refinement), cap display canvas to `N=512`, disable `enableCpuMemArena`, and pre-resize uploads before Canvas CLAHE |
| **WASM SIMD crash on 32-bit `armeabi-v7a` WebView 119** | LOW | Pin `onnxruntime-web@1.18.0`, bundle `ort-wasm.wasm`, set `ort.env.wasm.simd = false`, and re-benchmark latency |
| **INT8 QDQ slow or inaccurate in ORT-Web WASM** | LOW | Fall back to **FP32 `yolo11n-seg` ONNX** (`~11 MB` at `416x416`—still well within storage and often faster than unfused QDQ in single-thread WASM), or convert QDQ -> QOperator format |
| **20-plate `YOLO11n-seg` overfits or misses `inner_colony`** | MEDIUM | Switch to 5-fold validation, freeze backbone (`freeze=10`), enable `copy_paste=0.2` + `mosaic=1.0` + `close_mosaic=15`, or label 20–30 more plates from `data/Antibiogram_demo/Train` |
| **WebView `getUserMedia` unreliable on TR6948 2 MP cam** | LOW | Default capture UX to native Android Camera app via `onShowFileChooser` + `FileProvider` (`Intent(MediaStore.ACTION_IMAGE_CAPTURE)`) plus gallery picker, keeping `getUserMedia` optional |
| **JS mask decode diverges from Python `measure_zones.py`** | MEDIUM | Export intermediate Python letterbox/proto/bbox tensors for 1 test plate as JSON, write a Node/browser unit test comparing JS decoded `diam_px` and `(cx, cy)` per instance to `< 0.5 px` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **#6: 20-plate overfitting & `val == train` leakage** | Phase 1: Dataset Split & `YOLO11n-seg` Training | Held-out validation split (`configs/dataset.yaml` updated); `mAP@0.5` and `MAE` measured on unseen plates |
| **#3 & #8: ONNX export bug (`int8=True` w/o `data`), FP16 trap, `320` vs `416` disk quantization** | Phase 1: Model Export & Quantization | Export both `FP32` and calibrated `INT8` at `416` (and `320` backup); verify ONNX output shapes `[1, 39, N]` & `[1, 32, H/4, W/4]` and Python parity `MAE <= 0.50 mm` |
| **#2 & #7: ORT-Web >=1.19 `.wasm`/`.mjs` offline bundling & JS mask-decode bugs** | Phase 2: Browser ORT-Web Inference & Calibration Port | Offline browser test with `numThreads=1`, `4:3` image (`1600x1200`), golden diff vs `measure_zones.py` `< 0.2 mm` |
| **#4 & #5: `file://` CORS, `.wasm` MIME type, `SharedArrayBuffer`, `onShowFileChooser` / `getUserMedia`** | Phase 3: Android WebView Wrapper APK (`armeabi-v7a`, API 29) | APK installed via `adb` with Wi-Fi OFF; `.wasm` loads with `application/wasm`, camera capture + cancel + gallery work without crash |
| **#9: `1024x600@160dpi` layout clipping & offline fonts** | Phase 4: Tablet UI Adaptation & Offline Polish | Verified visually via `adb` screenshot in both `1024x600` landscape and `600x1024` portrait with soft keyboard open |
| **#1: 32-bit ~1 GB RAM `lmkd` kills & `onRenderProcessGone`** | Phase 3 (APK handler) + Phase 5: Physical TR6948 Benchmarking | 10 consecutive plate analyses on TR6948 with `dumpsys meminfo` peak RSS logged, `0` `lmkd` kills, and `TRT` benchmarked |

---

## Sources

- **Codebase direct inspection:** `configs/dataset.yaml`, `src/models/train_yolo.py`, `src/models/export_model.py`, `src/evaluation/measure_zones.py`, `mvp_web/index.html`, `mvp_web/style.css`, `mvp_web/app.js`, `mvp_web/sw.js`, `.planning/PROJECT.md`, `C:/Users/cmelian/Desktop/target_device_specs.md`
- **ONNX Runtime Web docs & GitHub issues:** WASM memory limits (`4 GB` wasm32 address space, `enableCpuMemArena` / `enableMemPattern`), FP16 CPU performance warning (*"Avoid float16 models if possible, as float16 is not natively supported by CPU"*), QDQ vs QOperator fusion in WASM, and `onnxruntime-web@1.19.0` removal of `ort-wasm.wasm` / `ort-wasm-simd.wasm` in favor of `ort-wasm-simd-threaded.{wasm,mjs}` ([onnxruntime.ai](https://onnxruntime.ai/docs/), [github.com/microsoft/onnxruntime](https://github.com/microsoft/onnxruntime))
- **Android Developers & Chromium WebView docs:** `WebViewAssetLoader` + `.wasm` `application/wasm` MIME type override, Chromium WebView lack of `crossOriginIsolated` / `SharedArrayBuffer` support, `WebViewClient.onRenderProcessGone` under `lmkd` on 1 GB devices, `WebChromeClient.onShowFileChooser` with `FileProvider` on Android 10 (API 29) Scoped Storage, `onPermissionRequest` for `getUserMedia`, and WebView 91+ WASM SIMD on `armeabi-v7a` NEON ([developer.android.com](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader))
- **Ultralytics docs & YOLO-seg ONNX decoding references:** `YOLO11n-seg` ONNX export (`quantize=8` / `quantize_static` calibration), `[1, 4+C+32, N]` + `[1, 32, H/4, W/4]` prototype mask decoding, sigmoid-after-matmul, proto-space cropping, and micro-dataset training (`freeze`, `mosaic`, `copy_paste`, `close_mosaic`) ([docs.ultralytics.com](https://docs.ultralytics.com/))

---
*Pitfalls research for: ADLMS / DeepHalo v1.6 Edge Device Demo (TR6948)*
*Researched: 2026-11-24*

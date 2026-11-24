# Phase 7: In-Browser Edge Inference & Clinical Parity - Research

**Researched:** 2026-11-24
**Domain:** Client-side `onnxruntime-web@1.18.0` WASM inference, pure-JS `YOLO11n-seg` mask decoding, 6.0 mm fiducial scaling, 36-ray radial Sobel cross-validation, and dual-mode routing in `mvp_web/`
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Default shipping artifact:** Default to `yolo11n_seg_416_fp32.onnx` (verified at `MAE = 0.4678 mm <= 0.50 mm` in Phase 6) staged under `mvp_web/models/` alongside `model_meta.json`, with `?model=<variant_id>` query override so Phase 10 can benchmark all 4 variants without code changes.
- **ORT-Web memory hygiene:** Pin `onnxruntime-web@1.18.0` in `mvp_web/vendor/ort/` (`ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`) with `ort.env.wasm.numThreads = 1`, `enableCpuMemArena = false`, `enableMemPattern = false`, singleton session reuse, and explicit `tensor.dispose()` after every run.
- **Auto-routing rule:** If `location.hostname === 'appassets.androidplatform.net'` or `?mode=edge-wasm` is set → route directly to local ORT-Web (`edge-wasm`). Otherwise probe `GET /api/health` (600 ms timeout) → use `POST /api/analyze` (`local-api`) if reachable, else fall back cleanly to `edge-wasm`.
- **UI indicator:** Display a compact runtime mode badge (`Edge WASM` vs `Local API`) in the top bar while keeping `mvp_web/` 100% compatible with `run_web_mvp.py`.
- **Auto-probe with scalar fallback:** Probe WASM SIMD support at boot and load `ort-wasm-simd.wasm` when supported, falling back cleanly to scalar `ort-wasm.wasm` if unsupported or when `?simd=0` is passed.
- **Automated parity harness:** Provide an automated headless browser / Node parity test script comparing the pure-JS decoder output (letterbox unpadding, 4× bilinear logit upsampling, 6.0 mm median disk scale, 1:1 pairing, 36-ray Sobel `Δr`, `inner_colony` flag) against Python `src/evaluation/measure_zones.py` on both `1:1` and `4:3` held-out plates (`< 0.2 mm` MAE target).

### Claude's Discretion
- Exact module split inside `mvp_web/inference/` (`inference_router.js`, `edge_detector.js`, `yolo_seg_decode.js`, `sobel_cv.js`) and whether to load via classic `<script>` tags or ES modules (compatible with both `run_web_mvp.py` and `WebViewAssetLoader`).
- Exact 10-plate memory stability check mechanism in the headless test.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 7 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **WASM-01** | User's browser/WebView runs the model via locally bundled `onnxruntime-web@1.18.0` (SIMD + non-SIMD wasm, `numThreads=1`, mem arena/pattern off, tensors disposed). | Vendoring `onnxruntime-web@1.18.0` (`ort.wasm.min.js`, `ort-wasm.wasm`, `ort-wasm-simd.wasm`) via `npm pack`, `ort.env.wasm` flags, `WebAssembly.validate` SIMD probe + `?simd=0` override, singleton `InferenceSession` with `enableCpuMemArena: false`, `enableMemPattern: false`, `try/finally` `tensor.dispose()`. |
| **WASM-02** | User gets the same `mvp_web/` UI on desktop (`run_web_mvp.py` API) and inside the APK (local ORT-Web), selected automatically by an inference router. | `mvp_web/inference/inference_router.js` implementing `detectRuntimeMode()` (`appassets.androidplatform.net` / `?mode=edge-wasm` / 600 ms `GET /api/health` probe) and unified `analyzePlate()` returning exact `/api/analyze` JSON schema consumed by `mvp_web/app.js:288-328`; top-bar mode badge (`Edge WASM` vs `Local API`). |
| **WASM-03** | User sees disk/zone masks decoded in pure JS from `output0 [1,39,N]` + `output1 [1,32,S/4,S/4]` (NMS first, ROI-cropped proto math, 4× logit upsampling, letterbox unpadding). | `mvp_web/inference/yolo_seg_decode.js` implementing channels-first `[1, 39, N]` parsing (`N=3549` at `416`, `N=2100` at `320`), conf filter (`0.45`), per-class NMS (`IoU 0.45`), ROI-cropped `coeffs @ protos` **before** sigmoid, 4× bilinear logit upsampling to input-space ROI, area-based equivalent diameter `2*sqrt(area/pi)`, 36-ray contour extraction, and `(x - padLeft) / scale` / `(y - padTop) / scale` unpadding. |
| **WASM-04** | User gets mm diameters via median 6.0 mm disk scale, 1:1 disk-zone pairing, 36-ray Sobel cross-check (`Δr <= 1.2 mm`) and `inner_colony` alerts, within 0.2 mm of Python `measure_zones.py`. | Exact port of `measure_zones.py:349-398` (6.0 mm median disk scale, greedy 1:1 pairing with `dist <= max(d_diam*2.5, z_diam*0.45)`, `6.0 * 1.08` clamp), `cross_validation.py:82-202` (`sobel_cv.js`: 5×5 Gaussian blur, 36 rays every 10°, 1D `[-1,-2,0,2,1]` derivative, median radius, `Δr <= 1.2 mm`), and `inner_colony` (class `2`) containment alert mapped into `detections[]` and `app.js` UI. |
</phase_requirements>

---

## Summary

Phase 7 bridges the frozen Phase 6 ONNX artifacts (`exports/yolo11n_seg_416_fp32.onnx` + `exports/model_meta.json`) into the existing zero-build `mvp_web/` frontend so that Kirby-Bauer plate analysis runs 100% in the browser via `onnxruntime-web@1.18.0` with `< 0.2 mm` clinical parity against Python `src/evaluation/measure_zones.py`.

Direct inspection of `mvp_web/app.js`, `run_web_mvp.py`, `src/evaluation/measure_zones.py`, `src/evaluation/cross_validation.py`, and `src/evaluation/verify_onnx_parity.py` confirms that the existing frontend already consumes a clean, self-contained JSON payload from `POST /api/analyze` (`scale_px_per_mm`, `median_disk_px`, `inference_ms`, `total_ms`, `detections[]`). By inserting a thin dual-mode `inference_router.js` between `loadUpload()` and the two backends (`POST /api/analyze` vs local `edge_detector.js`), `mvp_web/` retains 100% compatibility with `run_web_mvp.py` while gaining offline edge inference.

**Primary recommendation:** Load `mvp_web/vendor/ort/ort.wasm.min.js` and the four classic UMD/IIFE modules under `mvp_web/inference/` (`sobel_cv.js`, `yolo_seg_decode.js`, `edge_detector.js`, `inference_router.js`) via standard `<script>` tags (exporting both `window.ADLMS_*` globals for browser/WebView and `module.exports` for Node.js parity tests), avoiding ES-module CORS/MIME edge cases across `run_web_mvp.py`, `WebViewAssetLoader`, and Node `v26.13.1`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runtime mode routing (`Edge WASM` vs `Local API`) | Browser / Client (`mvp_web/inference/inference_router.js`) | Local Python API (`run_web_mvp.py` `/api/health`) | Client owns environment detection (`appassets.androidplatform.net`, `?mode=`, 600 ms health probe) so offline APK never blocks on network. |
| ONNX model execution & tensor memory lifecycle | Browser / Client (`mvp_web/inference/edge_detector.js` + `onnxruntime-web@1.18.0`) | — | Zero-server privacy-by-design requirement; single-threaded WASM (`numThreads=1`) with explicit `tensor.dispose()`. |
| `YOLO11n-seg` mask decoding, 6.0 mm calibration, 1:1 pairing, `inner_colony` alerts | Browser / Client (`mvp_web/inference/yolo_seg_decode.js`) | — | Pure-JS `Float32Array` math avoids ~10 MB `opencv.js` WASM overhead on 32-bit TR6948. |
| 36-ray radial Sobel geometric cross-validation | Browser / Client (`mvp_web/inference/sobel_cv.js`) | — | Runs on original uploaded image luminance (`ImageData`), matching `cross_validation.py` without OpenCV. |
| Clinical S/I/R evaluation, intrinsic resistance, caliper, FHIR R4 | Browser / Client (`mvp_web/app.js` + `breakpoints_data.js`) | — | Already implemented in `mvp_web/app.js`; consumes unified `detections[]` schema unchanged. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `onnxruntime-web` | `1.18.0` (pinned) [VERIFIED: npm registry] | Client-side ONNX WASM inference | Last release shipping both `ort-wasm.wasm` (scalar non-SIMD) and `ort-wasm-simd.wasm` (single-thread SIMD) plus UMD `ort.wasm.min.js`; zero `postinstall` scripts [VERIFIED: `npm view onnxruntime-web@1.18.0 scripts.postinstall` returned empty]. |
| Vanilla ES2022 (`Float32Array`, `CanvasRenderingContext2D`) | Native browser / Node `v26.13.1` | Letterbox preprocess, NMS, ROI proto decode, 36-ray Sobel | Zero-build `mvp_web/` architecture; no bundler or `opencv.js` WASM bloat. |

### Supporting
| Asset / Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| `exports/yolo11n_seg_416_fp32.onnx` | Phase 6 (`11,590,683` bytes) [VERIFIED: `exports/model_meta.json:74-98`] | Default shipping edge model (`MAE = 0.4678 mm`) | Staged into `mvp_web/models/` alongside `model_meta.json` (plus optional `?model=<variant_id>` lookup). |
| Node.js `node:test` + `onnxruntime-web@1.18.0` / Python `onnxruntime` | Node `v26.13.1` [VERIFIED: CLI] | Automated JS vs Python `< 0.2 mm` parity harness | Runs `yolo_seg_decode.js` and `sobel_cv.js` directly in Node against Python `measure_zones.py` / `verify_onnx_parity.py` golden outputs on `1:1` and `4:3` plates. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Classic `<script>` UMD/IIFE modules (`window.ADLMS_*` + `module.exports`) | Native ES modules (`type="module"`) | Classic `<script>` matches `breakpoints_data.js`, `plates_data.js`, and `app.js` in `mvp_web/index.html:371-373`, works identically in `run_web_mvp.py`, `WebViewAssetLoader`, and Node `require()` without MIME/CORS friction. |
| Pure-JS `sobel_cv.js` | `opencv.js` | `opencv.js` adds ~8–10 MB WASM + separate heap, risking 32-bit TR6948 OOM; 36-ray 1D Sobel is ~120 lines of pure JS. |

**Vendoring `onnxruntime-web@1.18.0` into `mvp_web/vendor/ort/`:**
```powershell
New-Item -ItemType Directory -Force mvp_web\vendor\ort | Out-Null
npm pack onnxruntime-web@1.18.0 --pack-destination $env:TEMP
tar -xzf "$env:TEMP\onnxruntime-web-1.18.0.tgz" -C $env:TEMP package/dist/ort.wasm.min.js package/dist/ort-wasm.wasm package/dist/ort-wasm-simd.wasm
Copy-Item "$env:TEMP\package\dist\ort.wasm.min.js" mvp_web\vendor\ort\
Copy-Item "$env:TEMP\package\dist\ort-wasm.wasm" mvp_web\vendor\ort\
Copy-Item "$env:TEMP\package\dist\ort-wasm-simd.wasm" mvp_web\vendor\ort\
Remove-Item "$env:TEMP\onnxruntime-web-1.18.0.tgz" -Force
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `onnxruntime-web@1.18.0` | npm | > 5 yrs (Microsoft official) | High (official ONNX Runtime JS) | `github.com/microsoft/onnxruntime` | [OK] | Approved — vendored static files only (`ort.wasm.min.js`, `ort-wasm.wasm`, `ort-wasm-simd.wasm`), no `postinstall` script |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User uploads plate (mvp_web/app.js :: loadUpload)
       │
       ▼
mvp_web/inference/inference_router.js :: analyzePlate(file, img, opts)
       │
       ├── [mode === 'local-api'] ──► POST /api/analyze (run_web_mvp.py)
       │                                      │
       └── [mode === 'edge-wasm'] ──► edge_detector.js :: runEdgeInference(img, opts)
                                              │
                                              ├─ 1. Letterbox canvas (S×S, pad #727272) -> Float32 NCHW [1,3,S,S]
                                              ├─ 2. Singleton ort.InferenceSession.run({ images })
                                              │      (numThreads=1, simd=probe, enableCpuMemArena=false, enableMemPattern=false)
                                              ├─ 3. Copy output0/output1 TypedArrays & dispose() all ort.Tensors in finally
                                              ├─ 4. yolo_seg_decode.js :: decodeYoloSeg(out0, out1, meta, lb)
                                              │      ├─ Parse [1,39,N] -> conf >= 0.45 -> per-class NMS (IoU 0.45)
                                              │      ├─ ROI-crop proto [1,32,S/4,S/4] -> coeffs @ protos -> 4× bilinear upsample -> sigmoid > 0.5
                                              │      ├─ Area equivalent diam_px, centroid, 36-ray contour, unpad to orig (W,H)
                                              │      ├─ 6.0 mm median disk scale + 1:1 greedy disk-zone pairing
                                              │      └─ Class 2 (inner_colony) containment check per zone
                                              └─ 5. sobel_cv.js :: validateZoneGeometry(rgba, W, H, ...)
                                                     └─ 5×5 Gaussian blur -> 36 rays (10°) -> 1D [-1,-2,0,2,1] -> median r -> Δr <= 1.2 mm
                                              │
                                              ▼
                       Unified /api/analyze JSON payload (detections[], scale_px_per_mm, timings)
                                              │
                                              ▼
                       mvp_web/app.js :: buildDiscsFromPlateData() -> evaluate() -> renderPanel()
```

### Recommended Project Structure
```
mvp_web/
├── vendor/
│   └── ort/
│       ├── ort.wasm.min.js         # UMD single-file WASM loader (1.18.0)
│       ├── ort-wasm.wasm           # Scalar non-SIMD fallback (1.18.0)
│       └── ort-wasm-simd.wasm      # Single-thread SIMD build (1.18.0)
├── models/
│   ├── model_meta.json             # Copied from exports/model_meta.json
│   └── yolo11n_seg_416_fp32.onnx   # Default shipping variant (plus optional other variants)
├── inference/
│   ├── sobel_cv.js                 # 36-ray radial Sobel geometric cross-validation
│   ├── yolo_seg_decode.js          # output0/output1 decode, 4× upsample, 6.0mm scale, 1:1 pairing, inner_colony
│   ├── edge_detector.js            # ORT-Web 1.18.0 config, SIMD probe, singleton session, letterbox, dispose()
│   └── inference_router.js         # Mode resolution ('edge-wasm' vs 'local-api') & unified analyzePlate()
├── index.html                      # Script tags + top-bar runtime mode badge (#runtime-mode-badge)
├── app.js                          # Wire loadUpload() to inference_router.js + inner_colony UI tag
└── style.css                       # Compact styling for mode badge & inner_colony alert tag
```

### Exact Technical Contracts (Verified from Codebase)

#### 1. `onnxruntime-web@1.18.0` Configuration & SIMD Probe (`edge_detector.js`)
- **WASM SIMD feature probe** (minimal valid 128-bit SIMD module):
  ```javascript
  function supportsWasmSimd() {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
        3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]));
    } catch { return false; }
  }
  ```
- **Query overrides:** `?simd=0` forces scalar `ort-wasm.wasm` (`ort.env.wasm.simd = false`); `?model=<variant_id>` selects a variant from `mvp_web/models/model_meta.json` (default: `yolo11n_seg_416_fp32`).
- **ORT-Web flags (set BEFORE `ort.InferenceSession.create`):**
  ```javascript
  ort.env.wasm.wasmPaths = './vendor/ort/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.simd = forceNoSimd ? false : supportsWasmSimd();
  ```
- **Singleton session options:**
  ```javascript
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
    enableCpuMemArena: false,
    enableMemPattern: false,
    graphOptimizationLevel: 'all',
  });
  ```
- **Tensor lifecycle:** Wrap `session.run({ [inputName]: inputTensor })` in `try { ... } finally { inputTensor.dispose(); for (const k of Object.keys(outputs || {})) outputs[k]?.dispose?.(); }` after copying `output0.data` and `output1.data` into plain `Float32Array`s (`new Float32Array(out.data)`).

#### 2. Letterbox & Tensor Contract (`exports/model_meta.json` & `src/models/export_model.py:33-56`)
Verbatim from `exports/model_meta.json:4-8`:
- `"0": "antibiotic_disk"`, `"1": "inhibition_zone"`, `"2": "inner_colony"`.
Verbatim from `exports/model_meta.json:74-96`:
- `yolo11n_seg_416_fp32`: `imgsz: 416`, `input_shape: [1, 3, 416, 416]`, `output_shapes: [[1, 39, 3549], [1, 32, 104, 104]]`.
- `yolo11n_seg_320_fp32`: `imgsz: 320`, `input_shape: [1, 3, 320, 320]`, `output_shapes: [[1, 39, 2100], [1, 32, 80, 80]]`.
- **Letterbox math** (matching `export_model.py:35-56`):
  - `scale = Math.min(imgsz / origH, imgsz / origW)`
  - `newW = Math.round(origW * scale)`, `newH = Math.round(origH * scale)`
  - `dw = (imgsz - newW) / 2.0`, `dh = (imgsz - newH) / 2.0`
  - `padTop = Math.round(dh - 0.1)`, `padLeft = Math.round(dw - 0.1)`
  - Fill canvas with `rgb(114, 114, 114)`, draw image at `(padLeft, padTop, newW, newH)`, convert RGBA `Uint8ClampedArray` to NCHW `Float32Array` (`R/255`, `G/255`, `B/255`).

#### 3. Pure-JS `YOLO11n-seg` Mask Decoding (`yolo_seg_decode.js`)
Matches `verify_onnx_parity.py:124-203` with 4× bilinear logit upsampling inside each detection's ROI:
1. **Channels-first indexing:** `output0` is `[1, 39, N]`. For anchor `i` (`0..N-1`), channel `k` is at `out0[k * N + i]`:
   - `cx = out0[0 * N + i]`, `cy = out0[1 * N + i]`, `bw = out0[2 * N + i]`, `bh = out0[3 * N + i]`
   - Class scores: `out0[(4 + c) * N + i]` for `c in 0..2`. Keep if `maxScore >= 0.45`.
   - Mask coefficients: `coeffs[m] = out0[(7 + m) * N + i]` for `m in 0..31`.
2. **Per-class NMS (before mask decode):** Sort by descending score per class `c in {0, 1, 2}`, suppress boxes with `IoU > 0.45`.
3. **ROI-cropped proto dot product + 4× bilinear logit upsampling:**
   - Proto grid is `[32, protoH, protoW]` (`protoH = protoW = imgsz / 4`).
   - Bounding box in input space: `x1 = clamp(cx - bw/2, 0, imgsz)`, `y1 = clamp(cy - bh/2, 0, imgsz)`, `x2 = clamp(cx + bw/2, 0, imgsz)`, `y2 = clamp(cy + bh/2, 0, imgsz)`.
   - Compute raw logits `L(py, px) = sum_{m=0..31} coeffs[m] * proto[m * protoH * protoW + py * protoW + px]` **only** for `py in [floor(y1/4)..ceil(y2/4)]`, `px in [floor(x1/4)..ceil(x2/4)]` (with 1-pixel border for bilinear interpolation).
   - **4× bilinear upsampling** in input-space ROI `[ix1..ix2, iy1..iy2]`: sample bilinearly from `L` at `((ix + 0.5) / 4 - 0.5, (iy + 0.5) / 4 - 0.5)`, apply `sigmoid(val) = 1 / (1 + Math.exp(-clamp(val, -40, 40)))`, threshold `> 0.5`.
   - Accumulate `areaInputPx`, `sumX`, `sumY` directly from foreground pixels inside the ROI:
     - `cxOrig = (sumX / areaInputPx - padLeft) / scale`
     - `cyOrig = (sumY / areaInputPx - padTop) / scale`
     - `areaOrig = areaInputPx / (scale * scale)`
     - `diamPx = 2 * Math.sqrt(areaOrig / Math.PI)` (matches `measure_zones.py:236`)
   - Extract 36-ray boundary contour from the binary ROI mask, unpad to normalized `[x / origW, y / origH]`.

#### 4. Fiducial Scale, 1:1 Pairing & `inner_colony` Alerts (`yolo_seg_decode.js`)
Matches `measure_zones.py:349-398`:
- `medianDiskPx = median(disks.map(d => d.diamPx))`
- `pxPerMm = medianDiskPx / 6.0`, `fScale = 6.0 / medianDiskPx`
- **Greedy 1:1 pairing:** Candidate `(dist, di, zi)` if `dist <= Math.max(d.diamPx * 2.5, z.diamPx * 0.45)`. Sort ascending by `dist`, assign each disk and zone at most once.
- **Resistant clamp:** If paired and `z.diamPx * fScale > 6.0 * 1.08`, use `round(zDiamMm, 1)` and `(z.cx, z.cy)`; else `diam_mm = 6.0`, `(hx, hy) = (d.cx, d.cy)`, `zone_contour = []`.
- **Deterministic panel ordering:** Sort disks by `(Math.round(cy / Math.max(1, origH * 0.12)), cx)` (`measure_zones.py:371`).
- **`inner_colony` (class 2) alert:** For each disk/zone detection, count any `inner_colony` centroid whose distance to `(hx, hy)` is `<= Math.max((diam_mm / 2) * pxPerMm, d.diamPx * 0.75)`. Emit `inner_colony: boolean`, `inner_colony_count: number`, and `inner_colony_message: string` on each detection record, and render a visible badge in `mvp_web/app.js` (`renderPanel()` and `renderCaliper()`).

#### 5. 36-Ray Radial Sobel Cross-Validation (`sobel_cv.js`)
Matches `src/evaluation/cross_validation.py:82-202`:
- If `yolo_diam_mm <= 6.6 || f_scale <= 0`: return `{ sobel_diam_mm: round1(yolo_diam_mm), delta_r_mm: 0.0, geo_valid: true, geo_alert: false, geo_message: 'Validado (sin halo / crecimiento confluente al disco)', rays_used: 36 }`.
- Extract luminance `L` from RGBA (`0.299*R + 0.587*G + 0.114*B` or CIE `L*` approximation; `cross_validation.py:117` uses `cv2.COLOR_BGR2LAB` `L` channel), apply separable 5×5 Gaussian blur (`sigma = 1.0`, kernel `[1, 4, 6, 4, 1] / 16` or exact `exp(-x^2/2)`).
- Search window: `yolo_rad_px = (yolo_diam_mm / 2) / f_scale`, `window_px = Math.max(12.0, 3.8 / f_scale)`, `r_min = Math.max(disk_radius_px * 1.28, yolo_rad_px - window_px)`, `r_max = Math.min(yolo_rad_px + window_px, Math.min(w, h) * 0.5)`.
- Cast 36 rays (`theta = 2 * Math.PI * k / 36`), sample `gray[round(y), round(x)]` along `r = r_min, r_min+1, ... < r_max`, convolve with 1D Sobel `[-1, -2, 0, 2, 1]`, take `abs`, zero first/last 2 samples, skip if `max <= 1.0`, pick `argmax`.
- If `< 6` valid rays: return `geo_valid: true, delta_r_mm: 0.0`.
- Else: `sobel_rad_px = median(ray_radii_px)`, `sobel_rad_mm = sobel_rad_px * f_scale`, `sobel_diam_mm = Math.max(6.0, sobel_rad_mm * 2.0)`, `delta_r_mm = Math.abs(yolo_diam_mm / 2 - sobel_rad_mm)`, `geo_valid = delta_r_mm <= 1.2`.

#### 6. `inference_router.js` & `mvp_web/app.js` Integration
- **Mode resolution (`detectRuntimeMode()`):**
  1. `location.hostname === 'appassets.androidplatform.net'` → `'edge-wasm'`
  2. `new URLSearchParams(location.search).get('mode') === 'edge-wasm'` → `'edge-wasm'`
  3. `GET /api/health` with `AbortController` (`600 ms` timeout) → if `res.ok` and `(await res.json()).model_exists`, return `'local-api'`
  4. Otherwise → `'edge-wasm'`
- **Top-bar mode badge:** Update the existing `.chip-edge` element in `mvp_web/index.html:98-99` (give it `id="runtime-mode-badge"`) so it dynamically displays `Edge WASM` vs `Local API` (and updates `#meta-engine` with model variant + timings).
- **Schema parity:** `edge_detector.js` returns the exact JSON keys `loadUpload()` (`mvp_web/app.js:304-328`) expects: `scale_px_per_mm`, `scale_mm_per_px`, `median_disk_px`, `disk_count`, `zone_count`, `inference_ms`, `total_ms`, `preprocess_ms`, `postprocess_ms`, `runtime_mode`, `model_variant`, `detections[]` (`id`, `code: 'UNK'`, `abx_code: 'UNK'`, `abx_name: 'Disco no identificado'`, `x`, `y`, `w`, `h`, `hx`, `hy`, `diam_mm`, `sobel_mm`, `delta_r_mm`, `geo_valid`, `geo_alert`, `geo_message`, `inner_colony`, `inner_colony_count`, `inner_colony_message`, `zone_contour`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ONNX graph execution in browser | Custom WebGL/WASM conv kernels | `onnxruntime-web@1.18.0` (`ort.wasm.min.js`) | Full opset-17 operator coverage, SIMD + scalar fallback, battle-tested memory controls. |
| EUCAST v16.1 / CLSI M100 breakpoints & intrinsic resistance | Duplicate drug tables in `inference/` | Existing `window.ADLMS_BREAKPOINTS` (`mvp_web/breakpoints_data.js`) + `evaluate()` in `mvp_web/app.js:113-132` | Already synchronized with `configs/eucast_v16_1_breakpoints.json`. |
| Polygon contour simplification with OpenCV | Loading `opencv.js` | 36-ray radial boundary sampling from binary ROI mask | Zero extra WASM binary (~10 MB saved), produces clean closed polygons directly in `[0..1]` coords. |

---

## Common Pitfalls

### Pitfall 1: Transposed `[1, 39, N]` Indexing in `output0`
**What goes wrong:** Indexing `out0[i * 39 + k]` instead of `out0[k * N + i]` reads garbage coordinates.
**How to avoid:** Always stride by `N` (`3549` for `416`, `2100` for `320`) read dynamically from `out0Tensor.dims[2]`.

### Pitfall 2: Applying Sigmoid Before Matmul or Zeroing Outside BBox Before Sigmoid
**What goes wrong:** `sigmoid(0) = 0.5` creates rectangular halo artifacts; sigmoid before dot product destroys signed prototype cancellation.
**How to avoid:** Compute `dot(coeffs, protos)` strictly inside the proto-space bounding box, bilinearly upsample raw logits 4×, and apply `sigmoid > 0.5` last.

### Pitfall 3: All 6 Held-Out Plates Are Near-Square (`1:1`), Hiding `4:3` Letterbox Unpadding Bugs
**What goes wrong:** Measured dimensions of the 6 held-out plates in `val.txt` + `Test_yolo` are `2823x2847` through `3000x3292` [VERIFIED: Python `cv2.imread` check]. A bug in `padTop` / `padLeft` unpadding can pass on `1:1` plates and fail on TR6948's `1600x1200` (`4:3`) camera.
**How to avoid:** The automated parity harness MUST test both the real held-out plates AND a synthesized `1600x1200` (`4:3`) plate against Python `verify_onnx_parity.py` / `measure_zones.py`.

### Pitfall 4: `ort.Tensor` Memory Leaks Across Consecutive Plates
**What goes wrong:** Forgetting `.dispose()` on input or output tensors causes WASM linear memory to grow steadily across 10 runs.
**How to avoid:** Always copy typed arrays out and call `.dispose()` in a `finally` block; verify with a 10-plate consecutive stability test.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`node`) | Parity harness (`node:test`) | ✓ | `v26.13.1` | — |
| `npm` | Vendoring `onnxruntime-web@1.18.0` | ✓ | `12.0.2` | — |
| Python (`venv\Scripts\python.exe`) | Reference `measure_zones.py` / `onnxruntime` | ✓ | `3.14.2` | — |
| `onnxruntime-web@1.18.0` (npm) | Offline WASM runtime | ✓ (registry) | `1.18.0` | — |
| `pytest` / `playwright` CLI | Optional browser runner | ✗ | — | Use Node `v26.13.1` `node:test` + Python `onnxruntime` for deterministic parity, plus Playwright MCP / Chrome headless for E2E browser verification |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (`v26.13.1`) + Python `3.14.2` (`venv\Scripts\python.exe`) |
| Config file | None required (zero-dependency `node --test`) |
| Quick run command | `node --test tests/test_edge_parity.mjs` |
| Full suite command | `.\venv\Scripts\python.exe scripts/verify_js_parity.py && node --test tests/test_edge_parity.mjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **WASM-01** | Vendored `ort.wasm.min.js`, `ort-wasm.wasm`, `ort-wasm-simd.wasm` present; `numThreads=1`, `enableCpuMemArena=false`, `enableMemPattern=false`, `?simd=0` fallback, 10-run tensor disposal | unit + integration | `node --test tests/test_edge_parity.mjs` | ❌ Wave 0 |
| **WASM-02** | `inference_router.js` routes `appassets.androidplatform.net` / `?mode=edge-wasm` / offline → `edge-wasm`, online `/api/health` → `local-api`, unified JSON schema | unit | `node --test tests/test_edge_parity.mjs` | ❌ Wave 0 |
| **WASM-03** | `yolo_seg_decode.js` decodes `[1,39,N]` + `[1,32,S/4,S/4]` with NMS-first, ROI proto dot, 4× bilinear upsampling, and `1:1` + `4:3` letterbox unpadding | integration | `.\venv\Scripts\python.exe scripts/verify_js_parity.py` | ❌ Wave 0 |
| **WASM-04** | JS zone diameters within `< 0.2 mm` MAE vs Python on `1:1` and `4:3` plates; 36-ray Sobel `Δr` parity; `inner_colony` alert emitted when class `2` detected | integration | `.\venv\Scripts\python.exe scripts/verify_js_parity.py` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/test_edge_parity.mjs`
- **Per wave merge:** `.\venv\Scripts\python.exe scripts/verify_js_parity.py && node --test tests/test_edge_parity.mjs`
- **Phase gate:** Full parity suite green (`MAE < 0.20 mm` on `1:1` and `4:3` plates) + browser verification (SIMD + `?simd=0` + 10-plate memory stability + offline network panel check) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/verify_js_parity.py` — Runs Python `onnxruntime` + `measure_zones.py` / `cross_validation.py` on held-out `1:1` plates + synthesized `1600x1200` (`4:3`) plate, invokes `mvp_web/inference/yolo_seg_decode.js` + `sobel_cv.js` via Node.js on the exact same tensors/images, and asserts `MAE < 0.20 mm`.
- [ ] `tests/test_edge_parity.mjs` — Unit & integration tests for `inference_router.js`, `yolo_seg_decode.js` (including synthetic `inner_colony` class-2 detection), `sobel_cv.js`, and 10-run tensor disposal / memory stability.

---

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local offline clinical tool; no auth layer |
| V3 Session Management | no | Stateless client-side inference |
| V4 Access Control | no | Single-operator local bench device |
| V5 Input Validation | yes | Validate `?model=` against `model_meta.json` variant allow-list (prevent path traversal); validate `?mode=` to `'edge-wasm' \| 'local-api'`; validate image dimensions > 0 |
| V6 Cryptography | no | Model integrity SHA256 recorded in `model_meta.json` |

### Known Threat Patterns for Browser WASM / Static Frontend
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `?model=../../...` query param | Tampering / Info Disclosure | Resolve `?model=` strictly by exact `id` match in `model_meta.json` `variants[]`; reject unknown IDs and fall back to `yolo11n_seg_416_fp32`. |
| Unexpected CDN fallback leaking offline/clinical usage | Information Disclosure | Pin `ort.env.wasm.wasmPaths = './vendor/ort/'` and bundle all 3 ORT-Web 1.18.0 files locally; verify zero external requests in DevTools. |

---

## Sources

### Primary (HIGH confidence)
- `exports/model_meta.json` — Verified tensor shapes (`[1,39,3549]`, `[1,32,104,104]`), class IDs (`0: antibiotic_disk`, `1: inhibition_zone`, `2: inner_colony`), SHA256, and byte sizes.
- `exports/onnx_parity_report.json` — Verified `yolo11n_seg_416_fp32` (`0.4678 mm` MAE, `SHIPPABLE`).
- `src/evaluation/measure_zones.py`, `src/evaluation/cross_validation.py`, `src/evaluation/verify_onnx_parity.py`, `src/models/export_model.py` — Verified exact Python reference math.
- `mvp_web/app.js`, `mvp_web/index.html`, `mvp_web/sw.js`, `run_web_mvp.py` — Verified `/api/analyze` JSON schema and UI integration points.
- `npm view onnxruntime-web@1.18.0` — Verified version `1.18.0` and empty `scripts.postinstall`.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — Project-level v1.6 research on `onnxruntime-web@1.18.0` dist layout and 32-bit WebView constraints.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `onnxruntime-web@1.18.0` and Node `v26.13.1` verified directly.
- Architecture: HIGH — All integration points in `mvp_web/app.js` and `run_web_mvp.py` read verbatim.
- Pitfalls: HIGH — All 6 held-out plate dimensions verified directly, uncovering the need for a synthesized `4:3` test plate.

**Research date:** 2026-11-24
**Valid until:** 2026-12-24

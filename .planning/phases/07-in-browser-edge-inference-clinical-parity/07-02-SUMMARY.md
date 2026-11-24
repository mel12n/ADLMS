---
phase: 07-in-browser-edge-inference-clinical-parity
plan: 02
subsystem: edge-inference-runtime
tags: [onnxruntime-web, wasm, simd, inference-router, mvp-web, inner-colony]
requires:
  - phase: 07-in-browser-edge-inference-clinical-parity
    plan: 01
    provides: "Vendored ORT-Web 1.18.0 assets, yolo_seg_decode.js, sobel_cv.js, and model_meta.json"
provides:
  - "ORT-Web 1.18.0 singleton edge inference runtime with SIMD probe, allow-list validation, and tensor disposal (mvp_web/inference/edge_detector.js)"
  - "Dual-mode Edge WASM vs Local API router with APK origin bypass and 600 ms /api/health fallback (mvp_web/inference/inference_router.js)"
  - "Top-bar #runtime-mode-badge, routed loadUpload(), and inner_colony clinical alert badges in mvp_web/"
affects: [07-03, 08-android-webview-apk, 10-device-benchmarking]
tech-stack:
  added: []
  patterns: [singleton InferenceSession reuse, finally tensor disposal, AbortController 600ms health probe, UMD/IIFE dual-mode browser+Node modules]
key-files:
  created:
    - mvp_web/inference/edge_detector.js
    - mvp_web/inference/inference_router.js
  modified:
    - mvp_web/index.html
    - mvp_web/app.js
    - mvp_web/style.css
decisions:
  - "Enforced strict allow-list validation in resolveModelVariant against model_meta.json variants[].id (T-07-03), falling back to yolo11n_seg_416_fp32 on unknown or path-traversal strings."
  - "Bypassed /api/health completely on appassets.androidplatform.net (T-07-04) and ?mode=edge-wasm to guarantee zero network requests inside the offline Android APK."
  - "Wired inner_colony alerts into both renderPanel() row tags and renderCaliper() alert box without breaking run_web_mvp.py or preset plates."
metrics:
  duration: "~4 min"
  completed: "2026-11-24"
status: complete
commits: 3
plan_head_before: 4ddc4cf465006feeedb88093885244e079849ba8
plan_head_after: e91da12
---

# Phase 7 Plan 02: ORT-Web Edge Runtime, Dual-Mode Router & UI Wiring Summary

**Implemented the `onnxruntime-web@1.18.0` singleton edge runtime (`edge_detector.js`) and dual-mode `inference_router.js`, and wired automatic Edge WASM / Local API routing, top-bar mode badge, and `inner_colony` alerts into `mvp_web/`.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-11-24
- **Tasks:** 3/3
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

1. **Task 1 (`7b4c254`) — ORT-Web 1.18.0 Edge Runtime (`mvp_web/inference/edge_detector.js`):**
   - Implemented `supportsWasmSimd()` (WebAssembly 128-bit SIMD validation probe), `resolveModelVariant()` (strict allow-list against `model_meta.json`, blocking path traversal), `configureOrtEnv()` (`wasmPaths='./vendor/ort/'`, `numThreads=1`, `proxy=false`, `?simd=0` scalar fallback), reusable letterbox canvas preprocessing (`#727272`), singleton `InferenceSession` caching (`enableCpuMemArena=false`, `enableMemPattern=false`), `finally` tensor disposal, and unified `/api/analyze` payload enrichment with `ADLMS_YOLO_DECODE` + `ADLMS_SOBEL_CV`.
2. **Task 2 (`0ff9d18`) — Dual-Mode Inference Router (`mvp_web/inference/inference_router.js`):**
   - Implemented `detectRuntimeMode()` routing `appassets.androidplatform.net` and `?mode=edge-wasm` directly to `edge-wasm` (zero network calls), and otherwise probing `GET /api/health` with a 600 ms `AbortController` timeout to select `local-api` or fall back cleanly to `edge-wasm`.
   - Implemented `analyzePlate()` dispatching to `POST /api/analyze` (with network-failure fallback to `edge-wasm`) or `ADLMS_EDGE_DETECTOR.runEdgeInference()`.
3. **Task 3 (`e91da12`) — `mvp_web/` UI & Script Wiring (`index.html`, `app.js`, `style.css`):**
   - Added `#runtime-mode-badge` in the top bar and loaded vendored `ort.wasm.min.js` + inference modules locally in exact dependency order before `app.js`.
   - Routed `loadUpload()` and `probeBackend()` through `ADLMS_INFERENCE_ROUTER`, updated `#meta-engine` and `#runtime-mode-badge`, and rendered `Colonias internas` badges in `renderPanel()` and `renderCaliper()`.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Task 1 `<automated>` + `node --check`: `OK: edge_detector UMD + allow-list + SIMD probe = true`
- Task 2 `<automated>` + `node --check`: `OK: inference_router all 4 routing cases verified`
- Task 3 `<automated>` + `node --check`: `OK: mvp_web/index.html & app.js wiring verified`

## Self-Check: PASSED

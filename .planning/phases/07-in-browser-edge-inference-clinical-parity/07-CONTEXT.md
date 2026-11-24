# Phase 7: In-Browser Edge Inference & Clinical Parity - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Bundle `onnxruntime-web@1.18.0` locally inside `mvp_web/` (`WASM-01`), add dual-mode `inference_router.js` (`WASM-02`), decode `YOLO11n-seg` outputs (`output0 [1,39,N]` + `output1 [1,32,S/4,S/4]`) in pure JS (`WASM-03`), and achieve `< 0.2 mm` parity vs Python `measure_zones.py` including 6.0 mm median disk fiducial scaling, 1:1 disk-zone pairing, 36-ray Sobel cross-validation (`Δr <= 1.2 mm`), and `inner_colony` alerts (`WASM-04`).

</domain>

<decisions>
## Implementation Decisions

### Default Model & Runtime Switching (`WASM-01`)
- **Default shipping artifact:** Default to `yolo11n_seg_416_fp32.onnx` (verified at `MAE = 0.4678 mm <= 0.50 mm` in Phase 6) staged under `mvp_web/models/` alongside `model_meta.json`, with `?model=<variant_id>` query override so Phase 10 can benchmark all 4 variants without code changes.
- **ORT-Web memory hygiene:** Pin `onnxruntime-web@1.18.0` in `mvp_web/vendor/ort/` (`ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`) with `ort.env.wasm.numThreads = 1`, `enableCpuMemArena = false`, `enableMemPattern = false`, singleton session reuse, and explicit `tensor.dispose()` after every run.

### Inference Router & Mode Badge (`WASM-02`)
- **Auto-routing rule:** If `location.hostname === 'appassets.androidplatform.net'` or `?mode=edge-wasm` is set → route directly to local ORT-Web (`edge-wasm`). Otherwise probe `GET /api/health` (600 ms timeout) → use `POST /api/analyze` (`local-api`) if reachable, else fall back cleanly to `edge-wasm`.
- **UI indicator:** Display a compact runtime mode badge (`Edge WASM` vs `Local API`) in the top bar while keeping `mvp_web/` 100% compatible with `run_web_mvp.py`.

### SIMD Policy (`WASM-01`)
- **Auto-probe with scalar fallback:** Probe WASM SIMD support at boot and load `ort-wasm-simd.wasm` when supported, falling back cleanly to scalar `ort-wasm.wasm` if unsupported or when `?simd=0` is passed.

### Golden Parity Verification (`WASM-04`)
- **Automated parity harness:** Provide an automated headless browser / Node parity test script comparing the pure-JS decoder output (letterbox unpadding, 4× bilinear logit upsampling, 6.0 mm median disk scale, 1:1 pairing, 36-ray Sobel `Δr`, `inner_colony` flag) against Python `src/evaluation/measure_zones.py` on both `1:1` and `4:3` held-out plates (`< 0.2 mm` MAE target).

### Claude's Discretion
- Exact module split inside `mvp_web/inference/` (`inference_router.js`, `edge_detector.js`, `yolo_seg_decode.js`, `sobel_cv.js`) and whether to load via classic `<script>` tags or ES modules (compatible with both `run_web_mvp.py` and `WebViewAssetLoader`).
- Exact 10-plate memory stability check mechanism in the headless test.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Milestone Specs
- `.planning/PROJECT.md` — v1.6 Edge Device Demo (TR6948) goal, Fase 2 evaluation criteria (`MAE <= 0.50 mm`, `Δr <= 1.2 mm`, `TRT <= 2.0 s`)
- `.planning/REQUIREMENTS.md` — `WASM-01`, `WASM-02`, `WASM-03`, `WASM-04`
- `.planning/ROADMAP.md` — Phase 7 goal and 5 success criteria

### Research & Phase 6 Outputs
- `.planning/research/STACK.md` — `onnxruntime-web@1.18.0` dist layout (`ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`)
- `.planning/research/ARCHITECTURE.md` — Dual-mode `inference_router.js`, `edge_detector.js`, `yolo_seg_decode.js` contract
- `.planning/research/PITFALLS.md` — `[1, 39, N]` stride, sigmoid-before-crop, `4:3` letterbox unpadding, 4× bilinear upsampling
- `exports/model_meta.json` — Exported ONNX tensor shapes, class names, SHA256 hashes
- `exports/onnx_parity_report.json` — Phase 6 Python ONNX parity baseline (`yolo11n_seg_416_fp32`: `0.4678 mm`)

### Codebase Files
- `mvp_web/app.js` — Existing `loadUpload()`, `buildDiscsFromPlateData()`, `evaluate()`, `renderPanel()`
- `mvp_web/index.html` — Script loading and top-bar status area
- `src/evaluation/measure_zones.py` — Reference 6.0 mm median disk scaling and 1:1 disk-zone pairing
- `src/evaluation/cross_validation.py` — Reference 36-ray radial Sobel (`Δr <= 1.2 mm`) and intrinsic resistance rules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mvp_web/breakpoints_data.js`: Already bundles all 65 EUCAST v16.1 / CLSI M100 drugs, 8 groups, and 7 intrinsic resistance rules as `window.ADLMS_BREAKPOINTS`.
- `mvp_web/app.js`: Already consumes the normalized `/api/analyze` JSON payload in `loadUpload()` and renders `geoAlert` / `Δr` badges.
- `exports/yolo11n_seg_416_fp32.onnx` (and the other 3 variants): Ready in `exports/` from Phase 6.

### Established Patterns & Gaps
- `mvp_web/` is zero-build Vanilla ES2022; no bundler (Vite/Webpack) should be introduced.
- Node `v26.13.1` / `npm` is available on the Windows host to fetch `onnxruntime-web@1.18.0` dist files into `mvp_web/vendor/ort/`.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 7 scope.

</deferred>

---

*Phase: 07-in-browser-edge-inference-clinical-parity*
*Context gathered: 2026-11-24*

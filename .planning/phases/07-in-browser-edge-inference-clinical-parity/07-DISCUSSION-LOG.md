# Phase 7: In-Browser Edge Inference & Clinical Parity - Discussion Log

**Date:** 2026-11-24
**Phase:** 07-in-browser-edge-inference-clinical-parity

## Areas Discussed

### 1. Inference Router & Mode Badge (`WASM-02`)
- **Options:** (a) Auto-route (APK / `?mode=edge-wasm` -> Edge WASM; else probe `/api/health` 600ms -> Local API or fallback Edge WASM) + compact mode badge; (b) Always default to Edge WASM unless `?mode=api`.
- **Selected:** (a) Auto-route with 600ms `/api/health` probe + compact mode badge in top bar.

### 2. SIMD Policy (`WASM-01`)
- **Options:** (a) Auto-probe SIMD at boot with clean fallback to scalar `ort-wasm.wasm` (and `?simd=0` override); (b) Force scalar by default.
- **Selected:** (a) Auto-probe WASM SIMD at boot with scalar fallback and `?simd=0` override.

### 3. Golden Parity Verification (`WASM-04`)
- **Options:** (a) Automated headless browser/Node parity test script comparing JS decoder vs Python `measure_zones.py` (`< 0.2 mm` on 1:1 and 4:3 held-out plates); (b) Manual Chrome DevTools check only.
- **Selected:** (a) Automated headless browser/Node parity test script.

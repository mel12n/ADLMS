---
phase: 7
slug: in-browser-edge-inference-clinical-parity
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (`v26.13.1`) + Python `3.14.2` (`venv\Scripts\python.exe`) |
| **Config file** | None required (zero-dependency `node --test`) |
| **Quick run command** | `node --test tests/test_edge_parity.mjs` |
| **Full suite command** | `.\venv\Scripts\python.exe scripts/verify_js_parity.py && node --test tests/test_edge_parity.mjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run task `<verify>` command (or `node --test tests/test_edge_parity.mjs` once created in 07-03).
- **After every plan wave:** Run `.\venv\Scripts\python.exe scripts/verify_js_parity.py && node --test tests/test_edge_parity.mjs` (once 07-03 is complete).
- **Before `/gsd-verify-work`:** Full suite must be green (`MAE < 0.20 mm` on `1:1` and `4:3` plates) plus manual browser verification of SIMD / `?simd=0` and offline network panel.
- **Max feedback latency:** 20 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | WASM-01 | T-07-01 / T-07-SC | Vendored ORT-Web 1.18.0 + SHA256-verified model | smoke | `node -e "..."` (SHA256 + file check) | ✅ (inline) | ⬜ pending |
| 07-01-02 | 01 | 1 | WASM-03, WASM-04 | T-07-02 | Clamped ROI decode + 4:3 letterbox unpad | unit | `node -e "..."` (UMD + 4:3 letterbox) | ✅ (inline) | ⬜ pending |
| 07-01-03 | 01 | 1 | WASM-04 | T-07-02 | Clamped 36-ray Sobel gradient accuracy | unit | `node -e "..."` (synthetic halo Sobel) | ✅ (inline) | ⬜ pending |
| 07-02-01 | 02 | 2 | WASM-01 | T-07-03 | `?model=` allow-list blocks path traversal | unit | `node -e "..."` (allow-list + SIMD probe) | ✅ (inline) | ⬜ pending |
| 07-02-02 | 02 | 2 | WASM-02 | T-07-04 | APK origin never fetches `/api/health` | unit | `node -e "..."` (4 routing paths) | ✅ (inline) | ⬜ pending |
| 07-02-03 | 02 | 2 | WASM-02, WASM-04 | — | Local script tags + mode badge + `innerColony` | smoke | `node -e "..."` (index.html + app.js check) | ✅ (inline) | ⬜ pending |
| 07-03-01 | 03 | 3 | WASM-01..04 | T-07-03 / T-07-04 | 10-run tensor disposal + SIMD/scalar + `inner_colony` | unit+int | `node --test tests/test_edge_parity.mjs` | ❌ 07-03 | ⬜ pending |
| 07-03-02 | 03 | 3 | WASM-03, WASM-04 | T-07-05 | JS vs Python `< 0.20 mm` MAE on 1:1 & 4:3 plates | integration | `.\venv\Scripts\python.exe scripts/verify_js_parity.py` | ❌ 07-03 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_edge_parity.mjs` — Created in Plan 07-03 Task 1 (`node:test` unit + 10-run disposal stability).
- [ ] `scripts/verify_js_parity.py` — Created in Plan 07-03 Task 2 (Python vs JS golden parity on `1:1` and `1600x1200` `4:3` plates).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop Chrome DevTools Network panel shows zero CDN requests and zero `/api/analyze` calls when `run_web_mvp.py` is stopped | WASM-01, WASM-02 | Requires real browser DevTools network inspection | Serve `mvp_web/` statically (e.g. `python -m http.server 8080 -d mvp_web`), open in Chrome with Network tab, upload a plate, confirm only local `./vendor/ort/*` and `./models/*` requests occur and badge reads `Edge WASM`. |
| `?simd=0` loads scalar `ort-wasm.wasm` in Chrome | WASM-01 | Requires browser WASM loader network verification | Open `http://127.0.0.1:8080/?simd=0`, upload a plate, confirm `ort-wasm.wasm` (not `ort-wasm-simd.wasm`) is fetched and analysis completes. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution

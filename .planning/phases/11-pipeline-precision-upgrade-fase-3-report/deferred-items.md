# Deferred Items — Phase 11

## Out-of-Scope Pre-Existing Failures

1. **`tests/test_phase9_tablet_formulary.mjs:69` (`APK CSS must hide .bg-glow`)**
   - **Observed during:** Phase 11 Plan 03 verification (`node --test tests/test_edge_parity.mjs tests/test_phase9_tablet_formulary.mjs tests/test_phase10_benchmark.mjs tests/test_phase11_precision.mjs`).
   - **Cause:** Pre-existing commit `6d2f48aa26fbe9b0e15233431c3463d85cfcd2a3` ("chore(web): add Vercel config, bump SW cache, homologate UI and fix FHIR R4") intentionally generalized `.bg-glow { display: none !important; }` in `mvp_web/style.css:1454` to apply to both Web and APK views (removing the `body[data-runtime="apk"]` prefix), leaving the Phase 9 literal string check `css.includes('body[data-runtime="apk"] .bg-glow')` stale.
   - **Action:** Left untouched per Phase 11 scope boundary (not caused by Phase 11 changes); update `tests/test_phase9_tablet_formulary.mjs:69` in a dedicated UI test maintenance task.

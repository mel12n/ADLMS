/* ============================================================================
 * DeepHalo · ADLMS — Stage Latency Telemetry UI & [ADLMS_BENCH] Logger
 * Single Responsibility: Format 4-stage inference timings into #meta-engine
 * via textContent (no innerHTML) and emit [ADLMS_BENCH] JSON lines.
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_TELEMETRY_UI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function parseBenchCount(searchStr) {
    if (!searchStr || typeof searchStr !== 'string') return 0;
    var m = searchStr.match(/(?:^\?|&)bench=(\d+)(?:&|$)/);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n > 50 ? 50 : n;
  }

  function normalizeTimings(data, extras) {
    var d = data || {};
    var ex = extras || {};
    return {
      preprocessMs: num(d.preprocess_ms),
      ortInferenceMs: num(d.inference_ms),
      postprocessMs: num(d.postprocess_ms),
      totalMs: num(d.total_ms),
      model: String(d.model_variant || d.model || 'unknown'),
      mode: String(ex.mode || d.mode || 'edge-wasm'),
      simd: Boolean(d.simd_enabled),
      detections: Array.isArray(d.discs) ? d.discs.length : num(d.detections),
      plate: ex.plate ? String(ex.plate) : null,
      run: ex.runIndex ? num(ex.runIndex) : null,
      totalRuns: ex.totalRuns ? num(ex.totalRuns) : null,
    };
  }

  function formatEngineText(t) {
    if (t.mode === 'local-api') {
      return 'Local API \u00b7 ' + t.model + ' \u00b7 tot ' + t.totalMs + 'ms';
    }
    var flag = t.simd ? 'SIMD' : 'Scalar';
    return t.model + ' \u00b7 ' + flag +
      ' | pre ' + t.preprocessMs + 'ms' +
      ' \u00b7 ort ' + t.ortInferenceMs + 'ms' +
      ' \u00b7 post ' + t.postprocessMs + 'ms' +
      ' \u00b7 tot ' + t.totalMs + 'ms';
  }

  function recordAnalysis(data, opts) {
    var options = opts || {};
    var t = normalizeTimings(data, options);
    var el = options.el || (typeof document !== 'undefined' ? document.getElementById('meta-engine') : null);
    if (el) {
      el.textContent = formatEngineText(t);
    }
    var logFn = typeof options.log === 'function' ? options.log : console.log;
    logFn('[ADLMS_BENCH] ' + JSON.stringify(t));
    return t;
  }

  function emitBenchDone(summary, opts) {
    var options = opts || {};
    var logFn = typeof options.log === 'function' ? options.log : console.log;
    logFn('[ADLMS_BENCH_DONE] ' + JSON.stringify(summary || {}));
  }

  return {
    parseBenchCount: parseBenchCount,
    normalizeTimings: normalizeTimings,
    formatEngineText: formatEngineText,
    recordAnalysis: recordAnalysis,
    emitBenchDone: emitBenchDone,
  };
});

/* ADLMS — Dual-Mode Inference Router (Edge WASM vs Local Python API)
 * Zero-build UMD/IIFE module: attaches window.ADLMS_INFERENCE_ROUTER in browsers and module.exports in Node.js.
 * Implements WASM-02: APK origin & ?mode=edge-wasm bypass network entirely; desktop probes /api/health (600 ms)
 * with automatic offline fallback to in-browser ORT-Web.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.ADLMS_INFERENCE_ROUTER = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var APK_HOSTNAME = 'appassets.androidplatform.net';
  var HEALTH_TIMEOUT_MS = 600;
  var _activeMode = null;

  function parseQueryParam(searchStr, key) {
    if (!searchStr || typeof searchStr !== 'string') return null;
    try {
      var params = new URLSearchParams(searchStr);
      return params.get(key);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Detect active runtime mode ('edge-wasm' or 'local-api').
   * @param {object} [env] - Optional overrides { hostname, search, fetchImpl, timeoutMs }
   * @returns {Promise<'edge-wasm'|'local-api'>}
   */
  async function detectRuntimeMode(env) {
    var e = env || {};
    var hostname = e.hostname != null ? e.hostname : (typeof location !== 'undefined' ? location.hostname : '');
    var search = e.search != null ? e.search : (typeof location !== 'undefined' ? location.search : '');

    // T-07-04: On Android WebViewAssetLoader origin, never issue /api/health or any network request.
    if (hostname === APK_HOSTNAME) {
      _activeMode = 'edge-wasm';
      return _activeMode;
    }

    var modeOverride = parseQueryParam(search, 'mode');
    if (modeOverride === 'edge-wasm') {
      _activeMode = 'edge-wasm';
      return _activeMode;
    }
    if (modeOverride === 'local-api') {
      _activeMode = 'local-api';
      return _activeMode;
    }

    var fetchFn = e.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) {
      _activeMode = 'edge-wasm';
      return _activeMode;
    }

    var timeoutMs = e.timeoutMs != null ? e.timeoutMs : HEALTH_TIMEOUT_MS;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    try {
      if (controller) {
        timer = setTimeout(function () {
          try { controller.abort(); } catch (_err) {}
        }, timeoutMs);
      }
      var res = await fetchFn('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      if (res && res.ok) {
        var payload = await res.json();
        if (payload && payload.model_exists === true) {
          _activeMode = 'local-api';
          return _activeMode;
        }
      }
    } catch (_err) {
      // Timeout, offline, or non-API static server -> fall back cleanly to edge-wasm
    } finally {
      if (timer !== null) clearTimeout(timer);
    }

    _activeMode = 'edge-wasm';
    return _activeMode;
  }

  function getActiveMode() {
    return _activeMode;
  }

  function resetActiveMode() {
    _activeMode = null;
  }

  /**
   * Unified plate analysis dispatcher.
   * @param {File|Blob|null} file
   * @param {HTMLImageElement|HTMLCanvasElement} img
   * @param {object} [opts] - { organism, group, standard, dataUrl, fetchImpl }
   */
  async function analyzePlate(file, img, opts) {
    var o = opts || {};
    var mode = _activeMode || await detectRuntimeMode(o.env);

    if (mode === 'local-api') {
      var fetchFn = o.fetchImpl || (typeof fetch === 'function' ? fetch : null);
      if (fetchFn && o.dataUrl) {
        try {
          var res = await fetchFn('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_base64: o.dataUrl,
              organism: o.organism || 'ecoli',
              group: o.group || 'Enterobacterales',
              standard: o.standard || 'EUCAST',
              enable_ocr: true,
              ocr_angles: 8
            })
          });
          if (res.ok) {
            var apiData = await res.json();
            if (!apiData.error) {
              apiData.runtime_mode = 'local-api';
              return apiData;
            }
          }
        } catch (_netErr) {
          // Local Python server became unreachable; fall back cleanly to edge-wasm
          _activeMode = 'edge-wasm';
          mode = 'edge-wasm';
        }
      } else {
        _activeMode = 'edge-wasm';
        mode = 'edge-wasm';
      }
    }

    var edgeDetector = (root && root.ADLMS_EDGE_DETECTOR) || (typeof require === 'function' ? require('./edge_detector.js') : null);
    if (!edgeDetector || typeof edgeDetector.runEdgeInference !== 'function') {
      throw new Error('ADLMS_EDGE_DETECTOR is not loaded');
    }

    var edgeData = await edgeDetector.runEdgeInference(img, o);
    edgeData.runtime_mode = 'edge-wasm';
    return edgeData;
  }

  return {
    detectRuntimeMode: detectRuntimeMode,
    getActiveMode: getActiveMode,
    resetActiveMode: resetActiveMode,
    analyzePlate: analyzePlate
  };
});

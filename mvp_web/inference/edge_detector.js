/* ADLMS — In-Browser Edge Inference Runtime (onnxruntime-web@1.18.0)
 * Zero-build UMD/IIFE module: attaches window.ADLMS_EDGE_DETECTOR in browsers and module.exports in Node.js.
 * Implements WASM-01 (memory hygiene, singleton session, SIMD auto-probe + scalar fallback, tensor disposal)
 * and unifies YOLO11n-seg decoding + 36-ray radial Sobel geometric cross-validation into the /api/analyze schema.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.ADLMS_EDGE_DETECTOR = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DEFAULT_MODEL_ID = 'yolo11n_seg_416_fp32';
  var ORT_WASM_PATHS = './vendor/ort/';
  var MODELS_BASE_PATH = './models/';

  var _metaCache = null;
  var _sessionCache = Object.create(null);
  var _ortConfigured = false;
  var _simdEnabled = false;
  var _letterboxCanvas = null;
  var _origCanvas = null;

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function round4(v) {
    return Math.round(v * 10000) / 10000;
  }

  function computeMedian(values) {
    if (!values || values.length === 0) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  function safeRequire(modPath) {
    try {
      return require(modPath);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Separable 3x3 Gaussian blur ([1, 2, 1] / 4) for post-ROI CLAHE luminance (D-03, D-04).
   */
  function blurLuminance3x3(lum, width, height) {
    var n = width * height;
    var tmp = new Float32Array(n);
    var out = new Float32Array(n);
    var maxX = width - 1;
    var maxY = height - 1;

    for (var y = 0; y < height; y++) {
      var row = y * width;
      for (var x = 0; x < width; x++) {
        var xm1 = x > 0 ? x - 1 : 0;
        var xp1 = x < maxX ? x + 1 : maxX;
        tmp[row + x] = (lum[row + xm1] + 2.0 * lum[row + x] + lum[row + xp1]) * 0.25;
      }
    }

    for (var y2 = 0; y2 < height; y2++) {
      var ym1 = (y2 > 0 ? y2 - 1 : 0) * width;
      var y0 = y2 * width;
      var yp1 = (y2 < maxY ? y2 + 1 : maxY) * width;
      for (var x2 = 0; x2 < width; x2++) {
        out[y0 + x2] = (tmp[ym1 + x2] + 2.0 * tmp[y0 + x2] + tmp[yp1 + x2]) * 0.25;
      }
    }

    return out;
  }

  /**
   * Auto-probe WebAssembly 128-bit SIMD support using minimal valid SIMD module bytes.
   * Returns false safely on engines without WebAssembly or SIMD.
   */
  function supportsWasmSimd() {
    try {
      if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') {
        return false;
      }
      var simdBytes = new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0,
        1, 5, 1, 96, 0, 1, 123,
        3, 2, 1, 0,
        10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]);
      return WebAssembly.validate(simdBytes);
    } catch (_e) {
      return false;
    }
  }

  /**
   * Parse query string safely in both browser and Node environments.
   */
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
   * Strict allow-list lookup for ?model=<variant_id> against model_meta.json variants[].id.
   * Blocks path traversal (e.g. ../../etc/passwd) and unknown IDs by falling back to DEFAULT_MODEL_ID.
   */
  function resolveModelVariant(meta, searchStr) {
    var variants = (meta && Array.isArray(meta.variants)) ? meta.variants : [];
    if (variants.length === 0) {
      throw new Error('model_meta.json contains no variants');
    }

    var requested = parseQueryParam(searchStr, 'model');
    if (requested) {
      for (var i = 0; i < variants.length; i++) {
        if (variants[i] && variants[i].id === requested) {
          return variants[i];
        }
      }
    }

    var preferredId = (meta && typeof meta.locked_variant === 'string' && meta.locked_variant)
      ? meta.locked_variant
      : DEFAULT_MODEL_ID;

    for (var j = 0; j < variants.length; j++) {
      if (variants[j] && variants[j].id === preferredId) {
        return variants[j];
      }
    }
    for (var k = 0; k < variants.length; k++) {
      if (variants[k] && variants[k].id === DEFAULT_MODEL_ID) {
        return variants[k];
      }
    }
    return variants[0];
  }

  /**
   * Configure onnxruntime-web@1.18.0 WASM environment with strict mobile memory hygiene.
   */
  function configureOrtEnv(ortRef, searchStr) {
    var ortObj = ortRef || (root && root.ort);
    if (!ortObj || !ortObj.env || !ortObj.env.wasm) {
      throw new Error('onnxruntime-web (ort.env.wasm) is not loaded');
    }

    var simdParam = parseQueryParam(searchStr, 'simd');
    var useSimd = simdParam === '0' ? false : supportsWasmSimd();

    ortObj.env.wasm.wasmPaths = ORT_WASM_PATHS;
    ortObj.env.wasm.numThreads = 1;
    ortObj.env.wasm.proxy = false;
    ortObj.env.wasm.simd = useSimd;

    _ortConfigured = true;
    _simdEnabled = useSimd;
    return {
      simdEnabled: useSimd,
      wasmPaths: ORT_WASM_PATHS,
      numThreads: 1,
      proxy: false
    };
  }

  async function loadModelMeta(fetchImpl) {
    if (_metaCache) return _metaCache;
    var f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) throw new Error('fetch API unavailable for loading model_meta.json');
    var res = await f(MODELS_BASE_PATH + 'model_meta.json', { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error('Failed to load model_meta.json: HTTP ' + res.status);
    }
    _metaCache = await res.json();
    return _metaCache;
  }

  async function getOrCreateSession(ortObj, variant) {
    if (_sessionCache[variant.id]) {
      return _sessionCache[variant.id];
    }
    var modelUrl = MODELS_BASE_PATH + variant.filename;
    var session = await ortObj.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      enableCpuMemArena: false,
      enableMemPattern: false,
      graphOptimizationLevel: 'all'
    });
    _sessionCache[variant.id] = session;
    return session;
  }

  /**
   * Draw image onto a reusable offscreen letterbox canvas (imgsz x imgsz, #727272 pad)
   * and convert RGBA to normalized NCHW Float32Array [1, 3, imgsz, imgsz].
   */
  function preprocessImageToNchw(img, imgsz) {
    var decoder = (root && root.ADLMS_YOLO_DECODE) || (typeof require === 'function' ? require('./yolo_seg_decode.js') : null);
    if (!decoder || typeof decoder.computeLetterbox !== 'function') {
      throw new Error('ADLMS_YOLO_DECODE is not loaded');
    }

    var origW = img.naturalWidth || img.width;
    var origH = img.naturalHeight || img.height;
    var lb = decoder.computeLetterbox(origW, origH, imgsz);

    if (!_letterboxCanvas) {
      _letterboxCanvas = document.createElement('canvas');
    }
    if (_letterboxCanvas.width !== imgsz || _letterboxCanvas.height !== imgsz) {
      _letterboxCanvas.width = imgsz;
      _letterboxCanvas.height = imgsz;
    }

    var ctx = _letterboxCanvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, imgsz, imgsz);
    ctx.drawImage(img, 0, 0, origW, origH, lb.padLeft, lb.padTop, lb.newW, lb.newH);

    var rgba = ctx.getImageData(0, 0, imgsz, imgsz).data;
    var area = imgsz * imgsz;
    var nchw = new Float32Array(3 * area);
    var inv255 = 1.0 / 255.0;

    for (var i = 0; i < area; i++) {
      var off = i << 2;
      nchw[i] = rgba[off] * inv255;
      nchw[area + i] = rgba[off + 1] * inv255;
      nchw[2 * area + i] = rgba[off + 2] * inv255;
    }

    return { nchw: nchw, lb: lb, origW: origW, origH: origH };
  }

  /**
   * Extract original-resolution RGBA pixels from img for 36-ray radial Sobel cross-validation.
   */
  function extractOriginalRgba(img, origW, origH) {
    if (!_origCanvas) {
      _origCanvas = document.createElement('canvas');
    }
    if (_origCanvas.width !== origW || _origCanvas.height !== origH) {
      _origCanvas.width = origW;
      _origCanvas.height = origH;
    }
    var ctx = _origCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, origW, origH);
    return ctx.getImageData(0, 0, origW, origH).data;
  }

  /**
   * Run full in-browser YOLO11n-seg + 36-ray Sobel inference and return the unified /api/analyze payload.
   */
  async function runEdgeInference(img, opts) {
    var o = opts || {};
    var searchStr = o.search != null ? o.search : (typeof location !== 'undefined' ? location.search : '');
    var ortObj = o.ort || (root && root.ort);
    if (!ortObj) {
      throw new Error('onnxruntime-web (window.ort) is not loaded');
    }

    var decoder = (root && root.ADLMS_YOLO_DECODE) || (typeof require === 'function' ? require('./yolo_seg_decode.js') : null);
    var sobel = (root && root.ADLMS_SOBEL_CV) || (typeof require === 'function' ? require('./sobel_cv.js') : null);
    if (!decoder || !sobel) {
      throw new Error('ADLMS_YOLO_DECODE or ADLMS_SOBEL_CV is not loaded');
    }

    var t0 = performance.now();

    if (!_ortConfigured) {
      configureOrtEnv(ortObj, searchStr);
    }

    var meta = o.meta || await loadModelMeta(o.fetchImpl);
    var variant = resolveModelVariant(meta, searchStr);
    var imgsz = variant.imgsz || 416;
    var session = await getOrCreateSession(ortObj, variant);

    // 1. Preprocess
    var tPre0 = performance.now();
    var prep = preprocessImageToNchw(img, imgsz);
    var tPre1 = performance.now();

    // 2. ONNX Runtime WASM Inference with strict finally tensor disposal
    var inputName = session.inputNames[0];
    var inputTensor = new ortObj.Tensor('float32', prep.nchw, [1, 3, imgsz, imgsz]);
    var outputs = null;
    var out0Data = null;
    var out1Data = null;
    var out0Dims = null;
    var out1Dims = null;

    var tInf0 = performance.now();
    try {
      var feeds = {};
      feeds[inputName] = inputTensor;
      outputs = await session.run(feeds);

      var out0Tensor = outputs[session.outputNames[0]];
      var out1Tensor = outputs[session.outputNames[1]];
      out0Data = new Float32Array(out0Tensor.data);
      out1Data = new Float32Array(out1Tensor.data);
      out0Dims = out0Tensor.dims.slice();
      out1Dims = out1Tensor.dims.slice();
    } finally {
      if (inputTensor && typeof inputTensor.dispose === 'function') {
        inputTensor.dispose();
      }
      if (outputs) {
        var keys = Object.keys(outputs);
        for (var k = 0; k < keys.length; k++) {
          var t = outputs[keys[k]];
          if (t && typeof t.dispose === 'function') {
            t.dispose();
          }
        }
      }
    }
    var tInf1 = performance.now();

    // 3. Postprocess: YOLO11n-seg decode + post-ROI CLAHE high-res disk refinement + 36-ray Sobel CV
    var tPost0 = performance.now();
    var decoded = decoder.decodeYoloSeg(out0Data, out1Data, out0Dims, out1Dims, prep.lb, {
      confThresh: o.confThresh,
      iouThresh: o.iouThresh,
      maxDet: o.maxDet,
      zoneMaskThreshold: o.zoneMaskThreshold
    });

    var origRgba = extractOriginalRgba(img, prep.origW, prep.origH);
    var plateRoi = (root && root.ADLMS_PLATE_ROI) || (typeof require === 'function' ? safeRequire('./plate_roi.js') : null);
    var grayBlurred;
    if (plateRoi && typeof plateRoi.applyTileClaheLuminance === 'function') {
      var claheLum = plateRoi.applyTileClaheLuminance(origRgba, prep.origW, prep.origH, {
        tilesX: 8,
        tilesY: 8,
        clipLimit: 2.0
      });
      grayBlurred = blurLuminance3x3(claheLum, prep.origW, prep.origH);
    } else {
      grayBlurred = sobel.extractBlurredLuminance(origRgba, prep.origW, prep.origH);
    }

    // High-res (<= 1024 px) 6.0 mm disk diameter refinement (D-04, D-06)
    var oldFScale = decoded.scale_mm_per_px;
    var refinedDiskDiams = [];
    for (var di = 0; di < decoded.detections.length; di++) {
      var dDet = decoded.detections[di];
      dDet.raw_yolo_diam_mm = dDet.diam_mm;
      if (typeof sobel.refineDiskDiameterPx === 'function' && dDet.disk_diam_px > 0) {
        var refinedPx = sobel.refineDiskDiameterPx(
          grayBlurred,
          prep.origW,
          prep.origH,
          dDet.cx_px,
          dDet.cy_px,
          dDet.disk_diam_px
        );
        if (refinedPx > 0) {
          dDet.raw_yolo_disk_diam_px = dDet.disk_diam_px;
          dDet.disk_diam_px = refinedPx;
          refinedDiskDiams.push(refinedPx);
        }
      }
    }

    if (refinedDiskDiams.length > 0) {
      var refinedMedianPx = computeMedian(refinedDiskDiams);
      if (refinedMedianPx > 0) {
        var newPxPerMm = refinedMedianPx / 6.0;
        var newMmPerPx = 6.0 / refinedMedianPx;
        decoded.median_disk_px = round4(refinedMedianPx);
        decoded.scale_px_per_mm = round4(newPxPerMm);
        decoded.scale_mm_per_px = round4(newMmPerPx);
        if (oldFScale > 0) {
          for (var rj = 0; rj < decoded.detections.length; rj++) {
            var rDet = decoded.detections[rj];
            if (rDet.raw_yolo_diam_mm > 6.0 && rDet.zone_contour && rDet.zone_contour.length > 0) {
              var rawYoloDiamPx = rDet.raw_yolo_diam_mm / oldFScale;
              rDet.diam_mm = Math.max(6.0, round1(rawYoloDiamPx * newMmPerPx));
            }
          }
        }
      }
    }

    var fScale = decoded.scale_mm_per_px;
    for (var i = 0; i < decoded.detections.length; i++) {
      var det = decoded.detections[i];
      var diskRadiusPx = (det.disk_diam_px || decoded.median_disk_px || 20) * 0.5;
      var cv = sobel.validateZoneGeometry(
        grayBlurred,
        prep.origW,
        prep.origH,
        det.hx_px,
        det.hy_px,
        diskRadiusPx,
        det.diam_mm,
        fScale
      );
      det.sobel_mm = cv.sobel_diam_mm;
      det.delta_r_mm = cv.delta_r_mm;
      det.geo_valid = cv.geo_valid;
      det.geo_alert = cv.geo_alert;
      det.geo_status = cv.geo_status;
      det.geo_message = cv.geo_message;
    }
    var tPost1 = performance.now();

    return {
      scale_px_per_mm: decoded.scale_px_per_mm,
      scale_mm_per_px: decoded.scale_mm_per_px,
      median_disk_px: decoded.median_disk_px,
      disk_count: decoded.disk_count,
      zone_count: decoded.zone_count,
      inner_colony_count: decoded.inner_colony_count,
      preprocess_ms: round1(tPre1 - tPre0),
      inference_ms: round1(tInf1 - tInf0),
      postprocess_ms: round1(tPost1 - tPost0),
      total_ms: round1(tPost1 - t0),
      runtime_mode: 'edge-wasm',
      simd_enabled: _simdEnabled,
      model_variant: variant.id,
      neural_xai_map: decoded.neural_xai_map || null,
      detections: decoded.detections
    };
  }

  return {
    supportsWasmSimd: supportsWasmSimd,
    resolveModelVariant: resolveModelVariant,
    configureOrtEnv: configureOrtEnv,
    preprocessImageToNchw: preprocessImageToNchw,
    runEdgeInference: runEdgeInference
  };
});

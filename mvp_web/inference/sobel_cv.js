/* ADLMS — Pure-JS 36-Ray Radial Sobel Geometric Cross-Validation
 * Port of src/evaluation/cross_validation.py (zero OpenCV dependency).
 * Zero-build UMD/IIFE module: attaches window.ADLMS_SOBEL_CV in browsers and module.exports in Node.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_SOBEL_CV = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NUM_RAYS = 36;
  var DELTA_R_THRESHOLD_MM = 1.2;
  var MIN_VALID_RAYS = 6;
  var CONFLUENT_THRESHOLD_MM = 6.6;

  function clampInt(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function median(values) {
    if (!values || values.length === 0) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  /**
   * Compute luminance (0.299*R + 0.587*G + 0.114*B) and apply separable 5x5 Gaussian blur
   * ([1, 4, 6, 4, 1] / 16 horizontal then vertical with edge clamping) once per plate.
   * @param {Uint8ClampedArray|Uint8Array} rgba
   * @param {number} width
   * @param {number} height
   * @returns {Float32Array}
   */
  function extractBlurredLuminance(rgba, width, height) {
    if (!(width > 0) || !(height > 0)) {
      throw new Error('Invalid image dimensions: ' + width + 'x' + height);
    }
    var n = width * height;
    var lum = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var off = i << 2;
      lum[i] = 0.299 * rgba[off] + 0.587 * rgba[off + 1] + 0.114 * rgba[off + 2];
    }

    var tmp = new Float32Array(n);
    var out = new Float32Array(n);
    var maxX = width - 1;
    var maxY = height - 1;

    // Horizontal pass: [1, 4, 6, 4, 1] / 16
    for (var y = 0; y < height; y++) {
      var row = y * width;
      for (var x = 0; x < width; x++) {
        var xm2 = x - 2 < 0 ? 0 : x - 2;
        var xm1 = x - 1 < 0 ? 0 : x - 1;
        var xp1 = x + 1 > maxX ? maxX : x + 1;
        var xp2 = x + 2 > maxX ? maxX : x + 2;
        tmp[row + x] = (
          lum[row + xm2] +
          4.0 * lum[row + xm1] +
          6.0 * lum[row + x] +
          4.0 * lum[row + xp1] +
          lum[row + xp2]
        ) * 0.0625;
      }
    }

    // Vertical pass: [1, 4, 6, 4, 1] / 16
    for (var y2 = 0; y2 < height; y2++) {
      var ym2 = (y2 - 2 < 0 ? 0 : y2 - 2) * width;
      var ym1 = (y2 - 1 < 0 ? 0 : y2 - 1) * width;
      var y0 = y2 * width;
      var yp1 = (y2 + 1 > maxY ? maxY : y2 + 1) * width;
      var yp2 = (y2 + 2 > maxY ? maxY : y2 + 2) * width;
      for (var x2 = 0; x2 < width; x2++) {
        out[y0 + x2] = (
          tmp[ym2 + x2] +
          4.0 * tmp[ym1 + x2] +
          6.0 * tmp[y0 + x2] +
          4.0 * tmp[yp1 + x2] +
          tmp[yp2 + x2]
        ) * 0.0625;
      }
    }

    return out;
  }

  /**
   * 36-ray radial Sobel geometric cross-validation matching src/evaluation/cross_validation.py:82-202.
   * @param {Float32Array} grayBlurred - Output of extractBlurredLuminance
   * @param {number} width
   * @param {number} height
   * @param {number} cxPx
   * @param {number} cyPx
   * @param {number} diskRadiusPx
   * @param {number} yoloDiamMm
   * @param {number} fScale - mm per pixel (6.0 / medianDiskPx)
   */
  function validateZoneGeometry(grayBlurred, width, height, cxPx, cyPx, diskRadiusPx, yoloDiamMm, fScale) {
    if (yoloDiamMm <= CONFLUENT_THRESHOLD_MM || !(fScale > 0)) {
      return {
        sobel_diam_mm: round1(yoloDiamMm),
        delta_r_mm: 0.0,
        geo_valid: true,
        geo_alert: false,
        geo_message: 'Validado (sin halo / crecimiento confluente al disco)',
        rays_used: NUM_RAYS
      };
    }

    var yoloRadPx = (yoloDiamMm * 0.5) / fScale;
    var windowPx = Math.max(12.0, 3.8 / fScale);
    var rMin = Math.max(diskRadiusPx * 1.28, yoloRadPx - windowPx);
    var rMax = Math.min(yoloRadPx + windowPx, Math.min(width, height) * 0.5);
    var numSteps = Math.floor(rMax - rMin);

    if (numSteps < 5) {
      return {
        sobel_diam_mm: round1(yoloDiamMm),
        delta_r_mm: 0.0,
        geo_valid: true,
        geo_alert: false,
        geo_message: 'Validado (ventana radial insuficiente)',
        rays_used: 0
      };
    }

    var profile = new Float32Array(numSteps);
    var rayRadiiPx = [];
    var maxX = width - 1;
    var maxY = height - 1;

    for (var k = 0; k < NUM_RAYS; k++) {
      var theta = (2.0 * Math.PI * k) / NUM_RAYS;
      var cosT = Math.cos(theta);
      var sinT = Math.sin(theta);

      for (var s = 0; s < numSteps; s++) {
        var r = rMin + s;
        var sx = clampInt(Math.round(cxPx + cosT * r), 0, maxX);
        var sy = clampInt(Math.round(cyPx + sinT * r), 0, maxY);
        profile[s] = grayBlurred[sy * width + sx];
      }

      // 1D Sobel [-1, -2, 0, 2, 1], zero first 2 and last 2 samples
      var bestGrad = 0.0;
      var bestIdx = -1;
      for (var j = 2; j < numSteps - 2; j++) {
        var g = Math.abs(
          -1.0 * profile[j - 2] -
          2.0 * profile[j - 1] +
          2.0 * profile[j + 1] +
          1.0 * profile[j + 2]
        );
        if (g > bestGrad) {
          bestGrad = g;
          bestIdx = j;
        }
      }

      if (bestGrad > 1.0 && bestIdx >= 0) {
        rayRadiiPx.push(rMin + bestIdx);
      }
    }

    if (rayRadiiPx.length < MIN_VALID_RAYS) {
      return {
        sobel_diam_mm: round1(yoloDiamMm),
        delta_r_mm: 0.0,
        geo_valid: true,
        geo_alert: false,
        geo_message: 'Validado (gradiente radial bajo; se mantiene medición IA)',
        rays_used: rayRadiiPx.length
      };
    }

    var sobelRadPx = median(rayRadiiPx);
    var sobelRadMm = sobelRadPx * fScale;
    var sobelDiamMm = Math.max(6.0, sobelRadMm * 2.0);
    var deltaRMm = Math.abs(yoloDiamMm * 0.5 - sobelRadMm);
    var geoValid = deltaRMm <= DELTA_R_THRESHOLD_MM;

    return {
      sobel_diam_mm: round1(sobelDiamMm),
      delta_r_mm: round2(deltaRMm),
      geo_valid: geoValid,
      geo_alert: !geoValid,
      geo_message: geoValid
        ? 'Validado geométricamente (Δr=' + round2(deltaRMm) + ' mm ≤ 1.2 mm)'
        : 'Alerta geométrica: discrepancia IA vs Sobel (Δr=' + round2(deltaRMm) + ' mm > 1.2 mm) — requiere revisión manual',
      rays_used: rayRadiiPx.length
    };
  }

  return {
    extractBlurredLuminance: extractBlurredLuminance,
    validateZoneGeometry: validateZoneGeometry
  };
});

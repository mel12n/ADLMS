/* ADLMS — Pure-JS Petri Dish ROI, Elliptical Tilt Compensation & Post-ROI 8x8 Tile CLAHE
 * Zero-build UMD/IIFE module: attaches window.ADLMS_PLATE_ROI in browsers and module.exports in Node.js.
 * Implements D-01 (ROI + >85% skip fallback), D-03 (strict post-ROI CLAHE), D-07 (ellipse b/a tilt).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_PLATE_ROI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_DETECT_EDGE = 160;
  var MAX_OUTPUT_EDGE = 1024;
  var FILL_SKIP_THRESH = 0.85;
  var NUM_RAYS = 72;
  var MIN_VALID_RAYS = 18;
  var TILT_WARN_DEG = 5.0;
  var TILT_COMP_MIN_DEG = 2.0;
  var TILT_COMP_MIN_RATIO = 0.75;
  var CROP_MARGIN = 0.04;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function clampInt(v, lo, hi) {
    var iv = v | 0;
    return iv < lo ? lo : (iv > hi ? hi : iv);
  }

  function median(values) {
    if (!values || values.length === 0) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  function makeFallbackRoi(width, height) {
    var w = Math.max(1, Math.round(Number(width) || 1));
    var h = Math.max(1, Math.round(Number(height) || 1));
    return {
      found: false,
      cropped: false,
      fillRatio: 1.0,
      cx: w * 0.5,
      cy: h * 0.5,
      rx: w * 0.5,
      ry: h * 0.5,
      majorAxis: Math.min(w, h) * 0.5,
      minorAxis: Math.min(w, h) * 0.5,
      angleRad: 0,
      axisRatio: 1.0,
      tiltDeg: 0,
      tiltWarning: false,
      perspectiveCompensated: false,
      cropBox: { x: 0, y: 0, w: w, h: h }
    };
  }

  function percentile85(arr) {
    var sorted = Array.from(arr).sort(function (a, b) { return a - b; });
    if (sorted.length === 0) return 0;
    var idx = Math.min(sorted.length - 1, Math.floor(0.85 * (sorted.length - 1)));
    return sorted[idx];
  }

  function castRimRays(grad, dw, dh, cx, cy, edgeThresh, rStart, rEnd) {
    var hits = [];
    var radii = [];
    var maxX = dw - 1;
    var maxY = dh - 1;

    for (var k = 0; k < NUM_RAYS; k++) {
      var theta = (2.0 * Math.PI * k) / NUM_RAYS;
      var cosT = Math.cos(theta);
      var sinT = Math.sin(theta);
      var bestR = -1;
      var peakVal = 0;

      // Scan inward from rEnd to rStart to capture the outermost Petri dish rim peak
      for (var r = rEnd; r >= rStart; r -= 1) {
        var sx = Math.round(cx + cosT * r);
        var sy = Math.round(cy + sinT * r);
        if (sx < 1 || sx >= maxX || sy < 1 || sy >= maxY) continue;
        var g = grad[sy * dw + sx];
        if (g >= edgeThresh) {
          // Local peak refinement in a 3px neighborhood along the ray
          var bestLocalR = r;
          var bestLocalG = g;
          var rInnerLimit = Math.max(rStart, r - 3);
          for (var rr = r - 1; rr >= rInnerLimit; rr--) {
            var lx = Math.round(cx + cosT * rr);
            var ly = Math.round(cy + sinT * rr);
            if (lx < 1 || lx >= maxX || ly < 1 || ly >= maxY) break;
            var lg = grad[ly * dw + lx];
            if (lg > bestLocalG) {
              bestLocalG = lg;
              bestLocalR = rr;
            }
          }
          bestR = bestLocalR;
          peakVal = bestLocalG;
          break;
        }
      }

      if (bestR > 0 && peakVal >= edgeThresh) {
        hits.push({
          r: bestR,
          x: cx + cosT * bestR,
          y: cy + sinT * bestR
        });
        radii.push(bestR);
      }
    }

    if (hits.length < MIN_VALID_RAYS) {
      return [];
    }

    var medR = median(radii);
    var devs = [];
    for (var i = 0; i < radii.length; i++) {
      devs.push(Math.abs(radii[i] - medR));
    }
    var mad = median(devs);
    var tol = Math.max(3.0, 2.5 * mad * 1.4826);

    var inliers = [];
    for (var j = 0; j < hits.length; j++) {
      if (Math.abs(hits[j].r - medR) <= tol) {
        inliers.push(hits[j]);
      }
    }
    return inliers;
  }

  /**
   * Detect circular/elliptical Petri dish ROI on downscaled luminance (<= 160 px).
   * @param {Uint8ClampedArray|Uint8Array} rgba
   * @param {number} width
   * @param {number} height
   * @param {object} [opts]
   */
  function detectPlateRoi(rgba, width, height, opts) {
    if (!rgba || !(width > 0) || !(height > 0) || rgba.length < width * height * 4) {
      return makeFallbackRoi(width, height);
    }

    var o = opts || {};
    var maxDetect = (o.maxDetectEdge > 0) ? Math.min(MAX_DETECT_EDGE, o.maxDetectEdge) : MAX_DETECT_EDGE;
    var scale = Math.min(1.0, maxDetect / Math.max(width, height));
    var dw = Math.max(1, Math.round(width * scale));
    var dh = Math.max(1, Math.round(height * scale));
    if (dw < 16 || dh < 16) {
      return makeFallbackRoi(width, height);
    }

    var n = dw * dh;
    var lum = new Float32Array(n);
    var invScaleX = width / dw;
    var invScaleY = height / dh;

    for (var y = 0; y < dh; y++) {
      var sy = Math.min(height - 1, Math.floor((y + 0.5) * invScaleY));
      var rowOff = sy * width;
      var dRow = y * dw;
      for (var x = 0; x < dw; x++) {
        var sx = Math.min(width - 1, Math.floor((x + 0.5) * invScaleX));
        var pOff = (rowOff + sx) << 2;
        lum[dRow + x] = 0.299 * rgba[pOff] + 0.587 * rgba[pOff + 1] + 0.114 * rgba[pOff + 2];
      }
    }

    // 1-pass separable 3x3 box blur
    var tmp = new Float32Array(n);
    var blurred = new Float32Array(n);
    var maxX = dw - 1;
    var maxY = dh - 1;
    var inv3 = 1.0 / 3.0;

    for (var by = 0; by < dh; by++) {
      var row = by * dw;
      for (var bx = 0; bx < dw; bx++) {
        var xm1 = bx > 0 ? bx - 1 : 0;
        var xp1 = bx < maxX ? bx + 1 : maxX;
        tmp[row + bx] = (lum[row + xm1] + lum[row + bx] + lum[row + xp1]) * inv3;
      }
    }

    for (var by2 = 0; by2 < dh; by2++) {
      var ym1 = (by2 > 0 ? by2 - 1 : 0) * dw;
      var y0 = by2 * dw;
      var yp1 = (by2 < maxY ? by2 + 1 : maxY) * dw;
      for (var bx2 = 0; bx2 < dw; bx2++) {
        blurred[y0 + bx2] = (tmp[ym1 + bx2] + tmp[y0 + bx2] + tmp[yp1 + bx2]) * inv3;
      }
    }

    // Gradient magnitude |Gx| + |Gy|
    var grad = new Float32Array(n);
    var maxGrad = 0.0;
    for (var gy = 1; gy < maxY; gy++) {
      var gRow = gy * dw;
      for (var gx = 1; gx < maxX; gx++) {
        var idx = gRow + gx;
        var dx = blurred[idx + 1] - blurred[idx - 1];
        var dy = blurred[idx + dw] - blurred[idx - dw];
        var mag = Math.abs(dx) + Math.abs(dy);
        grad[idx] = mag;
        if (mag > maxGrad) maxGrad = mag;
      }
    }

    if (maxGrad < 4.0) {
      return makeFallbackRoi(width, height);
    }

    var p85 = percentile85(grad);
    var edgeThresh = Math.max(6.0, p85, 0.18 * maxGrad);

    // Initial center estimate from strong edge centroid
    var sumW = 0.0;
    var sumCX = 0.0;
    var sumCY = 0.0;
    for (var ey = 1; ey < maxY; ey++) {
      var eRow = ey * dw;
      for (var ex = 1; ex < maxX; ex++) {
        var eg = grad[eRow + ex];
        if (eg >= edgeThresh) {
          sumW += eg;
          sumCX += ex * eg;
          sumCY += ey * eg;
        }
      }
    }

    var cx = sumW > 0 ? (sumCX / sumW) : (dw * 0.5);
    var cy = sumW > 0 ? (sumCY / sumW) : (dh * 0.5);

    var minDim = Math.min(dw, dh);
    var maxDim = Math.max(dw, dh);
    var rStart = Math.max(4, Math.floor(0.22 * minDim));
    var rEnd = Math.ceil(0.52 * maxDim);

    // Pass 1 rays to snap center onto outer dish contour
    var pass1 = castRimRays(grad, dw, dh, cx, cy, edgeThresh, rStart, rEnd);
    if (pass1.length < MIN_VALID_RAYS) {
      return makeFallbackRoi(width, height);
    }

    var meanX = 0.0;
    var meanY = 0.0;
    for (var p = 0; p < pass1.length; p++) {
      meanX += pass1[p].x;
      meanY += pass1[p].y;
    }
    cx = meanX / pass1.length;
    cy = meanY / pass1.length;

    // Pass 2 rays from refined center
    var inliers = castRimRays(grad, dw, dh, cx, cy, edgeThresh, rStart, rEnd);
    if (inliers.length < MIN_VALID_RAYS) {
      inliers = pass1;
    }

    var finX = 0.0;
    var finY = 0.0;
    for (var i = 0; i < inliers.length; i++) {
      finX += inliers[i].x;
      finY += inliers[i].y;
    }
    cx = finX / inliers.length;
    cy = finY / inliers.length;

    // 2x2 covariance fit for polar-sampled ellipse points:
    // For polar sampling r(theta), lambda1/lambda2 = a/b and lambda1 + lambda2 = a*b
    var cxx = 0.0;
    var cyy = 0.0;
    var cxy = 0.0;
    for (var j = 0; j < inliers.length; j++) {
      var dxp = inliers[j].x - cx;
      var dyp = inliers[j].y - cy;
      cxx += dxp * dxp;
      cyy += dyp * dyp;
      cxy += dxp * dyp;
    }
    cxx /= inliers.length;
    cyy /= inliers.length;
    cxy /= inliers.length;

    var tr = cxx + cyy;
    var disc = Math.hypot(cxx - cyy, 2.0 * cxy);
    var l1 = Math.max(1e-6, 0.5 * (tr + disc));
    var l2 = Math.max(1e-6, 0.5 * (tr - disc));

    var aScaled = Math.sqrt((l1 + l2) * (l1 / l2));
    var bScaled = Math.sqrt((l1 + l2) * (l2 / l1));
    var angleRad = 0.5 * Math.atan2(2.0 * cxy, cxx - cyy);

    var fillRatio = (2.0 * aScaled) / minDim;
    var axisRatio = clamp(bScaled / aScaled, 0.5, 1.0);
    var tiltDeg = Math.acos(axisRatio) * (180.0 / Math.PI);
    var tiltWarning = tiltDeg > TILT_WARN_DEG;
    var perspectiveCompensated = tiltDeg > TILT_COMP_MIN_DEG && axisRatio >= TILT_COMP_MIN_RATIO;

    var cxOrig = clamp(cx * invScaleX, 0, width);
    var cyOrig = clamp(cy * invScaleY, 0, height);
    var majorOrig = aScaled * ((invScaleX + invScaleY) * 0.5);
    var minorOrig = bScaled * ((invScaleX + invScaleY) * 0.5);

    var cropped = fillRatio <= FILL_SKIP_THRESH;
    var cropBox;
    if (!cropped) {
      cropBox = { x: 0, y: 0, w: width, h: height };
      perspectiveCompensated = false;
    } else {
      var halfSide = majorOrig * (1.0 + CROP_MARGIN);
      var x1 = clampInt(Math.floor(cxOrig - halfSide), 0, width - 1);
      var y1 = clampInt(Math.floor(cyOrig - halfSide), 0, height - 1);
      var x2 = clampInt(Math.ceil(cxOrig + halfSide), x1 + 1, width);
      var y2 = clampInt(Math.ceil(cyOrig + halfSide), y1 + 1, height);
      cropBox = {
        x: x1,
        y: y1,
        w: Math.max(1, x2 - x1),
        h: Math.max(1, y2 - y1)
      };
    }

    return {
      found: true,
      cropped: cropped,
      fillRatio: Math.round(fillRatio * 10000) / 10000,
      cx: Math.round(cxOrig * 100) / 100,
      cy: Math.round(cyOrig * 100) / 100,
      rx: Math.round(majorOrig * 100) / 100,
      ry: Math.round(minorOrig * 100) / 100,
      majorAxis: Math.round(majorOrig * 100) / 100,
      minorAxis: Math.round(minorOrig * 100) / 100,
      angleRad: Math.round(angleRad * 10000) / 10000,
      axisRatio: Math.round(axisRatio * 10000) / 10000,
      tiltDeg: Math.round(tiltDeg * 100) / 100,
      tiltWarning: tiltWarning,
      perspectiveCompensated: perspectiveCompensated,
      cropBox: cropBox
    };
  }

  /**
   * Extract clean RGB ROI canvas (<= 1024 px) with optional elliptical tilt compensation.
   * Zero-copy pass-through when neither cropped nor perspectiveCompensated.
   */
  function extractRoiCanvas(imgOrCanvas, roiInfo, opts) {
    var origW = (imgOrCanvas && (imgOrCanvas.naturalWidth || imgOrCanvas.width)) || 1;
    var origH = (imgOrCanvas && (imgOrCanvas.naturalHeight || imgOrCanvas.height)) || 1;

    if (!roiInfo || (!roiInfo.cropped && !roiInfo.perspectiveCompensated)) {
      return {
        canvas: imgOrCanvas,
        width: origW,
        height: origH,
        roiInfo: roiInfo || null
      };
    }

    var o = opts || {};
    var box = roiInfo.cropBox || { x: 0, y: 0, w: origW, h: origH };
    var sx = clampInt(Math.round(box.x), 0, Math.max(0, origW - 1));
    var sy = clampInt(Math.round(box.y), 0, Math.max(0, origH - 1));
    var sw = clampInt(Math.round(box.w), 1, Math.max(1, origW - sx));
    var sh = clampInt(Math.round(box.h), 1, Math.max(1, origH - sy));

    var maxEdge = (o.maxEdge > 0) ? Math.min(MAX_OUTPUT_EDGE, o.maxEdge) : MAX_OUTPUT_EDGE;
    var scale = Math.min(1.0, maxEdge / Math.max(sw, sh));
    var outW = Math.max(1, Math.round(sw * scale));
    var outH = Math.max(1, Math.round(sh * scale));

    var canvas = o.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (!canvas) {
      throw new Error('Canvas element unavailable for extractRoiCanvas');
    }
    canvas.width = outW;
    canvas.height = outH;

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    var canTransform = (
      roiInfo.perspectiveCompensated &&
      roiInfo.axisRatio > 0 &&
      roiInfo.axisRatio < 1.0 &&
      typeof ctx.translate === 'function' &&
      typeof ctx.rotate === 'function' &&
      typeof ctx.scale === 'function'
    );

    if (canTransform) {
      var phi = roiInfo.angleRad || 0;
      var cx = roiInfo.cx != null ? roiInfo.cx : (sx + sw * 0.5);
      var cy = roiInfo.cy != null ? roiInfo.cy : (sy + sh * 0.5);
      var cropCx = sx + sw * 0.5;
      var cropCy = sy + sh * 0.5;
      var ratio = roiInfo.majorAxis > 0 && roiInfo.minorAxis > 0
        ? clamp(roiInfo.majorAxis / roiInfo.minorAxis, 1.0, 1.35)
        : clamp(1.0 / roiInfo.axisRatio, 1.0, 1.35);

      if (typeof ctx.fillRect === 'function') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, outW, outH);
      }
      if (typeof ctx.save === 'function') ctx.save();
      ctx.translate(outW * 0.5 + (cx - cropCx) * scale, outH * 0.5 + (cy - cropCy) * scale);
      ctx.scale(scale, scale);
      ctx.rotate(phi);
      ctx.scale(1.0, ratio);
      ctx.rotate(-phi);
      ctx.translate(-cx, -cy);
      ctx.drawImage(imgOrCanvas, 0, 0, origW, origH);
      if (typeof ctx.restore === 'function') ctx.restore();
    } else {
      ctx.drawImage(imgOrCanvas, sx, sy, sw, sh, 0, 0, outW, outH);
    }

    return {
      canvas: canvas,
      width: outW,
      height: outH,
      roiInfo: roiInfo
    };
  }

  /**
   * 8x8 tile CLAHE on RGBA returning Float32Array luminance in [0, 255].
   * Single 4 MB luminance allocation at 1024x1024 + 128 KB tile LUTs (D-03).
   */
  function applyTileClaheLuminance(rgba, width, height, opts) {
    if (!rgba || !(width > 0) || !(height > 0) || rgba.length < width * height * 4) {
      throw new Error('Invalid image buffer or dimensions for CLAHE: ' + width + 'x' + height);
    }

    var o = opts || {};
    var tilesX = clampInt(o.tilesX > 0 ? o.tilesX : 8, 1, width);
    var tilesY = clampInt(o.tilesY > 0 ? o.tilesY : 8, 1, height);
    var clipLimit = o.clipLimit > 0 ? Number(o.clipLimit) : 2.0;

    var n = width * height;
    var outLum = new Float32Array(n);

    var xStarts = new Int32Array(tilesX + 1);
    var yStarts = new Int32Array(tilesY + 1);
    var xCenters = new Float32Array(tilesX);
    var yCenters = new Float32Array(tilesY);

    for (var tx = 0; tx <= tilesX; tx++) {
      xStarts[tx] = Math.floor((tx * width) / tilesX);
    }
    for (var tx2 = 0; tx2 < tilesX; tx2++) {
      xCenters[tx2] = (xStarts[tx2] + xStarts[tx2 + 1] - 1) * 0.5;
    }

    for (var ty = 0; ty <= tilesY; ty++) {
      yStarts[ty] = Math.floor((ty * height) / tilesY);
    }
    for (var ty2 = 0; ty2 < tilesY; ty2++) {
      yCenters[ty2] = (yStarts[ty2] + yStarts[ty2 + 1] - 1) * 0.5;
    }

    // Build per-tile histograms & CDFs
    var numTiles = tilesX * tilesY;
    var hist = new Int32Array(numTiles * 256);
    var cdfs = new Float32Array(numTiles * 256);

    for (var gy = 0; gy < tilesY; gy++) {
      var y0 = yStarts[gy];
      var y1 = yStarts[gy + 1];
      for (var gx = 0; gx < tilesX; gx++) {
        var x0 = xStarts[gx];
        var x1 = xStarts[gx + 1];
        var hOff = (gy * tilesX + gx) << 8;

        for (var py = y0; py < y1; py++) {
          var rowOff = py * width;
          for (var px = x0; px < x1; px++) {
            var idx = rowOff + px;
            var pOff = idx << 2;
            var lVal = 0.299 * rgba[pOff] + 0.587 * rgba[pOff + 1] + 0.114 * rgba[pOff + 2];
            outLum[idx] = lVal;
            var bin = clampInt(Math.round(lVal), 0, 255);
            hist[hOff + bin]++;
          }
        }

        var tilePixels = Math.max(1, (x1 - x0) * (y1 - y0));
        var limit = Math.max(1, Math.round((clipLimit * tilePixels) / 256.0));
        var excess = 0;
        for (var b = 0; b < 256; b++) {
          var count = hist[hOff + b];
          if (count > limit) {
            excess += count - limit;
            hist[hOff + b] = limit;
          }
        }

        var avgInc = Math.floor(excess / 256);
        var rem = excess - avgInc * 256;
        if (avgInc > 0) {
          for (var b2 = 0; b2 < 256; b2++) {
            hist[hOff + b2] += avgInc;
          }
        }
        if (rem > 0) {
          var step = Math.max(1, Math.floor(256 / rem));
          var b3 = 0;
          while (rem > 0) {
            hist[hOff + b3]++;
            rem--;
            b3 = (b3 + step) & 255;
          }
        }

        var cdfSum = 0;
        var scaleCdf = 255.0 / tilePixels;
        for (var b4 = 0; b4 < 256; b4++) {
          cdfSum += hist[hOff + b4];
          cdfs[hOff + b4] = Math.min(255.0, cdfSum * scaleCdf);
        }
      }
    }

    // Precompute bilinear tile lookup indices per axis
    var xT0 = new Int32Array(width);
    var xT1 = new Int32Array(width);
    var xAlpha = new Float32Array(width);
    var curTx = 0;
    for (var ix = 0; ix < width; ix++) {
      if (tilesX === 1 || ix <= xCenters[0]) {
        xT0[ix] = 0;
        xT1[ix] = 0;
        xAlpha[ix] = 0.0;
      } else if (ix >= xCenters[tilesX - 1]) {
        xT0[ix] = tilesX - 1;
        xT1[ix] = tilesX - 1;
        xAlpha[ix] = 0.0;
      } else {
        while (curTx < tilesX - 2 && ix > xCenters[curTx + 1]) {
          curTx++;
        }
        var denomX = xCenters[curTx + 1] - xCenters[curTx];
        xT0[ix] = curTx;
        xT1[ix] = curTx + 1;
        xAlpha[ix] = denomX > 0 ? (ix - xCenters[curTx]) / denomX : 0.0;
      }
    }

    var yT0 = new Int32Array(height);
    var yT1 = new Int32Array(height);
    var yAlpha = new Float32Array(height);
    var curTy = 0;
    for (var iy = 0; iy < height; iy++) {
      if (tilesY === 1 || iy <= yCenters[0]) {
        yT0[iy] = 0;
        yT1[iy] = 0;
        yAlpha[iy] = 0.0;
      } else if (iy >= yCenters[tilesY - 1]) {
        yT0[iy] = tilesY - 1;
        yT1[iy] = tilesY - 1;
        yAlpha[iy] = 0.0;
      } else {
        while (curTy < tilesY - 2 && iy > yCenters[curTy + 1]) {
          curTy++;
        }
        var denomY = yCenters[curTy + 1] - yCenters[curTy];
        yT0[iy] = curTy;
        yT1[iy] = curTy + 1;
        yAlpha[iy] = denomY > 0 ? (iy - yCenters[curTy]) / denomY : 0.0;
      }
    }

    // Apply bilinearly interpolated tile CDFs
    for (var oy = 0; oy < height; oy++) {
      var tyA = yT0[oy];
      var tyB = yT1[oy];
      var ay = yAlpha[oy];
      var rowBase = oy * width;
      var tyAOff = tyA * tilesX;
      var tyBOff = tyB * tilesX;

      for (var ox = 0; ox < width; ox++) {
        var txA = xT0[ox];
        var txB = xT1[ox];
        var ax = xAlpha[ox];
        var pIdx = rowBase + ox;
        var lBin = clampInt(Math.round(outLum[pIdx]), 0, 255);

        var v00 = cdfs[((tyAOff + txA) << 8) + lBin];
        var v10 = cdfs[((tyAOff + txB) << 8) + lBin];
        var v01 = cdfs[((tyBOff + txA) << 8) + lBin];
        var v11 = cdfs[((tyBOff + txB) << 8) + lBin];

        var top = v00 + ax * (v10 - v00);
        var bot = v01 + ax * (v11 - v01);
        outLum[pIdx] = clamp(top + ay * (bot - top), 0.0, 255.0);
      }
    }

    return outLum;
  }

  /**
   * 8x8 tile CLAHE scaled proportionally onto RGBA Uint8ClampedArray for visual rendering.
   */
  function applyTileClaheRgba(rgba, width, height, opts) {
    var enhancedLum = applyTileClaheLuminance(rgba, width, height, opts);
    var n = width * height;
    var out = new Uint8ClampedArray(n * 4);

    for (var i = 0; i < n; i++) {
      var off = i << 2;
      var r = rgba[off];
      var g = rgba[off + 1];
      var b = rgba[off + 2];
      var lIn = 0.299 * r + 0.587 * g + 0.114 * b;
      var lOut = enhancedLum[i];

      if (lIn < 1.0) {
        var delta = lOut - lIn;
        out[off] = clamp(Math.round(r + delta), 0, 255);
        out[off + 1] = clamp(Math.round(g + delta), 0, 255);
        out[off + 2] = clamp(Math.round(b + delta), 0, 255);
      } else {
        var ratio = lOut / lIn;
        out[off] = clamp(Math.round(r * ratio), 0, 255);
        out[off + 1] = clamp(Math.round(g * ratio), 0, 255);
        out[off + 2] = clamp(Math.round(b * ratio), 0, 255);
      }
      out[off + 3] = rgba[off + 3];
    }

    return out;
  }

  return {
    detectPlateRoi: detectPlateRoi,
    extractRoiCanvas: extractRoiCanvas,
    applyTileClaheLuminance: applyTileClaheLuminance,
    applyTileClaheRgba: applyTileClaheRgba
  };
});

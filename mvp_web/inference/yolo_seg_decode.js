/* ADLMS — Pure-JS YOLO11n-seg Decoder, 6.0 mm Fiducial Scaler, 1:1 Pairing & inner_colony Alerts
 * Zero-build UMD/IIFE module: attaches window.ADLMS_YOLO_DECODE in browsers and module.exports in Node.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ADLMS_YOLO_DECODE = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_CONF_THRESH = 0.45;
  var DEFAULT_IOU_THRESH = 0.45;
  var DEFAULT_MAX_DET = 100;
  var NUM_CLASSES = 3; // 0: antibiotic_disk, 1: inhibition_zone, 2: inner_colony
  var NUM_PROTOS = 32;
  var DISK_DIAM_MM = 6.0;
  var RESISTANT_CLAMP_FACTOR = 1.08;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function round1(v) {
    return Math.round(v * 10) / 10;
  }

  function round4(v) {
    return Math.round(v * 10000) / 10000;
  }

  function median(values) {
    if (!values || values.length === 0) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return 0.5 * (sorted[mid - 1] + sorted[mid]);
  }

  /**
   * Compute letterbox transform matching src/models/export_model.py:35-56.
   */
  function computeLetterbox(origW, origH, imgsz) {
    if (!(origW > 0) || !(origH > 0) || !(imgsz > 0)) {
      throw new Error('Invalid letterbox dimensions: ' + origW + 'x' + origH + ' -> ' + imgsz);
    }
    var scale = Math.min(imgsz / origH, imgsz / origW);
    var newW = Math.round(origW * scale);
    var newH = Math.round(origH * scale);
    var dw = (imgsz - newW) / 2.0;
    var dh = (imgsz - newH) / 2.0;
    var padTop = Math.max(0, Math.round(dh - 0.1));
    var padLeft = Math.max(0, Math.round(dw - 0.1));
    return {
      origW: origW,
      origH: origH,
      imgsz: imgsz,
      scale: scale,
      newW: newW,
      newH: newH,
      padLeft: padLeft,
      padTop: padTop
    };
  }

  function boxIoU(a, b) {
    var x1 = Math.max(a.x1, b.x1);
    var y1 = Math.max(a.y1, b.y1);
    var x2 = Math.min(a.x2, b.x2);
    var y2 = Math.min(a.y2, b.y2);
    var iw = Math.max(0, x2 - x1);
    var ih = Math.max(0, y2 - y1);
    var inter = iw * ih;
    if (inter <= 0) return 0;
    var areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    var areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    var denom = areaA + areaB - inter;
    return denom > 0 ? inter / denom : 0;
  }

  /**
   * Parse channels-first output0 [1, 39, N] -> conf filter -> per-class NMS.
   */
  function parseDetections(out0, numAnchors, numClasses, confThresh, iouThresh, maxDet) {
    var nc = numClasses || NUM_CLASSES;
    var confT = confThresh != null ? confThresh : DEFAULT_CONF_THRESH;
    var iouT = iouThresh != null ? iouThresh : DEFAULT_IOU_THRESH;
    var cap = maxDet != null ? maxDet : DEFAULT_MAX_DET;

    var byClass = [];
    for (var c = 0; c < nc; c++) byClass.push([]);

    var coeffOffset = 4 + nc;
    for (var i = 0; i < numAnchors; i++) {
      var bestC = -1;
      var bestScore = confT;
      for (var cls = 0; cls < nc; cls++) {
        var score = out0[(4 + cls) * numAnchors + i];
        if (score >= bestScore) {
          bestScore = score;
          bestC = cls;
        }
      }
      if (bestC < 0) continue;

      var cx = out0[0 * numAnchors + i];
      var cy = out0[1 * numAnchors + i];
      var bw = out0[2 * numAnchors + i];
      var bh = out0[3 * numAnchors + i];
      var coeffs = new Float32Array(NUM_PROTOS);
      for (var m = 0; m < NUM_PROTOS; m++) {
        coeffs[m] = out0[(coeffOffset + m) * numAnchors + i];
      }

      byClass[bestC].push({
        cls: bestC,
        score: bestScore,
        cx: cx,
        cy: cy,
        bw: bw,
        bh: bh,
        x1: cx - bw * 0.5,
        y1: cy - bh * 0.5,
        x2: cx + bw * 0.5,
        y2: cy + bh * 0.5,
        coeffs: coeffs
      });
    }

    var kept = [];
    for (var cIdx = 0; cIdx < nc; cIdx++) {
      var list = byClass[cIdx];
      list.sort(function (a, b) { return b.score - a.score; });
      var suppressed = new Uint8Array(list.length);
      for (var a = 0; a < list.length; a++) {
        if (suppressed[a]) continue;
        var detA = list[a];
        kept.push(detA);
        if (kept.length >= cap) return kept;
        for (var b = a + 1; b < list.length; b++) {
          if (suppressed[b]) continue;
          if (boxIoU(detA, list[b]) > iouT) {
            suppressed[b] = 1;
          }
        }
      }
    }
    return kept;
  }

  /**
   * ROI-cropped coeffs @ protos (before sigmoid), 4x bilinear logit upsampling,
   * sigmoid > 0.5 threshold, unpadding to original (origW, origH), and 36-ray contour.
   */
  function decodeMaskRoi(det, out1, protoH, protoW, imgsz, lb) {
    var x1 = clamp(det.x1, 0, imgsz);
    var y1 = clamp(det.y1, 0, imgsz);
    var x2 = clamp(det.x2, 0, imgsz);
    var y2 = clamp(det.y2, 0, imgsz);

    var ix1 = clamp(Math.floor(x1), 0, imgsz - 1);
    var iy1 = clamp(Math.floor(y1), 0, imgsz - 1);
    var ix2 = clamp(Math.ceil(x2) - 1, 0, imgsz - 1);
    var iy2 = clamp(Math.ceil(y2) - 1, 0, imgsz - 1);
    if (ix2 < ix1 || iy2 < iy1) return null;

    var strideX = imgsz / protoW;
    var strideY = imgsz / protoH;

    var px1 = clamp(Math.floor(ix1 / strideX) - 1, 0, protoW - 1);
    var py1 = clamp(Math.floor(iy1 / strideY) - 1, 0, protoH - 1);
    var px2 = clamp(Math.ceil((ix2 + 1) / strideX) + 1, 0, protoW - 1);
    var py2 = clamp(Math.ceil((iy2 + 1) / strideY) + 1, 0, protoH - 1);

    var pRoiW = px2 - px1 + 1;
    var pRoiH = py2 - py1 + 1;
    var protoPlane = protoH * protoW;
    var logits = new Float32Array(pRoiW * pRoiH);
    var coeffs = det.coeffs;

    for (var py = py1; py <= py2; py++) {
      var rowBase = (py - py1) * pRoiW;
      var pRowOffset = py * protoW;
      for (var px = px1; px <= px2; px++) {
        var sum = 0.0;
        var pIdx = pRowOffset + px;
        for (var m = 0; m < NUM_PROTOS; m++) {
          sum += coeffs[m] * out1[m * protoPlane + pIdx];
        }
        logits[rowBase + (px - px1)] = sum;
      }
    }

    var roiW = ix2 - ix1 + 1;
    var roiH = iy2 - iy1 + 1;
    var mask = new Uint8Array(roiW * roiH);
    var areaInputPx = 0;
    var sumX = 0.0;
    var sumY = 0.0;

    for (var iy = iy1; iy <= iy2; iy++) {
      var fy = clamp((iy + 0.5) / strideY - 0.5, py1, py2);
      var y0 = Math.floor(fy);
      var y1i = Math.min(py2, y0 + 1);
      var wy = fy - y0;
      var ly0 = (y0 - py1) * pRoiW;
      var ly1 = (y1i - py1) * pRoiW;
      var mRow = (iy - iy1) * roiW;

      for (var ix = ix1; ix <= ix2; ix++) {
        var fx = clamp((ix + 0.5) / strideX - 0.5, px1, px2);
        var x0 = Math.floor(fx);
        var x1i = Math.min(px2, x0 + 1);
        var wx = fx - x0;
        var lx0 = x0 - px1;
        var lx1 = x1i - px1;

        var v00 = logits[ly0 + lx0];
        var v10 = logits[ly0 + lx1];
        var v01 = logits[ly1 + lx0];
        var v11 = logits[ly1 + lx1];
        var val = (v00 * (1 - wx) + v10 * wx) * (1 - wy) + (v01 * (1 - wx) + v11 * wx) * wy;

        var sig = 1.0 / (1.0 + Math.exp(-clamp(val, -40.0, 40.0)));
        if (sig > 0.5) {
          mask[mRow + (ix - ix1)] = 1;
          areaInputPx++;
          sumX += ix + 0.5;
          sumY += iy + 0.5;
        }
      }
    }

    if (areaInputPx === 0) return null;

    var cxInput = sumX / areaInputPx;
    var cyInput = sumY / areaInputPx;
    var cxOrig = clamp((cxInput - lb.padLeft) / lb.scale, 0, lb.origW);
    var cyOrig = clamp((cyInput - lb.padTop) / lb.scale, 0, lb.origH);
    var areaOrig = areaInputPx / (lb.scale * lb.scale);
    var diamPx = 2.0 * Math.sqrt(areaOrig / Math.PI);

    // Extract 36-ray radial boundary contour from binary ROI mask
    var contour = [];
    var maxRay = Math.ceil(Math.hypot(roiW, roiH));
    for (var k = 0; k < 36; k++) {
      var theta = (2.0 * Math.PI * k) / 36.0;
      var cosT = Math.cos(theta);
      var sinT = Math.sin(theta);
      var lastR = 0;
      for (var r = 1; r <= maxRay; r++) {
        var sx = Math.round(cxInput + cosT * r) - ix1;
        var sy = Math.round(cyInput + sinT * r) - iy1;
        if (sx < 0 || sx >= roiW || sy < 0 || sy >= roiH) break;
        if (mask[sy * roiW + sx]) {
          lastR = r;
        }
      }
      if (lastR > 0) {
        var bxOrig = clamp((cxInput + cosT * lastR - lb.padLeft) / lb.scale, 0, lb.origW);
        var byOrig = clamp((cyInput + sinT * lastR - lb.padTop) / lb.scale, 0, lb.origH);
        contour.push([round4(bxOrig / lb.origW), round4(byOrig / lb.origH)]);
      }
    }

    return {
      cls: det.cls,
      score: det.score,
      cx: cxOrig,
      cy: cyOrig,
      diamPx: diamPx,
      areaPx: areaOrig,
      wOrig: (x2 - x1) / lb.scale,
      hOrig: (y2 - y1) / lb.scale,
      contour: contour
    };
  }

  /**
   * 6.0 mm median disk fiducial scaling, greedy 1:1 disk-zone pairing,
   * resistant clamp (6.0 * 1.08), row-major sorting, and inner_colony containment alerts.
   */
  function pairAndCalibrate(disks, zones, colonies, origW, origH) {
    var diskDiams = disks.map(function (d) { return d.diamPx; });
    var medianDiskPx = median(diskDiams);
    var pxPerMm = medianDiskPx > 0 ? medianDiskPx / DISK_DIAM_MM : 0;
    var fScale = medianDiskPx > 0 ? DISK_DIAM_MM / medianDiskPx : 0;

    // Greedy 1:1 pairing
    var pairs = [];
    for (var di = 0; di < disks.length; di++) {
      var d = disks[di];
      for (var zi = 0; zi < zones.length; zi++) {
        var z = zones[zi];
        var dist = Math.hypot(d.cx - z.cx, d.cy - z.cy);
        var maxDist = Math.max(d.diamPx * 2.5, z.diamPx * 0.45);
        if (dist <= maxDist) {
          pairs.push({ dist: dist, di: di, zi: zi });
        }
      }
    }
    pairs.sort(function (a, b) { return a.dist - b.dist; });

    var usedDisks = new Uint8Array(disks.length);
    var usedZones = new Uint8Array(zones.length);
    var diskToZone = new Int32Array(disks.length);
    diskToZone.fill(-1);

    for (var p = 0; p < pairs.length; p++) {
      var pair = pairs[p];
      if (!usedDisks[pair.di] && !usedZones[pair.zi]) {
        usedDisks[pair.di] = 1;
        usedZones[pair.zi] = 1;
        diskToZone[pair.di] = pair.zi;
      }
    }

    // Deterministic row-major panel ordering matching measure_zones.py:371
    var rowBand = Math.max(1.0, origH * 0.12);
    var order = disks.map(function (_, idx) { return idx; });
    order.sort(function (ia, ib) {
      var da = disks[ia];
      var db = disks[ib];
      var ra = Math.round(da.cy / rowBand);
      var rb = Math.round(db.cy / rowBand);
      if (ra !== rb) return ra - rb;
      return da.cx - db.cx;
    });

    var detections = [];
    for (var k = 0; k < order.length; k++) {
      var dIdx = order[k];
      var disk = disks[dIdx];
      var zIdx = diskToZone[dIdx];
      var zone = zIdx >= 0 ? zones[zIdx] : null;

      var diamMm = DISK_DIAM_MM;
      var hxPx = disk.cx;
      var hyPx = disk.cy;
      var zoneContour = [];

      if (zone && fScale > 0 && zone.diamPx * fScale > DISK_DIAM_MM * RESISTANT_CLAMP_FACTOR) {
        diamMm = round1(zone.diamPx * fScale);
        hxPx = zone.cx;
        hyPx = zone.cy;
        zoneContour = zone.contour;
      }

      // Class 2 (inner_colony) containment check
      var containRadiusPx = Math.max((diamMm * 0.5) * pxPerMm, disk.diamPx * 0.75);
      var colonyCount = 0;
      for (var ci = 0; ci < colonies.length; ci++) {
        var col = colonies[ci];
        if (Math.hypot(col.cx - hxPx, col.cy - hyPx) <= containRadiusPx) {
          colonyCount++;
        }
      }
      var hasInnerColony = colonyCount > 0;

      detections.push({
        id: k + 1,
        code: 'UNK',
        abx_code: 'UNK',
        abx_name: 'Disco no identificado',
        x: round4(disk.cx / origW),
        y: round4(disk.cy / origH),
        w: round4(disk.wOrig / origW),
        h: round4(disk.hOrig / origH),
        hx: round4(hxPx / origW),
        hy: round4(hyPx / origH),
        cx_px: disk.cx,
        cy_px: disk.cy,
        hx_px: hxPx,
        hy_px: hyPx,
        disk_diam_px: disk.diamPx,
        diam_mm: diamMm,
        conf: round4(disk.score),
        inner_colony: hasInnerColony,
        inner_colony_count: colonyCount,
        inner_colony_message: hasInnerColony
          ? 'Colonias internas detectadas (' + colonyCount + ') — posible subpoblación resistente'
          : '',
        zone_contour: zoneContour
      });
    }

    return {
      scale_px_per_mm: round4(pxPerMm),
      scale_mm_per_px: round4(fScale),
      median_disk_px: round4(medianDiskPx),
      disk_count: disks.length,
      zone_count: zones.length,
      inner_colony_count: colonies.length,
      detections: detections
    };
  }

  /**
   * Top-level YOLO11n-seg decoder.
   * @param {Float32Array} out0 - Flattened [1, 39, N] tensor
   * @param {Float32Array} out1 - Flattened [1, 32, protoH, protoW] tensor
   * @param {number[]} dims0 - [1, 39, N]
   * @param {number[]} dims1 - [1, 32, protoH, protoW]
   * @param {object} lb - Result of computeLetterbox(origW, origH, imgsz)
   * @param {object} [opts] - { confThresh, iouThresh, maxDet }
   */
  function decodeYoloSeg(out0, out1, dims0, dims1, lb, opts) {
    var o = opts || {};
    var numAnchors = dims0[2];
    var protoH = dims1[2];
    var protoW = dims1[3];

    var rawDets = parseDetections(
      out0,
      numAnchors,
      NUM_CLASSES,
      o.confThresh != null ? o.confThresh : DEFAULT_CONF_THRESH,
      o.iouThresh != null ? o.iouThresh : DEFAULT_IOU_THRESH,
      o.maxDet != null ? o.maxDet : DEFAULT_MAX_DET
    );

    var disks = [];
    var zones = [];
    var colonies = [];

    for (var i = 0; i < rawDets.length; i++) {
      var decoded = decodeMaskRoi(rawDets[i], out1, protoH, protoW, lb.imgsz, lb);
      if (!decoded) continue;
      if (decoded.cls === 0) disks.push(decoded);
      else if (decoded.cls === 1) zones.push(decoded);
      else if (decoded.cls === 2) colonies.push(decoded);
    }

    return pairAndCalibrate(disks, zones, colonies, lb.origW, lb.origH);
  }

  return {
    computeLetterbox: computeLetterbox,
    parseDetections: parseDetections,
    decodeMaskRoi: decodeMaskRoi,
    pairAndCalibrate: pairAndCalibrate,
    decodeYoloSeg: decodeYoloSeg
  };
});

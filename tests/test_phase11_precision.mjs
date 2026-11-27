import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const plateRoi = require(path.join(ROOT, 'mvp_web/inference/plate_roi.js'));
const sobel = require(path.join(ROOT, 'mvp_web/inference/sobel_cv.js'));
const decoder = require(path.join(ROOT, 'mvp_web/inference/yolo_seg_decode.js'));
const edgeDetector = require(path.join(ROOT, 'mvp_web/inference/edge_detector.js'));

function makeSyntheticPlateRgba(W, H, cx, cy, a, b, angleRad = 0, dishLum = 185, bgLum = 35) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * cosA + dy * sinA;
      const ry = -dx * sinA + dy * cosA;
      const inside = (rx * rx) / (a * a) + (ry * ry) / (b * b) <= 1.0;
      const val = inside ? dishLum : bgLum;
      const off = (y * W + x) * 4;
      rgba[off] = val;
      rgba[off + 1] = val;
      rgba[off + 2] = val;
      rgba[off + 3] = 255;
    }
  }
  return rgba;
}

test('P11-ROI: detectPlateRoi isolates 640x480 Petri dish with dark table margin in < 100 ms (D-01)', () => {
  const W = 640;
  const H = 480;
  const rgba = makeSyntheticPlateRgba(W, H, 320, 240, 150, 150);

  const t0 = performance.now();
  const roi = plateRoi.detectPlateRoi(rgba, W, H);
  const elapsedMs = performance.now() - t0;

  assert.equal(roi.found, true);
  assert.equal(roi.cropped, true);
  assert.ok(elapsedMs < 100, `Expected < 100 ms, took ${elapsedMs.toFixed(2)} ms`);
  assert.ok(Math.abs(roi.fillRatio - 0.625) < 0.03, `Expected fillRatio ~0.625, got ${roi.fillRatio}`);
  assert.ok(Math.abs(roi.cx - 320) <= 6, `Expected cx ~320, got ${roi.cx}`);
  assert.ok(Math.abs(roi.cy - 240) <= 6, `Expected cy ~240, got ${roi.cy}`);
  assert.ok(roi.cropBox.x >= 0 && roi.cropBox.y >= 0);
  assert.ok(roi.cropBox.x + roi.cropBox.w <= W);
  assert.ok(roi.cropBox.y + roi.cropBox.h <= H);
  assert.ok(roi.cropBox.w < W && roi.cropBox.h < H);
});

test('P11-ROI: detectPlateRoi skips cropping when fillRatio > 0.85 (D-01 fallback)', () => {
  const W = 480;
  const H = 480;
  const rgba = makeSyntheticPlateRgba(W, H, 240, 240, 225, 225);

  const roi = plateRoi.detectPlateRoi(rgba, W, H);
  assert.equal(roi.found, true);
  assert.equal(roi.cropped, false);
  assert.ok(roi.fillRatio > 0.85, `Expected fillRatio > 0.85, got ${roi.fillRatio}`);
  assert.deepEqual(roi.cropBox, { x: 0, y: 0, w: W, h: H });

  const mockImg = { width: W, height: H };
  const extracted = plateRoi.extractRoiCanvas(mockImg, roi);
  assert.equal(extracted.canvas, mockImg, 'Zero-copy pass-through expected when not cropped');
});

test('P11-ROI: detectPlateRoi detects elliptical tilt b/a = 0.90, flags tiltWarning > 5 deg & perspectiveCompensated (D-07)', () => {
  const W = 640;
  const H = 480;
  const rgba = makeSyntheticPlateRgba(W, H, 320, 240, 150, 135, 0.3);

  const roi = plateRoi.detectPlateRoi(rgba, W, H);
  assert.equal(roi.found, true);
  assert.equal(roi.cropped, true);
  assert.ok(Math.abs(roi.axisRatio - 0.90) < 0.03, `Expected axisRatio ~0.90, got ${roi.axisRatio}`);
  assert.ok(roi.tiltDeg > 20 && roi.tiltDeg < 32, `Expected tiltDeg ~25.8, got ${roi.tiltDeg}`);
  assert.equal(roi.tiltWarning, true);
  assert.equal(roi.perspectiveCompensated, true);

  let transformCalls = [];
  const mockOutCanvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        fillStyle: '',
        fillRect() {},
        save() { transformCalls.push('save'); },
        translate(x, y) { transformCalls.push(['translate', x, y]); },
        scale(sx, sy) { transformCalls.push(['scale', sx, sy]); },
        rotate(rad) { transformCalls.push(['rotate', rad]); },
        drawImage() { transformCalls.push('drawImage'); },
        restore() { transformCalls.push('restore'); }
      };
    }
  };
  const extracted = plateRoi.extractRoiCanvas({ width: W, height: H }, roi, { canvas: mockOutCanvas });
  assert.equal(extracted.canvas, mockOutCanvas);
  assert.ok(extracted.width <= 1024 && extracted.height <= 1024);
  assert.ok(!transformCalls.some((c) => Array.isArray(c) && c[0] === 'rotate'));
  assert.ok(transformCalls.includes('drawImage'));
});

test('P11-ROI: applyTileClaheLuminance and applyTileClaheRgba boost local contrast within [0, 255] (D-03)', () => {
  const W = 128;
  const H = 128;
  const rgba = new Uint8ClampedArray(W * H * 4);
  let minIn = 255;
  let maxIn = 0;

  // Low-contrast agar gradient + subtle halo (values in [95, 135])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 64, y - 64);
      const val = r < 24 ? 105 : 125 + Math.round(8 * Math.sin(x * 0.1));
      if (val < minIn) minIn = val;
      if (val > maxIn) maxIn = val;
      const off = (y * W + x) * 4;
      rgba[off] = val;
      rgba[off + 1] = val;
      rgba[off + 2] = val;
      rgba[off + 3] = 255;
    }
  }

  const lum = plateRoi.applyTileClaheLuminance(rgba, W, H, { tilesX: 8, tilesY: 8, clipLimit: 2.0 });
  assert.ok(lum instanceof Float32Array);
  assert.equal(lum.length, W * H);

  let minOut = Infinity;
  let maxOut = -Infinity;
  for (let i = 0; i < lum.length; i++) {
    assert.ok(lum[i] >= 0 && lum[i] <= 255, `Luminance out of range: ${lum[i]}`);
    if (lum[i] < minOut) minOut = lum[i];
    if (lum[i] > maxOut) maxOut = lum[i];
  }
  assert.ok((maxOut - minOut) > (maxIn - minIn), `Expected CLAHE dynamic range expansion: ${maxOut - minOut} vs ${maxIn - minIn}`);

  const outRgba = plateRoi.applyTileClaheRgba(rgba, W, H);
  assert.ok(outRgba instanceof Uint8ClampedArray);
  assert.equal(outRgba.length, W * H * 4);
  assert.equal(outRgba[3], 255);
});

test('P11-PREC: sobel_cv enforces DELTA_R_THRESHOLD_MM = 0.5 and refines 6.0 mm disk diameter (D-04, D-05)', () => {
  assert.equal(sobel.DELTA_R_THRESHOLD_MM, 0.5);

  const W = 200;
  const H = 200;
  // Synthetic halo at radius = 50 px => true diam 20.0 mm at fScale = 0.2 mm/px
  const haloRgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 100, y - 100);
      const val = r < 50 ? 40 : 210;
      const off = (y * W + x) * 4;
      haloRgba[off] = val;
      haloRgba[off + 1] = val;
      haloRgba[off + 2] = val;
      haloRgba[off + 3] = 255;
    }
  }
  const blurredHalo = sobel.extractBlurredLuminance(haloRgba, W, H);

  // delta_r = 0.35 mm <= 0.5 mm -> OK
  const okRes = sobel.crossValidateZone(blurredHalo, W, H, 100, 100, 15, 20.7, 0.2);
  assert.ok(Math.abs(okRes.delta_r_mm - 0.35) < 0.15, `Expected delta_r ~0.35, got ${okRes.delta_r_mm}`);
  assert.equal(okRes.geo_status, 'OK');
  assert.equal(okRes.geo_valid, true);
  assert.equal(okRes.geo_alert, false);

  // delta_r = 0.65 mm > 0.5 mm -> REVISION
  const revRes = sobel.crossValidateZone(blurredHalo, W, H, 100, 100, 15, 21.3, 0.2);
  assert.ok(revRes.delta_r_mm > 0.5, `Expected delta_r > 0.5, got ${revRes.delta_r_mm}`);
  assert.equal(revRes.geo_status, 'REVISION');
  assert.equal(revRes.geo_valid, false);
  assert.equal(revRes.geo_alert, true);

  // High-res 6.0 mm bright paper disk (true diam = 48 px, overestimated approxDiamPx = 56 px)
  const diskRgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 100, y - 100);
      const val = r < 24 ? 230 : 80;
      const off = (y * W + x) * 4;
      diskRgba[off] = val;
      diskRgba[off + 1] = val;
      diskRgba[off + 2] = val;
      diskRgba[off + 3] = 255;
    }
  }
  const blurredDisk = sobel.extractBlurredLuminance(diskRgba, W, H);
  const refined = sobel.refineDiskDiameterPx(blurredDisk, W, H, 100, 100, 56);
  assert.ok(Math.abs(refined - 48) <= 2.0, `Expected refined ~48 px (+/-2 px), got ${refined}`);

  // Outlier clamp: if true disk were tiny (r=10 -> d=20), refined must be >= 0.70 * approx (39.2)
  const tinyDiskRgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 100, y - 100);
      const val = r < 10 ? 230 : 80;
      const off = (y * W + x) * 4;
      tinyDiskRgba[off] = val;
      tinyDiskRgba[off + 1] = val;
      tinyDiskRgba[off + 2] = val;
      tinyDiskRgba[off + 3] = 255;
    }
  }
  const blurredTiny = sobel.extractBlurredLuminance(tinyDiskRgba, W, H);
  const clamped = sobel.refineDiskDiameterPx(blurredTiny, W, H, 100, 100, 56);
  assert.ok(clamped >= 0.70 * 56 - 0.01 && clamped <= 1.10 * 56 + 0.01, `Clamped value out of bounds: ${clamped}`);
});

test('P11-PREC & P11-XAI: yolo_seg_decode defaults zoneMaskThreshold=0.38 and emits 104x104 neural_xai_map (D-06, D-08)', () => {
  assert.equal(decoder.DEFAULT_ZONE_MASK_THRESH, 0.38);

  const origW = 416;
  const origH = 416;
  const imgsz = 416;
  const protoH = 104;
  const protoW = 104;
  const lb = decoder.computeLetterbox(origW, origH, imgsz);

  const numAnchors = 3;
  const out0 = new Float32Array(39 * numAnchors);
  const out1 = new Float32Array(32 * protoH * protoW);
  const protoPlane = protoH * protoW;

  // 0: antibiotic_disk at (208, 208), r = 15 px
  // 1: inhibition_zone at (208, 208) with soft gradient boundary (logit ramps +3 -> -3 across r=40..60)
  // 2: inner_colony at (220, 215), r = 8 px (soft boundary to verify cls=2 keeps 0.50)
  const objs = [
    { cls: 0, score: 0.96, cx: 208, cy: 208, bw: 40, bh: 40, protoCh: 0 },
    { cls: 1, score: 0.92, cx: 208, cy: 208, bw: 130, bh: 130, protoCh: 1 },
    { cls: 2, score: 0.89, cx: 220, cy: 215, bw: 24, bh: 24, protoCh: 2 }
  ];

  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    out0[0 * numAnchors + i] = o.cx;
    out0[1 * numAnchors + i] = o.cy;
    out0[2 * numAnchors + i] = o.bw;
    out0[3 * numAnchors + i] = o.bh;
    out0[(4 + o.cls) * numAnchors + i] = o.score;
    out0[(7 + o.protoCh) * numAnchors + i] = 1.0;
  }

  // Channel 0: disk (sharp +5 inside r=15)
  for (let py = 0; py < protoH; py++) {
    for (let px = 0; px < protoW; px++) {
      const distOrig = Math.hypot((px + 0.5) * 4 - 208, (py + 0.5) * 4 - 208);
      out1[0 * protoPlane + py * protoW + px] = distOrig <= 15 ? 5.0 : -5.0;
      // Channel 1: soft zone boundary where sigmoid drops smoothly through 0.50 -> 0.38 -> 0.10
      // At dist=45: logit=0 (sig=0.50). At dist=48: logit=-0.3 (sig=0.425). At dist=50: logit=-0.5 (sig=0.377)
      out1[1 * protoPlane + py * protoW + px] = (45 - distOrig) * 0.1;
      // Channel 2: inner colony (sharp +5 inside r=8)
      const distCol = Math.hypot((px + 0.5) * 4 - 220, (py + 0.5) * 4 - 215);
      out1[2 * protoPlane + py * protoW + px] = distCol <= 8 ? 5.0 : -5.0;
    }
  }

  const resDefault = decoder.decodeYoloSeg(out0, out1, [1, 39, numAnchors], [1, 32, protoH, protoW], lb);
  const resStrict050 = decoder.decodeYoloSeg(out0, out1, [1, 39, numAnchors], [1, 32, protoH, protoW], lb, {
    zoneMaskThreshold: 0.50
  });

  // D-08: Verify neural_xai_map structure and values
  assert.ok(resDefault.neural_xai_map);
  assert.equal(resDefault.neural_xai_map.width, 104);
  assert.equal(resDefault.neural_xai_map.height, 104);
  assert.ok(resDefault.neural_xai_map.data instanceof Float32Array);
  assert.equal(resDefault.neural_xai_map.data.length, 10816);

  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < resDefault.neural_xai_map.data.length; i++) {
    const v = resDefault.neural_xai_map.data[i];
    assert.ok(v >= 0 && v <= 1, `XAI probability out of [0, 1]: ${v}`);
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  assert.ok(maxVal > 0.9, `Expected strong XAI peak inside zone/disk, got ${maxVal}`);
  // Center (52, 52) in 104x104 must have high activation
  assert.ok(resDefault.neural_xai_map.data[52 * 104 + 52] > 0.9);

  // D-06: Lowering zoneMaskThreshold from 0.50 to 0.38 expands soft-boundary zone diameter without changing disk scale
  assert.equal(resDefault.median_disk_px, resStrict050.median_disk_px);
  assert.ok(
    resDefault.detections[0].diam_mm > resStrict050.detections[0].diam_mm,
    `Expected diam_mm at 0.38 (${resDefault.detections[0].diam_mm}) > diam_mm at 0.50 (${resStrict050.detections[0].diam_mm})`
  );
});

test('P11-INT: edge_detector refines 6.0 mm disk on post-ROI CLAHE, forwards neural_xai_map, and mvp_web/ wires ROI + tilt UI', async () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'mvp_web/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'mvp_web/app.js'), 'utf8');

  const scalerIdx = indexHtml.indexOf('<script src="image_scaler.js"></script>');
  const roiIdx = indexHtml.indexOf('<script src="inference/plate_roi.js"></script>');
  const edgeIdx = indexHtml.indexOf('<script src="inference/edge_detector.js"></script>');
  const appIdx = indexHtml.indexOf('<script src="app.js"></script>');
  assert.ok(scalerIdx !== -1 && roiIdx > scalerIdx && edgeIdx > roiIdx && appIdx > edgeIdx, 'index.html must load plate_roi.js after image_scaler.js and before edge_detector.js and app.js');
  assert.ok(indexHtml.includes('id="tel-tilt-badge"'), 'index.html must include #tel-tilt-badge');
  assert.ok(appJs.includes('ADLMS_PLATE_ROI') && appJs.includes('detectPlateRoi') && appJs.includes('extractRoiCanvas'), 'app.js must wire ADLMS_PLATE_ROI');
  assert.ok(appJs.includes('state.neuralXaiMap'), 'app.js must store and render state.neuralXaiMap');
  assert.ok(appJs.includes('deltaR <= 0.5'), 'app.js must use 0.5 mm Sobel fallback threshold');

  const W = 416;
  const H = 416;
  const protoW = 104;
  const protoH = 104;
  const protoPlane = protoW * protoH;
  const numAnchors = 2;
  const out0 = new Float32Array(39 * numAnchors);
  const out1 = new Float32Array(32 * protoPlane);

  // Disk at (208, 208) with slightly inflated YOLO proto mask (r=22 -> 44 px)
  // while actual image bright paper disk has r=18 -> 36 px (6.0 mm => 6.0 px/mm)
  out0[0 * numAnchors + 0] = 208;
  out0[1 * numAnchors + 0] = 208;
  out0[2 * numAnchors + 0] = 48;
  out0[3 * numAnchors + 0] = 48;
  out0[4 * numAnchors + 0] = 0.96;
  out0[7 * numAnchors + 0] = 1.0;

  // Inhibition zone at (208, 208) with r=60 -> 120 px (20.0 mm at true 6.0 px/mm)
  out0[0 * numAnchors + 1] = 208;
  out0[1 * numAnchors + 1] = 208;
  out0[2 * numAnchors + 1] = 130;
  out0[3 * numAnchors + 1] = 130;
  out0[5 * numAnchors + 1] = 0.93;
  out0[8 * numAnchors + 1] = 1.0;

  for (let py = 0; py < protoH; py++) {
    for (let px = 0; px < protoW; px++) {
      const dist = Math.hypot((px + 0.5) * 4 - 208, (py + 0.5) * 4 - 208);
      out1[0 * protoPlane + py * protoW + px] = dist <= 22 ? 6.0 : -6.0;
      out1[1 * protoPlane + py * protoW + px] = dist <= 60 ? 6.0 : -6.0;
    }
  }

  const imgRgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 208, y - 208);
      // Bright paper disk r<18 (235), dark halo 18<=r<60 (50), bright lawn r>=60 (175)
      const val = r < 18 ? 235 : (r < 60 ? 50 : 175);
      const off = (y * W + x) * 4;
      imgRgba[off] = val;
      imgRgba[off + 1] = val;
      imgRgba[off + 2] = val;
      imgRgba[off + 3] = 255;
    }
  }

  class MockTensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
    dispose() {}
  }

  const mockOrt = {
    env: { wasm: {} },
    Tensor: MockTensor,
    InferenceSession: {
      async create() {
        return {
          inputNames: ['images'],
          outputNames: ['output0', 'output1'],
          async run() {
            return {
              output0: new MockTensor('float32', out0, [1, 39, numAnchors]),
              output1: new MockTensor('float32', out1, [1, 32, protoH, protoW])
            };
          }
        };
      }
    }
  };

  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'mvp_web/models/model_meta.json'), 'utf8'));
  const prevDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            fillRect() {},
            drawImage() {},
            getImageData(_x, _y, w, h) {
              return { data: w === W && h === H ? imgRgba : new Uint8ClampedArray(w * h * 4) };
            }
          };
        }
      };
    }
  };

  try {
    const res = await edgeDetector.runEdgeInference({ naturalWidth: W, naturalHeight: H, width: W, height: H }, {
      ort: mockOrt,
      meta,
      search: ''
    });
    assert.ok(res.neural_xai_map, 'runEdgeInference must forward neural_xai_map');
    assert.equal(res.neural_xai_map.width, 104);
    assert.equal(res.detections.length, 1);
    const det = res.detections[0];
    assert.ok(det.raw_yolo_diam_mm > 0, 'raw_yolo_diam_mm must be preserved');
    assert.ok(res.median_disk_px < 40, `Expected refined median_disk_px ~36 (< 40), got ${res.median_disk_px}`);
    assert.ok(Math.abs(det.diam_mm - 20.0) <= 1.2, `Expected refined diam_mm ~20.0 mm, got ${det.diam_mm}`);
    assert.equal(det.geo_status, 'OK');
    assert.equal(det.geo_valid, true);
  } finally {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }
});

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

const decoder = require(path.join(ROOT, 'mvp_web/inference/yolo_seg_decode.js'));
const sobel = require(path.join(ROOT, 'mvp_web/inference/sobel_cv.js'));
const edgeDetector = require(path.join(ROOT, 'mvp_web/inference/edge_detector.js'));
const router = require(path.join(ROOT, 'mvp_web/inference/inference_router.js'));

test('WASM-01: Vendored ORT-Web 1.18.0 assets and model artifacts exist', () => {
  const requiredFiles = [
    'mvp_web/vendor/ort/ort.wasm.min.js',
    'mvp_web/vendor/ort/ort-wasm.wasm',
    'mvp_web/vendor/ort/ort-wasm-simd.wasm',
    'mvp_web/models/model_meta.json',
    'mvp_web/models/yolo11n_seg_416_fp32.onnx'
  ];
  for (const rel of requiredFiles) {
    const full = path.join(ROOT, rel);
    assert.equal(fs.existsSync(full), true, `Missing required asset: ${rel}`);
    assert.ok(fs.statSync(full).size > 0, `Empty required asset: ${rel}`);
  }
});

test('WASM-01: configureOrtEnv sets mobile memory hygiene, SIMD probe, and ?simd=0 fallback', () => {
  const mockOrtDefault = { env: { wasm: {} } };
  const cfgDefault = edgeDetector.configureOrtEnv(mockOrtDefault, '');
  assert.equal(mockOrtDefault.env.wasm.wasmPaths, './vendor/ort/');
  assert.equal(mockOrtDefault.env.wasm.numThreads, 1);
  assert.equal(mockOrtDefault.env.wasm.proxy, false);
  assert.equal(mockOrtDefault.env.wasm.simd, edgeDetector.supportsWasmSimd());
  assert.equal(cfgDefault.simdEnabled, edgeDetector.supportsWasmSimd());

  const mockOrtScalar = { env: { wasm: {} } };
  const cfgScalar = edgeDetector.configureOrtEnv(mockOrtScalar, '?simd=0');
  assert.equal(mockOrtScalar.env.wasm.wasmPaths, './vendor/ort/');
  assert.equal(mockOrtScalar.env.wasm.numThreads, 1);
  assert.equal(mockOrtScalar.env.wasm.proxy, false);
  assert.equal(mockOrtScalar.env.wasm.simd, false);
  assert.equal(cfgScalar.simdEnabled, false);
});

test('WASM-01: resolveModelVariant blocks path traversal and unknown IDs via allow-list', () => {
  const meta = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'mvp_web/models/model_meta.json'), 'utf-8')
  );
  const blocked = edgeDetector.resolveModelVariant(meta, '?model=../../secret');
  assert.equal(blocked.id, 'yolo11n_seg_416_fp32');

  const unknown = edgeDetector.resolveModelVariant(meta, '?model=nonexistent_model');
  assert.equal(unknown.id, 'yolo11n_seg_416_fp32');

  const validDefault = edgeDetector.resolveModelVariant(meta, '');
  assert.equal(validDefault.id, 'yolo11n_seg_416_fp32');
});

test('WASM-01: 10 consecutive InferenceSession.run() calls dispose every tensor with 0 leaks', async () => {
  const meta = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'mvp_web/models/model_meta.json'), 'utf-8')
  );

  const createdTensors = [];
  let sessionCreateCount = 0;

  class MockTensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
      this.disposeCount = 0;
      createdTensors.push(this);
    }
    dispose() {
      this.disposeCount += 1;
    }
  }

  const mockOrt = {
    env: { wasm: {} },
    Tensor: MockTensor,
    InferenceSession: {
      async create() {
        sessionCreateCount += 1;
        return {
          inputNames: ['images'],
          outputNames: ['output0', 'output1'],
          async run() {
            const out0 = new MockTensor('float32', new Float32Array(39 * 4), [1, 39, 4]);
            const out1 = new MockTensor('float32', new Float32Array(32 * 104 * 104), [1, 32, 104, 104]);
            return { output0: out0, output1: out1 };
          }
        };
      }
    }
  };

  const prevDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          const self = this;
          return {
            fillStyle: '',
            fillRect() {},
            drawImage() {},
            getImageData(_x, _y, w, h) {
              return { data: new Uint8ClampedArray(w * h * 4) };
            }
          };
        }
      };
    }
  };

  try {
    const fakeImg = { naturalWidth: 640, naturalHeight: 480, width: 640, height: 480 };
    for (let i = 0; i < 10; i++) {
      const res = await edgeDetector.runEdgeInference(fakeImg, {
        ort: mockOrt,
        meta,
        search: ''
      });
      assert.equal(res.runtime_mode, 'edge-wasm');
      assert.equal(res.model_variant, 'yolo11n_seg_416_fp32');
    }

    assert.equal(sessionCreateCount, 1, 'InferenceSession must be reused as a singleton across 10 runs');
    // 10 runs x (1 input tensor + 2 output tensors) = 30 tensors
    assert.equal(createdTensors.length, 30);
    const leaked = createdTensors.filter((t) => t.disposeCount !== 1);
    assert.equal(leaked.length, 0, `Expected 0 leaked tensors, found ${leaked.length}`);
  } finally {
    if (prevDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = prevDocument;
    }
  }
});

test('WASM-02: detectRuntimeMode routes APK origin, ?mode=edge-wasm, healthy API, and offline fallback', async () => {
  let apkFetchCalled = false;
  router.resetActiveMode();
  const modeApk = await router.detectRuntimeMode({
    hostname: 'appassets.androidplatform.net',
    search: '',
    fetchImpl: async () => {
      apkFetchCalled = true;
      return { ok: true, json: async () => ({ model_exists: true }) };
    }
  });
  assert.equal(modeApk, 'edge-wasm');
  assert.equal(apkFetchCalled, false, 'APK origin must never call /api/health');

  router.resetActiveMode();
  const modeFlag = await router.detectRuntimeMode({
    hostname: '127.0.0.1',
    search: '?mode=edge-wasm',
    fetchImpl: async () => ({ ok: true, json: async () => ({ model_exists: true }) })
  });
  assert.equal(modeFlag, 'edge-wasm');

  router.resetActiveMode();
  const modeLocal = await router.detectRuntimeMode({
    hostname: '127.0.0.1',
    search: '',
    fetchImpl: async () => ({ ok: true, json: async () => ({ model_exists: true }) })
  });
  assert.equal(modeLocal, 'local-api');

  router.resetActiveMode();
  const modeOffline = await router.detectRuntimeMode({
    hostname: '127.0.0.1',
    search: '',
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    }
  });
  assert.equal(modeOffline, 'edge-wasm');
});

test('WASM-03 & WASM-04: 4:3 (1600x1200) letterbox unpadding, 6.0 mm scaling, 1:1 pairing & inner_colony alerts', () => {
  const origW = 1600;
  const origH = 1200;
  const imgsz = 416;
  const protoH = 104;
  const protoW = 104;
  const lb = decoder.computeLetterbox(origW, origH, imgsz);

  assert.equal(lb.newW, 416);
  assert.equal(lb.newH, 312);
  assert.equal(lb.padLeft, 0);
  assert.equal(lb.padTop, 52);

  // Build synthetic [1, 39, 4] + [1, 32, 104, 104] with:
  // 0: disk 1 at (400, 600) orig -> diam 60 px orig (6.0 mm => 10 px/mm)
  // 1: disk 2 at (1200, 600) orig -> diam 60 px orig (6.0 mm)
  // 2: zone 1 around disk 1 at (400, 600) orig -> diam 200 px orig (~20.0 mm)
  // 3: inner_colony (class 2) inside zone 1 at (430, 610) orig -> diam 24 px orig
  const numAnchors = 4;
  const out0 = new Float32Array(39 * numAnchors);
  const out1 = new Float32Array(32 * protoH * protoW);
  const protoPlane = protoH * protoW;

  const objects = [
    { cls: 0, score: 0.95, cxOrig: 400, cyOrig: 600, rOrig: 30, protoCh: 0 },
    { cls: 0, score: 0.93, cxOrig: 1200, cyOrig: 600, rOrig: 30, protoCh: 1 },
    { cls: 1, score: 0.91, cxOrig: 400, cyOrig: 600, rOrig: 100, protoCh: 2 },
    { cls: 2, score: 0.88, cxOrig: 430, cyOrig: 610, rOrig: 12, protoCh: 3 }
  ];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const cxIn = obj.cxOrig * lb.scale + lb.padLeft;
    const cyIn = obj.cyOrig * lb.scale + lb.padTop;
    const rIn = obj.rOrig * lb.scale;
    const bw = rIn * 2.2;
    const bh = rIn * 2.2;

    out0[0 * numAnchors + i] = cxIn;
    out0[1 * numAnchors + i] = cyIn;
    out0[2 * numAnchors + i] = bw;
    out0[3 * numAnchors + i] = bh;
    out0[(4 + obj.cls) * numAnchors + i] = obj.score;
    out0[(7 + obj.protoCh) * numAnchors + i] = 1.0;

    // Populate proto channel with +6 inside circle, -6 outside
    const cxP = cxIn * (protoW / imgsz);
    const cyP = cyIn * (protoH / imgsz);
    const rP = rIn * (protoW / imgsz);
    const chOffset = obj.protoCh * protoPlane;
    for (let py = 0; py < protoH; py++) {
      for (let px = 0; px < protoW; px++) {
        const dist = Math.hypot(px + 0.5 - cxP, py + 0.5 - cyP);
        out1[chOffset + py * protoW + px] = dist <= rP ? 6.0 : -6.0;
      }
    }
  }

  const res = decoder.decodeYoloSeg(out0, out1, [1, 39, numAnchors], [1, 32, protoH, protoW], lb);
  assert.equal(res.disk_count, 2);
  assert.equal(res.zone_count, 1);
  assert.equal(res.inner_colony_count, 1);
  assert.equal(res.detections.length, 2);

  // Median disk ~60 px -> scale_px_per_mm ~10.0
  assert.ok(Math.abs(res.scale_px_per_mm - 10.0) < 0.8, `Expected ~10 px/mm, got ${res.scale_px_per_mm}`);

  const d1 = res.detections[0];
  const d2 = res.detections[1];

  // Unpadded coordinates should match (400, 600) and (1200, 600) closely
  assert.ok(Math.abs(d1.cx_px - 400) < 12, `d1.cx_px=${d1.cx_px}`);
  assert.ok(Math.abs(d1.cy_px - 600) < 12, `d1.cy_px=${d1.cy_px}`);
  assert.ok(Math.abs(d2.cx_px - 1200) < 12, `d2.cx_px=${d2.cx_px}`);
  assert.ok(Math.abs(d2.cy_px - 600) < 12, `d2.cy_px=${d2.cy_px}`);

  // Disk 1 paired with ~20 mm zone and has inner_colony alert
  assert.ok(Math.abs(d1.diam_mm - 20.0) < 1.5, `Expected ~20 mm, got ${d1.diam_mm}`);
  assert.equal(d1.inner_colony, true);
  assert.equal(d1.inner_colony_count, 1);

  // Disk 2 unpaired -> resistant clamp 6.0 mm and no inner colony
  assert.equal(d2.diam_mm, 6.0);
  assert.equal(d2.inner_colony, false);
  assert.equal(d2.inner_colony_count, 0);
});

test('WASM-04: sobel_cv validates accurate circular halo and flags mismatched radius (> 1.2 mm)', () => {
  const W = 200;
  const H = 200;
  const rgba = new Uint8ClampedArray(W * H * 4);
  // True halo radius = 50 px -> at fScale = 0.2 mm/px, true diameter = 20.0 mm
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 100, y - 100);
      const val = r < 50 ? 40 : 210;
      const off = (y * W + x) * 4;
      rgba[off] = val;
      rgba[off + 1] = val;
      rgba[off + 2] = val;
      rgba[off + 3] = 255;
    }
  }
  const blurred = sobel.extractBlurredLuminance(rgba, W, H);

  const okRes = sobel.validateZoneGeometry(blurred, W, H, 100, 100, 15, 20.0, 0.2);
  assert.equal(okRes.geo_valid, true);
  assert.equal(okRes.geo_alert, false);
  assert.ok(okRes.delta_r_mm <= 0.5, `Expected delta_r_mm <= 0.5, got ${okRes.delta_r_mm}`);

  // Mismatched YOLO diameter (25.0 mm vs true 20.0 mm => delta_r = 2.5 mm > 1.2 mm)
  const badRes = sobel.validateZoneGeometry(blurred, W, H, 100, 100, 15, 25.0, 0.2);
  assert.equal(badRes.geo_valid, false);
  assert.equal(badRes.geo_alert, true);
  assert.ok(badRes.delta_r_mm > 1.2, `Expected delta_r_mm > 1.2, got ${badRes.delta_r_mm}`);
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TELEMETRY_PATH = path.join(ROOT, 'mvp_web', 'telemetry_ui.js');

describe('Phase 10 — BENCH-01: SRP Telemetry UI (telemetry_ui.js)', () => {
  it('enforces SRP guardrail: mvp_web/telemetry_ui.js is <= 120 lines, uses textContent, and has zero innerHTML', () => {
    assert.ok(fs.existsSync(TELEMETRY_PATH), 'mvp_web/telemetry_ui.js must exist');
    const src = fs.readFileSync(TELEMETRY_PATH, 'utf8');
    const lines = src.split(/\r?\n/).length;
    assert.ok(lines <= 120, `Expected <= 120 lines, got ${lines}`);
    assert.ok(src.includes('textContent'), 'telemetry_ui.js must use textContent');
    assert.equal(/\.innerHTML\s*=/.test(src), false, 'telemetry_ui.js must NOT assign innerHTML');
  });

  it('parseBenchCount bounds ?bench=N to 1..50 and returns 0 for invalid values', () => {
    const ui = require(TELEMETRY_PATH);
    assert.equal(ui.parseBenchCount('?bench=10'), 10);
    assert.equal(ui.parseBenchCount('?model=yolo11n_seg_320_fp32&bench=5&simd=1'), 5);
    assert.equal(ui.parseBenchCount('?bench=0'), 0);
    assert.equal(ui.parseBenchCount('?bench=-3'), 0);
    assert.equal(ui.parseBenchCount('?bench=abc'), 0);
    assert.equal(ui.parseBenchCount('?bench=999'), 50);
    assert.equal(ui.parseBenchCount(''), 0);
  });

  it('normalizeTimings maps snake_case fields and defaults missing values safely', () => {
    const ui = require(TELEMETRY_PATH);
    const t = ui.normalizeTimings({
      preprocess_ms: 14,
      inference_ms: 210,
      postprocess_ms: 19,
      total_ms: 243,
      model_variant: 'yolo11n_seg_320_fp32',
      simd_enabled: true,
      discs: [{}, {}],
    }, { mode: 'edge-wasm', plate: 'plate_01', runIndex: 1, totalRuns: 10 });

    assert.deepEqual(t, {
      preprocessMs: 14,
      ortInferenceMs: 210,
      postprocessMs: 19,
      totalMs: 243,
      model: 'yolo11n_seg_320_fp32',
      mode: 'edge-wasm',
      simd: true,
      detections: 2,
      plate: 'plate_01',
      run: 1,
      totalRuns: 10,
    });

    const empty = ui.normalizeTimings({});
    assert.equal(empty.preprocessMs, 0);
    assert.equal(empty.ortInferenceMs, 0);
    assert.equal(empty.postprocessMs, 0);
    assert.equal(empty.totalMs, 0);
    assert.equal(empty.model, 'unknown');
    assert.equal(empty.simd, false);
  });

  it('formatEngineText renders all 4 stages, model ID, and SIMD/Scalar flag', () => {
    const ui = require(TELEMETRY_PATH);
    const text = ui.formatEngineText({
      preprocessMs: 12,
      ortInferenceMs: 185,
      postprocessMs: 16,
      totalMs: 213,
      model: 'yolo11n_seg_320_fp32',
      mode: 'edge-wasm',
      simd: true,
    });
    assert.ok(text.includes('yolo11n_seg_320_fp32'));
    assert.ok(text.includes('SIMD'));
    assert.ok(text.includes('pre 12ms'));
    assert.ok(text.includes('ort 185ms'));
    assert.ok(text.includes('post 16ms'));
    assert.ok(text.includes('tot 213ms'));

    const localText = ui.formatEngineText({
      preprocessMs: 0,
      ortInferenceMs: 42,
      postprocessMs: 0,
      totalMs: 45,
      model: 'yolo11n-seg',
      mode: 'local-api',
      simd: false,
    });
    assert.ok(localText.includes('Local API'));
    assert.ok(localText.includes('45ms'));
  });

  it('recordAnalysis updates element textContent and emits [ADLMS_BENCH] JSON', () => {
    const ui = require(TELEMETRY_PATH);
    const mockEl = { textContent: '' };
    const logs = [];
    ui.recordAnalysis({
      preprocess_ms: 11,
      inference_ms: 199,
      postprocess_ms: 15,
      total_ms: 225,
      model_variant: 'yolo11n_seg_320_fp32',
      simd_enabled: false,
      discs: [{}],
    }, { el: mockEl, plate: 'plate_02', runIndex: 2, totalRuns: 10, log: (m) => logs.push(m) });

    assert.ok(mockEl.textContent.includes('Scalar'));
    assert.ok(mockEl.textContent.includes('pre 11ms'));
    assert.ok(mockEl.textContent.includes('ort 199ms'));
    assert.ok(mockEl.textContent.includes('post 15ms'));
    assert.ok(mockEl.textContent.includes('tot 225ms'));
    assert.equal(logs.length, 1);
    assert.ok(logs[0].startsWith('[ADLMS_BENCH] '));
    const parsed = JSON.parse(logs[0].slice('[ADLMS_BENCH] '.length));
    assert.equal(parsed.preprocessMs, 11);
    assert.equal(parsed.ortInferenceMs, 199);
    assert.equal(parsed.postprocessMs, 15);
    assert.equal(parsed.totalMs, 225);
    assert.equal(parsed.simd, false);
  });

  it('emitBenchDone emits [ADLMS_BENCH_DONE] JSON', () => {
    const ui = require(TELEMETRY_PATH);
    const logs = [];
    ui.emitBenchDone({ runs: 10, model: 'yolo11n_seg_320_fp32', simd: true, errors: 0 }, { log: (m) => logs.push(m) });
    assert.equal(logs.length, 1);
    assert.ok(logs[0].startsWith('[ADLMS_BENCH_DONE] '));
    const parsed = JSON.parse(logs[0].slice('[ADLMS_BENCH_DONE] '.length));
    assert.equal(parsed.runs, 10);
    assert.equal(parsed.errors, 0);
  });
});

describe('Phase 10 — BENCH-01/02: Static Wiring Guards', () => {
  const html = fs.readFileSync(path.join(ROOT, 'mvp_web', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'mvp_web', 'app.js'), 'utf8');

  it('index.html loads telemetry_ui.js before app.js', () => {
    const telIdx = html.indexOf('<script src="telemetry_ui.js"></script>');
    const appIdx = html.indexOf('<script src="app.js"></script>');
    assert.ok(telIdx !== -1, 'index.html must include telemetry_ui.js');
    assert.ok(appIdx !== -1 && telIdx < appIdx, 'telemetry_ui.js must be loaded before app.js');
  });

  it('app.js delegates telemetry to ADLMS_TELEMETRY_UI and implements runBenchmarkSuite', () => {
    assert.ok(appJs.includes('ADLMS_TELEMETRY_UI'), 'app.js must delegate to ADLMS_TELEMETRY_UI');
    assert.ok(appJs.includes('runBenchmarkSuite'), 'app.js must implement runBenchmarkSuite');
  });
});

describe('Phase 10 — BENCH-02: edge_detector.resolveModelVariant locked_variant', () => {
  const edgeDetector = require(path.join(ROOT, 'mvp_web', 'inference', 'edge_detector.js'));
  const syntheticMeta = {
    locked_variant: 'yolo11n_seg_320_fp32',
    variants: [
      { id: 'yolo11n_seg_416_fp32', file: 'yolo11n_seg_416_fp32.onnx' },
      { id: 'yolo11n_seg_320_fp32', file: 'yolo11n_seg_320_fp32.onnx' },
    ],
  };

  it('honors meta.locked_variant when ?model= is absent, invalid, or path traversal', () => {
    assert.equal(edgeDetector.resolveModelVariant(syntheticMeta, '').id, 'yolo11n_seg_320_fp32');
    assert.equal(edgeDetector.resolveModelVariant(syntheticMeta, '?model=nonexistent').id, 'yolo11n_seg_320_fp32');
    assert.equal(edgeDetector.resolveModelVariant(syntheticMeta, '?model=../../etc/passwd').id, 'yolo11n_seg_320_fp32');
  });

  it('allows explicit ?model= override over meta.locked_variant', () => {
    assert.equal(edgeDetector.resolveModelVariant(syntheticMeta, '?model=yolo11n_seg_416_fp32').id, 'yolo11n_seg_416_fp32');
  });
});

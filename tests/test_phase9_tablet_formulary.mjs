import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SCALER_PATH = path.join(ROOT, 'mvp_web', 'image_scaler.js');

describe('Phase 9 — UI-02: Image & Canvas Downscaler (image_scaler.js)', () => {
  it('enforces SRP guardrail: mvp_web/image_scaler.js is <= 120 lines', () => {
    assert.ok(fs.existsSync(SCALER_PATH), 'mvp_web/image_scaler.js must exist');
    const lines = fs.readFileSync(SCALER_PATH, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 120, `Expected <= 120 lines, got ${lines}`);
  });

  it('downscales 1600x1200 to 1024x768', () => {
    const scaler = require(SCALER_PATH);
    assert.equal(scaler.MAX_EDGE_PX, 1024);
    const res = scaler.computeScaledDimensions(1600, 1200, 1024);
    assert.equal(res.width, 1024);
    assert.equal(res.height, 768);
    assert.equal(res.downscaled, true);
  });

  it('downscales 3000x3000 to 1024x1024', () => {
    const scaler = require(SCALER_PATH);
    const res = scaler.computeScaledDimensions(3000, 3000, 1024);
    assert.equal(res.width, 1024);
    assert.equal(res.height, 1024);
    assert.equal(res.downscaled, true);
  });

  it('downscales 1200x1600 portrait to 768x1024', () => {
    const scaler = require(SCALER_PATH);
    const res = scaler.computeScaledDimensions(1200, 1600, 1024);
    assert.equal(res.width, 768);
    assert.equal(res.height, 1024);
    assert.equal(res.downscaled, true);
  });

  it('leaves 800x600 unchanged with scale 1 and downscaled false', () => {
    const scaler = require(SCALER_PATH);
    const res = scaler.computeScaledDimensions(800, 600, 1024);
    assert.deepEqual(res, { width: 800, height: 600, scale: 1, downscaled: false });
  });
});

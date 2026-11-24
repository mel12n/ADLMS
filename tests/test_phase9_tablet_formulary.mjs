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

describe('Phase 9 — UI-01: TR6948 Tablet & APK Offline Static Guards', () => {
  const html = fs.readFileSync(path.join(ROOT, 'mvp_web', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'mvp_web', 'style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'mvp_web', 'app.js'), 'utf8');

  it('removes all Google Fonts CDN links from mvp_web/index.html and loads image_scaler.js', () => {
    assert.equal(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), false, 'Google Fonts CDN links must be removed');
    assert.ok(html.includes('<script src="image_scaler.js"></script>'), 'index.html must include image_scaler.js');
  });

  it('guards serviceWorker registration against appassets.androidplatform.net in mvp_web/app.js', () => {
    assert.ok(appJs.includes('appassets.androidplatform.net'), 'app.js must detect appassets.androidplatform.net');
    assert.ok(/if\s*\(\s*!isApkOrigin\s*&&\s*'serviceWorker'\s+in\s+navigator/.test(appJs), 'sw.js registration must be guarded by !isApkOrigin');
    assert.ok(appJs.includes("document.body.dataset.runtime = isApkOrigin ? 'apk' : 'web'"), 'app.js must set data-runtime on body');
  });

  it('disables backdrop-filter and twin-phone chassis in APK/tablet CSS', () => {
    assert.ok(css.includes('body[data-runtime="apk"]'), 'style.css must define body[data-runtime="apk"] rules');
    assert.ok(css.includes('backdrop-filter: none !important'), 'APK CSS must disable backdrop-filter');
    assert.ok(css.includes('body[data-runtime="apk"] .bg-glow'), 'APK CSS must hide .bg-glow');
  });

  it('uses canvas-safe naturalWidth || width and wires ADLMS_IMAGE_SCALER in mvp_web/app.js', () => {
    assert.ok(appJs.includes('state.img.naturalWidth || state.img.width'), 'computeHeat must use state.img.naturalWidth || state.img.width');
    assert.ok(appJs.includes('ADLMS_IMAGE_SCALER'), 'app.js must wire ADLMS_IMAGE_SCALER');
    assert.ok(appJs.includes('loadAndDownscaleFile'), 'loadUpload must call loadAndDownscaleFile');
  });
});

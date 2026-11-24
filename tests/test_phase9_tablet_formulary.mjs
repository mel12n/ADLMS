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

function loadBreakpoints() {
  const src = fs.readFileSync(path.join(ROOT, 'mvp_web', 'breakpoints_data.js'), 'utf8');
  const win = {};
  const fn = new Function('window', src);
  fn(win);
  return win.ADLMS_BREAKPOINTS;
}

describe('Phase 9 — UI-03 & UI-04: Manual Drug Formulary & Clinical Panel Presets (formulary_ui.js)', () => {
  const FORMULARY_PATH = path.join(ROOT, 'mvp_web', 'formulary_ui.js');

  it('enforces SRP guardrail: mvp_web/formulary_ui.js is <= 300 lines and uses textContent (no innerHTML)', () => {
    assert.ok(fs.existsSync(FORMULARY_PATH), 'mvp_web/formulary_ui.js must exist');
    const src = fs.readFileSync(FORMULARY_PATH, 'utf8');
    const lines = src.split(/\r?\n/).length;
    assert.ok(lines <= 300, `Expected <= 300 lines, got ${lines}`);
    assert.equal(/\.innerHTML\s*=/.test(src), false, 'formulary_ui.js must not use innerHTML (DOM XSS mitigation T-09-03)');
    assert.ok(src.includes('textContent'), 'formulary_ui.js must use textContent for DOM rendering');
  });

  it('buildDrugCatalog(ADLMS_BREAKPOINTS) returns all 65 drugs with reverse aliases', () => {
    const bp = loadBreakpoints();
    const ui = require(FORMULARY_PATH);
    const catalog = ui.buildDrugCatalog(bp);
    assert.equal(catalog.length, 65);
    const am = catalog.find((d) => d.key === 'AM');
    const cn = catalog.find((d) => d.key === 'CN');
    const va = catalog.find((d) => d.key === 'VA');
    assert.ok(am && am.aliases.includes('AMP'), 'AM must include reverse alias AMP');
    assert.ok(cn && cn.aliases.includes('GEN'), 'CN must include reverse alias GEN');
    assert.ok(va && va.aliases.includes('VAN'), 'VA must include reverse alias VAN');
  });

  it('filterDrugCatalog finds Ampicillin via alias AMP and Ciprofloxacin via partial name Cipro', () => {
    const bp = loadBreakpoints();
    const ui = require(FORMULARY_PATH);
    const catalog = ui.buildDrugCatalog(bp);
    const ampMatches = ui.filterDrugCatalog(catalog, 'AMP', 'Enterobacterales');
    assert.ok(ampMatches.some((d) => d.key === 'AM'), 'AMP search must find AM (Ampicilina)');
    const ciproMatches = ui.filterDrugCatalog(catalog, 'Cipro', 'Enterobacterales');
    assert.ok(ciproMatches.some((d) => d.key === 'CIP'), 'Cipro search must find CIP');
  });

  it('findNextUnkIndex advances circularly and returns -1 when no UNK disks remain', () => {
    const ui = require(FORMULARY_PATH);
    const discs = [{ code: 'CIP' }, { code: 'UNK' }, { code: 'UNK-2' }];
    assert.equal(ui.findNextUnkIndex(discs, 1), 2);
    assert.equal(ui.findNextUnkIndex(discs, 2), 1);
    assert.equal(ui.findNextUnkIndex([{ code: 'CIP' }, { code: 'AM' }], 0), -1);
  });

  it('sortDiscIndicesClockwise orders 12, 3, 6, 9 o-clock disks deterministically', () => {
    const ui = require(FORMULARY_PATH);
    // Deliberately scrambled input: 6, 9, 12, 3 o'clock around center (500, 500)
    const discs = [
      { id: '6h', cx: 500, cy: 800 },
      { id: '9h', cx: 200, cy: 500 },
      { id: '12h', cx: 500, cy: 200 },
      { id: '3h', cx: 800, cy: 500 },
    ];
    const order = ui.sortDiscIndicesClockwise(discs, 500, 500);
    assert.deepEqual(order.map((i) => discs[i].id), ['12h', '3h', '6h', '9h']);
  });

  it('applyPanelPresetToDiscs resolves all 4 locked clinical panels with 0 missing drugs', () => {
    const bp = loadBreakpoints();
    const ui = require(FORMULARY_PATH);
    const panels = ['Enterobacterales', 'Staphylococcus', 'Pseudomonas', 'Enterococcus'];
    for (const panelId of panels) {
      const discs = Array.from({ length: 8 }, (_, i) => {
        const theta = (i * 2 * Math.PI) / 8;
        return { code: `UNK-${i + 1}`, cx: 500 + 200 * Math.sin(theta), cy: 500 - 200 * Math.cos(theta) };
      });
      const res = ui.applyPanelPresetToDiscs(discs, panelId, bp, 500, 500);
      assert.equal(res.missingDrugs.length, 0, `${panelId} had missing drugs: ${res.missingDrugs.join(', ')}`);
      assert.equal(res.assignedCount, ui.CLINICAL_PANELS[panelId].length);
      assert.ok(discs[0].key && bp.drugs[discs[0].key], `${panelId} first disc must resolve to valid ADLMS_BREAKPOINTS key`);
    }
  });
});

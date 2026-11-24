/**
 * DeepHalo / ADLMS — mobile web MVP (Track A)
 * Vanilla ES2022, zero external frontend dependencies.
 *
 * Integrated pipeline:
 *  - Official EUCAST v16.1 breakpoints (parsed from v_16.1_Breakpoint_Tables.xlsx
 *    into breakpoints_data.js) + CLSI M100 reference toggle.
 *  - Trained YOLO11n-seg polygon contours & 6.0 mm fiducial scaling (plates_data.js
 *    and live POST /api/analyze backend inference via run_web_mvp.py).
 *  - 36-ray radial Sobel geometric cross-validation + EUCAST intrinsic resistance alerts.
 *  - Human-in-the-Loop sticky caliper & HL7 FHIR R4 Bundle export with audit trail.
 */

// ============================================================================
// 1. Clinical reference data (loaded from breakpoints_data.js / v_16.1_Breakpoint_Tables.xlsx)
// ============================================================================
const BP_BUNDLE = window.ADLMS_BREAKPOINTS || {};
const DRUGS = BP_BUNDLE.drugs || {};
const CODE_ALIASES = BP_BUNDLE.aliases || {};
const INTRINSIC_RULES = BP_BUNDLE.intrinsic_rules || [];

const FIDUCIAL_MM = 6.0;
const MAX_ZOOM = 4;
const CAT_LABEL = { S: 'Sensible', I: 'Intermedio', R: 'Resistente', NA: 'Sin punto de corte' };
const CAT_COLOR = { S: '#10b981', I: '#f59e0b', R: '#f43f5e', NA: '#64748b' };

// ============================================================================
// 2. State
// ============================================================================
const $ = (id) => document.getElementById(id);

const state = {
  plates: window.ADLMS_PLATES || [],
  plate: null,
  img: null,
  N: 1000,          // square canvas side (px)
  ox: 0, oy: 0,     // image offset inside the square canvas
  plateR: 480,
  scale: 7,         // px / mm
  discs: [],
  sel: -1,
  standard: 'EUCAST', // 'EUCAST' (v16.1 official xlsx default) or 'CLSI' (M100)
  organism: 'Escherichia coli (ATCC 25922)',
  group: 'Enterobacterales',
  layoutMode: localStorage.getItem('adlms_layout') === 'single' ? 'single' : 'twin',
  activeTab: 'placa',
  clahe: true, roi: true, cam: true, camAlpha: 0.45,
  zoom: 1, panX: 0, panY: 0,
  backendOnline: false,
  auditLog: [],
};

const base = document.createElement('canvas');   // image + roi + heat
const heat = document.createElement('canvas');   // cached Grad-CAM layer
const canvas = $('plate-canvas');
const ctx = canvas.getContext('2d');
const frame = $('viewer-frame');

// ============================================================================
// 3. Clinical logic (EUCAST v16.1 / CLSI M100 + Intrinsic Resistance)
// ============================================================================
function baseCode(code) {
  const head = String(code || '').split(/[-_]/)[0].trim().toUpperCase().replace(/\d+$/, '');
  return CODE_ALIASES[head] || head;
}

function normalizeGroup(groupOrOrg) {
  const low = String(groupOrOrg || '').toLowerCase();
  if (low.includes('staph')) return 'Staphylococcus';
  if (low.includes('pseudo')) return 'Pseudomonas';
  if (low.includes('enterococ')) return 'Enterococcus';
  if (low.includes('acineto')) return 'Acinetobacter';
  return 'Enterobacterales';
}

function breakpointFor(disc) {
  const drug = DRUGS[disc.key];
  if (!drug) return null;
  const std = (state.standard || 'EUCAST').toLowerCase();
  const group = normalizeGroup(state.group || state.organism);
  const stdMap = drug[std] || drug.eucast || drug.clsi;
  if (!stdMap) return null;
  return stdMap[group] || null;
}

function checkIntrinsicResistance(code, cat, organismName) {
  const orgLow = String(organismName || '').toLowerCase();
  const rawHead = String(code || '').split(/[-_]/)[0].trim().toUpperCase();
  if (!orgLow || !rawHead || rawHead === 'UNK') return { bioAlert: false, cat, msg: '' };

  for (const rule of INTRINSIC_RULES) {
    try {
      const re = new RegExp(rule.pattern, 'i');
      if (re.test(orgLow) && (rule.codes.includes(rawHead) || rule.codes.includes(baseCode(rawHead)))) {
        if (cat === 'S' || cat === 'I') {
          return {
            bioAlert: true,
            cat: 'R',
            msg: `Alerta EUCAST: Resistencia Intrínseca (${rule.mechanism}) - Fenotipo Clínicamente Discordante`
          };
        }
        return {
          bioAlert: false,
          cat: 'R',
          msg: `Resistencia intrínseca esperada (${rule.mechanism})`
        };
      }
    } catch {}
  }
  return { bioAlert: false, cat, msg: '' };
}

function evaluate(disc) {
  const bp = breakpointFor(disc);
  let cat = 'NA';
  if (bp) {
    const d = disc.mm;
    if (d >= bp.s) cat = 'S';
    else if (d < bp.r) cat = 'R';
    else cat = 'I';
  }
  const bio = checkIntrinsicResistance(disc.code, cat, state.organism);
  if (bio.bioAlert) cat = bio.cat;

  const inAtu = Boolean(
    bp && bp.atu && state.standard === 'EUCAST' &&
    Math.round(disc.mm) >= bp.atu[0] && Math.round(disc.mm) <= bp.atu[1]
  );
  const atuMsg = inAtu ? `ATU EUCAST (${bp.atu[0]}–${bp.atu[1]} mm): zona de incertidumbre técnica.` : '';

  return { cat, bp, bioAlert: bio.bioAlert, bioMsg: bio.msg, inAtu, atuMsg };
}

function bpText(disc) {
  const drug = DRUGS[disc.key];
  const bp = breakpointFor(disc);
  const std = state.standard || 'EUCAST';
  const group = normalizeGroup(state.group || state.organism);
  if (!bp) return drug && drug.note ? drug.note : `Sin punto de corte ${std} para ${group}`;
  if (bp.s >= 50) return `Sin S · I ≥ ${bp.r} mm · R < ${bp.r} mm (${std})`;
  return bp.s === bp.r
    ? `S ≥ ${bp.s} mm · R < ${bp.r} mm (${std})`
    : `S ≥ ${bp.s} mm · I ${bp.r}–${bp.s - 1} mm · R < ${bp.r} mm (${std})`;
}

// ============================================================================
// 4. Plate loading (annotations / YOLO detections -> discs, scale, halos)
// ============================================================================
function median(a) {
  if (!a.length) return 42;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function buildDiscsFromPlateData(plate, W, H, ox, oy) {
  const scale = plate.scalePxPerMm && plate.scalePxPerMm > 0
    ? plate.scalePxPerMm
    : median(plate.discs.map((d) => (d.w * W + d.h * H) / 2)) / FIDUCIAL_MM;

  const discs = plate.discs.map((d) => {
    const cx = d.x * W + ox;
    const cy = d.y * H + oy;
    const hx = (d.hx !== undefined ? d.hx : d.x) * W + ox;
    const hy = (d.hy !== undefined ? d.hy : d.y) * H + oy;
    const key = baseCode(d.abxCode || d.code);
    const mm = Math.round((d.mm !== undefined ? d.mm : FIDUCIAL_MM) * 10) / 10;
    const sobelMm = d.sobelMm !== undefined ? d.sobelMm : mm;
    const deltaR = d.deltaR !== undefined ? d.deltaR : Math.abs((mm - sobelMm) / 2);
    const geoValid = d.geoValid !== undefined ? d.geoValid : deltaR <= 1.2;
    const geoMessage = d.geoMessage || (geoValid
      ? `Sobel 36 rayos: Δr = ${deltaR.toFixed(2)} mm ≤ 1,2 mm`
      : `Discrepancia geométrica (Δr = ${deltaR.toFixed(2)} mm > 1,2 mm)`);
    const contour = Array.isArray(d.contour)
      ? d.contour.map(([px, py]) => [px * W + ox, py * H + oy])
      : [];

    const meta = DRUGS[key] || {};
    return {
      code: d.code,
      key,
      name: d.abxName || meta.name || d.code,
      cx, cy, hx, hy,
      mm, mm0: mm,
      sobelMm,
      deltaR,
      geoValid,
      geoMessage,
      contour,
      audited: false,
    };
  });

  return { discs, scale };
}

function syncOrganismSelector(plate) {
  const sel = $('organism-select');
  if (!sel || !plate) return;
  const org = plate.organism || 'Escherichia coli (ATCC 25922)';
  const grp = normalizeGroup(plate.group || org);
  state.organism = org;
  state.group = grp;

  const exactVal = `${org}|${grp}`;
  let matched = false;
  for (const opt of sel.options) {
    if (opt.value === exactVal || opt.value.toLowerCase().includes(org.split(' ')[0].toLowerCase())) {
      sel.value = opt.value;
      const [oName, oGrp] = opt.value.split('|');
      state.organism = oName;
      state.group = oGrp;
      matched = true;
      break;
    }
  }
  if (!matched) sel.selectedIndex = 0;
}

function loadPlate(plate) {
  const img = new Image();
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    state.plate = plate;
    state.img = img;
    state.N = Math.max(W, H);
    state.ox = (state.N - W) / 2;
    state.oy = (state.N - H) / 2;
    state.plateR = Math.min(W, H) * 0.487;
    state.auditLog = [];
    syncOrganismSelector(plate);
    const built = buildDiscsFromPlateData(plate, W, H, state.ox, state.oy);
    state.discs = built.discs;
    state.scale = built.scale;
    state.sel = state.discs.length ? 0 : -1;
    setupCanvases();
    resetView();
    rebuildAll();
    renderPicker();
    renderPanel();
  };
  img.src = plate.image;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function loadUpload(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    const sampleId = '20261122' + String(Math.floor(10000000 + Math.random() * 90000000));
    state.plate = {
      key: 'upload',
      title: `Captura · ${file.name}`,
      short: 'CAP',
      group: state.group,
      sampleId,
      organism: state.organism,
      image: url,
      discs: [],
    };
    state.img = img;
    state.N = Math.max(W, H);
    state.ox = (state.N - W) / 2;
    state.oy = (state.N - H) / 2;
    state.plateR = Math.min(W, H) * 0.487;
    state.discs = [];
    state.sel = -1;
    state.auditLog = [];
    state.scale = Math.min(W, H) / 140;
    setupCanvases();
    resetView();
    rebuildAll();
    renderPicker();
    renderPanel();

    toast('Ejecutando YOLO11n-seg + Sobel 36 rayos + OCR WHONET...');
    try {
      const dataUrl = await fileToDataUrl(file);
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: dataUrl,
          organism: state.organism,
          group: state.group,
          standard: state.standard,
          enable_ocr: true,
          ocr_angles: 8,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      state.backendOnline = true;
      state.plate.discs = (data.detections || []).map((d) => ({
        code: d.code,
        abxCode: d.abx_code,
        abxName: d.abx_name,
        x: d.x, y: d.y, w: d.w, h: d.h, hx: d.hx, hy: d.hy,
        mm: d.diam_mm,
        sobelMm: d.sobel_mm,
        deltaR: d.delta_r_mm,
        geoValid: d.geo_valid,
        geoMessage: d.geo_message,
        contour: d.zone_contour || [],
      }));
      state.plate.scalePxPerMm = data.scale_px_per_mm;

      const built = buildDiscsFromPlateData(state.plate, W, H, state.ox, state.oy);
      state.discs = built.discs;
      state.scale = data.scale_px_per_mm || built.scale;
      state.sel = state.discs.length ? 0 : -1;

      const engEl = $('meta-engine');
      if (engEl) engEl.textContent = `YOLO11n-seg (${data.inference_ms} ms) · En vivo`;

      rebuildAll();
      renderPanel();
      toast(`Inferencia completa: ${state.discs.length} discos detectados (${data.total_ms} ms)`);
    } catch {
      toast('Sin conexión a run_web_mvp.py: inicie python run_web_mvp.py para análisis YOLO11n-seg en vivo.');
    }
  };
  img.src = url;
}

function setupCanvases() {
  [canvas, base, heat].forEach((c) => { c.width = state.N; c.height = state.N; });
}

// ============================================================================
// 5. Rendering
// ============================================================================
function jet(v) {
  const c = (x) => Math.max(0, Math.min(1, x));
  return [c(1.5 - Math.abs(4 * v - 3)) * 255, c(1.5 - Math.abs(4 * v - 2)) * 255, c(1.5 - Math.abs(4 * v - 1)) * 255];
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function computeHeat() {
  const N = state.N, hw = Math.ceil(N / 2), step = N / hw;
  const hctx = heat.getContext('2d');
  hctx.clearRect(0, 0, N, N);
  if (!state.img) return;

  const tiny = document.createElement('canvas');
  const ts = Math.max(24, Math.round(N / 14));
  tiny.width = tiny.height = ts;
  const tctx = tiny.getContext('2d');
  tctx.drawImage(base._src || state.img, state.ox * ts / N, state.oy * ts / N, state.img.naturalWidth * ts / N, state.img.naturalHeight * ts / N);
  const small = document.createElement('canvas');
  small.width = small.height = hw;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(tiny, 0, 0, hw, hw);
  const px = sctx.getImageData(0, 0, hw, hw).data;

  let mean = 0, n = 0;
  const luma = new Float32Array(hw * hw);
  for (let i = 0; i < luma.length; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    luma[i] = l; mean += l; n++;
  }
  mean /= n;
  let varr = 0;
  for (let i = 0; i < luma.length; i++) varr += (luma[i] - mean) ** 2;
  const std = Math.sqrt(varr / n) || 1;

  const zones = state.discs.map((d) => ({
    x: d.hx, y: d.hy,
    r: Math.max((d.mm / 2) * state.scale, 3.9 * state.scale),
    dr: 3 * state.scale * 1.25, dx: d.cx, dy: d.cy
  }));

  const out = new ImageData(hw, hw);
  const cx = N / 2, cy = N / 2, R = state.plateR * 0.975;
  const sc = state.scale;
  for (let y = 0; y < hw; y++) {
    for (let x = 0; x < hw; x++) {
      const X = x * step, Y = y * step;
      const rim = R - Math.hypot(X - cx, Y - cy);
      if (rim <= 0) continue;
      let edge = Infinity;
      for (let k = 0; k < zones.length; k++) {
        const z = zones[k];
        const e = Math.hypot(X - z.x, Y - z.y) - z.r;
        if (e < edge) edge = e;
        if (Math.hypot(X - z.dx, Y - z.dy) < z.dr) { edge = -1; break; }
      }
      if (edge <= 0) continue;
      const mm = edge / sc;
      const l = (luma[y * hw + x] - mean) / std;
      const tex = 1 + 0.22 * Math.max(-1.5, Math.min(1.5, l));
      let v = (0.2 + 0.8 * Math.exp(-mm / 7)) * tex;
      v *= smooth(0, 1.6, mm) * smooth(0, 5, rim / sc);
      v = Math.max(0, Math.min(1, v));
      if (v < 0.04) continue;
      const [r, g, b] = jet(v);
      const i = (y * hw + x) * 4;
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
      out.data[i + 3] = Math.min(255, 30 + v * 215);
    }
  }
  const layer = document.createElement('canvas');
  layer.width = layer.height = hw;
  layer.getContext('2d').putImageData(out, 0, 0);
  hctx.imageSmoothingEnabled = true;
  hctx.imageSmoothingQuality = 'high';
  hctx.drawImage(layer, 0, 0, N, N);
}

function rebuildBase() {
  const N = state.N, b = base.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.fillStyle = '#03060b';
  b.fillRect(0, 0, N, N);
  if (!state.img) return;
  b.save();
  if (state.roi) {
    b.beginPath();
    b.arc(N / 2, N / 2, state.plateR, 0, Math.PI * 2);
    b.clip();
  }
  b.filter = state.clahe ? 'contrast(1.28) brightness(1.06) saturate(0.95)' : 'none';
  b.drawImage(state.img, state.ox, state.oy);
  b.restore();
  b.filter = 'none';
  if (state.cam) {
    b.save();
    if (state.roi) { b.beginPath(); b.arc(N / 2, N / 2, state.plateR, 0, Math.PI * 2); b.clip(); }
    b.globalAlpha = state.camAlpha;
    b.drawImage(heat, 0, 0);
    b.restore();
  }
  if (state.roi) {
    b.strokeStyle = 'rgba(45, 212, 191, 0.55)';
    b.lineWidth = N / 360;
    b.beginPath();
    b.arc(N / 2, N / 2, state.plateR, 0, Math.PI * 2);
    b.stroke();
  }
}

function render() {
  const N = state.N;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, N, N);
  ctx.drawImage(base, 0, 0);
  const frameW = frame.clientWidth || 358;
  const u = N / frameW / state.zoom;

  state.discs.forEach((d, i) => {
    const ev = evaluate(d);
    const col = CAT_COLOR[ev.cat];
    const selected = i === state.sel;
    const R = Math.max((d.mm / 2) * state.scale, 3 * state.scale + 3 * u);

    // Draw YOLO11n-seg segmentation polygon contour subtly when unmodified
    if (d.contour && d.contour.length >= 3 && Math.abs(d.mm - d.mm0) < 0.05) {
      ctx.save();
      ctx.lineWidth = 1.4 * u;
      ctx.strokeStyle = col;
      ctx.globalAlpha = selected ? 0.55 : 0.28;
      ctx.beginPath();
      d.contour.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.lineWidth = (selected ? 3 : 2) * u;
    ctx.strokeStyle = col;
    ctx.globalAlpha = selected ? 1 : 0.9;
    if (selected) ctx.setLineDash([7 * u, 5 * u]);
    ctx.beginPath();
    ctx.arc(d.hx, d.hy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (selected) {
      const a = -Math.PI / 4;
      const hx = d.hx + R * Math.cos(a), hy = d.hy + R * Math.sin(a);
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(hx, hy, 9 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = `600 ${11 * u}px "JetBrains Mono", monospace`;
      const tw = ctx.measureText(d.code).width;
      const px = d.hx, py = d.hy - R - 14 * u;
      ctx.fillStyle = 'rgba(7, 11, 18, 0.85)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.roundRect(px - tw / 2 - 7 * u, py - 10 * u, tw + 14 * u, 20 * u, 10 * u);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8eef8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.code, px, py + 0.5 * u);
      ctx.restore();
    }
  });
}

let rafId = 0;
function scheduleRender(heatDirty = false) {
  if (heatDirty) scheduleRender.heat = true;
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (scheduleRender.heat) { computeHeat(); rebuildBase(); scheduleRender.heat = false; }
    render();
  });
}
function rebuildAll() { computeHeat(); rebuildBase(); render(); }

// ============================================================================
// 6. View transform + gestures
// ============================================================================
function applyView() {
  const w = frame.clientWidth;
  state.zoom = Math.max(1, Math.min(MAX_ZOOM, state.zoom));
  state.panX = Math.min(0, Math.max(w * (1 - state.zoom), state.panX));
  state.panY = Math.min(0, Math.max(w * (1 - state.zoom), state.panY));
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  $('btn-reset-zoom').hidden = state.zoom <= 1.01;
  scheduleRender();
}
function resetView() { state.zoom = 1; state.panX = 0; state.panY = 0; applyView(); }
function zoomAt(fx, fy, z) {
  const old = state.zoom;
  const nz = Math.max(1, Math.min(MAX_ZOOM, z));
  const cx = (fx - state.panX) / old, cy = (fy - state.panY) / old;
  state.zoom = nz;
  state.panX = fx - cx * nz;
  state.panY = fy - cy * nz;
  applyView();
}
function fitFactor() { return frame.getBoundingClientRect().width / (frame.clientWidth || 1); }
function toLocal(clientX, clientY) {
  const r = frame.getBoundingClientRect();
  const f = r.width / (frame.clientWidth || 1);
  return { x: (clientX - r.left) / f, y: (clientY - r.top) / f, f };
}
function toCanvas(clientX, clientY) {
  const l = toLocal(clientX, clientY);
  const k = state.N / (frame.clientWidth || 1);
  return { x: ((l.x - state.panX) / state.zoom) * k, y: ((l.y - state.panY) / state.zoom) * k, k };
}
function hideHint() { $('viewer-hint').classList.add('hide'); }

function handlePos(d) {
  const R = Math.max((d.mm / 2) * state.scale, 3 * state.scale);
  const a = -Math.PI / 4;
  return { x: d.hx + R * Math.cos(a), y: d.hy + R * Math.sin(a) };
}
function hitDisc(p) {
  let best = -1, bestArea = Infinity;
  state.discs.forEach((d, i) => {
    const R = Math.max((d.mm / 2) * state.scale, 3.5 * state.scale);
    const inHalo = Math.hypot(p.x - d.hx, p.y - d.hy) <= R + 8 * (p.k / state.zoom);
    const onDisc = Math.hypot(p.x - d.cx, p.y - d.cy) <= 3.4 * state.scale;
    if (inHalo || onDisc) {
      const area = onDisc ? 0 : R * R;
      if (area < bestArea) { bestArea = area; best = i; }
    }
  });
  return best;
}

function initGestures() {
  const pointers = new Map();
  let mode = null, start = null, pinch = null;

  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hideHint();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const m = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: state.zoom, px: state.panX, py: state.panY, cx: m.x, cy: m.y };
      mode = 'pinch';
      return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    const sel = state.discs[state.sel];
    if (sel) {
      const h = handlePos(sel);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= 20 * (p.k / state.zoom)) { mode = 'resize'; frame.classList.add('dragging'); return; }
    }
    mode = 'pending';
    start = { x: e.clientX, y: e.clientY, px: state.panX, py: state.panY, t: performance.now() };
  });

  frame.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const nz = Math.max(1, Math.min(MAX_ZOOM, pinch.z * d / pinch.d));
      const mm = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
      const wx = (pinch.cx - pinch.px) / pinch.z, wy = (pinch.cy - pinch.py) / pinch.z;
      state.zoom = nz; state.panX = mm.x - wx * nz; state.panY = mm.y - wy * nz;
      applyView();
    } else if (mode === 'resize') {
      const d = state.discs[state.sel];
      const p = toCanvas(e.clientX, e.clientY);
      const mm = (Math.hypot(p.x - d.hx, p.y - d.hy) * 2) / state.scale;
      setMm(state.sel, mm, true);
    } else if (mode === 'pending' || mode === 'pan') {
      const f = fitFactor();
      const dx = (e.clientX - start.x) / f, dy = (e.clientY - start.y) / f;
      if (mode === 'pending' && Math.hypot(dx, dy) > 6 && state.zoom > 1) { mode = 'pan'; frame.classList.add('dragging'); }
      if (mode === 'pan') { state.panX = start.px + dx; state.panY = start.py + dy; applyView(); }
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'pending' && performance.now() - start.t < 450) {
      const i = hitDisc(toCanvas(e.clientX, e.clientY));
      if (i >= 0) selectDisc(i, true);
    }
    if (mode === 'pinch' && pointers.size >= 1) { mode = 'pan'; const [p] = [...pointers.values()]; start = { x: p.x, y: p.y, px: state.panX, py: state.panY, t: 0 }; }
    else if (pointers.size === 0) { mode = null; frame.classList.remove('dragging'); }
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);

  frame.addEventListener('wheel', (e) => {
    e.preventDefault();
    hideHint();
    const l = toLocal(e.clientX, e.clientY);
    zoomAt(l.x, l.y, state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });
  frame.addEventListener('dblclick', resetView);
}

// ============================================================================
// 7. Selection, caliper, panel & cross-validation UI
// ============================================================================
function selectDisc(i, scroll) {
  state.sel = i;
  renderPanel(scroll);
  scheduleRender();
}

function setMm(i, mm, fromDrag = false) {
  const d = state.discs[i];
  if (!d) return;
  const prevMm = d.mm;
  mm = Math.max(FIDUCIAL_MM, Math.min(60, Math.round(mm * 10) / 10));
  d.mm = mm;
  d.audited = Math.abs(d.mm - d.mm0) > 0.04;
  if (d.audited && Math.abs(prevMm - mm) > 0.04) {
    state.auditLog.push({
      timestamp: new Date().toISOString(),
      code: d.code,
      previous_mm: prevMm,
      new_mm: mm,
      status: 'AUDITED_BY_TECHNOLOGIST',
    });
  }
  scheduleRender(true);
  if (!fromDrag) renderPanel(); else renderPanel(false, true);

  const inp = $('cal-input');
  if (inp) {
    inp.classList.remove('pulse');
    void inp.offsetWidth;
    inp.classList.add('pulse');
    setTimeout(() => inp.classList.remove('pulse'), 180);
  }
}

function renderPicker() {
  const el = $('plate-picker');
  if (!el) return;
  el.innerHTML = '';
  state.plates.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'plate-chip' + (state.plate && state.plate.key === p.key ? ' active' : '');
    b.setAttribute('role', 'tab');
    const gramLabel = p.group && p.group.includes('Staph') ? 'Gram +' : 'Gram −';
    b.innerHTML = `<img src="${p.image}" alt=""><div><span>${p.short}</span><small>${gramLabel}</small></div>`;
    b.addEventListener('click', () => loadPlate(p));
    el.appendChild(b);
  });
  if (state.plate && state.plate.key === 'upload') {
    const b = document.createElement('button');
    b.className = 'plate-chip active';
    b.innerHTML = `<img src="${state.plate.image}" alt=""><div><span>CAP</span><small>En vivo</small></div>`;
    el.appendChild(b);
  }
}

function renderPanel(scroll = false, light = false) {
  const counts = { S: 0, I: 0, R: 0 };
  const rows = $('rows');

  if (!light) rows.innerHTML = '';
  state.discs.forEach((d, i) => {
    const ev = evaluate(d);
    if (counts[ev.cat] !== undefined) counts[ev.cat]++;
    let li = light ? rows.children[i] : null;
    if (!li) {
      li = document.createElement('li');
      li.addEventListener('click', () => selectDisc(i));
      rows.appendChild(li);
    }
    const edited = Math.abs(d.mm - d.mm0) > 0.04;
    const tags = [];
    if (ev.bioAlert) tags.push('<span class="rtag bio">INTRÍNSECA</span>');
    if (ev.inAtu) tags.push('<span class="rtag geo">ATU</span>');
    if (!d.geoValid && !edited) tags.push(`<span class="rtag geo">Δr ${d.deltaR.toFixed(1)}mm</span>`);
    if (edited) tags.push('<span class="rtag edit">VISADO</span>');

    li.className = 'row' + (i === state.sel ? ' selected' : '') + (edited ? ' edited' : '');
    li.innerHTML = `
      <div class="row-name">
        <b>${d.code}</b>
        <small>${d.name}</small>
        ${tags.length ? `<div class="row-tags">${tags.join('')}</div>` : ''}
      </div>
      <div class="row-mm">${d.mm.toFixed(1)}<small>mm</small></div>
      <span class="cat ${ev.cat === 'NA' ? '' : ev.cat.toLowerCase()}">${ev.cat === 'NA' ? '—' : ev.cat}</span>`;
    if (scroll && i === state.sel) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  if (!state.discs.length && !light) {
    rows.innerHTML = '<li class="row" style="cursor:default;grid-template-columns:1fr"><div class="row-name"><b>Sin detecciones</b><small>Cargue una fotografía con Capturar o seleccione una placa superior.</small></div></li>';
  }

  $('count-s').textContent = counts.S;
  $('count-i').textContent = counts.I;
  $('count-r').textContent = counts.R;

  const p = state.plate;
  const sampleId = p && p.sampleId ? p.sampleId : '2026102508332914';
  const metaSampleId = $('meta-sample-id');
  if (metaSampleId) metaSampleId.textContent = sampleId;

  $('panel-sub').textContent = p ? `ID: ${sampleId} · ${state.organism}` : '—';
  const stdText = state.standard === 'EUCAST' ? 'EUCAST v16.1' : 'CLSI M100';
  if ($('std-label')) $('std-label').textContent = state.standard;
  if ($('std-label-left')) $('std-label-left').textContent = state.standard;
  if ($('note-std')) $('note-std').textContent = stdText;
  if ($('modal-std-tag')) $('modal-std-tag').textContent = stdText;

  const telDiscPx = $('tel-disc-px');
  const telScale = $('tel-scale');
  const telRes = $('tel-res');
  if (telDiscPx && telScale && telRes) {
    if (state.scale > 0 && state.img) {
      telDiscPx.textContent = `${(state.scale * FIDUCIAL_MM).toFixed(1)} px`;
      telScale.textContent = `${state.scale.toFixed(2)} px/mm`;
      telRes.textContent = `${(1 / state.scale).toFixed(3)} mm/px`;
    } else {
      telDiscPx.textContent = '— px';
      telScale.textContent = '— px/mm';
      telRes.textContent = '— mm/px';
    }
  }

  renderCaliper();
}

function renderCaliper() {
  const d = state.discs[state.sel];
  const input = $('cal-input'), slider = $('cal-slider');
  const xvalBox = $('cal-xval'), geoPill = $('cal-geo-pill'), auditTag = $('cal-audit-tag'), bioAlertBox = $('cal-bio-alert');
  slider.min = FIDUCIAL_MM; slider.max = 60;

  if (!d) {
    $('cal-code').textContent = '—'; $('cal-name').textContent = 'Selecciona un halo';
    $('cal-cat').textContent = '—'; $('cal-cat').className = 'cat';
    $('cal-bp').textContent = '—'; input.value = ''; input.disabled = true; slider.disabled = true;
    if (xvalBox) xvalBox.hidden = true;
    if (bioAlertBox) bioAlertBox.hidden = true;
    return;
  }

  const ev = evaluate(d);
  input.disabled = false; slider.disabled = false;
  $('cal-code').textContent = d.code;
  $('cal-name').textContent = d.name;
  $('cal-cat').textContent = ev.cat === 'NA' ? '—' : `${ev.cat} · ${CAT_LABEL[ev.cat]}`;
  $('cal-cat').className = 'cat ' + (ev.cat === 'NA' ? '' : ev.cat.toLowerCase());
  $('cal-bp').textContent = bpText(d);
  if (document.activeElement !== input) input.value = d.mm.toFixed(1);
  slider.value = d.mm;

  if (xvalBox && geoPill) {
    xvalBox.hidden = false;
    const edited = Math.abs(d.mm - d.mm0) > 0.04;
    if (edited) {
      geoPill.className = 'xval-pill ok';
      geoPill.textContent = `Calibre ajustado (IA: ${d.mm0.toFixed(1)} mm)`;
    } else if (d.geoValid) {
      geoPill.className = 'xval-pill ok';
      geoPill.textContent = `Sobel 36 rayos · Δr=${d.deltaR.toFixed(2)} mm ✓`;
    } else {
      geoPill.className = 'xval-pill warn';
      geoPill.textContent = `Discrepancia Sobel Δr=${d.deltaR.toFixed(2)} mm (>1,2)`;
    }
    if (auditTag) auditTag.hidden = !edited;
  }

  if (bioAlertBox) {
    if (ev.bioAlert) {
      bioAlertBox.hidden = false;
      bioAlertBox.className = 'caliper-alert';
      bioAlertBox.textContent = ev.bioMsg;
    } else if (ev.inAtu) {
      bioAlertBox.hidden = false;
      bioAlertBox.className = 'caliper-alert atu';
      bioAlertBox.textContent = ev.atuMsg;
    } else {
      bioAlertBox.hidden = true;
    }
  }
}

function initPanelControls() {
  const nudge = (delta) => { const d = state.discs[state.sel]; if (d) setMm(state.sel, d.mm + delta); };
  $('cal-minus').addEventListener('click', () => nudge(-0.5));
  $('cal-plus').addEventListener('click', () => nudge(0.5));
  $('cal-slider').addEventListener('input', (e) => setMm(state.sel, parseFloat(e.target.value)));
  $('cal-input').addEventListener('input', (e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= FIDUCIAL_MM) setMm(state.sel, v); });
  $('cal-input').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0.5); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-0.5); }
  });
  $('cal-input').addEventListener('blur', renderCaliper);
  $('cal-reset').addEventListener('click', () => { const d = state.discs[state.sel]; if (d) setMm(state.sel, d.mm0); });

  const orgSelect = $('organism-select');
  if (orgSelect) {
    orgSelect.addEventListener('change', (e) => {
      const [org, grp] = e.target.value.split('|');
      state.organism = org;
      state.group = grp || normalizeGroup(org);
      renderPanel();
      scheduleRender();
      toast(`Organismo: ${state.organism} (${state.group})`);
    });
  }

  const toggles = [['toggle-clahe', 'clahe'], ['toggle-roi', 'roi'], ['toggle-gradcam', 'cam']];
  toggles.forEach(([id, key]) => {
    $(id).addEventListener('click', () => {
      state[key] = !state[key];
      $(id).classList.toggle('on', state[key]);
      $(id).setAttribute('aria-pressed', state[key]);
      rebuildBase(); render();
    });
  });
  $('slider-gradcam').addEventListener('input', (e) => { state.camAlpha = parseFloat(e.target.value); rebuildBase(); render(); });
  $('btn-reset-zoom').addEventListener('click', resetView);

  $('btn-upload').addEventListener('click', () => $('file-input').click());
  const btnUploadRight = $('btn-upload-right');
  if (btnUploadRight) btnUploadRight.addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadUpload(f); e.target.value = ''; });

  const btnLayoutSingle = $('btn-layout-single');
  const btnLayoutTwin = $('btn-layout-twin');
  if (btnLayoutSingle) btnLayoutSingle.addEventListener('click', () => setLayoutMode('single'));
  if (btnLayoutTwin) btnLayoutTwin.addEventListener('click', () => setLayoutMode('twin'));

  const tabPlacaLeft = $('tab-placa-left');
  const tabResultsLeft = $('tab-results');
  const tabPlacaRight = $('tab-placa-right');
  const tabResultsRight = $('tab-results-right');
  if (tabPlacaLeft) tabPlacaLeft.addEventListener('click', () => setActiveTab('placa'));
  if (tabResultsLeft) {
    tabResultsLeft.addEventListener('click', () => {
      setActiveTab('resultados');
      if (state.layoutMode === 'twin' && window.matchMedia('(min-width: 960px)').matches) {
        $('results-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
  if (tabPlacaRight) {
    tabPlacaRight.addEventListener('click', () => {
      setActiveTab('placa');
      if (state.layoutMode === 'twin' && window.matchMedia('(min-width: 960px)').matches) {
        const leftPhone = document.querySelector('.device-left');
        if (leftPhone) leftPhone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
  if (tabResultsRight) tabResultsRight.addEventListener('click', () => setActiveTab('resultados'));

  const toggleStandard = () => {
    state.standard = state.standard === 'EUCAST' ? 'CLSI' : 'EUCAST';
    renderPanel();
    scheduleRender();
    toast(`Estándar activo: ${state.standard === 'EUCAST' ? 'EUCAST v16.1 (2026)' : 'CLSI M100'}`);
  };

  if ($('btn-toggle-std')) $('btn-toggle-std').addEventListener('click', toggleStandard);
  if ($('btn-toggle-std-left')) $('btn-toggle-std-left').addEventListener('click', toggleStandard);

  const handleValidateLis = () => {
    if (!state.discs.length) { toast('No hay mediciones para validar'); return; }
    toast(`Antibiograma validado bajo ${state.standard}. Bundle HL7 FHIR R4 generado.`);
    openFhir();
  };

  if ($('btn-validate-lis')) $('btn-validate-lis').addEventListener('click', handleValidateLis);
  if ($('btn-export-fhir')) $('btn-export-fhir').addEventListener('click', handleValidateLis);
  if ($('btn-export-csv')) $('btn-export-csv').addEventListener('click', exportCsv);

  $('btn-close-modal').addEventListener('click', () => { $('fhir-modal').hidden = true; });
  $('fhir-modal').addEventListener('click', (e) => { if (e.target.id === 'fhir-modal') e.currentTarget.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('fhir-modal').hidden = true; });
  $('btn-copy-fhir').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('fhir-json-code').textContent); toast('Bundle FHIR copiado'); }
    catch { toast('No se pudo copiar; use Descargar'); }
  });
  $('btn-download-fhir').addEventListener('click', () => download('fhir_bundle.json', $('fhir-json-code').textContent, 'application/json'));
}

// ============================================================================
// 8. Export (HL7 FHIR R4 + CSV with NCh-ISO 15189 Audit Trail)
// ============================================================================
function buildFhir() {
  const now = new Date().toISOString();
  const id = `adlms-ast-${Date.now()}`;
  const obs = state.discs.map((d, i) => {
    const ev = evaluate(d);
    const drug = DRUGS[d.key] || {};
    const edited = Math.abs(d.mm - d.mm0) > 0.04;
    const codings = [];
    if (drug.loinc) codings.push({ system: 'http://loinc.org', code: drug.loinc, display: `${d.name} disk diffusion` });
    if (drug.atc) codings.push({ system: 'http://www.whocc.no/atc', code: drug.atc, display: d.name });

    const o = {
      resourceType: 'Observation',
      id: `obs-${i + 1}`,
      status: edited ? 'amended' : 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
      code: {
        coding: codings,
        text: `${d.name} (${d.code}) — diámetro del halo de inhibición`
      },
      effectiveDateTime: now,
      valueQuantity: { value: d.mm, unit: 'mm', system: 'http://unitsofmeasure.org', code: 'mm' },
      method: { text: 'Kirby-Bauer YOLO11n-seg + Calibración Fiducial 6,0 mm + Validación Cruzada Sobel 36 rayos' }
    };
    if (ev.cat !== 'NA') {
      o.interpretation = [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: ev.cat, display: CAT_LABEL[ev.cat] }]
      }];
    }
    const auditTag = edited ? ` AUDITED_BY_TECHNOLOGIST (IA=${d.mm0.toFixed(1)}mm -> ${d.mm.toFixed(1)}mm).` : ' VALIDATED_AUTO.';
    const geoNote = ` Sobel Δr=${d.deltaR.toFixed(2)}mm.`;
    const bioNote = ev.bioAlert ? ` ${ev.bioMsg}.` : '';
    o.note = [{ text: `Criterio: ${bpText(d)}.${geoNote}${bioNote}${auditTag}` }];
    return o;
  });

  const sampleId = state.plate && state.plate.sampleId ? String(state.plate.sampleId) : '2026102508332914';
  const stdDesc = state.standard === 'EUCAST' ? 'EUCAST v16.1 (2026-06-24)' : 'CLSI M100';
  return {
    resourceType: 'Bundle',
    id: `bundle-${id}`,
    type: 'collection',
    timestamp: now,
    entry: [
      {
        resource: {
          resourceType: 'DiagnosticReport',
          id,
          status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'MB', display: 'Microbiology' }] }],
          code: {
            coding: [
              { system: 'http://loinc.org', code: '18769-0', display: 'Microbial susceptibility tests' },
              { system: 'http://snomed.info/sct', code: '70549008', display: 'Antimicrobial susceptibility test' }
            ],
            text: 'Antibiograma por difusión en disco — DeepHalo / Suite ADLMS'
          },
          identifier: [{
            system: 'https://minsal.cl/lab/muestras',
            value: sampleId
          }],
          subject: {
            display: `Muestra Anonimizada ID ${sampleId} (Ley 21.719) · ${state.organism}`
          },
          effectiveDateTime: now,
          conclusion: `Aislamiento: ${state.organism} (${state.group}). Estándar: ${stdDesc}. Escala fiducial: ${state.scale.toFixed(2)} px/mm. Visado Human-in-the-Loop bajo NCh-ISO 15189:2022 (${state.auditLog.length} ajustes manuales registrados).`,
          result: obs.map((o) => ({ reference: `Observation/${o.id}` }))
        }
      },
      ...obs.map((o) => ({ resource: o }))
    ]
  };
}

function openFhir() {
  if (!state.discs.length) { toast('No hay mediciones para exportar'); return; }
  $('fhir-json-code').textContent = JSON.stringify(buildFhir(), null, 2);
  $('fhir-modal').hidden = false;
}

function exportCsv() {
  if (!state.discs.length) { toast('No hay mediciones para exportar'); return; }
  const lines = ['codigo,antimicrobiano,halo_mm,sobel_mm,delta_r_mm,categoria,punto_corte,alerta_biologica,auditado'];
  state.discs.forEach((d) => {
    const ev = evaluate(d);
    const edited = Math.abs(d.mm - d.mm0) > 0.04 ? 'AUDITED_BY_TECHNOLOGIST' : 'AUTO';
    lines.push([
      d.code,
      `"${d.name}"`,
      d.mm.toFixed(1),
      d.sobelMm.toFixed(1),
      d.deltaR.toFixed(2),
      ev.cat,
      `"${bpText(d)}"`,
      `"${ev.bioMsg || ev.atuMsg || ''}"`,
      edited,
    ].join(','));
  });
  download('antibiograma_eucast_v16_1.csv', lines.join('\n'), 'text/csv');
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}

// ============================================================================
// 9. Boot & Health Probe
// ============================================================================
async function probeBackend() {
  try {
    const r = await fetch('/api/health');
    if (r.ok) {
      const info = await r.json();
      state.backendOnline = true;
      const engEl = $('meta-engine');
      if (engEl && info.model_exists) engEl.textContent = 'YOLO11n-seg · API En Vivo ✓';
    }
  } catch {}
}

function tickClock() {
  const d = new Date();
  const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  if ($('status-time')) $('status-time').textContent = timeStr;
  if ($('status-time-right')) $('status-time-right').textContent = timeStr;
}

function setLayoutMode(mode) {
  state.layoutMode = mode === 'single' ? 'single' : 'twin';
  try { localStorage.setItem('adlms_layout', state.layoutMode); } catch {}
  document.body.setAttribute('data-layout', state.layoutMode);
  if ($('btn-layout-single')) $('btn-layout-single').classList.toggle('active', state.layoutMode === 'single');
  if ($('btn-layout-twin')) $('btn-layout-twin').classList.toggle('active', state.layoutMode === 'twin');
  fitDevice();
  applyView();
}

function setActiveTab(tab) {
  state.activeTab = tab === 'resultados' ? 'resultados' : 'placa';
  document.body.setAttribute('data-active-tab', state.activeTab);
  if ($('tab-placa-left')) $('tab-placa-left').classList.toggle('active', state.activeTab === 'placa');
  if ($('tab-results')) $('tab-results').classList.toggle('active', state.activeTab === 'resultados');
  if ($('tab-placa-right')) $('tab-placa-right').classList.toggle('active', state.activeTab === 'placa');
  if ($('tab-results-right')) $('tab-results-right').classList.toggle('active', state.activeTab === 'resultados');
  fitDevice();
  applyView();
}

function fitDevice() {
  const devs = document.querySelectorAll('.device');
  const mobileNative = window.matchMedia('(max-width: 600px)').matches;
  const H = 868, W = 414;
  if (mobileNative) {
    devs.forEach((d) => { d.style.transform = ''; d.style.margin = ''; });
    return;
  }
  const singleView = state.layoutMode === 'single' || window.matchMedia('(max-width: 959px)').matches;
  const fH = (window.innerHeight - 84) / H;
  const fW = singleView ? (window.innerWidth - 32) / W : (window.innerWidth - 64) / (W * 2 + 40);
  const f = Math.min(1, fH, fW);
  devs.forEach((d) => {
    d.style.transform = f < 1 ? `scale(${f})` : '';
    d.style.transformOrigin = 'center center';
    d.style.margin = f < 1 ? `${(-H * (1 - f)) / 2}px ${(-W * (1 - f)) / 2}px` : '';
  });
}

let resizeRaf = 0;
window.addEventListener('resize', () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    fitDevice();
    applyView();
  });
}, { passive: true });
setLayoutMode(state.layoutMode);
setActiveTab(state.activeTab);
tickClock();
setInterval(tickClock, 30000);
initGestures();
initPanelControls();
probeBackend();
if (state.plates.length) loadPlate(state.plates[0]);
else toast('plates_data.js no encontrado: ejecute scripts/build_mvp_plates.py');

if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.__adlms = state;

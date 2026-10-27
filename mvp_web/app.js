/**
 * DeepHalo / ADLMS — mobile web MVP
 * Vanilla ES2022, no dependencies.
 *
 * Data honesty notes
 *  - Disc positions, antibiotic codes and inhibition zones come from the YOLO labels of
 *    Antibiogram_demo/Train (see build_mvp_plates.py). They act as the "detector output".
 *  - Scale (px/mm) = median labelled-disc size / 6.0 mm fiducial.
 *  - Grad-CAM is a demo saliency derived from that geometry (lawn growth around halos),
 *    NOT live network activations. The UI says so.
 *  - Breakpoints are reference values; verify against the current EUCAST/CLSI tables.
 */

// ============================================================================
// 1. Clinical reference data (CLSI M100 / EUCAST v16.0)
// ============================================================================
// ent = Enterobacterales, sau = Staphylococcus aureus. { s, r }: S if d >= s, R if d < r, else I.
const DRUGS = {
  LEV: {
    name: 'Levofloxacino', atc: 'J01MA12',
    clsi:   { ent: { s: 21, r: 17 }, sau: { s: 19, r: 16 } },
    eucast: { ent: { s: 23, r: 19 }, sau: { s: 50, r: 22 } }
  },
  TGC: {
    name: 'Tigeciclina', atc: 'J01AA12',
    clsi:   { ent: { s: 19, r: 15 }, sau: { s: 19, r: 19 } },
    eucast: { ent: null, sau: { s: 18, r: 18 } }
  },
  P: {
    name: 'Penicilina G', atc: 'J01CE01', unit: 'U',
    clsi:   { ent: null, sau: { s: 29, r: 29 } },
    eucast: { ent: null, sau: { s: 26, r: 26 } }
  },
  NOR: {
    name: 'Norfloxacino', atc: 'J01MA06',
    clsi:   { ent: { s: 17, r: 13 }, sau: { s: 17, r: 13 } },
    eucast: { ent: null, sau: { s: 17, r: 17 } }
  },
  VA: {
    name: 'Vancomicina', atc: 'J01XA01',
    clsi:   { ent: null, sau: null },
    eucast: { ent: null, sau: null },
    note: 'Requiere CMI (difusión en disco no válida según CLSI/EUCAST)'
  },
  QD: {
    name: 'Quinupristina-dalfopristina', atc: 'J01FG02',
    clsi:   { ent: null, sau: { s: 19, r: 16 } },
    eucast: { ent: null, sau: { s: 21, r: 18 } }
  },
  LZD: {
    name: 'Linezolid', atc: 'J01XX08',
    clsi:   { ent: null, sau: { s: 21, r: 21 } },
    eucast: { ent: null, sau: { s: 21, r: 21 } }
  },
  RD: {
    name: 'Rifampicina', atc: 'J04AB02',
    clsi:   { ent: null, sau: { s: 20, r: 17 } },
    eucast: { ent: null, sau: { s: 26, r: 23 } }
  },
  DA: {
    name: 'Clindamicina', atc: 'J01FF01',
    clsi:   { ent: null, sau: { s: 21, r: 15 } },
    eucast: { ent: null, sau: { s: 22, r: 22 } }
  },
  E: {
    name: 'Eritromicina', atc: 'J01FA01',
    clsi:   { ent: null, sau: { s: 23, r: 14 } },
    eucast: { ent: null, sau: { s: 21, r: 21 } }
  },
  FOX: {
    name: 'Cefoxitina (cribado MRSA)', atc: 'J01DC01',
    clsi:   { ent: null, sau: { s: 22, r: 22 } },
    eucast: { ent: null, sau: { s: 22, r: 22 } }
  },
  TZP: {
    name: 'Piperacilina-tazobactam', atc: 'J01CR05',
    clsi:   { ent: { s: 25, r: 21 }, sau: null },
    eucast: { ent: { s: 20, r: 20 }, sau: null }
  },
  ATM: {
    name: 'Aztreonam', atc: 'J01DF01',
    clsi:   { ent: { s: 21, r: 18 }, sau: null },
    eucast: { ent: { s: 26, r: 21 }, sau: null }
  },
  SAM: {
    name: 'Ampicilina-sulbactam', atc: 'J01CR01',
    clsi:   { ent: { s: 15, r: 12 }, sau: null },
    eucast: { ent: { s: 14, r: 14 }, sau: null }
  },
  CXM: {
    name: 'Cefuroxima', atc: 'J01DC02',
    clsi:   { ent: { s: 18, r: 15 }, sau: null },
    eucast: { ent: { s: 18, r: 18 }, sau: null }
  },
  CAZ: {
    name: 'Ceftazidima', atc: 'J01DD02',
    clsi:   { ent: { s: 21, r: 18 }, sau: null },
    eucast: { ent: { s: 22, r: 19 }, sau: null }
  },
  AM: {
    name: 'Ampicilina', atc: 'J01CA01',
    clsi:   { ent: { s: 17, r: 14 }, sau: null },
    eucast: { ent: { s: 14, r: 14 }, sau: null }
  },
  IPM: {
    name: 'Imipenem', atc: 'J01DH51',
    clsi:   { ent: { s: 23, r: 20 }, sau: null },
    eucast: { ent: { s: 22, r: 17 }, sau: null }
  },
  PRL: {
    name: 'Piperacilina', atc: 'J01CA12',
    clsi:   { ent: { s: 21, r: 18 }, sau: null },
    eucast: { ent: { s: 21, r: 17 }, sau: null }
  },
  AMC: {
    name: 'Amoxicilina-ác. clavulánico', atc: 'J01CR02',
    clsi:   { ent: { s: 18, r: 14 }, sau: null },
    eucast: { ent: { s: 19, r: 19 }, sau: null }
  },
  CRO: {
    name: 'Ceftriaxona', atc: 'J01DD04',
    clsi:   { ent: { s: 26, r: 23 }, sau: null },
    eucast: { ent: { s: 25, r: 22 }, sau: null }
  },
  FEP: {
    name: 'Cefepima', atc: 'J01DE01',
    clsi:   { ent: { s: 25, r: 19 }, sau: null },
    eucast: { ent: { s: 27, r: 24 }, sau: null }
  },
  AK: {
    name: 'Amikacina', atc: 'J01GB06',
    clsi:   { ent: { s: 17, r: 15 }, sau: null },
    eucast: { ent: { s: 18, r: 18 }, sau: null }
  },
  ETP: {
    name: 'Ertapenem', atc: 'J01DH03',
    clsi:   { ent: { s: 22, r: 19 }, sau: null },
    eucast: { ent: { s: 25, r: 22 }, sau: null }
  },
  CTX: {
    name: 'Cefotaxima', atc: 'J01DD01',
    clsi:   { ent: { s: 26, r: 23 }, sau: null },
    eucast: { ent: { s: 20, r: 17 }, sau: null }
  },
  F: {
    name: 'Nitrofurantoína', atc: 'J01XE01',
    clsi:   { ent: { s: 17, r: 15 }, sau: null },
    eucast: { ent: { s: 11, r: 11 }, sau: null }
  },
  CN: {
    name: 'Gentamicina', atc: 'J01GB03',
    clsi:   { ent: { s: 15, r: 13 }, sau: null },
    eucast: { ent: { s: 17, r: 17 }, sau: null }
  },
  MXF: {
    name: 'Moxifloxacino', atc: 'J01MA14',
    clsi:   { ent: { s: 24, r: 21 }, sau: null },
    eucast: { ent: { s: 22, r: 19 }, sau: null }
  },
  CIP: {
    name: 'Ciprofloxacino', atc: 'J01MA02',
    clsi:   { ent: { s: 26, r: 22 }, sau: null },
    eucast: { ent: { s: 25, r: 22 }, sau: null }
  },
  TOB: {
    name: 'Tobramicina', atc: 'J01GB01',
    clsi:   { ent: { s: 15, r: 13 }, sau: null },
    eucast: { ent: { s: 17, r: 17 }, sau: null }
  },
  SXT: {
    name: 'Trimetoprima-sulfametoxazol', atc: 'J01EE01',
    clsi:   { ent: { s: 16, r: 11 }, sau: null },
    eucast: { ent: { s: 14, r: 11 }, sau: null }
  }
};

const FIDUCIAL_MM = 6.0;
const MAX_ZOOM = 4;
const CAT_LABEL = { S: 'Sensible', I: 'Intermedio', R: 'Resistente', NA: 'Sin punto de corte' };
const CAT_COLOR = { S: '#34d399', I: '#fbbf24', R: '#f87171', NA: '#64748b' };

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
  standard: 'CLSI', // 'CLSI' (default) or 'EUCAST'
  clahe: true, roi: true, cam: true, camAlpha: 0.45,
  zoom: 1, panX: 0, panY: 0
};

const base = document.createElement('canvas');   // image + roi + heat
const heat = document.createElement('canvas');   // cached Grad-CAM layer
const canvas = $('plate-canvas');
const ctx = canvas.getContext('2d');
const frame = $('viewer-frame');

// ============================================================================
// 3. Clinical logic
// ============================================================================
function baseCode(code) { return code.split('-')[0]; }

function breakpointFor(disc) {
  const drug = DRUGS[disc.key];
  if (!drug) return null;
  const std = (state.standard || 'CLSI').toLowerCase();
  const set = drug[std] || drug.clsi || drug.eucast;
  if (!set) return null;
  return state.plate && state.plate.group === 'Staphylococcus aureus' ? set.sau : set.ent;
}

function evaluate(disc) {
  const bp = breakpointFor(disc);
  if (!bp) return { cat: 'NA', bp: null };
  const d = disc.mm;
  if (d >= bp.s) return { cat: 'S', bp };
  if (d < bp.r) return { cat: 'R', bp };
  return { cat: 'I', bp };
}

function bpText(disc) {
  const drug = DRUGS[disc.key];
  const bp = breakpointFor(disc);
  const std = state.standard || 'CLSI';
  if (!bp) return drug && drug.note ? drug.note : `Sin punto de corte ${std} para este grupo`;
  return bp.s === bp.r
    ? `S ≥ ${bp.s} mm · R < ${bp.r} mm (${std})`
    : `S ≥ ${bp.s} mm · I ${bp.r}–${bp.s - 1} mm · R < ${bp.r} mm (${std})`;
}

function potency(disc) {
  const n = disc.code.split('-')[1];
  const unit = (DRUGS[disc.key] && DRUGS[disc.key].unit) || 'µg';
  return n ? `${n} ${unit}` : '';
}

// ============================================================================
// 4. Plate loading (annotations -> discs, scale, halos)
// ============================================================================
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function buildDiscsFromAnnotations(plate, W, H, ox, oy) {
  const sizes = plate.discs.map((d) => (d.w * W + d.h * H) / 2);
  const scale = median(sizes) / FIDUCIAL_MM;
  const zones = plate.zones.map((z) => ({ ...z, cx: z.x * W + ox, cy: z.y * H + oy, size: (z.w * W + z.h * H) / 2, used: false }));

  const discs = plate.discs.map((d) => {
    const cx = d.x * W + ox, cy = d.y * H + oy;
    let best = null, bd = Infinity;
    zones.forEach((z) => {
      if (z.used) return;
      const dist = Math.hypot(z.cx - cx, z.cy - cy);
      if (dist < bd) { bd = dist; best = z; }
    });
    let hx = cx, hy = cy, mm = FIDUCIAL_MM;
    if (best) {
      best.used = true;
      const zmm = best.size / scale;
      if (zmm > FIDUCIAL_MM * 1.12) { mm = zmm; hx = best.cx; hy = best.cy; }
    }
    mm = Math.round(mm * 10) / 10;
    return { code: d.code, key: baseCode(d.code), name: (DRUGS[baseCode(d.code)] || { name: d.code }).name, cx, cy, hx, hy, mm, mm0: mm };
  });
  return { discs, scale };
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
    const built = buildDiscsFromAnnotations(plate, W, H, state.ox, state.oy);
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

function loadUpload(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    state.plate = {
      key: 'upload',
      title: file.name,
      short: 'CAP',
      group: 'Aislamiento clínico',
      sampleId: '20261025' + String(Math.floor(10000000 + Math.random() * 90000000)),
      organism: 'Aislamiento clínico (en proceso)',
      image: url
    };
    state.img = img;
    state.N = Math.max(W, H);
    state.ox = (state.N - W) / 2;
    state.oy = (state.N - H) / 2;
    state.plateR = Math.min(W, H) * 0.487;
    state.discs = [];
    state.sel = -1;
    state.scale = Math.min(W, H) / 140; // assume ~140 mm plate until the detector runs
    setupCanvases();
    resetView();
    rebuildAll();
    renderPicker();
    renderPanel();
    toast('Imagen cargada. La detección automática requiere el modelo YOLO11n entrenado (Fase 3).');
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

/** Heat only on bacterial growth: lawn outside halos/discs, hottest on the growth edge that borders each halo. */
function computeHeat() {
  const N = state.N, hw = Math.ceil(N / 2), step = N / hw;
  const hctx = heat.getContext('2d');
  hctx.clearRect(0, 0, N, N);
  if (!state.img) return;

  // low-pass luminance as a density proxy for the lawn
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
      if (edge <= 0) continue;                       // inside a halo or on a disc -> no heat
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
  const u = N / frameW / state.zoom;     // canvas px per on-screen px (keeps strokes crisp when zooming)

  state.discs.forEach((d, i) => {
    const ev = evaluate(d);
    const col = CAT_COLOR[ev.cat];
    const selected = i === state.sel;
    const R = Math.max((d.mm / 2) * state.scale, 3 * state.scale + 3 * u);

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
      // drag handle (human-in-the-loop caliper)
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

      // code tag only (no measurements on the plate)
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
/** Ratio between on-screen size and layout size (the device is scaled to fit short windows). */
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
  let mode = null, start = null, pinch = null, raf = 0;

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
      const mx = mm.x, my = mm.y;
      const wx = (pinch.cx - pinch.px) / pinch.z, wy = (pinch.cy - pinch.py) / pinch.z;
      state.zoom = nz; state.panX = mx - wx * nz; state.panY = my - wy * nz;
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
// 7. Selection, caliper, panel
// ============================================================================
function selectDisc(i, scroll) {
  state.sel = i;
  renderPanel(scroll);
  scheduleRender();
}

function setMm(i, mm, fromDrag = false) {
  const d = state.discs[i];
  if (!d) return;
  mm = Math.max(FIDUCIAL_MM, Math.min(60, Math.round(mm * 10) / 10));
  d.mm = mm;
  scheduleRender(true);
  if (!fromDrag) renderPanel(); else renderPanel(false, true);

  // Micro-interaction: tactile pulse feedback on caliper reading
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
    b.innerHTML = `<img src="${p.image}" alt=""><div><span>${p.short}</span><small>${p.group === 'Staphylococcus aureus' ? 'Gram +' : 'Gram −'}</small></div>`;
    b.addEventListener('click', () => loadPlate(p));
    el.appendChild(b);
  });
  if (state.plate && state.plate.key === 'upload') {
    const b = document.createElement('button');
    b.className = 'plate-chip active';
    b.innerHTML = `<img src="${state.plate.image}" alt=""><div><span>CAP</span><small>Captura</small></div>`;
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
    li.className = 'row' + (i === state.sel ? ' selected' : '') + (Math.abs(d.mm - d.mm0) > 0.04 ? ' edited' : '');
    li.innerHTML = `
      <div class="row-name"><b>${d.code}</b><small>${d.name}</small></div>
      <div class="row-mm">${d.mm.toFixed(1)}<small>mm</small></div>
      <span class="cat ${ev.cat === 'NA' ? '' : ev.cat.toLowerCase()}">${ev.cat === 'NA' ? '—' : ev.cat}</span>`;
    if (scroll && i === state.sel) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  if (!state.discs.length && !light) {
    rows.innerHTML = '<li class="row" style="cursor:default;grid-template-columns:1fr"><div class="row-name"><b>Sin detecciones</b><small>Cargue una placa de muestra o entrene el modelo (Fase 3).</small></div></li>';
  }

  $('count-s').textContent = counts.S;
  $('count-i').textContent = counts.I;
  $('count-r').textContent = counts.R;

  const p = state.plate;
  const sampleId = p && p.sampleId ? p.sampleId : '2026102508332914';
  const organism = p && p.organism ? p.organism : (p ? p.group : 'Escherichia coli (ATCC 25922)');

  // Update mobile identification card (below S - I - R resume)
  const metaSampleId = $('meta-sample-id');
  if (metaSampleId) metaSampleId.textContent = sampleId;
  const metaOrganism = $('meta-organism');
  if (metaOrganism) metaOrganism.textContent = organism;

  // Update right panel header
  $('panel-sub').textContent = p ? `ID: ${sampleId} · ${organism}` : '—';
  const stdLabel = $('std-label');
  if (stdLabel) stdLabel.textContent = state.standard;
  const noteStd = $('note-std');
  if (noteStd) noteStd.textContent = state.standard;
  const modalStdTag = $('modal-std-tag');
  if (modalStdTag) modalStdTag.textContent = state.standard;
  renderCaliper();
}

function renderCaliper() {
  const d = state.discs[state.sel];
  const input = $('cal-input'), slider = $('cal-slider');
  slider.min = FIDUCIAL_MM; slider.max = 60;
  if (!d) {
    $('cal-code').textContent = '—'; $('cal-name').textContent = 'Selecciona un halo';
    $('cal-cat').textContent = '—'; $('cal-cat').className = 'cat';
    $('cal-bp').textContent = '—'; input.value = ''; input.disabled = true; slider.disabled = true;
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
  $('tab-results').addEventListener('click', () => $('results-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  const tabPlacaRight = $('tab-placa-right');
  if (tabPlacaRight) tabPlacaRight.addEventListener('click', () => {
    const leftPhone = document.querySelector('.device-left');
    if (leftPhone) leftPhone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const btnToggleStd = $('btn-toggle-std');
  if (btnToggleStd) {
    btnToggleStd.addEventListener('click', () => {
      state.standard = state.standard === 'CLSI' ? 'EUCAST' : 'CLSI';
      const stdLabel = $('std-label');
      if (stdLabel) stdLabel.textContent = state.standard;
      const noteStd = $('note-std');
      if (noteStd) noteStd.textContent = state.standard;
      const modalStdTag = $('modal-std-tag');
      if (modalStdTag) modalStdTag.textContent = state.standard;
      renderPanel();
      scheduleRender();
      toast(`Estándar activo: ${state.standard} (${state.standard === 'CLSI' ? 'M100' : 'v16.0'})`);
    });
  }

  const handleValidateLis = () => {
    if (!state.discs.length) { toast('No hay mediciones para validar'); return; }
    toast(`Antibiograma validado bajo norma ${state.standard}. Transmisión a LIS generada.`);
    openFhir();
  };

  const btnValidateLis = $('btn-validate-lis');
  if (btnValidateLis) btnValidateLis.addEventListener('click', handleValidateLis);

  const btnExportFhir = $('btn-export-fhir');
  if (btnExportFhir) btnExportFhir.addEventListener('click', handleValidateLis);

  const btnExportCsv = $('btn-export-csv');
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsv);

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
// 8. Export (HL7 FHIR R4 + CSV)
// ============================================================================
function buildFhir() {
  const now = new Date().toISOString();
  const id = `adlms-ast-${Date.now()}`;
  const obs = state.discs.map((d, i) => {
    const ev = evaluate(d);
    const drug = DRUGS[d.key] || {};
    const o = {
      resourceType: 'Observation',
      id: `obs-${i + 1}`,
      status: 'preliminary',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
      code: {
        coding: drug.atc ? [{ system: 'http://www.whocc.no/atc', code: drug.atc, display: d.name }] : [],
        text: `${d.name} (${d.code}) — diámetro del halo de inhibición`
      },
      effectiveDateTime: now,
      valueQuantity: { value: d.mm, unit: 'mm', system: 'http://unitsofmeasure.org', code: 'mm' },
      method: { text: 'Difusión en disco Kirby-Bauer, medición asistida por IA con calibre del técnico' }
    };
    if (ev.cat !== 'NA') {
      o.interpretation = [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: ev.cat, display: CAT_LABEL[ev.cat] }]
      }];
    }
    o.note = [{ text: `Puntos de corte: ${bpText(d)}.${Math.abs(d.mm - d.mm0) > 0.04 ? ' Medida ajustada manualmente.' : ''}` }];
    return o;
  });

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
          status: 'preliminary',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'MB', display: 'Microbiology' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: '18769-0', display: 'Microbial susceptibility tests' }], text: 'Antibiograma por difusión en disco — DeepHalo / ADLMS' },
          identifier: [{
            system: 'https://minsal.cl/lab/muestras',
            value: state.plate && state.plate.sampleId ? String(state.plate.sampleId) : '2026102508332914'
          }],
          subject: {
            display: `Muestra ID ${state.plate && state.plate.sampleId ? state.plate.sampleId : '2026102508332914'} · ${state.plate && state.plate.organism ? state.plate.organism : 'Aislamiento clínico'}`
          },
          effectiveDateTime: now,
          conclusion: `${state.plate ? state.plate.title : ''} (ID: ${state.plate && state.plate.sampleId ? state.plate.sampleId : ''} · ${state.plate && state.plate.organism ? state.plate.organism : ''}). Validado bajo estándar clínico ${state.standard} (Chile) y visado por el técnico para despacho a LIS.`,
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
  const lines = ['codigo,antimicrobiano,halo_mm,categoria,punto_corte,editado'];
  state.discs.forEach((d) => {
    const ev = evaluate(d);
    lines.push([d.code, d.name, d.mm.toFixed(1), ev.cat, `"${bpText(d)}"`, Math.abs(d.mm - d.mm0) > 0.04 ? 'si' : 'no'].join(','));
  });
  download('antibiograma.csv', lines.join('\n'), 'text/csv');
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
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ============================================================================
// 9. Boot
// ============================================================================
function tickClock() {
  const d = new Date();
  const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  const tLeft = $('status-time');
  if (tLeft) tLeft.textContent = timeStr;
  const tRight = $('status-time-right');
  if (tRight) tRight.textContent = timeStr;
}

/** On wide screens both phones are scaled down so they always fit the window height and width. */
function fitDevice() {
  const devs = document.querySelectorAll('.device');
  const wide = window.matchMedia('(min-width: 960px)').matches;
  const H = 868, W = 414;
  if (!wide) {
    devs.forEach(d => { d.style.transform = ''; d.style.margin = ''; });
    return;
  }
  const fH = (window.innerHeight - 48) / H;
  const fW = (window.innerWidth - 64) / (W * 2 + 40);
  const f = Math.min(1, fH, fW);
  devs.forEach(d => {
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
fitDevice();
tickClock();
setInterval(tickClock, 30000);
initGestures();
initPanelControls();
if (state.plates.length) loadPlate(state.plates[0]);
else toast('plates_data.js no encontrado: ejecute build_mvp_plates.py');

// Test hook
window.__adlms = state;

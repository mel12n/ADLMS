// ADLMS Phase 9 — SRP Manual Drug Formulary Picker & Clinical Panel Presets (<= 300 lines)
(function (root) {
  'use strict';

  const CLINICAL_PANELS = Object.freeze({
    Enterobacterales: ['AMP', 'AMC', 'CTX', 'CAZ', 'CIP', 'GEN', 'MEM', 'SXT'],
    Staphylococcus: ['FOX', 'PEN', 'ERY', 'CLI', 'CIP', 'GEN', 'SXT', 'LZD'],
    Pseudomonas: ['CAZ', 'FEP', 'TZP', 'MEM', 'CIP', 'GEN', 'AMK', 'ATM'],
    Enterococcus: ['AMP', 'VAN', 'TEC', 'CIP', 'LZD', 'NIT'],
  });

  const PANEL_LABELS = Object.freeze({
    Enterobacterales: 'Enterobact.',
    Staphylococcus: 'Staph.',
    Pseudomonas: 'Pseudomonas',
    Enterococcus: 'Enterococcus',
  });

  function isUnkCode(code) {
    const s = String(code || '').trim();
    return !s || /^UNK(\b|[-_\d])/i.test(s);
  }

  function buildDrugCatalog(breakpoints) {
    const bp = breakpoints || (root && root.ADLMS_BREAKPOINTS) || {};
    const drugs = bp.drugs || {};
    const aliases = bp.aliases || {};
    const reverseAliases = {};
    Object.keys(aliases).forEach((alias) => {
      const target = aliases[alias];
      if (!reverseAliases[target]) reverseAliases[target] = [];
      if (!reverseAliases[target].includes(alias)) reverseAliases[target].push(alias);
    });
    return Object.keys(drugs)
      .map((key) => {
        const d = drugs[key] || {};
        const rev = reverseAliases[key] || [];
        const groups = Array.from(
          new Set([...Object.keys(d.eucast || {}), ...Object.keys(d.clsi || {})])
        );
        const searchText = [key, d.code, d.name, d.atc, d.potency, ...rev]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return {
          key,
          code: d.code || key,
          name: d.name || key,
          potency: d.potency || '',
          atc: d.atc || '',
          aliases: rev,
          groups,
          searchText,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  function filterDrugCatalog(catalog, query, activeGroup) {
    const list = Array.isArray(catalog) ? catalog : [];
    const q = String(query || '').trim().toLowerCase();
    const filtered = q ? list.filter((item) => item.searchText.includes(q)) : list.slice();
    if (!activeGroup) return filtered;
    return filtered.sort((a, b) => {
      const aIn = a.groups.includes(activeGroup) ? 0 : 1;
      const bIn = b.groups.includes(activeGroup) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return a.code.localeCompare(b.code);
    });
  }

  function findNextUnkIndex(discs, afterIndex) {
    if (!Array.isArray(discs) || discs.length === 0) return -1;
    const n = discs.length;
    const start = Number.isInteger(afterIndex) ? ((afterIndex % n) + n) % n : -1;
    for (let step = 1; step <= n; step++) {
      const idx = (start + step) % n;
      if (isUnkCode(discs[idx] && discs[idx].code)) return idx;
    }
    return -1;
  }

  function sortDiscIndicesClockwise(discs, centerX, centerY) {
    if (!Array.isArray(discs) || discs.length === 0) return [];
    let cx = centerX;
    let cy = centerY;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      cx = discs.reduce((acc, d) => acc + (Number(d.cx) || 0), 0) / discs.length;
      cy = discs.reduce((acc, d) => acc + (Number(d.cy) || 0), 0) / discs.length;
    }
    return discs
      .map((d, idx) => ({
        idx,
        angle: (Math.atan2((Number(d.cx) || 0) - cx, -((Number(d.cy) || 0) - cy)) + 2 * Math.PI) % (2 * Math.PI),
      }))
      .sort((a, b) => a.angle - b.angle || a.idx - b.idx)
      .map((entry) => entry.idx);
  }

  function applyPanelPresetToDiscs(discs, panelId, breakpoints, centerX, centerY) {
    const bp = breakpoints || (root && root.ADLMS_BREAKPOINTS) || {};
    const panelCodes = CLINICAL_PANELS[panelId];
    if (!panelCodes || !Array.isArray(discs)) {
      return { panelId, assignedCount: 0, missingDrugs: [], assignments: [] };
    }
    const aliases = bp.aliases || {};
    const drugs = bp.drugs || {};
    const order = sortDiscIndicesClockwise(discs, centerX, centerY);
    const missingDrugs = [];
    const assignments = [];
    const limit = Math.min(order.length, panelCodes.length);
    for (let i = 0; i < limit; i++) {
      const rawCode = panelCodes[i];
      const key = aliases[rawCode] || rawCode;
      const drug = drugs[key];
      if (!drug) {
        missingDrugs.push(rawCode);
        continue;
      }
      const discIndex = order[i];
      discs[discIndex].code = drug.code || key;
      discs[discIndex].key = key;
      discs[discIndex].name = drug.name || key;
      assignments.push({ discIndex, rawCode, key, code: discs[discIndex].code, name: discs[discIndex].name });
    }
    return { panelId, assignedCount: assignments.length, missingDrugs, assignments };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function initFormularyUI(api) {
    if (typeof document === 'undefined' || !api) return null;
    const catalog = buildDrugCatalog(root && root.ADLMS_BREAKPOINTS);
    let currentDiscIdx = -1;
    let modal = document.getElementById('formulary-modal');
    let searchInput = null;
    let listEl = null;
    let titleEl = null;

    function ensureModal() {
      if (modal) return modal;
      modal = el('div', 'formulary-modal hidden');
      modal.id = 'formulary-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const sheet = el('div', 'formulary-sheet');
      const header = el('div', 'formulary-header');
      titleEl = el('div', 'formulary-title', 'Seleccionar antibiótico');
      const closeBtn = el('button', 'formulary-close', '✕');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Cerrar selector');
      closeBtn.addEventListener('click', close);
      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.id = 'formulary-search';
      searchInput.className = 'formulary-search';
      searchInput.placeholder = 'Buscar código, alias o fármaco (ej. AMP, CIP, Meropenem)...';
      searchInput.autocomplete = 'off';
      searchInput.addEventListener('input', renderList);

      listEl = el('div', 'formulary-list');
      sheet.appendChild(header);
      sheet.appendChild(searchInput);
      sheet.appendChild(listEl);
      modal.appendChild(sheet);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });
      document.body.appendChild(modal);
      return modal;
    }

    function renderList() {
      if (!listEl) return;
      const state = api.getState ? api.getState() : {};
      const activeGroup = state.group || '';
      const matches = filterDrugCatalog(catalog, searchInput ? searchInput.value : '', activeGroup);
      listEl.textContent = '';
      if (matches.length === 0) {
        listEl.appendChild(el('div', 'formulary-empty', 'Sin coincidencias en el formulario (65 fármacos)'));
        return;
      }
      matches.forEach((drug) => {
        const row = el('button', 'formulary-row');
        row.type = 'button';
        const badgeText = drug.aliases.length ? `${drug.code} (${drug.aliases[0]})` : drug.code;
        row.appendChild(el('span', 'formulary-code', badgeText));
        row.appendChild(el('span', 'formulary-name', drug.name));
        if (activeGroup && drug.groups.includes(activeGroup)) {
          row.appendChild(el('span', 'formulary-tag', activeGroup.slice(0, 6)));
        }
        row.addEventListener('click', () => onSelectDrug(drug));
        listEl.appendChild(row);
      });
    }

    function onSelectDrug(drug) {
      if (currentDiscIdx < 0) return;
      if (api.assignDiscDrug) api.assignDiscDrug(currentDiscIdx, drug);
      const state = api.getState ? api.getState() : {};
      const nextIdx = findNextUnkIndex(state.discs || [], currentDiscIdx);
      if (nextIdx !== -1 && nextIdx !== currentDiscIdx) {
        if (api.selectDisc) api.selectDisc(nextIdx);
        openForDisc(nextIdx);
      } else {
        close();
        if (api.toast) api.toast('Todos los discos asignados');
      }
    }

    function openForDisc(idx) {
      const state = api.getState ? api.getState() : {};
      const discs = state.discs || [];
      if (!discs[idx]) return;
      currentDiscIdx = idx;
      ensureModal();
      const disc = discs[idx];
      titleEl.textContent = `Disco #${idx + 1} (${disc.code || 'UNK'}) — ${catalog.length} fármacos`;
      searchInput.value = '';
      modal.classList.remove('hidden');
      renderList();
      setTimeout(() => searchInput && searchInput.focus(), 30);
    }

    function close() {
      if (modal) modal.classList.add('hidden');
      currentDiscIdx = -1;
    }

    function renderPresets() {
      const host = document.getElementById('formulary-presets');
      if (!host) return;
      host.textContent = '';
      Object.keys(CLINICAL_PANELS).forEach((panelId) => {
        const btn = el('button', 'formulary-preset-btn', PANEL_LABELS[panelId] || panelId);
        btn.type = 'button';
        btn.dataset.panel = panelId;
        btn.addEventListener('click', () => {
          if (api.applyPanelPreset) api.applyPanelPreset(panelId);
        });
        host.appendChild(btn);
      });
    }

    renderPresets();
    return { openForDisc, close, renderPresets };
  }

  const exported = {
    CLINICAL_PANELS,
    buildDrugCatalog,
    filterDrugCatalog,
    findNextUnkIndex,
    sortDiscIndicesClockwise,
    applyPanelPresetToDiscs,
    initFormularyUI,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (root) root.ADLMS_FORMULARY_UI = exported;
})(typeof window !== 'undefined' ? window : globalThis);

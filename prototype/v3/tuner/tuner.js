// Difficulty tuner for v3: pick a level, edit its script and the rules, run bot matches in Web Workers,
// show who wins and how. Uses the game's own src/sim.js and src/bots.js (inlined above by tuner/build.py).
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = x => `${Math.round(x * 100)}%`;
  const copy = o => JSON.parse(JSON.stringify(o));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked or full */ } },
  };

  // ---- the roster ----
  const ORDER = LEVEL_ORDER.filter(k => BOT_LEVELS[k]);
  for (const k in BOT_LEVELS) if (!ORDER.includes(k)) ORDER.push(k);
  const BOTS = SKILLS.concat(STYLES);
  const COLORS = {
    idle: '#5A6480', random: '#FF7A3D', beginner: '#B45CFF', casual: '#5CFFA1', smart: '#3FE6FF',
    supportHeavy: '#FFD23F', offenseHeavy: '#FF3DCB', gunner: '#C9F25C', stormSpam: '#FF3B4E',
  };
  const colorOf = k => COLORS[k] || '#9AA4BF';
  const KIND_KEYS = Object.keys(KINDS).filter(k => k !== 'wormlet');
  const KIND_COLOR = { staph: '#FF3DCB', mrsa: '#FFD23F', pseudo: '#A9CF3C', flu: '#8FB8FF', spore: '#F3E3B5', clos: '#D9A35C', tb: '#FF7A3D', toxic: '#B45CFF', strep: '#2FB89A', virus: '#D9B6FF', worm: '#C9F25C' };
  const KIND_SHORT = { staph: 'Staph', mrsa: 'MRSA', pseudo: 'Pseudo', flu: 'Flu', spore: 'Spores', clos: 'Clostridium', tb: 'TB', toxic: 'Toxic staph', strep: 'Strep chains', virus: 'Herpes', worm: 'Tapeworms' };
  const kcol = k => KIND_COLOR[k] || '#9AA4BF';
  const kname = k => KIND_SHORT[k] || (KINDS[k] && KINDS[k].name) || k;
  const lvName = k => (BOT_LEVELS[k] && BOT_LEVELS[k].name) || k;

  // ---- settings: {tune: {group: {key: n}}, levels: {key: {duration, waves, toxins, stream}}, pressure: {key: x}} ----
  // Only what differs from the live game is kept.
  const num = (x, d) => (x !== '' && x != null && isFinite(+x) ? +x : d);
  const sortKeys = (o, first) => { const out = {}; for (const k of first) if (k in o) out[k] = o[k]; for (const k of Object.keys(o).sort()) if (!(k in out)) out[k] = o[k]; return out; };
  function normLevel(o, live) {
    o = o || {}; live = live || {};
    const duration = Math.max(10, Math.round(num(o.duration, live.duration || 300)));
    const waves = (Array.isArray(o.waves) ? o.waves : live.waves || []).filter(w => w && isFinite(+w.t)).map(w => {
      const x = { ...w, t: Math.max(0, Math.round(+w.t)) };
      for (const k of KIND_KEYS) { const n = Math.round(+w[k] || 0); if (n > 0) x[k] = n; else delete x[k]; }
      if (w.final) x.final = true; else delete x.final;
      return sortKeys(x, ['t', ...KIND_KEYS, 'final']);
    }).sort((a, b) => a.t - b.t);
    const toxins = (Array.isArray(o.toxins) ? o.toxins : live.toxins || []).map(Number).filter(t => isFinite(t) && t >= 0).map(Math.round).sort((a, b) => a - b);
    const ls = live.stream || { start: 0, end: 0, clump: 4, kinds: [{ k: 'staph', w: 1 }] }, os = o.stream || ls;
    let kinds = (Array.isArray(os.kinds) ? os.kinds : ls.kinds).filter(x => x && KINDS[x.k] && +x.w > 0).map(x => {
      const y = { k: x.k, w: +(+x.w).toFixed(3) };
      if (+x.from > 0) y.from = Math.round(+x.from);
      return y;
    });
    if (!kinds.length) kinds = copy(ls.kinds);
    const stream = sortKeys({ ...os, start: Math.max(0, +num(os.start, ls.start).toFixed(3)), end: Math.max(0, +num(os.end, ls.end).toFixed(3)), clump: Math.max(1, Math.round(num(os.clump, ls.clump || 4))), kinds }, ['start', 'end', 'clump', 'kinds']);
    return { duration, waves, toxins, stream };
  }
  const LIVE_LV = {};
  for (const k of ORDER) LIVE_LV[k] = normLevel(BOT_LEVELS[k], BOT_LEVELS[k]);
  function normalize(s) {
    s = s || {};
    const tune = {}, levels = {}, pressure = {};
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) {
      const v = s.tune && s.tune[g] && s.tune[g][k];
      if (typeof v === 'number' && isFinite(v) && v !== DEFAULTS[g][k]) (tune[g] = tune[g] || {})[k] = v;
    }
    for (const k of ORDER) {
      const o = s.levels && s.levels[k];
      if (o && typeof o === 'object') { const n = normLevel(o, LIVE_LV[k]); if (JSON.stringify(n) !== JSON.stringify(LIVE_LV[k])) levels[k] = n; }
      const p = s.pressure && +s.pressure[k];
      if (p > 0 && isFinite(p) && Math.abs(p - 1) > 1e-9) pressure[k] = +p.toFixed(3);
    }
    return { tune, levels, pressure };
  }
  const val = (s, g, k) => (s.tune[g] && typeof s.tune[g][k] === 'number' ? s.tune[g][k] : DEFAULTS[g][k]);
  const presOf = (s, k) => s.pressure[k] || 1;
  // The script the game actually runs: pressure baked in exactly the way bots.js applySettings does it
  function effLevel(s, k) {
    const b = normLevel(s.levels[k] || LIVE_LV[k], LIVE_LV[k]), f = presOf(s, k);
    if (f !== 1) {
      for (const w of b.waves) for (const x in KINDS) if (w[x] && x !== 'worm') w[x] = Math.max(1, Math.round(w[x] * f));
      b.stream.start *= f; b.stream.end *= f;
    }
    return b;
  }
  const sigFor = (s, k) => JSON.stringify([s.tune, effLevel(s, k)]);
  const runSettings = (s, k) => ({ tune: s.tune, levels: { [k]: effLevel(s, k) } });
  const LIVE = normalize({});
  const LIVE_SIG = {};
  for (const k of ORDER) LIVE_SIG[k] = sigFor(LIVE, k);

  // Results that ship with the page, computed by tuner/baseline.js for the live game's numbers
  const BASE_OK = BASELINE && BASELINE.src === SRC_HASH;
  const BASE = {};
  for (const k of ORDER) {
    const b = BASELINE && BASELINE.levels && BASELINE.levels[k];
    BASE[k] = {
      ladder: b ? { ...b.ladder, sig: BASE_OK ? LIVE_SIG[k] : 'old' } : null,
      strat: b ? { ...b.strat, sig: BASE_OK ? LIVE_SIG[k] : 'old' } : null,
    };
  }
  const EMPTY = { sig: 'none', n: 0, runs: [] };

  // ---- saved state ----
  const saved = store.get('immuneTunerV3.state') || {};
  let settings = normalize(saved.settings);
  let level = ORDER.includes(saved.level) ? saved.level : ORDER.includes('papercut') ? 'papercut' : ORDER[0];
  let results = saved.results && typeof saved.results === 'object' ? saved.results : {}; // runs made on this device: {level: {ladder, strat}}
  for (const k in results) for (const r of Object.values(results[k] || {})) if (r && r.partial === true) r.partial = 'stopped';
  let tab = ['ladder', 'strat', 'all'].includes(saved.tab) ? saved.tab : 'ladder';
  let slots = store.get('immuneTunerV3.slots') || [];
  const persist = () => store.set('immuneTunerV3.state', { settings, level, results, tab });
  const extraCols = {}; // antigen columns added to a level's wave table this session

  function resFor(k, kind, s) {
    s = s || settings;
    const mine = results[k] && results[k][kind], b = BASE[k] && BASE[k][kind], cur = sigFor(s, k);
    if (mine && mine.sig === cur) return mine;
    if (b && b.sig === cur) return b;
    return mine || b || EMPTY;
  }
  const fresh = (r, k, s) => r.sig === sigFor(s || settings, k) && r.partial !== true;

  // ---- knobs ----
  const GROUP_NAMES = {
    marrow: 'Marrow', caps: 'Cell caps', start: 'Starting cells', output: 'Body output', fatigue: 'Fatigue', physics: 'Physics',
    neutrophil: 'Neutrophils', net: 'Net neutrophils', nk: 'NK cells', macrophage: 'Macrophages', support: 'Support rings',
    bacteria: 'All antigens', staph: 'Staph', mrsa: 'MRSA', pseudo: 'Pseudomonas', flu: 'Influenza', spore: 'Clostridium spores', clos: 'Clostridium',
    tb: 'Tuberculosis', toxic: 'Toxic-shock Staph', strep: 'Strep chains', herpes: 'Herpes', worm: 'Tapeworm',
    storm: 'Cytokine storm', toxin: 'Toxin bursts', lymph: 'Lymph node',
  };
  const human = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  const gname = g => GROUP_NAMES[g] || human(g);
  const ANTIGEN_GROUPS = ['bacteria', 'staph', 'mrsa', 'pseudo', 'flu', 'spore', 'clos', 'tb', 'toxic', 'strep', 'herpes', 'worm'];
  const GROUP_KINDS = { staph: ['staph'], mrsa: ['mrsa'], pseudo: ['pseudo'], flu: ['flu'], spore: ['spore'], clos: ['spore', 'clos'], tb: ['tb'], toxic: ['toxic'], strep: ['strep'], herpes: ['virus'], worm: ['worm'] };
  const GROUP_UNITS = { net: 'net', nk: 'nk', macrophage: 'mac', support: 'mac' };
  const SIDE = [['Your cells', ['neutrophil', 'net', 'nk', 'macrophage', 'support', 'start', 'caps']], ['Production and body', ['marrow', 'output', 'fatigue']], ['Cytokine storm', ['storm']]];
  const RULES = ['toxin', 'lymph', 'physics'];
  const placed = new Set([...ANTIGEN_GROUPS, ...SIDE.flatMap(x => x[1]), ...RULES]);
  const OTHER = Object.keys(DEFAULTS).filter(g => !placed.has(g));
  const stepFor = v => (Number.isInteger(v) && Math.abs(v) >= 2 ? 1 : 0.05);
  const levelKinds = k => {
    const L = effLevel(settings, k), s = new Set();
    for (const w of L.waves) for (const x of KIND_KEYS) if (w[x]) s.add(x);
    for (const x of L.stream.kinds) s.add(x.k);
    return s;
  };
  const inLevel = g => {
    if (GROUP_KINDS[g]) { const ks = levelKinds(level); return GROUP_KINDS[g].some(x => ks.has(x)); }
    if (GROUP_UNITS[g]) return (BOT_LEVELS[level].units || []).includes(GROUP_UNITS[g]);
    return null;
  };
  const tuneChanges = () => Object.values(settings.tune).reduce((a, g) => a + Object.keys(g).length, 0);
  const levelChanged = k => !!(settings.levels[k] || settings.pressure[k]);
  const openState = store.get('immuneTunerV3.open') || { script: true };

  function fieldHTML(g, k) {
    const id = `k-${g}-${k}`, v = val(settings, g, k), changed = v !== DEFAULTS[g][k];
    const hint = HINTS[`${g}.${k}`];
    return `<div class="field${changed ? ' changed' : ''}" data-g="${g}" data-k="${k}"><label for="${id}">${esc(human(k))}</label>` +
      `<input type="number" id="${id}" inputmode="decimal" step="${stepFor(DEFAULTS[g][k])}" value="${v}">` +
      `<small>${hint ? esc(hint) : ''}<span class="was">${changed ? ` Live game: ${DEFAULTS[g][k]}.` : ''}</span></small></div>`;
  }
  function groupHTML(g) {
    if (!DEFAULTS[g]) return '';
    const keys = Object.keys(DEFAULTS[g]), n = keys.filter(k => val(settings, g, k) !== DEFAULTS[g][k]).length, here = inLevel(g);
    return `<details data-sec="${g}"${openState[g] ? ' open' : ''}><summary${here === false ? ' class="off"' : ''}><span>${esc(gname(g))}</span>${here ? '<span class="here">in this level</span>' : ''}<span class="cnt" data-cnt="${g}">${n ? n + ' changed' : ''}</span></summary><div class="sect">${keys.map(k => fieldHTML(g, k)).join('')}</div></details>`;
  }
  function buildKnobs() {
    const L = BOT_LEVELS[level];
    let h = `<details data-sec="script"${openState.script !== false ? ' open' : ''}><summary><span>${esc(L.name)} script</span><span class="cnt" data-cnt="script"></span></summary><div class="sect">
      <div class="pressure" id="pressureBox"><label for="pressure">Pressure</label><input type="number" id="pressure" inputmode="decimal" min="0.1" step="0.05">
        <input type="range" id="pressureRange" min="0.5" max="2" step="0.05" aria-label="Pressure slider">
        <small>Scales every wave and the trickle on this level. 1 = as written, 1.2 = 20% more of everything. Tapeworms stay one each. The table below stays as written; the gold numbers are what the game sends.</small></div>
      <p class="small muted" style="margin:0">Everything the script sends in, per 15 seconds, before anything divides. Strep counts every link; tapeworms are the green flags.</p>
      <svg class="chart big" id="arrivals" viewBox="0 0 600 160" role="img" aria-label="Scripted arrivals over the level"></svg>
      <div class="legend" id="arrLegend"></div>
      <div class="field" data-lvf="duration"><label for="lvDuration">Duration (s)</label><input type="number" id="lvDuration" inputmode="numeric" step="10" min="10"><small>How long the bar takes to fill. Waves and the trickle stop here; you win once every antigen is gone.</small></div>
      <div class="sub">Waves</div>
      <div class="wrap-x"><table class="waves" id="waveTable"></table></div>
      <div class="row"><button class="btn" id="addWave" type="button">Add wave</button><select id="addKind" aria-label="Add an antigen column to the wave table"></select></div>
      <div class="sub">Trickle between waves</div>
      <div class="field" data-st="start"><label for="stStart">Rate at 0:00 (per second)</label><input type="number" id="stStart" inputmode="decimal" step="0.05" min="0"></div>
      <div class="field" data-st="end"><label for="stEnd">Rate at the end (per second)</label><input type="number" id="stEnd" inputmode="decimal" step="0.05" min="0"></div>
      <div class="field" data-st="clump"><label for="stClump">Largest clump</label><input type="number" id="stClump" inputmode="numeric" step="1" min="1"><small>The trickle arrives in clumps of 1 up to this many.</small></div>
      <div class="wrap-x"><table class="waves" id="streamTable"></table></div>
      <div class="row"><select id="addStreamKind" aria-label="Add an antigen to the trickle"></select></div>
      <div class="sub">Toxin bursts (seconds)</div>
      <div class="toxlist" id="toxRows"></div>
      <div class="row"><button class="btn" id="addTox" type="button">Add toxin burst</button></div>
    </div></details>`;
    const ks = levelKinds(level);
    const ag = ANTIGEN_GROUPS.filter(g => DEFAULTS[g]).sort((a, b) => (a === 'bacteria' ? -1 : b === 'bacteria' ? 1 : (inLevel(b) ? 1 : 0) - (inLevel(a) ? 1 : 0)));
    h += `<div class="kh div"><h2>Antigens</h2><p class="small muted">How each antigen behaves, on every level. The ones in ${esc(L.name)} come first.</p></div>`;
    h += ag.map(groupHTML).join('');
    h += `<div class="kh div"><h2>Your side</h2><p class="small muted">These change the player's power, on every level.</p></div>`;
    for (const [title, gs] of SIDE) h += `<div class="sub muted" style="padding:10px 0 2px">${title}</div>` + gs.map(groupHTML).join('');
    h += `<div class="kh div"><h2>Rules and physics</h2></div>` + RULES.concat(OTHER).map(groupHTML).join('');
    $('#knobs').innerHTML = h;
    void ks;
    renderScript(); renderCounts();
  }
  function renderScript() { syncScriptFields(); renderWaves(); renderStream(); renderToxins(); drawArrivals(); }

  // Edits go to this level's own copy of the script; the live game's copy is never touched
  const draft = () => settings.levels[level] || (settings.levels[level] = copy(LIVE_LV[level]));
  const cur = () => settings.levels[level] || LIVE_LV[level];
  function syncScriptFields() {
    const L = cur(), p = presOf(settings, level);
    $('#pressure').value = p; $('#pressureRange').value = p;
    $('#pressureBox').classList.toggle('changed', p !== 1);
    $('#lvDuration').value = L.duration;
    $('[data-lvf="duration"]').classList.toggle('changed', L.duration !== LIVE_LV[level].duration);
    for (const f of ['start', 'end', 'clump']) {
      const el = $(`[data-st="${f}"]`);
      el.querySelector('input').value = L.stream[f];
      el.classList.toggle('changed', L.stream[f] !== LIVE_LV[level].stream[f]);
    }
  }
  function waveCols() {
    const s = new Set(extraCols[level] || []);
    for (const w of LIVE_LV[level].waves.concat(cur().waves)) for (const k of KIND_KEYS) if (w[k]) s.add(k);
    return KIND_KEYS.filter(k => s.has(k));
  }
  function renderWaves() {
    const cols = waveCols(), L = cur(), f = presOf(settings, level);
    let h = `<thead><tr><th>Time (s)</th>${cols.map(k => `<th><i style="background:${kcol(k)}"></i>${esc(kname(k))}</th>`).join('')}<th>Final</th><th></th></tr></thead><tbody>`;
    h += L.waves.map((w, i) => `<tr data-i="${i}"><td><input type="number" aria-label="Wave ${i + 1} time in seconds" data-f="t" min="0" step="5" value="${w.t}"><div class="clock">${fmtT(w.t)}</div></td>` +
      cols.map(k => {
        const n = w[k] || 0, eff = n && f !== 1 && k !== 'worm' ? Math.max(1, Math.round(n * f)) : null;
        return `<td><input type="number" aria-label="Wave ${i + 1} ${esc(kname(k))}" data-f="${k}" min="0" step="${k === 'worm' ? 1 : k === 'strep' || n < 20 ? 1 : 5}" value="${n}"><div class="eff">${eff != null && eff !== n ? '→ ' + eff : ''}</div></td>`;
      }).join('') +
      `<td><input type="checkbox" aria-label="Wave ${i + 1} is the final wave" data-f="final"${w.final ? ' checked' : ''}></td><td><button class="x" type="button" aria-label="Remove wave ${i + 1}" data-del="${i}">×</button></td></tr>`).join('');
    $('#waveTable').innerHTML = h + '</tbody>';
    const missing = KIND_KEYS.filter(k => !cols.includes(k));
    $('#addKind').innerHTML = `<option value="">Add an antigen column…</option>` + missing.map(k => `<option value="${k}">${esc(kname(k))}</option>`).join('');
    $('#addKind').hidden = !missing.length;
  }
  function renderStream() {
    const S = cur().stream;
    $('#streamTable').innerHTML = `<thead><tr><th>Trickle mix</th><th>Weight</th><th>From (s)</th><th></th></tr></thead><tbody>` +
      S.kinds.map((x, i) => `<tr data-si="${i}"><td style="padding-top:9px;white-space:nowrap"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${kcol(x.k)}"></i>${esc(kname(x.k))}</td>` +
        `<td><input type="number" aria-label="${esc(kname(x.k))} share of the trickle" data-sf="w" min="0" step="0.05" value="${x.w}"></td>` +
        `<td><input type="number" aria-label="${esc(kname(x.k))} joins the trickle at this second" data-sf="from" min="0" step="10" value="${x.from || 0}"></td>` +
        `<td>${S.kinds.length > 1 ? `<button class="x" type="button" aria-label="Remove ${esc(kname(x.k))} from the trickle" data-sdel="${i}">×</button>` : ''}</td></tr>`).join('') + '</tbody>';
    const missing = KIND_KEYS.filter(k => k !== 'worm' && !S.kinds.some(x => x.k === k));
    $('#addStreamKind').innerHTML = `<option value="">Add an antigen to the trickle…</option>` + missing.map(k => `<option value="${k}">${esc(kname(k))}</option>`).join('');
  }
  function renderToxins() {
    $('#toxRows').innerHTML = cur().toxins.map((t, i) => `<label><input type="number" aria-label="Toxin burst ${i + 1} time in seconds" min="0" step="5" value="${t}" data-tox="${i}"><span class="clock mono small muted">${fmtT(t)}</span><button class="x btn quiet" style="padding:2px 8px" type="button" aria-label="Remove toxin burst ${i + 1}" data-deltox="${i}">×</button></label>`).join('') || '<span class="small muted">None</span>';
  }

  function setVal(g, k, v) {
    if (!settings.tune[g]) settings.tune[g] = {};
    settings.tune[g][k] = v;
    settings = normalize(settings);
    edited();
  }
  // After any edit: save, refresh counts, the chart and the results (which may now be for other settings)
  function edited() { persist(); renderCounts(); drawArrivals(); renderResults(); }
  const tidy = () => { settings = normalize(settings); persist(); };

  $('#knobs').addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'pressure' || t.id === 'pressureRange') {
      const v = parseFloat(t.value); if (!(v > 0)) return;
      settings.pressure[level] = v;
      settings = normalize(settings);
      if (t.id === 'pressure') $('#pressureRange').value = v; else $('#pressure').value = v;
      $('#pressureBox').classList.toggle('changed', v !== 1);
      renderWaves(); edited(); return;
    }
    const f = t.closest('.field');
    if (f && f.dataset.g) {
      const v = parseFloat(t.value); if (!isFinite(v)) return;
      setVal(f.dataset.g, f.dataset.k, v);
      const changed = v !== DEFAULTS[f.dataset.g][f.dataset.k];
      f.classList.toggle('changed', changed);
      f.querySelector('.was').textContent = changed ? ` Live game: ${DEFAULTS[f.dataset.g][f.dataset.k]}.` : '';
      return;
    }
    if (f && f.dataset.lvf) { const v = parseFloat(t.value); if (!(v >= 10)) return; draft().duration = v; f.classList.toggle('changed', v !== LIVE_LV[level].duration); edited(); return; }
    if (f && f.dataset.st) { const v = parseFloat(t.value); if (!(v >= 0)) return; draft().stream[f.dataset.st] = v; f.classList.toggle('changed', v !== LIVE_LV[level].stream[f.dataset.st]); edited(); return; }
    const tr = t.closest('#waveTable tr');
    if (tr && tr.dataset.i != null) {
      const w = draft().waves[+tr.dataset.i], k = t.dataset.f;
      if (k === 'final') w.final = t.checked;
      else { const v = parseFloat(t.value); if (!isFinite(v)) return; w[k] = Math.max(0, v); }
      if (k === 't') tr.querySelector('.clock').textContent = fmtT(w.t);
      edited(); return;
    }
    const sr = t.closest('#streamTable tr');
    if (sr && sr.dataset.si != null) {
      const v = parseFloat(t.value); if (!(v >= 0)) return;
      draft().stream.kinds[+sr.dataset.si][t.dataset.sf] = v;
      edited(); return;
    }
    if (t.dataset.tox != null) {
      const v = parseFloat(t.value); if (!isFinite(v)) return;
      draft().toxins[+t.dataset.tox] = Math.max(0, v);
      t.nextElementSibling.textContent = fmtT(v);
      edited();
    }
  });
  // Rows keep their place while typing; they are sorted and cleaned up when a field is left
  $('#knobs').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'addKind') { if (t.value) { (extraCols[level] = extraCols[level] || []).push(t.value); renderWaves(); } return; }
    if (t.id === 'addStreamKind') { if (t.value) { draft().stream.kinds.push({ k: t.value, w: 0.1 }); tidy(); renderStream(); edited(); } return; }
    if (t.closest('#waveTable') || t.closest('#streamTable') || t.closest('#toxRows') || t.closest('[data-lvf]') || t.closest('[data-st]')) { tidy(); renderScript(); renderCounts(); }
  });
  $('#knobs').addEventListener('click', e => {
    const d = e.target.dataset || {};
    if (d.del != null) { draft().waves.splice(+d.del, 1); tidy(); renderWaves(); edited(); }
    else if (d.deltox != null) { draft().toxins.splice(+d.deltox, 1); tidy(); renderToxins(); edited(); }
    else if (d.sdel != null) { draft().stream.kinds.splice(+d.sdel, 1); tidy(); renderStream(); edited(); }
    else if (e.target.id === 'addWave') {
      const L = draft(), last = L.waves[L.waves.length - 1], cols = waveCols();
      const w = { t: Math.min(L.duration, (last ? last.t : 0) + 30) };
      w[cols[0] || 'staph'] = 30;
      L.waves.push(w); tidy(); renderWaves(); edited();
    } else if (e.target.id === 'addTox') { const L = draft(); L.toxins.push(Math.round(L.duration / 2)); tidy(); renderToxins(); edited(); }
  });
  $('#knobs').addEventListener('toggle', e => {
    const d = e.target; if (!d.dataset || !d.dataset.sec) return;
    openState[d.dataset.sec] = d.open; store.set('immuneTunerV3.open', openState);
  }, true);

  function renderCounts() {
    const nT = tuneChanges(), nL = ORDER.filter(levelChanged).length;
    const parts = [];
    if (nT) parts.push(`${nT} rule${nT > 1 ? 's' : ''}`);
    if (nL) parts.push(`${nL} level${nL > 1 ? 's' : ''}`);
    $('#changeCount').textContent = parts.length ? `Changed from the live game: ${parts.join(', ')}` : 'Same as the live game';
    document.querySelectorAll('[data-cnt]').forEach(el => {
      const g = el.dataset.cnt;
      if (g === 'script') el.textContent = levelChanged(level) ? 'changed' : '';
      else { const c = Object.keys(DEFAULTS[g]).filter(k => val(settings, g, k) !== DEFAULTS[g][k]).length; el.textContent = c ? `${c} changed` : ''; }
    });
    renderLevelPicker();
  }
  function renderLevelPicker() {
    const sel = $('#level');
    sel.innerHTML = ORDER.map((k, i) => `<option value="${k}"${k === level ? ' selected' : ''}>${i + 1}. ${esc(lvName(k))}${levelChanged(k) ? ' (changed)' : ''}</option>`).join('');
    const L = BOT_LEVELS[level], units = (L.units || []).map(u => UNIT_NAMES[u] || u).join(', ');
    $('#blurb').innerHTML = `${esc(L.blurb || '')} <b>${fmtT(effLevel(settings, level).duration)}</b> · ${esc(units)}`;
  }
  $('#level').addEventListener('change', e => { level = e.target.value; persist(); buildKnobs(); renderResults(); });

  // Scripted arrivals per 15 s by antigen kind: trickle (expected, lighter) and waves; toxin bursts as red lines
  function drawArrivals() {
    const svg = $('#arrivals'); if (!svg) return;
    const L = effLevel(settings, level), dur = L.duration, S = L.stream, links = val(settings, 'strep', 'links');
    const B = 15, nb = Math.max(1, Math.ceil(Math.max(dur, ...L.waves.map(w => w.t + 1)) / B));
    const kinds = [...new Set([...S.kinds.map(x => x.k), ...L.waves.flatMap(w => KIND_KEYS.filter(k => w[k] && k !== 'worm'))])];
    const bins = Array.from({ length: nb }, () => ({ s: {}, w: {} }));
    for (let i = 0; i < nb; i++) for (let t = i * B + 0.25; t < (i + 1) * B; t += 0.5) {
      if (t >= dur) break;
      const rate = (S.start + (S.end - S.start) * t / dur) * 0.5, ks = S.kinds.filter(x => !x.from || t >= x.from), tot = ks.reduce((a, x) => a + x.w, 0);
      for (const x of ks) bins[i].s[x.k] = (bins[i].s[x.k] || 0) + rate * x.w / tot;
    }
    const worms = [];
    for (const w of L.waves) {
      const i = Math.min(nb - 1, Math.floor(w.t / B));
      for (const k of KIND_KEYS) if (w[k]) { if (k === 'worm') worms.push(w); else bins[i].w[k] = (bins[i].w[k] || 0) + w[k] * (k === 'strep' ? links : 1); }
    }
    const tot = b => kinds.reduce((a, k) => a + (b.s[k] || 0) + (b.w[k] || 0), 0);
    const raw = Math.max(10, ...bins.map(tot)), tick = raw > 300 ? 100 : raw > 120 ? 50 : raw > 40 ? 20 : 10, max = Math.ceil(raw / tick) * tick;
    const W = 600, H = 160, l = 40, r = 16, top = 16, bot = 26, pw = (W - l - r) / nb, sy = v => top + (H - top - bot) * (1 - v / max);
    let h = '';
    for (let v = 0; v <= max; v += tick) h += `<line class="grid" x1="${l}" x2="${W - r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${l - 4}" y="${sy(v) + 3}" text-anchor="end">${v}</text>`;
    bins.forEach((b, i) => {
      const x = l + i * pw + 1, w = Math.max(1, pw - 2);
      let acc = 0;
      for (const [part, op] of [['s', 0.42], ['w', 1]]) for (const k of kinds) {
        const v = b[part][k] || 0; if (v <= 0) continue;
        h += `<rect x="${x.toFixed(1)}" y="${sy(acc + v).toFixed(1)}" width="${w.toFixed(1)}" height="${(sy(acc) - sy(acc + v)).toFixed(1)}" fill="${kcol(k)}" fill-opacity="${op}"><title>${esc(kname(k))} ${part === 's' ? 'trickle' : 'wave'}: ${Math.round(v)}</title></rect>`;
        acc += v;
      }
    });
    for (const t of L.toxins) { const x = l + t / B * pw; h += `<line x1="${x}" x2="${x}" y1="${top}" y2="${H - bot}" stroke="#FF3B4E" stroke-width="2" stroke-dasharray="4 3"/>`; }
    for (const w of worms) { const x = l + w.t / B * pw; h += `<path d="M${x},${top - 12} v12 M${x},${top - 12} h9 l-3,3 l3,3 h-9" stroke="${kcol('worm')}" stroke-width="1.5" fill="${kcol('worm')}"/>`; }
    for (let t = 0; t <= nb * B; t += 60) h += `<text x="${l + t / B * pw}" y="${H - 6}" text-anchor="middle">${fmtT(t)}</text>`;
    svg.innerHTML = h;
    $('#arrLegend').innerHTML = kinds.map(k => `<span><b style="background:${kcol(k)}"></b>${esc(kname(k))}</span>`).join('') +
      `<span><b style="background:var(--dim);opacity:.42"></b>Lighter: trickle</span>${worms.length ? `<span><b style="background:${kcol('worm')}"></b>Tapeworm</span>` : ''}<span><b class="line" style="background:var(--damage)"></b>Toxin burst</span>`;
  }

  // ---- running bots ----
  const Runner = {
    workers: [], queue: [], onResult: null, onDone: null, mainThread: false, timer: 0, sets: {},
    size() { return Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)); },
    busy() { return this.mainThread ? !!this.slicing : this.workers.some(w => w.job); },
    makeWorkers() {
      if (this.workers.length || this.mainThread) return;
      try {
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
        for (let i = 0; i < this.size(); i++) {
          const w = new Worker(url);
          w.onmessage = e => { w.job = null; this.onResult && this.onResult(e.data); this.pump(); };
          w.onerror = e => { e.preventDefault && e.preventDefault(); this.fallback(); };
          this.workers.push(w);
        }
      } catch (e) { this.mainThread = true; }
    },
    fallback() { // workers refused: run on the page in small slices
      if (this.mainThread) return;
      this.mainThread = true;
      for (const w of this.workers) { if (w.job) this.queue.unshift(w.job); w.terminate(); }
      this.workers = [];
      this.pump();
    },
    run(sets, jobs, onResult, onDone) {
      this.sets = sets; this.queue = jobs.slice(); this.onResult = onResult; this.onDone = onDone;
      this.makeWorkers();
      this.pump();
    },
    pump() {
      if (!this.onDone) return;
      if (!this.queue.length && !this.busy()) { const d = this.onDone; this.onDone = this.onResult = null; d(); return; }
      if (this.mainThread) {
        if (this.slicing || !this.queue.length) return;
        const job = this.queue.shift(), set = this.sets[job.level];
        applySettings(set);
        const m = startMatch(job.level, job.policy, job.seed, job.params);
        this.slicing = true;
        const slice = () => {
          applySettings(set);
          const r = m.advance(900);
          if (r) { this.slicing = false; this.onResult && this.onResult({ job, r: slim(r) }); this.pump(); } else this.timer = setTimeout(slice, 0);
        };
        this.timer = setTimeout(slice, 0);
        return;
      }
      for (const w of this.workers) {
        if (w.job || !this.queue.length) continue;
        w.job = this.queue.shift();
        w.postMessage({ job: w.job, settings: this.sets[w.job.level] });
      }
    },
    stop() {
      clearTimeout(this.timer); this.slicing = false;
      if (this.workers.some(w => w.job)) { this.workers.forEach(w => w.terminate()); this.workers = []; }
      this.queue = []; this.onResult = this.onDone = null;
    },
  };
  // Keep only what the page shows; antigen counts every 10 s
  function slim(r) { return { win: r.win, stars: r.stars, t: Math.round(r.t), cause: r.cause, peakTimer: +(r.peakTimer || 0).toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), maxAg: r.maxAg, curve: r.curve.filter((_, i) => i % 5 === 0) }; }

  let running = null; // {kind: 'ladder' | 'strat', levels}
  function setProgress(done, total) {
    $('#prog').hidden = !running; $('#stop').hidden = !running;
    $('#runLadder').disabled = $('#runStrat').disabled = !!running;
    if (!running) return;
    $('#progBar').style.width = pct(done / total);
    const where = running.levels.length > 1 ? 'all levels' : lvName(running.levels[0]);
    $('#progTxt').textContent = `${done} of ${total} games on ${where} · ${Runner.mainThread ? 'one' : Runner.workers.length || Runner.size()} at a time`;
  }
  const slot = k => (results[k] = results[k] || {});
  function runLadder() {
    const n = +$('#ladderN').value, levels = $('#ladderScope').value === 'all' ? ORDER.slice() : [level], jobs = [], sets = {};
    for (const k of levels) {
      sets[k] = runSettings(settings, k);
      slot(k).ladder = { sig: sigFor(settings, k), n, runs: [], partial: true };
      for (let s = 1; s <= n; s++) for (const b of BOTS) jobs.push({ level: k, policy: b.key, seed: s });
    }
    running = { kind: 'ladder', levels }; let done = 0;
    selectTab(levels.length > 1 && !levels.includes(level) ? 'all' : tab === 'strat' ? 'ladder' : tab); setProgress(0, jobs.length);
    Runner.run(sets, jobs, ({ job, r }) => {
      const L = results[job.level].ladder;
      L.runs.push({ policy: job.policy, seed: job.seed, ...r });
      if (L.runs.length === n * BOTS.length) L.partial = false;
      setProgress(++done, jobs.length);
      if (job.level === level && tab === 'ladder') renderLadder();
      if (tab === 'all' && (done % 6 === 0 || L.partial === false)) renderAll();
    }, () => { running = null; setProgress(); persist(); renderResults(); toast(levels.length > 1 ? 'Bots done on every level' : 'Bots done'); });
  }
  function runStrat() {
    const n = +$('#stratN').value, S = sampleStrategies(n), k = level;
    const jobs = S.map((p, i) => ({ level: k, policy: 'strategy', seed: 1000 + i, params: p, i }));
    slot(k).strat = { sig: sigFor(settings, k), n, runs: [], partial: true };
    running = { kind: 'strat', levels: [k] }; selectTab('strat'); setProgress(0, jobs.length);
    Runner.run({ [k]: runSettings(settings, k) }, jobs, ({ job, r }) => {
      const T = results[k].strat;
      T.runs.push({ i: job.i, win: r.win, stars: r.stars, t: r.t, cause: r.cause });
      setProgress(T.runs.length, jobs.length);
      if (level === k && (T.runs.length % 4 === 0 || T.runs.length === jobs.length)) renderStrat();
    }, () => { results[k].strat.partial = false; running = null; setProgress(); persist(); renderResults(); toast('Strategy search done'); });
  }
  $('#runLadder').addEventListener('click', runLadder);
  $('#runStrat').addEventListener('click', runStrat);
  $('#stop').addEventListener('click', () => {
    Runner.stop(); running = null; setProgress();
    for (const k in results) for (const r of Object.values(results[k])) if (r && r.partial === true) r.partial = 'stopped';
    persist(); renderResults(); toast('Stopped');
  });

  // ---- results ----
  function selectTab(t) {
    tab = t; persist();
    for (const [id, key] of [['#tabLadder', 'ladder'], ['#tabStrat', 'strat'], ['#tabAll', 'all']]) $(id).setAttribute('aria-selected', t === key);
    $('#paneLadder').hidden = t !== 'ladder'; $('#paneStrat').hidden = t !== 'strat'; $('#paneAll').hidden = t !== 'all';
    renderResults();
  }
  $('#tabLadder').addEventListener('click', () => selectTab('ladder'));
  $('#tabStrat').addEventListener('click', () => selectTab('strat'));
  $('#tabAll').addEventListener('click', () => selectTab('all'));

  const isLive = (res, k) => res.sig === LIVE_SIG[k];
  function staleNote(res, k) {
    if (running && running.levels.includes(k) && res.partial === true) return '';
    if (!res.runs.length) return res.sig === 'none' ? '<div class="stale">No results for this level yet. Run the bots.</div>' : '';
    if (res.sig === sigFor(settings, k)) return res.partial === 'stopped' ? `<div class="stale">Stopped early: ${res.runs.length} games played.</div>` : '';
    if (res.sig === 'old') return '<div class="stale">These results were made with an older version of the game\'s code. Run again to update them.</div>';
    return `<div class="stale">These results are for ${isLive(res, k) ? 'the live game' : 'other settings'}, not the settings you have now. Run again to update them.</div>`;
  }
  const botStats = (res, bots) => bots.map(b => {
    const rs = res.runs.filter(r => r.policy === b.key).sort((a, c) => a.seed - c.seed);
    const wins = rs.filter(r => r.win), losses = rs.filter(r => !r.win).map(r => r.t).sort((a, c) => a - c);
    return {
      b, rs, n: rs.length, wins: wins.length, rate: rs.length ? wins.length / rs.length : 0, of: rs.filter(r => r.cause === 'storm').length,
      stars: wins.length ? wins.reduce((a, r) => a + r.stars, 0) / wins.length : 0, lossT: losses.length ? losses[Math.floor(losses.length / 2)] : null,
      fat: rs.length ? rs.reduce((a, r) => a + r.fatiguePeak, 0) / rs.length : 0,
    };
  });
  // The standing rules every level has to pass
  const STYLE_WIN = 0.5;
  function rules(res) {
    const one = (key, label) => {
      const b = BOTS.find(x => x.key === key);
      if (!b) return { label, state: 'wait', detail: 'This bot is not in the roster any more.' };
      const s = botStats(res, [b])[0];
      if (!s.n) return { label, state: 'wait', detail: 'Not played yet' };
      return { label, state: s.wins ? 'bad' : 'ok', detail: `${s.wins} of ${s.n} won${s.of ? ` · ${s.of} organ failure${s.of > 1 ? 's' : ''}` : ''}` };
    };
    const styles = botStats(res, STYLES.filter(s => s.key !== 'stormSpam'));
    const winners = styles.filter(s => s.n && s.rate >= STYLE_WIN);
    const st = styles.some(s => !s.n) ? 'wait' : winners.length >= 2 ? 'ok' : 'bad';
    return [
      one('random', 'Button masher must lose'),
      one('stormSpam', 'Storm spammer must lose'),
      { label: 'At least two different styles win', state: st, detail: styles.map(s => `${s.b.name} ${s.n ? pct(s.rate) : '–'}`).join(' · ') + ` (a style wins when it takes half its games)` },
    ];
  }
  const MARK = { ok: 'PASS', bad: 'FAIL', wait: 'NOT RUN' };
  function botRows(stats, base) {
    return stats.map((s, i) => {
      const b = base && base[i], c = colorOf(s.b.key);
      const detail = !s.n ? 'Not played yet' : [
        s.wins ? `wins average ${s.stars.toFixed(1)}★` : '',
        s.lossT != null ? `usually loses around ${fmtT(s.lossT)}` : '',
        `fatigue peak ${Math.round(s.fat)}`,
      ].filter(Boolean).join(' · ');
      return `<div class="skill">
        <div class="name"><i style="background:${c};box-shadow:0 0 6px ${c}"></i><span>${esc(s.b.name)}</span></div>
        <div class="pct">${s.n ? pct(s.rate) : '–'}</div>
        <div class="bar"><span style="width:${pct(s.rate)};background:${c}"></span>${b && b.n ? `<em style="left:calc(${pct(b.rate)} - 1px)" title="Live game ${pct(b.rate)}"></em>` : ''}</div>
        <div class="dots" aria-label="${s.wins} wins of ${s.n}${s.of ? `, ${s.of} organ failures` : ''}">${s.rs.map(r => `<b class="${r.win ? 'w' + r.stars : r.cause === 'storm' ? 'of' : ''}" title="Seed ${r.seed}: ${r.win ? 'won, ' + r.stars + ' stars' : (r.cause === 'storm' ? 'organ failure from the storm at ' : 'lost at ') + fmtT(r.t)}"></b>`).join('')}</div>
        <div class="about">${esc(s.b.about)}<br><span class="mono">${detail.charAt(0).toUpperCase() + detail.slice(1)}</span>${s.of ? ` <span class="mono of-txt">· ${s.of} organ failure${s.of > 1 ? 's' : ''}</span>` : ''}</div></div>`;
    }).join('');
  }
  function renderLadder() {
    const k = level, res = resFor(k, 'ladder'), live = isLive(res, k);
    const baseRes = !live && BASE[k].ladder && BASE[k].ladder.sig === LIVE_SIG[k] ? BASE[k].ladder : null;
    let h = `<div class="stack" style="gap:4px"><h3>Who wins on ${esc(lvName(k))}</h3><p class="small muted" style="margin:0">${res.runs.length ? `${live ? 'The live game\'s numbers' : 'Your settings'}, ${res.n} games per bot${baseRes ? '. The white tick is the live game.' : '.'}` : 'Nothing played yet.'}</p></div>${staleNote(res, k)}`;
    h += `<ul class="checks">${rules(res).map(c => `<li class="${c.state}"><span class="mark">${MARK[c.state]}</span><b>${c.label}</b><small>${esc(c.detail)}</small></li>`).join('')}</ul>`;
    h += `<div class="sub">Skill ladder</div><div class="ladder">${botRows(botStats(res, SKILLS), baseRes && botStats(baseRes, SKILLS))}</div>`;
    h += `<div class="sub">Styles</div><div class="ladder">${botRows(botStats(res, STYLES), baseRes && botStats(baseRes, STYLES))}</div>`;
    h += `<div class="legend"><span><b style="background:var(--gold)"></b>Won, 3 stars</span><span><b style="background:#b3922a"></b>2 stars</span><span><b style="background:#6b5a1e"></b>1 star</span><span><b style="background:var(--panel2);border:1px solid var(--line)"></b>Lost</span><span><b style="border:2px solid var(--damage)"></b>Organ failure (own storm)</span></div>`;
    const set = res.sig === sigFor(settings, k) ? settings : live ? LIVE : settings;
    for (const [title, bots] of [['Antigens on the map: skill ladder', SKILLS], ['Antigens on the map: styles', STYLES]]) {
      h += `<div class="stack" style="gap:6px"><div class="sub">${title}</div>${curveChart(res, botStats(res, bots), effLevel(set, k))}<div class="legend">${bots.map(b => `<span><b class="line" style="background:${colorOf(b.key)}"></b>${esc(b.name)}</span>`).join('')}<span><b class="line" style="background:var(--damage)"></b>Toxin burst</span><span><b class="line" style="background:var(--germ)"></b>Wave</span></div></div>`;
    }
    h += '<p class="small muted" style="margin:0">Lines are the average over each bot\'s games, drawn while at least a quarter of them are still going.</p>';
    $('#paneLadder').innerHTML = h;
  }
  function curveChart(res, stats, L) {
    const W = 600, H = 170, l = 40, r = 16, top = 14, bot = 26;
    const lines = stats.map(s => {
      const pts = [], n = s.rs.length;
      for (let k = 0; ; k++) {
        const alive = s.rs.filter(x => x.curve && x.curve.length > k);
        if (!n || alive.length < Math.max(1, n / 4)) break;
        pts.push([k * 10, alive.reduce((a, x) => a + x.curve[k], 0) / alive.length]);
      }
      return { key: s.b.key, pts };
    });
    const tmax = Math.max(L.duration + 20, ...lines.map(Q => Q.pts.length ? Q.pts[Q.pts.length - 1][0] : 0));
    const raw = Math.max(20, ...lines.flatMap(Q => Q.pts.map(p => p[1]))), tick = raw > 300 ? 100 : raw > 120 ? 50 : 20, vmax = Math.ceil(raw / tick) * tick;
    const sx = t => l + (W - l - r) * t / tmax, sy = v => top + (H - top - bot) * (1 - v / vmax);
    let h = `<svg class="chart big" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average antigens on the map over time for each bot">`;
    for (let v = 0; v <= vmax; v += tick) h += `<line class="grid" x1="${l}" x2="${W - r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${l - 4}" y="${sy(v) + 3}" text-anchor="end">${v}</text>`;
    for (let t = 0; t <= tmax; t += 60) h += `<text x="${sx(t)}" y="${H - 6}" text-anchor="middle">${fmtT(t)}</text>`;
    for (const t of L.toxins) h += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${top}" y2="${H - bot}" stroke="#FF3B4E" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    for (const w of L.waves) h += `<path d="M${sx(w.t) - 4},${top - 10} h8 l-4,7 z" fill="#FF3DCB"/>`;
    for (const Q of lines) if (Q.pts.length > 1) {
      h += `<polyline fill="none" stroke="${colorOf(Q.key)}" stroke-width="2" stroke-linejoin="round" points="${Q.pts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')}"/>`;
      const e = Q.pts[Q.pts.length - 1]; h += `<circle cx="${sx(e[0]).toFixed(1)}" cy="${sy(e[1]).toFixed(1)}" r="3" fill="${colorOf(Q.key)}"/>`;
    }
    return h + '</svg>';
  }

  // Winning strategies: which ranges (or choices) of each habit win
  const catOf = d => !!(d.steps && d.steps.some(v => typeof v !== 'number'));
  const labelOf = v => (typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1) : `${v}`);
  function stratAnalysis(res) {
    const S = sampleStrategies(res.n || 1), runs = res.runs.filter(r => S[r.i]).map(r => ({ ...r, p: S[r.i] }));
    const wins = runs.filter(r => r.win), share = runs.length ? wins.length / runs.length : 0;
    const inputs = STRATEGY.map(d => {
      const cat = catOf(d);
      let bins;
      if (d.bool) bins = [true, false].map(v => ({ label: v ? 'Yes' : 'No', v, test: x => !!x === v }));
      else if (d.steps) bins = d.steps.map(v => ({ label: labelOf(v), v, test: x => x === v }));
      else { const nb = 6, w = (d.max - d.min) / nb; bins = Array.from({ length: nb }, (_, i) => ({ lo: d.min + i * w, hi: d.min + (i + 1) * w, test: x => x >= d.min + i * w && (x < d.min + (i + 1) * w || (i === nb - 1 && x <= d.max)) })); }
      bins.forEach(b => { const rs = runs.filter(r => b.test(r.p[d.key])); b.n = rs.length; b.w = rs.filter(r => r.win).length; b.rate = b.n ? b.w / b.n : 0; b.ofWins = wins.length ? b.w / wins.length : 0; });
      const solid = bins.filter(b => b.n >= 3);
      const spread = solid.length ? Math.max(...solid.map(b => b.rate)) - Math.min(...solid.map(b => b.rate)) : 0;
      // One game per strategy and a chaotic game: only call a habit important when the gap beats sampling noise
      const binN = solid.length ? solid.reduce((a, b) => a + b.n, 0) / solid.length : 1, se = Math.sqrt(share * (1 - share) / binN);
      const tier = !wins.length ? 0 : spread >= Math.max(0.2, 1.5 * share, 5 * se) ? 2 : spread >= Math.max(0.08, 0.6 * share, 3 * se) ? 1 : 0;
      let band = null;
      if (wins.length && !d.bool && !cat) {
        const xs = wins.map(r => r.p[d.key]).sort((a, b) => a - b);
        const q = f => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))];
        band = xs.length >= 5 ? [q(0.1), q(0.9)] : [xs[0], xs[xs.length - 1]];
      }
      const best = solid.length ? solid.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
      return { d, cat, bins, spread, tier, band, best };
    });
    return { runs, wins, share, inputs };
  }
  const outMul = (x, set) => { const mn = val(set, 'output', 'min'), mx = val(set, 'output', 'max'); return mn * Math.pow(mx / mn, x); };
  function fmtIn(d, x, set) {
    if (d.bool) return x ? 'Yes' : 'No';
    if (typeof x === 'string') return labelOf(x);
    if (d.slider) return `${outMul(x, set).toFixed(1)}×`;
    if (d.unit) return `${+x.toFixed(1)} ${d.unit}`;
    return `${Math.round(x)}`;
  }
  const range = (d, a, b, set) => (fmtIn(d, a, set) === fmtIn(d, b, set) ? fmtIn(d, a, set) : `${fmtIn(d, a, set).replace(/ s$/, '')}–${fmtIn(d, b, set)}`);
  const tried = (d, set) => (d.steps ? d.steps.map(v => fmtIn(d, v, set).replace(/ s$/, '')).join(', ') + (d.unit ? ` ${d.unit}` : '') : range(d, d.min, d.max, set));
  function verdict(share) {
    if (share === 0) return ['none', 'Nothing tried wins'];
    if (share < 0.1) return ['narrow', 'Narrow path to victory'];
    if (share < 0.3) return ['some', 'A few ways to win'];
    return ['wide', 'Many ways to win'];
  }
  function recipeLine(x, set) {
    const d = x.d, tag = `<span class="tag t${x.tier}">${x.tier === 2 ? 'decides it' : 'matters'}</span>`;
    if (d.bool || x.cat) return `${esc(d.name)}: <b class="mono">${esc(x.best.label.toLowerCase())}</b> wins ${pct(x.best.rate)} of the time ${tag}`;
    return `${esc(d.name)} <b class="mono">${range(d, x.band[0], x.band[1], set)}</b> ${tag}`;
  }
  function renderStrat() {
    const k = level, res = resFor(k, 'strat'), live = isLive(res, k);
    const set = res.sig === sigFor(settings, k) ? settings : live ? LIVE : settings;
    const A = stratAnalysis(res), [vk, vt] = verdict(A.share);
    const b = BASE[k].strat;
    const base = !live && b && b.sig === LIVE_SIG[k] ? stratAnalysis(b) : null;
    let h = `<div class="stack" style="gap:4px"><h3>How many ways to win ${esc(lvName(k))}</h3><p class="small muted" style="margin:0">Each strategy is a fixed set of the habits below, picked to cover every range evenly, and plays one game. ${!res.runs.length ? '' : live ? 'These are the live game\'s numbers.' : 'These are your settings.'}</p></div>${staleNote(res, k)}`;
    h += `<div class="headline"><span class="big">${A.runs.length ? pct(A.share) : '–'}</span><span>of ${A.runs.length} strategies won${res.partial === true ? ' so far' : ''}</span>${A.runs.length ? `<span class="pill ${vk}">${vt}</span>` : ''}${base ? `<span class="small muted">Live game: ${pct(base.share)}</span>` : ''}</div>`;
    const of = A.runs.filter(r => r.cause === 'storm').length;
    if (of) h += `<p class="small" style="margin:0"><span class="of-txt mono">${of} of ${A.runs.length}</span> <span class="muted">strategies died of organ failure from their own storm.</span></p>`;
    if (A.wins.length) {
      const key = A.inputs.filter(x => x.tier > 0 && (x.band || x.best)).sort((a, c) => c.spread - a.spread);
      const flat = A.inputs.filter(x => x.tier === 0);
      h += `<div class="stack" style="gap:6px"><div class="sub">What winning looks like here</div><ul class="recipe">`;
      for (const x of key) h += `<li>${recipeLine(x, set)}</li>`;
      if (!key.length) h += '<li>No single habit stands out. Most of the choices below work.</li>';
      h += `</ul>${flat.length ? `<p class="small muted" style="margin:0">Barely matters: ${flat.map(x => esc(x.d.name.toLowerCase())).join('; ')}.</p>` : ''}<p class="small muted" style="margin:0">Ranges are where the middle 80% of winning strategies sat. A narrow range on something that decides it means a narrow path.</p></div>`;
    } else if (A.runs.length) h += `<p class="small muted" style="margin:0">No strategy won, so there is no range to show. Try more strategies, or ease off the pressure.</p>`;
    h += `<div class="inputs">`;
    for (const x of A.inputs) {
      const W = 260, H = 84, l = 2, r = 2, top = 14, bot = 16, n = x.bins.length, bw = (W - l - r) / n;
      const maxR = Math.max(0.1, 3 * A.share, ...x.bins.map(c => c.rate));
      let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Win rate by ${esc(x.d.name)}">`;
      s += `<line class="grid" x1="${l}" x2="${W - r}" y1="${H - bot}" y2="${H - bot}"/>`;
      x.bins.forEach((c, i) => {
        const bh = (H - top - bot) * c.rate / maxR;
        const hot = x.d.bool || x.cat ? true : x.band ? (c.lo != null ? c.hi > x.band[0] && c.lo <= x.band[1] : c.v >= x.band[0] && c.v <= x.band[1]) : false;
        s += `<rect x="${(l + i * bw + 2).toFixed(1)}" y="${(H - bot - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(bh, c.n ? 1 : 0).toFixed(1)}" fill="${c.rate > 0 ? (hot ? '#FFD23F' : '#8a7426') : '#2a3150'}"><title>${c.w} of ${c.n} won</title></rect>`;
        if (c.n && c.rate > 0) s += `<text x="${l + i * bw + bw / 2}" y="${H - bot - bh - 2}" text-anchor="middle">${Math.round(c.rate * 100)}</text>`;
        if (c.label != null) s += `<text x="${l + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${esc(c.label)}</text>`;
      });
      if (!x.d.bool && !x.d.steps) s += `<text x="${l}" y="${H - 4}">${fmtIn(x.d, x.d.min, set)}</text><text x="${W - r}" y="${H - 4}" text-anchor="end">${fmtIn(x.d, x.d.max, set)}</text>`;
      s += '</svg>';
      let bandTxt;
      if (!A.wins.length) bandTxt = `No winners · tried ${tried(x.d, set)}`;
      else if (x.d.bool || x.cat) bandTxt = `Winners: <b>${x.bins.filter(c => c.w).map(c => `${esc(c.label.toLowerCase())} ${pct(c.ofWins)}`).join(' · ')}</b>`;
      else bandTxt = `Winners: <b>${range(x.d, x.band[0], x.band[1], set)}</b> · tried ${tried(x.d, set)}`;
      h += `<div class="inp"><div class="hd"><span>${esc(x.d.name)}</span>${A.wins.length ? `<span class="tag t${x.tier}">${['barely matters', 'matters', 'decides it'][x.tier]}</span>` : ''}</div>${s}<div class="band">${bandTxt}</div></div>`;
    }
    h += `</div><p class="small muted" style="margin:0">Bars are the win rate (%) for strategies with that choice or in that range of one habit, with every other habit varied. Gold bars sit inside the winners' range. Each strategy plays one game and small timing differences snowball, so a gap of a few points between bars is noise. More strategies give a clearer picture.</p>`;
    $('#paneStrat').innerHTML = h;
  }
  // Every level at a glance, for the settings you have now
  function levelLine(k, s) {
    const L = resFor(k, 'ladder', s), T = resFor(k, 'strat', s);
    const lOk = L.runs.length && fresh(L, k, s), tOk = T.runs.length && fresh(T, k, s);
    const out = { k, lOk, tOk };
    if (lOk) {
      out.rules = rules(L);
      const st = botStats(L, BOTS), by = key => st.find(x => x.b.key === key);
      out.masher = by('random'); out.spam = by('stormSpam'); out.good = by('smart');
      out.styles = botStats(L, STYLES.filter(x => x.key !== 'stormSpam'));
    }
    if (tOk) out.share = stratAnalysis(T).share;
    return out;
  }
  function renderAll() {
    const rows = ORDER.map(k => levelLine(k, settings));
    const cell = (ok, txt, cls) => (ok ? `<td class="${cls || ''}">${txt}</td>` : '<td class="na">–</td>');
    let h = `<div class="stack" style="gap:4px"><h3>Every level</h3><p class="small muted" style="margin:0">With the settings you have now. Tap a level to tune it.</p></div>`;
    h += `<div class="wrap-x"><table class="glance"><thead><tr><th>Level</th><th>Rules</th><th>Masher</th><th>Storm spam</th><th>Styles win</th><th>Good player</th><th>Strategies</th><th>Pressure</th></tr></thead><tbody>`;
    for (const x of rows) {
      const pass = x.rules ? x.rules.filter(r => r.state === 'ok').length : 0, done = x.rules ? x.rules.filter(r => r.state !== 'wait').length : 0;
      const wins = s => `${s.wins}/${s.n}`;
      h += `<tr data-lv="${x.k}" class="${x.k === level ? 'cur' : ''}"><td><button type="button" data-lv="${x.k}">${esc(lvName(x.k))}</button>${levelChanged(x.k) ? ' <span class="small" style="color:var(--gold)">•</span>' : ''}</td>` +
        cell(x.lOk && done, `${pass} of ${done} pass`, pass === done ? 'ok' : 'bad') +
        cell(x.lOk && x.masher && x.masher.n, x.masher && wins(x.masher), x.masher && !x.masher.wins ? 'ok' : 'bad') +
        cell(x.lOk && x.spam && x.spam.n, x.spam && wins(x.spam) + (x.spam.of ? ` <span class="of-txt">of${x.spam.of}</span>` : ''), x.spam && !x.spam.wins ? 'ok' : 'bad') +
        cell(x.lOk, x.styles && `${x.styles.filter(s => s.n && s.rate >= STYLE_WIN).length} of ${x.styles.length}`, x.styles && x.styles.filter(s => s.n && s.rate >= STYLE_WIN).length >= 2 ? 'ok' : 'bad') +
        cell(x.lOk && x.good && x.good.n, x.good && pct(x.good.rate)) +
        cell(x.tOk, x.share != null && pct(x.share)) +
        `<td>${presOf(settings, x.k) === 1 ? '1' : `<span style="color:var(--gold)">${presOf(settings, x.k)}</span>`}</td></tr>`;
    }
    h += `</tbody></table></div><p class="small muted" style="margin:0">A dash means no results for the current settings on that level yet: pick "all levels" next to Run bots to fill the table. "of" counts organ failures from the bot's own storm. A style wins when it takes half its games. The gold dot marks a level whose script you changed.</p>`;
    $('#paneAll').innerHTML = h;
  }
  $('#paneAll').addEventListener('click', e => {
    const tr = e.target.closest('[data-lv]'); if (!tr) return;
    level = tr.dataset.lv; persist(); buildKnobs(); selectTab('ladder');
  });
  function renderResults() {
    if (tab === 'ladder') renderLadder(); else if (tab === 'strat') renderStrat(); else renderAll();
  }

  // ---- saved difficulties ----
  function summaryOf(s) {
    const lines = [];
    for (const k of ORDER) {
      const x = levelLine(k, s), parts = [];
      if (x.rules) parts.push(`rules ${x.rules.filter(r => r.state === 'ok').length}/${x.rules.length}`, `good player ${pct(x.good ? x.good.rate : 0)}`);
      if (x.share != null) parts.push(`strategies ${pct(x.share)} (${verdict(x.share)[1].toLowerCase()})`);
      if (parts.length) lines.push(`${lvName(k)}: ${parts.join(' · ')}`);
    }
    return lines;
  }
  function renderSlots() {
    const host = $('#saved');
    if (!slots.length) { host.innerHTML = '<p class="small muted" style="margin:0">Nothing saved yet.</p>'; return; }
    host.innerHTML = slots.map((s, i) => {
      const n = normalize(s.settings), changed = ORDER.filter(k => n.levels[k] || n.pressure[k]).map(lvName);
      const what = [`${Object.values(n.tune).reduce((a, g) => a + Object.keys(g).length, 0)} rule changes`, changed.length ? `scripts changed: ${changed.join(', ')}` : 'level scripts as live'].join(' · ');
      const sum = s.summary && s.summary.length ? s.summary : ['Run the bots or strategies with these settings, then save again to keep the results here.'];
      return `<div class="slot"><strong>${esc(s.name)}</strong><div class="row"><button class="btn" type="button" data-load="${i}">Load</button><button class="btn quiet" type="button" data-rm="${i}">${s.confirm ? 'Tap again to delete' : 'Delete'}</button></div><div class="sum">${esc(what)}<br>${sum.map(esc).join('<br>')}</div></div>`;
    }).join('');
  }
  $('#slotSave').addEventListener('click', () => {
    const name = $('#slotName').value.trim() || `Difficulty ${slots.length + 1}`;
    const entry = { name, settings: normalize(settings), summary: summaryOf(settings) };
    const i = slots.findIndex(s => s.name === name);
    if (i >= 0) slots[i] = entry; else slots.push(entry);
    store.set('immuneTunerV3.slots', slots.map(({ confirm, ...s }) => s)); renderSlots(); toast(`Saved ${name}`);
  });
  $('#saved').addEventListener('click', e => {
    const ld = e.target.dataset.load, rm = e.target.dataset.rm;
    if (ld != null) { settings = normalize(slots[+ld].settings); persist(); buildKnobs(); renderResults(); toast(`Loaded ${slots[+ld].name}`); }
    if (rm != null) {
      const s = slots[+rm];
      if (s.confirm) { slots.splice(+rm, 1); store.set('immuneTunerV3.slots', slots.map(({ confirm, ...x }) => x)); } else { slots.forEach(x => { x.confirm = false; }); s.confirm = true; }
      renderSlots();
    }
  });
  $('#resetLevel').addEventListener('click', () => { delete settings.levels[level]; delete settings.pressure[level]; delete extraCols[level]; persist(); buildKnobs(); renderResults(); toast(`${lvName(level)} back to the live script`); });
  $('#resetAll').addEventListener('click', () => { settings = normalize({}); for (const k in extraCols) delete extraCols[k]; persist(); buildKnobs(); renderResults(); toast('Back to the live game\'s numbers'); });

  // ---- export, import, play ----
  const exportText = () => { const s = normalize(settings); return JSON.stringify({ game: 'immune-rts-v3', tune: s.tune, levels: s.levels, pressure: s.pressure }); };
  $('#copy').addEventListener('click', () => {
    const txt = exportText(), ta = $('#paste');
    const fallback = () => { ta.value = txt; ta.focus(); ta.select(); toast('Select and copy the text in the box'); };
    try { navigator.clipboard.writeText(txt).then(() => toast('Settings copied'), fallback); } catch (e) { fallback(); }
  });
  $('#load').addEventListener('click', () => {
    let s;
    try { s = JSON.parse($('#paste').value); } catch (e) { toast('That text is not settings JSON. Copy it again with Copy settings.'); return; }
    if (!s || typeof s !== 'object' || Array.isArray(s)) { toast('That text is not settings JSON.'); return; }
    settings = normalize({ tune: s.tune, levels: s.levels, pressure: s.pressure });
    persist(); buildKnobs(); renderResults(); toast('Settings loaded');
  });
  $('#play').addEventListener('click', () => {
    const s = normalize(settings), lv = {};
    // The game has no pressure knob, so the pressure is baked into the waves and the trickle here
    for (const k of ORDER) if (s.levels[k] || s.pressure[k]) lv[k] = effLevel(s, k);
    store.set('immuneRtsV3.tuning', s.tune);
    store.set('immuneRtsV3.levels', lv);
    store.set('immuneRtsV3.level', level);
    location.href = 'play.html';
  });

  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

  // ---- boot ----
  buildKnobs();
  selectTab(tab);
  renderSlots();
  setProgress();
})();

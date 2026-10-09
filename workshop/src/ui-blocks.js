// Workshop blocks spliced into a fresh copy of v3's ui.js by fork_ui.py. Edit here, then run fork_ui.py.
//@@ start
  // workshop: the start screen picks a Sandbox combo or a real level
  const comboIcons = c => Object.keys(c.rates).filter(k => c.rates[k] > 0).slice(0, 6).map(k => `<img data-art="${ANTIGEN[k].art}" alt="" title="${esc(kindName(k))}">`).join('');
  function showStart() {
    openModal('start', `
      <span class="eyebrow">Cytostorm v3 · mechanics workshop</span>
      <h2>Find the <span class="glow">fun combos</span></h2>
      <p>The real v3 game (physics, per-zone production, every antigen, the storm) with a Workshop panel on top. Set spawn rates for both sides, turn on cheats like No fatigue and No death, try Toxin load, and change any number while it runs.</p>
      <div class="combos">${Object.entries(COMBOS).map(([k, c]) => `<button type="button" class="combo" data-combo="${k}"><span class="ci">${comboIcons(c)}</span><b>${esc(c.name)}</b><small>${esc(c.blurb)}</small></button>`).join('')}</div>
      <span class="eyebrow">Or play a real level with the workshop on top</span>
      <div class="levels">${LEVEL_ORDER.map((k, i) => {
        const nw = newIn(k).filter(x => x !== 'clos');
        return `<button type="button" class="lvl" data-lv="${k}" aria-pressed="${k === levelKey}"><span class="n">${i + 1}</span><span class="nm">${esc(LEVELS[k].name)}${typeof ROUGH !== 'undefined' && ROUGH.has(k) ? ' <em class="rough">not balanced yet</em>' : ''}</span><span class="new">${nw.map(x => `<img data-art="${ANTIGEN[x].art}" alt="" title="${esc(kindName(x))}">`).join('')}</span><span class="st"></span></button>`;
      }).join('')}</div>
      <button class="linkbtn" id="openGuide" type="button">How each cell and antigen works</button>`);
    $('#mbox').querySelectorAll('[data-combo]').forEach(b => b.addEventListener('click', () => { applyCombo(b.dataset.combo); closeModal(); }));
    $('#mbox').querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => { pickLevel(b.dataset.lv); closeModal(); }));
    $('#openGuide').addEventListener('click', () => showGuide('start', 'units'));
  }
  function applyCombo(key) {
    const c = COMBOS[key]; if (!c) return;
    dev.level = 'sandbox'; dev.rates = Object.assign(ZERO_RATES(), c.rates); dev.combo = key;
    if (c.dev) Object.assign(dev, c.dev);
    pendingSetup = c; saveDev(); newGame();
    toast(c.name);
  }
  function pickLevel(key) {
    dev.level = key; dev.rates = ZERO_RATES(); dev.combo = null; pendingSetup = null;
    saveDev(); newGame();
  }
//@@ tuning
  // workshop: v3's numbers plus the workshop's own (Toxin load) in one list
  const TUNE_SETS = () => [[DEFAULTS, CONFIG, HINTS], [WS_DEFAULTS, WS, WS_HINTS]];
  function buildTuning() {
    const host = $('#tuning'); host.innerHTML = '';
    for (const [D, CF, H] of TUNE_SETS()) for (const grp in D) {
      const det = document.createElement('details');
      det.innerHTML = `<summary>${human(grp === 'toxload' ? 'toxinLoad' : grp === 'toxheart' ? 'toxinSimple' : grp)}</summary>`;
      for (const key in D[grp]) {
        const def = D[grp][key], id = `t-${grp}-${key}`;
        const f = document.createElement('div'); f.className = 'field';
        f.innerHTML = `<label class="row" for="${id}"><span>${human(key)}</span><input type="number" id="${id}" step="${stepFor(def)}"></label>`;
        const hint = H[`${grp}.${key}`];
        if (hint) f.insertAdjacentHTML('beforeend', `<small>${hint}</small>`);
        det.appendChild(f);
        const inp = f.querySelector('input');
        inp.value = CF[grp][key];
        const mark = () => inp.classList.toggle('changed', +inp.value !== def);
        mark();
        inp.addEventListener('input', () => {
          const v = parseFloat(inp.value); if (!isFinite(v)) return;
          CF[grp][key] = v; mark(); saveTuning(); syncTune();
          buildGraphics();
        });
      }
      host.appendChild(det);
    }
  }
  function tuningDiff(D, CF) {
    if (!D) return tuningDiff(DEFAULTS, CONFIG);
    const out = {};
    for (const g in D) for (const k in D[g]) if (D[g][k] !== CF[g][k]) (out[g] = out[g] || {})[k] = CF[g][k];
    return out;
  }
  function saveTuning() { store.set('immuneWorkshopV3.tuning', tuningDiff(DEFAULTS, CONFIG)); store.set('immuneWorkshopV3.ws', tuningDiff(WS_DEFAULTS, WS)); }
  $('#tuneReset').addEventListener('click', () => {
    for (const [D, CF] of TUNE_SETS()) for (const g in D) for (const k in D[g]) CF[g][k] = D[g][k];
    saveTuning(); buildTuning(); buildGraphics(); syncTune();
  });
//@@ panel
  // ---- workshop panel ----
  const TOX_SLIDERS = [
    [WS, 'toxload', 'perKill', 'Per messy kill', 0, 10, 0.1], [WS, 'toxload', 'perEndo', 'Per Pseudomonas or Clostridium', 0, 20, 0.1],
    [WS, 'toxload', 'perBurst', 'Per toxin burst', 0, 40, 1], [WS, 'toxload', 'clear', 'Cleared per second when rested (share)', 0.05, 3, 0.05],
    [WS, 'toxload', 'clearTired', 'Clearance left at fatigue 100', 0, 1, 0.01], [WS, 'toxload', 'feed', 'Fatigue per toxin point above safe, per second', 0, 0.1, 0.005], [WS, 'toxload', 'safe', 'Safe level (handled for free)', 0, 80, 1],
    [CONFIG, 'macrophage', 'eatEvery', 'Macrophage gulp every (s), lower eats faster', 0.3, 4, 0.1],
  ];
  const HEART_SLIDERS = [
    [WS, 'toxheart', 'perKill', 'Heart: fatigue per messy kill', 0, 0.5, 0.01], [WS, 'toxheart', 'perEndo', 'Heart: per Pseudomonas or Clostridium', 0, 2, 0.05],
    [WS, 'toxheart', 'perBurst', 'Heart: per toxin burst', 0, 20, 0.5],
  ];
  // spawn rates are stored as groups per 10 s (combos use that); the sliders show antigens per second
  const apsMax = sp => (sp.k === 'worm' ? 0.5 : 90); // x3 since V28
  const toAps = sp => +((dev.rates[sp.k] || 0) * sp.size / 10).toFixed(2);
  const MAIN_SLIDERS = [ // the sim's own rules, so the same numbers as the Tune list
    [CONFIG, 'fever', 'tired', 'Division speed when Tired', 0.1, 1, 0.05], [CONFIG, 'fever', 'feverish', 'When Feverish', 0.1, 1, 0.05], [CONFIG, 'fever', 'exhausted', 'When Exhausted', 0.1, 1, 0.05],
    [CONFIG, 'quorum', 'n', 'Quorum: germs in one crowd', 4, 40, 1], [CONFIG, 'quorum', 'fuse', 'Quorum: seconds of glow before it pops', 1, 15, 0.5], [CONFIG, 'quorum', 'pop', 'Quorum: pop kills your cells within', 20, 200, 5],
    [CONFIG, 'wall', 'soft', 'Vessel wall softness', 0.02, 1, 0.02], [CONFIG, 'trickle', 'mul', 'Trickle between waves ×', 0, 5, 0.25],
    [CONFIG, 'output', 'curve', 'Stress curve (1 = straight line)', 0.2, 1, 0.005], [CONFIG, 'pseudo', 'shield', 'Slime dome lets through', 0, 1, 0.05],
    [CONFIG, 'evolve', 'share', 'Evolution: one kill method’s share', 0.3, 1, 0.05], [CONFIG, 'evolve', 'wall', 'Evolved thick wall: plain shot damage', 0.1, 1, 0.05],
  ];
  const ORGAN_SLIDERS = [
    [WS, 'organs', 'kidneyToxAt', 'Kidneys hurt above toxin', 0, 100, 1], [WS, 'organs', 'kidneyToxBars', 'Kidney bars lost per second there', 0, 0.2, 0.005],
    [WS, 'organs', 'liverShare', 'Liver share of toxin clearing', 0, 1, 0.05], [WS, 'organs', 'minClear', 'Clearance floor', 0, 1, 0.05],
    [WS, 'leakers', 'hepSpeed', 'Hepatitis speed', 10, 150, 1], [WS, 'leakers', 'ecoliSpeed', 'E. coli speed', 10, 150, 1],
    [WS, 'leakers', 'ecoliHp', 'E. coli hits to kill', 1, 6, 1], [WS, 'leakers', 'ecoliDivide', 'E. coli divides every (s)', 5, 60, 1],
    [WS, 'leakers', 'ecoliTox', 'Toxin per E. coli shot', 0, 20, 0.5],
  ];
  const CHEATS = [['noFatigue', 'No fatigue', 'Fatigue stays at 0.'], ['noDeath', 'No death', 'Losses are logged and play continues.'],
    ['immortal', 'Immortal cells', 'Neutrophils and NK cells never age; toxin bursts and the storm spare your cells.'], ['noDivision', 'No division', 'Antigens never divide.']];
  const wsDef = (obj, g, k) => (obj === WS ? WS_DEFAULTS : DEFAULTS)[g][k];
  function buildWorkshop() {
    const host = $('#wsPanel');
    host.innerHTML = `
      <div class="grp">
        <label class="row" for="wsLevel"><span>Playing</span><select id="wsLevel"><option value="sandbox">Sandbox (no script)</option>${LEVEL_ORDER.map((k, i) => `<option value="${k}">Level ${i + 1}: ${esc(LEVELS[k].name)}</option>`).join('')}</select></label>
        <div class="chips" id="wsCombos">${Object.entries(COMBOS).map(([k, c]) => `<button type="button" data-combo="${k}" title="${esc(c.blurb)}">${esc(c.name)}</button>`).join('')}</div>
        <small class="note">A combo switches to the Sandbox with its spawn rates and zone mixes, then restarts. Cheats stay as they are.</small>
      </div>
      <div class="grp">
        <div class="ghead"><span>Antigens</span><button type="button" id="wsStop">Stop all</button><button type="button" id="wsClear">Clear map</button></div>
        <small class="note">Antigens per second poured into the Wound, live. + sends one group now.</small>
        <label class="row" for="wsMul"><span><b>All antigens ×</b> <small>Multiplies every rate below, up to 5×.</small></span><output id="wsMulV"></output></label><input type="range" id="wsMul" min="0" max="5" step="0.25">
        ${SPAWNABLE.map(sp => `<div class="srow"><img data-art="${ANTIGEN[sp.k].art}" alt=""><div class="st2"><b>${esc(kindName(sp.k))}</b><small>${esc(sp.about)}</small></div><output id="rv-${sp.k}"></output><button type="button" data-send="${sp.k}" aria-label="Send one group of ${esc(kindName(sp.k))}">+</button><input type="range" id="rate-${sp.k}" min="0" max="${apsMax(sp)}" step="${apsMax(sp) < 5 ? 0.01 : 0.1}" aria-label="${esc(kindName(sp.k))} per second"></div>`).join('')}
      </div>
      <div class="grp">
        <div class="ghead"><span>Your cells</span></div>
        <label class="row" for="wsMarrow"><span>Marrow makes cells (production cards)</span><input type="checkbox" id="wsMarrow"></label>
        <small class="note">Extra cells per 10 s on top of the marrow, spread across the zones. +15 drops fifteen now.</small>
        ${FRIENDLY.map(u => `<div class="srow"><img data-art="${UNIT[u].art}" alt=""><div class="st2"><b>${UNIT[u].name}</b><small>${UNIT[u].what}</small></div><output id="fv-${u}"></output><button type="button" data-plus="${u}">+15</button><input type="range" id="fr-${u}" min="0" max="90" step="0.5" aria-label="${UNIT[u].name} per 10 s"></div>`).join('')}
      </div>
      <div class="grp">
        <div class="ghead"><span>Main-game rules</span></div>
        <label class="row" for="ch-fever"><span>Fever slows division <small>On in the main game. Bacteria divide slower while you're Tired, Feverish or Exhausted. Viruses don't care.</small></span><input type="checkbox" id="ch-fever"></label>
        <label class="row" for="ch-evolve"><span>Evolution <small>Before each wave of a level, a germ kind evolves against the way you've mostly been killing it. The open Sandbox has no waves, so it only shows up when you play a level here.</small></span><input type="checkbox" id="ch-evolve"></label>
        ${MAIN_SLIDERS.map(([, g, k, n, lo, hi, st]) => `<label class="row" for="tx-${g}-${k}"><span>${n}</span><output id="txv-${g}-${k}"></output></label><input type="range" id="tx-${g}-${k}" min="${lo}" max="${hi}" step="${st}">`).join('')}
        <small class="note">A quorum burst needs that many Staph-family germs in one crowd (main-game levels set their own: Papercut 14, Flu and Sore throat 18). The vessel wall decides how much output you lose with sectors switched off. Trickle only matters on scripted levels. Everything else is under Tune.</small>
      </div>
      <div class="grp">
        <div class="ghead"><span>New mechanics</span></div>
        <small class="note">Measles (in the Antigens list) hijacks macrophages: they go dark, then burst into more Measles. Swallowing one infects the macrophage too. NK cells pop hijacked ones.</small>
      </div>
      <div class="grp">
        <label class="row" for="wsTox"><span><b>Toxin load</b> (kill fast vs kill clean) <small>Experiment, off by default. The main game has no toxin: there the kidneys set how fast fatigue recovers.</small></span><input type="checkbox" id="wsTox"></label>
        <label class="row" for="wsHeart"><span>Simple mode <small>No toxin bar: each messy kill adds a little fatigue straight to the heart.</small></span><input type="checkbox" id="wsHeart"></label>
        ${HEART_SLIDERS.map(([, g, k, n, lo, hi, st]) => `<label class="row" for="tx-${g}-${k}"><span>${n}</span><output id="txv-${g}-${k}"></output></label><input type="range" id="tx-${g}-${k}" min="${lo}" max="${hi}" step="${st}">`).join('')}
        <small class="note">Toxin bar (when Simple mode is off):</small>
        <label class="row" for="wsPuddles"><span>Toxin puddles <small>Off by default. Above the mark, kills leave green puddles that slow your cells.</small></span><input type="checkbox" id="wsPuddles"></label>
        <small class="note">Messy kills (shots, nets, storm) fill it; swallows don't. Your liver and kidneys clear a share of it every second: half is gone in about half a second when you're rested, and it takes about 4 s when you're exhausted. A backlog above the safe mark feeds the heart. So a rested body barely notices it, and a tired one gets dragged down.</small>
        ${TOX_SLIDERS.map(([, g, k, n, lo, hi, st]) => `<label class="row" for="tx-${g}-${k}"><span>${n}</span><output id="txv-${g}-${k}"></output></label><input type="range" id="tx-${g}-${k}" min="${lo}" max="${hi}" step="${st}">`).join('')}
      </div>
      <div class="grp">
        <div class="ghead"><span>Organs</span></div>
        <label class="row" for="wsOrgans"><span><b>Leaks hurt organs</b> <small>Each Hepatitis that reaches the blood adds to the liver's breach clock, each E. coli to the kidneys' (the main game's "leak" number, Every number &gt; Lymph). With Toxin load on, toxin over the mark also wears the kidneys down.</small></span><input type="checkbox" id="wsOrgans"></label>
        <label class="row" for="wsLastBar"><span>Toxin can take the last bar <small>Off: toxin stops at 1 kidney bar. On: it can finish the kidneys (Host failure). Breach clocks and Overload can always take the last bar.</small></span><input type="checkbox" id="wsLastBar"></label>
        <label class="row" for="wsLeakZone"><span>Leakers cross</span><select id="wsLeakZone"><option value="random">Random zone</option><option value="0">Wound</option><option value="1">Tissue</option><option value="2">Deep tissue</option><option value="3">Lymph node</option></select></label>
        <div class="devbtns orgbtns">${ORGANS.map(o => `<span class="mini">${o.name}</span>${[1, 0.5, 0.25].map(h => `<button type="button" data-org="${o.k}" data-h="${h}" aria-label="${o.name} to ${h * 4} bars">${h * 4}</button>`).join('')}`).join('')}<button type="button" id="wsHeal">Heal all organs</button></div>
        ${ORGAN_SLIDERS.map(([, g, k, n, lo, hi, st]) => `<label class="row" for="tx-${g}-${k}"><span>${n}</span><output id="txv-${g}-${k}"></output></label><input type="range" id="tx-${g}-${k}" min="${lo}" max="${hi}" step="${st}">`).join('')}
        <small class="note">Hepatitis and E. coli (in the Antigens list) skip the Lymph node and swim for the vessel. Hepatitis hurts the liver, which also sets how fast new cells are made and heals when you're Fine. E. coli hurts the kidneys, which never heal in a match; shooting it dumps toxin, swallowing it doesn't. The organ buttons set bars directly (they never end the match).</small>
      </div>
      <div class="grp">
        <div class="ghead"><span>Cheats</span></div>
        ${CHEATS.map(([k, n, why]) => `<label class="row" for="ch-${k}"><span>${n} <small>${why}</small></span><input type="checkbox" id="ch-${k}"></label>`).join('')}
        <div class="devbtns"><button type="button" id="wsBurst">Toxin burst now</button><button type="button" id="wsStorm">Storm now</button>${[0, 50, 90].map(f => `<button type="button" data-fat="${f}">Fatigue ${f}</button>`).join('')}</div>
      </div>
      <div class="grp">
        <div class="ghead"><span>Live readout</span></div>
        <div class="readout" id="wsRead"></div>
        <div class="devbtns"><button type="button" id="wsCopy">Copy setup</button><button type="button" id="wsLoad">Load setup</button></div>
        <textarea id="wsJson" hidden aria-label="Setup JSON"></textarea>
        <small class="note">A setup is the spawn rates, cheats, toggles and every changed number. Paste one into the box and press Load setup again.</small>
      </div>`;
    host.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
    $('#wsLevel').addEventListener('change', e => { pickLevel(e.target.value); });
    host.querySelectorAll('[data-combo]').forEach(b => b.addEventListener('click', () => { closeModal(); applyCombo(b.dataset.combo); }));
    $('#wsStop').addEventListener('click', () => { dev.rates = ZERO_RATES(); saveDev(); syncWorkshop(); });
    $('#wsClear').addEventListener('click', () => ws.clearMap());
    for (const sp of SPAWNABLE) $(`#rate-${sp.k}`).addEventListener('input', e => { dev.rates[sp.k] = +e.target.value * 10 / sp.size; saveDev(); syncWorkshop(); });
    $('#wsMul').addEventListener('input', e => { dev.spawnMul = +e.target.value; saveDev(); syncWorkshop(); });
    host.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', () => ws.spawnGroup(b.dataset.send)));
    $('#wsMarrow').addEventListener('change', e => { dev.marrowOn = e.target.checked; saveDev(); });
    for (const u of FRIENDLY) $(`#fr-${u}`).addEventListener('input', e => { dev.friendly[u] = +e.target.value; saveDev(); syncWorkshop(); });
    host.querySelectorAll('[data-plus]').forEach(b => b.addEventListener('click', () => ws.spawnFriendly(b.dataset.plus, 15)));
    $('#wsTox').addEventListener('change', e => { dev.toxinLoad = e.target.checked; saveDev(); hud(); });
    $('#wsHeart').addEventListener('change', e => { dev.toxinSimple = e.target.checked; saveDev(); hud(); });
    $('#wsOrgans').addEventListener('change', e => { dev.organs = e.target.checked; saveDev(); });
    $('#wsLastBar').addEventListener('change', e => { CONFIG.organs.otherFloor = e.target.checked ? 0 : 1; saveTuning(); });
    $('#wsLeakZone').addEventListener('change', e => { dev.leakZone = e.target.value; saveDev(); });
    host.querySelectorAll('[data-org]').forEach(b => b.addEventListener('click', () => ws.setOrgan(b.dataset.org, +b.dataset.h)));
    $('#wsHeal').addEventListener('click', () => { for (const o of ORGANS) ws.setOrgan(o.k, 1); });
    $('#wsPuddles').addEventListener('change', e => { dev.puddles = e.target.checked; saveDev(); hud(); });
    for (const [obj, g, k] of [...TOX_SLIDERS, ...HEART_SLIDERS, ...ORGAN_SLIDERS, ...MAIN_SLIDERS]) $(`#tx-${g}-${k}`).addEventListener('input', e => {
      obj[g][k] = +e.target.value; saveTuning(); syncTune();
      const t = $(`#t-${g}-${k}`); if (t) { t.value = obj[g][k]; t.classList.toggle('changed', obj[g][k] !== wsDef(obj, g, k)); }
    });
    for (const [k] of CHEATS) $(`#ch-${k}`).addEventListener('change', e => { dev[k] = e.target.checked; saveDev(); });
    $('#ch-evolve').addEventListener('change', e => { CONFIG.evolve.on = e.target.checked ? 1 : 0; saveTuning(); const t = $('#t-evolve-on'); if (t) { t.value = CONFIG.evolve.on; t.classList.toggle('changed', CONFIG.evolve.on !== DEFAULTS.evolve.on); } });
    $('#ch-fever').addEventListener('change', e => { CONFIG.fever.on = e.target.checked ? 1 : 0; saveTuning(); const t = $('#t-fever-on'); if (t) { t.value = CONFIG.fever.on; t.classList.toggle('changed', CONFIG.fever.on !== DEFAULTS.fever.on); } });
    $('#wsBurst').addEventListener('click', () => ws.toxinBurstNow());
    // Reset (top bar): restart the current level or combo from zero, same settings, no menus
    $('#wsReset').onclick = () => { closeModal(); newGame(); syncWorkshop(); };
    $('#wsStorm').addEventListener('click', () => game.useStorm());
    host.querySelectorAll('[data-fat]').forEach(b => b.addEventListener('click', () => { game.fatigue = +b.dataset.fat; hud(); }));
    $('#wsCopy').addEventListener('click', () => {
      const txt = JSON.stringify({ dev, tune: tuningDiff(DEFAULTS, CONFIG), ws: tuningDiff(WS_DEFAULTS, WS) }), ta = $('#wsJson');
      ta.value = txt; ta.hidden = false;
      const fallback = () => { ta.focus(); ta.select(); };
      try { navigator.clipboard.writeText(txt).then(() => toast('Setup copied'), fallback); } catch (e) { fallback(); }
    });
    $('#wsLoad').addEventListener('click', () => {
      const ta = $('#wsJson');
      if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ''; ta.placeholder = 'Paste a setup here, then press Load setup'; ta.focus(); return; }
      try {
        const o = JSON.parse(ta.value);
        for (const [D, CF] of TUNE_SETS()) for (const g in D) Object.assign(CF[g], D[g]);
        mergeConfig(o.tune); mergeWs(o.ws);
        if (o.dev) { Object.assign(dev, defaultDev(), o.dev); dev.rates = Object.assign(ZERO_RATES(), o.dev.rates); dev.friendly = Object.assign(defaultDev().friendly, o.dev.friendly); if (!LEVELS[dev.level]) dev.level = 'sandbox'; }
        pendingSetup = dev.combo ? COMBOS[dev.combo] || null : null;
        saveDev(); saveTuning(); buildTuning(); buildGraphics(); newGame(); toast('Setup loaded');
      } catch (e) { toast('That setup could not be read', 'bad'); }
    });
  }
  function syncTune() {
    { const el = $('#ch-fever'); if (el) el.checked = !!CONFIG.fever.on; }
    { const el = $('#ch-evolve'); if (el) el.checked = !!CONFIG.evolve.on; }
    for (const [obj, g, k] of [...TOX_SLIDERS, ...HEART_SLIDERS, ...ORGAN_SLIDERS, ...MAIN_SLIDERS]) {
      const el = $(`#tx-${g}-${k}`); if (!el) continue;
      if (document.activeElement !== el) el.value = obj[g][k];
      const o = $(`#txv-${g}-${k}`); o.textContent = obj[g][k]; o.classList.toggle('changed', obj[g][k] !== wsDef(obj, g, k));
    }
  }
  function syncWorkshop() {
    if (!$('#wsLevel')) return;
    $('#wsLevel').value = dev.level;
    $('#wsCombos').querySelectorAll('[data-combo]').forEach(b => b.setAttribute('aria-pressed', dev.level === 'sandbox' && dev.combo === b.dataset.combo));
    { const m = $('#wsMul'), mul = dev.spawnMul == null ? 1 : dev.spawnMul; if (document.activeElement !== m) m.value = mul; $('#wsMulV').textContent = `${mul}×`; }
    for (const sp of SPAWNABLE) {
      const el = $(`#rate-${sp.k}`); if (document.activeElement !== el) el.value = toAps(sp);
      const mul = dev.spawnMul == null ? 1 : dev.spawnMul, aps = +(toAps(sp) * mul).toFixed(2);
      $(`#rv-${sp.k}`).textContent = dev.rates[sp.k] ? (aps ? `${aps}/s` : 'paused') : 'off';
      $(`#rv-${sp.k}`).classList.toggle('on', dev.rates[sp.k] > 0);
    }
    for (const u of FRIENDLY) {
      const el = $(`#fr-${u}`); if (document.activeElement !== el) el.value = dev.friendly[u];
      $(`#fv-${u}`).textContent = dev.friendly[u] ? `${dev.friendly[u]}/10s` : 'off';
      $(`#fv-${u}`).classList.toggle('on', dev.friendly[u] > 0);
    }
    $('#wsMarrow').checked = dev.marrowOn; $('#wsTox').checked = dev.toxinLoad; $('#wsPuddles').checked = !!dev.puddles; $('#wsHeart').checked = !!dev.toxinSimple; $('#wsOrgans').checked = !!dev.organs; $('#wsLastBar').checked = CONFIG.organs.otherFloor <= 0; $('#wsLeakZone').value = String(dev.leakZone == null ? 'random' : dev.leakZone);
    for (const [k] of CHEATS) $(`#ch-${k}`).checked = !!dev[k];
    $('#ch-fever').checked = !!CONFIG.fever.on; $('#ch-evolve').checked = !!CONFIG.evolve.on;
    syncTune();
    if (ws) wsReadout();
  }
  function wsReadout() {
    const g = game, st = g.stats, cen = ws.census();
    const rows = [
      ['Time', fmt(g.t)], ['Antigens', g.ag.filter(a => !a.dead && !a.eaten).length], ['Your cells', g.cells.length],
      ['Fatigue', `${g.fatigue.toFixed(0)} (peak ${g.fatiguePeak.toFixed(0)})`],
      ['Toxin', !dev.toxinLoad ? 'off' : dev.toxinSimple ? `simple: fed the heart ${ws.tox.added.toFixed(1)} fatigue` : `${ws.tox.load.toFixed(0)} (peak ${ws.tox.peak.toFixed(0)}, fed the heart ${ws.tox.fed.toFixed(1)} fatigue)`],
      ['Organs (bars)', `${ORGANS.map(o => `${o.name.toLowerCase()} ${+g.organs[o.k].toFixed(1)}`).join(', ')} (leaks: liver ${ws.organs.leaks.liver}, kidneys ${ws.organs.leaks.kidney})`],
      ['Shot down', st.shotKills], ['Swallowed', st.swallows], ['Netted', st.netKills], ['Storm kills', st.stormKills],
      ['Breach clocks', Object.entries(g.clocks).filter(([, v]) => v > 0.005).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ') || 'empty'], ['Near losses', ws.nearLosses.length ? ws.nearLosses.map(n => `${(ORGANS.find(o => o.k === n.cause) || { name: 'Host failure' }).name} at ${fmt(n.t)}`).join(', ') : 'none'],
    ];
    for (const sp of SPAWNABLE) { const n = (cen[sp.k] || 0) + (sp.k === 'spore' ? cen.clos || 0 : 0) + (sp.k === 'worm' ? cen.wormlet || 0 : 0); const el = $(`#rv-${sp.k}`); if (el) el.dataset.n = n ? `${n} on map` : ''; }
    const html = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    const el = $('#wsRead'); if (el.innerHTML !== html) el.innerHTML = html;
  }

//@@ prog
    if (ws.sandbox) { // workshop: no script, so show what's on the map instead (along the rail when it's vertical)
      const cen = ws.census(), parts2 = Object.entries(cen).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${kindName(k)}`);
      const vert = H > W * 2, len = vert ? H : W;
      pctx.font = `500 11.5px ${MONO}`; pctx.fillStyle = PAL.uiDim; pctx.textBaseline = 'middle'; pctx.textAlign = vert ? 'center' : 'left';
      let txt = `Sandbox · ${parts2.length ? parts2.join(' · ') : 'no antigens'}`;
      while (txt.length > 4 && pctx.measureText(txt).width > len - 8) txt = txt.slice(0, -2);
      if (vert) { pctx.save(); pctx.translate(W / 2, H / 2); pctx.rotate(Math.PI / 2); pctx.fillText(txt, 0, 0); pctx.restore(); }
      else pctx.fillText(txt, 2, H / 2);
      return;
    }
//@@ hud
    // workshop: toxin load bar
    const toxBar = dev.toxinLoad && !dev.toxinSimple;
    $('#toxRow').hidden = true; // toxin shows as the vessel tint and a strip on the organ button, so no separate bar (two things to watch)
    const obtn = $('#bodyBtn'); // workshop: toxin strip under the organs (v3 rewrites the button's contents when an organ changes)
    if (obtn) {
      let bt = obtn.querySelector('.btox'); if (!bt) { obtn.insertAdjacentHTML('beforeend', '<i class="btox"><b></b></i>'); bt = obtn.querySelector('.btox'); }
      bt.hidden = !toxBar;
      if (toxBar) { const b = bt.firstChild; b.style.width = `${Math.min(100, ws.tox.load)}%`; b.classList.toggle('over', ws.tox.load > WS.toxload.safe); }
    }
    if (toxBar) {
      const L2 = ws.tox.load, T = WS.toxload;
      $('#toxFill').style.width = `${L2}%`;
      $('#toxMark').style.left = `${T.puddleAt}%`; $('#toxMark').hidden = !dev.puddles;
      $('#toxRow').classList.toggle('hot', !!dev.puddles && L2 > T.puddleAt); $('#toxRow').classList.toggle('max', L2 >= 99.9);
      $('#toxVal').textContent = L2 >= 99.9 ? 'Maxed' : dev.puddles && L2 > T.puddleAt ? 'Puddles' : Math.round(L2);
    }
    if ($('#dev').hidden === false) wsReadout();
//@@ newmech
      <div class="grp">
        <div class="ghead"><span>Main-game rules</span></div>
        <label class="row" for="ch-fever"><span>Fever slows division <small>On in the main game. Bacteria divide slower while you're Tired, Feverish or Exhausted. Viruses don't care.</small></span><input type="checkbox" id="ch-fever"></label>
        <label class="row" for="ch-evolve"><span>Evolution <small>Before each wave of a level, a germ kind evolves against the way you've mostly been killing it. The open Sandbox has no waves, so it only shows up when you play a level here.</small></span><input type="checkbox" id="ch-evolve"></label>
        ${MAIN_SLIDERS.map(([, g, k, n, lo, hi, st]) => `<label class="row" for="tx-${g}-${k}"><span>${n}</span><output id="txv-${g}-${k}"></output></label><input type="range" id="tx-${g}-${k}" min="${lo}" max="${hi}" step="${st}">`).join('')}
        <small class="note">A quorum burst needs that many Staph-family germs in one crowd (main-game levels set their own: Papercut 14, Flu and Sore throat 18). The vessel wall decides how much output you lose with sectors switched off. Trickle only matters on scripted levels. Everything else is under Tune.</small>
      </div>
      <div class="grp">
        <div class="ghead"><span>New mechanics</span></div>
        <small class="note">Measles (in the Antigens list) hijacks macrophages: they go dark, then burst into more Measles. Swallowing one infects the macrophage too. NK cells pop hijacked ones.</small>
      </div>
//@@ organs
    // workshop: toxin tints the blood vessel, and the liver and kidneys sit in it at the Lymph node end
    if (dev.toxinLoad && !dev.toxinSimple && ws.tox.load > 0.5) {
      const [x0, y0] = P(0, 0), [x1, y1] = P(L, VESSEL);
      ctx.globalAlpha = 1; ctx.fillStyle = `rgba(140,190,40,${Math.min(0.55, ws.tox.load / 100 * 0.6).toFixed(3)})`;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    drawOrgans(ts);
//@@ organfns
  // workshop: the liver and kidneys drawn side by side in the vessel at the Lymph node end, where Hepatitis and E. coli
  // hit them. Health comes from the main game (4 bars); the art has one look per bar count (ORGAN_STATE)
  const ORGAN_AT = { liver: [[L - 80, VESSEL / 2]], kidney: [[L - 36, VESSEL / 2]] };
  const ORGAN_ART = { liver: 'liver', kidney: 'kidneys' };
  function drawOrgans(ts) {
    const g = game, o = ws.organs;
    for (const k of ['liver', 'kidney']) {
      const l = g.organLevel(k), name = `${ORGAN_ART[k]}-${ORGAN_STATE[l]}`, [u, v] = ORGAN_AT[k][0];
      const al = l === 1 ? 0.775 + 0.225 * Math.sin(ts * 6.283 * 3) : 1; // the last bar flickers
      draw(name, u, v, null, al);
      if (g.organHit[k] > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; draw(name, u, v, null, Math.min(1, g.organHit[k] / 0.6) * 0.7); ctx.restore(); }
    }
    for (const p of o.pops) {
      const [u, v] = ORGAN_AT[p.organ][0];
      if (p.t < 0.6) draw('leak-splat', u, v, null, p.t < 0.3 ? 1 : 1 - (p.t - 0.3) / 0.3, p.t < 0.3 ? 0.6 + 2 * p.t : 1.2); // splat pops, then fades
      const [x, y] = P(u - 20 - p.t * 30, v);
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4); ctx.fillStyle = '#ffd34d'; ctx.font = `700 10px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.txt, x + (portrait ? 34 : 0), y + (portrait ? 0 : -18));
    }
    ctx.globalAlpha = 1;
  }
  // workshop: the toxin card at the top of the main game's Organ status window
  function wsToxCard() {
    if (!dev.toxinLoad) return '';
    const g = game, O = WS.organs, T = WS.toxload, pct = x => `${Math.round(x * 100)}%`, sec = x => (x >= 100 ? 'never' : x >= 10 ? `${Math.round(x)} s` : `${x.toFixed(1)} s`);
    const li = (cls, t) => `<li class="${cls}">${t}</li>`, rows = [];
    if (dev.toxinSimple) rows.push(li('dim', 'Simple mode: messy kills add fatigue directly. No load, no clearing.'));
    else {
      const load = ws.tox.load, cf = ws.clearFactor(), ff = ws.fatigueClear(), k = ws.clearRate();
      rows.push(li(load > T.safe ? 'bad' : 'dim', load > T.safe ? `Toxin <b>${Math.round(load)}</b> is over the safe mark (${T.safe}): it's adding fatigue (up to 100, never into Overload).` : `Toxin <b>${Math.round(load)}</b>: under the safe mark (${T.safe}), so it does nothing yet.`));
      rows.push(li(k < T.clear * 0.9 ? 'bad' : 'good', `Half-life now <b>${sec(Math.LN2 / Math.max(1e-6, k))}</b> (rested with a healthy liver and kidneys: ${sec(Math.LN2 / T.clear)}).`));
      rows.push(li(cf < 0.995 ? 'bad' : 'good', `Liver (${pct(O.liverShare)} of clearing) and kidneys (${pct(1 - O.liverShare)}) clear at <b>${pct(cf)}</b> of full${cf <= O.minClear + 1e-6 ? ', the floor' : ''}.`));
      rows.push(li(ff < 0.995 ? 'bad' : 'good', `Fatigue ${Math.round(g.fatigue)}: clearing at <b>${pct(ff)}</b> speed.`));
      if (dev.organs) rows.push(li(load > O.kidneyToxAt ? 'bad' : 'dim', load > O.kidneyToxAt ? `Over ${O.kidneyToxAt}: the kidneys are losing <b>${+O.kidneyToxBars.toFixed(3)} bars/s</b>.` : `Over ${O.kidneyToxAt} it wears the kidneys down ${+O.kidneyToxBars.toFixed(3)} bars/s.`));
    }
    if (dev.organs) rows.push(li('dim', `Toxin ${CONFIG.organs.otherFloor > 0 ? `stops at ${CONFIG.organs.otherFloor} kidney bar` : 'can take the kidneys\' last bar'}.`));
    return `<div class="ocard whole tox"><div><b>Toxin</b> <span class="ost">Sandbox</span></div><ul>${rows.join('')}</ul></div>`;
  }

'use strict';
// ---------------------------------------------------------------------------
// Cytostorm campaign: screens. The body map (level select), the Clinic (shop,
// loadout, treatment) and the Samples on the end screen. v3's ui.js calls these
// hooks (build.py adds the calls): showStart -> showMap, newGame -> beforeGame /
// afterGame, showEnd -> afterEnd, and init once at boot with v3's helpers.
// ---------------------------------------------------------------------------
window.CampaignHooks = (() => {
  const C = CAMPAIGN, KEY = 'cytostormCampaign.slots', OLD_KEY = 'cytostormCampaign.state', NSLOTS = 3;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  let api = null, BASE = null, ORIG = {};
  // Save slots (Alex, 2026-10-10): opening the page never resumes a run on its own; you pick a slot.
  // A single campaign saved before slots existed moves into slot 1.
  let slots = store.get(KEY);
  if (!Array.isArray(slots)) {
    slots = Array(NSLOTS).fill(null);
    const old = store.get(OLD_KEY);
    if (old) { slots[0] = old; store.set(KEY, slots); try { localStorage.removeItem(OLD_KEY); } catch (e) { /* storage blocked */ } }
  }
  while (slots.length < NSLOTS) slots.push(null);
  let slot = null, st = C.fresh();
  const save = () => { if (slot == null) return; slots[slot] = st; store.set(KEY, slots); };
  let screen = 'map', mapKey = null, tab = 'shop', pendingStart = false, delArm = null, bought = [];
  const order = () => LEVEL_ORDER;
  const esc = s => api.esc(s);
  const fmtS = n => `<span class="smp"><i></i>${Math.round(n)}</span>`;
  const uname = k => (api.UNIT[k] && api.UNIT[k].name) || k;
  const artOf = k => (k === 'clos' ? 'spore' : k === 'worm' ? 'tapeworm-head' : api.ANTIGEN[k] ? api.ANTIGEN[k].art : 'bacterium');
  const nameOf = k => (k === 'clos' ? 'Clostridium' : k === 'worm' ? 'Tapeworm' : api.kindName(k));
  const isOpenPart = id => C.clinicOpen(st, order(), LEVELS).some(c => c.id === id);
  const treatOf = key => isOpenPart('treat') ? C.treatment(st.treat[key]).id : 'none';
  const place = (key, i) => C.PLACES[key] || { where: 'Elsewhere', x: 670, y: 60 + i * 110 };

  // Antigens a map brings that no earlier map did
  const kindsOf = key => [...new Set([...C.kindsIn(LEVELS[key])].map(x => C.VACCINE_OF[x]))].filter(Boolean);
  function newIn(key) {
    const seen = new Set();
    for (const k of order().slice(0, order().indexOf(key))) for (const x of C.kindsIn(LEVELS[k])) seen.add(C.VACCINE_OF[x]);
    return [...new Set([...C.kindsIn(LEVELS[key])].map(x => C.VACCINE_OF[x]))].filter(x => x && !seen.has(x));
  }

  // ---- body map ----
  function bodySvg() {
    const A = BODY_ART;
    const pins = order().map((k, i) => {
      const p = place(k, i), done = !!st.cleared[k], open = C.isOpen(st, order(), k);
      const cls = done ? 'done' : open ? 'open' : 'locked';
      return `<g class="pin ${cls}" data-map="${k}" role="button" tabindex="${open ? 0 : -1}" aria-label="${esc(LEVELS[k].name)}"><circle cx="${p.x}" cy="${p.y}" r="27"/><text x="${p.x}" y="${p.y + 10}">${i + 1}</text></g>`;
    }).join('');
    return `<svg class="bodymap" viewBox="0 0 ${A.w} ${A.h}" aria-label="The patient: tap a numbered spot to open its stage">
      <g class="muscle">${A.parts.map(d => `<path d="${d}"/>`).join('')}</g><path class="skin" d="${A.outline}"/>
      ${pins}</svg>`;
  }
  // ---- a new campaign: pick a difficulty, then the goal (Alex, 2026-10-10) ----
  const DIFF_TEXT = {
    normal: 'The game as tuned. A sector you switch off goes unwatched: germs there breed twice as fast.',
    hard: 'Much bigger waves, and Influenza comes in larger swarms. Not balanced yet.',
  };
  let pickDiff = 'normal';
  function showNewRun(step) {
    screen = 'map';
    const ds = typeof DIFFICULTIES !== 'undefined' ? Object.keys(DIFFICULTIES) : ['normal'];
    if (step !== 'goal') {
      api.openModal('start', `
        <span class="eyebrow">Cytostorm · New campaign</span>
        <h2>Choose a difficulty</h2>
        <p>It stays the same for the whole campaign.</p>
        <div class="cpane">${ds.map(d => `<button type="button" class="tcard" data-pick="${d}" aria-pressed="${d === pickDiff}"><b>${esc(DIFFICULTIES[d].name)}</b><span class="${d === 'hard' ? 'minus' : 'plus'}">${esc(DIFF_TEXT[d] || '')}</span></button>`).join('')}</div>
        <div class="btnrow"><button class="btn primary" id="campDiffOk" type="button">Next</button></div>`);
      const mb = document.querySelector('#mbox');
      mb.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { pickDiff = b.dataset.pick; showNewRun('diff'); }));
      mb.querySelector('#campDiffOk').addEventListener('click', () => { st.diff = pickDiff; save(); showNewRun('goal'); });
      return;
    }
    api.openModal('start', `
      <span class="eyebrow">New campaign · ${esc(diffName())}</span>
      <h2>Your goal</h2>
      <div class="goal">
        <p><b>One patient, ten wounds.</b> Clear all ten, in order, to save the patient.</p>
        <p><b>Each stage is a fight.</b> It's won when every germ is cleared. If an organ fails, that's Host failure, and you can try the stage again.</p>
        <p><b>Kills earn Samples.</b> Between stages you spend them in the Clinic, on upgrades that last the whole campaign.</p>
        <p><b>It gets harder.</b> Each stage sends more germs than the last, and the Clinic opens more options as you go.</p>
      </div>
      <div class="btnrow"><button class="btn primary" id="campGoalOk" type="button">See the patient</button></div>`);
    document.querySelector('#campGoalOk').addEventListener('click', () => { st.seen.goal = true; save(); showMap(); });
  }
  const diffName = () => (typeof DIFFICULTIES !== 'undefined' && DIFFICULTIES[st.diff || 'normal'] || { name: 'Normal' }).name;

  // ---- save slots ----
  function slotSummary(s) {
    const o = order(), done = o.filter(k => s.cleared && s.cleared[k]).length;
    const at = o[C.reached(Object.assign(C.fresh(), s), o)];
    const dn = (typeof DIFFICULTIES !== 'undefined' && DIFFICULTIES[s.diff || 'normal'] || { name: 'Normal' }).name;
    return { where: done === o.length ? 'Patient recovered' : at ? LEVELS[at].name : '', diff: dn, samples: s.samples || 0, done };
  }
  function showSlots() {
    screen = 'slots'; slot = null; st = C.fresh();
    api.openModal('start', `
      <span class="eyebrow">Cytostorm · Campaign</span>
      <h2>Campaigns</h2>
      <p>Pick a saved campaign or start a new one. Progress saves after every fight.</p>
      <div class="cpane">${slots.map((s, i) => {
        if (!s) return `<div class="crow slotrow"><div class="ct"><b>Slot ${i + 1}</b><small>Empty</small></div>
          <button type="button" class="ctog" data-new="${i}">New campaign</button></div>`;
        const m = slotSummary(s);
        return `<div class="crow slotrow"><div class="ct"><b>Slot ${i + 1} · ${esc(m.where)}</b>
          <small>${esc(m.diff)} · ${m.done}/${order().length} cleared · ${fmtS(m.samples)} Samples</small></div>
          <div class="slotbtns"><button type="button" class="ctog on" data-go="${i}">Continue</button>
          <button type="button" class="ctog del" data-del="${i}">${delArm === i ? 'Tap to confirm' : 'Delete'}</button></div></div>`;
      }).join('')}</div>`);
    const mb = document.querySelector('#mbox');
    mb.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => openSlot(+b.dataset.go)));
    mb.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => openSlot(+b.dataset.new))); // written once a difficulty is picked
    mb.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.del;
      if (delArm !== i) { delArm = i; showSlots(); setTimeout(() => { if (delArm === i) { delArm = null; if (screen === 'slots') showSlots(); } }, 4000); return; }
      delArm = null; slots[i] = null; store.set(KEY, slots); api.toast(`Slot ${i + 1} deleted`, 'good'); showSlots();
    }));
  }
  function openSlot(i) {
    slot = i; st = Object.assign(C.fresh(), slots[i]); mapKey = null; tab = 'shop'; bought = [];
    const k = order()[C.reached(st, order())];
    if (k) { api.setLevel(k); api.newGame(); }
    showMap();
  }

  function showMap() {
    if (slot == null) return showSlots();
    // a new campaign asks for a difficulty first; a run saved before the choice existed carries on at Normal
    if (!st.diff) {
      if (Object.keys(st.plays).length || Object.keys(st.cleared).length) { st.diff = 'normal'; save(); }
      else { pickDiff = 'normal'; return showNewRun('diff'); }
    }
    if (!st.seen.goal && !Object.keys(st.cleared).length) return showNewRun('goal');
    screen = 'map';
    const done = order().filter(k => st.cleared[k]).length, all = done === order().length;
    api.openModal('start', `
      <span class="eyebrow">Cytostorm · Campaign</span>
      <h2>${all ? '<span class="glow">The patient recovered</span>' : 'The patient'}</h2>
      <p>${all ? 'Every wound cleared. Start a new campaign for a fresh build.' : 'Clear each wound to reach the next stage. Kills earn Samples.'}</p>
      <div class="camptop"><span>${fmtS(st.samples)} Samples</span><span>${esc(diffName())}${st.diff === 'hard' ? ' (not balanced yet)' : ''} · ${done}/${order().length} cleared</span></div>
      <div class="mapwrap">${bodySvg()}
        <ol class="maplist">${order().map((k, i) => {
          const open = C.isOpen(st, order(), k), done = !!st.cleared[k];
          return `<li><button type="button" class="mrow ${done ? 'done' : open ? 'open' : 'locked'}" data-map="${k}" ${open ? '' : 'disabled'}>
            <span class="n">${i + 1}</span><span class="nm">${esc(place(k, i).where)}</span>
            <span class="new">${kindsOf(k).map(x => `<span class="gi${st.vaccines[x] ? ' vx' : ''}"><img data-art="${artOf(x)}" alt="${esc(nameOf(x))}${st.vaccines[x] ? ' (vaccinated)' : ''}" title="${esc(nameOf(x))}"></span>`).join('')}</span>
            <span class="stt">${done ? '✓' : open ? 'Next' : ''}</span></button></li>`;
        }).join('')}</ol></div>
      <button class="linkbtn" id="openGuide" type="button">How each cell and antigen works</button>
      <button class="linkbtn wipe" id="toSlots" type="button">All campaigns</button>`);
    const mb = document.querySelector('#mbox');
    mb.querySelectorAll('[data-map]').forEach(b => {
      const go = () => { const k = b.dataset.map; if (C.isOpen(st, order(), k)) openClinic(k); };
      b.addEventListener('click', go);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    mb.querySelector('#openGuide').addEventListener('click', () => api.showGuide('start', 'units'));
    mb.querySelector('#toSlots').addEventListener('click', () => {
      api.newGame(); showSlots();
    });
  }

  // ---- the Clinic ----
  function openClinic(key) {
    const open = C.clinicOpen(st, order(), LEVELS);
    if (!open.length) { mapKey = key; return start(key); } // stage 1: no Clinic yet
    const fresh = open.find(c => !st.seen[c.id]);
    if (fresh) tab = fresh.id;
    else if (mapKey !== key || !open.some(c => c.id === tab)) tab = open[0].id;
    mapKey = key; screen = 'clinic';
    api.setLevel(key); api.newGame();
    showClinic();
  }
  function start(key) { bought = []; screen = 'game'; pendingStart = true; api.setLevel(key); api.startWithTutorial(); }
  // One card per germ in the stage: what it does, what beats it, when it arrives. Tap opens its guide entry.
  function germCards(key, kinds) {
    const lv = LEVELS[key], fresh = newIn(key), units = C.unitsFor(C.loadout(st, LEVELS, order(), key)), un = C.unlocked(st, LEVELS, order());
    return `<div class="germs">${kinds.map(x => {
      const g = C.GERM[x] || {}, cs = g.units || [], has = !cs.length || cs.some(u => units.includes(u));
      const miss = has ? '' : cs.some(u => un.includes(u)) ? ' Not in your loadout.' : ' Not unlocked yet.';
      const icon = g.art || (api.UNIT[cs.find(u => units.includes(u)) || cs.find(u => un.includes(u)) || cs[0]] || {}).art;
      return `<button type="button" class="germ" data-germ="${x}" aria-label="${esc(nameOf(x))}: open its guide">
        <img class="gart" data-art="${artOf(x)}" alt="">
        <span class="gname"><b>${esc(nameOf(x))}</b>${fresh.includes(x) ? '<i class="gnew">New</i>' : ''}${st.vaccines[x] ? '<i class="gvax">✓ Vaccinated</i>' : ''}</span>
        <span class="gdoes">${esc(g.does || '')}</span>
        ${g.beat ? `<span class="gbeat${has ? '' : ' miss'}"><img data-art="${icon}" alt="">${esc(g.beat)}${miss}</span>` : ''}
        <span class="gwhen">${esc(C.arrival(lv, x))}</span></button>`;
    }).join('')}</div>`;
  }
  function openGerm(x) {
    api.showGuide('start', 'enemies');
    const img = document.querySelector(`#mbox .unit img[data-art="${artOf(x)}"]`), u = img && img.closest('.unit');
    if (u) { u.classList.add('flash'); u.scrollIntoView({ block: 'center' }); }
  }
  function showClinic() {
    const key = mapKey, lv = LEVELS[key], i = order().indexOf(key);
    const scroll = api.modal() === 'start' ? document.querySelector('#mbox').scrollTop : 0;
    const kinds = kindsOf(key);
    const open = C.clinicOpen(st, order(), LEVELS), part = open.find(c => c.id === tab) || open[0];
    const note = !st.seen[part.id] ? `<div class="coach" role="note"><b>${esc(part.title)}</b><p>${esc(part.text)}</p><button type="button" class="btn" id="coachOk">Got it</button></div>` : '';
    api.openModal('start', `
      <span class="eyebrow">Clinic</span>
      <h2>${esc(lv.name)}</h2>
      <p>${esc(lv.blurb)}</p>
      <div class="incoming"><span>Coming in</span>${germCards(key, kinds)}${pressureOf(key) > 1.005 ? `<span class="press">+${Math.round((pressureOf(key) - 1) * 100)}% germs this far into the run</span>` : ''}${st.cleared[key] ? '<em>Cleared before: replays pay a quarter</em>' : ''}</div>
      <div class="camptop"><span>${fmtS(st.samples)} Samples to spend</span><span>${esc(C.treatment(st.treat[key]).name)}</span></div>
      ${bought.length ? `<button type="button" class="undo" id="campUndo">Undo ${esc(bought[bought.length - 1].label)} · ${fmtS(bought[bought.length - 1].cost)} back</button>` : ''}
      ${open.length > 1 ? `<div class="ctabs" role="tablist" style="--n:${open.length}">${open.map(c => `<button type="button" role="tab" data-tab="${c.id}" aria-selected="${part.id === c.id}">${c.tab}${st.seen[c.id] ? '' : '<i class="newdot" aria-label="new"></i>'}</button>`).join('')}</div>` : ''}
      ${note}
      <div class="cpane">${part.id === 'shop' ? shopHtml() : part.id === 'vax' ? vaxHtml() : part.id === 'loadout' ? loadoutHtml(key) : treatHtml(key)}</div>
      <div class="btnrow"><button class="btn primary" id="campGo" type="button">Start ${esc(lv.name)}</button><button class="btn" id="campBack" type="button">Body map</button></div>`);
    const mb = document.querySelector('#mbox');
    mb.scrollTop = scroll;
    mb.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; showClinic(); }));
    const ub = mb.querySelector('#campUndo'); if (ub) ub.addEventListener('click', undoBuy);
    mb.querySelectorAll('[data-germ]').forEach(b => b.addEventListener('click', () => openGerm(b.dataset.germ)));
    mb.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buy(b.dataset.buy)));
    mb.querySelectorAll('[data-vax]').forEach(b => b.addEventListener('click', () => vaccinate(b.dataset.vax)));
    mb.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => toggleSpecialist(b.dataset.sp)));
    mb.querySelectorAll('[data-treat]').forEach(b => b.addEventListener('click', () => { st.treat[key] = b.dataset.treat; save(); api.newGame(); showClinic(); }));
    mb.querySelector('#campBack').addEventListener('click', () => showMap());
    const ok = mb.querySelector('#coachOk');
    if (ok) ok.addEventListener('click', () => { st.seen[part.id] = true; save(); showClinic(); });
    mb.querySelector('#campGo').addEventListener('click', () => { st.seen[part.id] = true; save(); start(key); });
  }
  const pips = (r, n) => `<span class="cpips">${Array.from({ length: n }, (_, j) => `<i class="${j < r ? 'on' : ''}"></i>`).join('')}</span>`;
  function shopHtml() {
    const un = C.unlocked(st, LEVELS, order());
    let html = '', group = '';
    for (const u of C.UPGRADES) {
      if (u.group !== group) { group = u.group; html += `<h4>${esc(group)}</h4>`; }
      const r = C.rank(st, u.id), max = r >= u.cost.length, cost = C.nextCost(st, u), locked = u.need && !un.includes(u.need);
      html += `<div class="crow${locked ? ' locked' : ''}"><div class="ct"><b>${esc(u.name)} ${pips(r, u.cost.length)}</b>
        <small>${locked ? `Comes with ${esc(uname(u.need))} at ${esc(LEVELS[C.unlockAt(u.need, LEVELS, order())].name)}.` : r ? `Now: ${esc(u.what(r))}${max ? '' : ` Next: ${esc(u.what(r + 1))}`}` : esc(u.what(1))}</small></div>
        ${max ? '<span class="cmax">Maxed</span>' : `<button type="button" class="cbuy" data-buy="${u.id}" ${locked || st.samples < cost ? 'disabled' : ''}>${fmtS(cost)}</button>`}</div>`;
    }
    return html;
  }
  function vaxHtml() {
    const met = C.met(st, LEVELS, order());
    let html = `<p class="cnote">For any germ you've met. Kept for the whole campaign.</p>`;
    html += met.length ? met.map(k => `<div class="crow"><img class="cico" data-art="${artOf(k)}" alt=""><div class="ct"><b>${esc(nameOf(k))}</b><small>${esc(C.vaccineWhat(k))}</small></div>
      ${st.vaccines[k] ? '<span class="cmax">Vaccinated</span>' : `<button type="button" class="cbuy" data-vax="${k}" ${st.samples < C.VACCINE_COST ? 'disabled' : ''}>${fmtS(C.VACCINE_COST)}</button>`}</div>`).join('')
      : '<p class="cnote">Play a map to meet its germs.</p>';
    return html;
  }
  function loadoutHtml(key) {
    const un = C.unlocked(st, LEVELS, order()), pick = C.loadout(st, LEVELS, order(), key);
    const orList = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}` : a[0];
    let html = C.gaps(st, LEVELS, order(), key, pick).map(([x, can]) => `<p class="cwarn" role="note">${esc(nameOf(x))} is coming: ${esc(orList(can.map(uname)))} beat it.</p>`).join('');
    html += `<p class="cnote">Neutrophils and macrophages always come. Pick up to ${C.SLOTS} specialists; new ones join free as you reach the maps that bring them.</p>
      <div class="crow fixed"><img class="cico" data-art="neutrophil" alt=""><div class="ct"><b>Neutrophils</b><small>Always in.</small></div></div>
      <div class="crow fixed"><img class="cico" data-art="macrophage-offense" alt=""><div class="ct"><b>Macrophages</b><small>Always in.</small></div></div>`;
    for (const sp of C.SPECIALISTS) {
      const has = un.includes(sp), on = pick.includes(sp), at = C.unlockAt(sp, LEVELS, order());
      html += `<div class="crow${has ? '' : ' locked'}"><img class="cico" data-art="${api.UNIT[sp].art}" alt=""><div class="ct"><b>${esc(uname(sp))}${has && at === key ? ' <i class="gnew">New here</i>' : ''}</b>
        <small>${has ? esc(api.UNIT[sp].what) : `Joins at ${esc(LEVELS[at].name)}.`}</small></div>
        ${has ? `<button type="button" class="ctog" data-sp="${sp}" aria-pressed="${on}">${on ? 'Bringing' : pick.length >= C.SLOTS ? 'Slots full' : 'Bring'}</button>` : '<span class="cmax">Locked</span>'}</div>`;
    }
    return html;
  }
  // What a treatment does to this stage's germs (1c)
  const andList = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0];
  function treatHere(id, kinds) {
    const has = k => kinds.includes(k), names = ks => andList(ks.map(nameOf));
    if (id === 'antibiotics') { const b = kinds.filter(k => C.BACTERIA.has(k)); return b.length ? `Here: double damage to ${names(b)}.` : ''; }
    if (id === 'antifungals') return has('yeast') ? 'Here: slows Candida and its threads.' : '';
    if (id === 'antivirals') {
      const g = [has('virus') && "stops Herpes hiding", has('flu') && 'stops Influenza splitting'].filter(Boolean);
      return g.length ? `Here: ${andList(g)}.` : '';
    }
    return id === 'none' ? null : 'Works on any stage: it acts on your body, not the germs.';
  }
  function treatHtml(key) {
    const cur = treatOf(key), kinds = kindsOf(key);
    return `<p class="cnote">One per map. Each helps a lot and costs you something, on this map only.</p>` + C.TREATMENTS.map(t => `
      <button type="button" class="tcard" data-treat="${t.id}" aria-pressed="${cur === t.id}"><b>${esc(t.name)}</b>${(h => h == null ? '' : `<span class="here${h ? '' : ' none'}">${esc(h || 'Nothing here for it to treat.')}</span>`)(treatHere(t.id, kinds))}
        <span class="plus">${esc(t.plus)}</span>${t.minus ? `<span class="minus">${esc(t.minus)}</span>` : ''}</button>`).join('');
  }
  // Purchases on this Clinic visit can be undone until Start (1d); newest first
  function undoBuy() {
    const b = bought.pop(); if (!b) return;
    st.samples += b.cost;
    if (b.vax) delete st.vaccines[b.vax]; else if (!(st.upgrades[b.id] = C.rank(st, b.id) - 1)) delete st.upgrades[b.id];
    save(); api.toast(`Refunded ${b.label}`, 'good'); api.newGame(); showClinic();
  }
  function buy(id) {
    const u = C.UPGRADES.find(x => x.id === id), cost = C.nextCost(st, u);
    if (cost == null || st.samples < cost) return;
    st.samples -= cost; st.upgrades[id] = C.rank(st, id) + 1; save();
    bought.push({ id, cost, label: `${u.name} ${'I'.repeat(st.upgrades[id])}` });
    api.toast(`${u.name} ${'I'.repeat(st.upgrades[id])}: ${u.what(st.upgrades[id])}`, 'good');
    api.newGame(); showClinic();
  }
  function vaccinate(k) {
    if (st.vaccines[k] || st.samples < C.VACCINE_COST) return;
    st.samples -= C.VACCINE_COST; st.vaccines[k] = true; save();
    bought.push({ vax: k, cost: C.VACCINE_COST, label: `${nameOf(k)} vaccine` });
    api.toast(`Vaccinated against ${nameOf(k)}`, 'good'); showClinic();
  }
  function toggleSpecialist(sp) {
    const pick = C.loadout(st, LEVELS, order(), mapKey);
    st.dropped = (st.dropped || []).filter(x => x !== sp);
    if (pick.includes(sp)) { st.loadout = pick.filter(x => x !== sp); st.dropped.push(sp); }
    else if (pick.length < C.SLOTS) st.loadout = pick.concat(sp);
    else return;
    save(); api.newGame(); showClinic();
  }

  // ---- hooks from v3's ui.js ----
  // the map as the campaign plays it: more germs later in the run, your loadout's cells
  const pressureOf = key => C.pressure(order().indexOf(key), order().length);
  function beforeGame(key) {
    if (typeof setDifficulty === 'function') setDifficulty(st.diff || 'normal');
    if (!ORIG[key]) ORIG[key] = LEVELS[key];
    C.applyConfig(CONFIG, BASE, st, treatOf(key));
    LEVELS[key] = C.scaleLevel(ORIG[key], pressureOf(key));
    LEVELS[key].units = C.unitsFor(C.loadout(st, LEVELS, order(), key));
  }
  function afterGame(g) {
    if (ORIG[g.key]) LEVELS[g.key] = ORIG[g.key];
    C.instrument(g, st, treatOf(g.key));
    if (pendingStart) {
      pendingStart = false; st.plays[g.key] = (st.plays[g.key] || 0) + 1; save();
      const t = C.treatment(st.treat[g.key]);
      if (t.id !== 'none') setTimeout(() => api.toast(`${t.name}: ${t.plus}`, 'good'), 900);
    }
  }
  function afterEnd(r) {
    const g = api.game, tr = g && g.campaign, key = g && g.key;
    if (!tr || tr.paid) return;
    tr.paid = true;
    const D = g.diff || {}, capMul = (D.levels && D.levels[key]) || D.waves || 1;
    const pay = C.payout(st, key, tr, r.win, LEVELS[key], CONFIG, capMul);
    const first = pay.first;
    st.samples += pay.total; st.earned = (st.earned || 0) + pay.total;
    if (r.win) st.cleared[key] = true;
    save();
    const mb = document.querySelector('#mbox');
    mb.classList.add('campend');
    const i = order().indexOf(key), next = order()[i + 1], all = order().every(k => st.cleared[k]);
    const why = first ? `First clear: ${pay.base} + ${pay.bonus} bonus` : r.win ? 'A replay pays a quarter' : 'A lost fight pays a quarter';
    const panel = document.createElement('div');
    panel.className = 'camppay';
    panel.innerHTML = `<b>+${fmtS(pay.total)} Samples</b><small>${why}${tr.storm ? ` · ${tr.storm} storm kills paid nothing` : ''}</small><span>You have ${fmtS(st.samples)}</span>`;
    if (r.win && first && i === 0) panel.insertAdjacentHTML('beforeend', '<span>Spend Samples in the Clinic, which opens before Stage 2.</span>');
    const p = mb.querySelector('p'); if (p) p.after(panel); else mb.prepend(panel);
    const row = mb.querySelector('#again') && mb.querySelector('#again').parentElement;
    if (row) {
      row.innerHTML = r.win
        ? (next && !all ? `<button class="btn primary" id="campNext" type="button">Next: ${esc(LEVELS[next].name)}</button>` : '') + `<button class="btn${next && !all ? '' : ' primary'}" id="campMap" type="button">Body map</button>`
        : `<button class="btn primary" id="campRetry" type="button">Try again</button><button class="btn" id="campMap" type="button">Body map</button>`;
      const on = (id, fn) => { const b = mb.querySelector(id); if (b) b.addEventListener('click', fn); };
      on('#campNext', () => openClinic(next));
      on('#campRetry', () => openClinic(key));
      on('#campMap', () => { api.newGame(); showMap(); });
    }
    if (r.win && all) { const h = mb.querySelector('h2'); if (h) h.insertAdjacentHTML('afterend', '<p class="glowp">The patient has recovered. Every infection is cleared.</p>'); }
  }
  // v3 calls showStart for the start screen, the guide's close button and its own level buttons
  function showStartHook() { if (screen === 'clinic' && mapKey) showClinic(); else showMap(); }

  function init(a) {
    api = a;
    C.setUnits(Object.keys(api.UNIT));
    BASE = JSON.parse(JSON.stringify(CONFIG));
    // maps are stages on the body, all wounds: "Stage 1: Finger", everywhere the game shows a level name
    order().forEach((k, i) => { LEVELS[k].name = `Stage ${i + 1}: ${place(k, i).where}`; });
    // no campaign is open until a slot is picked; the background fight is Stage 1
    api.setLevel(order()[0]);
    // Samples so far this map, in the top bar
    const row = document.querySelector('.hudrow'), clock = document.querySelector('#clock');
    if (row && clock) {
      const chip = document.createElement('span');
      chip.id = 'campChip'; chip.className = 'campchip'; chip.title = 'Samples earned this map (before any first-clear bonus)';
      clock.after(chip);
      setInterval(() => {
        const g = api.game, tr = g && g.campaign;
        chip.innerHTML = tr ? fmtS(Math.round(Math.min(tr.value, C.budget(g.lv, CONFIG)) * C.RATE)) : '';
      }, 250);
    }
  }
  return { init, showMap: showStartHook, beforeGame, afterGame, afterEnd, get state() { return st; } };
})();

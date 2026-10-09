'use strict';
// ---------------------------------------------------------------------------
// Immune RTS prototype v3: rendering, input, HUD, production cards, storm,
// guide, dev tools. The sim works in (u along the flow, v across). On a wide
// stage the map is drawn as-is (flow left to right, vessel on top); on a tall
// stage it is transposed (flow top to bottom, vessel on the left).
// ---------------------------------------------------------------------------
(function () {
  const $ = s => document.querySelector(s);
  const STEP = 1 / 60;
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
  const PAL = ART.palette;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const artUrl = n => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.svg[n] || '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Candida yeast: drawn here until the art kit has a fungus sprite
  if (!ART.svg.yeast) {
    ART.svg.yeast = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="y" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#FBFFD6"/><stop offset=".6" stop-color="#D6EC6A" stop-opacity=".85"/><stop offset="1" stop-color="#9DBA2A" stop-opacity=".25"/></radialGradient></defs><ellipse cx="13" cy="17" rx="8" ry="7" fill="url(#y)" stroke="#EAF59A" stroke-width="1.2"/><circle cx="22.5" cy="10.5" r="4" fill="url(#y)" stroke="#EAF59A" stroke-width="1"/><circle cx="12" cy="17" r="2" fill="#7E9A1E" opacity=".7"/></svg>';
    ART.meta.yeast = { size: 32, radius: 8 };
  }
  // Brain: drawn here until the art kit has brain sprites (same 64x48 box and 5 states as the other organs)
  if (!ART.svg['brain-healthy']) {
    const BR = { healthy: ['#FFB3D1', '#FFE0EC', 0], strained: ['#E79BBA', '#F7CFE0', 1], damaged: ['#E9A94A', '#FFD98A', 2], failing: ['#FF5A5A', '#FFB0A8', 3], failed: ['#4A4F5C', '#7A808E', 3] };
    const crack = n => ['', '<path d="M30 9 l-3 7 4 4 -3 6" fill="none" stroke="#2A0F1E" stroke-width="1.6"/>', '<path d="M30 9 l-3 7 4 4 -3 6 M42 14 l-4 6 3 5" fill="none" stroke="#2A0F1E" stroke-width="1.6"/>', '<path d="M30 9 l-3 7 4 4 -3 6 M42 14 l-4 6 3 5 M18 18 l5 5 -2 6 4 4" fill="none" stroke="#2A0F1E" stroke-width="1.8"/>'][n];
    for (const st in BR) {
      const [f, l, c] = BR[st];
      ART.svg[`brain-${st}`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><path d="M32 8c-4-4-12-3-14 2-6-1-10 4-8 9-4 3-3 10 2 11 0 6 7 9 12 6 3 4 6 4 8 1 2 3 5 3 8-1 5 3 12 0 12-6 5-1 6-8 2-11 2-5-2-10-8-9-2-5-10-6-14-2z" fill="${f}" stroke="${l}" stroke-width="1.6"/><path d="M32 8v32 M20 16c4 2 4 6 1 8 M44 16c-4 2-4 6-1 8 M16 28c4-1 7 1 8 4 M48 28c-4-1-7 1-8 4" fill="none" stroke="${l}" stroke-width="1.3" opacity=".8"/>${crack(c)}</svg>`;
      ART.meta[`brain-${st}`] = { size: 64, radius: 27 };
    }
  }
  mergeConfig(store.get('immuneRtsV3.tuning'));
  // The difficulty tuner's copy of the game can be handed different level scripts (never set in the live game)
  { const lv = store.get('immuneRtsV3.levels'); if (lv && typeof lv === 'object') for (const k in lv) if (LEVELS[k] && Array.isArray(lv[k].waves)) Object.assign(LEVELS[k], lv[k]); }
  let seed = store.get('immuneRtsV3.seed') || 1;
  let levelKey = LEVELS[store.get('immuneRtsV3.level')] ? store.get('immuneRtsV3.level') : 'papercut';
  const best = store.get('immuneRtsV3.best') || {};
  let game = null;
  window.__cyto = { get game() { return game; } }; // for browser tests and the console
  let paused = false, speedIdx = 2, acc = 0, last = 0;
  let modal = null; // 'start' | 'end' | 'guide' | null
  let endShown = false, guideFrom = null, collapseT = 0, stormHitT = 0;
  const overlay = { range: false, portrait: false };

  const UNIT = {
    neut: { name: 'Neutrophils', art: 'neutrophil', color: '#3FE6FF', what: 'Gunners. Fast, die young.' },
    net: { name: 'Net neutrophils', art: 'neutrophil-net', color: '#FFD23F', what: 'Run into the thickest crowd and burst into a pen that traps it.' },
    nk: { name: 'NK cells', art: 'nk-cell', color: '#B9A6FF', what: 'Hunt infected cells. Ignore plain bacteria.' },
    mac: { name: 'Macrophages', art: 'macrophage-offense', color: '#FF7A3D', what: 'Swallow on Offense, power up shots on Support.' },
  };
  const ANTIGEN = {
    staph: { art: 'bacterium', marker: 'wave' }, mrsa: { art: 'mrsa', marker: 'mrsa' }, pseudo: { art: 'pseudomonas', marker: 'pseudomonas' },
    flu: { art: 'flu', marker: 'flu' }, spore: { art: 'spore', marker: 'spore' }, clos: { art: 'bacterium', marker: 'spore' },
    tb: { art: 'tb', marker: 'tb' }, toxic: { art: 'staph-toxic', marker: 'staph-toxic' }, strep: { art: 'strep-link', marker: 'strep' },
    virus: { art: 'herpes', marker: 'herpes' }, yeast: { art: 'yeast', marker: 'wave' }, worm: { art: 'tapeworm-head', marker: 'tapeworm' }, wormlet: { art: 'tapeworm-small', marker: 'tapeworm' },
  };

  // ---- canvas, view mapping, sprites ----
  // opaque (render() paints every pixel): the browser can skip blending the map canvas into the page
  const cv = $('#cv'), ctx = cv.getContext('2d', { alpha: false }), stage = $('#stage');
  const pcv = $('#prog'), pctx = pcv.getContext('2d');
  let dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
  // Phones (Alex, 2026-10-08): the map stretches sideways up to MAX_SX to use the width; sprites and labels stay round.
  // The rail at its right edge is the level progress (waves and toxin bursts, top to bottom).
  const MAX_SX = 1.45, RAIL = 30;
  let SX = 1, mapW = 0;
  // spectator zoom (Alex, 2026-10-07): double-tap a sector to look closer. View only: it changes nothing in the fight.
  const ZOOM = 2.2;
  const SPRITE_RES = 1.6; // sprites are pre-rendered sharper than 1:1 so they hold up zoomed in
  let vs = 1, vox = 0, voy = 0, zoomE = 0, zoomT = 0, zoomC = [0, 0], zoomLast = 0;
  function updateView(now) {
    const dt = Math.min(0.1, (now - (zoomLast || now)) / 1000); zoomLast = now;
    zoomE += Math.max(-1, Math.min(1, (zoomT - zoomE))) * Math.min(1, dt * 7);
    if (Math.abs(zoomT - zoomE) < 0.002) zoomE = zoomT;
    const e = zoomE * zoomE * (3 - 2 * zoomE), cx = VW / 2 + (zoomC[0] - VW / 2) * e, cy = VH / 2 + (zoomC[1] - VH / 2) * e;
    vs = scale * (1 + (ZOOM - 1) * e);
    vox = ox + mapW / 2 - cx * vs * SX; voy = cssH / 2 - cy * vs;
  }
  function zoomTo(x, y) {
    const s = scale * ZOOM, hw = (ox + mapW / 2) / (s * SX), hh = cssH / (2 * s);
    const z = zoneOf(portrait ? y : x), mid = zMid(z);
    if (portrait) y = mid; else x = mid;
    zoomC = [VW <= 2 * hw ? VW / 2 : Math.max(hw, Math.min(VW - hw, x)), VH <= 2 * hh ? VH / 2 : Math.max(hh, Math.min(VH - hh, y))];
    zoomT = 1; pcv.hidden = true; $('#zoomOut').hidden = false; $('#zoomOut b').textContent = ZONES[z];
  }
  function zoomOut() { zoomT = 0; pcv.hidden = false; $('#zoomOut').hidden = true; }
  // per-zone power buttons ride on the map: bottom-right corner of each sector, following the zoom
  function placePowers() {
    const btns = document.querySelectorAll('.zpwr');
    btns.forEach(b => {
      const z = +b.dataset.pz, zn = game && game.zones[z];
      if (!zn || !cssW) { b.hidden = true; return; }
      // the sector's on-screen rect, clipped to the stage; the button sits in its visible bottom-right corner
      const [x0, y0] = P(ZB[z], 0), [x1, y1] = P(ZB[z + 1], WIDTH - FAR_VESSEL);
      const L = Math.max(0, vox + x0 * vs * SX), T = Math.max(0, voy + y0 * vs), R = Math.min(cssW, vox + x1 * vs * SX), B = Math.min(cssH, voy + y1 * vs);
      const sx = R - 26, sy = B - T < 70 ? (T + B) / 2 : B - 26, vis = R - L > 60 && B - T > 32; // the thin Lymph node: centred
      b.hidden = !vis || !!(game && game.result);
      if (!b.hidden) { b.style.left = `${sx}px`; b.style.top = `${sy}px`; }
      b.classList.toggle('off', !zn.on);
      const lbl = `${zn.name}: ${zn.on ? 'making cells. Tap to switch off' : 'off. Tap to switch on'}`;
      if (b.getAttribute('aria-label') !== lbl) { b.setAttribute('aria-label', lbl); b.title = lbl; }
    });
  }
  function powerTap(z) {
    if (!game || game.result || modal) return;
    const zn = game.zones[z], b = document.querySelector(`.zpwr[data-pz="${z}"]`);
    if (!game.toggleZoneOn(z)) { toast('One zone has to keep making cells', 'bad'); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); return; }
    { const tot = Math.round(game.zones.reduce((a, q, i) => a + game.zoneOutput(i), 0) * 100); toast(zn.on ? `${zn.name}: making cells again (${tot}% of full output)` : `${zn.name} off: you now make ${tot}% of full output (vessel walls)`, zn.on ? 'good' : ''); }
    cardsHud(); if (openZone >= 0) sheetHud(); placePowers();
  }
  let portrait = false, VW = L, VH = WIDTH;
  const P = (u, v) => (portrait ? [v, u] : [u, v]);
  const ang = a => (portrait ? Math.PI / 2 - a : a);
  const img = {}, spr = {};
  let bg = null;
  const TIER = ['Fine', 'Tired', 'Feverish', 'Exhausted'];
  // ---- organs: 4 bars each (sim.js organLevel); art kit v8 has one look per bar count
  const ORGANS = [
    { k: 'heart', art: 'heart', name: 'Heart', job: 'Pumps new cells out.' },
    { k: 'kidney', art: 'kidneys', name: 'Kidneys', job: 'Clear waste, so your body can recover.' },
    { k: 'lungs', art: 'lungs', name: 'Lungs', job: 'Oxygen for every cell you have.' },
    { k: 'liver', art: 'liver', name: 'Liver', job: 'Building blocks for new cells.' },
    { k: 'spleen', art: 'spleen', name: 'Spleen', job: 'Holds your immune cell reserve and filters the blood.' },
    { k: 'brain', art: 'brain', name: 'Brain', job: 'Coordination: how well your cells find and chase targets.' },
  ];
  const ORGAN_STATE = ['failed', 'failing', 'damaged', 'strained', 'healthy'];
  const ORGAN_WORD = ['Failed', 'Failing', 'Damaged', 'Strained', 'Healthy'];
  const HEALS = { liver: true, lungs: true };
  const pctOf = x => `${Math.round(x * 100)}%`;
  // what an organ does to you at a bar count (1-3; 4 = nothing)
  function organEffect(k, l) {
    const G = CONFIG.organs, C = CONFIG;
    if (l >= 4) return 'No penalty.';
    l = Math.max(1, l);
    const v = G[k + l];
    return k === 'heart' ? `Stress tops out at ${Math.round(v * 100)}% (from ${Math.round(C.output.max * 100)}%).`
      : k === 'kidney' ? `Recovery ${pctOf(1 - v)} slower.`
      : k === 'lungs' ? `Every cell moves ${pctOf(1 - v)} slower, on top of Tired.`
      : k === 'liver' ? `New cells are made ${pctOf(1 - v)} slower.`
      : k === 'brain' ? `Every cell wanders ${pctOf(v - 1)} more${l <= 2 ? `; response changes lag ${G.brainDelay} s` : ''}${l <= 1 ? ', and delirium blurs your view' : ''}.`
      : `Total cell limit ${v} (from ${C.caps.cells}).`;
  }
  // short values for the organ meter, by bars left (4 = healthy, 0 = failed)
  const METER_LABEL = { heart: 'Top output', kidney: 'Recovery', lungs: 'Cell speed', liver: 'Production', spleen: 'Cell limit', brain: 'Wander' };
  function meterVal(k, b) {
    const G = CONFIG.organs, C = CONFIG;
    if (b === 0) return '✕';
    const v = b >= 4 ? null : G[k + b];
    return k === 'heart' ? `${b >= 4 ? C.output.max : v}×` : k === 'spleen' ? `${b >= 4 ? C.caps.cells : v}` : k === 'brain' ? (b >= 4 ? 'normal' : `+${Math.round((v - 1) * 100)}%`) : `${Math.round((b >= 4 ? 1 : v) * 100)}%`;
  }
  const harmedBy = k => [...new Set(Object.keys(KINDS).filter(x => KINDS[x].organ === k && x !== 'spore' && x !== 'wormlet').map(kindName))];
  const organShort = (k, l) => organEffect(k, l).replace(/ \(from .*\)|,? on top of Tired/, '').replace(/[.,]$/, '');

  function prerender(name, wWorld, hWorld) {
    const k = scale * dpr * SPRITE_RES, c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(wWorld * k)); c.height = Math.max(2, Math.ceil(hWorld * k));
    if (img[name]) c.getContext('2d').drawImage(img[name], 0, 0, c.width, c.height);
    return c;
  }
  // A sprite sized so its drawn body matches a world radius (the art says how big the body is in its box)
  function bodySprite(name, worldR, key) {
    const m = ART.meta[name] || { size: 64, radius: 16 };
    const bw = m.box ? m.box[0] : m.size, bh = m.box ? m.box[1] : m.size, per = worldR / (m.radius || bw / 4);
    const w = bw * per, h = bh * per;
    spr[key || name] = { c: prerender(name, w, h), w, h, ax: m.anchor ? m.anchor[0] / bw : 0.5, ay: m.anchor ? m.anchor[1] / bh : 0.5 };
  }
  function glowDot(name, color, worldR) {
    const px = Math.max(4, Math.ceil(worldR * 4 * scale * dpr * SPRITE_RES)), c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, px, px);
    spr[name] = { c, w: worldR * 4, h: worldR * 4, ax: 0.5, ay: 0.5 };
  }
  function buildGraphics() {
    if (!img.tissue || !cssW) return;
    const C = CONFIG;
    bodySprite('neutrophil', C.neutrophil.radius * 1.15);
    bodySprite('neutrophil-infected', C.neutrophil.radius * 1.15);
    bodySprite('neutrophil-net', C.net.radius * 1.1);
    bodySprite('neutrophil-trap', C.net.radius * 1.3);
    bodySprite('nk-cell', C.nk.radius * 1.1);
    for (const n of ['macrophage-offense', 'macrophage-support', 'macrophage-infected']) bodySprite(n, C.macrophage.radius * 1.1);
    bodySprite('bacterium', C.staph.radius * 1.25); bodySprite('bacterium-hit', C.staph.radius * 1.25); bodySprite('bacterium-dividing', C.staph.radius * 1.5);
    bodySprite('bacterium', C.clos.radius * 1.25, 'clos');
    bodySprite('mrsa', C.mrsa.radius * 1.1);
    bodySprite('pseudomonas', C.pseudo.radius * 1.25);
    bodySprite('flu', C.flu.radius * 1.2);
    bodySprite('spore', C.spore.radius * 1.2); bodySprite('spore-hatch', C.spore.radius * 2.2);
    bodySprite('tb', C.tb.radius * 1.15);
    bodySprite('staph-toxic', C.toxic.radius * 1.3);
    bodySprite('strep-link', C.strep.radius * 1.15);
    bodySprite('herpes', C.herpes.radius * 1.3);
    bodySprite('yeast', C.fungus.radius * 1.3);
    bodySprite('tapeworm-head', C.worm.radius * 1.5); bodySprite('tapeworm-segment', C.worm.radius * 1.15); bodySprite('tapeworm-small', 2.6 * 1.3);
    bodySprite('hit-spark', 4); bodySprite('kill-shard', 1.2); bodySprite('storm-shard', 1.4);
    const shot = { shot: 13, 'shot-tuned': 18, 'speed-trail': 20 };
    for (const n in shot) { const m = ART.meta[n], w = shot[n], h = w * m.box[1] / m.box[0]; spr[n] = { c: prerender(n, w, h), w, h, ax: m.anchor[0] / m.box[0], ay: m.anchor[1] / m.box[1] }; }
    const ring = C.support.ring * 128 / 60;
    spr['support-ring'] = { c: prerender('support-ring', ring, ring), w: ring, h: ring, ax: 0.5, ay: 0.5 };
    // drawn scaled by their radius: unit-radius boxes
    spr['biofilm-dome'] = { c: prerender('biofilm-dome', 128, 128), w: 128 / 60, h: 128 / 60, ax: 0.5, ay: 0.5 };
    spr.net = { c: prerender('net', 64, 64), w: 64 / 28, h: 64 / 28, ax: 0.5, ay: 0.5 };
    const shock = 340 * 256 / 118;
    spr['toxin-shockwave'] = { c: prerender('toxin-shockwave', shock * 0.5, shock * 0.5), w: shock, h: shock, ax: 0.5, ay: 0.5 };
    glowDot('puff', 'rgba(63,230,255,0.8)', 2);
    glowDot('puffDim', 'rgba(63,230,255,0.35)', 2);
    glowDot('ember', 'rgba(255,61,203,0.9)', 1.8);
    glowDot('lilac', 'rgba(185,166,255,0.9)', 2);
    glowDot('lime', 'rgba(220,240,120,0.9)', 1.8);
    // the reproduction blink: one white glow sprite drawn per blinking antigen (was a new radial gradient per antigen per frame)
    { const px = Math.max(16, Math.ceil(2 * 2.4 * 12 * scale * dpr * SPRITE_RES)), c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, px, px);
      blinkGlow = c; }
    buildBackground();
  }
  // Tissue, vessel and the wound: one offscreen image in view space
  function buildBackground() {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.ceil(VW * k * SX); c.height = Math.ceil(VH * k);
    const g = c.getContext('2d');
    g.fillStyle = PAL.void; g.fillRect(0, 0, c.width, c.height); // opaque: render() copies it straight onto the canvas
    g.scale(k * SX, k);
    g.globalAlpha = 0.45;
    const tw = 128, th = tw * img.tissue.naturalHeight / img.tissue.naturalWidth;
    for (let y = 0; y < VH; y += th) for (let x = 0; x < VW; x += tw / SX) g.drawImage(img.tissue, x, y, tw / SX + 0.5, th + 0.5);
    g.globalAlpha = 1;
    const vb = img['vessel-blood'], sw = 96, sh = VESSEL * 1.25;
    g.save();
    if (portrait) { g.translate(VESSEL * 1.1, 0); g.rotate(Math.PI / 2); }
    for (let x = 0; x < L; x += sw) g.drawImage(vb, x, -VESSEL * 0.15, sw + 0.5, sh);
    g.restore();
    // the thinner second vessel on the far edge
    const fh = FAR_VESSEL * 1.25;
    g.save();
    if (portrait) { g.translate(WIDTH - FAR_VESSEL * 1.1, L); g.rotate(-Math.PI / 2); } else { g.translate(0, WIDTH - FAR_VESSEL * 1.1); }
    for (let x = 0; x < L; x += sw) g.drawImage(vb, x, -FAR_VESSEL * 0.15, sw + 0.5, fh);
    g.restore();
    const [wx, wy] = P(WOUND.u, WOUND.v);
    g.save(); g.translate(wx, wy); g.scale(1 / SX, 1); if (portrait) g.rotate(Math.PI / 2);
    g.globalAlpha = 0.9; g.drawImage(img.wound, -70, -35, 140, 70);
    g.restore();
    const [lx, ly] = P(L - 70, MID_V);
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 180);
    gr.addColorStop(0, 'rgba(47,184,154,0.16)'); gr.addColorStop(1, 'rgba(47,184,154,0)');
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    g.strokeStyle = 'rgba(221,230,245,0.16)'; g.lineWidth = 1.5 / scale; g.setLineDash([6 / scale, 6 / scale]);
    for (let z = 1; z < NZ; z++) {
      const [x0, y0] = P(ZB[z], VESSEL), [x1, y1] = P(ZB[z], WIDTH - FAR_VESSEL);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.setLineDash([]);
    bg = c;
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    portrait = true; // always vertical: Wound at the top, Lymph node at the bottom (Alex, 2026-10-07)
    VW = portrait ? WIDTH : L; VH = portrait ? L : WIDTH;
    const room = Math.max(60, cssW - RAIL);
    scale = Math.min(room / VW, cssH / VH);
    SX = Math.max(1, Math.min(MAX_SX, room / (VW * scale)));
    mapW = VW * scale * SX;
    ox = (cssW - mapW - RAIL) / 2; oy = (cssH - VH * scale) / 2;
    // the progress rail hugs the map's right edge
    Object.assign(pcv.style, { left: `${ox + mapW + 8}px`, top: `${oy}px`, height: `${VH * scale}px` });
    const pr = pcv.getBoundingClientRect();
    pcv.width = Math.round(pr.width * dpr); pcv.height = Math.round(pr.height * dpr);
    buildGraphics();
  }

  // Draw a sprite at world (u, v), rotated to a world heading
  // areas (rings, pens, domes, the shockwave) stretch with the map so they show where they reach; everything else stays round
  const AREA = new Set(['support-ring', 'net', 'biofilm-dome', 'toxin-shockwave']);
  // render()'s map transform (a, d, e, f), so a rotated sprite gets its transform in one setTransform
  // instead of save/translate/scale/rotate/restore (thousands of sprites a frame)
  let TA = 1, TD = 1, TE = 0, TF = 0, blinkGlow = null;
  function draw(name, u, v, rot, alpha, mul, sx, sy) {
    const s = spr[name]; if (!s) return;
    const m = mul || 1, w = s.w * m * (sx || 1), h = s.h * m * (sy || 1);
    const [x, y] = P(u, v), round = SX !== 1 && !AREA.has(name);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (rot != null || sx || sy) {
      const a = ang(rot || 0);
      let cs = Math.cos(a), sn = Math.sin(a), xs = 1;
      if (round) { xs = 1 / SX; const n = Math.hypot(cs * SX, sn); cs = cs * SX / n; sn /= n; } // squeezed by 1/SX, keeping the on-screen heading
      // = translate(x, y), scale(xs, 1), rotate on top of the map transform
      ctx.setTransform(TA * xs * cs, TD * sn, -TA * xs * sn, TD * cs, TE + TA * x, TF + TD * y);
      ctx.drawImage(s.c, -w * s.ax, -h * s.ay, w, h);
      ctx.setTransform(TA, 0, 0, TD, TE, TF);
    } else if (round) ctx.drawImage(s.c, x - w * s.ax / SX, y - h * s.ay, w / SX, h);
    else ctx.drawImage(s.c, x - w * s.ax, y - h * s.ay, w, h);
  }

  // ---- particles (UI-only) ----
  let parts = [], shake = 0, flashT = 0, quorumPops = [];
  // Evolution traits as drawn (sim EVOLVE): ring colour per trait
  const TRAITS = [{ k: 'wall', color: '#FFD23F' }, { k: 'capsule', color: '#7FF3FF' }, { k: 'slick', color: '#B9F27C' }, { k: 'hardy', color: '#B07CFF' }];
  const qSmooth = {}; // on-screen bubble positions, eased toward the sim's
  function burstParts(u, v, kind, n, speed, life) {
    if (parts.length > 1200) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = speed * (0.5 + Math.random() * 0.7);
      parts.push({ u, v, vu: Math.cos(a) * sp, vv: Math.sin(a) * sp, life, max: life, kind, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 12 });
    }
  }
  const kindName = k => (KINDS[k] ? KINDS[k].name : k);
  function waveText(f) {
    const list = Object.entries(f.counts).map(([k, n]) => k === 'strep' ? `${n} Strep chain${n > 1 ? 's' : ''}` : k === 'worm' ? 'a Tapeworm' : k === 'spore' ? `${n} spores` : `${n} ${kindName(k)}`);
    return (f.final ? 'Final wave: ' : 'Wave: ') + list.join(', ');
  }
  const toasted = new Set();
  function toastOnce(key, text, kind) { if (toasted.has(key)) return; toasted.add(key); toast(text, kind); }
  function consumeFx() {
    const g = game, fxs = g.fx.splice(0);
    soundFx(fxs);
    for (const f of fxs) {
      switch (f.k) {
        case 'hit': if (parts.length < 900) parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.08, max: 0.08, kind: 'hit-spark', rot: Math.random() * 6 }); break;
        case 'bounce':
          if (parts.length > 900) break;
          parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.1, max: 0.1, kind: 'hit-spark', rot: 0, mul: 0.8 });
          parts.push({ u: f.u, v: f.v, vu: f.du * 160, vv: f.dv * 160 + (Math.random() - 0.5) * 120, life: 0.16, max: 0.16, kind: 'shot', rot: Math.atan2(f.dv, f.du), mul: 0.6 });
          break;
        case 'fizzle': burstParts(f.u, f.v, 'puffDim', 1, 10, 0.25); break;
        case 'pop':
          if (f.storm) { burstParts(f.u, f.v, 'storm-shard', 2, 90, 0.5); break; }
          if (parts.length < 900) parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.1, max: 0.1, kind: 'hit-spark', rot: 0, mul: f.tuned ? 1.5 : 1 });
          burstParts(f.u, f.v, 'kill-shard', f.armored ? 6 : 3, 60, 0.4);
          break;
        case 'net': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.25, max: 0.25, kind: 'neutrophil-trap', rot: Math.random() * 6 }); break;
        case 'trickle': burstParts(f.u, f.v, 'ember', 1, 30, 0.4); break;
        case 'die': burstParts(f.u, f.v, 'puff', f.who === 'mac' ? 10 : 4, 60, 0.6); break;
        case 'expire': burstParts(f.u, f.v, 'puffDim', 2, 20, 0.5); break;
        case 'arrive': if (parts.length < 900) parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.4, max: 0.4, kind: 'ring', color: UNIT[f.type] ? UNIT[f.type].color : PAL.cell }); break;
        case 'hatch': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.3, max: 0.3, kind: 'spore-hatch', rot: 0 }); toastOnce('hatch' + Math.round(g.t / 5), 'The spores hatched', 'bad'); break;
        case 'virusBurst': burstParts(f.u, f.v, 'lilac', 8, 70, 0.5); toastOnce('virus', 'An infected neutrophil burst: Herpes is out', 'bad'); break;
        case 'infect': burstParts(f.u, f.v, 'lilac', 3, 30, 0.4); break;
        case 'nkPop': burstParts(f.u, f.v, 'lilac', 6, 50, 0.4); break;
        case 'dome': toastOnce('dome', 'Pseudomonas is growing a slime dome', 'bad'); break;
        case 'sprout': toastOnce('sprout', 'Candida sprouted a thread. Nets cut threads.', 'bad'); burstParts(f.u, f.v, 'lime', 5, 30, 0.5); break;
        case 'cut': burstParts(f.u, f.v, 'lime', Math.min(14, 3 + f.n), 70, 0.5); break;
        case 'split': burstParts(f.u, f.v, 'lilac', 3, 40, 0.3); break;
        case 'burst': shake = 1; flashT = 0.25; toast(f.z != null ? `Quorum burst in the ${ZONES[f.z]}!` : 'Toxin burst!', 'toxin'); if (f.r) quorumPops.push({ u: f.u, v: f.v, r: f.r, t0: game.t }); break;
        case 'evolveSoon': toast(`${kindName(f.kind)} adapted to your ${{ shot: 'shots', swallow: 'macrophages', net: 'Nets', storm: 'storms' }[f.how]}: next wave has a ${f.name}`, 'bad'); break;
        case 'stormStart': toast('Cytokine storm!', 'bad'); break;
        case 'overload': toast('Overload: fatigue past 100 is hurting your organs', 'bad'); break;
        case 'organLevel': if (f.level > 0) { const o = ORGANS.find(x => x.k === f.organ); toast(`${o.name}: ${f.level} bar${f.level > 1 ? 's' : ''} left. ${organShort(f.organ, f.level)}`, 'bad'); } break;
        case 'storm': stormHitT = 0.45; shake = 1.4; toast(`The storm killed ${f.kills} antigens`, 'bad'); break;
        case 'wave': if (g.t > 0.5) toast(waveText(f), 'bad'); burstParts(f.u, f.v, 'ember', 8, 50, 0.6); break;
        case 'breach': toast('Antigens reached the Lymph node', 'bad'); break;
        case 'tier': if (f.up) toast(['', 'Tired: your cells slow down, bacteria divide slower', 'Feverish: shots spray, neutrophils die sooner, bacteria divide much slower', 'Exhausted: Support rings shrink, bacteria barely divide'][f.tier], f.tier >= 2 ? 'bad' : ''); else toast(`Fatigue easing: ${TIER[f.tier]}`, 'good'); break;
      }
    }
  }

  // ---- render ----
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.void;
    const g = game;
    if (!g || !bg) { ctx.fillRect(0, 0, cv.width, cv.height); return; }
    updateView(now); placePowers();
    const ts = now / 1000, k = vs * dpr, C = CONFIG;
    const sh = shake > 0 ? shake * 5 : 0;
    const jx = sh ? (Math.random() - 0.5) * sh : 0, jy = sh ? (Math.random() - 0.5) * sh : 0;
    // Not zoomed: the (opaque) background was built at this exact size, so copy it 1:1 at whole pixels and clear only
    // the margins around it, instead of clearing the whole canvas and then resampling the whole map over it
    const bx = Math.round((vox + jx) * dpr), by = Math.round((voy + jy) * dpr), bw = Math.round(VW * k * SX), bh = Math.round(VH * k);
    const flat = zoomE === 0 && bw <= bg.width && bh <= bg.height;
    if (flat) {
      const W = cv.width, H = cv.height;
      if (by > 0) ctx.fillRect(0, 0, W, by);
      if (by + bh < H) ctx.fillRect(0, by + bh, W, H - by - bh);
      if (bx > 0) ctx.fillRect(0, by, bx, bh);
      if (bx + bw < W) ctx.fillRect(bx + bw, by, W - bx - bw, bh);
      ctx.drawImage(bg, 0, 0, bw, bh, bx, by, bw, bh);
    } else ctx.fillRect(0, 0, cv.width, cv.height);
    TA = k * SX; TD = k; TE = (vox + jx) * dpr; TF = (voy + jy) * dpr;
    ctx.setTransform(TA, 0, 0, TD, TE, TF);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
    if (!flat) ctx.drawImage(bg, 0, 0, VW, VH);

    zoneLayer(g, ts);

    const zr = zoneRect(0);
    if (g.warning > 0 && img['wound-flash']) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.55 * (Math.sin(ts * 6.283 * 3) > 0 ? 1 : 0);
      ctx.drawImage(img['wound-flash'], zr[0], zr[1], zr[2], zr[3]);
    }
    for (const tx of g.toxins) if (tx.state === 'sweeping') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.beginPath(); ctx.rect(zr[0], zr[1], zr[2], zr[3]); ctx.clip();
      draw('toxin-shockwave', WOUND.u, WOUND.v, null, Math.max(0, 1 - tx.front * 0.7), Math.max(0.05, tx.front));
      ctx.restore();
    }
    // Quorum bursts (Alex, 2026-10-08): a red bubble with a yellow wick burning down around it. The flashing is on the wick's spark,
    // never on the germs (blinking means reproduction). Then the shockwave.
    ctx.globalCompositeOperation = 'source-over';
    for (const q of g.quorumGlow()) {
      const sm = qSmooth[q.z] || (qSmooth[q.z] = { u: q.u, v: q.v });
      sm.u += (q.u - sm.u) * 0.12; sm.v += (q.v - sm.v) * 0.12; sm.seen = ts;
      const [x, y] = P(sm.u, sm.v), R = CONFIG.quorum.radius * 1.35;
      ctx.globalAlpha = 0.16 + 0.22 * q.f; ctx.fillStyle = '#FF3B4E';
      ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.75; ctx.strokeStyle = '#FF5A5A'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.stroke();
      // the wick: what's left of the fuse, clockwise from the top, burning down toward the top
      const a0 = -Math.PI / 2, a1 = a0 + (1 - q.f) * 6.283, W = R + 3.2;
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      if (q.f < 0.999) { ctx.beginPath(); ctx.arc(x, y, W, a0, a1); ctx.stroke(); }
      // the spark at the burning end flashes yellow and white, faster near the end
      const hz = 3 + 7 * q.f, on = Math.sin(ts * 6.283 * hz) > 0;
      const sx = x + Math.cos(a1) * W, sy = y + Math.sin(a1) * W;
      ctx.fillStyle = on ? '#FFFFFF' : '#FFD23F'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sx, sy, on ? 3.4 : 2.4, 0, 6.283); ctx.fill();
      ctx.lineCap = 'butt';
    }
    for (const z in qSmooth) if (qSmooth[z].seen !== ts) delete qSmooth[z];
    if (quorumPops.length) {
      quorumPops = quorumPops.filter(qp => g.t - qp.t0 < CONFIG.toxin.sweep + 0.1);
      ctx.globalCompositeOperation = 'lighter';
      for (const qp of quorumPops) { const f = Math.min(1, (g.t - qp.t0) / CONFIG.toxin.sweep); draw('toxin-shockwave', qp.u, qp.v, null, Math.max(0, 1 - f * 0.7), Math.max(0.05, f) * qp.r / 340); }
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    // Fields under everything: slime domes, nets, Support rings
    for (const d of g.domes) draw('biofilm-dome', d.u, d.v, null, 0.35 + 0.5 * d.hp / C.pseudo.domeHp, d.r);
    for (const w of g.webs) drawPen(w, ts);
    if (g.hyphae.length) drawHyphae(g, ts);
    const pulse = 1 + 0.03 * Math.sin(ts * 6.283 / 1.6);
    const ringMul = (g.ringR || C.support.ring) / C.support.ring;
    for (const m of g.cells) if (m.type === 'mac' && m.mode === 'support' && !m.tb && m.stun <= 0) draw('support-ring', m.u, m.v, null, 0.7 + 0.3 * (pulse - 0.97) / 0.06, pulse * ringMul);
    if (overlay.range) {
      ctx.strokeStyle = 'rgba(255,210,63,0.25)'; ctx.lineWidth = 1 / vs;
      for (const n of g.cells) if (n.type === 'neut') { const [x, y] = P(n.u, n.v); ctx.beginPath(); ctx.arc(x, y, C.neutrophil.range, 0, 6.283); ctx.stroke(); }
    }

    // Antigens
    const blinks = [], evolved = [];
    let preyOf = null; // which macrophage is swallowing what: built once a frame (was a search of every cell per swallowed antigen)
    const pulseA = 0.65 + 0.35 * Math.sin(ts * 6.283);
    for (const a of g.ag) {
      let al = 1, mul = 1;
      if (a.eaten) {
        if (!preyOf) { preyOf = new Map(); for (const c of g.cells) if (c.prey && !preyOf.has(c.prey)) preyOf.set(c.prey, c); }
        const m = preyOf.get(a);
        const f = m ? Math.max(0, m.gulp / C.macrophage.gulp) : 0;
        al = f; mul = 0.5 + 0.5 * f;
      }
      if (a.flash > 0) al *= 0.6;
      switch (a.k) {
        case 'staph': draw(a.flash > 0 ? 'bacterium-hit' : a.age > a.div - 1.5 ? 'bacterium-dividing' : 'bacterium', a.u, a.v, a.rot, al, mul); break;
        case 'clos': draw(a.flash > 0 ? 'bacterium-hit' : 'clos', a.u, a.v, a.rot, al, mul); break;
        case 'toxic': draw('staph-toxic', a.u, a.v, a.rot, al * pulseA, mul); break;
        case 'worm': draw(a.prev ? 'tapeworm-segment' : 'tapeworm-head', a.u, a.v, a.rot, al, mul); break;
        case 'wormlet': draw('tapeworm-small', a.u, a.v, Math.atan2(a.vv, a.vu), al, mul); break;
        case 'pseudo': draw('pseudomonas', a.u, a.v, a.anchored ? a.rot : Math.atan2(a.vv, a.vu), al, mul); break;
        default: draw(ANTIGEN[a.k].art, a.u, a.v, a.rot, al, mul);
      }
      if (a.tr && !a.eaten && !a.dead) evolved.push(a);
      // blink: strobe while reproducing, and a short warning strobe just before a division
      if (!a.eaten) {
        const warn = KINDS[a.k].divides && a.age < a.div && a.div - a.age < BLINK_WARN && a.div - a.age > 0;
        const tm = a.blink > 0 ? a.blink : warn ? a.div - a.age : -1;
        if (tm > 0 && Math.floor(tm * 14) % 2 === 0) blinks.push(a);
      }
    }
    // Evolved germs: one thin ring per trait (thick wall gold, capsule cyan, slick coat green, hardy core violet), steady
    if (evolved.length) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.85; ctx.lineWidth = 0.9;
      TRAITS.forEach((t, i) => {
        ctx.strokeStyle = t.color; ctx.beginPath();
        for (const a of evolved) if (a.tr.includes(t.k)) { const [x, y] = P(a.u, a.v), r = a.r + 1.4 + i * 1.3; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.283); }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    if (blinks.length && blinkGlow) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
      for (const a of blinks) {
        const [x, y] = P(a.u, a.v), rr = a.r * 2.4;
        ctx.drawImage(blinkGlow, x - rr / SX, y - rr, 2 * rr / SX, 2 * rr);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    blinks.length = 0;

    // Your cells
    for (const c of g.cells) {
      if (c.type === 'mac') {
        const name = c.tb ? 'macrophage-infected' : c.mode === 'support' ? 'macrophage-support' : 'macrophage-offense';
        const stunA = c.stun > 0 ? 0.5 + 0.3 * Math.sin(ts * 20) : 1;
        if (c.gulp > 0 && c.prey && !c.prey.dome) {
          const p = 1 - c.gulp / C.macrophage.gulp, s = Math.sin(p * Math.PI);
          draw(name, c.u, c.v, Math.atan2(c.prey.v - c.v, c.prey.u - c.u), stunA, 1, 1 + 0.3 * s, 1 - 0.12 * s);
        } else draw(name, c.u, c.v, null, stunA, c.cd > 0 ? 1.06 : 1);
        if (c.flip > 0) {
          const [x, y] = P(c.u, c.v), f = c.flip / 0.4;
          ctx.globalAlpha = f; ctx.strokeStyle = c.mode === 'support' ? PAL.repair : PAL.kill; ctx.lineWidth = 1.5 / vs;
          ctx.beginPath(); ctx.ellipse(x, y, (9 + 18 * (1 - f)) / SX, 9 + 18 * (1 - f), 0, 0, 6.283); ctx.stroke();
        }
      } else if (c.type === 'neut') {
        if (c.boosted && (c.vu * c.vu + c.vv * c.vv) > 100) draw('speed-trail', c.u, c.v, Math.atan2(c.vv, c.vu), 0.8);
        const left = C.neutrophil.life - c.age;
        const name = c.infected && Math.floor(ts / 0.3) % 2 ? 'neutrophil-infected' : 'neutrophil';
        draw(name, c.u, c.v, null, left < 3 ? 0.35 + 0.65 * left / 3 : 1);
      } else if (c.type === 'net') draw(c.infected && Math.floor(ts / 0.3) % 2 ? 'neutrophil-infected' : 'neutrophil-net', c.u, c.v, Math.atan2(c.vv, c.vu), 1);
      else if (c.type === 'nk') draw('nk-cell', c.u, c.v, ts * 0.5 + c.id, 1);
    }

    for (const s of g.shots) draw(s.tuned ? 'shot-tuned' : 'shot', s.u, s.v, Math.atan2(s.dv, s.du), 1);

    for (const p of parts) {
      const f = p.life / p.max;
      if (p.kind === 'ring') {
        const [x, y] = P(p.u, p.v);
        ctx.globalAlpha = f * 0.7; ctx.strokeStyle = p.color; ctx.lineWidth = 1 / vs;
        ctx.beginPath(); ctx.ellipse(x, y, (3 + 9 * (1 - f)) / SX, 3 + 9 * (1 - f), 0, 0, 6.283); ctx.stroke();
      } else if (p.kind === 'hit-spark' || p.kind === 'shot') draw(p.kind, p.u, p.v, p.rot, f, p.mul || 1);
      else draw(p.kind, p.u, p.v, p.rot, f);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (flashT > 0) { ctx.fillStyle = `rgba(180,92,255,${flashT * 0.6})`; ctx.fillRect(zr[0], zr[1], zr[2], zr[3]); }
    if (zoomE > 0) ctx.setTransform(scale * dpr * SX, 0, 0, scale * dpr, (ox + jx) * dpr, (oy + jy) * dpr); // screen-edge effects ignore the zoom
    ART.drawFatigueEdge(ctx, VW, VH, g.tier, ts);
    if (stormHold && !g.stormActive()) {
      // charging the storm: the screen edge throbs harder as the charge builds
      const k = stormCharge / chargeNeed(), beat = 0.5 + 0.5 * Math.sin(ts * (5 + 12 * k)), rgb = stormLethal(g) ? '255,59,78' : '255,150,50';
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.hypot(VW, VH) / 2);
      vg.addColorStop(0, `rgba(${rgb},0)`); vg.addColorStop(1, `rgba(${rgb},${Math.min(0.6, (0.08 + 0.32 * k) * (0.55 + 0.45 * beat) * (k >= 1 ? 1.3 : 1))})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
    }
    // Storm: wind-up, hit flash, afterburn edges; collapse on organ failure
    const [sox, soy] = P(L / 2, 0);
    if (g.storm.wind > 0) ART.drawStorm(ctx, VW, VH, { phase: 'windup', p: 1 - g.storm.wind / C.storm.windup, t: ts, ox: sox, oy: soy });
    else if (stormHitT > 0) ART.drawStorm(ctx, VW, VH, { phase: 'hit', p: 1 - stormHitT / 0.45, t: ts });
    else if (g.storm.after > 0) ART.drawStorm(ctx, VW, VH, { phase: 'afterburn', p: 1 - g.storm.after / C.storm.after, t: ts });
    if (g.result && hostFail(g.result)) ART.drawCollapse(ctx, VW, VH, Math.min(1, collapseT / 2));
    ctx.restore();

    // delirium (brain at 1 bar): the edges of your view swim
    if (g.organLevel('brain') <= 1) {
      const k = 0.5 + 0.5 * Math.sin(ts * 1.7), rg = ctx.createRadialGradient(VW / 2 + Math.sin(ts * 0.9) * 20, VH / 2 + Math.cos(ts * 1.1) * 20, Math.min(VW, VH) * (0.28 + 0.06 * k), VW / 2, VH / 2, Math.max(VW, VH) * 0.62);
      rg.addColorStop(0, 'rgba(120,60,160,0)'); rg.addColorStop(1, `rgba(120,60,160,${0.35 + 0.15 * k})`);
      ctx.fillStyle = rg; ctx.fillRect(0, 0, VW, VH);
    }
    if (paused && !modal) { ctx.fillStyle = 'rgba(4,5,10,0.55)'; ctx.fillRect(0, 0, VW, VH); }
  }

  // Net pen: a glowing gold membrane ring that wobbles, tightens and fades; a faint fill shows the trapped area
  function drawPen(w, ts) {
    const f = Math.max(0, Math.min(1, w.life / w.max)), al = Math.min(1, f * 1.6), born = Math.min(1, (w.max - w.life) / 0.18);
    const R = w.r * (0.6 + 0.4 * born), [cx, cy] = P(w.u, w.v), n = 28;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * 6.283, rr = R * (1 + 0.05 * Math.sin(a * 5 + ts * 7 + w.id) + 0.03 * Math.sin(a * 3 - ts * 4));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.14 * al; ctx.fillStyle = "#FFD23F"; ctx.fill();
    ctx.globalAlpha = 0.45 * al; ctx.strokeStyle = "#FFD23F"; ctx.lineWidth = 4 / vs; ctx.stroke();
    ctx.globalAlpha = 0.95 * al; ctx.strokeStyle = '#FFF0A8'; ctx.lineWidth = 1.2 / vs; ctx.setLineDash([4 / vs, 3 / vs]); ctx.lineDashOffset = -ts * 12; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // Fungal threads: a glowing line from each segment to its parent; cut-off pieces fade brown
  function drawHyphae(g, ts) {
    const W = CONFIG.fungus.wither;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = live => {
      ctx.beginPath();
      for (const h of g.hyphae) {
        if (!h.p || h.p.dead || (!h.wither) !== live) continue;
        const [x0, y0] = P(h.p.u, h.p.v), [x1, y1] = P(h.u, h.v);
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
    };
    path(true);
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(214,236,106,0.16)'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(234,245,154,0.85)'; ctx.lineWidth = 1.3; ctx.stroke();
    path(false);
    ctx.strokeStyle = 'rgba(170,140,70,0.45)'; ctx.lineWidth = 1.1; ctx.stroke();
    // tips and knots
    ctx.fillStyle = 'rgba(244,250,190,0.95)';
    for (const h of g.hyphae) {
      if (h.wither) continue;
      const tip = !h.kids.some(k => !k.dead && !k.wither), root = !h.p;
      if (!tip && !root) continue;
      const [x, y] = P(h.u, h.v), rr = root ? 2.8 : 1.3 + 0.4 * Math.sin(ts * 4 + h.id);
      ctx.beginPath(); ctx.ellipse(x, y, rr / SX, rr, 0, 0, 6.283); ctx.fill();
    }
  }
  function zoneRect(z) {
    const [x0, y0] = P(ZB[z], VESSEL), [x1, y1] = P(ZB[z + 1], WIDTH - FAR_VESSEL);
    return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
  }
  const FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const ZONE_ICON = ['sector-wound', 'sector-tissue', 'sector-tissue', 'sector-lymph'];
  // A sprite as a label icon: crops to the body (art kit meta radius) so it fills d pixels around (cx, cy)
  function iconAt(name, cx, cy, d, crop) {
    const im = img[name], m = ART.meta[name]; if (!im || !m) return;
    const k = (im.naturalWidth || im.width || m.size) / m.size, half = Math.min(m.size / 2, m.radius * (crop || 1.2)) * k, c = m.size / 2 * k;
    ctx.drawImage(im, c - half, c - half, half * 2, half * 2, cx - d / 2, cy - d / 2, d, d);
  }
  function zoneLayer(g, ts) {
    const px = 1 / vs;
    ctx.save(); ctx.scale(1 / SX, 1); // labels, chips and clocks keep their shape on a stretched map
    ctx.textBaseline = 'middle';
    for (let z = 0; z < NZ; z++) {
      const [x0, y, w0, h] = zoneRect(z), x = x0 * SX, w = w0 * SX, zn = g.zones[z], cx = x + w / 2;
      if (z === LYMPH) { nodeLayer(g, ts, zn, x, y, w, h, px); continue; }
      ctx.globalAlpha = 0.9; ctx.textAlign = 'left';
      const ic = img[ZONE_ICON[z]];
      if (ic) ctx.drawImage(ic, x + 8 * px, y + 6 * px, 18 * px, 18 * px);
      ctx.fillStyle = PAL.ui; ctx.font = `600 ${13 * px}px ${FONT}`;
      ctx.fillText(zn.name, x + 30 * px, y + 15 * px);
      // Under the name (Alex, 2026-10-08): a germ icon with the antigen count, then a cell icon with this sector's output (100% = a normal sector at 100% stress)
      const n = zn.count, out = Math.round(g.zoneOutput(z) * NZ * g.prodMul() * g.makeMul() * 100); // 100% = a normal sector at 100% stress (Alex)
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = n ? 0.85 : 0.3;
      iconAt('bacterium', x + 19 * px, y + 40 * px, 20 * px, 2); // the rod is longer than its radius: crop wider so it isn't cut off (Alex)
      ctx.font = `600 ${24 * px}px ${FONT}`; ctx.fillStyle = n ? PAL.germHi : PAL.ui;
      ctx.fillText(String(n), x + 31 * px, y + 40 * px);
      ctx.globalAlpha = out ? 0.85 : 0.35;
      iconAt('neutrophil', x + 18 * px, y + 63.5 * px, 15 * px);
      ctx.font = `600 ${15 * px}px ${FONT}`; ctx.fillStyle = out ? PAL.ui : PAL.ui;
      ctx.fillText(`${out}%`, x + 31 * px, y + 63.5 * px);
      ctx.textBaseline = 'alphabetic';
      ctx.font = `500 ${11 * px}px ${MONO}`; ctx.fillStyle = PAL.ui;
      if (zn.threads) { ctx.fillStyle = '#E3F28C'; ctx.globalAlpha = 0.85; ctx.fillText(`+ ${zn.threads} thread${zn.threads > 1 ? 's' : ''}`, x + 12 * px, y + 88 * px); }
      ctx.textBaseline = 'middle';
      const sup = zn.mode === 'support', col = sup ? PAL.repair : PAL.kill;
      const cw = 92 * px, ch = 24 * px, chx = cx - cw / 2, chy = y + h - ch - 8 * px;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(10,13,24,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * px;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(chx, chy, cw, ch, ch / 2); else ctx.rect(chx, chy, cw, ch);
      ctx.fill(); ctx.stroke();
      const mi = img[sup ? 'mode-support' : 'mode-offense'];
      if (mi) ctx.drawImage(mi, chx + 6 * px, chy + 3 * px, 18 * px, 18 * px);
      ctx.fillStyle = col; ctx.font = `600 ${12 * px}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(sup ? 'Support' : 'Offense', chx + 28 * px, chy + ch / 2 + 0.5 * px);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // The Lymph node is a thin strip (10% of the map): one row with its name and count, the stance chip,
  // then the breach clocks (one ring per organ whose germs are, or were just, in the node) before the power button
  function nodeLayer(g, ts, zn, x, y, w, h, px) {
    const my = y + h / 2, n = zn.count, narrow = w < 300 * px;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.globalAlpha = 0.9;
    let left = x + 8 * px;
    const ic = img[ZONE_ICON[LYMPH]];
    if (ic && !narrow) { ctx.drawImage(ic, left, my - 8 * px, 16 * px, 16 * px); left += 20 * px; }
    ctx.fillStyle = PAL.ui; ctx.font = `600 ${12 * px}px ${FONT}`;
    ctx.fillText(zn.name, left, my);
    left += ctx.measureText(zn.name).width + 6 * px;
    ctx.globalAlpha = n ? 0.9 : 0.3;
    iconAt('bacterium', left + 6 * px, my, 14 * px, 2); left += 15 * px;
    ctx.font = `600 ${16 * px}px ${FONT}`; ctx.fillStyle = n ? PAL.germHi : PAL.ui;
    ctx.fillText(String(n), left, my + 0.5 * px);
    left += ctx.measureText(String(n)).width + 8 * px;
    { // this sector's output (100% = a normal sector at 100% stress), after a cell icon (like the big sectors)
      const out = Math.round(g.zoneOutput(LYMPH) * NZ * g.prodMul() * g.makeMul() * 100), txt = `${out}%`;
      ctx.globalAlpha = out ? 0.85 : 0.35;
      iconAt('neutrophil', left + 5.5 * px, my, 11 * px); left += 14 * px;
      ctx.font = `600 ${12 * px}px ${FONT}`; ctx.fillStyle = PAL.ui; ctx.fillText(txt, left, my + 0.5 * px); left += ctx.measureText(txt).width + 8 * px;
    }
    // Laid out from the right so nothing overlaps: power button, then breach clocks, then the stance chip in what's left.
    // Clocks come first; the chip shrinks to its icon, and clocks that don't fit are summed in a "+n".
    const act = ORGANS.filter(o => (g.clocks[o.k] || 0) > 0.001 || g.inNode[o.k]);
    const r = Math.min(13 * px, h * 0.36), gap = 6 * px, step = 2 * r + gap, right = x + w - 46 * px;
    const clocksW = k => k * step - gap, FULL = 74 * px, ICON = 22 * px, plusW = 18 * px;
    const avail = right - left;
    let shown = Math.max(1, act.length), chip = FULL;
    if (avail < FULL + gap + clocksW(shown)) chip = ICON;
    while (shown > 1 && avail < chip + gap + clocksW(shown) + (shown < act.length ? plusW : 0)) shown--;
    if (avail < chip + gap + clocksW(shown)) chip = 0; // too tight even for the icon: the card and map colours carry the stance
    const sup = zn.mode === 'support', col = sup ? PAL.repair : PAL.kill, ch = 20 * px, chy = my - ch / 2;
    if (chip) {
      const chx = left;
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(10,13,24,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * px;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(chx, chy, chip, ch, ch / 2); else ctx.rect(chx, chy, chip, ch);
      ctx.fill(); ctx.stroke();
      const mi = img[sup ? 'mode-support' : 'mode-offense'];
      if (mi) ctx.drawImage(mi, chip === FULL ? chx + 4 * px : chx + (chip - 16 * px) / 2, chy + 2 * px, 16 * px, 16 * px);
      if (chip === FULL) { ctx.fillStyle = col; ctx.font = `600 ${11 * px}px ${FONT}`; ctx.fillText(sup ? 'Support' : 'Offense', chx + 22 * px, my + 0.5 * px); }
    }
    const x0 = right - r;
    if (!act.length) ART.drawTimer(ctx, x0, my, r, 0, { beating: false, t: ts }); // an empty ring: all clear
    act.slice(0, shown).forEach((o, i) => {
      const tx = x0 - i * step, clk = g.clocks[o.k] || 0, live = !!g.inNode[o.k];
      ART.drawTimer(ctx, tx, my, r, clk, { beating: live, t: ts });
      const oi = img[`${o.art}-${ORGAN_STATE[g.organLevel(o.k)]}`];
      if (oi) { ctx.globalAlpha = live ? 1 : 0.55; ctx.drawImage(oi, tx - r * 0.75, my - r * 0.56, r * 1.5, r * 1.12); ctx.globalAlpha = 1; }
    });
    if (act.length > shown) { ctx.fillStyle = '#FFB3BC'; ctx.font = `600 ${10 * px}px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(`+${act.length - shown}`, x0 - (shown - 1) * step - r - 3 * px, my); }
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }

  // ---- progress bar ----
  function markerKind(e) {
    if (e.kind === 'toxin') return 'toxin';
    if (e.kind === 'hatch') return 'spore';
    if (e.final) return 'wave-final';
    const special = e.kinds.filter(k => k !== 'staph');
    return special.length ? ANTIGEN[special[0]].marker : 'wave';
  }
  function drawProg() {
    const w = pcv.width, h = pcv.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, w, h);
    if (!game) return;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = w / dpr, H = h / dpr, D = game.duration;
    progRail(pctx, W, H, Math.min(1, game.t / D), game.levelEvents().map(e => ({ at: Math.min(1, e.t / D), kind: markerKind(e), quorum: !!e.quorum })));
  }
  // ART.drawProgress turned on its side: fills top to bottom, markers stay upright
  function progRail(c, W, H, f, events) {
    const bw = 8, pad = 13, x = (W - bw) / 2, y = pad, h = Math.max(10, H - pad * 2), r = bw / 2;
    c.fillStyle = 'rgba(221,230,245,0.08)'; c.strokeStyle = 'rgba(221,230,245,0.3)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect ? c.roundRect(x, y, bw, h, r) : c.rect(x, y, bw, h); c.fill(); c.stroke();
    if (f > 0) {
      const gr = c.createLinearGradient(0, y, 0, y + h * f);
      gr.addColorStop(0, 'rgba(63,230,255,0.15)'); gr.addColorStop(1, 'rgba(63,230,255,0.55)');
      c.fillStyle = gr; c.beginPath(); c.roundRect ? c.roundRect(x, y, bw, Math.max(bw, h * f), r) : c.rect(x, y, bw, h * f); c.fill();
      c.fillStyle = PAL.cellHi || '#7FF3FF'; c.fillRect(x - 2, y + h * f - 1, bw + 4, 2);
    }
    const next = events.filter(e => e.at > f).sort((a, b) => a.at - b.at)[0];
    for (const e of events) {
      const im = ART.ready['marker-' + e.kind]; if (!im) continue;
      const s = bw * (e.kind === 'wave-final' ? 3.2 : 2.6) * (e === next ? 1.15 : 1);
      c.globalAlpha = e.at <= f ? 0.25 : 1;
      c.drawImage(im, W / 2 - s / 2, y + h * e.at - s / 2, s, s);
      // a Staph wave big enough to reach quorum as it lands: a steady purple ring around its badge
      if (e.quorum) { c.strokeStyle = '#B45CFF'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, y + h * e.at, s * 0.62, 0, 6.283); c.stroke(); }
    }
    c.globalAlpha = 1;
  }

  // ---- production cards: one per zone ----
  let openZone = -1;
  function buildCards() {
    const host = $('#zones'); host.innerHTML = '';
    game.zones.forEach((zn, z) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'zcard'; b.dataset.z = z;
      b.innerHTML = `<span class="zt"><b>${zn.name}</b><i class="mode"></i></span><span class="mix" aria-hidden="true">${game.units.map(u => `<i data-u="${u}" style="background:${UNIT[u].color}"></i>`).join('')}</span><span class="zsub"></span>`;
      b.setAttribute('aria-label', `${zn.name} response`);
      host.appendChild(b);
    });
  }
  function cardsHud() {
    document.querySelectorAll('.zcard').forEach(b => {
      const z = +b.dataset.z, zn = game.zones[z];
      b.querySelectorAll('.mix i').forEach(i => { const v = zn.mix[i.dataset.u]; i.style.flexGrow = v; i.hidden = v < 0.004; });
      const md = b.querySelector('.mode'); md.textContent = zn.mode === 'support' ? 'Support' : 'Offense'; md.className = `mode ${zn.mode}`;
      const top = game.units.slice().sort((a, c) => zn.mix[c] - zn.mix[a])[0];
      const on = game.zonesOn(), boost = zn.on && on < NZ ? `×${(game.zoneOutput(z) * NZ).toFixed(1).replace('.0', '')}` : '';
      const mixTxt = zn.mix[top] > 0.995 ? `100% ${UNIT[top].name.toLowerCase()}` : game.units.filter(u => zn.mix[u] > 0.004).map(u => `${Math.round(zn.mix[u] * 100)}%`).join(' · ');
      const sub = !zn.on ? 'Off · no new cells' : boost ? `<em class="boost">${boost}</em> · ${mixTxt}` : mixTxt;
      const zs = b.querySelector('.zsub'); if (zs.innerHTML !== sub) zs.innerHTML = sub;
      zs.title = boost ? `Gets ${boost} its usual share of new cells while other zones are off` : '';
      b.classList.toggle('off', !zn.on);
      b.setAttribute('aria-label', `${zn.name} production${zn.on ? '' : ' (off)'}`);
      b.classList.toggle('open', openZone === z);
    });
    if (openZone >= 0) sheetHud();
  }
  function openSheet(z) {
    openZone = z;
    const zn = game.zones[z], sh = $('#sheet');
    sh.hidden = false;
    sh.innerHTML = `
      <div class="shd"><div class="ztabs">${game.zones.map((q, i) => `<button type="button" data-zt="${i}" aria-pressed="${i === z}">${q.name}</button>`).join('')}</div><button type="button" class="hbtn" id="sheetClose">Done</button></div>
      <p class="shint"><b>${zn.name} response</b>: what your body makes for this zone. Cells stay near the zone that made them. Moving one slider shares out the rest, so the response always adds up to 100%.</p>
      ${game.units.map(u => `<div class="urow" data-u="${u}">
        <img data-art="${UNIT[u].art}" alt="">
        <div class="ut"><b>${UNIT[u].name}</b><small>${UNIT[u].what}</small></div>
        <span class="pct" id="pct-${u}">0%</span>
        <input type="range" min="0" max="100" step="1" id="mix-${u}" aria-label="${UNIT[u].name} share of ${zn.name} production" style="--c:${UNIT[u].color}">
        <span class="qset"><button type="button" data-set="0" data-u="${u}" aria-label="${UNIT[u].name} 0%">0%</button><button type="button" data-set="1" data-u="${u}" aria-label="${UNIT[u].name} 100%">100%</button></span>
      </div>`).join('')}
      <div class="mrow lrow"><span>Responses</span><div class="loadouts">${[0, 1, 2].map(i => `<div class="lslot"><button type="button" class="lapply" data-load="${i}"><b>${i + 1}</b><span class="lbar"></span></button><button type="button" class="lsave" data-save="${i}">Save</button></div>`).join('')}</div></div>
      <div class="mrow"><span>Use this response everywhere</span><button type="button" class="copyall" id="copyAll">Apply to all zones</button></div>
      <div class="mrow"><span>Make cells for the ${zn.name}</span><div class="seg2"><button type="button" data-on="1">On</button><button type="button" data-on="0">Off</button></div></div>
      <p class="shint" id="onHint"></p>
      <div class="mrow"><span>Macrophages in the ${zn.name}</span><div class="seg2"><button type="button" data-mode="offense">Offense</button><button type="button" data-mode="support">Support</button></div></div>`;
    sh.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
    sh.querySelectorAll('[data-zt]').forEach(b => b.addEventListener('click', () => openSheet(+b.dataset.zt)));
    $('#sheetClose').addEventListener('click', closeSheet);
    for (const u of game.units) $(`#mix-${u}`).addEventListener('input', e => { game.setShare(openZone, u, +e.target.value / 100); sheetHud(e.target); cardsHud(); });
    // 100% makes only this type; 0% hands its share to the others (the mix always adds up to 100%)
    sh.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => { if (b.dataset.set === '1') game.allIn(openZone, b.dataset.u); else game.setShare(openZone, b.dataset.u, 0); sheetHud(); cardsHud(); }));
    sh.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { game.setZone(openZone, b.dataset.mode); sheetHud(); cardsHud(); }));
    sh.querySelectorAll('[data-load]').forEach(b => {
      let t = 0, long = false;
      b.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; saveLoadout(+b.dataset.load); }, 600); });
      const stop = () => clearTimeout(t);
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      b.addEventListener('click', () => { if (long) return; const i = +b.dataset.load; if (loadouts[i]) applyLoadout(i, openZone); else saveLoadout(i); });
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    sh.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => saveLoadout(+b.dataset.save)));
    $('#copyAll').addEventListener('click', () => {
      game.copyMixToAll(openZone); sheetHud(); cardsHud();
      document.querySelectorAll('.zcard').forEach(c => { c.classList.remove('copied'); void c.offsetWidth; c.classList.add('copied'); });
      toast(`${game.zones[openZone].name} response copied to all zones`, 'good');
    });
    sh.querySelectorAll('[data-on]').forEach(b => b.addEventListener('click', () => {
      const want = b.dataset.on === '1';
      if (!game.setZoneOn(openZone, want) && !want && game.zones[openZone].on) toast('One zone has to keep making cells', 'bad');
      sheetHud(); cardsHud();
    }));
    sheetHud(); cardsHud();
  }
  function sheetHud(active) {
    const zn = game.zones[openZone]; if (!zn) return;
    for (const u of game.units) {
      const inp = $(`#mix-${u}`); if (!inp) continue;
      if (inp !== active) inp.value = Math.round(zn.mix[u] * 100);
      $(`#pct-${u}`).textContent = `${Math.round(zn.mix[u] * 100)}%`;
      inp.style.setProperty('--p', `${zn.mix[u] * 100}%`);
      const row = inp.closest('.urow');
      if (row) { row.querySelector('[data-set="1"]').setAttribute('aria-pressed', zn.mix[u] > 0.995); row.querySelector('[data-set="0"]').setAttribute('aria-pressed', zn.mix[u] < 0.005); }
    }
    document.querySelectorAll('#sheet [data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === zn.mode));
    document.querySelectorAll('#sheet [data-on]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.on === '1') === zn.on));
    const others = game.zones.filter(q => q !== zn && q.on).map(q => q.name), last = zn.on && game.zonesOn() <= 1;
    const total = Math.round(game.zones.reduce((a, q, i) => a + game.zoneOutput(i), 0) * 100), z = game.zones.indexOf(zn);
    // vessel wall: focusing on fewer zones wastes output (sim zoneOutput)
    const hint = !zn.on ? `Off: no new cells here. Its share goes to the ${others.join(' and ')}, but each vessel wall only lets so many cells through, so your body makes ${total}% of its full output.`
      : last ? `The only zone still making cells. Its vessel wall can only take so many, so your body makes ${total}% of its full output.`
      : game.zonesOn() < NZ ? `Gets ${(game.zoneOutput(z) * NZ).toFixed(1).replace('.0', '')}× its usual share while another zone is off. The rest is lost at the vessel walls: ${total}% of full output.` : 'Switching a zone off sends its share to the others, but each vessel wall only lets so many cells through, so fewer zones on means less output overall.';
    const oh = $('#onHint'); if (oh && oh.textContent !== hint) oh.textContent = hint;
    loadoutHud();
    document.querySelectorAll('#sheet .urow').forEach(r => r.classList.toggle('dim', !zn.on));
  }
  // ---- loadouts: three saved cell mixes, kept between matches; tap applies to the open zone, Save (or long-press) stores ----
  const LOAD_KEY = 'cytostormV3.loadouts';
  const loadouts = (() => { const v = store.get(LOAD_KEY); return Array.isArray(v) ? [0, 1, 2].map(i => v[i] && typeof v[i] === 'object' ? v[i] : null) : [null, null, null]; })();
  const sameMix = (a, zn) => a && game.units.every(u => Math.abs((a[u] || 0) - zn.mix[u]) < 0.006);
  function saveLoadout(i) {
    const zn = game && game.zones[openZone]; if (!zn) return;
    loadouts[i] = Object.fromEntries(game.units.map(u => [u, +zn.mix[u].toFixed(3)]));
    store.set(LOAD_KEY, loadouts);
    game.logInput({ a: 'loadoutSave', slot: i + 1, z: openZone, mix: Object.fromEntries(game.units.map(u => [u, Math.round(zn.mix[u] * 100)])) });
    toast(`Saved response ${i + 1}`, 'good'); loadoutHud();
  }
  function applyLoadout(i, z) {
    const lo = loadouts[i]; if (!lo || !game || game.result) return;
    const zs = z >= 0 ? [z] : game.zones.map((_, i) => i);
    for (const q of zs) game.setMix(q, Object.fromEntries(game.units.map(u => [u, lo[u] || 0])));
    game.logInput({ a: 'loadout', slot: i + 1, z: z >= 0 ? z : 'all' });
    toast(`Response ${i + 1} → ${z >= 0 ? game.zones[z].name : 'all zones'}`, 'good');
    if (openZone >= 0) sheetHud(); cardsHud();
  }
  function loadoutHud() {
    const zn = game && game.zones[openZone]; if (!zn) return;
    document.querySelectorAll('#sheet [data-load]').forEach(b => {
      const lo = loadouts[+b.dataset.load], bar = b.querySelector('.lbar');
      const html = lo ? game.units.filter(u => (lo[u] || 0) > 0.004).map(u => `<i style="flex-grow:${lo[u]};background:${UNIT[u].color}"></i>`).join('') || '<em>no cells here</em>' : '<em>Empty</em>';
      if (bar.innerHTML !== html) bar.innerHTML = html;
      b.setAttribute('aria-pressed', sameMix(lo, zn));
      b.setAttribute('aria-label', lo ? `Apply saved response ${+b.dataset.load + 1} to the ${zn.name} (hold to save over it)` : `Save the ${zn.name} response as ${+b.dataset.load + 1}`);
    });
  }
  function closeSheet() { openZone = -1; $('#sheet').hidden = true; if (game) cardsHud(); }
  $('#zones').addEventListener('click', e => {
    const b = e.target.closest('.zcard'); if (!b || !game) return;
    const z = +b.dataset.z;
    if (openZone === z) closeSheet(); else openSheet(z);
  });

  // ---- storm button: hold to charge (CONFIG.storm.charge real seconds), release to fire; early release or sliding off cancels ----
  let stormHold = false, stormCharge = 0, stormSnd = null;
  const sb = $('#stormBtn');
  const chargeNeed = () => Math.max(0.01, CONFIG.storm.charge || 0);
  const stormFull = () => stormHold && stormCharge >= chargeNeed();
  // what a storm fired now would do to the organs (sim.js stormOutcome), cached per sim tick
  let outCache = { g: null, t: -1, out: -1, v: null };
  function stormOut(g) {
    if (outCache.g !== g || outCache.t !== g.t || outCache.out !== g.output) outCache = { g, t: g.t, out: g.output, v: g.stormOutcome() };
    return outCache.v;
  }
  const stormLethal = g => stormOut(g).fatal, stormRisky = g => stormOut(g).hurt;
  function stormStart() {
    if (stormHold || !game || game.result || modal || game.stormActive()) return false;
    stormHold = true; stormCharge = 0; stormSnd = AU && auOn ? AU.storm() : null;
    game.logInput({ a: 'stormCharge', fatigue: Math.round(game.fatigue), risky: stormRisky(game), lethal: stormLethal(game) });
    hud(); return true;
  }
  function stormEnd(release) {
    if (!stormHold) return;
    const full = stormFull(), held = +stormCharge.toFixed(1);
    stormHold = false; stormCharge = 0; sb.style.setProperty('--charge', 0);
    if (stormSnd && !(release && full && game && !game.result)) { stormSnd.cancel(); stormSnd = null; }
    if (game && !game.result) {
      if (release && full) { game.useStorm(); if (stormSnd) stormSnd.fire(); stormSnd = null; }
      else game.logInput({ a: 'stormCancel', held, why: !release ? 'slid off' : 'let go early' });
    }
    hud();
  }
  sb.addEventListener('pointerdown', e => { if (stormStart()) { try { sb.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } } });
  sb.addEventListener('pointerup', e => {
    if (!stormHold) return;
    const r = sb.getBoundingClientRect();
    stormEnd(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  });
  sb.addEventListener('pointercancel', () => stormEnd(false));
  // Charge runs on real time (not game speed) and pauses with the game; a modal or the end of the fight cancels it
  let chargeBuzz = false, chargeLast = 0;
  function stepCharge(now) {
    const dt = chargeLast ? Math.min(0.5, (now - chargeLast) / 1000) : 0; chargeLast = now; // wall clock, so slow frames don't stretch the charge
    if (!stormHold) return;
    if (!game || game.result || modal || game.stormActive()) { stormEnd(false); return; }
    if (!paused) stormCharge = Math.min(chargeNeed(), stormCharge + dt);
    sb.style.setProperty('--charge', (stormCharge / chargeNeed()).toFixed(3));
    if (!stormFull()) { const t = `Hold ${Math.ceil(chargeNeed() - stormCharge - 1e-6)}`; if ($('#stormLbl').textContent !== t) $('#stormLbl').textContent = t; }
    const full = stormFull();
    if (full && !chargeBuzz) { chargeBuzz = true; try { if (navigator.vibrate) navigator.vibrate(40); } catch (x) { /* no haptics */ } }
    if (!full) chargeBuzz = false;
  }
  sb.addEventListener('contextmenu', e => e.preventDefault());
  // iOS: a long touch would start the native callout or drag; the pointer events above still fire
  sb.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  sb.addEventListener('dragstart', e => e.preventDefault());

  // ---- the fatigue heart: fills from the bottom and beats faster as fatigue builds ----
  const hcv = $('#heart'), hctx = hcv.getContext('2d');
  let beatPhase = 0, beatGap = 0, lastBeat = 0;
  const HEART_STOPS = [[0, [255, 111, 156]], [35, [255, 138, 61]], [60, [255, 46, 69]], [85, [120, 20, 90]], [100, [60, 6, 40]]];
  function heartColor(f) {
    let a = HEART_STOPS[0], b = HEART_STOPS[HEART_STOPS.length - 1];
    for (let i = 0; i < HEART_STOPS.length - 1; i++) if (f >= HEART_STOPS[i][0] && f <= HEART_STOPS[i + 1][0]) { a = HEART_STOPS[i]; b = HEART_STOPS[i + 1]; break; }
    const k = (f - a[0]) / Math.max(1, b[0] - a[0]), c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * k));
    return c;
  }
  function heartBpm(g) { return 60 + 1.2 * g.fatigue + (g.storm.after > 0 ? 25 : 0); }
  function heartPath(c, cx, cy, w, h) {
    c.beginPath();
    c.moveTo(cx, cy + h * 0.42);
    c.bezierCurveTo(cx - w * 0.62, cy - h * 0.02, cx - w * 0.5, cy - h * 0.62, cx, cy - h * 0.24);
    c.bezierCurveTo(cx + w * 0.5, cy - h * 0.62, cx + w * 0.62, cy - h * 0.02, cx, cy + h * 0.42);
    c.closePath();
  }
  function drawHeart(dt, ts) {
    const g = game; if (!g) return;
    const C = CONFIG, k = Math.min(3, window.devicePixelRatio || 1), W = 54, H = 50;
    if (hcv.width !== W * k) { hcv.width = W * k; hcv.height = H * k; }
    const c = hctx; c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, W, H);
    // beat: lub-dub, faster with fatigue; Exhausted skips beats now and then
    const bpm = heartBpm(g);
    if (beatGap > 0) beatGap -= dt;
    else {
      beatPhase += dt * bpm / 60;
      if (beatPhase >= 1) { beatPhase -= 1; lastBeat = ts; if (g.tier >= 3 && Math.random() < 0.22) beatGap = 60 / bpm * (0.3 + Math.random() * 0.5); }
    }
    const p = beatPhase, burning = g.storm.after > 0 || g.storm.wind > 0;
    const pulse = Math.exp(-(((p - 0.05) / 0.045) ** 2)) + 0.6 * Math.exp(-(((p - 0.24) / 0.05) ** 2));
    const amp = burning ? 0.17 : 0.07 + 0.05 * g.fatigue / 100;
    const s = 1 + amp * pulse, cx = W / 2, cy = H / 2 + 2, hw = 44 * s, hh = 44 * s;
    const f = Math.max(0, Math.min(100, g.fatigue)), col = heartColor(f), rgb = `rgb(${col})`;
    // body
    c.save(); heartPath(c, cx, cy, hw, hh); c.clip();
    c.fillStyle = '#1A0B16'; c.fillRect(0, 0, W, H);
    const top = cy + hh * 0.42, bottom = cy - hh * 0.36, lvl = y => top - (top - bottom) * y / 100;
    const wave = (x, y0) => y0 + Math.sin(x * 0.35 + ts * 5) * (1 + 1.5 * pulse);
    const fillTo = (y, style) => { c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 3) c.lineTo(x, wave(x, lvl(y))); c.lineTo(W, H); c.closePath(); c.fillStyle = style; c.fill(); };
    // storm preview: where fatigue would land
    if (stormHold && !g.stormActive()) {
      // the ghost rises toward the forecast as the storm charges, then blinks when it's ready
      const fc = g.stormForecast(), lethal = stormLethal(g), risky = stormRisky(g), k = stormCharge / chargeNeed(), ready = k >= 1;
      const ga = ready ? (Math.floor(ts * 5) % 2 ? 0.5 : 0.28) : 0.3;
      fillTo(Math.min(100, f + (fc - f) * k), lethal ? `rgba(255,59,78,${ga + 0.05})` : risky ? `rgba(255,138,61,${ga + 0.05})` : `rgba(255,210,63,${ga})`);
      c.strokeStyle = lethal ? '#FF3B4E' : risky ? '#FF8A3D' : '#FFD23F'; c.setLineDash([3, 2]); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, lvl(Math.min(100, fc))); c.lineTo(W, lvl(Math.min(100, fc))); c.stroke(); c.setLineDash([]);
    }
    if (f > 0.5) {
      const gr = c.createLinearGradient(0, lvl(f), 0, top);
      gr.addColorStop(0, `rgba(${col},${0.85 + 0.15 * pulse})`); gr.addColorStop(1, `rgba(${heartColor(Math.min(100, f + 25))},1)`);
      fillTo(f, gr);
    }
    // overload: the heart is full and floods red, harder the further past 100
    if (g.overload() > 0) { c.fillStyle = `rgba(255,40,70,${Math.min(0.75, 0.3 + g.overload() / 120 + 0.2 * pulse)})`; c.fillRect(0, 0, W, H); }
    // tier marks
    c.strokeStyle = 'rgba(221,230,245,0.25)'; c.lineWidth = 1;
    for (const t of [C.fatigue.tired, C.fatigue.feverish, C.fatigue.exhausted]) { c.beginPath(); c.moveTo(cx - 3, lvl(t)); c.lineTo(cx + 3, lvl(t)); c.stroke(); }
    c.restore();
    // outline glows on the beat; Exhausted flickers, the afterburn pounds orange
    heartPath(c, cx, cy, hw, hh);
    const flick = g.tier >= 3 && Math.random() < 0.12 ? 0.35 : 1, over = g.overload();
    c.lineWidth = over > 0 ? 2.2 : 1.6;
    c.strokeStyle = over > 0 ? `rgba(255,59,78,${0.75 + 0.25 * pulse})` : burning ? `rgba(255,122,61,${0.7 + 0.3 * pulse})` : `rgba(${col},${(0.55 + 0.45 * pulse) * flick})`;
    c.shadowColor = over > 0 ? '#FF3B4E' : burning ? '#FF7A3D' : rgb; c.shadowBlur = 4 + 10 * pulse * (burning || over > 0 ? 1.6 + over / 30 : 1);
    c.stroke(); c.shadowBlur = 0;
    if (stormHold && !g.stormActive() && stormLethal(g) && Math.floor(ts * 4) % 2) {
      // lethal: a crack down the middle
      c.strokeStyle = '#FF3B4E'; c.lineWidth = 1.4; c.beginPath();
      c.moveTo(cx, cy - hh * 0.24); c.lineTo(cx - 3, cy - hh * 0.05); c.lineTo(cx + 3, cy + hh * 0.08); c.lineTo(cx - 2, cy + hh * 0.25); c.lineTo(cx, cy + hh * 0.4); c.stroke();
    }
  }

  // ---- HUD ----
  function nextEventText(g) {
    const m = g.markers().filter(e => e.t > g.t).sort((a, b) => a.t - b.t)[0];
    if (!m) return null;
    const sp = m.kinds ? m.kinds.filter(k => k !== 'staph') : [];
    const what = m.kind === 'toxin' ? 'toxin burst' : m.kind === 'hatch' ? 'spores hatch' : m.final ? 'final wave' : sp.length ? `wave with ${sp.map(kindName).join(' and ')}` : 'wave';
    return `Next: ${what} in ${fmt(m.t - g.t)}`;
  }
  function hud() {
    const g = game; if (!g) return;
    const C = CONFIG;
    $('#clock').textContent = fmt(Math.min(g.t, 5999));
    const fz = $('#fatigue');
    const over = g.overload() > 0;
    fz.dataset.tier = over ? 4 : g.tier; $('#fTier').textContent = over ? 'Overload' : TIER[g.tier];
    $('#heart').setAttribute('aria-label', `Fatigue ${Math.round(g.fatigue)} of 100, ${over ? 'Overload: organs taking damage' : TIER[g.tier]}`);
    const lethal = stormHold && !g.stormActive() && stormLethal(g), risky = stormHold && !g.stormActive() && stormRisky(g);
    const sIcon = g.stormActive() ? 'storm-afterburn' : lethal ? 'storm-lethal' : 'storm';
    const si = $('#stormIcon'); if (si.dataset.art !== sIcon) { si.dataset.art = sIcon; si.src = artUrl(sIcon); }
    const left = chargeNeed() - stormCharge;
    $('#stormLbl').textContent = g.storm.wind > 0 ? 'Storm…' : g.storm.after > 0 ? `${Math.ceil(g.storm.after)} s` : stormHold ? (stormFull() ? (lethal ? 'Lethal' : risky ? 'Risky' : 'Release') : `Hold ${Math.ceil(left - 1e-6)}`) : 'Storm';
    sb.classList.toggle('held', stormHold); sb.classList.toggle('charged', stormFull()); sb.classList.toggle('lethal', lethal); sb.classList.toggle('risky', risky && !lethal); sb.classList.toggle('burning', g.stormActive());
    if (document.activeElement !== $('#output')) $('#output').value = Math.round(g.output * 100);
    // Stress (Alex, 2026-10-08; was "body output"): the slider's setting, capped by the heart. Cell output follows it with diminishing returns
    const eff = g.effMul() * g.makeMul();
    $('#outVal').textContent = `${Math.round(g.effMul() * 100)}%`; $('#outVal').classList.toggle('cut', g.effMul() < g.outputMul() - 0.005);
    $('#outVal').title = `Cells made at ${g.prodMul().toFixed(2)}× the normal rate${g.makeMul() < 1 ? ', slowed by the liver' : ''}`;
    const cc = $('#cellCount'); cc.textContent = `${g.cells.length}/${g.cellCap()}`; cc.title = `Your cells / limit${g.cellCap() < C.caps.cells ? ' (cut by the spleen)' : ''}`; cc.classList.toggle('cut', g.cellCap() < C.caps.cells);
    bodyHud();
    cardsHud();
    const tx = g.pendingToxin(), glow = g.quorumGlow().sort((a, b) => b.f - a.f)[0];
    const bn = $('#banner'); let cls = '', html;
    const has = k => g.ag.some(a => a.k === k && !a.dead);
    const infected = g.cells.filter(c => c.infected).length;
    const sporeNext = g.markers().find(m => m.kind === 'hatch' && m.t - g.t < 12);
    const worm = g.ag.filter(a => a.k === 'worm').length;
    if (g.overload() > 0) { cls = 'bad'; html = `<b>Overload: your organs are taking damage.</b> Fatigue is past 100. ${g.storm.after > 0 ? 'Afterburn is still pushing it up; stress all the way down halves that.' : `Turn stress down: up here you recover ${C.organs.overRecover}× faster.`}`; }
    else if (g.storm.after > 0) { cls = 'bad'; html = `<b>Afterburn: fatigue is still climbing.</b> Past 100 it hurts your organs. Stress all the way down halves it.`; }
    else if (tx && tx.state === 'coming') { cls = 'alarm'; html = `<b>Toxin burst in ${Math.ceil(tx.at - g.t)} s.</b> It will kill every cell in the Wound.`; }
    else if (glow) { cls = 'alarm'; html = `<b>Staph crowd in the ${ZONES[glow.z]}: pops in ${Math.ceil(glow.left)} s.</b> Thin it.`; }
    else if (g.tier >= 2) { cls = 'bad'; html = g.tier >= 3 ? `<b>Exhausted.</b> Support rings shrink, and past 100 your organs take damage. Turn stress down to let your body recover.` : `<b>Feverish.</b> Shots spray and neutrophils die sooner. Turn stress down to let your body recover.`; }
    else if (g.zones[LYMPH].count > 0) { const hit = ORGANS.filter(o => g.inNode[o.k]).map(o => o.name.toLowerCase()); cls = 'bad'; html = `<b>Antigens in the Lymph node.</b> They're filling the ${hit.join(' and ')} clock${hit.length > 1 ? 's' : ''}; a full clock costs that organ a bar.`; }
    else if (sporeNext) html = `<b>Spores hatch in ${Math.ceil(sporeNext.t - g.t)} s.</b> Rest now, push stress up right before they crack.`;
    else if (infected) { cls = 'bad'; html = `<b>${infected} infected neutrophil${infected > 1 ? 's' : ''}.</b> They burst into Herpes. NK cells pop them first.`; }
    else if (worm) html = `<b>Tapeworm: ${worm} segments left.</b> Too big to swallow. Support rings make shots hit harder.`;
    else if (g.hyphae.length) html = `<b>Fungal threads.</b> Germs ride them toward the Lymph node. Shots pass through; Net neutrophils cut them, Offense macrophages chew the tips.`;
    else if (g.domes.length) html = `<b>Slime dome${g.domes.length > 1 ? 's' : ''}.</b> Shots barely dent the germs under them. Offense macrophages in that zone tear them down.`;
    else if (has('mrsa') && !g.zones.some(z => z.mode === 'support')) html = `<b>MRSA.</b> Plain shots only chip its armor and macrophages spit it out. Support rings kill it fast.`;
    else if (has('tb')) html = `<b>Tuberculosis.</b> A macrophage that swallows it becomes a TB factory. Only NK cells can kill it. Support zones are safer.`;
    else if (g.toxicDrain) html = `<b>Toxic-shock Staph.</b> While it lives, fatigue builds twice as fast.`;
    else if (has('strep')) html = `<b>Strep chains</b> sprint for the Lymph node. Plain shots split them; tuned shots don't.`;
    else if (has('flu')) html = `<b>Influenza swarm.</b> Each one that reaches the Tissue splits in three. Net neutrophils wipe out clusters.`;
    else if (g.t < 15) html = `<b>${esc(g.lv.name)}.</b> Tap a zone's card below to set what it makes.`;
    else if (g.t >= g.duration) html = `<b>No more waves.</b> Clear what's left to win.`;
    else html = nextEventText(g) || '';
    bn.className = cls; if (bn.innerHTML !== html) bn.innerHTML = html;
    const sp = SPEEDS[speedIdx], ff = $('#ffBtn'), lbl = `${sp}×`;
    if (ff.textContent !== lbl) { ff.textContent = lbl; ff.classList.toggle('fast', sp !== 1); ff.setAttribute('aria-label', `Game speed ${lbl}, tap to change`); }
  }
  function toast(text, kind) {
    const el = document.createElement('div'); el.className = `toast ${kind || ''}`; el.textContent = text;
    $('#toasts').appendChild(el);
    while ($('#toasts').children.length > 2) $('#toasts').firstChild.remove();
    setTimeout(() => el.remove(), 2300);
  }

  // ---- organs: the button by the fatigue label, and the Organ status window ----
  let bodySig = '';
  const pips = (h, cls) => `<span class="${cls || 'pips'}">${[1, 2, 3, 4].map(i => `<i class="${h >= i - 1e-9 ? 'on' : h > i - 1 ? 'part' : ''}"></i>`).join('')}</span>`;
  function bodyHud() {
    const g = game, btn = $('#bodyBtn'); if (!g || !btn) return;
    const lv = ORGANS.map(o => g.organLevel(o.k)), over = g.overload() > 0;
    const sig = lv.join('') + ORGANS.map(o => Math.round(g.organs[o.k] * 4)).join('') + (over ? 'o' : '') + ORGANS.map(o => g.organHit[o.k] > 0 ? 1 : 0).join('');
    if (sig === bodySig) return;
    bodySig = sig;
    btn.classList.toggle('over', over);
    btn.innerHTML = ORGANS.map((o, i) => `<span class="org s${lv[i]}${g.organHit[o.k] > 0 ? ' hit' : ''}"><img src="${artUrl(`${o.art}-${ORGAN_STATE[lv[i]]}`)}" alt="">${pips(g.organs[o.k])}</span>`).join('');
    btn.setAttribute('aria-label', `Organs: ${ORGANS.map((o, i) => `${o.name} ${lv[i]} of 4`).join(', ')}. Open organ status (pauses the game)`);
  }
  function bodyHtml() {
    const g = game, C = CONFIG, G = C.organs, over = g.overload();
    const card = o => {
      const h = g.organs[o.k], l = g.organLevel(o.k), st = ORGAN_STATE[l];
      const now = over > 0 ? `<li class="bad">Losing <b>${(g.organRate(o.k, over)).toFixed(2)} bars/s</b> right now (fatigue ${Math.round(g.fatigue)}).</li>` : '';
      const heal = HEALS[o.k] ? (l >= 4 && h >= 4 ? `<li class="dim">Heals a bar every ${G.heal} s while you're Fine.</li>` : g.fatigue < C.fatigue.tired && over <= 0 ? `<li class="good">Healing: a bar every ${G.heal} s while you stay Fine.</li>` : `<li class="dim">Heals a bar every ${G.heal} s once you're Fine (under ${C.fatigue.tired}).</li>`) : `<li class="dim">Doesn't heal during a match.</li>`;
      // one-row meter, Healthy (4 bars) to Failed (0): only the step you're on is lit
      const meter = `<div class="ometer" aria-label="${o.name}: ${ORGAN_WORD[l]}, ${organEffect(o.k, l)}"><span class="mlab">${METER_LABEL[o.k]}</span><div class="msegs">${[4, 3, 2, 1, 0].map(b => `<i class="${b === l ? `on s${b}` : ''}"><b>${meterVal(o.k, b)}</b><small>${ORGAN_WORD[b]}</small></i>`).join('')}</div></div>`;
      const clk = g.clocks[o.k] || 0, nn = g.inNode[o.k] || 0, hb = harmedBy(o.k);
      const breach = clk > 0 || nn > 0 ? `<li class="bad">Breach clock <b>${pctOf(clk)}</b>${nn ? `: ${nn} of its germs in the Lymph node. When it fills, the ${o.name.toLowerCase()} loses a bar.` : ', draining now its germs are gone.'}</li>` : '';
      return `<div class="ocard ${st}"><img data-art="${o.art}-${st}" alt=""><div><b>${o.name}</b> ${pips(h, 'pips big')} <span class="ost">${ORGAN_WORD[l]}</span></div>${meter}<p class="onow ${l < 4 ? 'bad' : 'good'}">${l === 0 ? 'Failed: Host failure.' : l < 4 ? organEffect(o.k, l) : 'No penalty.'}</p><ul><li class="dim">${o.job}</li>
${breach}${now}${heal}${hb.length ? `<li class="dim">Hurt by ${hb.join(', ')} in the Lymph node.</li>` : ''}</ul></div>`;
    };
    return `
      <span class="eyebrow">Body · paused</span>
      <h2>Organ status</h2>
      <p class="shint">Germs that sit in the Lymph node fill their organ's breach clock; a full clock costs that organ a bar. Fatigue past 100 (Overload) hurts every organ, the heart most. Each whole bar lost adds a penalty, and any organ at 0 is Host failure.</p>
      <div class="bodyview">${ORGANS.map(card).join('')}</div>
      <div class="btnrow"><button class="btn primary" id="bodyClose" type="button">Resume</button></div>`;
  }
  function showBody() {
    if (!game || modal || game.result) return;
    openModal('body', bodyHtml());
    $('#bodyClose').addEventListener('click', closeModal);
    $('#mbox').scrollTop = 0;
  }
  $('#bodyBtn').addEventListener('click', showBody);

  // ---- modals ----
  function openModal(kind, html) {
    modal = kind; $('#mbox').innerHTML = html; $('#modal').hidden = false;
    $('#mbox').querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
  }
  function closeModal() { modal = null; $('#modal').hidden = true; last = 0; }
  // Antigens a level introduces (not seen in an earlier level)
  function newIn(key) {
    const seen = new Set();
    for (const k of LEVEL_ORDER.slice(0, LEVEL_ORDER.indexOf(key))) for (const w of LEVELS[k].waves) for (const x in KINDS) if (w[x]) seen.add(x);
    const out = new Set();
    for (const w of LEVELS[key].waves) for (const x in KINDS) if (w[x] && !seen.has(x)) out.add(x);
    return [...out];
  }
  // Levels the bots say are still off (too hard or too easy); playable, just not tuned
  const ROUGH = new Set(['flu', 'throat', 'foot']); // levels flagged "not balanced yet" (V26: with quorum bursts, Flu loses to gunner/offense-heavy and focus play, Sore throat smart 2/4)
  function showStart() {
    const lv = LEVELS[levelKey];
    openModal('start', `
      <span class="eyebrow">Cytostorm · prototype v3</span>
      <h2>${esc(lv.name)}</h2>
      <p>${esc(lv.blurb)}</p>
      <div class="levels">${LEVEL_ORDER.map((k, i) => {
        const nw = newIn(k).filter(x => x !== 'clos'), b = best[k] || 0;
        return `<button type="button" class="lvl" data-lv="${k}" aria-pressed="${k === levelKey}"><span class="n">${i + 1}</span><span class="nm">${esc(LEVELS[k].name)}${ROUGH.has(k) ? ' <em class="rough">not balanced yet</em>' : ''}</span><span class="new">${nw.map(x => `<img data-art="${ANTIGEN[x].art}" alt="" title="${esc(kindName(x))}">`).join('')}</span><span class="st">${'★'.repeat(b)}<span>${'★'.repeat(3 - b)}</span></span></button>`;
      }).join('')}</div>
      <ol class="howto">
        <li><b>Production cards</b> (bottom): tap a zone's card to set its <b>response</b>, the cells your body makes for that zone, or switch it <b>Off</b> to send its share to the other zones. Cells stay near their zone.</li>
        <li><b>Tap a zone</b> on the map to flip its macrophages between <b style="color:var(--kill)">Offense</b> (swallow) and <b style="color:var(--repair)">Support</b> (rings that power up shots).</li>
        <li><b>Stress</b> speeds up cell making (with diminishing returns) but builds <b>fatigue</b>. <b>Storm</b> is the nuclear option: hold it for ${CONFIG.storm.charge} s to charge, release to fire. Fatigue past 100 hurts your <b>organs</b> (tap them under the heart), and any organ that fails ends the match.</li>
      </ol>
      <div class="btnrow"><button class="btn primary" id="go" type="button">Start ${esc(lv.name)}</button></div>
      <button class="linkbtn" id="openGuide" type="button">How each cell and antigen works</button>`);
    $('#mbox').querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => { levelKey = b.dataset.lv; store.set('immuneRtsV3.level', levelKey); newGame(); showStart(); }));
    $('#go').addEventListener('click', () => startWithTutorial());
    $('#openGuide').addEventListener('click', () => showGuide('start', 'units'));
  }
  // ---- tutorial clips (tutorial/tutorial.js): played once before each level that brings something new ----
  const TUT = typeof CytoTutorial !== 'undefined' ? CytoTutorial : null, TUT_KEY = 'cytostormV3.tutorialSeen';
  function playClips(ids, opts, after) {
    openModal('tutorial', '<div id="tutHost"></div>');
    try { TUT.play($('#tutHost'), ids, Object.assign({}, opts, { onDone: skipped => after(skipped) })); }
    catch (e) { console.warn('tutorial failed', e); after(true); }
  }
  function startWithTutorial() {
    const key = levelKey, go = () => {
      closeModal(); newGame();
      if (!store.get('cytostormV3.zoomTip')) { store.set('cytostormV3.zoomTip', 1); setTimeout(() => toast('Tip: double-tap a sector to watch it up close', 'good'), 1500); }
    };
    const seen = store.get(TUT_KEY) || {};
    const ids = TUT && !seen[key] ? TUT.forLevel(key, newIn(key)).filter(id => TUT.CLIPS[id]) : [];
    if (!ids.length) { go(); return; }
    playClips(ids, { eyebrow: key === 'papercut' ? 'How to play' : 'New in ' + LEVELS[key].name, doneLabel: 'Start ' + LEVELS[key].name }, () => {
      const s = store.get(TUT_KEY) || {}; s[key] = 1; store.set(TUT_KEY, s); go();
    });
  }
  function guideHtml(tab) {
    const C = CONFIG;
    const tabs = [['howto', 'How to play'], ['goal', 'Goal'], ['units', 'Your cells'], ['enemies', 'Antigens'], ['controls', 'Controls']];
    const unit = (art, name, why, items) => `<div class="unit"><img data-art="${art}" alt=""><h4>${name}</h4><p class="why">${why}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    let body = '';
    if (tab === 'howto') {
      if (!TUT) body = '<p>The tutorial clips did not load.</p>';
      else {
        const seen = store.get(TUT_KEY) || {}, watched = new Set(Object.keys(seen).flatMap(k => TUT.forLevel(k, newIn(k))));
        const btn = id => `<button type="button" class="clip${watched.has(id) ? ' seen' : ''}" data-clip="${id}"><canvas aria-hidden="true"></canvas><span>${esc(TUT.CLIPS[id].title)}</span></button>`;
        body = `<p>Short clips of each mechanic. Tap one to watch it.</p><div class="clips"><h4>Basics</h4>${TUT.BASICS.map(btn).join('')}<h4>Antigens</h4>${TUT.ANTIGENS.filter(id => TUT.CLIPS[id]).map(btn).join('')}</div>`;
      }
    }
    if (tab === 'goal') body = `
      <p>Each level runs on a fixed script. The bar at the top fills over the level; badges show what each wave brings, and a purple ring marks a Staph wave big enough to set off a quorum burst.</p>
      <ol class="howto">
        <li><b>Win</b> once the bar is full and every antigen on the map is dead.</li>
        <li><b>Lose</b> if any organ runs out of bars (Host failure). Germs in the Lymph node fill their organ's breach clock (${C.lymph.fill} s to fill; bigger crowds fill it a little faster), and each full clock costs that organ a bar. Fatigue past 100 hurts every organ.</li>
        <li><b>Stars:</b> 1 for winning, 2 if no breach clock passed half, 3 if nothing ever reached the Lymph node.</li>
      </ol>`;
    if (tab === 'units') body = [
      unit('neutrophil', 'Neutrophil', 'The gunner. Zigzags toward the nearest antigen in its zone and shoots it.', [`A gold antibody every <b>${C.neutrophil.fireEvery} s</b>; ${C.staph.hp} hits kill Staph.`, `Plain shots only chip MRSA (${C.mrsa.hp} hits) and fizzle on slime domes.`, `Lives <b>${C.neutrophil.life} s</b>. Costs 1.`]),
      unit('neutrophil-net', 'Net neutrophil', 'Area damage. Runs to the thickest crowd in its zone and bursts into a glowing pen around it.', [`${C.net.damage} damage to everything small inside. For ${C.net.stick} s the pen keeps them in (they still jostle) and keeps other antigens out, tightening as it fades.`, `Great on swarms like Influenza, useless on MRSA. Costs ${C.marrow.net}.`]),
      unit('nk-cell', 'NK cell', 'The hunter of hidden things. Ignores plain bacteria.', ['Pops neutrophils carrying Herpes before they burst, and TB-infected macrophages.', `Lives ${C.nk.life} s. Costs ${C.marrow.nk}.`]),
      unit('macrophage-offense', 'Macrophage on Offense', `The swallower. Eats the nearest antigen in its zone, one every ${C.macrophage.eatEvery} s.`, ['Tears slime domes apart bite by bite.', "Can't swallow MRSA. <b>Swallowing TB infects it.</b>", `Never dies of age; only TB and toxin bursts kill it. At most ${C.caps.mac} at once. Costs ${C.marrow.mac}.`]),
      unit('macrophage-support', 'Macrophage on Support', 'The booster. Stays put with a ring around it.', [`Neutrophils inside move <b>${Math.round((C.support.speedMul - 1) * 100)}% faster</b> and fire <b>tuned shots</b>: one hit kills, and they pierce MRSA.`]),
    ].join('') + '<p>Each zone has its own response, the cells made for it (the cards at the bottom). New cells come out of the blood vessel along their zone and stay near it.</p>';
    if (tab === 'enemies') body = [
      unit('bacterium', 'Staph', `The grunt. Drifts toward the Lymph node and doubles every ${C.staph.doubling} s.`, [`${C.staph.hp} hits, 1 tuned hit, or one swallow.`]),
      unit('mrsa', 'MRSA', 'The tank. Armored, and macrophages spit it out.', [`<b>Tuned shots kill it in one hit.</b> Plain shots wear it down slowly (${C.mrsa.hp} hits), and it heals whenever it divides.`, 'Put a zone on Support where it is heading.']),
      unit('pseudomonas', 'Pseudomonas', `The builder. Settles after ${C.pseudo.settle} s and grows a slime dome.`, ['Everything under a dome is immune to shots, nets and storms.', 'Offense macrophages tear domes down.']),
      unit('flu', 'Influenza', 'Swarms. Tiny, fast, one hit kills.', [`Each flu that reaches the Tissue splits into ${C.flu.split}.`, 'Net neutrophils wipe out clusters.']),
      unit('spore', 'Clostridium spore', 'The time bomb. Inert and unhurtable.', [`Hatches ${C.spore.hatch} s after arriving into fast-dividing bacteria. The hatch is on the bar.`]),
      unit('tb', 'Tuberculosis', `The trojan horse. Slow and tough (${C.tb.hp} hits).`, ['A macrophage that swallows it turns into a TB factory until an NK cell kills it (or it burns out). Shots and nets ignore infected macrophages.']),
      unit('staph-toxic', 'Toxic-shock Staph', 'The drain.', [`While any live, fatigue builds ${C.toxic.fatigueMul}× as fast.`]),
      unit('strep-link', 'Strep chain', 'Rushers. Chains sprint for the Lymph node.', ['Shooting a link splits the chain; tuned shots and swallows do not.']),
      unit('yeast', 'Candida (fungus)', `The creeper. Settles after ${C.fungus.settle} s and grows threads (hyphae) toward the Lymph node.`, ['Germs on a thread ride it ' + C.fungus.highway + '× faster. Threads in the Lymph node fill its timer.', '<b>Shots pass through threads.</b> Net neutrophils cut them, and everything past the cut withers. Offense macrophages chew the tips slowly.', 'Loose yeast can be shot or swallowed. Thread tips bud new yeast.']),
      unit('herpes', 'Herpes', 'The sleeper. Hides inside your neutrophils.', [`Infected neutrophils flicker lilac and burst into ${C.herpes.burst} after ${C.herpes.incubate} s. NK cells pop them first.`]),
      unit('tapeworm-head', 'Tapeworm', 'The boss. Crawls from the Wound to the Lymph node.', [`Too big to swallow. Tuned shots hit ${C.worm.tunedDamage}× harder. Each broken segment becomes a small fast worm.`]),
      unit('toxin-burst', 'Quorum burst', `Staph counts its neighbours. When ${CONFIG.quorum.n} or more Staph-family germs crowd together, a red bubble forms around the crowd, and if it's still that big after ${CONFIG.quorum.fuse} s it pops. The crowd's bubble pulls nearby Staph in, and a yellow wick burns down around it.`, [`The pop kills every one of your cells within ${CONFIG.quorum.pop} units, and about half the germs at its core.`, 'Thin a glowing crowd to stop it: Nets, more neutrophils in that zone, or Offense macrophages. Big Staph waves can land at quorum.']),
      unit('bacterium', 'Evolution', `Germs adapt to how you kill them. A few seconds before each wave, any bacterium or fungus that died mostly one way (${pctOf(CONFIG.evolve.share)} or more of its kills) evolves the counter, and everything of that kind arriving from then on carries it, offspring too.`, ['Mostly shot: <b style="color:#FFD23F">thick wall</b>, plain shots need an extra hit. Mostly swallowed: <b style="color:#7FF3FF">capsule</b>, two gulps. Mostly netted: <b style="color:#B9F27C">slick coat</b>, Nets do half. Mostly stormed: <b style="color:#B07CFF">hardy core</b>, the storm kills half as many.', `A ring in that colour marks an evolved germ. At most ${CONFIG.evolve.max} traits per kind per level. Mix your kills and nothing evolves.`]),
    ].join('');
    if (tab === 'controls') body = `
      <ol class="howto">
        <li><b>Production cards</b> (bottom): one per zone. Tap one to open a slider for each cell type; moving one shares out the rest so the response stays at 100%. Each slider has <b>0%</b> and <b>100%</b> buttons: 100% makes only that type, 0% hands its share to the others. <b>Apply to all zones</b> copies the response to every zone (stances and On/Off stay). <b>Responses</b> 1-3 keep one you like (Save, or hold the slot) and apply it with a tap; they're kept between matches. Each zone gets a third of the new cells. Switch a zone <b>Off</b> in its card to stop making cells there; its share goes to the zones still on.</li>
        <li><b>Tap a zone</b> on the map (or use the switch in its card) to flip it between Offense and Support.</li>
        <li><b>Stress</b> slider: ${Math.round(C.output.min * 100)}% to ${Math.round(C.output.max * 100)}%. More stress makes cells faster, with diminishing returns: 200% stress makes 1.5× the cells. A hurt heart caps it. Above ${Math.round(C.output.rest * 100)}% fatigue builds; below it your body recovers. The heart shows fatigue: it fills and beats faster as you tire. Tired at ${C.fatigue.tired} (cells move slower), Feverish at ${C.fatigue.feverish} (shots spray, neutrophils die sooner), Exhausted at ${C.fatigue.exhausted} (Support rings shrink). Running hot has an upside: <b>fever slows division</b>, so bacteria divide at ${pctOf(C.fever.tired)}, ${pctOf(C.fever.feverish)} and ${pctOf(C.fever.exhausted)} of their speed in those states (viruses don't care).</li>
        <li><b>Overload</b>: fatigue can go past 100, up to ${C.fatigue.max}. Up there every organ loses health each second, faster the further over you are, but you also recover ${C.organs.overRecover}× faster.</li>
        <li><b>Organs</b>: heart, kidneys, lungs, liver, spleen and brain, 4 bars each, in the button by the fatigue label (key O). Each whole bar lost adds a penalty; any organ at 0 is Host failure. Germs in the Lymph node hurt one organ each (Staph the spleen, MRSA the heart, Influenza the lungs, Herpes the brain…), shown as clocks on the Lymph node ring. The liver and lungs heal a bar every ${C.organs.heal} s while you're Fine; the rest don't heal during a match. Tap the button for Organ status (it pauses).</li>
        <li><b>Storm</b>: hold the button for ${C.storm.charge} s to charge it (the heart shows where fatigue would land), then release to fire. Letting go early or sliding off cancels. After a ${C.storm.windup} s wind-up it kills about ${Math.round(C.storm.kill * 100)}% of antigens and ${Math.round(C.storm.friendly * 100)}% of your neutrophils, stuns macrophages, and adds ${C.storm.cost} fatigue plus ${C.storm.after} s of afterburn. Past 100 that hurts your organs: the heart turns orange if you'd lose some bars, red with a crack if an organ would fail.</li>
        <li><b>Speed</b>: the 1× button at the top cycles 1×, 2×, 3× (key F).</li>
        <li><b>Power buttons</b>: each sector has a power button in its bottom-right corner on the map. Tap it to stop making cells there (green = on, grey dashed = off); its share goes to the zones still on. One zone always stays on.</li>
        <li><b>Zoom</b>: double-tap a sector on the map to watch it up close. Double-tap again, tap the chip at the top, or press Esc to zoom back out. It's for watching only: a single tap still flips the zone's stance.</li>
        <li><b>Sound</b>: the speaker button at the top mutes music and sound effects (key M). It remembers your choice.</li>
        <li><b>Pause</b>: the II button, or Space. Keyboard: <b>1 2 3 4</b> flip zones, <b>-</b> / <b>=</b> stress, hold <b>S</b> to charge the storm, <b>Shift+1/2/3</b> apply a saved response to the open zone (or every zone when no card is open).</li>
      </ol>`;
    return `
      <span class="eyebrow">Guide</span>
      <div class="tabs">${tabs.map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${n}</button>`).join('')}</div>
      <div class="gsec">${body}</div>
      <div class="btnrow"><button class="btn primary" id="guideClose" type="button">${guideFrom === 'start' ? 'Back' : 'Resume'}</button></div>`;
  }
  function showGuide(from, tab) {
    guideFrom = from;
    openModal('guide', guideHtml(tab));
    $('#mbox').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showGuide(from, b.dataset.tab)));
    const clips = [...$('#mbox').querySelectorAll('[data-clip]')];
    if (clips.length) {
      clips.forEach(b => b.addEventListener('click', () => {
        const all = clips.map(x => x.dataset.clip);
        playClips(all, { eyebrow: 'How to play', start: all.indexOf(b.dataset.clip), doneLabel: 'Back to guide' }, () => showGuide(from, 'howto'));
      }));
      TUT.ready().then(() => { if (modal === 'guide') clips.forEach(b => { try { TUT.drawFrame(b.querySelector('canvas'), b.dataset.clip, TUT.CLIPS[b.dataset.clip].dur * 0.6); } catch (e) { /* thumbnail only */ } }); }).catch(() => {});
    }
    $('#guideClose').addEventListener('click', () => { if (guideFrom === 'start') showStart(); else closeModal(); });
  }
  const hostFail = r => r.cause === 'host' || r.cause === 'storm';
  function showEnd() {
    const r = game.result, s = r.stats;
    if (r.win && r.stars > (best[levelKey] || 0)) { best[levelKey] = r.stars; store.set('immuneRtsV3.best', best); }
    const nextKey = LEVEL_ORDER[LEVEL_ORDER.indexOf(levelKey) + 1];
    openModal('end', `
      <span class="eyebrow">${esc(game.lv.name)} · ${fmt(r.t)}</span>
      ${hostFail(r) ? '<img class="emblem" data-art="organ-failure" alt="">' : ''}
      <h2>${r.win ? '<span class="glow">Infection cleared</span>' : hostFail(r) ? '<span class="bad">Host failure</span>' : '<span class="bad">The infection took hold</span>'}</h2>
      <p>${r.reason}</p>
      ${r.win ? `<div class="stars">${[0, 1, 2].map(i => `<img data-art="${i < r.stars ? 'star' : 'star-empty'}" alt="">`).join('')}</div>` : ''}
      <ul class="goals">${r.goals.map(g => `<li class="${g.hit ? 'hit' : ''}">${g.text}</li>`).join('')}</ul>
      <div class="stats">
        <div><b>${s.shotKills}</b><span>shot down</span></div>
        <div><b>${s.swallows}</b><span>swallowed</span></div>
        <div><b>${s.netKills}</b><span>caught in nets</span></div>
        <div><b>${s.stormKills}</b><span>killed by storms</span></div>
        <div><b>${s.toxinDeaths}</b><span>cells lost to toxin</span></div>
        <div><b>${s.peak}</b><span>most antigens at once</span></div>
        <div><b>${Math.round(r.peakTimer * 100)}%</b><span>timer peak</span></div>
        <div><b>${Math.round(r.fatiguePeak)}</b><span>fatigue peak</span></div>
        <div><b>${s.made}</b><span>cells made</span></div>
      </div>
      <canvas id="graph" aria-label="Antigens in each zone over the match"></canvas>
      <div class="legend"><span style="--c:${PAL.germ}">Wound</span><span style="--c:${PAL.antibody}">Tissue</span><span style="--c:${PAL.cell}">Deep tissue</span><span style="--c:${PAL.damage}">Lymph node</span><span style="--c:rgba(180,92,255,.5)">toxin burst</span></div>
      <div class="btnrow">${r.win && nextKey ? `<button class="btn primary" id="next" type="button">Next: ${esc(LEVELS[nextKey].name)}</button>` : ''}<button class="btn ${r.win && nextKey ? '' : 'primary'}" id="again" type="button">Play again</button><button class="btn" id="levelsBtn" type="button">Levels</button></div>
      <button class="linkbtn" id="fbEnd" type="button">Send feedback with a log of this fight</button>`);
    drawGraph();
    if ($('#next')) $('#next').addEventListener('click', () => { levelKey = nextKey; store.set('immuneRtsV3.level', levelKey); newGame(); showStart(); });
    $('#again').addEventListener('click', () => { closeModal(); newGame(); });
    $('#levelsBtn').addEventListener('click', () => { newGame(); showStart(); });
    $('#fbEnd').addEventListener('click', () => showFeedback('end'));
  }
  function drawGraph() {
    const c = $('#graph'), r = c.getBoundingClientRect(), k = Math.min(3, window.devicePixelRatio || 1);
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext('2d'); g.scale(k, k);
    const W = r.width, H = r.height, padL = 26, padB = 16, h = game.history;
    const T = Math.max(game.duration, game.t), maxY = Math.max(10, ...h.map(p => Math.max(...p.z)));
    const X = t => padL + (W - padL - 4) * t / T, Y = v => (H - padB) - (H - padB - 6) * v / maxY;
    g.font = `10px ${MONO}`; g.fillStyle = PAL.uiDim; g.strokeStyle = 'rgba(221,230,245,0.12)'; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of [0, Math.round(maxY / 2), maxY]) { g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(W, Y(v)); g.stroke(); g.fillText(v, padL - 4, Y(v)); }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= T; t += 60) { g.textAlign = X(t) > W - 20 ? 'right' : 'center'; g.fillText(fmt(t), Math.min(X(t), W), H - padB + 3); }
    g.fillStyle = 'rgba(180,92,255,0.5)';
    for (const tx of game.toxins) g.fillRect(X(tx.at) - 1, 4, 2, H - padB - 4);
    [PAL.germ, PAL.antibody, PAL.cell, PAL.damage].forEach((col, z) => {
      g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      h.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, X(p.t), Y(p.z[z])));
      g.stroke();
    });
  }

  // ---- feedback: notes plus a log of the whole fight, shared through the share sheet ----
  const FB_TAGS = ['Fun', 'Too hard', 'Too easy', 'Confusing', 'Too chaotic', 'Too slow', 'Bug'];
  let fbTags = new Set(), fbNotes = '';
  function fightSummary(g) {
    const r = g.result, L = g.log, lines = [];
    lines.push(`${g.lv.name}, seed ${g.seed}: ${r ? `${r.win ? `won with ${r.stars} star${r.stars === 1 ? '' : 's'}` : 'lost'} at ${fmt(r.t)}. ${r.reason}` : `still going at ${fmt(g.t)}`}`);
    const n = a => L.inputs.filter(i => i.a === a).length;
    lines.push(`Inputs: ${n('mix')} response changes, ${n('mode')} Offense/Support flips, ${n('output')} stress changes, ${n('storm')} storms, ${n('speed')} speed changes`);
    const sum = {};
    for (const h of g.history) for (const k in h.d) sum[k] = (sum[k] || 0) + h.d[k];
    for (const k in g.tally) sum[k] = (sum[k] || 0) + g.tally[k];
    const by = (pre, i) => { const o = {}; for (const k in sum) if (k.startsWith(pre)) { const p = k.split('.')[i]; o[p] = (o[p] || 0) + sum[k]; } return o; };
    const list = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
    lines.push(`Antigens killed by: ${list(by('kill.', 1))}`);
    lines.push(`Antigens that showed up (waves, trickle, divisions): ${list(by('in.', 1))}`);
    lines.push(`Your cells made: ${list(by('made.', 1))}; lost to: ${list(by('lost.', 2))}`);
    lines.push(`Fatigue peak ${Math.round(g.fatiguePeak)}, fullest breach clock ${Math.round(g.lymph.peak * 100)}%, most antigens at once ${g.stats.peak}`);
    return lines;
  }
  function fightReport() {
    const g = game, r = g.result;
    return {
      game: 'Cytostorm', build: 'v3', format: 1, sent: new Date().toISOString(),
      device: { ua: navigator.userAgent, screen: `${screen.width}x${screen.height}`, layout: portrait ? 'portrait' : 'landscape' },
      level: g.key, levelName: g.lv.name, seed: g.seed,
      feedback: { tags: [...fbTags], notes: fbNotes },
      summary: fightSummary(g),
      tuning: tuningDiff(), customLevels: !!store.get('immuneRtsV3.levels'),
      result: r ? { win: r.win, reason: r.reason, cause: r.cause, t: +r.t.toFixed(1), stars: r.stars, stats: r.stats, peakTimer: r.peakTimer, fatiguePeak: Math.round(r.fatiguePeak), organs: Object.fromEntries(Object.entries(r.organs || {}).map(([k, v]) => [k, +v.toFixed(2)])) } : { inProgress: true, t: +g.t.toFixed(1) },
      start: g.startState(),
      inputs: g.log.inputs.map(({ key, ...i }) => i),
      events: g.log.events,
      samples: g.history,
      key: {
        inputs: 'a = mix (zone z production %, how = slider | allIn | set), mode (zone z Offense/Support), output (slider 0-1, mul = marrow multiplier), storm (fatigue when pressed), speed (game speed x)',
        samples: 'every 2 s: z = antigens per zone, ag = antigens by kind, cells = your cells by type, d = what happened since the last sample (in.kind spawned, kill.how.kind, made.type, lost.type.cause), timer = fullest breach clock 0-1, clocks = breach clock per organ, organs = bars left per organ',
      },
    };
  }
  function showFeedback(from) {
    const g = game; if (!g) return;
    const wasPaused = paused;
    openModal('feedback', `
      <span class="eyebrow">Send feedback · ${esc(g.lv.name)}${g.result ? '' : ` · ${fmt(g.t)}`}</span>
      <h2>How did that feel?</h2>
      <div class="chips">${FB_TAGS.map(t => `<button type="button" class="chip" aria-pressed="${fbTags.has(t)}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <label class="fbl" for="fbNotes">Anything else? What you tried, what felt off, what was fun.</label>
      <textarea id="fbNotes" rows="4" placeholder="The flu wave in the Tissue felt unfair because…">${esc(fbNotes)}</textarea>
      <p class="small">Your notes go out with a log of the whole fight: every tap, each wave, what died and how, and fatigue over time. Nothing is sent until you pick where it goes.</p>
      <div class="btnrow"><button class="btn primary" id="fbShare" type="button">Share</button><button class="btn" id="fbCopy" type="button">Copy</button><button class="btn" id="fbSave" type="button">Download</button></div>
      <textarea id="fbOut" rows="5" readonly hidden aria-label="Feedback and fight log"></textarea>
      <button class="linkbtn" id="fbBack" type="button">${from === 'end' ? 'Back to the results' : 'Back to the fight'}</button>`);
    $('#mbox').querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.tag; if (fbTags.has(t)) fbTags.delete(t); else fbTags.add(t);
      b.setAttribute('aria-pressed', fbTags.has(t));
    }));
    $('#fbNotes').addEventListener('input', e => { fbNotes = e.target.value; });
    const name = () => `cytostorm-${g.key}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    const text = () => JSON.stringify(fightReport(), null, 1);
    const shareText = () => [fbTags.size ? `Feedback: ${[...fbTags].join(', ')}` : '', fbNotes.trim(), ...fightSummary(g)].filter(Boolean).join('\n');
    const showOut = () => { const o = $('#fbOut'); o.hidden = false; o.value = text(); o.focus(); o.select(); toast('Select all and copy the text in the box'); };
    const copy = () => { const t = text(); try { navigator.clipboard.writeText(t).then(() => toast('Copied. Paste it into a message.', 'good'), showOut); } catch (e) { showOut(); } };
    const download = () => {
      try {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text()], { type: 'application/json' })); a.download = name();
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      } catch (e) { showOut(); }
    };
    $('#fbShare').addEventListener('click', async () => {
      const t = text();
      const files = [new File([t], name(), { type: 'application/json' }), new File([t], name().replace(/json$/, 'txt'), { type: 'text/plain' })];
      try {
        const f = navigator.canShare && files.find(x => navigator.canShare({ files: [x] }));
        if (f) { await navigator.share({ files: [f], title: 'Cytostorm feedback', text: shareText() }); toast('Thanks! Feedback shared.', 'good'); return; }
        if (navigator.share) { await navigator.share({ title: 'Cytostorm feedback', text: shareText() + '\n\n' + t }); toast('Thanks! Feedback shared.', 'good'); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      copy();
    });
    $('#fbCopy').addEventListener('click', copy);
    $('#fbSave').addEventListener('click', download);
    // Framed previews (like the artifact viewer) block downloads; the live site is not framed
    let framed = true; try { framed = window.self !== window.top; } catch (e) { /* cross-origin parent */ }
    $('#fbSave').hidden = framed;
    $('#fbBack').addEventListener('click', () => { if (from === 'end') showEnd(); else { closeModal(); setPaused(wasPaused); } });
  }

  // ---- game flow ----
  function newGame() {
    game = new Game(levelKey, seed);
    if (SPEEDS[speedIdx] !== 1) game.logInput({ a: 'speed', x: SPEEDS[speedIdx] }, 'speed');
    for (const k in spawnAcc) spawnAcc[k] = 0;
    paused = false; acc = 0; endShown = false; fbTags = new Set(); fbNotes = ''; parts = []; quorumPops = []; shake = 0; flashT = 0; collapseT = 0; stormHitT = 0; toasted.clear();
    zoomT = 0; zoomE = 0; $("#zoomOut").hidden = true;
    $('#pauseBtn').setAttribute('aria-label', 'Pause');
    $('#pauseCard').hidden = true; $('#devPause').textContent = 'Pause';
    closeSheet(); buildCards();
    hud();
  }

  let hudT = 0;
  const MAX_STEPS = 4; // catch-up cap per frame: a slow phone slows the game down instead of freezing
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (game && !paused && !modal && !game.result) {
      acc += dt * SPEEDS[speedIdx];
      let n = 0;
      while (acc >= STEP && n < MAX_STEPS) { devSpawn(STEP); game.step(STEP); acc -= STEP; n++; }
      if (n === MAX_STEPS) acc = 0;
    }
    if (game) {
      consumeFx();
      const pdt = paused || modal ? 0 : dt * SPEEDS[speedIdx];
      for (const p of parts) { p.life -= pdt; p.u += p.vu * pdt; p.v += p.vv * pdt; p.vu *= 0.92; p.vv *= 0.92; if (p.vr) p.rot += p.vr * pdt; }
      if (parts.length) parts = parts.filter(p => p.life > 0);
      shake = Math.max(0, shake - pdt * 2.5); flashT = Math.max(0, flashT - pdt); stormHitT = Math.max(0, stormHitT - pdt);
      if (game.result) collapseT += dt;
      if (game.result && !endShown) { hud(); endShown = true; sfx(game.result.win ? 'victory' : 'hostFailure'); setTimeout(showEnd, hostFail(game.result) ? 2100 : 700); }
    }
    render(now);
    soundTick(now);
    drawProg();
    stepCharge(now);
    if (game) drawHeart(paused || modal ? 0 : dt, now / 1000);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; hud(); }
    requestAnimationFrame(frame);
  }

  // ---- sound: no sound for button taps or the Organ status window (Alex). audio/cytosound.js (owned by the audio thread) is inlined as window.CytoAudio; every call is a no-op without it ----
  const AU = window.CytoAudio || null, MUTE_KEY = 'cytostormV3.muted';
  let auOn = false, auDanger = 0, auTrack = null;
  // left-right pan from where it happened on screen
  const panX = f => { if (f.u == null) return 0.5; const [x] = P(f.u, f.v); return Math.max(0, Math.min(1, (vox + x * vs * SX) / (cssW || 1))); };
  function sfx(moment, f) { if (AU && auOn) AU.play(moment, { x: f ? panX(f) : 0.5 }); }
  // iPhone only starts audio inside a tap, so every tap or key retries until it runs
  function soundUnlock() { if (AU && AU.unlock()) auOn = true; }
  for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(t, soundUnlock, { capture: true, passive: true });
  function setMuted(on) {
    if (!AU) return;
    AU.mute(on); store.set(MUTE_KEY, AU.muted);
    const b = $('#muteBtn'); b.classList.toggle('off', AU.muted);
    b.setAttribute('aria-label', AU.muted ? 'Sound off, tap to turn it on' : 'Sound on, tap to mute'); b.title = AU.muted ? 'Sound off (M)' : 'Sound on (M)';
  }
  if (AU) setMuted(!!store.get(MUTE_KEY)); else $('#muteBtn').hidden = true;
  function soundFx(fxs) {
    if (!AU || !auOn) return;
    let pops = 0;
    for (const f of fxs) {
      switch (f.k) {
        case 'pop': if (!f.storm && ++pops <= 3) sfx('kill', f); break;
        case 'gulp': sfx('swallow', f); break;
        case 'hatch': case 'virusBurst': case 'burst': sfx('burst', f); break;
        case 'net': sfx('net', f); break;
        case 'nkPop': sfx('nk', f); break;
        case 'divide': case 'split': sfx('divide', f); break;
        case 'organLevel': if (f.level > 0) sfx('organHit'); break; // a full breach clock is heard here; clocks filling stay silent (Alex)
        case 'wave': if (AU && auOn) AU.play('waveStart', { x: panX(f), final: !!f.final }); break;
      }
    }
    if (pops >= 6) sfx('burst');
  }
  // music, heartbeat and danger follow the match; new neutrophil shots are spotted here (sim.js has no shot event)
  function soundTick(now) {
    if (!AU || !auOn) return;
    const g = game, live = !!(g && !g.result), run = live && !paused && !modal;
    const track = live ? 'blood' : null;
    if (track !== auTrack) { auTrack = track; AU.music(track, track ? 0 : null); }
    AU.heartbeat(run ? (g.fatigue > 100 ? 'overload' : ['fine', 'tired', 'feverish', 'exhausted'][g.tier] || 'fine') : null);
    if (!run) return;
    let n = 0;
    for (const s of g.shots) if (!s.snd) { s.snd = 1; if (n++ < 2) sfx('shot', s); }
    if (now - auDanger > 250) {
      auDanger = now;
      let germs = 0; for (const z of g.zones) germs += z.count;
      AU.danger({ germs, progress: Math.min(1, g.t / g.duration), cells: g.cells.length, fatigue: g.fatigue, breach: g.lymph.timer, organMin: Math.min(...ORGAN_KEYS.map(k => g.organLevel(k))) });
    }
  }

  // ---- input ----
  function tapZone(z) {
    if (!game || game.result) return;
    game.toggleZone(z);
    const zn = game.zones[z];
    toast(`${zn.name}: ${zn.mode === 'support' ? 'Support' : 'Offense'}`, zn.mode === 'support' ? 'good' : '');
    hud();
  }
  let tapT = 0, tapX = 0, tapY = 0, tapTimer = null;
  document.querySelectorAll('.zpwr').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); powerTap(+b.dataset.pz); }));
  $('#zoomOut').addEventListener('click', zoomOut);
  cv.addEventListener('pointerdown', e => {
    if (!game || modal) return;
    if (openZone >= 0) { closeSheet(); return; }
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left - vox) / (vs * SX), y = (e.clientY - r.top - voy) / vs;
    if (x < 0 || y < 0 || x > VW || y > VH) return;
    // a single tap flips the zone's stance; a double tap zooms in or out instead (so the first tap waits a moment)
    const now = performance.now();
    if (tapTimer && now - tapT < 320 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 40) {
      clearTimeout(tapTimer); tapTimer = null;
      if (zoomT) zoomOut(); else zoomTo(x, y);
      return;
    }
    tapT = now; tapX = e.clientX; tapY = e.clientY;
    const z = zoneOf(portrait ? y : x);
    clearTimeout(tapTimer); tapTimer = setTimeout(() => { tapTimer = null; tapZone(z); }, 300);
  });
  function setPaused(p) {
    paused = p; $('#pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    $('#pauseCard').hidden = !paused;
    $('#devPause').textContent = paused ? 'Resume' : 'Pause';
  }
  $('#pauseBtn').addEventListener('click', () => setPaused(!paused));
  $('#resumeBtn').addEventListener('click', () => setPaused(false));
  $('#fbPause').addEventListener('click', () => showFeedback('pause'));
  $('#output').addEventListener('input', e => { if (game) { game.setOutput(+e.target.value / 100); hud(); } });
  $('#muteBtn').addEventListener('click', () => setMuted(!AU.muted));
  $('#helpBtn').addEventListener('click', () => { if (modal === 'guide') return; if (!modal) showGuide('game', 'units'); });
  window.addEventListener('keyup', e => { if (e.key === 's' || e.key === 'S') stormEnd(true); });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); if (!modal) setPaused(!paused); }
    if (!game || modal) return;
    if (e.shiftKey && /^Digit[123]$/.test(e.code)) { applyLoadout(+e.code.slice(5) - 1, openZone); return; } // Shift+1/2/3: loadout to the open zone, or every zone
    if (e.key >= '1' && e.key <= String(NZ)) tapZone(+e.key - 1);
    if (e.key === '-' || e.key === '_') game.setOutput(game.output - 0.1);
    if (e.key === '=' || e.key === '+') game.setOutput(game.output + 0.1);
    if ((e.key === 's' || e.key === 'S') && !e.repeat) stormStart();
    if (e.key === 'f' || e.key === 'F') $('#ffBtn').click();
    if (e.key === 'o' || e.key === 'O') showBody();
    if (e.key === 'm' || e.key === 'M') setMuted(!AU.muted);
    if (e.key === 'Escape') { if (openZone < 0 && zoomT) zoomOut(); closeSheet(); }
  });

  // ---- dev tools ----
  $('#devBtn').addEventListener('click', () => { $('#dev').hidden = !$('#dev').hidden; });
  $('#devClose').addEventListener('click', () => { $('#dev').hidden = true; });
  // Game speed: more sim steps per frame, same physics. The top-bar button cycles 1x, 2x, 3x; the dev slider goes further.
  function setSpeed(i) {
    speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, i));
    $('#speed').value = speedIdx; $('#speedVal').textContent = `${SPEEDS[speedIdx]}×`;
    if (game) game.logInput({ a: 'speed', x: SPEEDS[speedIdx] }, 'speed');
    hud();
  }
  const FF = [1, 2, 3];
  $('#ffBtn').addEventListener('click', () => { const i = FF.indexOf(SPEEDS[speedIdx]); setSpeed(SPEEDS.indexOf(FF[(i + 1) % FF.length])); });
  $('#speed').addEventListener('input', e => setSpeed(+e.target.value));
  $('#devPause').addEventListener('click', () => setPaused(!paused));
  $('#devStep').addEventListener('click', () => { if (game && !game.result) for (let i = 0; i < 60; i++) game.step(STEP); });
  $('#devSkip').addEventListener('click', () => { if (game && !game.result) for (let i = 0; i < 900 && !game.result; i++) game.step(STEP); });
  $('#seed').addEventListener('change', e => { seed = Math.max(1, Math.floor(+e.target.value || 1)); store.set('immuneRtsV3.seed', seed); });
  $('#devRestart').addEventListener('click', () => { closeModal(); newGame(); });
  $('#devNewSeed').addEventListener('click', () => { seed = 1 + Math.floor(Math.random() * 9999); $('#seed').value = seed; store.set('immuneRtsV3.seed', seed); closeModal(); newGame(); });
  $('#cheatKind').innerHTML = Object.keys(KINDS).filter(k => k !== 'clos' && k !== 'wormlet').map(k => `<option value="${k}">${esc(KINDS[k].name)}</option>`).join('');
  $('#cheatSpawn').addEventListener('click', () => {
    if (!game) return;
    const k = $('#cheatKind').value;
    if (k === 'strep') game.spawnChain('strep', CONFIG.strep.links, WOUND.u + 30, WOUND.v);
    else if (k === 'worm') game.spawnChain('worm', CONFIG.worm.segments, WOUND.u + 60, WOUND.v);
    else for (let i = 0; i < 10; i++) game.spawnAg(k, null, null, k === 'spore' ? { hatchAt: game.t + CONFIG.spore.hatch } : null);
  });
  // Extra antigens per second (dev): one slider per kind plus an overall multiplier, fed in sim time
  const SPAWN_KINDS = Object.keys(KINDS).filter(k => k !== 'clos' && k !== 'wormlet');
  const spawnRate = Object.fromEntries(SPAWN_KINDS.map(k => [k, 0])), spawnAcc = {};
  let spawnMul = 1;
  const rateUnit = k => k === 'strep' || k === 'worm' ? 'chains/s' : '/s';
  $('#spawnRates').innerHTML = [`<label class="row" for="sr-mul"><span>Overall <b id="srv-mul">1×</b></span></label><input type="range" id="sr-mul" min="0" max="10" step="0.25" value="1">`]
    .concat(SPAWN_KINDS.map(k => `<label class="row" for="sr-${k}"><span>${esc(KINDS[k].name)} <b id="srv-${k}">0</b></span></label><input type="range" id="sr-${k}" min="0" max="${k === 'worm' ? 1 : k === 'strep' ? 4 : 20}" step="${k === 'worm' ? 0.05 : 0.25}" value="0">`)).join('');
  function spawnLabels() {
    $('#srv-mul').textContent = `${spawnMul}×`;
    for (const k of SPAWN_KINDS) $(`#srv-${k}`).textContent = spawnRate[k] ? `${+(spawnRate[k] * spawnMul).toFixed(2)} ${rateUnit(k)}` : '0';
  }
  function logSpawn() { if (game) game.logInput({ a: 'devSpawn', mul: spawnMul, rates: Object.fromEntries(SPAWN_KINDS.filter(k => spawnRate[k]).map(k => [k, spawnRate[k]])) }, 'devSpawn'); }
  $('#sr-mul').addEventListener('input', e => { spawnMul = +e.target.value; spawnLabels(); logSpawn(); });
  for (const k of SPAWN_KINDS) $(`#sr-${k}`).addEventListener('input', e => { spawnRate[k] = +e.target.value; spawnLabels(); logSpawn(); });
  $('#spawnReset').addEventListener('click', () => { for (const k of SPAWN_KINDS) { spawnRate[k] = 0; $(`#sr-${k}`).value = 0; } spawnLabels(); logSpawn(); });
  function devSpawn(dt) {
    const g = game; if (!g || g.result || !spawnMul) return;
    for (const k of SPAWN_KINDS) {
      if (!spawnRate[k]) continue;
      spawnAcc[k] = (spawnAcc[k] || 0) + spawnRate[k] * spawnMul * dt;
      while (spawnAcc[k] >= 1) {
        spawnAcc[k] -= 1;
        const u = WOUND.u + (Math.random() - 0.5) * 60, v = WOUND.v + (Math.random() - 0.5) * 160;
        if (k === 'strep') g.spawnChain('strep', CONFIG.strep.links, WOUND.u + 30, v);
        else if (k === 'worm') g.spawnChain('worm', CONFIG.worm.segments, WOUND.u + 60, WOUND.v);
        else g.spawnAg(k, u, v, k === 'spore' ? { hatchAt: g.t + CONFIG.spore.hatch } : null);
      }
    }
  }
  $('#cheatClear').addEventListener('click', () => { if (game) for (const b of game.ag) if (!b.eaten) { b.dead = true; game.fx.push({ k: 'pop', u: b.u, v: b.v }); } });
  $('#cheatCalm').addEventListener('click', () => { if (game) game.fatigue = 0; });
  $('#ovRange').addEventListener('change', e => { overlay.range = e.target.checked; });

  const human = k => k.replace(/([A-Z])/g, ' $1').toLowerCase();
  function stepFor(v) { const a = Math.abs(v); return a === 0 ? 0.001 : Math.pow(10, Math.floor(Math.log10(a)) - 1); }
  function buildTuning() {
    const host = $('#tuning'); host.innerHTML = '';
    for (const grp in DEFAULTS) {
      const det = document.createElement('details');
      det.innerHTML = `<summary>${human(grp)}</summary>`;
      for (const key in DEFAULTS[grp]) {
        const def = DEFAULTS[grp][key], id = `t-${grp}-${key}`;
        const f = document.createElement('div'); f.className = 'field';
        f.innerHTML = `<label class="row" for="${id}"><span>${human(key)}</span><input type="number" id="${id}" step="${stepFor(def)}"></label>`;
        const hint = HINTS[`${grp}.${key}`];
        if (hint) f.insertAdjacentHTML('beforeend', `<small>${hint}</small>`);
        det.appendChild(f);
        const inp = f.querySelector('input');
        inp.value = CONFIG[grp][key];
        const mark = () => inp.classList.toggle('changed', +inp.value !== def);
        mark();
        inp.addEventListener('input', () => {
          const v = parseFloat(inp.value); if (!isFinite(v)) return;
          CONFIG[grp][key] = v; mark(); saveTuning();
          buildGraphics();
        });
      }
      host.appendChild(det);
    }
  }
  function tuningDiff() {
    const out = {};
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) if (DEFAULTS[g][k] !== CONFIG[g][k]) (out[g] = out[g] || {})[k] = CONFIG[g][k];
    return out;
  }
  function saveTuning() { store.set('immuneRtsV3.tuning', tuningDiff()); }
  $('#tuneReset').addEventListener('click', () => {
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) CONFIG[g][k] = DEFAULTS[g][k];
    saveTuning(); buildTuning(); buildGraphics();
  });
  $('#tuneCopy').addEventListener('click', () => {
    const txt = JSON.stringify(tuningDiff(), null, 1), ta = $('#devJson');
    ta.value = txt; ta.hidden = false;
    const fallback = () => { ta.focus(); ta.select(); };
    try { navigator.clipboard.writeText(txt).then(() => toast('Tuning copied'), fallback); } catch (e) { fallback(); }
  });

  // ---- boot ----
  document.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
  buildTuning();
  $('#seed').value = seed;
  { const O = CONFIG.output; $('#output').style.setProperty('--track', ART.outputTrackCSS(Math.log(O.rest / O.min) / Math.log(O.max / O.min))); }
  ART.loadAll().then(() => {
    Object.assign(img, ART.ready);
    resize();
    new ResizeObserver(resize).observe(stage);
  });
  newGame();
  showStart();
  requestAnimationFrame(frame);
})();

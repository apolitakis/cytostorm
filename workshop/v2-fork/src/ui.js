'use strict';
// ---------------------------------------------------------------------------
// Immune RTS mechanics workshop: rendering, input, HUD, guide and the
// workshop panel (combos, spawn rates, cheats, live readout, tuning).
// Forked from prototype/v2/src/ui.js on 2026-10-07. The sim works in
// (u along the flow, v across); on a tall stage the map is transposed.
// ---------------------------------------------------------------------------
(function () {
  const $ = s => document.querySelector(s);
  const STEP = 1 / 60;
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 8];
  const PAL = ART.palette;
  const KEY = 'immuneWorkshop.';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const artUrl = n => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.svg[n]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- saved workshop state ----
  mergeConfig(store.get('tuning'));
  let seed = store.get('seed') || 1;
  let dev = loadDev(store.get('dev'));
  let comboKey = store.get('combo') || 'mrsaDome';
  if (!COMBOS[comboKey]) comboKey = 'mrsaDome';
  function loadDev(saved) {
    const d = defaultDev();
    if (saved && typeof saved === 'object') {
      for (const k in d) if (k !== 'rates' && k !== 'friendly' && typeof saved[k] === typeof d[k]) d[k] = saved[k];
      for (const k in d.rates) if (saved.rates && typeof saved.rates[k] === 'number') d.rates[k] = saved.rates[k];
      for (const k in d.friendly) if (saved.friendly && typeof saved.friendly[k] === 'number') d.friendly[k] = saved.friendly[k];
    }
    return d;
  }
  const saveDev = () => store.set('dev', dev);

  let game = null;
  let paused = false, speedIdx = 2, acc = 0, last = 0;
  let modal = null; // 'start' | 'end' | 'guide' | null
  let endShown = false, guideFrom = null, resultAt = 0;
  let stormHeld = false;
  const overlay = { range: false, portrait: false };
  const seen = new Map(); // enemy kind -> first time seen this match (for banner hints)
  const once = new Set();

  // ---- canvas, view mapping, sprites ----
  const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage');
  const pcv = $('#prog'), pctx = pcv.getContext('2d');
  let dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
  let portrait = false, VW = L, VH = WIDTH;
  const P = (u, v) => (portrait ? [v, u] : [u, v]);
  const ang = a => (portrait ? Math.PI / 2 - a : a);
  const img = {}, spr = {};
  let bg = null;

  // World size of each sprite's box. All units are drawn at UNIT_SCALE of their v2 size so a crowded map still reads.
  const UNIT_SCALE = 0.62;
  const SPRITE_WORLD = {
    neutrophil: 64 * 8 / 13, 'neutrophil-trap': 64 * 8 / 13,
    'macrophage-offense': 64 * 15 / 22, 'macrophage-support': 64 * 15 / 22,
    bacterium: 64 * 5.5 / 9, 'bacterium-hit': 64 * 5.5 / 9, 'bacterium-dividing': 64 * 7 / 12, 'bacterium-complement': 64 * 5.5 / 9,
    'bacterium-armored': 64 * 9.5 / 19, 'bacterium-armored-dividing': 64 * 11 / 22,
    'hit-spark': 16, 'kill-shard': 7, 'storm-shard': 9,
  };
  // The roster art carries its own world radius
  for (const n of ['mrsa', 'flu', 'pseudomonas', 'tb', 'macrophage-infected', 'spore', 'spore-hatch', 'staph-toxic', 'strep-link', 'herpes', 'neutrophil-infected', 'tapeworm-head', 'tapeworm-small', 'neutrophil-net', 'nk-cell']) {
    const m = ART.meta[n]; if (m && m.worldR) SPRITE_WORLD[n] = m.size * m.worldR / m.radius;
  }
  const STRIP_WORLD = { shot: 22, 'shot-tuned': 30, 'speed-trail': 34, 'tapeworm-segment': 48 * 15 / 19 };
  for (const n in SPRITE_WORLD) SPRITE_WORLD[n] *= UNIT_SCALE;
  for (const n in STRIP_WORLD) STRIP_WORLD[n] *= UNIT_SCALE;
  const TIER = ['Fine', 'Tired', 'Feverish', 'Exhausted'];
  // Census icons and names per enemy kind
  const ICON = { staph: 'bacterium', armored: 'bacterium-armored', mrsa: 'mrsa', flu: 'flu', pseudo: 'pseudomonas', tb: 'tb', spore: 'spore', clos: 'bacterium-complement', toxic: 'staph-toxic', strep: 'strep-link', herpes: 'herpes', worm: 'tapeworm-head', wormlet: 'tapeworm-small' };
  const SPAWN_ICON = { staph: 'bacterium', mrsa: 'mrsa', flu: 'flu', pseudo: 'pseudomonas', tb: 'tb', spore: 'spore', toxic: 'staph-toxic', strep: 'strep-link', herpes: 'herpes', worm: 'tapeworm-head' };
  const FRIEND_ICON = { neut: 'neutrophil', mac: 'macrophage-offense', net: 'neutrophil-net', nk: 'nk-cell' };
  const HINT = {
    mrsa: '<b>MRSA.</b> Plain shots bounce and macrophages spit it out. Only tuned shots from a Support ring kill it.',
    flu: '<b>Influenza swarm.</b> One hit kills each, but every flu that reaches the Tissue becomes three. Net neutrophils wipe clusters.',
    pseudo: '<b>Pseudomonas.</b> It stops and grows a dome that blocks every shot. Offense macrophages tear domes down.',
    tb: '<b>Tuberculosis.</b> Tanky. A macrophage that swallows it gets infected and spits out more TB. Keep its zone on Support.',
    spore: '<b>Clostridium spores.</b> Nothing hurts them until they hatch together. Rest the slider now, push it right before they hatch.',
    toxic: '<b>Toxic-shock Staph.</b> While any are alive, fatigue builds twice as fast. Kill them early, or keep Body output low.',
    strep: '<b>Strep chains.</b> They sprint for the Lymph node, and killing a link splits the chain. Support in the Tissue or Offense in the Lymph node.',
    herpes: '<b>Herpes.</b> It hides inside your neutrophils (they flicker lilac) and bursts out 12 s later. NK cells pop infected cells first.',
    worm: '<b>Tapeworm.</b> Too big to swallow. Every segment you break sheds a small fast worm. Mass neutrophils and Support rings.',
  };

  function prerender(name, wWorld, hWorld) {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(wWorld * k)); c.height = Math.max(2, Math.ceil(hWorld * k));
    if (img[name]) c.getContext('2d').drawImage(img[name], 0, 0, c.width, c.height);
    return c;
  }
  function glowDot(name, color, worldR) {
    const px = Math.max(4, Math.ceil(worldR * 4 * scale * dpr)), c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, px, px);
    spr[name] = { c, w: worldR * 4, h: worldR * 4, ax: 0.5, ay: 0.5 };
  }
  function buildGraphics() {
    if (!img.tissue || !cssW) return;
    for (const n in SPRITE_WORLD) spr[n] = { c: prerender(n, SPRITE_WORLD[n], SPRITE_WORLD[n]), w: SPRITE_WORLD[n], h: SPRITE_WORLD[n], ax: 0.5, ay: 0.5 };
    for (const n in STRIP_WORLD) {
      const m = ART.meta[n], w = STRIP_WORLD[n], h = w * m.box[1] / m.box[0];
      spr[n] = { c: prerender(n, w, h), w, h, ax: m.anchor[0] / m.box[0], ay: m.anchor[1] / m.box[1] };
    }
    const ring = CONFIG.support.ring * 128 / 60;
    spr['support-ring'] = { c: prerender('support-ring', ring, ring), w: ring, h: ring, ax: 0.5, ay: 0.5 };
    const shock = 340 * 256 / 118;
    spr['toxin-shockwave'] = { c: prerender('toxin-shockwave', shock * 0.5, shock * 0.5), w: shock, h: shock, ax: 0.5, ay: 0.5 };
    const dome = 128 * CONFIG.pseudo.domeMax / 60;
    spr['biofilm-dome'] = { c: prerender('biofilm-dome', dome, dome), w: dome, h: dome, ax: 0.5, ay: 0.5 };
    const net = 64 * CONFIG.net.radius / 28;
    spr.net = { c: prerender('net', net, net), w: net, h: net, ax: 0.5, ay: 0.5 };
    glowDot('puff', 'rgba(63,230,255,0.8)', 3);
    glowDot('puffDim', 'rgba(63,230,255,0.35)', 3);
    glowDot('ember', 'rgba(255,61,203,0.9)', 2.5);
    glowDot('slimeDot', 'rgba(169,207,60,0.85)', 2.5);
    glowDot('virusDot', 'rgba(217,182,255,0.9)', 2);
    glowDot('puddle', 'rgba(150,200,40,0.55)', 5);
    buildBackground();
  }
  function buildBackground() {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.ceil(VW * k); c.height = Math.ceil(VH * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.globalAlpha = 0.45;
    const tw = 128, th = tw * img.tissue.naturalHeight / img.tissue.naturalWidth;
    for (let y = 0; y < VH; y += th) for (let x = 0; x < VW; x += tw) g.drawImage(img.tissue, x, y, tw + 0.5, th + 0.5);
    g.globalAlpha = 1;
    const vb = img['vessel-blood'], sw = 96, sh = VESSEL * 1.25;
    g.save();
    if (portrait) { g.translate(VESSEL * 1.1, 0); g.rotate(Math.PI / 2); }
    for (let x = 0; x < L; x += sw) g.drawImage(vb, x, -VESSEL * 0.15, sw + 0.5, sh);
    g.restore();
    const [wx, wy] = P(WOUND.u, WOUND.v);
    g.save(); g.translate(wx, wy); if (portrait) g.rotate(Math.PI / 2);
    g.globalAlpha = 0.9; g.drawImage(img.wound, -70, -35, 140, 70);
    g.restore();
    const [lx, ly] = P(L - 70, (WIDTH + VESSEL) / 2);
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 180);
    gr.addColorStop(0, 'rgba(47,184,154,0.16)'); gr.addColorStop(1, 'rgba(47,184,154,0)');
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    g.strokeStyle = 'rgba(221,230,245,0.16)'; g.lineWidth = 1.5 / scale; g.setLineDash([6 / scale, 6 / scale]);
    for (let z = 1; z < 3; z++) {
      const [x0, y0] = P(z * ZONE, VESSEL), [x1, y1] = P(z * ZONE, WIDTH);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.setLineDash([]);
    bg = c;
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    if (cssW < 2 || cssH < 2) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    portrait = overlay.portrait || cssH > cssW * 1.05;
    VW = portrait ? WIDTH : L; VH = portrait ? L : WIDTH;
    scale = Math.min(cssW / VW, cssH / VH);
    ox = (cssW - VW * scale) / 2; oy = (cssH - VH * scale) / 2;
    const pr = pcv.getBoundingClientRect();
    pcv.width = Math.round(pr.width * dpr); pcv.height = Math.round(pr.height * dpr);
    buildGraphics();
  }

  function draw(name, u, v, rot, alpha, mul, sx, sy) {
    const s = spr[name]; if (!s) return;
    const m = mul || 1, w = s.w * m * (sx || 1), h = s.h * m * (sy || 1);
    const [x, y] = P(u, v);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (rot != null || sx || sy) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang(rot || 0));
      ctx.drawImage(s.c, -w * s.ax, -h * s.ay, w, h);
      ctx.restore();
    } else ctx.drawImage(s.c, x - w * s.ax, y - h * s.ay, w, h);
  }

  // ---- particles (UI-only) ----
  let parts = [], shake = 0, flashT = 0;
  function burstParts(u, v, kind, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = speed * (0.5 + Math.random() * 0.7);
      parts.push({ u, v, vu: Math.cos(a) * sp, vv: Math.sin(a) * sp, life, max: life, kind, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 12 });
    }
  }
  function still(u, v, kind, life, mul, rot) { parts.push({ u, v, vu: 0, vv: 0, life, max: life, kind, rot: rot == null ? Math.random() * 6 : rot, mul }); }
  const throttle = new Map();
  function toastOnce(key, text, kind, every) {
    const now = performance.now();
    if (every == null) { if (once.has(key)) return; once.add(key); }
    else if (now - (throttle.get(key) || -1e9) < every * 1000) return;
    throttle.set(key, now);
    toast(text, kind);
  }
  function consumeFx() {
    const g = game;
    for (const f of g.fx.splice(0)) {
      switch (f.k) {
        case 'hit': still(f.u, f.v, 'hit-spark', 0.09); break;
        case 'bounce':
          still(f.u, f.v, 'hit-spark', 0.12, 0.8, 0);
          parts.push({ u: f.u, v: f.v, vu: f.du * 160, vv: f.dv * 160 + (Math.random() - 0.5) * 120, life: 0.18, max: 0.18, kind: 'shot', rot: Math.atan2(f.dv, f.du), mul: 0.6 });
          break;
        case 'absorb': still(f.u, f.v, 'slimeDot', 0.2, 0.8); break;
        case 'pop':
          still(f.u, f.v, 'hit-spark', 0.12, f.tuned ? 1.6 : 1.1, 0);
          burstParts(f.u, f.v, f.kind === 'flu' || f.kind === 'herpes' ? 'virusDot' : 'kill-shard', f.armored ? 7 : f.kind === 'flu' ? 3 : 5, 70, 0.45);
          break;
        case 'stormKill': burstParts(f.u, f.v, 'storm-shard', 3, 90, 0.6); break;
        case 'trickle': burstParts(f.u, f.v, 'ember', 2, 30, 0.4); break;
        case 'die': burstParts(f.u, f.v, 'puff', f.who === 'mac' ? 10 : 6, 60, 0.6); break;
        case 'expire': burstParts(f.u, f.v, 'puffDim', 3, 20, 0.5); break;
        case 'arrive': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.5, max: 0.5, kind: 'ring' }); break;
        case 'burst': shake = 1; flashT = 0.25; toast('Toxin burst!', 'toxin'); break;
        case 'wave':
          if (g.t > 0.5) toast((f.final ? 'Final wave: ' : 'Wave: ') + (f.armored ? `${f.n - f.armored} bacteria + ${f.armored} armored` : `${f.n} bacteria`), 'bad');
          burstParts(f.u, f.v, 'ember', 8, 50, 0.6);
          break;
        case 'breach': toast('Enemies reached the Lymph node', 'bad'); break;
        case 'tier': if (f.up) toast(['', 'Tired: your cells slow down', 'Feverish: shots spray, neutrophils die sooner', 'Exhausted: the marrow slows, rings shrink'][f.tier], f.tier >= 2 ? 'bad' : ''); else toast(`Fatigue easing: ${TIER[f.tier]}`, 'good'); break;
        case 'stormWindup': toast('Cytokine storm!', 'storm'); break;
        case 'stormHit': shake = 1.8; break;
        case 'stormEnd': toast('Afterburn over', 'good'); break;
        case 'nearLoss': toast(`No death: ${f.text}`, 'bad'); updateNearLog(); break;
        case 'hatch': still(f.u, f.v, 'spore-hatch', 0.3, 1.2); toastOnce('hatch' + Math.round(g.t), 'Spores hatched!', 'bad', 3); break;
        case 'dome': burstParts(f.u, f.v, 'slimeDot', 6, 30, 0.6); toastOnce('dome', 'Pseudomonas grew a dome. Shots can\'t get in.', 'bad'); break;
        case 'domeChew': burstParts(f.u, f.v, 'slimeDot', 5, 40, 0.5); break;
        case 'domePop': burstParts(f.u, f.v, 'slimeDot', 14, 70, 0.7); toastOnce('domePop', 'Dome torn down', 'good', 4); break;
        case 'spit': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.35, max: 0.35, kind: 'ring' }); break;
        case 'infect': burstParts(f.u, f.v, 'ember', 8, 40, 0.6); toastOnce('infect', 'A macrophage swallowed TB and is now spitting it out', 'bad', 5); break;
        case 'herpesBurst': burstParts(f.u, f.v, 'virusDot', 10, 60, 0.6); burstParts(f.u, f.v, 'puff', 4, 40, 0.5); toastOnce('hburst', 'An infected neutrophil burst open', 'bad', 5); break;
        case 'split': burstParts(f.u, f.v, 'virusDot', 3, 30, 0.4); break;
        case 'shed': burstParts(f.u, f.v, 'ember', 8, 60, 0.5); still(f.u, f.v, 'hit-spark', 0.15, 2, 0); break;
        case 'netBurst': still(f.u, f.v, 'neutrophil-trap', 0.35, 1.3); parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.4, max: 0.4, kind: 'ring', big: true }); break;
        case 'nkPop': burstParts(f.u, f.v, 'virusDot', 6, 50, 0.5); still(f.u, f.v, 'hit-spark', 0.12, 1.3, 0); break;
      }
    }
  }

  // ---- render ----
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, cv.width, cv.height);
    const g = game;
    if (!g || !bg) return;
    const ts = now / 1000, k = scale * dpr;
    const sh = shake > 0 ? shake * 6 : 0;
    const jx = sh ? (Math.random() - 0.5) * sh : 0, jy = sh ? (Math.random() - 0.5) * sh : 0;
    ctx.setTransform(k, 0, 0, k, (ox + jx) * dpr, (oy + jy) * dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
    ctx.drawImage(bg, 0, 0, VW, VH);

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

    // Toxin puddles, domes and nets sit on the floor, under the cells
    ctx.globalCompositeOperation = 'source-over';
    for (const p of g.puddles) draw('puddle', p.u, p.v, null, Math.min(1, p.life / p.max * 1.4) * 0.9, p.r / 10);
    const dm = CONFIG.pseudo.domeMax;
    for (const d of g.domes) draw('biofilm-dome', d.u, d.v, 0, 0.55 + 0.4 * d.hp / d.maxHp, d.r / dm, 1, 60 / 38);
    ctx.globalCompositeOperation = 'lighter';
    for (const w of g.webs) draw('net', w.u, w.v, null, Math.min(1, w.life / w.max * 1.5), 0.6 + 0.4 * w.life / w.max);
    const pulse = 1 + 0.03 * Math.sin(ts * 6.283 / 1.6);
    const ringMul = (g.ringR || CONFIG.support.ring) / CONFIG.support.ring;
    for (const m of g.mac) if (m.mode === 'support' && !m.infected) draw('support-ring', m.u, m.v, null, (0.7 + 0.3 * (pulse - 0.97) / 0.06) * (m.stun > 0 ? 0.35 : 1), pulse * ringMul);
    if (overlay.range) {
      ctx.strokeStyle = 'rgba(255,210,63,0.25)'; ctx.lineWidth = 1 / scale;
      for (const n of g.neut) { const [x, y] = P(n.u, n.v); ctx.beginPath(); ctx.arc(x, y, CONFIG.neutrophil.range, 0, 6.283); ctx.stroke(); }
    }

    // Enemies
    const sporeTags = new Map();
    for (const b of g.bact) {
      let a = 1, mul = 1;
      if (b.eaten) {
        const m = g.mac.find(mm => mm.prey === b);
        const f = m ? Math.max(0, m.gulp / CONFIG.macrophage.gulp) : 0;
        a = f; mul = 0.5 + 0.5 * f;
      }
      if (b.shield) a *= 0.8;
      const ready = b.age > b.div - 1.5;
      switch (b.kind) {
        case 'staph': draw(b.flash > 0 ? 'bacterium-hit' : ready ? 'bacterium-dividing' : 'bacterium', b.u, b.v, b.rot, a, mul); break;
        case 'armored': draw(ready ? 'bacterium-armored-dividing' : 'bacterium-armored', b.u, b.v, b.rot, a, mul); break;
        case 'mrsa': draw('mrsa', b.u, b.v, b.rot, a * (b.spitT > 0 ? 0.75 : 1), mul * (ready ? 1.12 : 1)); break;
        case 'flu': draw('flu', b.u, b.v, b.rot * 3, a, mul); break;
        case 'pseudo': draw(b.flash > 0 ? 'bacterium-hit' : 'pseudomonas', b.u, b.v, b.rot, a, mul); break;
        case 'tb': draw('tb', b.u, b.v, b.rot, a * (b.flash > 0 ? 0.6 : 1), mul); break;
        case 'spore': {
          const left = b.hatchAt - g.t, blink = left < 5 ? 0.55 + 0.45 * Math.sin(ts * 6.283 * (left < 2 ? 4 : 2)) : 0.85;
          draw('spore', b.u, b.v, b.rot, a * blink, mul);
          if (!sporeTags.has(b.hatchAt)) sporeTags.set(b.hatchAt, b);
          break;
        }
        case 'clos': draw(b.flash > 0 ? 'bacterium-hit' : 'bacterium-complement', b.u, b.v, b.rot, a, mul); break;
        case 'toxic': draw('staph-toxic', b.u, b.v, b.rot, a * (0.75 + 0.25 * Math.sin(ts * 6.283)), mul); break;
        case 'strep': draw('strep-link', b.u, b.v, b.rot, a * (b.flash > 0 ? 0.6 : 1), mul); break;
        case 'herpes': draw('herpes', b.u, b.v, b.rot * 2, a, mul); break;
        case 'worm':
          if (b.head) draw('tapeworm-head', b.u, b.v, b.rot, a, mul);
          else draw('tapeworm-segment', b.u, b.v, b.rot, a * (0.55 + 0.45 * b.hp / b.maxHp), mul);
          if (b.flash > 0) draw('hit-spark', b.u, b.v, 0, b.flash / 0.12, 1.4);
          break;
        case 'wormlet': draw('tapeworm-small', b.u, b.v, b.rot, a, mul); break;
      }
    }
    // Spore countdowns, one tag per clump
    if (sporeTags.size) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9;
      ctx.font = `500 ${10.5 / scale}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const [at, b] of sporeTags) {
        const left = Math.max(0, at - g.t), [x, y] = P(b.u, b.v - 10);
        ctx.fillStyle = left < 5 ? PAL.damage : PAL.wax || PAL.ui;
        ctx.fillText(`${Math.ceil(left)}s`, x, y);
      }
      ctx.globalCompositeOperation = 'lighter';
    }

    // Macrophages
    for (const m of g.mac) {
      if (m.infected) { draw('macrophage-infected', m.u, m.v, null, 1, 1 + 0.06 * Math.max(0, Math.sin(ts * 6.283 * 0.8))); continue; }
      const name = m.mode === 'support' ? 'macrophage-support' : 'macrophage-offense';
      const stunA = m.stun > 0 ? 0.55 : 1;
      if (m.gulp > 0 && m.prey) {
        const p = 1 - m.gulp / CONFIG.macrophage.gulp, s = Math.sin(p * Math.PI);
        draw(name, m.u, m.v, Math.atan2(m.prey.v - m.v, m.prey.u - m.u), stunA, 1, 1 + 0.3 * s, 1 - 0.12 * s);
      } else if (m.gulp > 0 && m.dome) {
        const p = 1 - m.gulp / CONFIG.macrophage.gulp, s = Math.sin(p * Math.PI);
        draw(name, m.u, m.v, Math.atan2(m.dome.v - m.v, m.dome.u - m.u), stunA, 1, 1 + 0.3 * s, 1 - 0.12 * s);
      } else draw(name, m.u, m.v, m.stun > 0 ? Math.sin(ts * 20) * 0.15 : null, stunA, m.cd > 0 ? 1.06 : 1);
      if (m.flip > 0) {
        const [x, y] = P(m.u, m.v), f = m.flip / 0.4;
        ctx.globalAlpha = f; ctx.strokeStyle = m.mode === 'support' ? PAL.repair : PAL.kill; ctx.lineWidth = 2 / scale;
        ctx.beginPath(); ctx.arc(x, y, 14 + 26 * (1 - f), 0, 6.283); ctx.stroke();
      }
    }

    // Neutrophils: speed trails when boosted; infected ones flicker lilac; fade as they age out
    const flick = Math.floor(ts / 0.3) % 2 === 0;
    for (const n of g.neut) {
      const h = Math.atan2(n.vv, n.vu);
      if (n.boosted && (n.vu * n.vu + n.vv * n.vv) > 100) draw('speed-trail', n.u, n.v, h, 0.9);
      const left = CONFIG.neutrophil.life - n.age;
      draw(n.infected > 0 && flick ? 'neutrophil-infected' : 'neutrophil', n.u, n.v, null, left < 3 && !dev.immortal ? 0.35 + 0.65 * Math.max(0, left) / 3 : 1);
    }
    for (const n of g.runners) draw('neutrophil-net', n.u, n.v, null, 1, 1 + (n.age > CONFIG.net.fuse - 2 ? 0.08 * Math.sin(ts * 30) : 0));
    for (const n of g.nk) draw('nk-cell', n.u, n.v, ts * 0.8 + n.id, CONFIG.nk.life - n.age < 3 && !dev.immortal ? 0.5 : 1);

    for (const s of g.shots) draw(s.tuned ? 'shot-tuned' : 'shot', s.u, s.v, Math.atan2(s.dv, s.du), 1);

    for (const p of parts) {
      const f = p.life / p.max;
      if (p.kind === 'ring') {
        const [x, y] = P(p.u, p.v);
        ctx.globalAlpha = f * 0.8; ctx.strokeStyle = p.big ? PAL.cellHi : PAL.cell; ctx.lineWidth = 1.5 / scale;
        ctx.beginPath(); ctx.arc(x, y, p.big ? 6 + CONFIG.net.radius * (1 - f) : 6 + 16 * (1 - f), 0, 6.283); ctx.stroke();
      } else if (p.kind === 'hit-spark' || p.kind === 'shot') draw(p.kind, p.u, p.v, p.rot, f, p.mul || 1);
      else draw(p.kind, p.u, p.v, p.rot, f, p.mul || 1);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (flashT > 0) { ctx.fillStyle = `rgba(180,92,255,${flashT * 0.6})`; ctx.fillRect(zr[0], zr[1], zr[2], zr[3]); }
    ART.drawFatigueEdge(ctx, VW, VH, g.tier, ts);
    if (g.storm.phase) ART.drawStorm(ctx, VW, VH, { phase: g.storm.phase, p: g.storm.p, t: ts, ox: VW / 2, oy: VH });
    if (g.result && g.result.why === 'collapse') ART.drawCollapse(ctx, VW, VH, Math.min(1, (now - resultAt) / 2000));
    ctx.restore();

    if (paused && !modal) {
      ctx.fillStyle = 'rgba(4,5,10,0.55)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = PAL.ui; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${22 / scale}px ${FONT}`;
      ctx.fillText('Paused', VW / 2, VH / 2);
    }
  }

  function zoneRect(z) {
    const [x0, y0] = P(z * ZONE, VESSEL), [x1, y1] = P((z + 1) * ZONE, WIDTH);
    return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
  }
  const FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const ZONE_ICON = ['sector-wound', 'sector-tissue', 'sector-lymph'];
  function zoneLayer(g, ts) {
    const px = 1 / scale;
    ctx.textBaseline = 'middle';
    for (let z = 0; z < 3; z++) {
      const [x, y, w, h] = zoneRect(z), zn = g.zones[z], cx = x + w / 2;
      ctx.globalAlpha = 0.9; ctx.textAlign = 'left';
      const ic = img[ZONE_ICON[z]];
      if (ic) ctx.drawImage(ic, x + 8 * px, y + 6 * px, 18 * px, 18 * px);
      ctx.fillStyle = PAL.ui; ctx.font = `600 ${13 * px}px ${FONT}`;
      ctx.fillText(zn.name, x + 30 * px, y + 15 * px);
      const n = zn.count;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 ${36 * px}px ${FONT}`;
      ctx.globalAlpha = n ? 0.85 : 0.22; ctx.fillStyle = n ? PAL.germHi : PAL.ui;
      ctx.fillText(String(n), x + 10 * px, y + 62 * px);
      const nw = ctx.measureText(String(n)).width;
      ctx.font = `500 ${11 * px}px ${MONO}`; ctx.globalAlpha = n ? 0.7 : 0.3; ctx.fillStyle = PAL.ui;
      ctx.fillText(n === 1 ? 'enemy' : 'enemies', x + 16 * px + nw, y + 60 * px);
      ctx.textBaseline = 'middle';
      const sup = zn.mode === 'support', col = sup ? PAL.repair : PAL.kill;
      const cw = 96 * px, ch = 26 * px, chx = cx - cw / 2, chy = y + h - ch - 10 * px;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(10,13,24,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5 * px;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(chx, chy, cw, ch, ch / 2); else ctx.rect(chx, chy, cw, ch);
      ctx.fill(); ctx.stroke();
      const mi = img[sup ? 'mode-support' : 'mode-offense'];
      if (mi) ctx.drawImage(mi, chx + 6 * px, chy + 4 * px, 18 * px, 18 * px);
      ctx.fillStyle = col; ctx.font = `600 ${12.5 * px}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(sup ? 'Support' : 'Offense', chx + 28 * px, chy + ch / 2 + 0.5 * px);
      if (z === 2) {
        const r = 20 * px, tx = x + w - r - 14 * px, ty = y + r + 12 * px;
        ART.drawTimer(ctx, tx, ty, r, g.lymph.timer, { beating: n > 0, t: ts });
        ctx.fillStyle = g.lymph.timer > 0 ? '#FFB3BC' : PAL.uiDim; ctx.font = `500 ${10.5 * px}px ${MONO}`; ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(g.lymph.timer * CONFIG.lymph.fill)}/${CONFIG.lymph.fill}s`, tx, ty + r + 13 * px);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- top bar: the level's progress with the script on, otherwise a census of enemies on the map ----
  function levelEvents(g) {
    const D = CONFIG.level.duration, ev = [];
    for (const w of g.lv.waves) if (w.t > 0) ev.push({ at: w.t / D, kind: w.final ? 'wave-final' : w.a ? 'wave-armored' : 'wave' });
    for (const tx of g.toxins) ev.push({ at: tx.at / D, kind: 'toxin' });
    return ev;
  }
  function drawProg() {
    const w = pcv.width, h = pcv.height;
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, w, h);
    if (!game) return;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = w / dpr, H = h / dpr;
    if (game.dev.script) {
      const bh = 10, pad = 14;
      ART.drawProgress(pctx, pad, (H - bh) / 2, W - pad * 2, bh, Math.min(1, game.t / CONFIG.level.duration), levelEvents(game));
      return;
    }
    const n = game.countByKind(), kinds = Object.keys(ICON).filter(k => n[k]);
    pctx.textBaseline = 'middle'; pctx.font = `500 12px ${MONO}`;
    if (!kinds.length) { pctx.fillStyle = PAL.uiDim; pctx.textAlign = 'left'; pctx.fillText('No enemies on the map', 2, H / 2); return; }
    let x = 2;
    for (const k of kinds) {
      const im = ART.ready[ICON[k]], label = String(n[k]), tw = pctx.measureText(label).width;
      if (x + 22 + tw > W) break;
      if (im) pctx.drawImage(im, x, H / 2 - 10, 20, 20);
      pctx.fillStyle = PAL.ui; pctx.textAlign = 'left'; pctx.fillText(label, x + 21, H / 2 + 0.5);
      x += 21 + tw + 9;
    }
  }

  // ---- HUD ----
  function nextEventText(g) {
    const m = g.markers().filter(e => e.t > g.t).sort((a, b) => a.t - b.t)[0];
    if (!m) return null;
    const what = m.kind === 'toxin' ? 'toxin burst' : m.final ? 'final wave' : m.armored ? 'armored wave' : 'wave';
    return `Next: ${what} in ${fmt(m.t - g.t)}`;
  }
  function stormRisk(g) {
    const pv = g.stormPreview(), S = CONFIG.storm;
    return { pv, certain: g.fatigue + pv.ghost >= S.collapse, gamble: g.fatigue + pv.ghost + pv.burn >= S.collapse, land: Math.min(100, g.fatigue + pv.ghost) };
  }
  function cheatsOn() {
    const on = [];
    if (dev.noFatigue) on.push('No fatigue'); if (dev.noDeath) on.push('No death'); if (dev.immortal) on.push('Cells don\'t die');
    if (dev.noDivision) on.push('No division'); if (dev.bigCaps) on.push('Bigger caps'); if (!dev.marrowOn) on.push('Marrow off');
    return on;
  }
  function hud() {
    const g = game; if (!g) return;
    $('#clock').textContent = fmt(Math.min(g.t, 5999));
    const fz = $('#fatigue'), st = g.storm, burning = st.phase === 'afterburn' || st.phase === 'hit';
    const risk = stormRisk(g);
    fz.dataset.tier = g.tier; fz.dataset.burning = burning; $('#fTier').textContent = TIER[g.tier];
    const fk = `${g.fatigue.toFixed(1)}|${g.tier}|${stormHeld}|${burning}|${risk.pv.burn}`;
    if (fz.dataset.k !== fk) {
      fz.dataset.k = fk;
      $('#ftrack').innerHTML = ART.fatigueMeterSVG(g.fatigue, CONFIG.fatigue, 10, stormHeld ? risk.pv : burning ? { burning: true } : {});
      const icon = ['fatigue-fine', 'fatigue-tired', 'fatigue-feverish', 'fatigue-exhausted'][g.tier];
      if ($('#fIcon').dataset.art !== icon) { $('#fIcon').dataset.art = icon; $('#fIcon').src = artUrl(icon); }
    }
    $('#burnTag').hidden = !burning;
    if (burning) $('#burnLeft').textContent = `${Math.ceil(st.phase === 'hit' ? CONFIG.storm.afterburn : st.left)}s`;
    const sb = $('#stormBtn'), lethal = stormHeld && risk.gamble;
    sb.classList.toggle('held', stormHeld); sb.classList.toggle('lethal', lethal);
    sb.disabled = !!g.result || st.phase === 'windup' || st.phase === 'hit';
    const sIcon = lethal ? 'storm-lethal' : 'storm';
    if ($('#stormIcon').dataset.art !== sIcon) { $('#stormIcon').dataset.art = sIcon; $('#stormIcon').src = artUrl(sIcon); }
    const tb = $('#toxbar');
    tb.hidden = !dev.toxinLoad;
    if (dev.toxinLoad) {
      $('#toxFill').style.width = `${g.toxLoad.toFixed(1)}%`;
      $('#toxMark').style.left = `${CONFIG.toxload.puddleAt}%`;
      tb.dataset.hot = g.toxLoad >= 85; tb.dataset.max = g.toxLoad >= 99.9;
      $('#toxVal').textContent = g.toxLoad >= 99.9 ? 'Maxed' : g.toxLoad > CONFIG.toxload.puddleAt ? 'Puddles' : Math.round(g.toxLoad);
    }
    if (document.activeElement !== $('#output')) $('#output').value = Math.round(g.output * 100);
    $('#outVal').textContent = `${g.outputMul().toFixed(1)}× marrow`;
    const cap = Math.round(g.cellCap()), cells = g.cellCount();
    $('#cellCount').textContent = dev.marrowOn ? `${cells}/${cap} cells` : 'off';
    const counts = { neut: g.neut.length, mac: g.mac.length, net: g.runners.length, nk: g.nk.length };
    document.querySelectorAll('#marrowSeg button').forEach(b => {
      const on = b.dataset.make === g.marrow.make;
      b.setAttribute('aria-pressed', on);
      b.querySelector('.fill').style.width = on ? `${Math.round(g.marrow.prog * 100)}%` : '0';
      b.querySelector('.ct').textContent = counts[b.dataset.make];
    });
    // Banner: the one thing worth knowing right now
    const bn = $('#banner'); let cls = '', html = '';
    const tx = g.pendingToxin();
    const fresh = [...seen.entries()].filter(([k, t0]) => HINT[k] && g.t - t0 < 9).sort((a, b) => b[1] - a[1])[0];
    if (stormHeld) {
      cls = risk.gamble ? 'bad' : '';
      html = risk.certain ? '<b>This storm will kill you.</b> Release to fire anyway, or slide off to cancel.'
        : risk.gamble ? `<b>The afterburn could kill you.</b> You'd land at ${Math.round(risk.land)} fatigue; drop Body output to its lowest to halve the burn.`
          : `<b>Release to fire.</b> About ${Math.round(CONFIG.storm.kill * 100)}% of enemies and ${Math.round(CONFIG.storm.friendly * 100)}% of your neutrophils die. Fatigue lands at ${Math.round(risk.land)}.`;
    } else if (st.phase === 'windup' || st.phase === 'hit') { cls = 'bad'; html = '<b>Cytokine storm!</b>'; }
    else if (st.phase === 'afterburn') {
      cls = 'bad'; html = `<b>Afterburn: ${Math.ceil(st.left)} s.</b> Fatigue at ${CONFIG.storm.collapse} now means organ failure. ${g.output > 0.001 ? 'Drop Body output to its lowest to halve the burn.' : 'Body output is at its lowest: the burn is halved.'}`;
    } else if (tx && tx.state === 'coming') { cls = 'alarm'; html = `<b>Toxin burst in ${Math.ceil(tx.at - g.t)} s.</b> It will kill every cell in the Wound.`; }
    else if (dev.toxinLoad && g.toxLoad >= 99.9) { cls = 'bad'; html = '<b>Toxin maxed.</b> It spills into fatigue and puddles stop draining. Swallowed kills add no toxin; resting drains it faster.'; }
    else if (fresh) html = HINT[fresh[0]];
    else if (g.tier >= 2) { cls = 'bad'; html = g.tier >= 3 ? '<b>Exhausted.</b> The marrow slows and Support rings shrink. Turn the body output down to recover.' : `<b>Feverish.</b> Shots spray and neutrophils die sooner.${g.toxicAlive ? ' Toxic-shock Staph is doubling your fatigue.' : ''}`; }
    else if (g.zones[2].count > 0) { cls = 'bad'; html = '<b>Enemies in the Lymph node.</b> Clear them before the ring fills.'; }
    else if (g.toxicAlive && g.output > 0.55) html = '<b>Toxic-shock Staph alive:</b> fatigue builds twice as fast above the sustainable output.';
    else if (cheatsOn().length) { cls = 'cheat'; html = `Cheats on: ${cheatsOn().join(', ')}.`; }
    else if (g.t < 15) html = '<b>Tap a zone</b> to flip its macrophages. <b>Hold Storm</b> to see what it would cost.';
    else if (g.dev.script) html = g.t >= CONFIG.level.duration ? '<b>No more waves.</b> Clear what\'s left to win.' : (nextEventText(g) || '');
    bn.className = cls; if (bn.innerHTML !== html) bn.innerHTML = html;
    const stg = $('#speedTag'); stg.hidden = SPEEDS[speedIdx] === 1; stg.textContent = `${SPEEDS[speedIdx]}×`;
  }
  function toast(text, kind) {
    const el = document.createElement('div'); el.className = `toast ${kind || ''}`; el.textContent = text;
    $('#toasts').appendChild(el);
    while ($('#toasts').children.length > 2) $('#toasts').firstChild.remove();
    setTimeout(() => el.remove(), 2300);
  }

  // ---- modals ----
  function openModal(kind, html) {
    modal = kind; $('#mbox').innerHTML = html; $('#modal').hidden = false;
    $('#mbox').querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
  }
  function closeModal() { modal = null; $('#modal').hidden = true; last = 0; }
  function comboIcons(c) {
    const ks = Object.keys(c.dev.rates || {}).filter(k => c.dev.rates[k] > 0).concat(c.boss || []);
    if (c.dev.script) ks.push('staph');
    return [...new Set(ks)].map(k => `<img data-art="${SPAWN_ICON[k]}" alt="">`).join('');
  }
  function showStart() {
    openModal('start', `
      <span class="eyebrow">Immune RTS · mechanics workshop</span>
      <h2>Find the <span class="glow">fun combos</span></h2>
      <p>The v2 game with every antigen from the roster, Net neutrophils, NK cells and the Cytokine storm. Pick a starting combo. The Workshop panel changes spawn rates for both sides, turns on cheats like No fatigue and No death, and tunes every number while it runs.</p>
      <div class="combos">${Object.entries(COMBOS).map(([k, c]) => `<button type="button" class="combo" data-combo="${k}" aria-pressed="${k === comboKey}"><span class="icons">${comboIcons(c)}</span><b>${esc(c.name)}</b><small>${esc(c.blurb)}</small></button>`).join('')}</div>
      <button class="linkbtn" id="openGuide" type="button">How each antigen works</button>`);
    $('#mbox').querySelectorAll('[data-combo]').forEach(b => b.addEventListener('click', () => { closeModal(); applyCombo(b.dataset.combo); }));
    $('#openGuide').addEventListener('click', () => showGuide('start', 'enemies'));
  }
  const ROSTER = [
    ['bacterium', 'Staph', 'The grunt. Drifts toward the Lymph node and divides every ' + '{bacteria.doubling} s.', ['{bacteria.hp} plain hits, 1 tuned hit, or one swallow.']],
    ['mrsa', 'MRSA', 'The tank. Armored, and macrophages spit it out.', ['Only <b>tuned shots</b> from a Support ring kill it.']],
    ['flu', 'Influenza', 'Zerglings. Arrives {flu.swarm} at a time; each that reaches the Tissue becomes {flu.splitInto}.', ['One hit kills. <b>Net neutrophils</b> wipe whole clusters.']],
    ['pseudomonas', 'Pseudomonas', 'The builder. After {pseudo.settleAfter} s it stops and grows a dome that blocks every shot.', ['<b>Offense macrophages</b> tear domes down ({pseudo.domeHp} gulps).']],
    ['tb', 'Tuberculosis', 'The trojan horse. Slow, {tb.hp} hits. A macrophage that swallows it gets infected and spits out more TB.', ['Keep its zone on <b>Support</b>; shoot infected macrophages down.']],
    ['spore', 'Clostridium', 'The time bomb. Spores can\'t be hurt until they all hatch, {spore.hatchAfter} s after landing, into fast dividers.', ['<b>Time the slider</b>: rest it now, push it before the hatch.']],
    ['staph-toxic', 'Toxic-shock Staph', 'The drain. While any are alive, fatigue builds {toxic.fatigueMul}× as fast.', ['Kill it early with <b>Offense in the Wound</b>, or keep output low.']],
    ['strep-link', 'Strep chain', 'The rushers. Chains sprint for the Lymph node; killing a link splits the chain in two.', ['<b>Support in the Tissue</b> or <b>Offense in the Lymph node</b>.']],
    ['herpes', 'Herpes', 'The sleeper. Gets inside a neutrophil, which flickers lilac, then bursts into {herpes.burstInto} particles after {herpes.burstAfter} s.', ['<b>NK cells</b> pop infected cells before they burst.']],
    ['tapeworm-head', 'Tapeworm', 'The boss. {tapeworm.segments} segments of {tapeworm.segHp} hits; tuned shots do {tapeworm.tunedDmg}. Each broken segment sheds a small fast worm.', ['Everything at once: mass neutrophils and Support rings.']],
  ];
  const fill = s => s.replace(/\{(\w+)\.(\w+)\}/g, (_, g, k) => CONFIG[g] ? CONFIG[g][k] : '?');
  function guideHtml(tab) {
    const C = CONFIG;
    const tabs = [['enemies', 'Enemies'], ['units', 'Your cells'], ['storm', 'Storm, toxin'], ['controls', 'Controls']];
    let body = '';
    if (tab === 'enemies') body = ROSTER.map(([art, name, why, li]) => `<div class="unit"><img data-art="${art}" alt=""><h4>${name}</h4><p class="why">${fill(why)}</p><ul>${li.map(x => `<li>${fill(x)}</li>`).join('')}</ul></div>`).join('');
    if (tab === 'units') body = `
      <div class="unit"><img data-art="neutrophil" alt=""><h4>Neutrophil</h4><p class="why">The gunner. Zigzags toward the nearest enemy and shoots it from range.</p>
        <ul><li>A shot every <b>${C.neutrophil.fireEvery} s</b>; plain shots bounce off armor. Lives ${C.neutrophil.life} s.</li></ul></div>
      <div class="unit"><img data-art="macrophage-offense" alt=""><h4>Macrophage on Offense</h4><p class="why">The swallower. Eats the nearest enemy in its zone, and goes for biofilm domes first.</p>
        <ul><li>One gulp every <b>${C.macrophage.eatEvery} s</b>. Spits out MRSA; catches TB.</li></ul></div>
      <div class="unit"><img data-art="macrophage-support" alt=""><h4>Macrophage on Support</h4><p class="why">The booster. Neutrophils in its ring move ${Math.round((C.support.speedMul - 1) * 100)}% faster and fire tuned shots that pierce armor and kill in one hit.</p></div>
      <div class="unit"><img data-art="neutrophil-net" alt=""><h4>Net neutrophil</h4><p class="why">Runs for the thickest crowd of small enemies and bursts into a sticky net.</p>
        <ul><li>Kills every small enemy within <b>${C.net.radius}</b> units, and the net keeps killing for ${C.net.linger} s. Bursts on its own after ${C.net.fuse} s.</li><li>Small means everything except MRSA, armored, TB, spores and the Tapeworm. Domes protect.</li></ul></div>
      <div class="unit"><img data-art="nk-cell" alt=""><h4>NK cell</h4><p class="why">Slow hunter that ignores bacteria. Pops infected neutrophils first, then free virus particles (Herpes, Influenza).</p>
        <ul><li>One kill every ${C.nk.killEvery} s. Lives ${C.nk.life} s.</li></ul></div>`;
    if (tab === 'storm') body = `
      <div class="unit"><img data-art="storm" alt=""><h4>Cytokine storm</h4><p class="why">The last-ditch button. Hold it to see the cost on the fatigue meter; release to fire.</p>
        <ul><li>After a ${C.storm.windup} s wind-up it kills about <b>${Math.round(C.storm.kill * 100)}% of enemies</b> and <b>${Math.round(C.storm.friendly * 100)}% of your neutrophils</b>, and stuns macrophages for ${C.storm.stun} s.</li>
        <li>Fatigue jumps by <b>${C.storm.cost}</b>, then burns ${C.storm.burnRate}/s for ${C.storm.afterburn} s (half that with Body output at its lowest).</li>
        <li><b>Fatigue at ${C.storm.collapse} during the storm or afterburn is organ failure: you lose.</b></li>
        <li>Spores, enemies under domes and Herpes hiding in cells shrug it off. The Tapeworm loses ${Math.round(C.storm.worm * 100)}% per segment.</li></ul></div>
      <div class="unit"><img data-art="pseudomonas" alt=""><h4>Toxin load</h4><p class="why">Bursting bacteria dump toxin that your kidneys and liver have to clear. ${dev.toxinLoad ? 'On in this match.' : 'Off right now; turn it on in the Workshop panel.'}</p>
        <ul><li>Each enemy killed by a shot, Net or storm adds <b>${C.toxload.perKill}</b> (Pseudomonas and Clostridium ${C.toxload.perEndo}, viruses none). Each toxin burst adds ${C.toxload.perBurst}. <b>Swallows add nothing.</b></li>
        <li>It drains ${C.toxload.drainRested}/s when you're rested, sliding to ${C.toxload.drainTired}/s at full fatigue.</li>
        <li>Over ${C.toxload.puddleAt}, kills leave green puddles that slow your cells. Maxed, it spills ${C.toxload.spill} fatigue/s into the fatigue meter. It never ends the match on its own.</li></ul></div>`;
    if (tab === 'controls') body = `
      <ol class="howto">
        <li><b>Marrow</b>: what gets made next, up to ${Math.round(game ? game.cellCap() : C.level.cellCap)} cells on the field.</li>
        <li><b>Tap a zone</b> to flip it between Offense and Support.</li>
        <li><b>Body output</b>: ${C.output.min}× to ${C.output.max}× marrow speed; above ${C.output.rest}× fatigue builds.</li>
        <li><b>Storm</b>: hold to preview, release to fire.</li>
        <li><b>Workshop</b> panel: combos, spawn rates for both sides, cheats, a live readout and every tuning number. <b>Copy setup</b> to share a combo you like.</li>
        <li>Keyboard: <b>1 2 3</b> zones, <b>N M B K</b> marrow, <b>- =</b> output, hold <b>S</b> for storm, <b>Space</b> pause.</li>
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
    $('#guideClose').addEventListener('click', () => { if (guideFrom === 'start') showStart(); else closeModal(); });
  }
  function showEnd() {
    const r = game.result, s = r.stats;
    const collapse = r.why === 'collapse';
    openModal('end', `
      <span class="eyebrow">${esc(COMBOS[comboKey] ? COMBOS[comboKey].name : 'Workshop')} · ${fmt(r.t)}</span>
      ${collapse ? '<img class="emblem" data-art="organ-failure" alt="">' : ''}
      <h2>${r.win ? '<span class="glow">Infection cleared</span>' : collapse ? '<span class="bad">Organ failure</span>' : '<span class="bad">The infection took hold</span>'}</h2>
      <p>${esc(r.reason)}</p>
      ${r.win ? `<div class="stars">${[0, 1, 2].map(i => `<img data-art="${i < r.stars ? 'star' : 'star-empty'}" alt="">`).join('')}</div><ul class="goals">${r.goals.map(g => `<li class="${g.hit ? 'hit' : ''}">${g.text}</li>`).join('')}</ul>` : ''}
      <div class="stats">
        <div><b>${s.shotKills}</b><span>shot down (${s.tunedKills} tuned)</span></div>
        <div><b>${s.swallows}</b><span>swallowed</span></div>
        <div><b>${s.netKills + s.nkKills}</b><span>by nets and NK</span></div>
        <div><b>${s.stormKills}</b><span>by storms (${game.storm.count})</span></div>
        <div><b>${Math.round(r.peakTimer * 100)}%</b><span>timer peak</span></div>
        <div><b>${Math.round(r.fatiguePeak)}</b><span>fatigue peak</span></div>
        ${dev.toxinLoad ? `<div><b>${Math.round(r.toxPeak)}</b><span>toxin peak</span></div><div><b>${Math.round(r.toxPinned)}s</b><span>toxin maxed</span></div><div><b>${s.lost.age + s.lost.toxin + s.lost.storm + s.lost.herpes}</b><span>cells lost</span></div>` : ''}
      </div>
      <canvas id="graph" aria-label="Enemies in each zone over the match"></canvas>
      <div class="legend"><span style="--c:${PAL.germ}">Wound</span><span style="--c:${PAL.antibody}">Tissue</span><span style="--c:${PAL.damage}">Lymph node</span></div>
      <div class="btnrow"><button class="btn primary" id="again" type="button">Restart</button>${r.win ? '' : '<button class="btn" id="keepGoing" type="button">Keep going with No death</button>'}</div>
      <button class="linkbtn" id="pickCombo" type="button">Pick another combo</button>`);
    drawGraph();
    $('#again').addEventListener('click', () => { closeModal(); newGame(); });
    if ($('#keepGoing')) $('#keepGoing').addEventListener('click', () => {
      dev.noDeath = true; saveDev(); syncWorkshop();
      game.nearLoss(r.why || 'lymph', r.reason); game.result = null; endShown = false;
      if (r.why === 'lymph') game.lymph.timer = 0;
      closeModal();
    });
    $('#pickCombo').addEventListener('click', showStart);
  }
  function drawGraph() {
    const c = $('#graph'), r = c.getBoundingClientRect(), k = Math.min(3, window.devicePixelRatio || 1);
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext('2d'); g.scale(k, k);
    const W = r.width, H = r.height, padL = 26, padB = 16, h = game.history;
    if (!h.length) return;
    const T0 = h[0].t, T = Math.max(60, game.t - T0), maxY = Math.max(10, ...h.map(p => Math.max(...p.z)));
    const X = t => padL + (W - padL - 4) * (t - T0) / T, Y = v => (H - padB) - (H - padB - 6) * v / maxY;
    g.font = `10px ${MONO}`; g.fillStyle = PAL.uiDim; g.strokeStyle = 'rgba(221,230,245,0.12)'; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of [0, Math.round(maxY / 2), maxY]) { g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(W, Y(v)); g.stroke(); g.fillText(v, padL - 4, Y(v)); }
    g.textBaseline = 'top';
    const stepT = T > 400 ? 120 : 60;
    for (let t = Math.ceil(T0 / stepT) * stepT; t <= T0 + T; t += stepT) { g.textAlign = X(t) > W - 20 ? 'right' : 'center'; g.fillText(fmt(t), Math.min(X(t), W), H - padB + 3); }
    [PAL.germ, PAL.antibody, PAL.damage].forEach((col, z) => {
      g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      h.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, X(p.t), Y(p.z[z])));
      g.stroke();
    });
  }

  // ---- game flow ----
  function newGame(setup) {
    game = new Game('papercut', seed, dev);
    game.dev = dev; // live: workshop edits apply to the running match
    if (setup) {
      if (setup.marrow) game.setMarrow(setup.marrow);
      (setup.zones || []).forEach((m, z) => game.setZone(z, m));
      if (setup.output != null) game.setOutput(setup.output);
      for (const k of setup.boss || []) game.spawnGroup(k);
    }
    paused = false; acc = 0; endShown = false; parts = []; shake = 0; flashT = 0;
    seen.clear(); once.clear(); throttle.clear();
    $('#pauseBtn').setAttribute('aria-label', 'Pause');
    updateNearLog(); hud();
  }
  function applyCombo(key) {
    const c = COMBOS[key]; if (!c) return;
    comboKey = key; store.set('combo', key);
    for (const k in dev.rates) dev.rates[k] = (c.dev.rates && c.dev.rates[k]) || 0;
    dev.script = !!c.dev.script; dev.bigCaps = !!c.dev.bigCaps;
    saveDev();
    newGame({ marrow: c.marrow || 'neut', zones: c.zones || ['offense', 'offense', 'offense'], output: c.output != null ? c.output : CONFIG.output.start, boss: c.boss });
    syncWorkshop();
    toast(c.name, 'good');
  }

  let hudT = 0, wsT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (game && !paused && !modal && !game.result) {
      acc += dt * SPEEDS[speedIdx];
      let n = 0;
      while (acc >= STEP && n < 24 && !game.result) { game.step(STEP); acc -= STEP; n++; }
      if (n === 24) acc = 0;
    }
    if (game) {
      if (game.result && !resultAt) resultAt = now;
      if (!game.result) resultAt = 0;
      for (const b of game.bact) if (!seen.has(b.kind) && !b.dead) seen.set(b.kind, game.t);
      if (dev.toxinLoad && game.toxLoad > CONFIG.toxload.puddleAt) toastOnce('tox', 'Toxin over half: kills now leave puddles that slow your cells', 'bad');
      consumeFx();
      const pdt = paused || modal ? 0 : dt * SPEEDS[speedIdx];
      for (const p of parts) { p.life -= pdt; p.u += p.vu * pdt; p.v += p.vv * pdt; p.vu *= 0.92; p.vv *= 0.92; if (p.vr) p.rot += p.vr * pdt; }
      if (parts.length) parts = parts.filter(p => p.life > 0);
      if (parts.length > 1500) parts.splice(0, parts.length - 1500);
      shake = Math.max(0, shake - pdt * 2.5); flashT = Math.max(0, flashT - pdt);
      if (game.result && !endShown) {
        endShown = true; stormHeld = false; hud();
        setTimeout(() => { if (game.result) showEnd(); }, game.result.why === 'collapse' ? 2300 : 700);
      }
    }
    render(now);
    drawProg();
    hudT -= dt; wsT -= dt;
    if (hudT <= 0) { hudT = 0.1; hud(); }
    if (wsT <= 0) { wsT = 0.5; updateReadout(); }
    requestAnimationFrame(frame);
  }

  // ---- input ----
  function tapZone(z) {
    if (!game || game.result) return;
    game.toggleZone(z);
    const zn = game.zones[z];
    toast(`${zn.name}: ${zn.mode === 'support' ? 'Support' : 'Offense'}`, zn.mode === 'support' ? 'good' : '');
    hud();
  }
  cv.addEventListener('pointerdown', e => {
    if (!game || modal) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left - ox) / scale, y = (e.clientY - r.top - oy) / scale;
    if (x < 0 || y < 0 || x > VW || y > VH) return;
    tapZone(zoneOf(portrait ? y : x));
  });
  function setPaused(p) {
    paused = p; $('#pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    const b = $('#wsPause'); if (b) b.textContent = paused ? 'Resume' : 'Pause';
  }
  $('#pauseBtn').addEventListener('click', () => setPaused(!paused));
  $('#marrowSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !game) return;
    game.setMarrow(b.dataset.make); hud();
  });
  $('#output').addEventListener('input', e => { if (game) { game.setOutput(+e.target.value / 100); hud(); } });
  $('#helpBtn').addEventListener('click', () => { if (modal === 'guide') return; if (!modal) showGuide('game', 'enemies'); });
  // Storm: hold to preview the cost on the fatigue meter, release on the button to fire, slide off to cancel
  const sb = $('#stormBtn');
  function fireStorm() { if (game && game.fireStorm()) hud(); }
  sb.addEventListener('pointerdown', e => {
    if (!game || game.result || sb.disabled) return;
    e.preventDefault(); stormHeld = true;
    try { sb.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    hud();
  });
  sb.addEventListener('pointerup', e => {
    if (!stormHeld) return;
    stormHeld = false;
    const r = sb.getBoundingClientRect(), inside = e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
    if (inside) fireStorm(); else toast('Storm cancelled');
    hud();
  });
  sb.addEventListener('pointercancel', () => { stormHeld = false; hud(); });
  sb.addEventListener('contextmenu', e => e.preventDefault());
  sb.addEventListener('click', e => { if (e.detail === 0) fireStorm(); }); // keyboard activation
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); if (!modal) setPaused(!paused); }
    if (!game || modal) return;
    if (e.key >= '1' && e.key <= '3') tapZone(+e.key - 1);
    const mk = { n: 'neut', m: 'mac', b: 'net', k: 'nk' }[e.key.toLowerCase()];
    if (mk) game.setMarrow(mk);
    if (e.key === '-' || e.key === '_') game.setOutput(game.output - 0.1);
    if (e.key === '=' || e.key === '+') game.setOutput(game.output + 0.1);
    if ((e.key === 's' || e.key === 'S') && !e.repeat && !game.result) { stormHeld = true; hud(); }
  });
  window.addEventListener('keyup', e => {
    if ((e.key === 's' || e.key === 'S') && stormHeld) { stormHeld = false; fireStorm(); hud(); }
  });

  // ---- workshop panel ----
  const ws = $('#ws');
  function setWsOpen(open) {
    document.body.classList.toggle('ws-open', open);
    $('#wsBtn').setAttribute('aria-pressed', open);
    store.set('wsOpen', open);
  }
  $('#wsBtn').addEventListener('click', () => setWsOpen(!document.body.classList.contains('ws-open')));
  const human = k => k.replace(/([A-Z])/g, ' $1').toLowerCase();
  const CHEATS = [
    ['noFatigue', 'No fatigue', 'Fatigue stays at 0; the storm costs nothing.'],
    ['noDeath', 'No death', 'Losses are logged below instead of ending the match.'],
    ['immortal', 'My cells don\'t die', 'No old age, toxin or storm deaths. Infections still burst.'],
    ['noDivision', 'Enemies don\'t divide', 'Only what spawns is on the map.'],
    ['bigCaps', 'Bigger caps', `2.5× the cell and enemy caps.`],
    ['script', 'Papercut script', 'v2\'s waves, stream and toxin bursts on top. Restarts.'],
  ];
  function buildWorkshop() {
    ws.innerHTML = `
      <h3>Workshop <small id="wsSeed"></small><button type="button" class="hbtn" id="wsClose">Close</button></h3>
      <div class="grp">
        <div class="sbtns"><button type="button" id="wsPause">Pause</button><button type="button" id="wsRestart">Restart</button><button type="button" id="wsStep">Step 1 s</button><button type="button" id="wsNewSeed">New seed</button></div>
        <label class="row" for="speed"><span>Speed <b id="speedVal">1×</b></span></label>
        <input type="range" id="speed" min="0" max="${SPEEDS.length - 1}" step="1" value="${speedIdx}" aria-label="Game speed">
      </div>
      <div class="grp">
        <h4>Combos <button type="button" class="sbtn" id="wsCombosHelp">Pick on a card</button></h4>
        <div class="chips" id="wsCombos">${Object.entries(COMBOS).map(([k, c]) => `<button type="button" data-combo="${k}" title="${esc(c.blurb)}">${esc(c.name)}</button>`).join('')}</div>
        <p>A combo sets the enemy spawn rates, the marrow and the zone modes, then restarts. Cheats stay as they are.</p>
      </div>
      <div class="grp">
        <h4>Enemies <button type="button" class="sbtn" id="wsStopAll">Stop all</button><button type="button" class="sbtn" id="wsClearEnemies">Clear map</button></h4>
        <p>Groups arriving at the Wound every 10 s. Changes apply live. + sends one group now.</p>
        <div id="wsSpawns" class="grp" style="border:0;padding:0"></div>
      </div>
      <div class="grp">
        <h4>Your cells <button type="button" class="sbtn" id="wsClearCells">Clear</button></h4>
        <label class="check"><input type="checkbox" id="wsMarrow"><span>Marrow makes cells<small>Turn off to test only the free spawns below.</small></span></label>
        <p>Free cells every 10 s on top of the marrow (still under the cell cap). + adds 5 now.</p>
        <div id="wsFriends" class="grp" style="border:0;padding:0"></div>
      </div>
      <div class="grp">
        <h4>Toxin load</h4>
        <label class="check"><input type="checkbox" id="wsToxOn"><span>Toxin load on<small>Shots, Nets and storms leave toxin; swallows don't. It drains fast when you're rested and slowly when you're tired. Over half full, kills leave slowing puddles; maxed, it spills into fatigue. It never ends the match on its own.</small></span></label>
        <div id="wsTox" class="grp" style="border:0;padding:0"></div>
      </div>
      <div class="grp">
        <h4>Cheats</h4>
        ${CHEATS.map(([k, n, s]) => `<label class="check"><input type="checkbox" id="wsC-${k}"><span>${n}<small>${s}</small></span></label>`).join('')}
        <div class="sbtns"><button type="button" id="wsToxin">Toxin burst now</button><button type="button" data-fat="0">Fatigue 0</button><button type="button" data-fat="40">40</button><button type="button" data-fat="70">70</button></div>
        <label class="check"><input type="checkbox" id="ovRange"><span>Show neutrophil range</span></label>
        <label class="check"><input type="checkbox" id="ovRotate"><span>Force portrait layout</span></label>
      </div>
      <div class="grp">
        <h4>Live readout</h4>
        <table class="readout" id="wsReadout"></table>
        <ul id="nearLog"></ul>
      </div>
      <div class="grp">
        <h4>Share a setup</h4>
        <p>Copy puts this match's spawn rates, cheats, tuning, marrow and zone modes on the clipboard so you can paste it into the chat. Paste one below and Load to try someone else's.</p>
        <div class="sbtns"><button type="button" id="setupCopy">Copy setup</button><button type="button" id="setupLoad">Load pasted setup</button></div>
        <textarea id="setupJson" aria-label="Setup JSON" placeholder="Paste a setup here"></textarea>
      </div>
      <div class="grp">
        <h4>Tuning <button type="button" class="sbtn" id="tuneReset">Reset all</button></h4>
        <p>Live. Gold numbers differ from the defaults. Saved in this browser.</p>
        <div id="tuning"></div>
      </div>`;
    // Spawn rows
    $('#wsSpawns').innerHTML = SPAWNABLE.map(s => `
      <div class="spawn" data-kind="${s.kind}"><img data-art="${SPAWN_ICON[s.kind]}" alt=""><span class="nm">${s.label}<small>${s.trait}</small></span><output id="rv-${s.kind}"></output>
        <button type="button" class="sbtn add" data-add="${s.kind}" aria-label="Send one ${s.label} group now">+</button>
        <input type="range" id="rate-${s.kind}" min="0" max="10" step="0.1" aria-label="${s.label} groups per 10 seconds"></div>`).join('');
    $('#wsFriends').innerHTML = FRIENDLY.map(f => `
      <div class="spawn" data-kind="${f.kind}"><img data-art="${FRIEND_ICON[f.kind]}" alt=""><span class="nm">${f.label}</span><output id="fv-${f.kind}"></output>
        <button type="button" class="sbtn add" data-fadd="${f.kind}" aria-label="Add 5 ${f.label} now">+5</button>
        <input type="range" id="friend-${f.kind}" min="0" max="40" step="1" aria-label="Free ${f.label} per 10 seconds"></div>`).join('');
    ws.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
    // Handlers
    $('#wsClose').addEventListener('click', () => setWsOpen(false));
    $('#wsPause').addEventListener('click', () => setPaused(!paused));
    $('#wsRestart').addEventListener('click', () => { closeModal(); applyCombo(comboKey); });
    $('#wsStep').addEventListener('click', () => { if (game && !game.result) for (let i = 0; i < 60 && !game.result; i++) game.step(STEP); });
    $('#wsNewSeed').addEventListener('click', () => { seed = 1 + Math.floor(Math.random() * 9999); store.set('seed', seed); closeModal(); applyCombo(comboKey); });
    $('#speed').addEventListener('input', e => { speedIdx = +e.target.value; $('#speedVal').textContent = `${SPEEDS[speedIdx]}×`; hud(); });
    $('#wsCombosHelp').addEventListener('click', showStart);
    $('#wsCombos').addEventListener('click', e => { const b = e.target.closest('[data-combo]'); if (b) { closeModal(); applyCombo(b.dataset.combo); } });
    for (const s of SPAWNABLE) {
      $(`#rate-${s.kind}`).addEventListener('input', e => { dev.rates[s.kind] = +e.target.value; saveDev(); syncRates(); });
    }
    for (const f of FRIENDLY) $(`#friend-${f.kind}`).addEventListener('input', e => { dev.friendly[f.kind] = +e.target.value; saveDev(); syncRates(); });
    $('#wsSpawns').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b && game && !game.result) game.spawnGroup(b.dataset.add); });
    $('#wsFriends').addEventListener('click', e => { const b = e.target.closest('[data-fadd]'); if (b && game && !game.result) for (let i = 0; i < 5; i++) game.spawnFriendly(b.dataset.fadd); });
    $('#wsStopAll').addEventListener('click', () => { for (const k in dev.rates) dev.rates[k] = 0; saveDev(); syncWorkshop(); });
    $('#wsClearEnemies').addEventListener('click', () => { if (!game) return; for (const b of game.bact) { b.dead = true; game.fx.push({ k: 'pop', u: b.u, v: b.v }); } for (const m of game.mac) { m.prey = null; m.gulp = 0; m.dome = null; } game.domes.length = 0; });
    $('#wsClearCells').addEventListener('click', () => { if (!game) return; for (const c of [...game.neut, ...game.runners, ...game.nk, ...game.mac]) { c.dead = true; game.fx.push({ k: 'expire', u: c.u, v: c.v }); } for (const b of game.bact) b.eaten = false; });
    $('#wsMarrow').addEventListener('change', e => { dev.marrowOn = e.target.checked; saveDev(); hud(); });
    for (const [k] of CHEATS) $(`#wsC-${k}`).addEventListener('change', e => {
      dev[k] = e.target.checked; saveDev();
      if (k === 'script') { closeModal(); newGame({ marrow: game.marrow.make, zones: game.zones.map(z => z.mode), output: game.output }); toast(dev.script ? 'Papercut script on' : 'Script off'); }
      hud();
    });
    $('#wsToxin').addEventListener('click', () => { if (game) game.toxinNow(); });
    ws.querySelectorAll('[data-fat]').forEach(b => b.addEventListener('click', () => { if (game) { game.fatigue = +b.dataset.fat; hud(); } }));
    $('#ovRange').addEventListener('change', e => { overlay.range = e.target.checked; });
    $('#ovRotate').addEventListener('change', e => { overlay.portrait = e.target.checked; resize(); });
    $('#setupCopy').addEventListener('click', copySetup);
    $('#setupLoad').addEventListener('click', loadSetup);
    $('#tuneReset').addEventListener('click', () => {
      for (const g in DEFAULTS) for (const k in DEFAULTS[g]) CONFIG[g][k] = DEFAULTS[g][k];
      saveTuning(); buildTuning(); buildGraphics(); syncRates(); syncTox();
    });
    $('#wsToxOn').addEventListener('change', e => { dev.toxinLoad = e.target.checked; saveDev(); hud(); });
    $('#wsTox').innerHTML = TOX_SLIDERS.map(([g, k, n, max, st, min = 0]) => `<label class="row" for="tx-${k}"><span>${n}</span><output id="txv-${k}"></output></label><input type="range" id="tx-${k}" min="${min}" max="${max}" step="${st}">`).join('');
    for (const [g, k] of TOX_SLIDERS) $(`#tx-${k}`).addEventListener('input', e => {
      CONFIG[g][k] = +e.target.value; saveTuning(); syncTox();
      const t = $(`#t-${g}-${k}`); if (t) { t.value = CONFIG[g][k]; t.classList.toggle('changed', CONFIG[g][k] !== DEFAULTS[g][k]); }
    });
    buildReadout();
    buildTuning();
    syncWorkshop();
  }
  const TOX_SLIDERS = [
    ['toxload', 'perKill', 'Per messy kill', 10, 0.1], ['toxload', 'perEndo', 'Per Pseudomonas or Clostridium', 20, 0.1], ['toxload', 'perBurst', 'Per toxin burst', 40, 1],
    ['toxload', 'drainRested', 'Drain at 0 fatigue (/s)', 8, 0.1], ['toxload', 'drainTired', 'Drain at 100 fatigue (/s)', 4, 0.1], ['toxload', 'spill', 'Spill into fatigue when maxed (/s)', 5, 0.1],
    ['macrophage', 'eatEvery', 'Macrophage gulp every (s), lower eats faster', 4, 0.1, 0.3],
  ];
  function syncTox() {
    for (const [g, k] of TOX_SLIDERS) {
      const el = $(`#tx-${k}`); if (!el) continue;
      if (document.activeElement !== el) el.value = CONFIG[g][k];
      const o = $(`#txv-${k}`); o.textContent = CONFIG[g][k]; o.style.color = CONFIG[g][k] !== DEFAULTS[g][k] ? 'var(--gold)' : '';
    }
  }
  function syncRates() {
    for (const s of SPAWNABLE) {
      const v = dev.rates[s.kind] || 0, o = $(`#rv-${s.kind}`);
      o.textContent = v ? `${+(v * groupSize(s)).toFixed(1)}/10s` : 'off'; o.classList.toggle('on', v > 0);
    }
    for (const f of FRIENDLY) { const v = dev.friendly[f.kind] || 0, o = $(`#fv-${f.kind}`); o.textContent = v ? `${v}/10s` : 'off'; o.classList.toggle('on', v > 0); }
  }
  function syncWorkshop() {
    if (!$('#wsSpawns')) return;
    for (const s of SPAWNABLE) $(`#rate-${s.kind}`).value = dev.rates[s.kind] || 0;
    for (const f of FRIENDLY) $(`#friend-${f.kind}`).value = dev.friendly[f.kind] || 0;
    $('#wsMarrow').checked = dev.marrowOn;
    $('#wsToxOn').checked = dev.toxinLoad;
    syncTox();
    for (const [k] of CHEATS) $(`#wsC-${k}`).checked = !!dev[k];
    $('#speedVal').textContent = `${SPEEDS[speedIdx]}×`;
    $('#wsSeed').textContent = `seed ${seed}`;
    ws.querySelectorAll('#wsCombos [data-combo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.combo === comboKey));
    syncRates();
  }
  const READ_ROWS = [['Kind', 'Live', 'Killed']];
  function buildReadout() {
    const kinds = Object.keys(ICON);
    $('#wsReadout').innerHTML = `
      <tr><th>Enemy</th><th style="text-align:right">On map</th><th style="text-align:right">Killed</th></tr>
      ${kinds.map(k => `<tr data-row="${k}"><td class="l">${KINDS[k].name}</td><td id="rl-${k}">0</td><td id="rk-${k}">0</td></tr>`).join('')}
      <tr><th colspan="3" style="padding-top:8px">Kills by</th></tr>
      ${[['shot', 'Plain shots'], ['tuned', 'Tuned shots'], ['swallow', 'Swallows'], ['net', 'Nets'], ['nk', 'NK cells'], ['storm', 'Storms']].map(([k, n]) => `<tr><td class="l" colspan="2">${n}</td><td id="kb-${k}">0</td></tr>`).join('')}
      <tr><th colspan="3" style="padding-top:8px">Your cells lost to</th></tr>
      ${[['age', 'Old age'], ['toxin', 'Toxin bursts'], ['storm', 'Storms'], ['herpes', 'Herpes bursts'], ['tb', 'TB (infected macrophages)']].map(([k, n]) => `<tr><td class="l" colspan="2">${n}</td><td id="lo-${k}">0</td></tr>`).join('')}
      <tr><th colspan="3" style="padding-top:8px">Toxin load</th></tr>
      <tr><td class="l" colspan="2">Now / peak</td><td id="ro-tox">0</td></tr>
      ${[['shot', 'From shots'], ['net', 'From nets'], ['storm', 'From storms'], ['burst', 'From toxin bursts']].map(([k, n]) => `<tr><td class="l" colspan="2">${n}</td><td id="tf-${k}">0</td></tr>`).join('')}
      <tr><td class="l" colspan="2">Seconds maxed</td><td id="ro-pinned">0</td></tr>
      <tr><th colspan="3" style="padding-top:8px">Other</th></tr>
      <tr><td class="l" colspan="2">Domes standing</td><td id="ro-domes">0</td></tr>
      <tr><td class="l" colspan="2">Infected macrophages</td><td id="ro-infm">0</td></tr>
      <tr><td class="l" colspan="2">Storms fired</td><td id="ro-storms">0</td></tr>`;
  }
  function updateReadout() {
    if (!game || !$('#wsReadout') || !document.body.classList.contains('ws-open') && getComputedStyle(ws).display === 'none') return;
    const n = game.countByKind(), st = game.stats;
    for (const k of Object.keys(ICON)) {
      const live = n[k] || 0, killed = st.byKind[k] || 0;
      $(`#rl-${k}`).textContent = live; $(`#rk-${k}`).textContent = killed;
      ws.querySelector(`[data-row="${k}"]`).hidden = !live && !killed;
    }
    const kb = { shot: st.shotKills - st.tunedKills, tuned: st.tunedKills, swallow: st.swallows, net: st.netKills, nk: st.nkKills, storm: st.stormKills };
    for (const k in kb) $(`#kb-${k}`).textContent = kb[k];
    for (const k in st.lost) { const el = $(`#lo-${k}`); if (el) el.textContent = st.lost[k]; }
    $('#ro-domes').textContent = game.domes.length;
    $('#ro-tox').textContent = dev.toxinLoad ? `${Math.round(game.toxLoad)} / ${Math.round(game.toxPeak)}` : 'off';
    for (const k in st.toxinFrom) { const el = $(`#tf-${k}`); if (el) el.textContent = Math.round(st.toxinFrom[k]); }
    $('#ro-pinned').textContent = Math.round(game.toxPinned);
    $('#ro-infm').textContent = game.mac.filter(m => m.infected).length;
    $('#ro-storms').textContent = game.storm.count;
    for (const s of SPAWNABLE) { const row = ws.querySelector(`.spawn[data-kind="${s.kind}"]`); if (row) { row.classList.toggle('live', !!n[s.kind]); row.querySelector('.nm').dataset.live = n[s.kind] ? `${n[s.kind]} on map` : ''; } }
  }
  function updateNearLog() {
    const el = $('#nearLog'); if (!el || !game) return;
    el.innerHTML = game.stats.nearLosses.slice(-6).map(x => `<li>${fmt(x.t)}: would have lost. ${esc(x.text)}</li>`).join('');
  }
  function stepFor(v) { const a = Math.abs(v); return a === 0 ? 0.001 : Math.pow(10, Math.floor(Math.log10(a)) - 1); }
  function buildTuning() {
    const host = $('#tuning'); if (!host) return;
    host.innerHTML = '';
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
          if (grp === 'support' || grp === 'net' || (grp === 'pseudo' && key === 'domeMax')) buildGraphics();
          if (['flu', 'spore', 'herpes'].includes(grp)) syncRates();
          if (grp === 'toxload' || grp === 'macrophage') syncTox();
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
  function saveTuning() { store.set('tuning', tuningDiff()); }
  function copySetup() {
    const setup = { workshop: 1, combo: comboKey, seed, dev, tuning: tuningDiff(), marrow: game.marrow.make, zones: game.zones.map(z => z.mode), output: +game.output.toFixed(2) };
    const txt = JSON.stringify(setup), ta = $('#setupJson');
    ta.value = txt;
    const fallback = () => { ta.focus(); ta.select(); toast('Setup selected: copy it from the box'); };
    try { navigator.clipboard.writeText(txt).then(() => toast('Setup copied', 'good'), fallback); } catch (e) { fallback(); }
  }
  function loadSetup() {
    let s;
    try { s = JSON.parse($('#setupJson').value); } catch (e) { toast('That isn\'t a setup. Paste the text from Copy setup.', 'bad'); return; }
    if (!s || typeof s !== 'object') { toast('That isn\'t a setup.', 'bad'); return; }
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) CONFIG[g][k] = DEFAULTS[g][k];
    mergeConfig(s.tuning); saveTuning();
    dev = loadDev(s.dev); saveDev();
    if (COMBOS[s.combo]) { comboKey = s.combo; store.set('combo', comboKey); }
    if (s.seed) { seed = Math.max(1, Math.floor(+s.seed) || 1); store.set('seed', seed); }
    buildTuning(); buildGraphics();
    closeModal();
    newGame({ marrow: s.marrow, zones: Array.isArray(s.zones) ? s.zones.filter(m => m === 'offense' || m === 'support') : null, output: typeof s.output === 'number' ? s.output : null });
    syncWorkshop();
    toast('Setup loaded', 'good');
  }

  // ---- boot ----
  document.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
  { const O = CONFIG.output; $('#output').style.setProperty('--track', ART.outputTrackCSS(Math.log(O.rest / O.min) / Math.log(O.max / O.min))); }
  buildWorkshop();
  const savedOpen = store.get('wsOpen');
  setWsOpen(savedOpen == null ? window.innerWidth >= 1100 : !!savedOpen);
  ART.loadAll().then(() => {
    Object.assign(img, ART.ready);
    resize();
    new ResizeObserver(resize).observe(stage);
  });
  const c0 = COMBOS[comboKey];
  newGame({ marrow: c0.marrow || 'neut', zones: c0.zones, output: c0.output, boss: c0.boss });
  showStart();
  requestAnimationFrame(frame);
})();

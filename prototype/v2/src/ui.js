'use strict';
// ---------------------------------------------------------------------------
// Immune RTS prototype v2: rendering, input, HUD, guide, dev tools.
// The sim works in (u along the flow, v across). On a wide stage the map is
// drawn as-is (flow left to right, vessel on top); on a tall stage it is
// transposed (flow top to bottom, vessel on the left).
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
  const artUrl = n => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.svg[n]);

  mergeConfig(store.get('immuneRtsV2.tuning'));
  // The difficulty tuner's copy of the game can be handed a different wave script (never set in the live game)
  { const lv = store.get('immuneRtsV2.level'); if (lv && Array.isArray(lv.waves)) { LEVELS.papercut.waves = lv.waves; if (Array.isArray(lv.toxins)) LEVELS.papercut.toxins = lv.toxins; } }
  let seed = store.get('immuneRtsV2.seed') || 1;
  let game = null;
  let paused = false, speedIdx = 2, acc = 0, last = 0;
  let modal = null; // 'start' | 'end' | 'guide' | null
  let endShown = false, guideFrom = null;
  const overlay = { range: false, portrait: false };

  // ---- canvas, view mapping, sprites ----
  const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage');
  const pcv = $('#prog'), pctx = pcv.getContext('2d');
  let dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
  let portrait = false, VW = L, VH = WIDTH;
  const P = (u, v) => (portrait ? [v, u] : [u, v]);
  const ang = a => (portrait ? Math.PI / 2 - a : a);
  const img = {}, spr = {};
  let bg = null;

  // World size of each sprite's box, chosen so bodies read at phone size.
  // All units are drawn at UNIT_SCALE of their v2 size so a crowded map still reads
  const UNIT_SCALE = 0.62;
  const SPRITE_WORLD = {
    neutrophil: 64 * 8 / 13,
    'macrophage-offense': 64 * 15 / 22, 'macrophage-support': 64 * 15 / 22,
    bacterium: 64 * 5.5 / 9, 'bacterium-hit': 64 * 5.5 / 9, 'bacterium-dividing': 64 * 7 / 12,
    'bacterium-armored': 64 * 9.5 / 19, 'bacterium-armored-dividing': 64 * 11 / 22,
    'hit-spark': 16, 'kill-shard': 7,
  };
  // Non-square sprites: world length of the box; the art gives box and anchor
  const STRIP_WORLD = { shot: 22, 'shot-tuned': 30, 'speed-trail': 34 };
  for (const n in SPRITE_WORLD) SPRITE_WORLD[n] *= UNIT_SCALE;
  for (const n in STRIP_WORLD) STRIP_WORLD[n] *= UNIT_SCALE;
  const TIER = ['Fine', 'Tired', 'Feverish', 'Exhausted'];

  function prerender(name, wWorld, hWorld) {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(wWorld * k)); c.height = Math.max(2, Math.ceil(hWorld * k));
    c.getContext('2d').drawImage(img[name], 0, 0, c.width, c.height);
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
    glowDot('puff', 'rgba(63,230,255,0.8)', 3);
    glowDot('puffDim', 'rgba(63,230,255,0.35)', 3);
    glowDot('ember', 'rgba(255,61,203,0.9)', 2.5);
    buildBackground();
  }
  // Tissue, vessel and the wound: one offscreen image in view space
  function buildBackground() {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.ceil(VW * k); c.height = Math.ceil(VH * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.globalAlpha = 0.45;
    const tw = 128, th = tw * img.tissue.naturalHeight / img.tissue.naturalWidth;
    for (let y = 0; y < VH; y += th) for (let x = 0; x < VW; x += tw) g.drawImage(img.tissue, x, y, tw + 0.5, th + 0.5);
    g.globalAlpha = 1;
    // Blood vessel strip along v in [0, VESSEL]
    const vb = img['vessel-blood'], sw = 96, sh = VESSEL * 1.25;
    g.save();
    if (portrait) { g.translate(VESSEL * 1.1, 0); g.rotate(Math.PI / 2); }
    for (let x = 0; x < L; x += sw) g.drawImage(vb, x, -VESSEL * 0.15, sw + 0.5, sh);
    g.restore();
    // The wound gash
    const [wx, wy] = P(WOUND.u, WOUND.v);
    g.save(); g.translate(wx, wy); if (portrait) g.rotate(Math.PI / 2);
    g.globalAlpha = 0.9; g.drawImage(img.wound, -70, -35, 140, 70);
    g.restore();
    // Lymph node: a soft green glow at the far end
    const [lx, ly] = P(L - 70, (WIDTH + VESSEL) / 2);
    const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 180);
    gr.addColorStop(0, 'rgba(47,184,154,0.16)'); gr.addColorStop(1, 'rgba(47,184,154,0)');
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    // Zone borders: dashed lines across the flow
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

  // Draw a sprite at world (u, v), rotated to a world heading
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
  const gulps = new Map(); // macrophage id -> gulp start time
  function burstParts(u, v, kind, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = speed * (0.5 + Math.random() * 0.7);
      parts.push({ u, v, vu: Math.cos(a) * sp, vv: Math.sin(a) * sp, life, max: life, kind, rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 12 });
    }
  }
  function consumeFx() {
    const g = game;
    for (const f of g.fx.splice(0)) {
      switch (f.k) {
        case 'hit': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.09, max: 0.09, kind: 'hit-spark', rot: Math.random() * 6 }); break;
        case 'bounce':
          parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.12, max: 0.12, kind: 'hit-spark', rot: 0, mul: 0.8 });
          parts.push({ u: f.u, v: f.v, vu: f.du * 160, vv: f.dv * 160 + (Math.random() - 0.5) * 120, life: 0.18, max: 0.18, kind: 'shot', rot: Math.atan2(f.dv, f.du), mul: 0.6 });
          break;
        case 'pop':
          parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.12, max: 0.12, kind: 'hit-spark', rot: 0, mul: f.tuned ? 1.6 : 1.1 });
          burstParts(f.u, f.v, 'kill-shard', f.armored ? 7 : 5, 70, 0.45);
          break;
        case 'gulp': gulps.set(f.id, performance.now()); break;
        case 'trickle': burstParts(f.u, f.v, 'ember', 2, 30, 0.4); break;
        case 'die': burstParts(f.u, f.v, 'puff', f.who === 'mac' ? 10 : 6, 60, 0.6); break;
        case 'expire': burstParts(f.u, f.v, 'puffDim', 3, 20, 0.5); break;
        case 'arrive': parts.push({ u: f.u, v: f.v, vu: 0, vv: 0, life: 0.5, max: 0.5, kind: 'ring' }); break;
        case 'burst': shake = 1; flashT = 0.25; toast('Toxin burst!', 'toxin'); break;
        case 'wave':
          if (g.t > 0.5) toast((f.final ? 'Final wave: ' : 'Wave: ') + (f.armored ? `${f.n - f.armored} bacteria + ${f.armored} armored` : `${f.n} bacteria`), 'bad');
          burstParts(f.u, f.v, 'ember', 8, 50, 0.6);
          break;
        case 'breach': toast('Bacteria reached the Lymph node', 'bad'); break;
        case 'tier': if (f.up) toast(['', 'Tired: your cells slow down', 'Feverish: shots spray, neutrophils die sooner', 'Exhausted: the marrow slows, rings shrink'][f.tier], f.tier >= 2 ? 'bad' : ''); else toast(`Fatigue easing: ${TIER[f.tier]}`, 'good'); break;
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

    // Toxin: warning blink over the Wound, then the shockwave
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

    ctx.globalCompositeOperation = 'lighter';
    // Support rings under everything else
    const pulse = 1 + 0.03 * Math.sin(ts * 6.283 / 1.6);
    const ringMul = (g.ringR || CONFIG.support.ring) / CONFIG.support.ring;
    for (const m of g.mac) if (m.mode === 'support') draw('support-ring', m.u, m.v, null, 0.7 + 0.3 * (pulse - 0.97) / 0.06, pulse * ringMul);
    if (overlay.range) {
      ctx.strokeStyle = 'rgba(255,210,63,0.25)'; ctx.lineWidth = 1 / scale;
      for (const n of g.neut) { const [x, y] = P(n.u, n.v); ctx.beginPath(); ctx.arc(x, y, CONFIG.neutrophil.range, 0, 6.283); ctx.stroke(); }
    }

    // Bacteria
    for (const b of g.bact) {
      let a = 1, mul = 1;
      if (b.eaten) {
        const m = g.mac.find(mm => mm.prey === b);
        const f = m ? Math.max(0, m.gulp / CONFIG.macrophage.gulp) : 0;
        a = f; mul = 0.5 + 0.5 * f;
      }
      const ready = b.age > b.div - 1.5;
      const name = b.armored ? (ready ? 'bacterium-armored-dividing' : 'bacterium-armored') : b.flash > 0 ? 'bacterium-hit' : ready ? 'bacterium-dividing' : 'bacterium';
      draw(name, b.u, b.v, b.rot, a, mul);
    }

    // Macrophages: a stretch toward the prey while gulping, a pop when the mode flips
    for (const m of g.mac) {
      const name = m.mode === 'support' ? 'macrophage-support' : 'macrophage-offense';
      if (m.gulp > 0 && m.prey) {
        const p = 1 - m.gulp / CONFIG.macrophage.gulp, s = Math.sin(p * Math.PI);
        draw(name, m.u, m.v, Math.atan2(m.prey.v - m.v, m.prey.u - m.u), 1, 1, 1 + 0.3 * s, 1 - 0.12 * s);
      } else draw(name, m.u, m.v, null, 1, m.cd > 0 ? 1.06 : 1);
      if (m.flip > 0) {
        const [x, y] = P(m.u, m.v), f = m.flip / 0.4;
        ctx.globalAlpha = f; ctx.strokeStyle = m.mode === 'support' ? PAL.repair : PAL.kill; ctx.lineWidth = 2 / scale;
        ctx.beginPath(); ctx.arc(x, y, 14 + 26 * (1 - f), 0, 6.283); ctx.stroke();
      }
    }

    // Neutrophils: speed trails when boosted; fade as they age out
    for (const n of g.neut) {
      const h = Math.atan2(n.vv, n.vu);
      if (n.boosted && (n.vu * n.vu + n.vv * n.vv) > 100) draw('speed-trail', n.u, n.v, h, 0.9);
      const left = CONFIG.neutrophil.life - n.age;
      draw('neutrophil', n.u, n.v, null, left < 3 ? 0.35 + 0.65 * left / 3 : 1);
    }

    // Shots
    for (const s of g.shots) draw(s.tuned ? 'shot-tuned' : 'shot', s.u, s.v, Math.atan2(s.dv, s.du), 1);

    // Particles
    for (const p of parts) {
      const f = p.life / p.max;
      if (p.kind === 'ring') {
        const [x, y] = P(p.u, p.v);
        ctx.globalAlpha = f * 0.8; ctx.strokeStyle = PAL.cell; ctx.lineWidth = 1.5 / scale;
        ctx.beginPath(); ctx.arc(x, y, 6 + 16 * (1 - f), 0, 6.283); ctx.stroke();
      } else if (p.kind === 'hit-spark') draw('hit-spark', p.u, p.v, p.rot, f, p.mul || 1);
      else if (p.kind === 'shot') draw('shot', p.u, p.v, p.rot, f, p.mul || 1);
      else draw(p.kind, p.u, p.v, p.rot, f);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (flashT > 0) { ctx.fillStyle = `rgba(180,92,255,${flashT * 0.6})`; ctx.fillRect(zr[0], zr[1], zr[2], zr[3]); }
    // Fatigue: edge glow, orange and breathing when Feverish, red heartbeat when Exhausted
    ART.drawFatigueEdge(ctx, VW, VH, g.tier, ts);
    ctx.restore();

    if (paused && !modal) {
      ctx.fillStyle = 'rgba(4,5,10,0.55)'; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = PAL.ui; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${22 / scale}px ${getComputedStyle(document.body).getPropertyValue('--display')}`;
      ctx.fillText('Paused', VW / 2, VH / 2);
    }
  }

  // View-space rect [x, y, w, h] of a zone (below the vessel)
  function zoneRect(z) {
    const [x0, y0] = P(z * ZONE, VESSEL), [x1, y1] = P((z + 1) * ZONE, WIDTH);
    return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
  }
  const FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const ZONE_ICON = ['sector-wound', 'sector-tissue', 'sector-lymph'];
  // Per-zone readouts: name, big bacteria count, mode chip; the Lymph node also gets its timer ring
  function zoneLayer(g, ts) {
    const px = 1 / scale;
    ctx.textBaseline = 'middle';
    for (let z = 0; z < 3; z++) {
      const [x, y, w, h] = zoneRect(z), zn = g.zones[z], cx = x + w / 2;
      // name
      ctx.globalAlpha = 0.9; ctx.textAlign = 'left';
      const ic = img[ZONE_ICON[z]];
      if (ic) ctx.drawImage(ic, x + 8 * px, y + 6 * px, 18 * px, 18 * px);
      ctx.fillStyle = PAL.ui; ctx.font = `600 ${13 * px}px ${FONT}`;
      ctx.fillText(zn.name, x + 30 * px, y + 15 * px);
      // big count, under the name and out of the way of the macrophage posts
      const n = zn.count;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 ${36 * px}px ${FONT}`;
      ctx.globalAlpha = n ? 0.85 : 0.22; ctx.fillStyle = n ? PAL.germHi : PAL.ui;
      ctx.fillText(String(n), x + 10 * px, y + 62 * px);
      const nw = ctx.measureText(String(n)).width;
      ctx.font = `500 ${11 * px}px ${MONO}`; ctx.globalAlpha = n ? 0.7 : 0.3; ctx.fillStyle = PAL.ui;
      ctx.fillText(n === 1 ? 'bacterium' : 'bacteria', x + 16 * px + nw, y + 60 * px);
      ctx.textBaseline = 'middle';
      // mode chip (tap target is the whole zone)
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
      // lymph node timer
      if (z === 2) {
        const r = 20 * px, tx = x + w - r - 14 * px, ty = y + r + 12 * px;
        ART.drawTimer(ctx, tx, ty, r, g.lymph.timer, { beating: n > 0, t: ts });
        ctx.fillStyle = g.lymph.timer > 0 ? '#FFB3BC' : PAL.uiDim; ctx.font = `500 ${10.5 * px}px ${MONO}`; ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(g.lymph.timer * CONFIG.lymph.fill)}/${CONFIG.lymph.fill}s`, tx, ty + r + 13 * px);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- progress bar ----
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
    const W = w / dpr, H = h / dpr, bh = 10, pad = 14;
    ART.drawProgress(pctx, pad, (H - bh) / 2, W - pad * 2, bh, Math.min(1, game.t / CONFIG.level.duration), levelEvents(game));
  }

  // ---- HUD ----
  function nextEventText(g) {
    const m = g.markers().filter(e => e.t > g.t).sort((a, b) => a.t - b.t)[0];
    if (!m) return null;
    const what = m.kind === 'toxin' ? 'toxin burst' : m.final ? 'final wave' : m.armored ? 'armored wave' : 'wave';
    return `Next: ${what} in ${fmt(m.t - g.t)}`;
  }
  function hud() {
    const g = game; if (!g) return;
    $('#clock').textContent = fmt(Math.min(g.t, 5999));
    const fz = $('#fatigue');
    fz.dataset.tier = g.tier; $('#fTier').textContent = TIER[g.tier];
    const fk = `${g.fatigue.toFixed(1)}|${g.tier}`;
    if (fz.dataset.k !== fk) {
      fz.dataset.k = fk;
      $('#ftrack').innerHTML = ART.fatigueMeterSVG(g.fatigue, CONFIG.fatigue);
      const icon = ['fatigue-fine', 'fatigue-tired', 'fatigue-feverish', 'fatigue-exhausted'][g.tier];
      if ($('#fIcon').dataset.art !== icon) { $('#fIcon').dataset.art = icon; $('#fIcon').src = artUrl(icon); }
    }
    if (document.activeElement !== $('#output')) $('#output').value = Math.round(g.output * 100);
    $('#outVal').textContent = `${g.outputMul().toFixed(1)}× marrow`;
    const cap = CONFIG.level.cellCap, cells = g.cellCount();
    $('#cellCount').textContent = `${cells}/${cap} cells`;
    $('#nCount').textContent = g.neut.length; $('#mCount').textContent = g.mac.length;
    document.querySelectorAll('#marrowSeg button').forEach(b => {
      const on = b.dataset.make === g.marrow.make;
      b.setAttribute('aria-pressed', on);
      b.querySelector('.fill').style.width = on ? `${Math.round(g.marrow.prog * 100)}%` : '0';
    });
    const tx = g.pendingToxin();
    // Banner: the one thing worth knowing right now
    const bn = $('#banner'); let cls = '', html;
    const armored = g.bact.filter(b => b.armored && !b.eaten);
    const supportZones = g.zones.filter(z => z.mode === 'support').length;
    if (tx && tx.state === 'coming') {
      cls = 'alarm';
      html = `<b>Toxin burst in ${Math.ceil(tx.at - g.t)} s.</b> It will kill every cell in the Wound.`;
    } else if (g.tier >= 2) {
      cls = 'bad'; html = g.tier >= 3 ? `<b>Exhausted.</b> The marrow slows and Support rings shrink. Turn the body output down to recover.` : `<b>Feverish.</b> Shots spray and neutrophils die sooner. Turn the body output down to recover.`;
    } else if (g.zones[2].count > 0) {
      cls = 'bad'; html = `<b>Bacteria in the Lymph node.</b> Clear them before the ring fills.`;
    } else if (armored.length && !supportZones && g.t < 200) {
      html = `<b>Armored bacteria.</b> Plain shots bounce off. Offense macrophages swallow them; a Support zone makes shots pierce.`;
    } else if (g.tier === 1 && g.output > 0.55) {
      html = `<b>Tired.</b> Your cells move slower. Output above ${CONFIG.output.rest.toFixed(2)}× keeps building fatigue.`;
    } else if (g.t < 20) {
      html = `<b>Tap a zone</b> to flip its macrophages between Offense and Support.`;
    } else if (cells >= cap) {
      html = `<b>${cap} cells, the cap.</b> Macrophages never die, so they keep their slots.`;
    } else if (g.t >= CONFIG.level.duration) {
      html = `<b>No more waves.</b> Clear what's left to win.`;
    } else html = nextEventText(g) || '';
    bn.className = cls; if (bn.innerHTML !== html) bn.innerHTML = html;
    const st = $('#speedTag'); st.hidden = SPEEDS[speedIdx] === 1; st.textContent = `${SPEEDS[speedIdx]}×`;
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
  function showStart() {
    openModal('start', `
      <span class="eyebrow">Immune RTS · prototype v2</span>
      <h2>Papercut: <span class="glow">hold the line</span></h2>
      <p>Someone keeps poking the cut. Bacteria spill out of the Wound and drift toward the Lymph node, doubling as they go.</p>
      <ol class="howto">
        <li><b>Marrow:</b> choose what gets made next, Neutrophils (the gunners) or Macrophages (slower to make, never die).</li>
        <li><b>Tap a zone</b> to flip its macrophages: <b style="color:var(--kill)">Offense</b> swallows bacteria, <b style="color:var(--repair)">Support</b> rings make neutrophils fast and their shots pierce armor.</li>
        <li><b>Body output</b> speeds the marrow up, but running hot builds <b>fatigue</b>: Tired, then Feverish, then Exhausted, each worse than the last. Ease off to recover.</li>
        <li>Toxin bursts are marked on the bar. Each one kills every cell in the Wound, so plan to rebuild.</li>
        <li>Win: survive the progress bar and clear every bacterium. Lose: the Lymph node timer fills.</li>
      </ol>
      <div class="btnrow"><button class="btn primary" id="go" type="button">Start</button></div>
      <button class="linkbtn" id="openGuide" type="button">How each unit works</button>`);
    $('#go').addEventListener('click', () => { closeModal(); newGame(); });
    $('#openGuide').addEventListener('click', () => showGuide('start', 'units'));
  }
  function guideHtml(tab) {
    const C = CONFIG;
    const tabs = [['goal', 'Goal'], ['units', 'Your cells'], ['enemies', 'Enemies'], ['controls', 'Controls']];
    let body = '';
    if (tab === 'goal') body = `
      <p>The level runs on a fixed ${Math.round(C.level.duration / 60)}-minute script. The bar at the top fills over the level; circles are waves still to come and diamonds are toxin bursts.</p>
      <ol class="howto">
        <li><b>Win</b> once the bar is full and every bacterium on the map is dead.</li>
        <li><b>Lose</b> when the Lymph node timer fills. It fills while any bacteria are in the Lymph node (${C.lymph.fill} s in all) and holds while it is clear.</li>
        <li><b>Stars:</b> 1 for winning, 2 if the timer never passed half, 3 if no bacterium ever reached the Lymph node.</li>
      </ol>`;
    if (tab === 'units') body = `
      <div class="unit"><img data-art="neutrophil" alt=""><h4>Neutrophil</h4><p class="why">The gunner. Zigzags toward the nearest bacterium and shoots it from range.</p>
        <ul><li>Fires a gold antibody every <b>${C.neutrophil.fireEvery} s</b> at anything within about ${Math.round(C.neutrophil.range / 16)} cell widths; <b>${C.bacteria.hp} hits</b> kill a bacterium.</li><li>Plain shots <b>bounce off armor</b>.</li><li>Lives <b>${C.neutrophil.life} s</b>. Made every ${C.marrow.neutEvery} s.</li></ul></div>
      <div class="unit"><img data-art="macrophage-offense" alt=""><h4>Macrophage on Offense</h4><p class="why">The swallower. Heads for the nearest bacterium in its zone and swallows it whole.</p>
        <ul><li>One swallow every <b>${C.macrophage.eatEvery} s</b>, armored or not.</li><li><b>Never dies</b> (except to toxin), but slow, and takes ${Math.round(C.marrow.macEvery / C.marrow.neutEvery)}× as long to make.</li></ul></div>
      <div class="unit"><img data-art="macrophage-support" alt=""><h4>Macrophage on Support</h4><p class="why">The booster. Stays put with a soft ring around it. Kills nothing itself.</p>
        <ul><li>Neutrophils inside the ring move <b>${Math.round((C.support.speedMul - 1) * 100)}% faster</b> and fire <b>tuned shots</b>: white-hot, 1 hit kills, pierces armor.</li></ul></div>
      <p>New macrophages go to whichever zone has the fewest, and a macrophage takes the mode of the zone it stands in.</p>`;
    if (tab === 'enemies') body = `
      <div class="unit"><img data-art="bacterium" alt=""><h4>Bacterium</h4><p class="why">Drifts with the lymph flow toward the Lymph node and doubles every ${C.bacteria.doubling} s while it has room. Crowded zones spill over faster.</p>
        <ul><li>Beaten by ${C.bacteria.hp} neutrophil hits, 1 tuned hit, or one Offense swallow.</li><li>It stretches in two just before it divides.</li></ul></div>
      <div class="unit"><img data-art="bacterium-armored" alt=""><h4>Armored bacterium</h4><p class="why">Same drift, doubles every ${C.bacteria.armorDoubling} s. Plain shots spark off its shell.</p>
        <ul><li>Beaten by Offense macrophages or tuned shots.</li></ul></div>
      <div class="unit"><img data-art="toxin-burst" alt=""><h4>Toxin burst</h4><p class="why">Scripted at one third and two thirds of the level. The Wound flashes red for ${C.toxin.warn} s, then a shockwave kills every one of your cells in the Wound.</p>
        <ul><li>Bacteria are unharmed. Your marrow has to rebuild what you lose.</li></ul></div>`;
    if (tab === 'controls') body = `
      <ol class="howto">
        <li><b>Marrow switch</b> (bottom): Neutrophils or Macrophages, a steady flow up to ${C.level.cellCap} cells on the field.</li>
        <li><b>Tap a zone</b> to flip it between Offense and Support. Every zone starts on Offense.</li>
        <li><b>Body output</b> slider: from ${C.output.min}× to ${C.output.max}× marrow speed. Above ${C.output.rest}× fatigue builds; below it fatigue recovers.</li>
        <li><b>Fatigue</b>: Tired at ${C.fatigue.tired} (cells ${Math.round((1 - C.fatigue.tiredSpeed) * 100)}% slower), Feverish at ${C.fatigue.feverish} (shots spray, neutrophils live ${Math.round((1 - C.fatigue.feverLife) * 100)}% shorter), Exhausted at ${C.fatigue.exhausted} (marrow at ${Math.round(C.fatigue.exhaustedMarrow * 100)}%, Support rings shrink).</li>
        <li><b>Pause</b>: the II button, or Space.</li>
        <li>Keyboard: <b>1 2 3</b> flip zones, <b>N</b> / <b>M</b> marrow, <b>-</b> / <b>=</b> body output.</li>
      </ol>
      <p>Cells place themselves: neutrophils hunt the nearest bacterium anywhere on the map.</p>`;
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
    endShown = true;
    const r = game.result, s = r.stats;
    openModal('end', `
      <span class="eyebrow">Papercut · ${fmt(r.t)}</span>
      <h2>${r.win ? '<span class="glow">Infection cleared</span>' : '<span class="bad">The infection took hold</span>'}</h2>
      <p>${r.reason}</p>
      ${r.win ? `<div class="stars">${[0, 1, 2].map(i => `<img data-art="${i < r.stars ? 'star' : 'star-empty'}" alt="">`).join('')}</div>` : ''}
      <ul class="goals">${r.goals.map(g => `<li class="${g.hit ? 'hit' : ''}">${g.text}</li>`).join('')}</ul>
      <div class="stats">
        <div><b>${s.shotKills}</b><span>shot down</span></div>
        <div><b>${s.swallows}</b><span>swallowed</span></div>
        <div><b>${s.toxinDeaths}</b><span>cells lost to toxin</span></div>
        <div><b>${s.peak}</b><span>most bacteria at once</span></div>
        <div><b>${Math.round(r.peakTimer * 100)}%</b><span>timer peak</span></div>
        <div><b>${Math.round(r.fatiguePeak)}</b><span>fatigue peak (${TIER[r.fatiguePeak >= CONFIG.fatigue.exhausted ? 3 : r.fatiguePeak >= CONFIG.fatigue.feverish ? 2 : r.fatiguePeak >= CONFIG.fatigue.tired ? 1 : 0]})</span></div>
      </div>
      <canvas id="graph" aria-label="Bacteria in each zone over the match"></canvas>
      <div class="legend"><span style="--c:${PAL.germ}">Wound</span><span style="--c:${PAL.antibody}">Tissue</span><span style="--c:${PAL.damage}">Lymph node</span><span style="--c:rgba(180,92,255,.5)">toxin burst</span></div>
      <div class="btnrow"><button class="btn primary" id="again" type="button">Play again</button><button class="btn" id="newSeed" type="button">New seed</button></div>`);
    drawGraph();
    $('#again').addEventListener('click', () => { closeModal(); newGame(); });
    $('#newSeed').addEventListener('click', () => { seed = 1 + Math.floor(Math.random() * 9999); store.set('immuneRtsV2.seed', seed); $('#seed').value = seed; closeModal(); newGame(); });
  }
  function drawGraph() {
    const c = $('#graph'), r = c.getBoundingClientRect(), k = Math.min(3, window.devicePixelRatio || 1);
    c.width = r.width * k; c.height = r.height * k;
    const g = c.getContext('2d'); g.scale(k, k);
    const W = r.width, H = r.height, padL = 26, padB = 16, h = game.history;
    const T = Math.max(CONFIG.level.duration, game.t), maxY = Math.max(10, ...h.map(p => Math.max(...p.z)));
    const X = t => padL + (W - padL - 4) * t / T, Y = v => (H - padB) - (H - padB - 6) * v / maxY;
    g.font = `10px ${MONO}`; g.fillStyle = PAL.uiDim; g.strokeStyle = 'rgba(221,230,245,0.12)'; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of [0, Math.round(maxY / 2), maxY]) { g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(W, Y(v)); g.stroke(); g.fillText(v, padL - 4, Y(v)); }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= T; t += 60) { g.textAlign = X(t) > W - 20 ? 'right' : 'center'; g.fillText(fmt(t), Math.min(X(t), W), H - padB + 3); }
    g.fillStyle = 'rgba(180,92,255,0.5)';
    for (const tx of game.toxins) g.fillRect(X(tx.at) - 1, 4, 2, H - padB - 4);
    [PAL.germ, PAL.antibody, PAL.damage].forEach((col, z) => {
      g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
      h.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, X(p.t), Y(p.z[z])));
      g.stroke();
    });
  }

  // ---- game flow ----
  function newGame() {
    game = new Game('papercut', seed);
    paused = false; acc = 0; endShown = false; parts = []; shake = 0; flashT = 0; gulps.clear();
    $('#pauseBtn').setAttribute('aria-label', 'Pause');
    hud();
  }

  let hudT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (game && !paused && !modal && !game.result) {
      acc += dt * SPEEDS[speedIdx];
      let n = 0;
      while (acc >= STEP && n < 16) { game.step(STEP); acc -= STEP; n++; }
      if (n === 16) acc = 0;
    }
    if (game) {
      consumeFx();
      const pdt = paused || modal ? 0 : dt * SPEEDS[speedIdx];
      for (const p of parts) { p.life -= pdt; p.u += p.vu * pdt; p.v += p.vv * pdt; p.vu *= 0.92; p.vv *= 0.92; if (p.vr) p.rot += p.vr * pdt; }
      if (parts.length) parts = parts.filter(p => p.life > 0);
      shake = Math.max(0, shake - pdt * 2.5); flashT = Math.max(0, flashT - pdt);
      if (game.result && !endShown) { hud(); setTimeout(showEnd, 700); endShown = true; }
    }
    render(now);
    drawProg();
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; hud(); }
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
    const u = portrait ? y : x;
    tapZone(zoneOf(u));
  });
  function setPaused(p) {
    paused = p; $('#pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    $('#devPause').textContent = paused ? 'Resume' : 'Pause';
  }
  $('#pauseBtn').addEventListener('click', () => setPaused(!paused));
  $('#marrowSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !game) return;
    game.setMarrow(b.dataset.make); hud();
  });
  $('#output').addEventListener('input', e => { if (game) { game.setOutput(+e.target.value / 100); hud(); } });
  $('#helpBtn').addEventListener('click', () => { if (modal === 'guide') return; if (!modal) showGuide('game', 'units'); });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); if (!modal) setPaused(!paused); }
    if (!game || modal) return;
    if (e.key >= '1' && e.key <= '3') tapZone(+e.key - 1);
    if (e.key === 'n' || e.key === 'N') game.setMarrow('neut');
    if (e.key === 'm' || e.key === 'M') game.setMarrow('mac');
    if (e.key === '-' || e.key === '_') game.setOutput(game.output - 0.1);
    if (e.key === '=' || e.key === '+') game.setOutput(game.output + 0.1);
  });

  // ---- dev tools ----
  $('#devBtn').addEventListener('click', () => { $('#dev').hidden = !$('#dev').hidden; });
  $('#devClose').addEventListener('click', () => { $('#dev').hidden = true; });
  $('#speed').addEventListener('input', e => { speedIdx = +e.target.value; $('#speedVal').textContent = `${SPEEDS[speedIdx]}×`; hud(); });
  $('#devPause').addEventListener('click', () => setPaused(!paused));
  $('#devStep').addEventListener('click', () => { if (game && !game.result) for (let i = 0; i < 60; i++) game.step(STEP); });
  $('#devSkip').addEventListener('click', () => { if (game && !game.result) for (let i = 0; i < 900 && !game.result; i++) game.step(STEP); });
  $('#seed').addEventListener('change', e => { seed = Math.max(1, Math.floor(+e.target.value || 1)); store.set('immuneRtsV2.seed', seed); });
  $('#devRestart').addEventListener('click', () => { closeModal(); newGame(); });
  $('#devNewSeed').addEventListener('click', () => { seed = 1 + Math.floor(Math.random() * 9999); $('#seed').value = seed; store.set('immuneRtsV2.seed', seed); closeModal(); newGame(); });
  $('#cheatBact').addEventListener('click', () => { if (game) for (let i = 0; i < 10; i++) game.spawnBact(false); });
  $('#cheatArmor').addEventListener('click', () => { if (game) for (let i = 0; i < 4; i++) game.spawnBact(true); });
  $('#cheatClear').addEventListener('click', () => { if (game) for (const b of game.bact) if (!b.eaten) { b.dead = true; game.fx.push({ k: 'pop', u: b.u, v: b.v }); } });
  $('#ovRange').addEventListener('change', e => { overlay.range = e.target.checked; });
  $('#ovRotate').addEventListener('change', e => { overlay.portrait = e.target.checked; resize(); });

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
          if (grp === 'support') buildGraphics();
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
  function saveTuning() { store.set('immuneRtsV2.tuning', tuningDiff()); }
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
  // Slider track: cool up to the sustainable output, heating past it
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

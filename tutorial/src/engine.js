'use strict';
// ---------------------------------------------------------------------------
// Cytostorm tutorial clips: the drawing engine.
// Every clip is a pure function of its clock t (seconds), so clips loop, replay
// and scrub cleanly. Clips are authored like the game's sim: u runs along the
// lymph flow (0 = Wound end), v runs across it (0 = blood vessel edge). The stage
// is U x V world units. The stage is always drawn vertical, like the game on
// every screen: flow top to bottom (Wound at the top, Lymph node at the bottom),
// vessel on the left. A wide canvas letterboxes the tall stage.
// Needs the art kit's global ART (prototype/assets/assets.js), loaded.
// ---------------------------------------------------------------------------
const CYT = (function () {
  const U = 400, V = 300, VES = 34;
  const PAL = ART.palette;
  const FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const BLINK = 0.6, BLINK_WARN = 0.7; // same as the game (sim.js)
  const COLORS = { neut: '#3FE6FF', net: '#FFD23F', nk: '#B9A6FF', mac: '#FF7A3D' };

  // Candida has no art-kit sprite yet; same stand-in the game uses
  if (!ART.svg.yeast) {
    ART.svg.yeast = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="y" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#FBFFD6"/><stop offset=".6" stop-color="#D6EC6A" stop-opacity=".85"/><stop offset="1" stop-color="#9DBA2A" stop-opacity=".25"/></radialGradient></defs><ellipse cx="13" cy="17" rx="8" ry="7" fill="url(#y)" stroke="#EAF59A" stroke-width="1.2"/><circle cx="22.5" cy="10.5" r="4" fill="url(#y)" stroke="#EAF59A" stroke-width="1"/><circle cx="12" cy="17" r="2" fill="#7E9A1E" opacity=".7"/></svg>';
    ART.meta.yeast = { size: 32, radius: 8 };
  }

  // ---- math ----
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const lerp2 = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
  const ease = p => p * p * (3 - 2 * p);
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const noise = (s, t) => Math.sin(t * 1.3 + s * 12.9) * 0.5 + Math.sin(t * 2.7 + s * 4.1) * 0.3 + Math.sin(t * 0.7 + s * 7.7) * 0.2;
  function rng(seed) {
    let a = seed | 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Keyframed path: [[t, u, v, 'l'?], ...]; eased between keys ('l' = linear into that key), plus a gentle wander
  function path(keys, wob = 0, seed = 0) {
    return t => {
      let i = 0;
      while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
      const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
      let u = a[1], v = a[2];
      if (b !== a && t > a[0]) { const q = clamp((t - a[0]) / (b[0] - a[0])), p = b[3] === 'l' ? q : ease(q); u = lerp(a[1], b[1], p); v = lerp(a[2], b[2], p); }
      if (wob) { u += wob * noise(seed, t); v += wob * noise(seed + 7.3, t); }
      return [u, v];
    };
  }
  // Straight drift from a start point, with wander
  const drift = (u0, v0, t0, vu, vv, wob = 0, seed = 0) => t => [u0 + vu * (t - t0) + wob * noise(seed, t), v0 + vv * (t - t0) + wob * noise(seed + 7.3, t)];

  // ---- frame state ----
  let ctx = null, R = null;
  function P(u, v) { return R.portrait ? [R.ox + v * R.k, R.oy + u * R.k] : [R.ox + u * R.k, R.oy + v * R.k]; }
  const ang = a => (R.portrait ? Math.PI / 2 - a : a);

  // ---- sprites, pre-rendered per size ----
  const cache = new Map();
  function sprite(name, px) {
    const b = Math.max(4, Math.ceil(px / 4) * 4), key = name + '@' + b;
    let c = cache.get(key);
    if (!c) {
      const im = ART.ready[name]; if (!im) return null;
      const m = ART.meta[name] || {}, bw = m.box ? m.box[0] : (m.size || 64), bh = m.box ? m.box[1] : (m.size || 64);
      c = document.createElement('canvas'); c.width = b; c.height = Math.max(2, Math.round(b * bh / bw));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (cache.size > 600) cache.clear();
      cache.set(key, c);
    }
    return c;
  }
  // Draw art at world (u, v) so its body has world radius r; rot = world heading
  function spr(name, u, v, r, rot, alpha, sx, sy) {
    const m = ART.meta[name] || { size: 64, radius: 16 };
    const bw = m.box ? m.box[0] : m.size, bh = m.box ? m.box[1] : m.size, per = r / (m.radius || bw / 4);
    const w = bw * per * R.k, h = bh * per * R.k;
    const c = sprite(name, w * R.dpr); if (!c) return;
    const ax = m.anchor ? m.anchor[0] / bw : 0.5, ay = m.anchor ? m.anchor[1] / bh : 0.5;
    const [x, y] = P(u, v), W = w * (sx || 1), H = h * (sy || 1);
    ctx.globalAlpha = alpha == null ? 1 : clamp(alpha);
    if (rot != null || sx || sy) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang(rot || 0));
      ctx.drawImage(c, -W * ax, -H * ay, W, H); ctx.restore();
    } else ctx.drawImage(c, x - W * ax, y - H * ay, W, H);
    ctx.globalAlpha = 1;
  }
  // Screen-space icon
  function icon(name, x, y, s, alpha) {
    const c = sprite(name, s * R.dpr); if (!c) return;
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.drawImage(c, x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1;
  }
  function glow(u, v, r, rgba, alpha = 1) {
    const [x, y] = P(u, v), rr = r * R.k, g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp(alpha); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
  }
  // Net pen (as in the game's drawPen): a glowing gold membrane ring that wobbles, grows in fast,
  // tightens to 75% and fades over its life; faint gold fill, dashed bright edge crawling round
  function penR(r, nt, life = 2.5) { const f = clamp(1 - nt / life), born = clamp(nt / 0.18); return r * (0.6 + 0.4 * born) * (0.75 + 0.25 * f); }
  function pen(u, v, r, nt, t, life = 2.5, seed = 0) {
    if (nt < 0 || nt > life) return;
    const f = clamp(1 - nt / life), al = Math.min(1, f * 1.6), RR = penR(r, nt, life) * R.k, [cx, cy] = P(u, v), n = 28;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * 6.283, rr = RR * (1 + 0.05 * Math.sin(a * 5 + t * 7 + seed) + 0.03 * Math.sin(a * 3 - t * 4));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.14 * al; ctx.fillStyle = '#FFD23F'; ctx.fill();
    ctx.globalAlpha = 0.45 * al; ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = Math.max(2, 4 * R.k * 0.6); ctx.stroke();
    ctx.globalAlpha = 0.95 * al; ctx.strokeStyle = '#FFF0A8'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -t * 12; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  // The game's reproduction blink: a white strobe at 7 Hz; tm = seconds left on the strobe
  function blinkGlow(u, v, r, tm) {
    if (!(tm > 0) || Math.floor(tm * 14) % 2) return;
    const [x, y] = P(u, v), rr = r * 2.4 * R.k, g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = op;
  }
  function ringFx(u, v, p, color, r0 = 3, r1 = 12) {
    if (p < 0 || p > 1) return;
    const [x, y] = P(u, v);
    ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, R.k * 0.8);
    ctx.beginPath(); ctx.arc(x, y, (r0 + (r1 - r0) * p) * R.k, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function burst(u, v, p, seed, n, art, dist, size) {
    if (p < 0 || p > 1) return;
    const r = rng(seed * 977 + 13);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = dist * (0.5 + 0.7 * r()) * (1 - (1 - p) * (1 - p));
      spr(art, u + Math.cos(a) * d, v + Math.sin(a) * d, size, a + p * 8 * (r() - 0.5), 1 - p);
    }
  }
  function dots(u, v, p, seed, n, rgba, dist, size) {
    if (p < 0 || p > 1) return;
    const r = rng(seed * 577 + 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = dist * (0.4 + 0.8 * r()) * Math.sqrt(p);
      glow(u + Math.cos(a) * d, v + Math.sin(a) * d, size, rgba, 1 - p);
    }
  }

  // ---- entities ----
  // { art, r, pos(t), t0, t1, rot: number | 'vel' | fn, die: 'pop' | 'puff' | 'storm' | 'lilac' | null,
  //   blinks: [[start, end]], hits: [t], arrive: color, alpha(t), mul(t), eat: { by, t }, art2(t) }
  let ents = [], shots = [], idc = 1;
  function ent(o) { const e = Object.assign({ id: idc++, t0: -1e9, t1: 1e9, r: 6, rot: null, blinks: [], hits: [], gulps: [] }, o); ents.push(e); return e; }
  const alive = (e, t) => t >= e.t0 && t < e.t1;
  // Two daughters at time td; the parent warns before and both blink after (like the game)
  function divide(e, td, o = {}) {
    const [u, v] = e.pos(td), a = o.angle != null ? o.angle : 0, d = o.dist || e.r * 2.2, then = o.then || [0, 0];
    e.t1 = td; e.die = null; e.blinks.push([td - BLINK_WARN, td]);
    const kids = [-1, 1].map((s, i) => ent({
      art: e.art, r: e.r, rot: e.rot, t0: td, blinks: [[td, td + BLINK]], die: e.dieKid || 'pop', dieKid: e.dieKid, hitArt: e.hitArt,
      pos: (sd => t => { const p = ease(seg(t, td, td + 0.35)), dt = Math.max(0, t - td); return [u + s * Math.cos(a) * d * p + then[0] * dt + (o.wob || 1.5) * noise(sd, t) * seg(t, td, td + 1), v + s * Math.sin(a) * d * p + then[1] * dt + (o.wob || 1.5) * noise(sd + 3, t) * seg(t, td, td + 1)]; })(e.id * 10 + i),
    }));
    return kids;
  }
  // A macrophage swallow: prey shrinks into the macrophage over 0.45 s
  function gulp(mac, prey, tg, spit) {
    mac.gulps.push({ t: tg, prey });
    if (spit) { prey.spit = { by: mac, t: tg }; return; }
    prey.eat = { by: mac, t: tg }; prey.t1 = tg + 0.45; prey.die = null;
  }
  // Shot from a shooter (entity or [u, v]) at a target entity; returns when it lands
  function shot(t0, from, to, o = {}) {
    const f = Array.isArray(from) ? from : from.pos(t0), [tu, tv] = to.pos(t0 + 0.1);
    const d = Math.hypot(tu - f[0], tv - f[1]), dur = Math.max(0.06, d / (o.speed || 520));
    const s = { t0, t1: t0 + dur, f, to, tuned: !!o.tuned, bounce: !!o.bounce, fizzle: !!o.fizzle, pass: !!o.pass, miss: o.miss };
    shots.push(s);
    if (!s.bounce && !s.fizzle && !s.pass) to.hits.push(s.t1);
    return s.t1;
  }
  // n shots from shooters (cycling) at a target, every `every` s; returns the last landing time
  function volley(t0, from, to, n, every, o) {
    const list = Array.isArray(from) && !Array.isArray(from[0]) && from.length && from[0].pos ? from : [from];
    let last = t0;
    for (let i = 0; i < n; i++) last = shot(t0 + i * every, list[i % list.length], to, o);
    return last;
  }
  function headingOf(e, t) {
    if (typeof e.rot === 'number') return e.rot;
    if (typeof e.rot === 'function') return e.rot(t);
    if (e.rot === 'vel') { const [a, b] = e.pos(t - 0.05), [c, d] = e.pos(t + 0.05); return Math.abs(c - a) + Math.abs(d - b) > 0.01 ? Math.atan2(d - b, c - a) : 0; }
    return null;
  }
  function drawEnt(e, t) {
    if (t < e.t0) return;
    if (t >= e.t1) {
      const p = (t - e.t1) / 0.45, [u, v] = e.deathAt || e.pos(e.t1);
      if (e.die === 'pop') { if (p < 0.2) spr('hit-spark', u, v, e.r * 0.9, 0, 1 - p * 5); burst(u, v, p, e.id, e.big ? 7 : 4, 'kill-shard', e.r * 3, Math.max(1.2, e.r * 0.25)); }
      else if (e.die === 'puff') dots(u, v, p * 0.8, e.id, e.big ? 10 : 5, 'rgba(63,230,255,0.8)', e.r * 2.5, e.r * 0.45);
      else if (e.die === 'storm') burst(u, v, p * 0.9, e.id, 3, 'storm-shard', e.r * 4, Math.max(1.4, e.r * 0.3));
      else if (e.die === 'lilac') dots(u, v, p, e.id, 7, 'rgba(185,166,255,0.9)', e.r * 3, e.r * 0.4);
      return;
    }
    let [u, v] = e.pos(t), al = e.alpha ? e.alpha(t) : 1, mul = e.mul ? e.mul(t) : 1, sx, sy, rot = headingOf(e, t);
    if (e.eat) {
      const f = 1 - seg(t, e.eat.t, e.eat.t + 0.45);
      if (t > e.eat.t) { const [mu, mv] = e.eat.by.pos(t), q = 1 - f; u = lerp(u, mu, q); v = lerp(v, mv, q); al *= f; mul *= 0.5 + 0.5 * f; }
    }
    if (e.spit && t > e.spit.t) {
      // swallowed, then spat back out
      const p = seg(t, e.spit.t, e.spit.t + 0.9), [mu, mv] = e.spit.by.pos(t), into = p < 0.4 ? ease(p / 0.4) : 1 - ease((p - 0.4) / 0.6);
      u = lerp(u, mu, into); v = lerp(v, mv, into); al *= 1 - 0.6 * into;
    }
    for (const g of e.gulps) if (t > g.t && t < g.t + 0.45) {
      const p = (t - g.t) / 0.45, s = Math.sin(p * Math.PI), [pu, pv] = g.prey.pos(g.t);
      rot = Math.atan2(pv - v, pu - u); sx = 1 + 0.3 * s; sy = 1 - 0.12 * s;
    }
    const hit = e.hits.some(h => t >= h && t < h + 0.09);
    let art = e.art2 ? e.art2(t) : e.art;
    if (hit && e.hitArt) art = e.hitArt;
    if (hit && !e.hitArt) al *= 0.6;
    if (e.flip) for (const f of e.flip) if (t >= f.t) art = f.art;
    spr(art, u, v, e.r * mul, rot, al, sx, sy);
    for (const b of e.blinks) if (t >= b[0] && t < b[1]) blinkGlow(u, v, e.r, b[1] - t);
    if (e.arrive && t - e.t0 < 0.4) ringFx(u, v, (t - e.t0) / 0.4, e.arrive, 3, 14);
  }
  function drawShots(t) {
    for (const s of shots) {
      if (t < s.t0) continue;
      const [tu, tv] = s.to.pos(Math.min(s.t1, s.to.t1 - 0.001));
      const ex = s.miss ? [tu + s.miss[0], tv + s.miss[1]] : [tu, tv];
      if (t < s.t1) {
        const p = (t - s.t0) / (s.t1 - s.t0), u = lerp(s.f[0], ex[0], p), v = lerp(s.f[1], ex[1], p);
        spr(s.tuned ? 'shot-tuned' : 'shot', u, v, s.tuned ? 2.4 : 1.7, Math.atan2(ex[1] - s.f[1], ex[0] - s.f[0]));
      } else if (s.pass) {
        // passes straight through: keep flying
        const d = t - s.t1, dir = Math.atan2(ex[1] - s.f[1], ex[0] - s.f[0]);
        if (d < 0.25) spr('shot', ex[0] + Math.cos(dir) * d * 500, ex[1] + Math.sin(dir) * d * 500, 1.7, dir, 1 - d * 4);
      } else {
        const d = t - s.t1;
        if (s.bounce) {
          if (d < 0.1) spr('hit-spark', ex[0], ex[1], 4, 0, 1 - d * 10);
          if (d < 0.2) { const back = Math.atan2(s.f[1] - ex[1], s.f[0] - ex[0]) + 0.9; spr('shot', ex[0] + Math.cos(back) * d * 300, ex[1] + Math.sin(back) * d * 300, 1.2, back, 1 - d * 5); }
        } else if (s.fizzle) { if (d < 0.3) glow(ex[0], ex[1], 3, 'rgba(63,230,255,0.4)', 1 - d / 0.3); }
        else if (d < 0.09) spr('hit-spark', ex[0], ex[1], s.tuned ? 5.5 : 3.5, 0, 1 - d / 0.09);
      }
    }
  }

  // ---- stage: background, zones, labels ----
  const bgCache = new Map();
  function background(bg) {
    const key = [R.w, R.h, R.portrait, R.k, JSON.stringify(bg)].join('|');
    let c = bgCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = Math.ceil(R.w * R.dpr); c.height = Math.ceil(R.h * R.dpr);
      const g = c.getContext('2d'), saved = ctx; ctx = g;
      g.scale(R.dpr, R.dpr);
      const [x0, y0] = P(0, 0), [x1, y1] = P(U, V), sw = Math.abs(x1 - x0), sh = Math.abs(y1 - y0);
      const tile = ART.ready.tissue;
      if (tile) { g.globalAlpha = 0.45; const tw = 128 * R.k * (bg.tile || 0.8), th = tw * tile.naturalHeight / tile.naturalWidth; for (let y = y0; y < y0 + sh; y += th) for (let x = x0; x < x0 + sw; x += tw) g.drawImage(tile, x, y, tw + 0.5, th + 0.5); g.globalAlpha = 1; }
      if (bg.lymph) { const [lx, ly] = P(bg.lymph[0], bg.lymph[1]), r = 130 * R.k, gr = g.createRadialGradient(lx, ly, 0, lx, ly, r); gr.addColorStop(0, 'rgba(47,184,154,0.18)'); gr.addColorStop(1, 'rgba(47,184,154,0)'); g.fillStyle = gr; g.fillRect(x0, y0, sw, sh); }
      if (bg.vessel !== false) {
        const vb = ART.ready['vessel-blood'];
        if (vb) {
          g.save(); g.translate(x0, y0);
          if (R.portrait) { g.translate(VES * 1.1 * R.k, 0); g.rotate(Math.PI / 2); }
          const tw = 96 * R.k * 0.6, th = VES * 1.25 * R.k;
          for (let x = 0; x < U * R.k; x += tw) g.drawImage(vb, x, -VES * 0.15 * R.k, tw + 0.5, th);
          g.restore();
        }
      }
      if (bg.wound) {
        const wi = ART.ready.wound, [wx, wy] = P(bg.wound[0], bg.wound[1]), s = bg.woundSize || 1;
        if (wi) { g.save(); g.translate(wx, wy); if (R.portrait) g.rotate(Math.PI / 2); g.globalAlpha = 0.9; g.drawImage(wi, -70 * R.k * s, -35 * R.k * s, 140 * R.k * s, 70 * R.k * s); g.restore(); }
      }
      if (bg.dividers) {
        g.strokeStyle = 'rgba(221,230,245,0.16)'; g.lineWidth = 1.5; g.setLineDash([6, 6]);
        for (const du of bg.dividers) { const [a, b] = P(du, VES), [cx, cy] = P(du, V); g.beginPath(); g.moveTo(a, b); g.lineTo(cx, cy); g.stroke(); }
        g.setLineDash([]);
      }
      ctx = saved;
      if (bgCache.size > 30) bgCache.clear();
      bgCache.set(key, c);
    }
    ctx.drawImage(c, 0, 0, R.w, R.h);
  }
  // Screen rect of the stage band u0..u1 (below the vessel)
  function zoneRect(u0, u1) {
    const [x0, y0] = P(u0, VES), [x1, y1] = P(u1, V);
    return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
  }
  const ZICON = { Wound: 'sector-wound', Tissue: 'sector-tissue', 'Lymph node': 'sector-lymph' };
  function zoneName(u0, u1, name) {
    const [x, y] = zoneRect(u0, u1);
    icon(ZICON[name] || 'sector-tissue', x + 16, y + 15, 18, 0.9);
    ctx.globalAlpha = 0.9; ctx.fillStyle = PAL.ui; ctx.font = `600 12.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 28, y + 15); ctx.globalAlpha = 1;
  }
  function zoneCount(u0, u1, n) {
    const [x, y] = zoneRect(u0, u1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 30px ${FONT}`; ctx.globalAlpha = n ? 0.8 : 0.22; ctx.fillStyle = n ? PAL.germHi : PAL.ui;
    ctx.fillText(String(n), x + 10, y + 56);
    const nw = ctx.measureText(String(n)).width;
    ctx.font = `500 11px ${MONO}`; ctx.globalAlpha = n ? 0.7 : 0.3; ctx.fillStyle = PAL.ui;
    ctx.fillText(n === 1 ? 'antigen' : 'antigens', x + 16 + nw, y + 54); ctx.globalAlpha = 1;
  }
  // The Offense / Support chip at the bottom of a zone; flip = 0..1 just after a flip (a pop)
  function zoneChip(u0, u1, mode, flip = 0) {
    const [x, y, w, h] = zoneRect(u0, u1), sup = mode === 'support', col = sup ? PAL.repair : PAL.kill;
    const s = 1 + 0.15 * Math.sin(clamp(flip) * Math.PI), cw = 92 * s, ch = 24 * s, cx = x + w / 2 - cw / 2, cy = y + h - 24 - 8 - (ch - 24) / 2;
    ctx.fillStyle = 'rgba(10,13,24,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    rrect(cx, cy, cw, ch, ch / 2); ctx.fill(); ctx.stroke();
    icon(sup ? 'mode-support' : 'mode-offense', cx + 15 * s, cy + ch / 2, 18 * s);
    ctx.fillStyle = col; ctx.font = `600 ${12 * s}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(sup ? 'Support' : 'Offense', cx + 28 * s, cy + ch / 2 + 0.5);
    return [cx + cw / 2, cy + ch / 2];
  }
  // The Lymph node's breach clock, as in v3: while an organ's germs sit in the node its clock fills (organ icon
  // in the ring, name below); a full clock costs that organ a bar. A clean node shows an empty ring and "clear".
  // Staph and Candida both hurt the spleen, the default.
  function lymphTimer(u0, u1, frac, beating, t, organ = 'spleen', lv = 4) {
    const [x, y, w] = zoneRect(u0, u1), r = 20, tx = x + w - r - 12, ty = y + r + 10, on = frac > 0.001 || beating;
    ART.drawTimer(ctx, tx, ty, r, frac, { beating, t });
    ctx.font = `500 10px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!on) { ctx.fillStyle = PAL.uiDim; ctx.fillText('clear', tx, ty + r + 12); return [tx, ty]; }
    organImg(`${organ === 'kidney' ? 'kidneys' : organ}-${ORGAN_STATE[lv]}`, tx - r * 0.75, ty - r * 0.56, r * 1.5, r * 1.12, beating ? 1 : 0.55);
    ctx.fillStyle = beating ? '#FFB3BC' : PAL.uiDim; ctx.fillText((ORGANS.find(o => o[0] === organ) || [0, organ])[1], tx, ty + r + 12);
    return [tx, ty];
  }
  // A sector's power button, as in v3: 30 px round, bottom-right of the sector. On: green ring and glow;
  // off: dashed grey. shake 0..1 wobbles it sideways (the "last zone" refusal). Returns its centre.
  function zonePower(u0, u1, on, shake = 0) {
    const [x, y, w, h] = zoneRect(u0, u1), cx = x + w - 26 + Math.sin(shake * 40) * 4 * shake, cy = y + h - 26, r = 15;
    ctx.save();
    ctx.fillStyle = 'rgba(10,13,24,.82)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? '#7BE0A0' : '#5A6070';
    if (on) { ctx.shadowColor = 'rgba(123,224,160,.55)'; ctx.shadowBlur = 8; } else ctx.setLineDash([3, 2.5]);
    ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
    ctx.strokeStyle = on ? '#7BE0A0' : '#6B7180'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy + 0.5, 6.5, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy - 1.5); ctx.stroke();
    ctx.restore();
    return [cx, cy];
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  // A callout tag pointing at a world spot (screen-upright text)
  function tag(u, v, text, color = PAL.ui, alpha = 1, dy = -16) {
    if (alpha <= 0) return;
    const [x, y] = P(u, v);
    ctx.font = `600 11.5px ${FONT}`;
    const w = ctx.measureText(text).width + 14, h = 20;
    let bx = clamp(x - w / 2, R.sx + 4, R.sx + R.sw - w - 4), by = y + dy - h;
    if (by < R.sy + 2) by = y + 14;
    ctx.globalAlpha = clamp(alpha);
    ctx.fillStyle = 'rgba(10,13,24,0.88)'; ctx.strokeStyle = color; ctx.lineWidth = 1;
    rrect(bx, by, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + w / 2, by + h / 2 + 0.5);
    ctx.globalAlpha = 1;
  }
  // A dashed flow arrow along u, for "they drift this way"
  function flowArrow(u0, u1, v, alpha, t) {
    if (alpha <= 0) return;
    const [x0, y0] = P(u0, v), [x1, y1] = P(u1, v);
    ctx.globalAlpha = clamp(alpha) * 0.6; ctx.strokeStyle = PAL.germHi; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = PAL.germHi; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 8 * Math.cos(a - 0.5), y1 - 8 * Math.sin(a - 0.5)); ctx.lineTo(x1 - 8 * Math.cos(a + 0.5), y1 - 8 * Math.sin(a + 0.5)); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- HUD pieces (screen space, inside the strips the clip asks for) ----
  const UNIT_LOWER = { neut: 'neutrophils', net: 'net neutrophils', nk: 'NK cells', mac: 'macrophages' };
  function hudCards(rect, st) {
    const [x, y, w, h] = rect, gap = 6, cw = (w - gap * 2) / 3, names = ['Wound', 'Tissue', 'Lymph node'];
    R.hud.cards = [];
    for (let z = 0; z < 3; z++) {
      const cx = x + z * (cw + gap), mix = st.mix[z], mode = st.modes ? st.modes[z] : 'offense', open = st.open === z;
      const off = st.off && st.off[z], boost = st.boost && st.boost[z];
      ctx.fillStyle = off ? '#07090F' : '#0A0D18'; ctx.strokeStyle = open ? PAL.cell : off ? '#3A4360' : boost ? '#FFD23F' : '#1E2540'; ctx.lineWidth = open || boost ? 1.5 : 1;
      if (off && !open) ctx.setLineDash([4, 4]);
      rrect(cx, y, cw, h, 10); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); rrect(cx, y, cw, h, 10); ctx.clip();
      if (off) ctx.globalAlpha = 0.45;
      ctx.fillStyle = PAL.ui; ctx.font = `600 ${cw < 100 ? 11 : 12}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(names[z], cx + 7, y + 13);
      const nameW = ctx.measureText(names[z]).width, ml = mode === 'support' ? 'Support' : 'Offense';
      ctx.font = `500 10px ${MONO}`;
      if (7 + nameW + 8 + ctx.measureText(ml).width + 7 <= cw) { ctx.fillStyle = mode === 'support' ? PAL.repair : PAL.kill; ctx.textAlign = 'right'; ctx.fillText(ml, cx + cw - 7, y + 13); }
      // mix bar
      const bx = cx + 7, bw = cw - 14, by = y + h / 2 - 1, keys = Object.keys(mix).filter(k => mix[k] > 0.004);
      ctx.fillStyle = '#10152A'; rrect(bx, by, bw, 7, 3.5); ctx.fill();
      let ax = bx;
      for (const k of keys) { const ww = (bw - 2 * (keys.length - 1)) * mix[k]; ctx.fillStyle = COLORS[k]; ctx.shadowColor = COLORS[k]; ctx.shadowBlur = 5; ctx.fillRect(ax, by, ww, 7); ax += ww + 2; }
      ctx.shadowBlur = 0;
      ctx.font = `500 10px ${MONO}`; ctx.fillStyle = '#7A86A0'; ctx.textAlign = 'left';
      if (off) { ctx.globalAlpha = 1; ctx.fillStyle = '#9AA4BC'; ctx.fillText('Off · no new cells', bx, y + h - 11); }
      else ctx.fillText(keys.length === 1 ? `100% ${UNIT_LOWER[keys[0]]}` : keys.map(k => Math.round(mix[k] * 100) + '%').join(' · '), bx, y + h - 11);
      if (boost && !off) { ctx.font = `600 11px ${MONO}`; ctx.fillStyle = '#FFD23F'; ctx.shadowColor = '#FFD23F'; ctx.shadowBlur = 6; ctx.textAlign = 'right'; ctx.fillText(boost, cx + cw - 7, y + h - 11); ctx.shadowBlur = 0; }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (st.flash > 0) { ctx.globalAlpha = clamp(st.flash); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 2; ctx.shadowColor = '#FFD23F'; ctx.shadowBlur = 12; rrect(cx - 1, y - 1, cw + 2, h + 2, 11); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      R.hud.cards.push([cx + cw / 2, y + h / 2]);
    }
  }
  // The production sheet over the bottom of the stage: one slider per unit, with 100% and 0% buttons
  function hudSheet(st) {
    const rows = st.units, rh = 40, w = Math.min(R.w - 16, 330), ph = (st.power ? 40 : 0) + (st.apply ? 40 : 0) + (st.loadouts ? 52 : 0), h = 34 + rows.length * rh + 8 + ph, x = (R.w - w) / 2, y = R.sy + R.sh - h - 6; // HUD layer: may overhang a narrow letterboxed stage
    const pop = ease(clamp(st.show));
    if (pop <= 0) return;
    ctx.save(); ctx.globalAlpha = pop; ctx.translate(0, (1 - pop) * 30);
    ctx.fillStyle = 'rgba(10,13,24,0.96)'; ctx.strokeStyle = '#1E2540'; ctx.lineWidth = 1;
    rrect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ui; ctx.font = `600 13px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${st.zone} production`, x + 12, y + 17);
    ctx.font = `500 11px ${MONO}`; ctx.fillStyle = '#7A86A0'; ctx.textAlign = 'right'; ctx.fillText('adds up to 100%', x + w - 12, y + 17);
    R.hud.sliders = {}; R.hud.pills = {};
    rows.forEach((u, i) => {
      const ry = y + 34 + i * rh, col = COLORS[u], val = st.mix[u];
      icon({ neut: 'neutrophil', net: 'neutrophil-net', nk: 'nk-cell', mac: 'macrophage-offense' }[u], x + 22, ry + 14, 26);
      ctx.fillStyle = PAL.ui; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText({ neut: 'Neutrophils', net: 'Net neutrophils', nk: 'NK cells', mac: 'Macrophages' }[u], x + 40, ry + 8);
      ctx.font = `500 12px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(Math.round(val * 100) + '%', x + w - 12, ry + 8);
      const pw = 36, pg = 5, tx0 = x + 40, tx1 = x + w - 12 - pw * 2 - pg - 14, ty = ry + 25;
      R.hud.pills[u] = {};
      [['0%', 0], ['100%', 1]].forEach(([lab, at], j) => {
        const px = x + w - 12 - pw * 2 - pg + j * (pw + pg), on = Math.abs(val - at) < 0.005;
        ctx.fillStyle = on ? col : '#10152A'; ctx.strokeStyle = on ? col : '#1E2540'; ctx.lineWidth = 1;
        rrect(px, ty - 10, pw, 20, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = on ? '#04050A' : PAL.ui; ctx.font = `600 11px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(lab, px + pw / 2, ty + 0.5);
        R.hud.pills[u][at ? 'full' : 'zero'] = [px + pw / 2, ty + (1 - pop) * 30];
      });
      ctx.fillStyle = '#10152A'; rrect(tx0, ty - 3, tx1 - tx0, 6, 3); ctx.fill();
      ctx.fillStyle = col; rrect(tx0, ty - 3, (tx1 - tx0) * val, 6, 3); ctx.fill();
      const kx = tx0 + (tx1 - tx0) * val;
      ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ty, 8, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#04050A'; ctx.lineWidth = 2; ctx.stroke();
      R.hud.sliders[u] = { x0: tx0, x1: tx1, y: ty + (1 - pop) * 30 };
    });
    // "Use this mix everywhere" with an "Apply to all zones" button: copies this zone's mix to the others
    let rowY = y + 34 + rows.length * rh + 4;
    // "Loadouts": three saved mixes; tap a saved slot to use it here, tap Save to store this zone's mix.
    // The slot matching the current mix lights cyan.
    if (st.loadouts) {
      const L = st.loadouts, cy = rowY + 14, sw = 50, sg = 6, bx0 = x + w - 12 - 3 * sw - 2 * sg;
      ctx.strokeStyle = '#1E2540'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 12, rowY - 2); ctx.lineTo(x + w - 12, rowY - 2); ctx.stroke();
      ctx.fillStyle = PAL.ui; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Loadouts', x + 12, cy);
      R.hud.slots = []; R.hud.saves = [];
      for (let i = 0; i < 3; i++) {
        const sx = bx0 + i * (sw + sg), mix = L.slots[i], on = L.active === i, hot = L.saving === i;
        ctx.fillStyle = on ? 'rgba(63,230,255,0.16)' : '#10152A'; ctx.strokeStyle = on ? PAL.cell : '#1E2540'; ctx.lineWidth = on ? 1.5 : 1;
        if (on) { ctx.shadowColor = PAL.cell; ctx.shadowBlur = 8; }
        rrect(sx, cy - 12, sw, 24, 6); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = on ? PAL.cell : PAL.ui; ctx.font = `600 11px ${MONO}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), sx + 9, cy + 0.5);
        const mx = sx + 17, mw = sw - 23;
        if (mix) { let ax = mx; for (const k of Object.keys(mix).filter(k => mix[k] > 0.004)) { const ww = mw * mix[k]; ctx.fillStyle = COLORS[k]; ctx.fillRect(ax, cy - 2.5, ww, 5); ax += ww; } }
        else { ctx.strokeStyle = '#3A4360'; ctx.setLineDash([2, 2]); ctx.strokeRect(mx + 0.5, cy - 2.5, mw - 1, 5); ctx.setLineDash([]); }
        ctx.fillStyle = hot ? PAL.cell : '#7A86A0'; ctx.font = `500 10px ${FONT}`; ctx.fillText('Save', sx + sw / 2, cy + 23);
        R.hud.slots.push([sx + sw / 2, cy + (1 - pop) * 30]); R.hud.saves.push([sx + sw / 2, cy + 23 + (1 - pop) * 30]);
      }
      rowY += 52;
    }
    if (st.apply) {
      const cy = rowY + 16, bw = 128, bx = x + w - 12 - bw, hot = st.apply === 'pressed';
      ctx.strokeStyle = '#1E2540'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 12, rowY - 2); ctx.lineTo(x + w - 12, rowY - 2); ctx.stroke();
      ctx.fillStyle = PAL.ui; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Use this mix everywhere', x + 12, cy);
      ctx.fillStyle = hot ? '#FFD23F' : '#10152A'; ctx.strokeStyle = '#FFD23F'; rrect(bx, cy - 11, bw, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hot ? '#04050A' : '#FFD23F'; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Apply to all zones', bx + bw / 2, cy + 0.5);
      R.hud.apply = [bx + bw / 2, cy + (1 - pop) * 30];
      rowY += 40;
    }
    // "Make cells for the <zone>" with On / Off (switching a zone off stops new cells there)
    if (st.power) {
      const py = rowY, cy = py + 16, bw = 44, bx = x + w - 12 - bw * 2;
      ctx.strokeStyle = '#1E2540'; ctx.beginPath(); ctx.moveTo(x + 12, py - 2); ctx.lineTo(x + w - 12, py - 2); ctx.stroke();
      ctx.fillStyle = PAL.ui; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`Make cells for the ${st.zone}`, x + 12, cy);
      R.hud.power = {};
      [['On', 'on'], ['Off', 'off']].forEach(([lab, key], j) => {
        const on = st.power === key, px = bx + j * bw, col = key === 'on' ? PAL.cell : '#9AA4BC';
        ctx.fillStyle = on ? col : '#10152A'; ctx.strokeStyle = on ? col : '#1E2540';
        rrect(px + 1, cy - 11, bw - 2, 22, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = on ? '#04050A' : PAL.ui; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(lab, px + bw / 2, cy + 0.5);
        R.hud.power[key] = [px + bw / 2, cy + (1 - pop) * 30];
      });
    }
    ctx.restore();
  }
  // Fatigue heart, as drawn in the game (drawHeart in ui.js); st.beat carries the beat phase between frames
  const HEART_STOPS = [[0, [255, 111, 156]], [35, [255, 138, 61]], [60, [255, 46, 69]], [85, [120, 20, 90]], [100, [60, 6, 40]]];
  function heartColor(f) {
    let a = HEART_STOPS[0], b = HEART_STOPS[HEART_STOPS.length - 1];
    for (let i = 0; i < HEART_STOPS.length - 1; i++) if (f >= HEART_STOPS[i][0] && f <= HEART_STOPS[i + 1][0]) { a = HEART_STOPS[i]; b = HEART_STOPS[i + 1]; break; }
    const k = (f - a[0]) / Math.max(1, b[0] - a[0]);
    return a[1].map((x, i) => Math.round(x + (b[1][i] - x) * k));
  }
  function heartPath(cx, cy, w, h) {
    ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.42);
    ctx.bezierCurveTo(cx - w * 0.62, cy - h * 0.02, cx - w * 0.5, cy - h * 0.62, cx, cy - h * 0.24);
    ctx.bezierCurveTo(cx + w * 0.5, cy - h * 0.62, cx + w * 0.62, cy - h * 0.02, cx, cy + h * 0.42); ctx.closePath();
  }
  // beat speed only (never shown as a number): faster as fatigue builds
  const bpmOf = (f, burning) => 55 + 1.35 * f + (burning ? 25 : 0);
  // o.ghost: storm forecast while charging (yellow safe, orange if organs would lose bars, red with o.lethal);
  // past 100 (Overload) the full heart floods red, harder the further over
  function heart(cx, cy, size, f, t, st, o = {}) {
    const over = Math.max(0, f - 100);
    f = clamp(f, 0, 100);
    const bpm = bpmOf(f, o.burning);
    st.beat = (st.beat || 0) + R.dt * bpm / 60; if (st.beat >= 1) st.beat -= Math.floor(st.beat);
    const p = st.beat, pulse = Math.exp(-(((p - 0.05) / 0.045) ** 2)) + 0.6 * Math.exp(-(((p - 0.24) / 0.05) ** 2));
    const amp = o.burning ? 0.17 : 0.07 + 0.05 * f / 100, s = 1 + amp * pulse, hw = size * s, hh = size * s, col = heartColor(f);
    ctx.save(); heartPath(cx, cy, hw, hh); ctx.clip();
    ctx.fillStyle = '#1A0B16'; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
    const top = cy + hh * 0.42, bottom = cy - hh * 0.36, lvl = y => top - (top - bottom) * y / 100;
    const wave = (x, y0) => y0 + Math.sin(x * 0.35 + t * 5) * (1 + 1.5 * pulse);
    const fillTo = (y, style) => { ctx.beginPath(); ctx.moveTo(cx - hw, cy + hh); for (let x = cx - hw; x <= cx + hw; x += 3) ctx.lineTo(x, wave(x, lvl(y))); ctx.lineTo(cx + hw, cy + hh); ctx.closePath(); ctx.fillStyle = style; ctx.fill(); };
    if (o.ghost != null) {
      const g = Math.min(100, o.ghost), leth = !!o.lethal, risky = o.ghost >= 100;
      fillTo(g, leth ? 'rgba(255,59,78,0.35)' : risky ? 'rgba(255,138,61,0.35)' : 'rgba(255,210,63,0.28)');
      ctx.strokeStyle = leth ? '#FF3B4E' : risky ? '#FF8A3D' : '#FFD23F'; ctx.setLineDash([3, 2]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx - hw, lvl(g)); ctx.lineTo(cx + hw, lvl(g)); ctx.stroke(); ctx.setLineDash([]);
    }
    if (f > 0.5) { const gr = ctx.createLinearGradient(0, lvl(f), 0, top); gr.addColorStop(0, `rgba(${col},${0.85 + 0.15 * pulse})`); gr.addColorStop(1, `rgba(${heartColor(Math.min(100, f + 25))},1)`); fillTo(f, gr); }
    ctx.strokeStyle = 'rgba(221,230,245,0.25)'; ctx.lineWidth = 1;
    for (const tk of [35, 60, 85]) { ctx.beginPath(); ctx.moveTo(cx - 3, lvl(tk)); ctx.lineTo(cx + 3, lvl(tk)); ctx.stroke(); }
    if (over > 0) { ctx.fillStyle = `rgba(255,40,70,${Math.min(0.75, 0.3 + over / 120 + 0.2 * pulse)})`; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2); }
    ctx.restore();
    heartPath(cx, cy, hw, hh);
    ctx.lineWidth = 1.6; ctx.strokeStyle = o.burning ? `rgba(255,122,61,${0.7 + 0.3 * pulse})` : `rgba(${col},${0.55 + 0.45 * pulse})`;
    ctx.shadowColor = o.burning ? '#FF7A3D' : `rgb(${col})`; ctx.shadowBlur = 4 + 10 * pulse * (o.burning ? 1.6 : 1);
    ctx.stroke(); ctx.shadowBlur = 0;
    if (o.lethal && Math.floor(t * 4) % 2) {
      ctx.strokeStyle = '#FF3B4E'; ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(cx, cy - hh * 0.24); ctx.lineTo(cx - 3, cy - hh * 0.05); ctx.lineTo(cx + 3, cy + hh * 0.08); ctx.lineTo(cx - 2, cy + hh * 0.25); ctx.lineTo(cx, cy + hh * 0.4); ctx.stroke();
    }
    return bpm;
  }
  const TIER = f => (f > 100 ? 'Overload' : f >= 85 ? 'Exhausted' : f >= 60 ? 'Feverish' : f >= 35 ? 'Tired' : 'Fine');
  const TIER_COL = { Fine: '#FF8FB1', Tired: '#FF9A4D', Feverish: '#FF7A3D', Exhausted: '#C77DFF', Overload: '#FF3B4E' };
  // The five organs, as in the game's organ button (4 bars each; any organ at 0 is Host failure)
  const ORGANS = [['heart', 'Heart'], ['kidneys', 'Kidneys'], ['lungs', 'Lungs'], ['liver', 'Liver'], ['spleen', 'Spleen'], ['brain', 'Brain']];
  const ORGAN_STATE = ['failed', 'failing', 'damaged', 'strained', 'healthy'], ORGAN_WORD = ['Failed', 'Failing', 'Damaged', 'Strained', 'Healthy'];
  const organLevel = h => Math.max(0, Math.min(4, Math.ceil(h - 1e-9)));
  function organImg(name, x, y, w, h, alpha = 1) { const c = sprite(name, w * R.dpr); if (!c) return; ctx.globalAlpha = alpha; ctx.drawImage(c, x, y, w, h); ctx.globalAlpha = 1; }
  function pips(x, y, hp, lv, pw = 3, ph = 3, gap = 1) {
    const on = lv >= 4 ? '#7BE0A0' : lv >= 2 ? '#F2B33D' : '#FF5A5A';
    for (let i = 1; i <= 4; i++) { ctx.fillStyle = hp >= i - 1e-9 ? on : hp > i - 1 ? '#F2B33D' : '#1E2540'; ctx.fillRect(x + (i - 1) * (pw + gap), y, pw, ph); }
  }
  // The organ button beside the fatigue label: five organs with 4 pips each; red border in Overload
  const OB = { ow: 19, oh: 14, gap: 3 }, organButtonW = () => ORGANS.length * (OB.ow + OB.gap) - OB.gap + 8;
  function organButton(x, y, hp, over, t, hit) {
    const { ow, oh, gap } = OB, w = organButtonW(), h = oh + 9;
    ctx.fillStyle = '#10152A'; ctx.strokeStyle = over ? PAL.damage : '#1E2540'; ctx.lineWidth = 1;
    if (over) { ctx.shadowColor = PAL.damage; ctx.shadowBlur = 6; }
    rrect(x, y, w, h, 7); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ORGANS.forEach(([k], i) => {
      const lv = organLevel(hp[i]), ox = x + 4 + i * (ow + gap), fl = lv === 1 ? 0.6 + 0.4 * Math.sin(t * 20) : 1;
      organImg(`${k}-${ORGAN_STATE[lv]}`, ox, y + 1, ow, oh, fl);
      if (hit && hit[i]) { ctx.globalCompositeOperation = 'lighter'; organImg(`${k}-${ORGAN_STATE[lv]}`, ox, y + 1, ow, oh, 0.6); ctx.globalCompositeOperation = 'source-over'; }
      pips(ox + 2, y + oh + 3, hp[i], lv);
    });
    R.hud.organs = [x, y, w, h];
    return w;
  }
  // The game's Organ status window (paused): one row per organ with its bars and what it costs you now
  const ORGAN_EFFECT = {
    heart: ['Body output tops out at 1.25×', 'Body output tops out at 1.5×', 'Body output tops out at 1.75×'],
    kidneys: ['Recovery 75% slower', 'Recovery 50% slower', 'Recovery 25% slower'],
    lungs: ['All your cells 30% slower', 'All your cells 20% slower', 'All your cells 10% slower'],
    liver: ['Cells made 45% slower', 'Cells made 30% slower', 'Cells made 15% slower'],
    spleen: ['Cell limit 90', 'Cell limit 120', 'Cell limit 150'],
    brain: ['Every cell wanders 60% more; delirium', 'Every cell wanders 40% more; mix changes lag 3 s', 'Every cell wanders 20% more'],
  };
  function organPanel(hp, a) {
    if (a <= 0) return;
    const w = Math.min(R.w - 20, 330), rh = 34, h = 58 + ORGANS.length * rh + 44, x = (R.w - w) / 2, y = Math.max(8, R.sy + (R.sh - h) / 2);
    ctx.save(); ctx.globalAlpha = clamp(a);
    ctx.fillStyle = 'rgba(4,5,10,0.6)'; ctx.fillRect(0, 0, R.w, R.h);
    ctx.fillStyle = 'rgba(10,13,24,0.98)'; ctx.strokeStyle = '#1E2540'; rrect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 10px ${MONO}`; ctx.fillStyle = '#7A86A0'; ctx.fillText('BODY · PAUSED', x + 14, y + 16);
    ctx.font = `650 17px ${FONT}`; ctx.fillStyle = PAL.ui; ctx.fillText('Organ status', x + 14, y + 36);
    ORGANS.forEach(([k, name], i) => {
      const ry = y + 58 + i * rh, lv = organLevel(hp[i]);
      organImg(`${k}-${ORGAN_STATE[lv]}`, x + 12, ry + 4, 32, 24);
      ctx.font = `600 12.5px ${FONT}`; ctx.fillStyle = PAL.ui; ctx.fillText(name, x + 52, ry + 10);
      const nw = ctx.measureText(name).width; pips(x + 58 + nw, ry + 7, hp[i], lv, 9, 6, 2);
      ctx.font = `600 11px ${FONT}`; ctx.fillStyle = lv >= 4 ? '#7BE0A0' : lv >= 2 ? '#F2B33D' : '#FF5A5A'; ctx.textAlign = 'right'; ctx.fillText(ORGAN_WORD[lv], x + w - 14, ry + 10); ctx.textAlign = 'left';
      const line = lv >= 4 ? `No penalty. At 3 bars: ${ORGAN_EFFECT[k][2].toLowerCase()}.` : lv === 0 ? 'Host failure.' : `Now: ${ORGAN_EFFECT[k][lv - 1]}.`;
      let fs = 11; ctx.font = `500 ${fs}px ${FONT}`; while (fs > 8.5 && ctx.measureText(line).width > w - 66) ctx.font = `500 ${fs -= 0.5}px ${FONT}`;
      ctx.fillStyle = lv >= 4 ? '#7A86A0' : '#FFB3A0'; ctx.fillText(line, x + 52, ry + 25);
    });
    const by = y + h - 36, bw = 110, bx = x + (w - bw) / 2;
    ctx.fillStyle = PAL.cell; rrect(bx, by, bw, 26, 8); ctx.fill();
    ctx.fillStyle = '#04050A'; ctx.font = `600 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Resume', bx + bw / 2, by + 13.5);
    R.hud.resume = [bx + bw / 2, by + 13];
    ctx.restore();
  }
  // Heart + Body output slider; st.out = 0..1 slider, st.f = fatigue
  function hudOutput(rect, st, t, o = {}) {
    const [x, y, w, h] = rect;
    ctx.fillStyle = '#0A0D18'; ctx.strokeStyle = '#1E2540'; ctx.lineWidth = 1; rrect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    heart(x + 30, y + h / 2 + 2, Math.min(40, h - 12), st.f, t, st, o);
    const lx = x + 58, rw = x + w - 10 - lx;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `600 12px ${FONT}`; ctx.fillStyle = PAL.ui;
    ctx.fillText('Body output', lx, y + 13);
    const mul = 0.5 * Math.pow(4, st.out);
    // the game's label: "Body output 1.9×", the number being the effective production speed
    const bw = ctx.measureText('Body output').width; ctx.font = `500 11px ${MONO}`; ctx.fillStyle = '#9AA4BC'; ctx.fillText(`${mul.toFixed(1)}×`, lx + bw + 6, y + 13.5);
    const ty = y + h / 2 + 1, tx0 = lx, tx1 = x + w - 12, rest = 0.6;
    const gr = ctx.createLinearGradient(tx0, 0, tx1, 0);
    gr.addColorStop(0, 'rgba(63,230,255,.15)'); gr.addColorStop(rest, 'rgba(63,230,255,.45)'); gr.addColorStop(rest + 0.001, '#FFD23F'); gr.addColorStop(rest + (1 - rest) / 2, '#FF7A3D'); gr.addColorStop(1, '#FF3B4E');
    ctx.fillStyle = gr; rrect(tx0, ty - 3, tx1 - tx0, 6, 3); ctx.fill();
    const kx = tx0 + (tx1 - tx0) * st.out;
    ctx.shadowColor = 'rgba(255,210,63,.6)'; ctx.shadowBlur = 8; ctx.fillStyle = PAL.ui; ctx.beginPath(); ctx.arc(kx, ty, 9, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#04050A'; ctx.lineWidth = 2; ctx.stroke();
    const tier = TIER(st.f);
    ctx.font = `600 11.5px ${FONT}`; ctx.fillStyle = TIER_COL[tier]; ctx.textAlign = 'left'; ctx.fillText(tier, lx, y + h - 11);
    const tw = ctx.measureText('Exhausted').width, obx = lx + tw + 8;
    if (obx + organButtonW() <= x + w - (o.mulTag ? 70 : 6)) organButton(obx, y + h - 24, st.organs || [4, 4, 4, 4, 4], st.f > 100, t, st.organHit);
    if (o.mulTag) { ctx.fillStyle = PAL.kill; ctx.textAlign = 'right'; ctx.font = `600 11px ${MONO}`; ctx.fillText(o.mulTag, x + w - 10, y + h - 11); }
    R.hud.slider = { x0: tx0, x1: tx1, y: ty };
    R.hud.heart = [x + 30, y + h / 2];
  }
  // Storm button: state 'idle' | 'held' | 'risky' (organs would lose bars) | 'lethal' (an organ would fail) | 'burning'. charge 0..1: the 5 s press-and-hold
  // fills a ring around the icon and the button from the bottom; full charge pulses (fires on release)
  function hudStorm(rect, state, label, charge = 0, t = 0) {
    const [x, y, w, h] = rect, col = { idle: '#1E2540', held: PAL.antibody, risky: '#FF8A3D', lethal: PAL.damage, burning: PAL.kill }[state];
    const full = charge >= 1, pulse = full ? 0.5 + 0.5 * Math.sin(t * 16) : 0, ink = state === 'idle' ? '#7A86A0' : col;
    ctx.fillStyle = '#0A0D18'; ctx.strokeStyle = col; ctx.lineWidth = state === 'idle' ? 1 : 1.5;
    if (state === 'lethal' || state === 'risky' || full) { ctx.shadowColor = state === 'lethal' ? 'rgba(255,59,78,.6)' : state === 'risky' ? 'rgba(255,138,61,.6)' : ink; ctx.shadowBlur = 12 + 10 * pulse; }
    rrect(x, y, w, h, 10); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    const cx = x + w / 2, cy = y + h / 2 - 7;
    if (charge > 0) {
      ctx.save(); rrect(x, y, w, h, 10); ctx.clip();
      ctx.globalAlpha = 0.14 + 0.12 * charge + 0.12 * pulse; ctx.fillStyle = ink; ctx.fillRect(x, y + h * (1 - charge), w, h * charge);
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(122,134,160,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = ink; ctx.shadowColor = ink; ctx.shadowBlur = 6 + 8 * pulse;
      ctx.beginPath(); ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.min(1, charge)); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineCap = 'butt';
    }
    icon(state === 'lethal' || state === 'risky' ? 'storm-lethal' : state === 'burning' ? 'storm-afterburn' : 'storm', cx, cy, 28 * (1 + 0.08 * pulse));
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = state === 'idle' ? '#7A86A0' : col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Storm', x + w / 2, y + h - 10);
    R.hud.storm = [x + w / 2, y + h / 2];
  }
  function hudProgress(rect, frac, events) {
    const [x, y, w, h] = rect, bh = 10;
    ART.drawProgress(ctx, x + 14, y + (h - bh) / 2, w - 28, bh, frac, events);
    R.hud.prog = { x0: x + 14, x1: x + w - 14, y: y + h / 2 };
  }
  // Touch indicator. keys: [[t, () => [x, y], pressed?], ...]; eased between keys
  function finger(t, keys) {
    if (!keys.length || t < keys[0][0] - 0.3) return;
    let i = 0; while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const pa = a[1](), pb = b[1](), q = b === a ? 0 : ease(seg(t, a[0], b[0]));
    const x = lerp(pa[0], pb[0], q), y = lerp(pa[1], pb[1], q);
    const pressed = t >= b[0] ? !!b[2] : !!a[2] && (!!b[2] || q < 0.15);
    const last = keys[keys.length - 1], fade = keys[0][0] - t > 0 ? 1 - (keys[0][0] - t) / 0.3 : last[3] === 'out' && t > last[0] ? 1 - seg(t, last[0], last[0] + 0.3) : 1;
    if (fade <= 0) return;
    // ripple on each press start
    for (let j = 0; j < keys.length; j++) if (keys[j][2] && !(j && keys[j - 1][2])) {
      const d = t - keys[j][0]; if (d < 0 || d > 0.5) continue;
      const [rx, ry] = keys[j][1]();
      ctx.globalAlpha = (1 - d / 0.5) * 0.7 * fade; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx, ry, 12 + 26 * d / 0.5, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = (pressed ? 0.5 : 0.3) * fade; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y, pressed ? 11 : 14, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Screen rect of the blood vessel strip down the stage's left edge
  function vesselRect() { return [R.sx, R.sy, VES * 1.1 * R.k, R.sh]; }
  // UI spotlight: dims everything but rect [x, y, w, h], rings it and labels it. Drawn over the HUD.
  function spotlight(rect, a, label, t = 0) {
    if (!rect || a <= 0) return;
    const [x, y, w, h] = rect, pad = 4, rx = x - pad, ry = y - pad, rw = w + pad * 2, rh = h + pad * 2;
    ctx.save(); ctx.globalAlpha = clamp(a);
    ctx.beginPath(); ctx.rect(0, 0, R.w, R.h); if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 10); else ctx.rect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(4,5,10,0.62)'; ctx.fill('evenodd');
    ctx.strokeStyle = PAL.cell; ctx.lineWidth = 2; ctx.shadowColor = PAL.cell; ctx.shadowBlur = 8 + 6 * (0.5 + 0.5 * Math.sin(t * 6));
    rrect(rx, ry, rw, rh, 10); ctx.stroke(); ctx.shadowBlur = 0;
    if (label) {
      ctx.font = `600 12px ${FONT}`;
      const lw = ctx.measureText(label).width + 16, lh = 22;
      let lx = clamp(rx + rw / 2 - lw / 2, 4, R.w - lw - 4), ly = ry - lh - 6;
      if (ly < 2) ly = ry + rh + 6;
      if (ly + lh > R.h - 2) { ly = ry + 8; lx = clamp(rx + rw + 6, 4, R.w - lw - 4); }
      ctx.fillStyle = PAL.cell; rrect(lx, ly, lw, lh, lh / 2); ctx.fill();
      ctx.fillStyle = '#04050A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + lw / 2, ly + lh / 2 + 0.5);
    }
    ctx.restore();
  }
  // A game toast: a dark pill near the top of the stage
  function toast(text, a) {
    if (a <= 0) return;
    ctx.font = `600 12.5px ${FONT}`;
    const w = Math.min(R.sw - 24, ctx.measureText(text).width + 28), h = 30, x = R.sx + (R.sw - w) / 2, y = R.sy + 40;
    ctx.globalAlpha = clamp(a); ctx.fillStyle = 'rgba(10,13,24,0.94)'; ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 1;
    rrect(x, y, w, h, h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ui; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + h / 2 + 0.5); ctx.globalAlpha = 1;
  }
  // Big screen-space flash over the stage
  function flash(rgba, a) { if (a <= 0) return; ctx.globalAlpha = clamp(a); ctx.fillStyle = rgba; ctx.fillRect(R.sx, R.sy, R.sw, R.sh); ctx.globalAlpha = 1; }

  // ---- frame ----
  // Lays out the stage and HUD strips for a clip, then runs the clip's frame
  function render(c2d, clip, t, w, h, dpr, dt) {
    ctx = c2d;
    const hudB = clip.hud && clip.hud.bottom ? 64 : 0, hudT = clip.hud && clip.hud.top ? 28 : 0, gap = 6;
    const sx = 0, sy = hudT, sw = w, sh = h - hudT - hudB - (hudB ? gap : 0);
    const portrait = true, VW = V, VH = U; // vertical everywhere, like the game
    const k = Math.min(sw / VW, sh / VH), ox = sx + (sw - VW * k) / 2, oy = sy + (sh - VH * k) / 2;
    // HUD strips span the stage, widened a little on a letterboxed canvas so the cards stay readable
    const hw = Math.min(w, Math.max(VW * k, 340)), hx = (w - hw) / 2;
    R = { w, h, dpr, dt: Math.max(0, Math.min(0.1, dt || 0)), portrait, k, ox, oy, sx: ox, sy: oy, sw: VW * k, sh: VH * k, hud: {},
      bottom: hudB ? [hx, h - hudB, hw, hudB] : null, top: hudT ? [hx, 0, hw, hudT] : null };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, w, h);
    if (!clip.built) { ents = []; shots = []; idc = 1; clip.state = {}; clip.build(clip.state); clip.ents = ents; clip.shots = shots; clip.built = true; }
    ents = clip.ents; shots = clip.shots;
    if (t < (clip.lastT || 0)) clip.state.beat = 0;
    clip.lastT = t;
    ctx.save();
    let jx = 0, jy = 0;
    if (clip.shake) { const s = clip.shake(t); if (s > 0) { jx = (Math.random() - 0.5) * s * 6; jy = (Math.random() - 0.5) * s * 6; } }
    ctx.translate(jx, jy);
    ctx.beginPath(); ctx.rect(R.sx, R.sy, R.sw, R.sh); ctx.clip();
    background(clip.bg || {});
    clip.frame(t, clip.state, api);
    ctx.restore();
    if (clip.hudFrame) clip.hudFrame(t, clip.state, api);
    if (clip.overlay) clip.overlay(t, clip.state, api);
    if (clip.fingers) clip.fingers(t, clip.state, api);
  }
  // Draws all entities and shots: under-layer callback first (fields), cells additive
  function scene(t, o = {}) {
    ctx.globalCompositeOperation = 'lighter';
    if (o.under) o.under();
    const order = e => (e.layer || 0);
    const list = ents.slice().sort((a, b) => order(a) - order(b));
    for (const e of list) drawEnt(e, t);
    drawShots(t);
    if (o.over) o.over();
    ctx.globalCompositeOperation = 'source-over';
  }
  const api = {
    U, V, VES, PAL, BLINK, BLINK_WARN, COLORS, FONT, MONO, pen, penR,
    clamp, lerp, lerp2, ease, seg, noise, rng, path, drift,
    P, ang, spr, icon, glow, blinkGlow, ringFx, burst, dots,
    ent, divide, gulp, shot, volley, alive, scene, drawEnt,
    zoneRect, zoneName, zoneCount, zoneChip, lymphTimer, tag, flowArrow, flash, rrect,
    zonePower, hudCards, hudSheet, hudOutput, hudStorm, hudProgress, heart, finger, toast, spotlight, vesselRect, organPanel, organLevel, TIER,
    get ctx() { return ctx; }, get R() { return R; },
  };
  return { render, api, U, V };
})();

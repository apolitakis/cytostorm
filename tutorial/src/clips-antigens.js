'use strict';
// ---------------------------------------------------------------------------
// Tutorial clips, part 2: one clip per new antigen, played before the level
// that introduces it (notes/antigen-roster.md). Anything that reproduces blinks.
// ---------------------------------------------------------------------------
(function () {
  const A = CYT.api, K = CYT_KIT;
  // A fixed spot that shots can aim at (dome rims, threads)
  const pt = (u, v) => ({ pos: () => [u, v], hits: [], t1: 1e9, t0: -1e9 });
  const germ = (o) => A.ent(Object.assign({ art: 'bacterium', hitArt: 'bacterium-hit', r: 7, rot: 'vel', die: 'pop' }, o));
  // Support ring under a macrophage from tOn, plus speed trails on neutrophils inside
  function ring(mac, tOn, t, neuts, rr = 62) {
    const a = A.seg(t, tOn, tOn + 0.5);
    if (a <= 0) return;
    const [u, v] = mac.pos(t), pulse = 1 + 0.03 * Math.sin(t * 6.283 / 1.6);
    A.spr('support-ring', u, v, rr * a * pulse, null, 0.85 * a);
    for (const n of neuts || []) if (A.alive(n, t) && t > n.t0 + 0.3) {
      const [nu, nv] = n.pos(t); if (Math.hypot(nu - u, nv - v) > rr) continue;
      const [p, q] = n.pos(t - 0.05); if (Math.hypot(nu - p, nv - q) > 0.5) A.spr('speed-trail', nu, nv, 9, Math.atan2(nv - q, nu - p), 0.7);
    }
  }
  function flipFx(mac, tf, t) { const p = A.seg(t, tf, tf + 0.4); if (p > 0 && p < 1) { const [u, v] = mac.pos(t); A.ringFx(u, v, p, A.PAL.repair, 10, 40); } }
  const tagWin = (t, a, b) => A.seg(t, a, a + 0.3) * (1 - A.seg(t, b - 0.3, b));
  const tapAt = (t0, u, v) => (t, st, AA) => AA.finger(t, [[t0 - 0.5, K.off], [t0 - 0.1, K.world(u, v)], [t0, K.world(u, v), true], [t0 + 0.25, K.world(u, v), false, 'out']]);

  // ---- MRSA (Hospital visit) ----
  // As in v3 Version 24: plain shots chip its armor (12 hits kill one), it heals fully when it divides,
  // macrophages spit it out, and a tuned shot from a Support ring kills it in one hit.
  const armor = (u, v, left, a, w = 3) => {
    if (a <= 0) return;
    const [x, y] = A.P(u, v), c = A.ctx, g = 1, W = 12 * (w + g) - g, x0 = x - W / 2, y0 = y - 24;
    c.globalAlpha = a; c.fillStyle = 'rgba(10,13,24,.8)'; c.fillRect(x0 - 2, y0 - 2, W + 4, 8);
    for (let i = 0; i < 12; i++) { c.fillStyle = i < left ? '#9AD7FF' : '#2A3150'; c.fillRect(x0 + i * (w + g), y0, w, 4); }
    c.globalAlpha = 1;
  };
  CYT_CLIPS.mrsa = {
    id: 'mrsa', title: 'MRSA', dur: 13.5,
    cap: [[0, 'MRSA is armored. Like every germ, it blinks when it divides.'], [0.9, 'Plain shots only chip its armor. It takes 12 hits to kill one.'], [3.1, 'And every time it divides, it heals right back to full.'], [5.0, 'Macrophages can\'t swallow it. They spit it back out.'], [7.2, 'Flip the zone to Support. A tuned shot from the ring kills MRSA in one hit.']],
    bg: { tile: 1.2 },
    divAt: 3.4,
    build(st) {
      const m0 = st.m0 = A.ent({ art: 'mrsa', r: 11, rot: 0, die: 'pop', big: true, pos: A.drift(140, 175, 0, 3, 0, 3, 1) });
      st.neuts = [K.recruit('neutrophil', -2, 90, 110, { r: 6, wob: 7 }), K.recruit('neutrophil', -2, 120, 250, { r: 6, wob: 7 }), K.recruit('neutrophil', -2, 340, 110, { r: 6, wob: 7 }), K.recruit('neutrophil', -2, 350, 250, { r: 6, wob: 7 })];
      // seven plain hits chip the armor down to 5 of 12...
      st.chips = []; for (let k = 0; k < 7; k++) st.chips.push(A.shot(0.9 + k * 0.32, st.neuts[k % 4], m0));
      // ...then it divides, and both halves are back to full
      const [a, b] = A.divide(m0, this.divAt, { angle: Math.PI / 2, dist: 16, then: [5, 0] });
      a.big = b.big = true; st.mrsa = [a, b];
      const mac = st.mac = A.ent({ art: 'macrophage-offense', r: 17, layer: 1, pos: A.path([[0, 300, 190], [4.9, 296, 190], [5.5, 196, 172], [7.0, 205, 180], [8.0, 255, 185]], 2, 3) });
      A.gulp(mac, a, 5.6, true);
      mac.flip = [{ t: 7.5, art: 'macrophage-support' }];
      // neutrophils gather in the ring, then fire tuned shots
      st.neuts.forEach((n, i) => { const old = n.pos, ang = i / 4 * 6.283 + 0.5; n.pos = t => (t < 7.6 ? old(t) : A.lerp2(old(7.6), [255 + Math.cos(ang) * 32 + 6 * A.noise(i, t), 185 + Math.sin(ang) * 30 + 6 * A.noise(i + 9, t)], A.ease(A.seg(t, 7.6, 8.4)))); });
      A.shot(8.9, st.neuts[0], a, { tuned: true, speed: 700 }); a.t1 = a.hits[a.hits.length - 1];
      A.shot(9.7, st.neuts[2], b, { tuned: true, speed: 700 }); b.t1 = b.hits[b.hits.length - 1];
    },
    frame(t, st) {
      A.scene(t, { under: () => ring(st.mac, 7.6, t, st.neuts) });
      flipFx(st.mac, 7.5, t);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, t < 7.5 ? 'offense' : 'support', A.seg(t, 7.5, 7.8));
      if (t < this.divAt) { const [u, v] = st.m0.pos(t); armor(u, v, 12 - st.chips.filter(h => h <= t).length, A.seg(t, 0.7, 1.0)); }
      else if (t < 5.4) for (const m of st.mrsa) { const [u, v] = m.pos(t); armor(u, v, 12, 1 - A.seg(t, 5.0, 5.4), 1.6); }
      if (t > 3.5 && t < 5.0) { const [u, v] = st.mrsa[1].pos(t); A.tag(u, v, 'healed', '#9AD7FF', tagWin(t, 3.5, 5.0), 26); }
      if (t > 6.2 && t < 7.6) { const [u, v] = st.mrsa[0].pos(t); A.tag(u, v, 'spat out', A.PAL.kill, tagWin(t, 6.2, 7.6), -22); }
    },
    fingers: tapAt(7.4, 120, 120),
  };

  // ---- Pseudomonas (Pool water) ----
  CYT_CLIPS.pseudo = {
    id: 'pseudo', title: 'Pseudomonas', dur: 12.5,
    cap: [[0, 'Pseudomonas swims in, settles, and grows a slime dome over itself.'], [3.2, 'Shots still get through the dome, but it soaks up most of each hit. Plain shots do a quarter of the damage.'], [5.6, 'Offense macrophages tear domes down, bite by bite.'], [9.6, 'With the dome gone, every shot hits at full strength.']],
    bg: { tile: 1.2 },
    domeR(t) { const grow = A.seg(t, 2.3, 4.0) * 46, bites = [6.2, 7.2, 8.2, 9.2].filter(b => t > b + 0.3).length; return bites >= 4 ? 0 : grow * (1 - 0.12 * bites); },
    domeA(t) { const bites = [6.2, 7.2, 8.2, 9.2].filter(b => t > b + 0.3).length; return 0.35 + 0.5 * (4 - bites) / 4; },
    build(st) {
      const C = [235, 175];
      st.germs = [[-20, 120, 220, 160], [-30, 230, 245, 192], [-10, 180, 255, 170]].map((p, i) => A.ent({ art: 'pseudomonas', r: 7, die: 'pop', t0: 0,
        rot: t => (t < 2.0 ? null : 0.4 * i), pos: A.path([[0, p[0], p[1]], [2.0, p[2], p[3]], [20, p[2], p[3]]], 1.5, i * 3) }));
      st.germs.forEach((g, i) => { const r0 = g.rot; g.rot = t => (t < 2.0 ? Math.atan2(g.pos(t + 0.05)[1] - g.pos(t - 0.05)[1], g.pos(t + 0.05)[0] - g.pos(t - 0.05)[0]) : 0.4 * i + 0.3); });
      const kids = A.divide(st.germs[2], 2.4, { angle: 1.2, dist: 7, wob: 0.8 });
      kids.forEach(k => { k.rot = 0.9; });
      st.germs.splice(2, 1, ...kids);
      st.neuts = [K.recruit('neutrophil', -2, 330, 100, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 345, 250, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 120, 260, { r: 6, wob: 6 })];
      for (let k = 0; k < 9; k++) { const n = st.neuts[k % 3], [nu, nv] = n.pos(3.3 + k * 0.25), a = Math.atan2(nv - C[1], nu - C[0]); A.shot(3.3 + k * 0.25, n, st.germs[k % st.germs.length]); } // V27: domes no longer block shots; plain shots do 0.25 damage, tuned shots 1
      const mac = st.mac = A.ent({ art: 'macrophage-offense', r: 16, layer: 1, pos: A.path([[0, 90, 110], [5.4, 95, 112], [6.1, 178, 148], [7.0, 182, 152], [7.7, 200, 205], [8.7, 205, 205], [9.6, 180, 170]], 1.5, 5) });
      [[6.2, 196, 160], [7.2, 196, 168], [8.2, 212, 196], [9.2, 214, 190]].forEach(([tb, u, v]) => mac.gulps.push({ t: tb, prey: pt(u, v) }));
      K.fight(st.neuts, st.germs, 9.7, { hp: 3, every: 0.45, seed: 3 });
      st.C = C;
    },
    frame(t, st) {
      const dr = this.domeR(t);
      A.scene(t, { over: () => { if (dr > 0.5) A.spr('biofilm-dome', st.C[0], st.C[1], dr, null, this.domeA(t)); } });
      for (const b of [6.2, 7.2, 8.2, 9.2]) A.dots(st.C[0] - 30, st.C[1] - 5, (t - b - 0.3) / 0.5, b * 10, 5, 'rgba(169,207,60,0.9)', 14, 2.5);
      if (t > 9.5 && t < 10.2) A.dots(st.C[0], st.C[1], (t - 9.5) / 0.7, 99, 14, 'rgba(169,207,60,0.9)', 40, 3);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 3.4 && t < 5.6) A.tag(st.C[0], st.C[1] - 34, '25% damage', A.PAL.slime, tagWin(t, 3.4, 5.6), -8);
    },
  };

  // ---- Influenza (Flu season), with the Net neutrophil ----
  CYT_CLIPS.flu = {
    id: 'flu', title: 'Influenza', dur: 11,
    cap: [[0, 'Influenza swarms in fast. A single hit kills one.'], [1.9, 'But every flu that reaches the Tissue splits in three.'], [4.6, 'Net neutrophils run into the thickest crowd and burst into a gold pen around it.'], [6.6, 'Flu inside pops. Tougher germs stay trapped, bumping the rim, and your neutrophils pick them off.']],
    bg: { tile: 1.1, dividers: [170] },
    build(st) {
      const r = A.rng(31), cu = 290, cv = 180;
      st.flu = [];
      for (let i = 0; i < 11; i++) {
        const t0 = 0.1 + i * 0.16, v0 = 120 + r() * 120, vu = 80 + r() * 20, tc = t0 + (170 - -10) / vu;
        const p = A.ent({ art: 'flu', r: 3.6, rot: t => t * 3 + i, t0, t1: tc, die: null, pos: A.drift(-10, v0, t0, vu, (cv - v0) * 0.15, 2, i) });
        p.blinks.push([tc - A.BLINK_WARN, tc]);
        const [su, sv] = p.pos(tc);
        for (let j = 0; j < 3; j++) {
          const a = (j - 1) * 0.9 + r() * 0.3, tu = cu + (r() - 0.5) * 70 + (i % 3 === 0 ? 50 : 0), tv = cv + (r() - 0.5) * 70;
          st.flu.push(A.ent({ art: 'flu', r: 3.6, rot: t => t * 3 + j + i, t0: tc, die: 'pop', blinks: [[tc, tc + A.BLINK]],
            pos: A.path([[tc, su, sv], [tc + 0.4, su + 18 + Math.cos(a) * 10, sv + Math.sin(a) * 14], [tc + 2.6, tu, tv], [30, tu + 20, tv, 'l']], 4, i * 7 + j) }));
        }
        st.flu.push(p);
      }
      // the net neutrophil runs to the thickest crowd and bursts into a pen
      st.burstT = 5.9; st.netC = [cu - 4, cv]; st.penR = 44;
      st.net = A.ent({ art: 'neutrophil-net', r: 7, rot: 'vel', t0: 4.5, t1: st.burstT, arrive: A.COLORS.net, die: null, layer: 2, pos: A.path([[4.5, 300, A.V - A.FVES + 4], [st.burstT, st.netC[0], st.netC[1]]], 2, 4) });
      const kill = [], survive = [];
      for (const f of st.flu) if (f.t0 > 1 && f.die === 'pop') { const [u, v] = f.pos(st.burstT); (Math.hypot(u - st.netC[0], v - st.netC[1]) < st.penR ? kill : survive).push(f); }
      for (const f of kill) { f.t1 = st.burstT + 0.05 + r() * 0.2; const p = f.pos; const at = st.burstT; f.pos = t => (t < at ? p(t) : p(at)); }
      // Staph milling in the same crowd: the burst only scratches them, and the pen holds them while they jostle at the rim
      const [c0, c1] = st.netC, B = st.burstT;
      st.staph = [0, 1, 2, 3].map(i => {
        const a0 = i * 1.6 + 0.4, d0 = 14 + i * 5, wand = A.drift(c0 + Math.cos(a0) * (d0 + 30), c1 + Math.sin(a0) * (d0 + 30), 0, 0, 0, 5, 40 + i);
        const inPen = t => { const a = a0 + 0.9 * A.noise(50 + i, t * 0.6), d = Math.min(A.penR(st.penR, t - B) - 6, d0 + 14 * Math.abs(Math.sin(t * 2.6 + i * 1.3))); return [c0 + Math.cos(a) * d, c1 + Math.sin(a) * d]; };
        return A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 5, rot: r() * 6.283, die: 'pop', t0: 2.6 + i * 0.3, pos: t => (t < B - 0.6 ? wand(t) : t < B ? A.lerp2(wand(t), inPen(t), A.ease(A.seg(t, B - 0.6, B))) : inPen(t)) });
      });
      st.staph.forEach(g => g.hits.push(B + 0.03));
      st.neuts = [K.recruit('neutrophil', -2, 210, 90, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 380, 280, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 380, 90, { r: 6, wob: 6 })];
      K.fight(st.neuts, survive.sort((a, b) => a.t0 - b.t0), 2.6, { hp: 1, every: 0.6, seed: 2 });
      K.fight(st.neuts, st.staph, B + 0.5, { hp: 2, every: 0.32, seed: 3 });
    },
    frame(t, st) {
      const nt = t - st.burstT;
      A.scene(t, { under: () => A.pen(st.netC[0], st.netC[1], st.penR, nt, t, 2.5, 3) });
      A.ringFx(st.netC[0], st.netC[1], nt / 0.35, '#FFD23F', 6, st.penR); // the burst
      A.zoneName(0, 170, 'Wound'); A.zoneName(170, 400, 'Tissue');
      if (t > 4.7 && t < 5.9) { const [u, v] = st.net.pos(t); A.tag(u, v, 'Net neutrophil', A.PAL.antibody, tagWin(t, 4.7, 5.9), -14); }
      if (nt > 0.4 && nt < 2.4) A.tag(st.netC[0], st.netC[1] - st.penR, 'pen', A.PAL.antibody, tagWin(t, st.burstT + 0.4, st.burstT + 2.4), -6);
    },
  };

  // ---- Clostridium spores (Soil cut) ----
  CYT_CLIPS.spore = {
    id: 'spore', title: 'Clostridium spores', dur: 12,
    cap: [[0, 'Clostridium spores drift in and sit still.'], [1.8, 'Nothing can hurt a spore. Shots, nets and storms do nothing.'], [4.6, 'The bar on top shows when they hatch. They all crack at once...'], [7.0, '...into bacteria that divide every 6 seconds. Rest before the hatch, then push hard on it.']],
    hud: { top: true },
    bg: { tile: 1.2 },
    hatch: 6.4,
    build(st) {
      const r = A.rng(8), H = this.hatch;
      st.spores = []; st.all = [];
      for (let i = 0; i < 7; i++) {
        const tu = 150 + (i % 4) * 45 + r() * 20, tv = 110 + Math.floor(i / 4) * 80 + r() * 40;
        const s = A.ent({ art: 'spore', r: 6.5, rot: r() * 6, t0: 0, t1: H, die: null, pos: A.path([[0, -20 - i * 12, tv + (r() - 0.5) * 30], [1.5 + i * 0.08, tu, tv], [H, tu + 3, tv + 2]], 1, i) });
        s.blinks.push([H - A.BLINK_WARN, H]);
        st.spores.push(s);
        const c = germ({ r: 6.5, rot: r() * 6, t0: H, blinks: [[H, H + A.BLINK]], pos: A.path([[H, tu + 3, tv + 2]], 2, i + 30) });
        st.all.push(c);
        const kids = A.divide(c, 8.2 + r() * 0.4, { angle: c.rot, dist: 8 });
        kids.forEach(k => { k.rot = c.rot; st.all.push(k); const kk = A.divide(k, 10.0 + r() * 0.4, { angle: c.rot + 1.57, dist: 7 }); kk.forEach(q => { q.rot = c.rot + 1.57; st.all.push(q); }); });
      }
      st.neuts = [K.recruit('neutrophil', -2, 80, 90, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 90, 260, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 360, 270, { r: 6, wob: 6 })];
      for (let k = 0; k < 10; k++) A.shot(1.9 + k * 0.26, st.neuts[k % 3], st.spores[(k * 3) % 7], { fizzle: true });
    },
    frame(t, st) {
      A.scene(t);
      for (const s of st.spores) { const d = t - this.hatch; if (d > 0 && d < 0.3) { const [u, v] = s.pos(this.hatch); A.spr('spore-hatch', u, v, 12, 0, 1 - d / 0.3); } }
      A.zoneName(0, 400, 'Tissue');
      A.zoneCount(0, 400, K.count(st.spores, t) + K.count(st.all, t));
      if (t > 2.0 && t < 4.4) { const [u, v] = st.spores[3].pos(t); A.tag(u, v, "can't be hurt", A.PAL.wax, tagWin(t, 2.0, 4.4), -16); }
    },
    hudFrame(t, st) {
      const frac = 0.3 + t * 0.022, at = 0.3 + this.hatch * 0.022;
      A.hudProgress(A.R.top, frac, [{ at: 0.05, kind: 'wave' }, { at: 0.18, kind: 'wave' }, { at, kind: 'spore' }, { at: 0.72, kind: 'wave' }, { at: 0.9, kind: 'wave-final' }]);
      if (t > 4.6 && t < this.hatch) { const p = A.R.hud.prog, x = A.lerp(p.x0, p.x1, at), c = A.ctx; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); c.strokeStyle = A.PAL.wax; c.lineWidth = 1.5; c.beginPath(); c.arc(x, p.y, 14, 0, 6.283); c.stroke(); c.globalAlpha = 1; }
    },
  };

  // ---- Candida (Athlete's foot) ----
  CYT_CLIPS.yeast = {
    id: 'yeast', title: 'Candida', dur: 13.5,
    cap: [[0, 'Candida settles and grows a thread toward the Lymph node.'], [3.4, 'Germs ride the thread 2.5 times faster. A thread in the Lymph node fills the spleen\'s breach clock too.'], [6.2, 'Shots pass straight through threads.'], [7.8, 'A Net neutrophil cuts the thread, and everything past the cut withers.'], [10.4, 'Offense macrophages chew the tips too, slowly.']],
    bg: { tile: 1.2, dividers: [360], lymph: [380, 175] }, // close-up of Deep tissue and the Lymph node strip
    build(st) {
      const r = A.rng(4);
      st.root = [60, 190];
      // main thread and one branch: points along a wandering line
      const main = [st.root.slice()]; let a = -0.08;
      for (let i = 0; i < 28; i++) { a += (r() - 0.5) * 0.45; a = A.clamp(a, -0.5, 0.4); const p = main[main.length - 1]; main.push([p[0] + Math.cos(a) * 12, p[1] + Math.sin(a) * 12]); }
      const br = [main[7].slice()]; let b = 0.9;
      for (let i = 0; i < 7; i++) { b += (r() - 0.5) * 0.4; const p = br[br.length - 1]; br.push([p[0] + Math.cos(b) * 11, p[1] + Math.sin(b) * 11]); }
      st.main = main; st.br = br; st.cutAt = 10; st.cutT = 8.8;
      st.mainLen = t => Math.min(main.length - 1, Math.max(0, (t - 1.4) / 0.15));
      st.brLen = t => Math.max(0, Math.min(br.length - 1, (t - 2.6) / 0.2) - 2.5 * [10.6, 11.6, 12.6].filter(x => t > x + 0.3).length);
      st.yeast = A.ent({ art: 'yeast', r: 8, rot: 0.3, t0: 0, pos: A.path([[0, -15, 230], [1.3, st.root[0], st.root[1]], [40, st.root[0], st.root[1]]], 0.8, 2), layer: 1 });
      // budding: a new yeast pops off the tip
      const tip = main[18];
      A.ent({ art: 'yeast', r: 6, rot: 1, t0: 4.4, blinks: [[4.4, 4.4 + A.BLINK]], die: 'pop', pos: A.path([[4.4, tip[0], tip[1]], [5.2, tip[0] + 6, tip[1] + 22], [20, tip[0] + 20, tip[1] + 40, 'l']], 2, 5) }).t1 = 11.2;
      // riders: germs latch onto the thread and race along it
      const along = (i0, i1, t0, t1) => t => { const q = A.clamp((t - t0) / (t1 - t0)) * (i1 - i0) + i0, k = Math.floor(q), f = q - k, p0 = main[Math.min(k, main.length - 1)], p1 = main[Math.min(k + 1, main.length - 1)]; return [A.lerp(p0[0], p1[0], f), A.lerp(p0[1], p1[1], f) - 4]; };
      st.riders = [0, 1].map(j => { const t0 = 3.6 + j * 0.7, ride = along(2, 28 - j, t0 + 0.6, t0 + 2.4), start = [-10, 150 + j * 70], [su, sv] = ride(t0 + 0.6);
        return germ({ r: 6.5, t0, pos: t => (t < t0 + 0.6 ? [A.lerp(start[0], su, A.ease(A.seg(t, t0, t0 + 0.6))), A.lerp(start[1], sv, A.ease(A.seg(t, t0, t0 + 0.6)))] : t < t0 + 2.4 ? ride(t) : [ride(t0 + 2.4)[0] + 4 * A.noise(j, t), ride(t0 + 2.4)[1] + 4 * A.noise(j + 3, t)]) }); });
      st.rideWin = st.riders.map((g, j) => [3.6 + j * 0.7 + 0.6, 3.6 + j * 0.7 + 2.4]);
      st.neuts = [K.recruit('neutrophil', -2, 200, 90, { r: 6, wob: 5 }), K.recruit('neutrophil', -2, 180, 270, { r: 6, wob: 5 }), K.recruit('neutrophil', -2, 340, 260, { r: 6, wob: 5 })];
      for (let k = 0; k < 7; k++) { const p = main[8 + k * 2]; A.shot(6.3 + k * 0.22, st.neuts[k % 2], pt(p[0], p[1]), { pass: true }); }
      const c = main[st.cutAt];
      st.net = A.ent({ art: 'neutrophil-net', r: 7, rot: 'vel', t0: 7.7, t1: st.cutT, arrive: A.COLORS.net, die: null, layer: 2, pos: A.path([[7.7, c[0] + 10, A.VES - 4], [st.cutT, c[0], c[1]]], 1.5, 6) });
      K.fight(st.neuts, st.riders, 9.2, { hp: 3, every: 0.4, seed: 5 });
      const bt = br[br.length - 1];
      st.mac = A.ent({ art: 'macrophage-offense', r: 15, layer: 1, pos: A.path([[0, 150, 255], [9.8, 150, 255], [10.5, bt[0] + 14, bt[1] + 12], [11.5, bt[0] + 6, bt[1] - 6], [12.5, bt[0] - 6, bt[1] - 18]], 1.2, 8) });
      [10.6, 11.6, 12.6].forEach((tb, k) => st.mac.gulps.push({ t: tb, prey: pt(br[Math.max(0, br.length - 1 - k * 2.5 | 0)][0], br[Math.max(0, br.length - 1 - k * 2.5 | 0)][1]) }));
    },
    drawThread(t, st) {
      const c = A.ctx, k = A.R.k, line = (pts, n, live, alpha) => {
        if (n <= 0) return;
        c.beginPath();
        const full = Math.floor(n);
        for (let i = 0; i <= full && i < pts.length; i++) { const [x, y] = A.P(pts[i][0], pts[i][1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
        if (n > full && full + 1 < pts.length) { const f = n - full, a = pts[full], b = pts[full + 1], [x, y] = A.P(A.lerp(a[0], b[0], f), A.lerp(a[1], b[1], f)); c.lineTo(x, y); }
        c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = alpha;
        if (live) { c.strokeStyle = 'rgba(214,236,106,0.16)'; c.lineWidth = 4.5 * k / 1.6; c.stroke(); c.strokeStyle = 'rgba(234,245,154,0.85)'; c.lineWidth = 1.4 * k / 1.6; c.stroke(); }
        else { c.strokeStyle = 'rgba(170,140,70,0.6)'; c.lineWidth = 1.3 * k / 1.6; c.stroke(); }
        c.globalAlpha = 1;
        // tip knot
        if (live && n >= 1) { const i = Math.min(pts.length - 1, Math.floor(n)), [x, y] = A.P(pts[i][0], pts[i][1]); c.fillStyle = 'rgba(244,250,190,0.95)'; c.beginPath(); c.arc(x, y, (1.4 + 0.4 * Math.sin(t * 4)) * k / 1.4, 0, 6.283); c.fill(); }
      };
      const n = st.mainLen(t), cut = t > st.cutT + 0.1;
      if (!cut) line(st.main, n, true, 1);
      else {
        line(st.main, st.cutAt - 0.4, true, 1);
        const wither = 1 - A.seg(t, st.cutT + 0.1, st.cutT + 3.1);
        if (wither > 0) line(st.main.slice(st.cutAt + 1), n - st.cutAt - 1, false, wither);
      }
      line(st.br, st.brLen(t), true, 1);
    },
    frame(t, st) {
      const nt = t - st.cutT, c = st.main[st.cutAt];
      A.scene(t, { under: () => {
        this.drawThread(t, st);
        A.pen(c[0], c[1], 30, nt, t, 2.5, 5);
        for (const [g, w] of st.riders.map((g, j) => [g, st.rideWin[j]])) if (t > w[0] && t < w[1] && A.alive(g, t)) { const [u, v] = g.pos(t), [p, q] = g.pos(t - 0.05); A.spr('speed-trail', u, v, 12, Math.atan2(v - q, u - p), 0.8); }
      } });
      A.ringFx(c[0], c[1], nt / 0.35, '#FFD23F', 6, 30); // the burst
      A.dots(c[0], c[1], nt / 0.5, 7, 12, 'rgba(220,240,120,0.9)', 22, 2.4);
      A.zoneName(0, A.NODE_U, 'Deep tissue');
      // the Lymph node's breach clock fills while the thread tip or a rider is in the strip
      const inside = tt => (tt < st.cutT + 0.1 && st.main[Math.floor(st.mainLen(tt))][0] > A.NODE_U) || st.riders.some(g => A.alive(g, tt) && g.pos(tt)[0] > A.NODE_U);
      let f = 0; for (let tt = 0; tt < t; tt += 0.1) if (inside(tt)) f += 0.006;
      A.nodeRow({ frac: f, busy: inside(t), t, mode: null });
      A.zoneChip(0, A.NODE_U, 'offense');
      if (t > 6.3 && t < 7.8) { const p = st.main[14]; A.tag(p[0], p[1], 'passes through', A.PAL.antibody, tagWin(t, 6.3, 7.8), -14); }
    },
  };

  // ---- Tuberculosis (Lungs) ----
  CYT_CLIPS.tb = {
    id: 'tb', title: 'Tuberculosis', dur: 14.2,
    cap: [[0, 'Tuberculosis is slow and tough: 12 plain hits.'], [1.4, 'A macrophage that swallows it gets infected and starts spitting out new TB.'], [6.6, 'Neutrophils ignore an infected macrophage. Meet the NK cell: it hunts infected cells and kills them.'], [8.8, 'Only NK cells can do it, so add them on the production card wherever TB gets swallowed.'], [10.8, 'Or keep TB zones on Support, so your macrophages ring it instead of swallowing it.']],
    bg: { tile: 1.2 },
    build(st) {
      const r = A.rng(12);
      const tb1 = A.ent({ art: 'tb', r: 9, rot: 0.4, die: 'pop', big: true, pos: A.drift(170, 160, 0, 2, 0, 2, 1) });
      st.tb = [A.ent({ art: 'tb', r: 9, rot: 2.2, die: 'pop', big: true, pos: A.drift(300, 230, 0, 1.5, 0, 2, 2) })];
      const mac = st.mac = A.ent({ art: 'macrophage-offense', r: 17, layer: 1, die: 'puff', big: true, pos: A.path([[0, 90, 190], [1.4, 150, 170], [3, 150, 172], [9, 160, 180]], 2, 3) });
      A.gulp(mac, tb1, 1.5);
      mac.flip = [{ t: 2.0, art: 'macrophage-infected' }];
      for (const ts of [2.9, 4.4, 5.9]) {
        const a = r() * 6.283, sp = 26;
        st.tb.push(A.ent({ art: 'tb', r: 9, rot: a, t0: ts, die: 'pop', big: true, blinks: [[ts, ts + A.BLINK]], pos: (s0 => t => { const [mu, mv] = mac.pos(ts), d = Math.min(1.2, t - ts); return [mu + Math.cos(a) * (14 + sp * d), mv + Math.sin(a) * (14 + sp * d)]; })() }));
      }
      st.neuts = [];
      for (let i = 0; i < 5; i++) st.neuts.push(K.recruit('neutrophil', 6.4 + i * 0.15, 100 + i * 25, 230 + (i % 2) * 30, { r: 6, wob: 7 }));
      // neutrophils ignore the infected macrophage; the NK cell comes in from the vessel and pops it
      st.pop = 8.3;
      st.nk = A.ent({ art: 'nk-cell', r: 10, rot: t => t * 0.5, t0: 6.6, arrive: A.COLORS.nk, layer: 2, pos: t => { const [u, v] = mac.pos(Math.min(t, st.pop)), p = A.ease(A.seg(t, 6.6, st.pop)); return [A.lerp(u + 50, u + 14, p) + 3 * A.noise(3, t), A.lerp(A.V - A.FVES + 4, v - 6, p) + 3 * A.noise(4, t)]; } });
      mac.t1 = st.pop; mac.die = 'lilac';
      // a fresh macrophage arrives, the zone flips to Support, and tuned shots finish the TB
      st.mac2 = K.recruit('macrophage-offense', 9.8, 230, 175, { r: 17, kind: 'mac', wob: 1.5, travel: 0.8 });
      st.mac2.flip = [{ t: 11.0, art: 'macrophage-support' }];
      st.neuts.forEach((n, i) => { const old = n.pos, ang = i / 5 * 6.283; n.pos = t => (t < 11.1 ? old(t) : A.lerp2(old(11.1), [230 + Math.cos(ang) * 34 + 6 * A.noise(i, t), 175 + Math.sin(ang) * 32 + 6 * A.noise(i + 5, t)], A.ease(A.seg(t, 11.1, 11.8)))); });
      st.tb.forEach((g, i) => { A.shot(12.1 + i * 0.3, st.neuts[i % 5], g, { tuned: true, speed: 700 }); g.t1 = g.hits[g.hits.length - 1]; });
    },
    frame(t, st) {
      A.scene(t, { under: () => ring(st.mac2, 11.1, t, st.neuts) });
      flipFx(st.mac2, 11.0, t);
      const fl = A.seg(t, 2.0, 2.4); if (fl > 0 && fl < 1) { const [u, v] = st.mac.pos(t); A.ringFx(u, v, fl, A.PAL.germ, 10, 36); }
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, t < 11.0 ? 'offense' : 'support', A.seg(t, 11.0, 11.3));
      if (t > 2.4 && t < 5) { const [u, v] = st.mac.pos(t); A.tag(u, v, 'infected', A.PAL.germ, tagWin(t, 2.4, 5), -24); }
      if (t > 6.9 && t < 8.6) { const [u, v] = st.nk.pos(t); A.tag(u, v, 'NK cell: kills infected cells', A.COLORS.nk, tagWin(t, 6.9, 8.6), -20); }
    },
    fingers: tapAt(10.9, 300, 110),
  };

  // ---- Strep chains (Sore throat) ----
  CYT_CLIPS.strep = {
    id: 'strep', title: 'Strep chains', dur: 12,
    cap: [[0, 'Strep chains sprint for the Lymph node.'], [2.4, 'A plain shot splits a chain in two, and both halves keep running.'], [5.4, 'Tuned shots from a Support ring kill links without splitting. Swallows don\'t split chains either.']],
    bg: { tile: 1.2 },
    build(st) {
      const lag = 0.26, N = 8;
      const head1 = t => [-20 + 62 * t, 100 + 20 * Math.sin(t * 2.2)];
      const head2 = t => [-20 + 60 * (t - 5.0), 200 + 16 * Math.sin(t * 2.6)];
      const rotOf = (h, tt) => { const [a, b] = h(tt - 0.05), [c, d] = h(tt + 0.05); return Math.atan2(d - b, c - a); };
      const ts = 2.5, cutI = 4;
      st.links = [];
      for (let i = 0; i < N; i++) {
        const back = i > cutI, tb = t => (back && t > ts ? ts + (t - ts) * 0.82 : t), off = t => (back && t > ts ? 20 * A.ease(A.seg(t, ts, ts + 0.6)) : 0);
        const L = A.ent({ art: 'strep-link', r: 5, die: 'pop', pos: t => { const [u, v] = head1(tb(t) - i * lag); return [u, v + off(t)]; }, rot: t => rotOf(head1, tb(t) - i * lag) });
        if (i === cutI) L.t1 = ts; else L.blinks.push([ts, ts + A.BLINK]);
        st.links.push(L);
      }
      st.shooter = K.recruit('neutrophil', -2, 150, 175, { r: 6, wob: 4 });
      A.shot(ts - 0.15, st.shooter, st.links[cutI]);
      // second chain runs through a Support ring
      st.mac = A.ent({ art: 'macrophage-support', r: 16, layer: 1, pos: A.path([[0, 262, 200]], 1.5, 2) });
      st.neuts = [0, 1, 2, 3].map(i => K.recruit('neutrophil', -2, 262 + Math.cos(i * 1.57 + 0.6) * 32, 200 + Math.sin(i * 1.57 + 0.6) * 26, { r: 6, wob: 7, seed: i * 4 }));
      st.chain2 = [];
      for (let i = 0; i < N; i++) st.chain2.push(A.ent({ art: 'strep-link', r: 5, die: 'pop', t0: 5.0 + i * lag, pos: t => head2(t - i * lag), rot: t => rotOf(head2, t - i * lag) }));
      st.chain2.forEach((L, i) => { A.shot(8.3 + i * 0.3, st.neuts[i % 4], L, { tuned: true, speed: 700 }); L.t1 = L.hits[L.hits.length - 1]; });
    },
    frame(t, st) {
      A.scene(t, { under: () => ring(st.mac, -1, t, st.neuts) });
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'support');
      if (t > 2.6 && t < 5) { const [u, v] = st.links[5].pos(t); A.tag(u, v, 'split: two chains', A.PAL.germHi, tagWin(t, 2.6, 5), -18); }
    },
  };

  // ---- Toxic-shock Staph (Sore throat) ----
  CYT_CLIPS.toxic = {
    id: 'toxic', title: 'Toxic-shock Staph', dur: 10.5,
    cap: [[0, 'Toxic-shock Staph glows orange, the colour of fatigue.'], [2.0, 'While any are alive, your body tires twice as fast.'], [5.6, 'Kill them first, and fatigue goes back to its normal pace.']],
    hud: { bottom: true },
    bg: { tile: 1.2 },
    build(st) {
      const pulse = t => 0.65 + 0.35 * Math.sin(t * 6.283);
      st.germs = K.crowd(4, [200, 100, 340, 260], 14, { art: 'staph-toxic', hitArt: null, r: 7, wob: 5 });
      const [a, b] = A.divide(st.germs[0], 1.3, { angle: 0.6, dist: 9 });
      st.germs.splice(0, 1, a, b);
      for (const g of st.germs) { g.alpha = pulse; g.dieKid = 'pop'; }
      st.neuts = [];
      for (let i = 0; i < 6; i++) st.neuts.push(K.recruit('neutrophil', 4.9 + i * 0.15, 140 + (i % 3) * 30, 110 + Math.floor(i / 3) * 120 + (i % 2) * 20, { r: 6, wob: 7 }));
      K.fight(st.neuts, st.germs, 5.4, { hp: 3, every: 0.4, seed: 4 });
      st.clear = Math.max(...st.germs.map(g => g.t1));
    },
    fAt(t, st) { let f = 28; for (let tt = 0; tt < t; tt += 0.05) f += 0.05 * (tt < st.clear ? 4.2 : 2.1); return Math.min(95, f); },
    frame(t, st) {
      A.scene(t);
      A.zoneName(0, 400, 'Tissue');
      if (t > 0.4 && t < 2.4) { const [u, v] = st.germs[2].pos(t); A.tag(u, v, 'Toxic-shock Staph', A.PAL.kill, tagWin(t, 0.4, 2.4), -16); }
    },
    hudFrame(t, st) { A.hudOutput(A.R.bottom, Object.assign(st, { out: 0.7, f: this.fAt(t, st) }), t, { mulTag: t < st.clear ? 'fatigue ×2' : '' }); },
  };

  // ---- Herpes (Cold sore), with the NK cell ----
  CYT_CLIPS.herpes = {
    id: 'herpes', title: 'Herpes', dur: 11.5,
    cap: [[0, 'Herpes dives into your own neutrophils and hides.'], [2.6, 'An infected neutrophil flickers lilac. Watch for it.'], [4.4, 'Later it bursts, and the virus pours out.'], [6.6, 'NK cells hunt infected cells and pop them before they burst.']],
    bg: { tile: 1.2 },
    build(st) {
      const r = A.rng(19);
      const flick = t0 => t => (t > t0 && Math.floor(t / 0.3) % 2 ? 'neutrophil-infected' : 'neutrophil');
      const n1 = K.recruit('neutrophil', -2, 190, 140, { r: 7, wob: 6, seed: 1 }), n2 = K.recruit('neutrophil', -2, 280, 225, { r: 7, wob: 6, seed: 2 });
      const n3 = K.recruit('neutrophil', -2, 330, 110, { r: 7, wob: 6, seed: 3 }), n4 = K.recruit('neutrophil', -2, 120, 250, { r: 7, wob: 6, seed: 4 });
      st.n1 = n1; st.n2 = n2;
      n1.art2 = flick(1.6); n2.art2 = flick(2.3);
      const dive = (n, t0, ti, v0) => A.ent({ art: 'herpes', r: 3.6, rot: t => t * 2, t0, t1: ti, die: null, pos: t => { const [u, v] = n.pos(t), p = A.ease(A.seg(t, t0, ti)); return [A.lerp(-10, u, p), A.lerp(v0, v, p)]; } });
      dive(n1, 0.2, 1.6, 120); dive(n2, 0.5, 2.3, 230);
      const strays = [0, 1, 2].map(i => A.ent({ art: 'herpes', r: 3.6, rot: t => t * 2 + i, t0: 0.3 + i * 0.3, die: 'lilac', pos: A.drift(-10, 160 + i * 30, 0.3 + i * 0.3, 55, 0, 3, i) }));
      K.fight([n3, n4], strays, 1.0, { hp: 1, every: 0.5, seed: 1 });
      // n1 bursts
      st.burst = 5.0; n1.t1 = st.burst; n1.die = 'lilac';
      const [bu, bv] = n1.pos(st.burst);
      st.virus = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + r() * 0.3; st.virus.push(A.ent({ art: 'herpes', r: 3.6, rot: t => t * 2 + i, t0: st.burst, die: 'lilac', blinks: [[st.burst, st.burst + A.BLINK]], pos: A.path([[st.burst, bu, bv], [st.burst + 0.8, bu + Math.cos(a) * 40, bv + Math.sin(a) * 34], [20, bu + Math.cos(a) * 60, bv + Math.sin(a) * 50, 'l']], 3, i) })); }
      K.fight([n3, n4], st.virus, st.burst + 0.9, { hp: 1, every: 0.35, seed: 3 });
      // the NK cell reaches n2 first
      st.pop = 9.6;
      st.nk = A.ent({ art: 'nk-cell', r: 9, rot: t => t * 0.5, t0: 6.4, arrive: A.COLORS.nk, layer: 2, pos: t => { const [u, v] = n2.pos(Math.min(t, st.pop)), p = A.ease(A.seg(t, 6.4, st.pop)); return [A.lerp(u - 60, u - 10, p) + 3 * A.noise(3, t), A.lerp(A.VES - 4, v, p) + 3 * A.noise(4, t)]; } });
      n2.t1 = st.pop; n2.die = 'lilac';
    },
    frame(t, st) {
      A.scene(t);
      A.zoneName(0, 400, 'Tissue');
      if (t > 2.6 && t < 4.4) { const [u, v] = st.n1.pos(t); A.tag(u, v, 'infected', A.PAL.virus, tagWin(t, 2.6, 4.4), -16); }
      if (t > 6.8 && t < 8.6) { const [u, v] = st.nk.pos(t); A.tag(u, v, 'NK cell', A.COLORS.nk, tagWin(t, 6.8, 8.6), -18); }
    },
  };

  // ---- Tapeworm (Gut) ----
  CYT_CLIPS.worm = {
    id: 'worm', title: 'Tapeworm', dur: 13.5,
    cap: [[0, 'The Tapeworm is the boss. It\'s far too big to swallow.'], [2.4, 'Every segment you break off runs away as a small, fast worm.'], [6.2, 'Tuned shots hit it five times harder. Put a Support ring in its path.']],
    bg: { tile: 1.1 },
    build(st) {
      const N = 7, lag = 0.78;
      const head = t => [70 + 21 * t, 160 + 22 * Math.sin(t * 0.8)];
      const rotOf = tt => { const [a, b] = head(tt - 0.05), [c, d] = head(tt + 0.05); return Math.atan2(d - b, c - a); };
      st.head = A.ent({ art: 'tapeworm-head', r: 15, die: 'pop', big: true, layer: 1, pos: head, rot: rotOf });
      st.segs = [];
      for (let i = 1; i <= N; i++) st.segs.push(A.ent({ art: 'tapeworm-segment', r: 11, die: null, layer: 0, pos: t => head(t - i * lag), rot: t => rotOf(t - i * lag) }));
      st.neuts = [K.recruit('neutrophil', -2, 60, 260, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 110, 80, { r: 6, wob: 6 }), K.recruit('neutrophil', -2, 30, 90, { r: 6, wob: 6 })];
      st.mac = A.ent({ art: 'macrophage-offense', r: 16, layer: 1, pos: A.path([[0, 290, 240]], 1.5, 3) });
      st.mac.flip = [{ t: 6.1, art: 'macrophage-support' }];
      st.ringN = [0, 1, 2, 3].map(i => K.recruit('neutrophil', 6.3 + i * 0.15, 290 + Math.cos(i * 1.57 + 0.7) * 34, 240 + Math.sin(i * 1.57 + 0.7) * 28, { r: 6, wob: 7 }));
      // plain shots chip the tail: many hits for one segment
      const tail = st.segs[N - 1];
      A.volley(1.4, st.neuts, tail, 9, 0.3);
      const breakSeg = (s, tb, shooters, tuned) => {
        s.t1 = tb;
        const [u, v] = s.pos(tb), rot = s.rot(tb), away = rot + Math.PI + 0.7;
        const w = A.ent({ art: 'tapeworm-small', r: 6, rot: 'vel', t0: tb, die: 'pop', blinks: [[tb, tb + A.BLINK]], pos: A.path([[tb, u, v], [tb + 1.6, u + 40 + 20 * Math.cos(away), v + 50 * Math.sin(away)], [tb + 6, u + 160, v + 30 * Math.sin(away), 'l']], 3, tb) });
        A.shot(tb + (tuned ? 0.5 : 1.6), shooters[0], w, { tuned }); w.t1 = w.hits[w.hits.length - 1];
        return w;
      };
      st.w1 = breakSeg(tail, 4.0, st.neuts, false);
      // tuned shots break the rest quickly
      for (let k = 0; k < N - 1; k++) {
        const s = st.segs[N - 2 - k], tb = 7.9 + k * 0.55;
        A.shot(tb - 0.25, st.ringN[k % 4], s, { tuned: true, speed: 700 });
        breakSeg(s, tb, [st.ringN[(k + 1) % 4]], true);
      }
      for (let k = 0; k < 4; k++) A.shot(11.4 + k * 0.2, st.ringN[k], st.head, { tuned: true, speed: 700 });
      st.head.t1 = st.head.hits[st.head.hits.length - 1];
    },
    frame(t, st) {
      A.scene(t, { under: () => ring(st.mac, 6.2, t, st.ringN) });
      flipFx(st.mac, 6.1, t);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, t < 6.1 ? 'offense' : 'support', A.seg(t, 6.1, 6.4));
      if (t > 4.2 && t < 6) { const [u, v] = st.w1.pos(t); A.tag(u, v, 'small worm', A.PAL.germHi, tagWin(t, 4.2, 6), -14); }
    },
    fingers: tapAt(6.0, 330, 120),
  };
})();

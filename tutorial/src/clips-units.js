'use strict';
// ---------------------------------------------------------------------------
// Tutorial clips, part 3: one intro clip per new friendly unit (Play V39, 2026-10-10), played on the level
// (thumb: the clip second a guide thumbnail should draw, a frame with no tags or toasts over it)
// that adds the unit, after that level's antigen clip. Numbers follow v3 releases/v39 sim.js CONFIG:
// bcell, eos, plt, dc, treg, ifn, mast. Unit sizes are the game radius x 2 (a neutrophil is r 3 in the game, r 6 here).
// ---------------------------------------------------------------------------
(function () {
  const A = CYT.api, K = CYT_KIT;
  const pt = (u, v) => ({ pos: () => [u, v], hits: [], t1: 1e9, t0: -1e9 });
  const germ = (o) => A.ent(Object.assign({ art: 'bacterium', hitArt: 'bacterium-hit', r: 6.5, rot: 'vel', die: 'pop' }, o));
  const tagWin = (t, a, b) => A.seg(t, a, a + 0.3) * (1 - A.seg(t, b - 0.3, b));
  const GOLD = A.COLORS.bcell;
  // A thin ring round an entity (the game marks tagged germs without their own tagged art this way)
  function ringAround(e, t, color, pad = 2.4, alpha = 0.85) {
    if (!A.alive(e, t) || (e.eat && t > e.eat.t)) return;
    const [u, v] = e.pos(t), [x, y] = A.P(u, v), c = A.ctx;
    c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, (e.r + pad) * A.R.k, 0, 6.283); c.stroke(); c.globalAlpha = 1;
  }
  // The closing beat of every unit clip: the sector's Response button, where the new cell is made
  function endSpot(t, dur, zones, z = 0) {
    const L = A.ctlLayout(zones)[z];
    const rect = L && (L.resp || (L.pill && [L.pill[0], L.pill[1] - 5, L.pill[2], L.pill[3] + 10]));
    if (rect) A.spotlight(rect, A.seg(t, dur - 1.7, dur - 1.4), 'Make them in Response', t);
  }
  const mixWith = (k, share = 0.2) => ({ neut: 0.75 - share, mac: 0.25, [k]: share });

  // ---- B cells (Hospital visit) ----
  // V39: hangs back from the nearest germ; every 3.5 s puffs an antibody cloud (r 24, 4 s, drifts at 0.6x the flow).
  // Germs it touches are tagged for 12 s: they pull together round the cloud's centre and roll at 0.6x the flow,
  // and macrophages swallow them in half the time, MRSA included.
  CYT_CLIPS.bcell = {
    id: 'bcell', title: 'B cells', dur: 13, thumb: 7.0,
    hud: { side: 'ctl' },
    cap: [[0, 'B cells kill nothing themselves. Every 3.5 seconds they puff a cloud of antibodies at the nearest germ.'], [2.4, 'The cloud drifts with the flow. Every germ it touches is tagged gold for 12 seconds.'], [4.6, 'Germs tagged by the same cloud stick together and roll slowly downstream as one heavy clump.'], [7.4, 'Macrophages swallow tagged germs twice as fast. Even MRSA, which they normally spit back out.']],
    bg: { tile: 1.2 },
    build(st) {
      const r = A.rng(21), CR = 44, flow = 7;
      // the first cloud and the clump that forms round its centre (the centre keeps rolling after the cloud fades)
      st.c1 = { t0: 1.75, life: 4, at: t => [183 + flow * (t - 1.75), 172] };
      st.c2 = { t0: 5.25, life: 4, at: t => [298 + flow * (t - 5.25), 92] };
      st.bc = K.recruit('b-cell', 0, 118, 112, { r: 9, kind: 'bcell', travel: 1.0, side: 'near', wob: 2.5 });
      st.bc.art2 = t => ((t > 1.6 && t < 2.0) || (t > 5.1 && t < 5.5) ? 'b-cell-puff' : 'b-cell');
      st.bc.rot = t => ((t > 1.6 && t < 2.0) || (t > 5.1 && t < 5.5) ? Math.atan2(172 - 112, 183 - 118) : null);
      const spots = [[176, 158], [196, 190], [208, 160], [170, 196], [190, 140], [214, 212]];
      st.germs = spots.map(([u, v], i) => germ({ rot: r() * 6.283, pos: A.drift(u - 30, v, 0, 5, 0, 3, 40 + i) }));
      st.germs.forEach(g => { g.rot = null; });
      st.mrsa = A.ent({ art: 'mrsa', r: 10, rot: 0.3, die: 'pop', big: true, pos: A.drift(176, 206, 0, 5, 0, 2.5, 9) });
      const members = [...st.germs, st.mrsa];
      // tag time: the first moment the cloud covers the germ
      const tagT = e => { for (let t = st.c1.t0; t < st.c1.t0 + st.c1.life; t += 0.02) { const [u, v] = e.pos(t), [cu, cv] = st.c1.at(t); if (Math.hypot(u - cu, v - cv) < CR) return t; } return 99; };
      const offs = [[0, 0], [14, 5], [-13, 8], [4, -15], [-8, -13], [15, -10], [-2, 20]];
      members.forEach((e, i) => {
        const pre = e.pos, ti = e.tagT = Math.max(st.c1.t0 + 0.1, tagT(e)), o = offs[i];
        e.pos = t => {
          if (t <= ti) return pre(t);
          const [cu, cv] = st.c1.at(t), a = 0.35 * (t - ti), q = A.ease(A.seg(t, ti, ti + 1.3));
          const ou = o[0] * Math.cos(a) - o[1] * Math.sin(a), ov = o[0] * Math.sin(a) + o[1] * Math.cos(a);
          return A.lerp2(pre(t), [cu + ou + 1.2 * A.noise(i, t), cv + ov + 1.2 * A.noise(i + 5, t)], q);
        };
        if (e !== st.mrsa) e.flip = [{ t: ti, art: 'bacterium-opsonized' }];
      });
      // a stray germ for the second puff, 3.5 s later
      st.stray = germ({ rot: 2.2, pos: A.drift(318, 80, 0, 5, 0, 3, 77) });
      st.stray.flip = [{ t: 5.6, art: 'bacterium-opsonized' }];
      st.bc.pos = (old => t => (t < 4.6 ? old(t) : A.lerp2(old(t), [250, 70], A.ease(A.seg(t, 4.6, 5.1)))))(st.bc.pos);
      // an Offense macrophage comes for the clump and swallows a germ every 0.55 s, then the tagged MRSA
      const mac = st.mac = A.ent({ art: 'macrophage-offense', r: 16, layer: 1, t0: 6.8, arrive: A.COLORS.mac, pos: t => {
        const [cu, cv] = st.c1.at(Math.max(t, 7.6)), home = [cu + 2, cv - 30];
        return A.lerp2([300, A.VES - 4], home, A.ease(A.seg(t, 6.8, 7.6))).map((x, k) => x + 1.5 * A.noise(k + 3, t));
      } });
      st.gulps = [7.8, 8.35, 8.9, 9.45, 10.0, 10.55];
      st.germs.slice(0, 5).forEach((g, i) => A.gulp(mac, g, st.gulps[i]));
      A.gulp(mac, st.mrsa, st.gulps[5]);
      st.germs[5].t1 = 1e9;
    },
    cloud(c, t) { const p = t - c.t0; if (p < 0 || p > c.life) return; const [u, v] = c.at(t), grow = A.ease(A.seg(p, 0, 0.35)); A.spr('antibody-cloud', u, v, 44 * (0.6 + 0.4 * grow), null, Math.min(1, 1.5 * (0.25 + 0.6 * (1 - p / c.life)))); },
    frame(t, st) {
      A.scene(t, { under: () => { this.cloud(st.c1, t); this.cloud(st.c2, t); } });
      if (t > st.mrsa.tagT) ringAround(st.mrsa, t, GOLD, 3);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 0.6 && t < 2.4) { const [u, v] = st.bc.pos(t); A.tag(u, v, 'B cell', GOLD, tagWin(t, 0.6, 2.4), -16); }
      if (t > 2.6 && t < 4.4) { const [u, v] = st.germs[1].pos(t); A.tag(u, v, 'tagged', GOLD, tagWin(t, 2.6, 4.4), 26); }
      if (t > 5.2 && t < 6.9) { const [u, v] = st.bc.pos(t); A.tag(u, v, 'every 3.5 s', GOLD, tagWin(t, 5.2, 6.9), -16); }
      if (t > 8.0 && t < 9.9) { const [u, v] = st.mac.pos(t); A.tag(u, v, '2× faster', A.PAL.kill, tagWin(t, 8.0, 9.9), -22); }
      if (t > 10.5 && t < 12.2) { const [u, v] = st.mac.pos(t); A.tag(u, v, 'tagged MRSA: swallowed', GOLD, tagWin(t, 10.5, 12.2), -22); }
    },
    side: () => ({ mix: mixWith('bcell') }),
    overlay(t) { endSpot(t, this.dur, [[0, 400]]); },
  };

  // ---- Eosinophils (Pool water) ----
  // V39: ignore small germs; swim to a slime dome, the Tapeworm or Candida (yeast or threads), latch, charge 2.5 s,
  // then pop: a dome loses 2 of its 4 bites and shrinks to 75%, a Tapeworm segment takes 33, threads within reach are
  // cut, small germs within 16 take 2. The eosinophil dies ('spent').
  CYT_CLIPS.eos = {
    id: 'eos', title: 'Eosinophils', dur: 13.5, thumb: 7.0,
    hud: { side: 'ctl' },
    cap: [[0, 'Eosinophils ignore small germs and swim right past them.'], [2.0, 'They latch onto anything big, like a slime dome, and pulse for 2.5 seconds...'], [4.7, '...then pop. One pop does as much as two macrophage bites, and the eosinophil is spent.'], [7.9, 'A second pop tears this dome down, and every shot hits the germs inside at full strength.'], [10.2, 'They also hunt Candida and the Tapeworm. Against a swarm they\'re wasted.']],
    bg: { tile: 1.2 },
    C: [238, 182], R0: 46,
    // dome radius and bites left; rim is an ellipse (the art's rim is 60 x 38): r across, 0.63 r along the flow
    domeR(t) { const k = t > 7.9 ? 0 : t > 4.7 ? 0.75 : 1, q = t > 4.7 && t < 5.0 ? A.lerp(1, 0.75, A.ease(A.seg(t, 4.7, 5.0))) : k; return this.R0 * q; },
    hp(t) { return t > 7.9 ? 0 : t > 4.7 ? 2 : 4; },
    rim(a, r) { return [this.C[0] + 0.63 * r * Math.cos(a), this.C[1] + r * Math.sin(a)]; },
    build(st) {
      const C = this.C, r = A.rng(5);
      st.inside = [[-14, -16], [10, 6], [-4, 18]].map(([du, dv], i) => A.ent({ art: 'pseudomonas', r: 7, rot: 0.5 + i, die: 'pop', pos: A.drift(C[0] + du, C[1] + dv, 0, 0, 0, 1.2, i * 3) }));
      // small germs drifting through, which the eosinophils pass by
      st.small = [[70, 100], [40, 140], [96, 70]].map(([u, v], i) => germ({ t0: 0, pos: A.drift(u, v, 0, 16, 3, 3, 20 + i) }));
      // E1 comes from the near vessel past the small germs and latches on the dome's upper-left rim
      const a1 = -2.45, a2 = 0.75, latch = (e, a, r, tl, tp) => {
        const p = this.rim(a, r + 6), heading = Math.atan2(C[1] - p[1], C[0] - p[0]);
        e.latch = [tl, tp, heading, p];
        e.art2 = t => (t >= tl ? 'eosinophil-latched' : 'eosinophil');
        e.rot = t => { if (t >= tl) return heading - Math.PI / 2; const [a, b] = e.pos(t - 0.05), [c, d] = e.pos(t + 0.05); return Math.atan2(d - b, c - a); };
        e.alpha = t => { if (t < tl) return 1; const k = A.seg(t, tl, tp), p2 = 0.5 + 0.5 * Math.sin(t * (8 + 16 * k)); return 0.7 + 0.3 * p2; };
        e.mul = t => { if (t < tl) return 1; const k = A.seg(t, tl, tp), p2 = 0.5 + 0.5 * Math.sin(t * (8 + 16 * k)); return 1 + 0.12 * k * p2; };
        e.t1 = tp; e.die = null;
      };
      const p1 = this.rim(a1, this.R0 + 6);
      st.e1 = A.ent({ art: 'eosinophil', r: 9, rot: 'vel', t0: 0.2, arrive: A.COLORS.eos, layer: 2, pos: A.path([[0.2, 70, A.VES - 4], [1.0, 104, 92], [1.6, 150, 124], [2.2, p1[0], p1[1]], [9, p1[0], p1[1]]], 1.2, 2) });
      latch(st.e1, a1, this.R0, 2.2, 4.7);
      const p2 = this.rim(a2, this.R0 * 0.75 + 6);
      st.e2 = A.ent({ art: 'eosinophil', r: 9, rot: 'vel', t0: 3.6, arrive: A.COLORS.eos, layer: 2, pos: A.path([[3.6, 330, A.V - A.FVES + 4], [4.6, 300, 250], [5.4, p2[0], p2[1]], [12, p2[0], p2[1]]], 1.2, 4) });
      latch(st.e2, a2, this.R0 * 0.75, 5.4, 7.9);
      // splash: the germs under the dome flash on each pop (2 damage, not enough to kill)
      for (const g of st.inside) g.hits.push(4.72, 7.92);
      st.neuts = [K.recruit('neutrophil', 5.8, 120, 250, { r: 6, wob: 6 }), K.recruit('neutrophil', 6.0, 330, 110, { r: 6, wob: 6 }), K.recruit('neutrophil', 6.2, 150, 70, { r: 6, wob: 6 })];
      K.fight(st.neuts, st.small, 6.6, { hp: 3, every: 0.4, seed: 2 });
      K.fight(st.neuts, st.inside, 8.3, { hp: 3, every: 0.3, seed: 6 });
      // the Tapeworm crawls in at the end, and a third eosinophil latches onto its head
      const head = t => [-40 + 45 * (t - 8.6), 190 + 14 * Math.sin(t * 0.9)];
      const rotOf = tt => { const [a, b] = head(tt - 0.05), [c, d] = head(tt + 0.05); return Math.atan2(d - b, c - a); };
      st.head = A.ent({ art: 'tapeworm-head', r: 15, t0: 8.6, layer: 1, pos: head, rot: rotOf });
      for (let i = 1; i <= 4; i++) A.ent({ art: 'tapeworm-segment', r: 11, t0: 8.6, pos: t => head(t - i * 0.55), rot: t => rotOf(t - i * 0.55) });
      const tl = 11.4, off = [4, -24];
      st.e3 = A.ent({ art: 'eosinophil', r: 9, rot: 'vel', t0: 9.8, arrive: A.COLORS.eos, layer: 2, pos: t => {
        const [hu, hv] = head(Math.max(t, tl)), at = [hu + off[0], hv + off[1]];
        return t < tl ? A.lerp2([150, A.VES - 4], at, A.ease(A.seg(t, 9.8, tl))) : [head(t)[0] + off[0], head(t)[1] + off[1]];
      } });
      st.e3.art2 = t => (t >= tl ? 'eosinophil-latched' : 'eosinophil');
      st.e3.rot = t => { if (t >= tl) return Math.PI / 2 - Math.PI / 2; const [a, b] = st.e3.pos(t - 0.05), [c, d] = st.e3.pos(t + 0.05); return Math.atan2(d - b, c - a); };
      st.e3.mul = t => (t < tl ? 1 : 1 + 0.12 * A.seg(t, tl, tl + 2.5) * (0.5 + 0.5 * Math.sin(t * 10)));
    },
    pips(t) {
      const r = this.domeR(t); if (r < 1) return;
      const [x, y] = A.P(this.C[0] - 0.63 * r - 6, this.C[1]), c = A.ctx, hp = this.hp(t), w = 7, g = 2, W = 4 * w + 3 * g;
      c.fillStyle = 'rgba(10,13,24,.8)'; c.fillRect(x - W / 2 - 2, y - 12, W + 4, 8);
      for (let i = 0; i < 4; i++) { c.fillStyle = i < hp ? A.PAL.slime : '#2A3150'; c.fillRect(x - W / 2 + i * (w + g), y - 10, w, 4); }
    },
    frame(t, st) {
      const dr = this.domeR(t);
      A.scene(t, { over: () => {
        if (dr > 0.5) A.spr('biofilm-dome', this.C[0], this.C[1], dr, null, 0.35 + 0.5 * this.hp(t) / 4);
        for (const e of [st.e1, st.e2]) { const [, tp, , p] = e.latch, q = (t - tp) / 0.35; if (q >= 0 && q < 1) A.spr('eosinophil-pop', p[0], p[1], 20 * (0.5 + 0.9 * q), null, 1 - q); }
      } });
      if (t > 7.9 && t < 8.6) A.dots(this.C[0], this.C[1], (t - 7.9) / 0.7, 99, 14, 'rgba(169,207,60,0.9)', 40, 3);
      this.pips(t);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 0.6 && t < 2.1) { const [u, v] = st.e1.pos(t); A.tag(u, v, 'ignores small germs', A.COLORS.eos, tagWin(t, 0.6, 2.1), -16); }
      if (t > 2.4 && t < 4.6) { const p = st.e1.latch[3]; A.tag(p[0], p[1], 'latched', A.COLORS.eos, tagWin(t, 2.4, 4.6), -16); }
      if (t > 4.9 && t < 6.8) A.tag(this.C[0] - 30, this.C[1], '2 bites', A.PAL.slime, tagWin(t, 4.9, 6.8), -16);
      if (t > 11.5) { const [u, v] = st.e3.pos(t); A.tag(u, v, 'latched', A.COLORS.eos, A.seg(t, 11.5, 11.8), -16); }
    },
    side: () => ({ mix: mixWith('eos') }),
    overlay(t) { endSpot(t, this.dur, [[0, 400]]); },
  };
  // ---- Platelets (Soil cut) ----
  // V39: each platelet takes a slot across the downstream edge of its sector. One in place stops germs from flowing
  // past it (not flu, viruses or the Tapeworm) and wears out while they push. Shots fly over; your cells pass freely.
  CYT_CLIPS.plt = {
    id: 'plt', title: 'Platelets', dur: 13.5, thumb: 5.0,
    hud: { side: 'ctl' },
    cap: [[0, 'Platelets drift to the far edge of their sector and stick together into a clot wall.'], [3.0, 'Germs pile up against the wall instead of flowing on toward the Lymph node.'], [5.8, 'Your neutrophils shoot right over the wall into the packed crowd.'], [8.3, 'Pushing wears platelets out, and a broken one leaves a gap.'], [9.6, 'Flu, viruses and the Tapeworm slip straight through. Platelets kill nothing on their own.']],
    bg: { tile: 1.2, dividers: [310] },
    W: 300, Z: [[0, 310], [310, 400]],
    build(st) {
      const r = A.rng(17), W = this.W, N = 13, gap = (A.V - A.FVES - A.VES - 12) / N;
      st.slotV = i => A.VES + 6 + (i + 0.5) * gap;
      st.plts = [];
      for (let i = 0; i < N; i++) {
        const t0 = 0.15 + ((i * 5) % N) * 0.1, far = i >= N / 2, v = st.slotV(i), arrive = t0 + 1.5 + r() * 0.3;
        const p = A.ent({ art: 'platelet', r: 3.8, rot: i * 1.7, t0, arrive: A.COLORS.plt, layer: 2,
          pos: A.path([[t0, W - 150 + r() * 80, far ? A.V - A.FVES + 4 : A.VES - 4], [t0 + 0.8, W - 40, v + (r() - 0.5) * 20], [arrive, W, v, 'l'], [30, W, v]], 0.6, i) });
        p.arriveT = arrive; p.art2 = t => (t >= p.arriveT ? 'platelet-stuck' : 'platelet');
        st.plts.push(p);
      }
      // the platelet in slot 6 takes the most pushing and breaks at 8.6
      st.brk = st.plts[6]; st.brk.t1 = 8.6; st.brk.die = 'pop';
      st.plts.forEach((p, i) => { const wear = Math.max(0, 1 - Math.abs(i - 6) / 4); p.alpha = t => (i === 6 ? 1 - 0.5 * A.seg(t, 3.6, 8.5) : 1 - 0.25 * wear * A.seg(t, 3.6, 9)); });
      // germs flow down from the Wound and pile up in rows against the wall
      st.germs = [];
      for (let i = 0; i < 12; i++) {
        const t0 = 0.6 + i * 0.16, row = Math.floor(i / 5), v = 70 + ((i * 7) % 12) * 15 + (r() - 0.5) * 8, u0 = -10 - r() * 20;
        const pu = W - 9 - 12 * row + (r() - 0.5) * 3, ta = t0 + (pu - u0) / 105;
        const flow = A.drift(u0, v, t0, 105, (175 - v) * 0.02, 2.5, i);
        st.germs.push(germ({ t0, rot: null, pos: t => (t < ta ? flow(t) : [pu + 1.4 * Math.sin(t * 7 + i), flow(ta)[1] + 2 * A.noise(i + 9, t)]) }));
      }
      // one germ behind the broken platelet slips through the gap
      const slipV = st.slotV(6);
      st.slip = germ({ t0: 2.4, rot: null, pos: t => { const pu = W - 9; if (t < 4.6) return [A.lerp(-20, pu, A.seg(t, 2.4, 4.6)), A.lerp(120, slipV, A.seg(t, 2.4, 4.6))]; if (t < 8.7) return [pu + 1.4 * Math.sin(t * 7), slipV]; return [pu + 60 * (t - 8.7), slipV + 4 * A.noise(5, t)]; } });
      // neutrophils in the Tissue below shoot back over the wall
      st.neuts = [0, 1, 2, 3].map(i => K.recruit('neutrophil', 5.2 + i * 0.15, 352 + (i % 2) * 18, 70 + i * 52, { r: 6, wob: 3 }));
      K.fight(st.neuts, st.germs.slice().sort((a, b) => b.pos(6)[0] - a.pos(6)[0]), 5.9, { hp: 3, every: 0.34, seed: 4 });
      A.volley(9.5, st.neuts, st.slip, 3, 0.25); st.slip.t1 = st.slip.hits[st.slip.hits.length - 1];
      // flu sails straight through
      st.flu = [0, 1, 2].map(i => A.ent({ art: 'flu', r: 3.6, rot: t => t * 3 + i, t0: 9.3 + i * 0.25, die: 'pop', pos: A.drift(-10, 120 + i * 40, 9.3 + i * 0.25, 170, 2, 2, i) }));
      st.flu.forEach((f, i) => { A.shot(11.5 + i * 0.25, st.neuts[i], f); f.t1 = f.hits[0]; });
    },
    frame(t, st) {
      A.scene(t, { under: () => {
        // the clot: sticky threads between neighbouring platelets in the wall
        const c = A.ctx; c.strokeStyle = A.COLORS.plt; c.lineWidth = 1;
        for (let i = 0; i + 1 < st.plts.length; i++) {
          const a = st.plts[i], b = st.plts[i + 1]; if (!A.alive(a, t) || !A.alive(b, t) || t < a.arriveT || t < b.arriveT) continue;
          const [x0, y0] = A.P(...a.pos(t)), [x1, y1] = A.P(...b.pos(t)); c.globalAlpha = 0.35; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
        c.globalAlpha = 1;
      } });
      A.zoneName(0, 310, 'Wound');
      A.zoneName(310, 400, 'Tissue');
      A.zoneChip(0, 310, 'offense'); A.zoneChip(310, 400, 'offense');
      if (t > 2.2 && t < 4.2) A.tag(this.W, 160, 'clot wall', A.COLORS.plt, tagWin(t, 2.2, 4.2), -14);
      if (t > 8.7 && t < 9.8) A.tag(this.W, st.slotV(6), 'gap', A.PAL.germHi, tagWin(t, 8.7, 9.8), -14);
      if (t > 10.6 && t < 11.9) { const [u, v] = st.flu[1].pos(t); A.tag(u, v, 'slips through', A.PAL.virus, tagWin(t, 10.6, 11.9), -14); }
    },
    side: () => ({ mix: [mixWith('plt'), { neut: 1 }] }),
    overlay(t) { endSpot(t, this.dur, this.Z); },
  };

  // ---- Dendritic couriers (Athlete's foot) ----
  // V39: grabs a sample from the nearest germ of a kind nobody has carried yet and walks it to the Lymph node;
  // then every hit on that kind does 1.5x damage for the rest of the level. Map view, so the walk shows.
  CYT_CLIPS.dc = {
    id: 'dc', title: 'Dendritic couriers', dur: 13, thumb: 5.0,
    hud: { side: 'map' },
    cap: [[0, 'A dendritic courier grabs a sample from the nearest germ...'], [2.2, '...and walks it down to the Lymph node on its own. You can\'t steer it.'], [6.4, 'When it arrives, every hit on that germ kind does 50% more damage for the rest of the level.'], [9.2, 'Each kind needs only one courier. The next one samples a kind nobody has carried yet.']],
    bg: { wound: [48, 205], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
    build(st) {
      const r = A.rng(23);
      st.yeast = A.ent({ art: 'yeast', r: 7, rot: 0.4, die: 'pop', big: true, pos: A.drift(72, 150, 0, 0, 0, 1.2, 3) });
      st.staph = [[96, 236], [168, 112], [190, 236], [276, 120]].map(([u, v], i) => A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 4.6, rot: r() * 6, die: 'pop', pos: A.drift(u, v, 0, 1.5, 0, 3, i * 4) }));
      st.arrive = 6.4;
      const grab = [st.yeast.pos(1.6)[0] - 10, st.yeast.pos(1.6)[1] - 8];
      st.dc = A.ent({ art: 'dendritic-cell', r: 12, t0: 0.2, arrive: A.COLORS.dc, layer: 2, t1: st.arrive, die: null, rot: t => (t < 1.6 ? t * 0.2 : 0),
        pos: A.path([[0.2, 60, A.VES - 4], [1.6, grab[0], grab[1]], [2.4, grab[0] + 12, grab[1] + 8], [3.6, 170, 168], [5.0, 280, 182], [st.arrive, 384, 176, 'l']], 2.5, 2) });
      st.dc.art2 = t => (t >= 1.6 ? 'dendritic-carrying' : 'dendritic-cell');
      st.neuts = [0, 1, 2].map(i => K.recruit('neutrophil', -2, 50 + i * 22, 110 + i * 60, { r: 4.8, wob: 4 }));
      // before the courier arrives, plain hits on Candida; after, each hit does 50% more (bigger sparks)
      st.hitsBig = [];
      [2.6, 3.4, 4.2].forEach((ts, k) => A.shot(ts, st.neuts[k % 3], st.yeast));
      [7.8, 8.3, 8.8].forEach((ts, k) => st.hitsBig.push(A.shot(ts, st.neuts[(k + 1) % 3], st.yeast)));
      st.yeast.t1 = st.hitsBig[2];
      K.fight(st.neuts, [st.staph[0]], 9.3, { hp: 3, every: 0.4, seed: 2 });
      // a second courier picks Staph, the next kind nobody has carried
      const s = st.staph[1], g2 = s.pos(9.9);
      st.dc2 = A.ent({ art: 'dendritic-cell', r: 12, t0: 8.6, arrive: A.COLORS.dc, layer: 2, rot: t => (t < 9.9 ? t * 0.2 : 0),
        pos: A.path([[8.6, 150, A.V - A.FVES + 4], [9.9, g2[0], g2[1] + 12], [13, 250, 180, 'l']], 2.5, 7) });
      st.dc2.art2 = t => (t >= 9.9 ? 'dendritic-carrying' : 'dendritic-cell');
    },
    frame(t, st) {
      A.scene(t);
      const all = [st.yeast, ...st.staph];
      const counts = A.MAP.map(([u0, u1]) => all.filter(g => A.alive(g, t) && g.pos(t)[0] >= u0 && g.pos(t)[0] < u1).length);
      A.mapLabels({ t, counts });
      // the sample grab, the arrival ring at the node
      const sg = A.seg(t, 1.6, 2.0); if (sg > 0 && sg < 1) { const [u, v] = st.dc.pos(t); A.ringFx(u, v, sg, A.COLORS.dc, 4, 16); }
      for (const d of [0, 0.35, 0.7]) { const p = A.seg(t, st.arrive + d, st.arrive + d + 0.6); if (p > 0 && p < 1) A.ringFx(384, 176, p, A.PAL.antibody, 6, 34); }
      for (const h of st.hitsBig) if (t >= h && t < h + 0.25) { const [u, v] = st.yeast.pos(h); A.spr('hit-spark', u, v, 9, 0, 1 - (t - h) / 0.25); }
      if (t > 1.8 && t < 4.4) { const [u, v] = st.dc.pos(t); A.tag(u, v, 'sample: Candida', A.COLORS.dc, tagWin(t, 1.8, 4.4), -16); }
      if (t > 7.8 && t < 9.2) { const [u, v] = st.yeast.pos(t); A.tag(u, v, '+50% damage', A.PAL.antibody, tagWin(t, 7.8, 9.2), -14); }
      if (t > 10.0 && t < 11.4) { const [u, v] = st.dc2.pos(t); A.tag(u, v, 'sample: Staph', A.COLORS.dc, tagWin(t, 10.0, 11.4), -16); }
    },
    side: () => ({ mix: [mixWith('dc', 0.15), { neut: 0.7, mac: 0.3 }, { neut: 0.7, mac: 0.3 }, { neut: 1 }] }),
    overlay(t) {
      A.toast('Candida: +50% damage', A.seg(t, this.cap[2][0] + 0.2, this.cap[2][0] + 0.5) * (1 - A.seg(t, 7.4, 7.7)));
      endSpot(t, this.dur, A.MAP.map(z => [z[0], z[1]]));
    },
  };
  // ---- Regulatory T cells (Sore throat) ----
  // V39: kill nothing. Each live Treg cuts fatigue build-up and Overload organ damage by 5% (at most 40%), and
  // stretches your other cells' fire interval and swallow time by 2.5% (at most 20%). Toxic-shock Staph doubles fatigue.
  CYT_CLIPS.treg = {
    id: 'treg', title: 'Regulatory T cells', dur: 12.5, thumb: 5.0,
    hud: { side: 'ctl', bottom: true },
    cap: [[0, 'Regulatory T cells kill nothing. They calm your whole body down.'], [2.4, 'Each one cuts fatigue build-up, and the organ damage from Overload, by 5%. Eight of them cut it by 40%.'], [5.8, 'The cost: each one slows your other cells\' shooting and swallowing by 2.5%, up to 20%.'], [8.6, 'They shine against Toxic-shock Staph, which doubles fatigue. With eight Tregs it builds only 1.2 times as fast.']],
    bg: { tile: 1.2 },
    build(st) {
      st.germs = K.crowd(8, [190, 110, 330, 250], 31, { r: 6.5, wob: 4 });
      st.neuts = [0, 1, 2, 3].map(i => K.recruit('neutrophil', -2, 120 + (i % 2) * 40, 100 + i * 45, { r: 6, wob: 6 }));
      K.fight(st.neuts, st.germs.slice(0, 4), 0.8, { hp: 3, every: 0.42, seed: 3 });
      K.fight(st.neuts, st.germs.slice(4), 5.9, { hp: 3, every: 0.62, seed: 5 }); // fire interval 20% longer
      st.tregs = [];
      for (let i = 0; i < 8; i++) st.tregs.push(K.recruit('treg', 0.5 + i * 0.35, 70 + (i % 4) * 26, 70 + Math.floor(i / 4) * 150 + (i % 2) * 30, { r: 10, kind: 'treg', wob: 7, travel: 0.9 }));
      st.toxic = K.crowd(3, [40, 140, 90, 220], 8, { art: 'staph-toxic', hitArt: null, r: 6.5, wob: 4, t0: 8.6, stagger: 0.2 });
      for (const g of st.toxic) g.alpha = t => 0.65 + 0.35 * Math.sin(t * 6.283);
    },
    n(t, st) { return st.tregs.filter(c => t >= c.t0 + 0.9).length; },
    fAt(t, st) {
      let f = 30;
      for (let tt = 0; tt < t; tt += 0.05) { const n = this.n(tt, st); f += 0.05 * 2.4 * (1 - Math.min(0.4, 0.05 * n)) * (tt >= 8.6 ? 2 : 1); }
      return Math.min(98, f);
    },
    frame(t, st) {
      A.scene(t);
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 1.2 && t < 2.8) { const [u, v] = st.tregs[0].pos(t); A.tag(u, v, 'Treg', A.COLORS.treg, tagWin(t, 1.2, 2.8), -18); }
      if (t > 6.0 && t < 8.4) { const [u, v] = st.neuts[1].pos(t); A.tag(u, v, 'shoots 20% slower', A.COLORS.neut, tagWin(t, 6.0, 8.4), -14); }
      if (t > 8.9 && t < 10.8) { const [u, v] = st.toxic[1].pos(t); A.tag(u, v, 'Toxic-shock Staph', A.PAL.kill, tagWin(t, 8.9, 10.8), -16); }
    },
    hudFrame(t, st) {
      const n = this.n(t, st), tag = !n ? '' : t >= 8.6 ? 'fatigue ×1.2' : `fatigue −${Math.min(40, 5 * n)}%`;
      A.hudOutput(A.R.bottom, Object.assign(st, { out: 0.85, f: this.fAt(t, st) }), t, { mulTag: tag });
    },
    side: () => ({ mix: mixWith('treg', 0.15) }),
    overlay(t) { endSpot(t, this.dur, [[0, 400]]); },
  };

  // ---- Interferon cells (Cold sore) ----
  // V39: kill nothing; stay among your neutrophils. Herpes can't hijack a cell within the haze (40); flu inside moves at 0.5x.
  CYT_CLIPS.ifn = {
    id: 'ifn', title: 'Interferon cells', dur: 13.5, thumb: 8.2,
    hud: { side: 'ctl' },
    cap: [[0, 'Interferon cells kill nothing. They stay among your neutrophils, wrapped in a pale haze.'], [1.9, 'Herpes can\'t hijack a cell inside the haze. It has to look for another host.'], [4.2, 'Outside the haze it still gets in...'], [6.2, '...so NK cells still have a job. The haze prevents infection; NK cells clean up after.'], [8.8, 'Flu inside the haze moves at half speed.']],
    bg: { tile: 1.2 },
    H: 62,
    build(st) {
      const H = this.H;
      st.G = A.drift(160, 150, 0, 2, 0, 4, 1);
      st.group = [0, 1, 2, 3].map(i => A.ent({ art: 'neutrophil', r: 6, layer: 2, pos: t => { const [gu, gv] = st.G(t), a = i * 1.571 + 0.4 + 0.25 * t; return [gu + 26 * Math.cos(a) + 3 * A.noise(i, t), gv + 26 * Math.sin(a) + 3 * A.noise(i + 4, t)]; } }));
      st.ifn = A.ent({ art: 'interferon-cell', r: 7, layer: 2, pos: t => { const [gu, gv] = st.G(t); return [gu + 2 * A.noise(9, t), gv + 2 * A.noise(10, t)]; } });
      st.L = K.recruit('neutrophil', -2, 305, 236, { r: 6, wob: 5, seed: 3 });
      st.L.art2 = t => (t > 4.2 && Math.floor(t / 0.3) % 2 ? 'neutrophil-infected' : 'neutrophil');
      // a virus dives for a group neutrophil and is turned away at the haze edge
      const dive = (t0, from, target) => {
        const raw = t => A.lerp2(from, target.pos(t), A.ease(A.seg(t, t0, t0 + 1.4)));
        let tb = t0 + 1.4; for (let t = t0; t < t0 + 1.4; t += 0.01) { const [u, v] = raw(t), [gu, gv] = st.G(t); if (Math.hypot(u - gu, v - gv) < H + 2) { tb = t; break; } }
        const B = raw(tb), [gu, gv] = st.G(tb), d = Math.hypot(B[0] - gu, B[1] - gv) || 1, out = [(B[0] - gu) / d, (B[1] - gv) / d];
        return { tb, B, at: t => (t <= tb ? raw(t) : [B[0] + out[0] * 26 * A.ease(A.seg(t, tb, tb + 0.6)), B[1] + out[1] * 26 * A.ease(A.seg(t, tb, tb + 0.6))]) };
      };
      const d1 = dive(0.6, [-10, 110], st.group[0]), d2 = dive(1.0, [-10, 215], st.group[2]);
      st.bounce = d1;
      const after = d1.tb + 0.6;
      st.h1 = A.ent({ art: 'herpes', r: 4.5, rot: t => t * 2, t0: 0.6, t1: 4.2, die: null, pos: t => (t <= after ? d1.at(t) : A.lerp2(d1.at(after), st.L.pos(4.2), A.ease(A.seg(t, after, 4.2)))) });
      st.h2 = A.ent({ art: 'herpes', r: 4.5, rot: t => t * 2 + 1, t0: 1.0, die: 'lilac', pos: t => { const p = d2.at(t); return t > d2.tb + 0.6 ? [p[0] + 20 * (t - d2.tb - 0.6), p[1]] : p; } });
      A.shot(3.4, st.group[2], st.h2); st.h2.t1 = st.h2.hits[0];
      // the NK cell pops the hijacked neutrophil outside the haze
      st.pop = 7.8;
      st.nk = A.ent({ art: 'nk-cell', r: 9, rot: t => t * 0.5, t0: 6.2, arrive: A.COLORS.nk, layer: 2, pos: t => { const [u, v] = st.L.pos(Math.min(t, st.pop)), p = A.ease(A.seg(t, 6.2, st.pop)); return [A.lerp(u - 40, u - 10, p) + 3 * A.noise(3, t), A.lerp(A.V - A.FVES + 4, v + 6, p) + 3 * A.noise(4, t)]; } });
      st.L.t1 = st.pop; st.L.die = 'lilac';
      // flu drifts down; inside the haze it moves at half speed (stepped, so it stays a pure function of t)
      st.flu = [0, 1, 2, 3].map(i => {
        const t0 = 8.4 + i * 0.2, v0 = 120 + i * 22, tab = [];
        let u = -10, v = v0;
        for (let t = t0; t <= 14; t += 0.02) { tab.push([u, v]); const [gu, gv] = st.G(t), inside = Math.hypot(u - gu, v - gv) < H; u += 0.02 * (inside ? 60 : 120); v += 0.02 * 3 * Math.sin(t * 2 + i); }
        return A.ent({ art: 'flu', r: 3.6, rot: t => t * 3 + i, t0, die: 'pop', pos: t => tab[Math.max(0, Math.min(tab.length - 1, Math.round((t - t0) / 0.02)))] });
      });
      st.flu.forEach((f, i) => { A.shot(11.2 + i * 0.25, st.group[i], f); f.t1 = f.hits[0]; });
    },
    frame(t, st) {
      A.scene(t, { under: () => { const [u, v] = st.ifn.pos(t); A.spr('interferon-haze', u, v, this.H, null, 0.5); } });
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 0.3 && t < 1.8) { const [u, v] = st.ifn.pos(t); A.tag(u, v, 'Interferon cell', A.COLORS.ifn, tagWin(t, 0.3, 1.8), 30); }
      if (t > st.bounce.tb && t < st.bounce.tb + 1.6) A.tag(st.bounce.B[0], st.bounce.B[1], 'protected', A.COLORS.ifn, tagWin(t, st.bounce.tb, st.bounce.tb + 1.6), -12);
      if (t > 4.4 && t < 6.2) { const [u, v] = st.L.pos(t); A.tag(u, v, 'hijacked', A.PAL.virus, tagWin(t, 4.4, 6.2), -16); }
      if (t > 6.4 && t < 7.8) { const [u, v] = st.nk.pos(t); A.tag(u, v, 'NK cell', A.COLORS.nk, tagWin(t, 6.4, 7.8), -18); }
      if (t > 9.4 && t < 11.2) { const [u, v] = st.flu[1].pos(t), [gu, gv] = st.G(t); if (Math.hypot(u - gu, v - gv) < this.H) A.tag(u, v, '½ speed', A.COLORS.ifn, tagWin(t, 9.4, 11.2), -12); }
    },
    side: () => ({ mix: mixWith('ifn', 0.15) }),
    overlay(t) { endSpot(t, this.dur, [[0, 400]]); },
  };

  // ---- Mast cells (Gut) ----
  // V39: sit where they're made. A Tapeworm or Candida within 60 floods the sector with mucus for 5 s (then a 12 s rest):
  // germs there move at 0.5x, your cells at 0.8x. The game's first mucus toast says so.
  CYT_CLIPS.mast = {
    id: 'mast', title: 'Mast cells', dur: 12, thumb: 4.4,
    hud: { side: 'ctl' },
    cap: [[0, 'Mast cells stay where they\'re made.'], [2.2, 'When the Tapeworm or Candida comes close, they flood the whole sector with mucus for 5 seconds.'], [4.6, 'Germs in the mucus move at half speed. Your own cells slow down too, to 80%.'], [8.0, 'Then each mast cell rests 12 seconds. Mucus and a slow crawl are how your gut fights worms.']],
    bg: { tile: 1.1 },
    M0: 2.6, M1: 7.6,
    // scene clocks: germs run at 0.5x while the mucus is down, your cells at 0.8x
    clock(t, k) { const a = this.M0, b = this.M1; return t < a ? t : t < b ? a + k * (t - a) : a + k * (b - a) + (t - b); },
    build(st) {
      const g = t => this.clock(t, 0.5), c = t => this.clock(t, 0.8);
      const head = tau => [60 + 24 * tau, 165 + 22 * Math.sin(tau * 0.8)];
      const rotOf = tau => { const [a, b] = head(tau - 0.05), [cc, d] = head(tau + 0.05); return Math.atan2(d - b, cc - a); };
      st.headAt = t => head(g(t));
      st.head = A.ent({ art: 'tapeworm-head', r: 15, layer: 1, pos: t => head(g(t)), rot: t => rotOf(g(t)) });
      for (let i = 1; i <= 5; i++) A.ent({ art: 'tapeworm-segment', r: 11, pos: t => head(g(t) - i * 0.78), rot: t => rotOf(g(t) - i * 0.78) });
      st.small = [[40, 90], [0, 245], [-30, 120]].map(([u, v], i) => germ({ rot: null, pos: t => { const tt = g(t); return [u + 30 * tt + 3 * A.noise(i, tt), v + 3 * A.noise(i + 6, tt)]; } }));
      st.mast = [[205, 95], [222, 236]].map(([u, v], i) => A.ent({ art: 'mast-cell', r: 9, rot: i * 2.1, layer: 2, pos: t => [u + 1.5 * A.noise(i, t * 0.5), v + 1.5 * A.noise(i + 2, t * 0.5)], mul: t => (t > this.M0 && t < this.M0 + 0.5 ? 1.12 : 1) }));
      // neutrophils wander and chip the worm; in the mucus they move at 80%
      st.neuts = [[300, 90], [320, 200], [270, 260]].map(([u, v], i) => A.ent({ art: 'neutrophil', r: 6, layer: 2, pos: t => { const tt = c(t); return [u + 14 * A.noise(i * 3, tt * 1.4) - 10 * Math.sin(tt * 0.6 + i), v + 14 * A.noise(i * 3 + 1, tt * 1.4)]; } }));
      A.volley(3.4, st.neuts, st.small[0], 3, 0.4); st.small[0].t1 = st.small[0].hits[2];
      A.volley(5.6, st.neuts, st.head, 6, 0.4);
      A.volley(9.0, st.neuts, st.small[1], 3, 0.35); st.small[1].t1 = st.small[1].hits[2];
    },
    mucusA(t) { if (t < this.M0 || t > this.M1) return 0; return A.seg(t, this.M0, this.M0 + 0.4) * Math.min(1, (this.M1 - t) / 1.5) * 0.55; },
    frame(t, st) {
      const ma = this.mucusA(t);
      A.scene(t, { under: () => { if (ma > 0) for (const u of [50, 150, 250, 350]) A.spr('mucus', u, (A.VES + A.V - A.FVES) / 2, 75, null, ma); } });
      for (const m of st.mast) { const [u, v] = m.pos(t); A.ringFx(u, v, (t - this.M0) / 0.6, A.COLORS.mast, 8, 46); }
      A.zoneName(0, 400, 'Tissue');
      A.zoneChip(0, 400, 'offense');
      if (t > 0.5 && t < 2.3) { const [u, v] = st.mast[0].pos(t); A.tag(u, v, 'Mast cell', A.COLORS.mast, tagWin(t, 0.5, 2.3), -18); }
      if (t > 4.6 && t < 7.4) { const [u, v] = st.headAt(t); A.tag(u, v, '½ speed', A.COLORS.mast, tagWin(t, 4.6, 7.4), -22); }
      if (t > 8.3 && t < 10.3) { const [u, v] = st.mast[0].pos(t); A.tag(u, v, 'rests 12 s', A.COLORS.mast, tagWin(t, 8.3, 10.3), -18); }
    },
    side: () => ({ mix: mixWith('mast', 0.15) }),
    overlay(t) {
      A.toast('Mucus: the whole sector slows down', A.seg(t, this.M0 + 0.2, this.M0 + 0.5) * (1 - A.seg(t, 4.0, 4.2)));
      endSpot(t, this.dur, [[0, 400]]);
    },
  };
})();

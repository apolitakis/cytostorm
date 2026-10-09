'use strict';
// ---------------------------------------------------------------------------
// Tutorial clips, part 1: shared choreography helpers and the basics.
// A clip: { id, title, dur, cap: [[t, text]], hud: { top, bottom }, bg, build(st), frame(t, st, A),
//           hudFrame(t, st, A), fingers(t, st, A), shake(t) }. build() runs once and lays out every
// entity and shot on the clip's timeline; frame() draws time t.
// ---------------------------------------------------------------------------
const CYT_CLIPS = {};
const CYT_KIT = (function () {
  const A = CYT.api;
  // Map-view zones (the whole level squeezed onto the stage)
  const ZM = [0, 120, 240, 360, 400];
  // Staph-like germs milling in a region; returns the entities
  function crowd(n, reg, seed, o = {}) {
    const r = A.rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      const u = reg[0] + r() * (reg[2] - reg[0]), v = reg[1] + r() * (reg[3] - reg[1]), t0 = o.t0 != null ? o.t0 + (o.stagger || 0) * i : -1e9;
      out.push(A.ent({ art: o.art || 'bacterium', hitArt: o.hitArt === undefined ? 'bacterium-hit' : o.hitArt, r: o.r || 5, rot: r() * 6.283, die: o.die || 'pop', t0,
        pos: A.drift(u, v, 0, o.vu || 0, o.vv || 0, o.wob || 3, seed + i * 1.7), layer: o.layer || 0 }));
    }
    return out;
  }
  // Cells coming out of the blood vessel at time t0 and settling at (u, v); wander after
  // A new cell comes out of a blood vessel and heads to (u, v). As in v3, macrophages use the near vessel and
  // other cells come out of either one, half from the thin far vessel (o.side 'near' | 'far' forces one).
  function recruit(art, t0, u, v, o = {}) {
    const far = o.side ? o.side === 'far' : !art.startsWith('macrophage') && (Math.sin(t0 * 12.9898 + u * 78.233 + v * 37.719) * 43758.5453 % 1 + 1) % 1 < 0.5;
    const keys = [[t0, u + (o.du || 0), far ? A.V - A.FVES + 4 : A.VES - 4], [t0 + (o.travel || 0.8), u, v]];
    if (o.then) for (const k of o.then) keys.push(k);
    return A.ent({ art, r: o.r || 6, t0, t1: o.t1 || 1e9, arrive: A.COLORS[o.kind || 'neut'], die: o.die || 'puff', rot: o.rot != null ? o.rot : null,
      pos: A.path(keys, o.wob == null ? 4 : o.wob, o.seed || t0 * 13 + u), layer: o.layer || 2, art2: o.art2 });
  }
  // Neutrophils shoot a list of targets: each target takes hp shots from whoever is free first
  function fight(shooters, targets, t0, o = {}) {
    const hp = o.hp || 3, every = o.every || 0.7, r = A.rng(o.seed || 7);
    const free = shooters.map(s => Math.max(t0, s.t0 + 0.7) + r() * 0.3);
    for (const g of targets) {
      let last = 0;
      for (let h = 0; h < hp; h++) {
        let best = -1;
        for (let i = 0; i < shooters.length; i++) {
          const s = shooters[i]; if (free[i] >= s.t1 - 0.2) continue;
          if (best < 0 || free[i] < free[best]) best = i;
        }
        if (best < 0) break;
        const ts = Math.max(free[best], g.t0 + 0.3, o.after || 0, g.engage || 0);
        if (ts >= g.t1) break;
        last = A.shot(ts, shooters[best], g, { tuned: o.tuned });
        free[best] = ts + every * (0.8 + 0.4 * r());
      }
      if (last && o.kill !== false) g.t1 = Math.min(g.t1, last);
    }
  }
  // Fraction of t spent with germs inside u > u0: a lymph-node ring that fills while occupied
  // breach clock: fills at rate/s while any of ents is past u0, drains at drain/s once they're gone
  function timerTable(ents, u0, rate, dur, start = 0, drain = 0) {
    const tab = []; let f = start;
    for (let t = 0; t <= dur + 0.05; t += 0.05) {
      const busy = ents.some(e => A.alive(e, t) && e.pos(t)[0] > u0);
      if (busy) f = Math.min(1, f + rate * 0.05); else f = Math.max(0, f - drain * 0.05);
      tab.push([f, busy]);
    }
    return t => tab[Math.max(0, Math.min(tab.length - 1, Math.round(t / 0.05)))];
  }
  const count = (list, t) => list.reduce((n, e) => n + (A.alive(e, t) ? 1 : 0), 0);
  // Anchors for fingers
  const at = fn => fn;
  const world = (u, v) => () => A.P(u, v);
  const off = () => [A.R.w + 30, A.R.h * 0.8];
  return { ZM, crowd, recruit, fight, timerTable, count, at, world, off };
})();

// ---- 1. The goal ----
CYT_CLIPS.goal = {
  id: 'goal', title: 'Hold the Lymph node', dur: 10.5,
  cap: [[0, 'Germs pour out of the Wound and drift down toward the Lymph node, the thin strip at the bottom.'], [3.7, 'Germs that reach the Lymph node fill a breach clock. Staph hurts your spleen: a full clock costs it a bar.'], [7.4, 'Kill them and the clock drains away. Lose every bar of an organ and it\'s Host failure.']],
  bg: { wound: [48, 205], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(11);
    st.germs = [];
    for (let i = 0; i < 12; i++) {
      const ts = 0.1 + i * 0.22, u0 = 40 + r() * 16, v0 = 190 + r() * 30, u1 = 365 + r() * 26, v1 = 95 + r() * 170;
      st.germs.push(A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 4.6, rot: 'vel', t0: ts, die: 'pop',
        pos: A.path([[ts, u0, v0], [ts + 0.5, u0 + 14, v0 - 4], [ts + 4.1, u1, v1, 'l'], [ts + 12, u1 + 3, v1 + 5, 'l']], 3, i * 3.1) }));
    }
    st.neuts = [];
    for (let i = 0; i < 6; i++) st.neuts.push(K.recruit('neutrophil', 4.6 + i * 0.12, 318 + i * 11, 120 + (i % 3) * 55, { r: 4.8, wob: 5, travel: 0.7 }));
    K.fight(st.neuts, st.germs.slice().sort((a, b) => a.pos(5)[0] - b.pos(5)[0]).reverse(), 5.2, { hp: 3, every: 0.32, seed: 3 });
    st.timer = K.timerTable(st.germs, A.NODE_U, 0.11, this.dur, 0, 0.06);
  },
  frame(t, st, A) {
    const [frac, busy] = st.timer(t);
    A.flowArrow(70, 372, 245, A.seg(t, 0.4, 0.9) * (1 - A.seg(t, 3.2, 3.8)), t);
    A.scene(t);
    const [x, y, r] = A.mapLabels({ frac, busy, t });
    if (t > 3.6 && t < 7.3) { A.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8); A.ctx.strokeStyle = A.PAL.damage; A.ctx.lineWidth = 1.5; A.ctx.beginPath(); A.ctx.arc(x, y, r + 7, 0, 6.283); A.ctx.stroke(); A.ctx.globalAlpha = 1; }
  },
};

// ---- 2. Division and the blink ----
CYT_CLIPS.divide = {
  id: 'divide', title: 'Germs multiply', dur: 9.5,
  cap: [[0, 'Bacteria multiply. Just before one splits, it blinks.'], [2.6, 'Then it splits in two, and both halves blink.'], [5.2, 'Staph doubles every 10 seconds. Every blink is one more germ, so kill them early.']],
  bg: { tile: 1.4 },
  build(st) {
    const A = CYT.api;
    const axes = [0, Math.PI / 2, 0, Math.PI / 2, 0], dists = [32, 27, 14, 12], times = [1.9, 3.7, 5.3, 6.8];
    const root = A.ent({ art: 'bacterium', r: 9, rot: axes[0], pos: A.path([[0, 205, 172]], 2, 1), die: 'pop' });
    st.all = [root];
    let gen = [root];
    times.forEach((td, g) => {
      const next = [];
      for (const e of gen) {
        const tt = td + (g ? (e.id % 5) * 0.06 : 0);
        const kids = A.divide(e, tt, { angle: axes[g], dist: dists[g], wob: 2 });
        for (const k of kids) { k.rot = axes[g + 1]; next.push(k); st.all.push(k); }
      }
      gen = next;
    });
    // the "about to divide" art for the last 1.5 s, as in the game
    for (const e of st.all) {
      const end = e.t1;
      if (end < 1e8) { e.art2 = t => (t > end - 1.5 ? 'bacterium-dividing' : 'bacterium'); e.mul = t => (t > end - 1.5 ? 1.2 : 1); }
    }
  },
  frame(t, st, A) {
    A.scene(t);
    A.zoneCount(0, 400, CYT_KIT.count(st.all, t));
    const root = st.all[0];
    if (t > 0.9 && t < 2.6) { const [u, v] = root.pos(Math.min(t, root.t1 - 0.01)); A.tag(u, v, 'blink: about to split', '#FFFFFF', A.seg(t, 0.9, 1.2) * (1 - A.seg(t, 2.3, 2.6)), -22); }
  },
};

// ---- 3. Production cards ----
CYT_CLIPS.cards = {
  id: 'cards', title: 'Choose what each zone makes', dur: 15.6,
  cap: [[0, 'Each zone has a card showing its response: the cells it makes. Tap one to change it.'], [2.8, 'Drag a slider to share out the response. Tap 100% to make only that cell, or 0% to stop making it.'], [4.3, 'Tap Save under a Response slot to keep this response. Tap the slot to use it in any zone, even next match.'], [5.9, 'Apply to all zones copies this response to the other three. Each keeps its own stance.'], [7.8, 'New cells come out of the blood vessels on both edges of their zone. Macrophages always use the wide one.'], [11.2, 'Neutrophils are your gunners. Three hits kill a Staph.']],
  hud: { bottom: true },
  bg: { wound: [55, 215], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  saveAt: 4.9, applyAt: 6.2,
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(5);
    st.germs = K.crowd(14, [25, 120, 125, 270], 21, { r: 4.6, vu: 2.5, wob: 5 });
    st.neuts = [];
    for (let i = 0; i < 16; i++) st.neuts.push(K.recruit('neutrophil', 7.4 + i * 0.2, 12 + r() * 115, 110 + r() * 150, { r: 4.8, wob: 6, travel: 0.9 }));
    // a couple of old cells in each zone, and one macrophage
    st.old = [K.recruit('neutrophil', -5, 190, 140, { r: 4.8 }), K.recruit('neutrophil', -5, 215, 230, { r: 4.8 }), K.recruit('neutrophil', -5, 320, 160, { r: 4.8 }), K.recruit('neutrophil', -5, 350, 240, { r: 4.8 }), K.recruit('macrophage-offense', -5, 70, 95, { r: 11, wob: 2 })];
    K.fight(st.neuts, st.germs.slice().sort((a, b) => a.pos(8.4)[1] - b.pos(8.4)[1]), 8.0, { hp: 3, every: 0.7, seed: 8 });
  },
  mixAt(t) { const A = CYT.api, n = 0.7 + 0.15 * A.ease(A.seg(t, 2.9, 3.4)) + 0.15 * A.ease(A.seg(t, 3.85, 4.0)); return { neut: n, mac: 1 - n }; },
  loadouts(t) {
    const saved = t >= this.saveAt, slots = [saved ? { neut: 1 } : null, { neut: 0.5, mac: 0.5 }, null];
    return { slots, active: saved ? 0 : -1, saving: t >= this.saveAt && t < this.saveAt + 0.3 ? 0 : -1 };
  },
  frame(t, st, A) {
    A.scene(t);
    A.mapLabels({ t });
    if (t > 7.4 && t < 9.2) { const [x, y, w] = A.zoneRect(0, 120); const c = A.ctx; c.globalAlpha = 0.5 * (1 - A.seg(t, 8.6, 9.2)); c.strokeStyle = A.PAL.cell; c.lineWidth = 2; c.setLineDash([4, 4]); c.strokeRect(x + 2, y - 8, w - 4, 10); c.setLineDash([]); c.globalAlpha = 1; }
    A.toast('Wound response copied to all zones', A.seg(t, this.applyAt + 0.1, this.applyAt + 0.3) - A.seg(t, this.applyAt + 1.8, this.applyAt + 2.1));
  },
  hudFrame(t, st, A) {
    A.hudSheet({ zone: 'Wound', units: ['neut', 'mac'], mix: this.mixAt(t), loadouts: this.loadouts(t), apply: t >= this.applyAt && t < this.applyAt + 0.2 ? 'pressed' : 'idle', show: A.seg(t, 1.3, 1.6) - A.seg(t, 7.0, 7.3) });
    const m = this.mixAt(t), base = { neut: 0.7, mac: 0.3 }, q = A.ease(A.seg(t, this.applyAt, this.applyAt + 0.25));
    const copied = { neut: A.lerp(base.neut, m.neut, q), mac: A.lerp(base.mac, m.mac, q) };
    const d = t - this.applyAt, flash = d > 0 && d < 1.2 ? (1 - d / 1.2) * (0.65 + 0.35 * Math.sin(d * 18)) : 0;
    A.hudCards(A.R.bottom, { mix: [m, copied, copied, copied], open: t > 1.25 && t < 7.3 ? 0 : -1, flash });
  },
  fingers(t, st, A) {
    const K = CYT_KIT, card = () => A.R.hud.cards[0], sl = () => A.R.hud.sliders ? A.R.hud.sliders.neut : { x0: 0, x1: 0, y: 0 };
    const knob = v => () => { const s = sl(); return [A.lerp(s.x0, s.x1, v), s.y]; }, full = () => (A.R.hud.pills && A.R.hud.pills.neut ? A.R.hud.pills.neut.full : [0, 0]);
    const save = () => (A.R.hud.saves ? A.R.hud.saves[0] : [0, 0]), ap = () => A.R.hud.apply || [0, 0];
    A.finger(t, [[0.7, K.off], [1.15, card], [1.2, card, true], [1.4, card], [2.6, knob(0.7)], [2.85, knob(0.7), true], [3.4, knob(0.85), true], [3.5, knob(0.85)], [3.75, full], [3.8, full, true], [3.95, full],
      [4.8, save], [this.saveAt, save, true], [this.saveAt + 0.15, save], [6.1, ap], [this.applyAt, ap, true], [this.applyAt + 0.15, ap], [6.7, ap, false, 'out']]);
  },
};

// ---- 3b. Switching a zone off ----
CYT_CLIPS.shutoff = {
  id: 'shutoff', title: 'Switch a zone off', dur: 13.5,
  cap: [[0, 'The Lymph node is quiet, but it still gets a quarter of your new cells.'], [1.4, 'Tap the power button in its corner to switch it off. The switch on its card works too.'], [3.4, 'Cells already there stay and fight. No new ones are made.'], [5.4, 'Its share goes to the zones still on, so each makes a bit more. The Wound fills faster.'], [8.6, 'Switch the Tissue and Deep tissue off too, and the Wound makes the most it can. Its vessel walls only let so many cells through.'], [10.6, 'The last zone won\'t switch off. One zone always has to keep making cells.']],
  hud: { bottom: true },
  bg: { wound: [55, 215], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  offAt: 2.7, off2At: 9.2, off3At: 9.8, noAt: 11.2,
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(31);
    st.germs = [].concat(K.crowd(18, [20, 110, 110, 278], 32, { r: 4.6, vu: 1.5, wob: 5 }), K.crowd(3, [140, 120, 225, 260], 33, { r: 4.6, vu: 1, wob: 5 }));
    const wound = [K.recruit('neutrophil', -5, 60, 150, { r: 4.8 }), K.recruit('neutrophil', -5, 90, 240, { r: 4.8 }), K.recruit('macrophage-offense', -5, 65, 95, { r: 11, wob: 2 })];
    const tissue = [K.recruit('neutrophil', -5, 170, 140, { r: 4.8 }), K.recruit('neutrophil', -5, 200, 230, { r: 4.8 })];
    const deep = [K.recruit('neutrophil', -5, 280, 130, { r: 4.8 }), K.recruit('neutrophil', -5, 320, 210, { r: 4.8 })];
    st.extra = [K.recruit('neutrophil', -5, 378, 150, { r: 4.8, wob: 3 }), K.recruit('neutrophil', -5, 382, 230, { r: 4.8, wob: 3 })];
    // before: a trickle into every zone; then the zones still on make a bit more each (v3 V27: 109% / 119% / 132%; vessel walls cap the rest)
    for (const t0 of [0.5, 1.7]) wound.push(K.recruit('neutrophil', t0, 15 + r() * 95, 110 + r() * 160, { r: 4.8, wob: 6 }));
    for (const t0 of [1.0, 2.3]) tissue.push(K.recruit('neutrophil', t0, 130 + r() * 100, 110 + r() * 160, { r: 4.8, wob: 6 }));
    for (const t0 of [0.8, 2.0]) deep.push(K.recruit('neutrophil', t0, 250 + r() * 100, 110 + r() * 160, { r: 4.8, wob: 6 }));
    st.extra.push(K.recruit('neutrophil', 1.3, 372, 120 + r() * 120, { r: 4.8, wob: 3 }));
    for (let i = 0; i < 12; i++) wound.push(K.recruit('neutrophil', 3.6 + i * 0.48, 12 + r() * 100, 105 + r() * 170, { r: 4.8, wob: 6 }));
    for (let i = 0; i < 6; i++) wound.push(K.recruit('neutrophil', this.off3At + 0.3 + i * 0.3, 12 + r() * 100, 105 + r() * 170, { r: 4.8, wob: 6 }));
    for (let i = 0; i < 5; i++) tissue.push(K.recruit('neutrophil', 3.9 + i * 1.0, 130 + r() * 100, 110 + r() * 160, { r: 4.8, wob: 6 }));
    for (let i = 0; i < 5; i++) deep.push(K.recruit('neutrophil', 4.2 + i * 1.0, 250 + r() * 100, 110 + r() * 160, { r: 4.8, wob: 6 }));
    K.fight(wound.filter(c => c.art === 'neutrophil'), st.germs.slice(0, 18).sort((a, b) => a.pos(4)[1] - b.pos(4)[1]), 1.2, { hp: 3, every: 0.75, seed: 34 });
    K.fight(tissue, st.germs.slice(18), 1.6, { hp: 3, every: 0.9, seed: 35 });
  },
  // making cells, per zone (Wound, Tissue, Deep tissue, Lymph node)
  on(t) { return [true, t < this.off2At, t < this.off3At, t < this.offAt]; },
  frame(t, st, A) {
    A.scene(t);
    const on = this.on(t), c = A.ctx, offAt = [1e9, this.off2At, this.off3At];
    const counts = A.MAP.map(([u0, u1]) => st.germs.filter(g => A.alive(g, t) && g.pos(t)[0] >= u0 && g.pos(t)[0] < u1).length);
    A.mapLabels({ counts, off: !on[3], t });
    A.MAP.slice(0, 3).forEach(([u0, u1], z) => {
      if (t < offAt[z]) return;
      const [x, y] = A.zoneRect(u0, u1);
      c.globalAlpha = A.seg(t, offAt[z], offAt[z] + 0.3); c.fillStyle = '#9AA4BC'; c.font = `600 10.5px ${A.MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('NO NEW CELLS', x + 10, y + 72); c.globalAlpha = 1;
    });
    st.pwr = A.MAP.map(([u0, u1], z) => A.zonePower(u0, u1, on[z], z === 0 && t > this.noAt && t < this.noAt + 0.45 ? 1 - (t - this.noAt) / 0.45 : 0));
  },
  hudFrame(t, st, A) {
    const base = { neut: 0.7, mac: 0.3 }, on = this.on(t), n = on.filter(Boolean).length, b = { 4: null, 3: '109%', 2: '119%', 1: '132%' }[n];
    A.hudCards(A.R.bottom, { mix: [base, base, base, base], off: on.map(x => !x), boost: on.map(x => (x ? b : null)) });
  },
  overlay(t, st, A) {
    const toast = (at, end, text) => A.toast(text, A.seg(t, at + 0.05, at + 0.25) - A.seg(t, end, end + 0.3));
    toast(this.offAt, this.offAt + 1.8, 'Lymph node off: its share goes to the other zones');
    toast(this.off2At, this.off3At - 0.3, 'Tissue off: its share goes to the other zones');
    toast(this.off3At, this.off3At + 1.2, 'Deep tissue off: its share goes to the Wound');
    toast(this.noAt, this.noAt + 1.8, 'One zone has to keep making cells');
  },
  fingers(t, st, A) {
    const K = CYT_KIT, p = z => () => (st.pwr ? st.pwr[z] : [0, 0]);
    A.finger(t, [[1.6, K.off], [2.4, p(3)], [this.offAt, p(3), true], [this.offAt + 0.15, p(3)], [3.2, p(3), false, 'out']]);
    A.finger(t, [[8.4, K.off], [8.9, p(1)], [this.off2At, p(1), true], [this.off2At + 0.15, p(1)], [this.off3At - 0.2, p(2)], [this.off3At, p(2), true], [this.off3At + 0.15, p(2)],
      [10.8, p(0)], [this.noAt, p(0), true], [this.noAt + 0.15, p(0)], [11.8, p(0), false, 'out']]);
  },
};

// ---- 4. Offense and Support ----
CYT_CLIPS.modes = {
  id: 'modes', title: 'Offense or Support', dur: 13.5,
  cap: [[0, 'Every zone is on Offense or Support, and your cells there fight to match. On Offense, macrophages swallow germs whole.'], [4.2, 'Tap a zone to switch it to Support.'], [5.8, 'On Support, macrophages stand still inside a ring. Neutrophils in the ring move faster and fire tuned shots.'], [9.6, 'A tuned shot kills in one hit, and it pierces armor.']],
  bg: { tile: 1.2 },
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(3);
    const mac = st.mac = A.ent({ art: 'macrophage-offense', r: 17, layer: 1, die: 'puff', big: true,
      pos: A.path([[0, 110, 175], [1.1, 150, 160], [2.1, 160, 160], [3.0, 200, 195], [4.6, 205, 190]], 2, 2) });
    mac.flip = [{ t: 4.6, art: 'macrophage-support' }];
    const g1 = A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 7, rot: 0.6, pos: A.path([[0, 185, 150]], 3, 1), die: 'pop' });
    const g2 = A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 7, rot: 2.1, pos: A.path([[0, 235, 212]], 3, 4), die: 'pop' });
    A.gulp(mac, g1, 1.25); A.gulp(mac, g2, 3.2);
    st.germs = K.crowd(4, [280, 90, 360, 260], 12, { r: 7, wob: 4 });
    // more germs drift in from the Wound side after the flip
    const r2 = A.rng(9);
    for (let i = 0; i < 9; i++) { const t0 = 5.4 + i * 0.45, v = 100 + r2() * 170; const g = A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 7, rot: 'vel', t0, die: 'pop', pos: A.path([[t0, -10, v], [t0 + 6, 250, v + (r2() - 0.5) * 40, 'l']], 3, i) }); g.engage = t0 + 2.6; st.germs.push(g); }
    st.ringOn = 4.7;
    st.neuts = [];
    for (let i = 0; i < 5; i++) {
      const t0 = 5.0 + i * 0.25, a = i / 5 * 6.283;
      st.neuts.push(K.recruit('neutrophil', t0, 205 + Math.cos(a) * 34, 190 + Math.sin(a) * 30, { r: 6, travel: 0.5, wob: 9, seed: i * 5 }));
    }
    const outside = K.recruit('neutrophil', 5.2, 330, 110, { r: 6, wob: 6 });
    st.outside = outside;
    K.fight(st.neuts, st.germs.filter((g, i) => i !== 1), 6.0, { hp: 1, every: 0.55, tuned: true, seed: 4 });
    K.fight([outside], [st.germs[1]], 6.4, { hp: 3, every: 0.7, seed: 6 });
  },
  frame(t, st, A) {
    const ringA = A.seg(t, st.ringOn, st.ringOn + 0.5);
    A.scene(t, {
      under: () => {
        if (ringA > 0) { const [u, v] = st.mac.pos(t), pulse = 1 + 0.03 * Math.sin(t * 6.283 / 1.6); A.spr('support-ring', u, v, 62 * ringA * pulse, null, 0.85 * ringA); }
        // speed trails on boosted neutrophils
        if (ringA > 0) for (const n of st.neuts) if (A.alive(n, t) && t > n.t0 + 0.3) { const [a, b] = n.pos(t - 0.05), [c, d] = n.pos(t); if (Math.hypot(c - a, d - b) > 0.5) A.spr('speed-trail', c, d, 9, Math.atan2(d - b, c - a), 0.7); }
      },
    });
    const flip = A.seg(t, 4.6, 5.0);
    if (flip > 0 && flip < 1) { const [u, v] = st.mac.pos(t); A.ringFx(u, v, flip, A.PAL.repair, 10, 40); }
    A.zoneName(0, 400, 'Tissue');
    A.zoneChip(0, 400, t < 4.6 ? 'offense' : 'support', A.seg(t, 4.6, 4.9));
    if (t > 6.4 && t < 8.6) { const [u, v] = st.outside.pos(t); A.tag(u, v, 'outside: 3 hits', A.PAL.antibody, A.seg(t, 6.4, 6.7) * (1 - A.seg(t, 8.3, 8.6))); }
    if (t > 9.6 && t < 12) { const [u, v] = st.mac.pos(t); A.tag(u - 40, v, 'inside: 1 hit', '#FFFFFF', A.seg(t, 9.6, 9.9) * (1 - A.seg(t, 11.7, 12)), -40); }
  },
  fingers(t, st, A) {
    const K = CYT_KIT;
    A.finger(t, [[3.9, K.off], [4.4, K.world(250, 120)], [4.5, K.world(250, 120), true], [4.75, K.world(250, 120), false, 'out']]);
  },
};

// ---- 5. Stress and fatigue (the slider was Body output before v3 V27) ----
CYT_CLIPS.output = {
  id: 'output', title: 'Stress and fatigue', dur: 12.5,
  cap: [[0, 'Stress speeds up how fast you make cells.'], [2.8, 'But it wears your body out. The heart fills and beats faster as fatigue builds.'], [5.4, 'Tired cells slow down. Feverish ones spray their shots and die sooner.'], [8.4, 'Turn stress down and your body recovers.']],
  hud: { bottom: true },
  bg: { dividers: [120, 240, 360], lymph: [380, 175] },
  outAt(t) { const A = CYT.api; return 0.12 + 0.88 * A.ease(A.seg(t, 2.0, 2.7)) - 0.75 * A.ease(A.seg(t, 7.8, 8.5)); },
  fAt(t) { const A = CYT.api; return 10 + 64 * A.ease(A.seg(t, 2.4, 7.9)) - 26 * A.ease(A.seg(t, 8.4, 12.5)); },
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(17);
    let t = 0.2; st.cells = [];
    while (t < this.dur) {
      const mul = 0.5 * Math.pow(4, this.outAt(t)), f = this.fAt(t);
      const u = 10 + r() * 380, life = f > 60 ? 5 : 8;
      st.cells.push(K.recruit(r() < 0.12 ? 'macrophage-offense' : 'neutrophil', t, u, 80 + r() * 190, { r: 4.8, wob: 7, travel: 0.9, t1: t + life * (0.7 + r() * 0.5) }));
      t += 0.42 / (mul * mul);
    }
    for (const c of st.cells) if (c.art === 'macrophage-offense') { c.r = 9.5; c.t1 = 1e9; }
  },
  frame(t, st, A) {
    A.scene(t);
    A.mapLabels({ t });
    const n = CYT_KIT.count(st.cells, t), [zx, zy, zw] = A.zoneRect(0, 400), c = A.ctx;
    c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.font = `600 26px ${A.FONT}`; c.fillStyle = A.PAL.cellHi; c.globalAlpha = 0.85;
    c.fillText(String(n), zx + zw - 62, zy + 54); c.font = `500 11px ${A.MONO}`; c.fillStyle = A.PAL.ui; c.globalAlpha = 0.7; c.fillText('cells', zx + zw - 22, zy + 52); c.globalAlpha = 1;
    const f = this.fAt(t), tier = f >= 85 ? 3 : f >= 60 ? 2 : f >= 35 ? 1 : 0;
    A.ctx.save(); A.ctx.translate(A.R.sx, A.R.sy); ART.drawFatigueEdge(A.ctx, A.R.sw, A.R.sh, tier, t); A.ctx.restore();
  },
  hudFrame(t, st, A) { A.hudOutput(A.R.bottom, Object.assign(st, { out: this.outAt(t), f: this.fAt(t) }), t); },
  fingers(t, st, A) {
    const K = CYT_KIT, knob = v => () => { const s = A.R.hud.slider; return s ? [A.lerp(s.x0, s.x1, v), s.y] : [0, 0]; };
    A.finger(t, [[1.3, K.off], [1.8, knob(0.12)], [2.0, knob(0.12), true], [2.7, knob(1), true], [3.0, knob(1), false, 'out']]);
    A.finger(t, [[7.2, K.off], [7.6, knob(1)], [7.8, knob(1), true], [8.5, knob(0.25), true], [8.8, knob(0.25), false, 'out']]);
  },
};

// ---- 5a. Organs and overload ----
// The game's overload rules (v3 sim.js): past 100 fatigue every organ loses 0.008·over·(1 + over/25)·weight
// bars a second, the heart hit hardest; above 100 the body recovers 4× faster; while Fine (under 35) the liver
// and lungs grow back a bar a minute; any organ at 0 bars is Host failure. organTable integrates that in game
// time: step(t, f, hp, d) gives the next fatigue after d game seconds; gs(t) is game seconds per clip second,
// so a clip can pause (0) or fast-forward.
const ORGAN_W = [1, 0.8, 0.6, 0.6, 0.4, 0.5], ORGAN_HEALS = [2, 3]; // heart, kidneys, lungs, liver, spleen, brain
const orgLv = h => Math.max(0, Math.min(4, Math.ceil(h - 1e-9)));
const heartCap = h => [1.25, 1.25, 1.5, 1.75, 2][orgLv(h)];
// fatigue per game second at effective stress mul (kidneys slow recovery; 4× faster in Overload)
const fatigueRate = (mul, f, kid) => mul > 1.15 ? (mul - 1.15) * 1.2 : (mul - 1.15) * 1.2 * [0.25, 0.25, 0.5, 0.75, 1][orgLv(kid)] * (f > 100 ? 4 : 1);
function organTable(dur, f0, hp0, step, gs = () => 1) {
  const dt = 0.02, rows = [];
  let f = f0, hp = hp0.slice(), g = 0;
  for (let t = 0; t <= dur + dt; t += dt) {
    rows.push({ f, hp: hp.slice(), g });
    const d = dt * gs(t); g += d;
    f = Math.max(0, Math.min(150, step(t, f, hp, d)));
    const over = f - 100;
    if (over > 0) hp = hp.map((h, i) => Math.max(0, h - 0.008 * over * (1 + over / 25) * ORGAN_W[i] * d));
    else if (f < 35) for (const i of ORGAN_HEALS) hp[i] = Math.min(4, hp[i] + d / 60);
  }
  const at = t => rows[Math.max(0, Math.min(rows.length - 1, Math.round(t / dt)))];
  // organs whose bar count changed in the last half second flash on the button
  const hit = t => { const a = at(t).hp, b = at(t - 0.5).hp; return a.map((h, i) => orgLv(h) !== orgLv(b[i])); };
  return { at, hit };
}
CYT_CLIPS.organs = {
  id: 'organs', title: 'Organs and overload', dur: 19,
  cap: [[0, 'The organ button shows your six organs. Each one has 4 bars to lose.'], [3.0, 'Tap it, or press O, to pause and see what each hurt organ is costing you.'], [7.4, 'Push fatigue past 100 and you\'re in Overload. Every organ loses health, the heart fastest.'], [11.6, 'Ease off. Above 100 your body recovers 4 times faster.'], [13.9, 'Once you\'re Fine, your liver and lungs grow back. The others stay hurt.'], [16.6, 'If any organ hits 0 bars, that\'s Host failure.']],
  hud: { bottom: true },
  bg: { wound: [48, 205], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  openAt: 3.5, closeAt: 7.0, up: [7.6, 8.1], down: [11.6, 12.0], ff: [13.9, 16.5],
  outAt(t) { const A = CYT.api; return 0.12 + 0.78 * A.ease(A.seg(t, ...this.up)) - 0.9 * A.ease(A.seg(t, ...this.down)); },
  sceneT(t) { const p = this.closeAt - this.openAt; return t < this.openAt ? t : t < this.closeAt ? this.openAt : t - p; },
  build(st) {
    const A = CYT.api, K = CYT_KIT;
    stormScene(st, 70, A, K);
    K.fight(st.neuts, st.germs, 0.6, { hp: 3, every: 0.9, seed: 71 });
    st.tab = organTable(this.dur, 70, [3, 4, 2, 3, 4, 4],
      (t, f, hp, d) => f + fatigueRate(Math.min(0.5 * Math.pow(4, this.outAt(t)), heartCap(hp[0])), f, hp[1]) * d,
      t => (t >= this.openAt && t < this.closeAt ? 0 : t >= this.up[1] && t < 9.6 ? 30 : t >= 9.6 && t < this.down[0] ? 8 : t >= this.down[0] && t < this.ff[0] ? 3 : t >= this.ff[0] && t < this.ff[1] ? 60 : 1));
  },
  frame(t, st, A) {
    const ts = this.sceneT(t);
    A.scene(ts);
    A.mapLabels({ t });
    const f = st.tab.at(t).f, tier = f >= 85 ? 3 : f >= 60 ? 2 : f >= 35 ? 1 : 0;
    A.ctx.save(); A.ctx.translate(A.R.sx, A.R.sy); ART.drawFatigueEdge(A.ctx, A.R.sw, A.R.sh, tier, ts); A.ctx.restore();
  },
  hudFrame(t, st, A) {
    const row = st.tab.at(t);
    A.hudOutput(A.R.bottom, Object.assign(st, { out: this.outAt(t), f: row.f, organs: row.hp, organHit: st.tab.hit(t) }), this.sceneT(t));
  },
  overlay(t, st, A) {
    const o = A.R.hud.organs;
    A.spotlight(o, A.seg(t, 0.3, 0.6) - A.seg(t, 2.9, 3.2), 'Organs', t);
    A.spotlight(o, A.seg(t, this.ff[0] + 0.2, this.ff[0] + 0.5) - A.seg(t, this.ff[1] + 1.6, this.ff[1] + 1.9), 'Liver and lungs heal', t);
    A.organPanel(st.tab.at(t).hp, A.seg(t, this.openAt, this.openAt + 0.2) - A.seg(t, this.closeAt, this.closeAt + 0.2));
    A.toast('Fast forward » 2 minutes', A.seg(t, this.ff[0], this.ff[0] + 0.2) - A.seg(t, this.ff[1] - 0.2, this.ff[1]));
  },
  fingers(t, st, A) {
    const K = CYT_KIT, ob = () => { const o = A.R.hud.organs; return o ? [o[0] + o[2] / 2, o[1] + o[3] / 2] : [0, 0]; };
    const res = () => A.R.hud.resume || [A.R.w / 2, A.R.h / 2], knob = v => () => { const s = A.R.hud.slider; return s ? [A.lerp(s.x0, s.x1, v), s.y] : [0, 0]; };
    A.finger(t, [[2.9, K.off], [3.3, ob], [this.openAt, ob, true], [this.openAt + 0.2, ob], [6.5, res], [this.closeAt, res, true], [this.closeAt + 0.2, res, false, 'out']]);
    A.finger(t, [[7.2, K.off], [this.up[0] - 0.1, knob(0.12)], [this.up[0], knob(0.12), true], [this.up[1], knob(0.9), true], [this.up[1] + 0.3, knob(0.9), false, 'out']]);
    A.finger(t, [[11.2, K.off], [this.down[0] - 0.1, knob(0.9)], [this.down[0], knob(0.9), true], [this.down[1], knob(0), true], [this.down[1] + 0.3, knob(0), false, 'out']]);
  },
};

// ---- 5b. Fatigue and toxins (organ health: Sandbox only for now) ----
// Shot kills leave toxin that seeps into the blood (the vessel tints green); the liver and kidneys at the
// Lymph-node end clear it in proportion to how much there is, fast when rested and slow when tired, and
// toxin left in the blood feeds fatigue. Spotlights point at each piece of UI as the caption names it.
CYT_CLIPS.toxload = {
  id: 'toxload', title: 'Fatigue and toxins', dur: 17,
  cap: [[0, 'Every germ you shoot dies messy and leaves toxin in your blood. Watch the vessel.'], [2.4, 'Your liver and kidneys clear it. While you\'re rested, it\'s gone almost as fast as it comes.'], [4.4, 'Making immune cells takes effort. Push stress up for more cells...'], [6.4, '...and fatigue builds. The heart fills and beats faster.'], [8.6, 'Tired organs clear toxin slowly, so it builds up in your blood.'], [10.8, 'Toxin left in your blood tires you even more. You win the battle and lose the war.'], [13.0, 'Ease off and your body recovers. The toxin clears again.'], [14.8, 'Germs your macrophages swallow leave no toxin at all.']],
  hud: { bottom: true },
  bg: { wound: [40, 200], woundSize: 0.55, dividers: [120, 240, 360], lymph: [380, 175] },
  organs: { liver: [342, 18], kidneys: [380, 18] },
  swallowAt: 14.6,
  spots: [[0.6, 2.4, 'vessel', 'Toxin in your blood'], [2.4, 4.4, 'organs', 'Liver and kidneys'], [4.6, 6.4, 'output', 'Stress'], [6.4, 8.6, 'heart', 'Fatigue'],
    [8.8, 10.8, 'vessel', 'Toxin builds up'], [10.8, 12.9, 'heart', 'Toxin tires you'], [13.0, 14.6, 'organs', 'Clearing again']],
  outAt(t) { const A = CYT.api; return 0.15 + 0.8 * A.ease(A.seg(t, 4.6, 5.3)) - 0.6 * A.ease(A.seg(t, 13.1, 13.7)); },
  fAt(t) { const A = CYT.api; return 12 + 63 * A.ease(A.seg(t, 5.0, 8.6)) + 13 * A.ease(A.seg(t, 8.8, 13.0)) - 58 * A.ease(A.seg(t, 13.3, 15.4)); },
  // clearance rate: toxin halves every h seconds, about half a second rested and about 4 s exhausted
  kAt(t) { const f = this.fAt(t) / 100; return Math.LN2 / (0.45 + 4.5 * f * f); },
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(71);
    // germs pour out of the Wound, heavier while you're tired
    st.germs = [];
    for (let t0 = -2; t0 < 12.2; t0 += t0 < 8.6 ? 0.55 : 0.24) {
      const u0 = 12 + r() * 40, v0 = 60 + r() * 220;
      st.germs.push(A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 4.6, rot: r() * 6.283, die: 'pop', t0: Math.max(-1e9, t0), t1: t0 + 30, pos: A.drift(u0, v0, t0, 9 + r() * 6, (r() - 0.5) * 4, 5, t0 * 3.1 + 1) }));
    }
    // cells: a few already out, then the stream of new cells follows stress
    st.neuts = [];
    for (let i = 0; i < 6; i++) st.neuts.push(K.recruit('neutrophil', -5, 30 + i * 60, 90 + r() * 180, { r: 4.8, wob: 7, seed: i * 3.3 }));
    for (let t = 0.3; t < this.dur;) {
      const mul = 0.5 * Math.pow(4, this.outAt(t)), life = this.fAt(t) > 60 ? 5 : 8;
      st.neuts.push(K.recruit('neutrophil', t, 15 + r() * 370, 70 + r() * 200, { r: 4.8, wob: 7, travel: 0.9, t1: t + life * (0.7 + r() * 0.5) }));
      t += 0.55 / (mul * mul);
    }
    st.mac = K.recruit('macrophage-offense', -5, 250, 165, { r: 9.5, wob: 2, kind: 'mac' });
    const prey = A.ent({ art: 'bacterium', r: 4.6, rot: 0.6, die: 'pop', t0: 12.6, pos: A.path([[12.6, 196, 140], [this.swallowAt, 244, 160]], 3, 5) });
    A.gulp(st.mac, prey, this.swallowAt);
    K.fight(st.neuts, st.germs, 0.4, { hp: 3, every: 0.6, seed: 72 });
    // each shot kill sends a wisp of toxin to the vessel
    st.wisps = st.germs.filter(g => g.t1 < this.dur + 1 && g.t1 < g.t0 + 29).map(g => { const [u, v] = g.pos(g.t1); return { t: g.t1, from: [u, v], to: [Math.min(318, u + 25), A.VES * 0.5] }; });
    const tab = [], dt = 0.05; let T = 0;
    for (let t = 0; t <= this.dur + 0.05; t += dt) {
      for (const w of st.wisps) if (w.t + 0.9 > t - dt && w.t + 0.9 <= t) T += 0.075;
      T = Math.min(1, T * Math.exp(-this.kAt(t) * dt));
      tab.push(T);
    }
    st.T = t => tab[Math.max(0, Math.min(tab.length - 1, Math.round(t / dt)))];
  },
  drawVessel(t, st, A) {
    const T = st.T(t), [x, y, w, h] = A.vesselRect(), c = A.ctx;
    c.fillStyle = `rgba(105,185,40,${0.62 * T})`; c.fillRect(x, y, w, h);
    for (let i = 0; i < 9; i++) A.glow((i * 47 + t * 26) % 400, A.VES * 0.5 + 6 * Math.sin(i * 2.1 + t), 15, 'rgba(80,140,25,0.9)', T);
    const act = Math.min(1, T * this.kAt(t) * 3);
    for (const [name, [u, v]] of Object.entries(this.organs)) {
      A.glow(u, v, 30, 'rgba(120,255,140,0.6)', 0.25 + 0.75 * act);
      for (let j = 0; j < 4; j++) { const q = (t * 1.3 + j / 4) % 1; A.glow(u - 46 * (1 - q), v + 4 * Math.sin(j * 2 + t * 3), 4, 'rgba(170,240,70,0.95)', T * 2 * (1 - q)); }
      A.spr(name + '-healthy', u, v, 15, null, 1);
    }
  },
  frame(t, st, A) {
    A.scene(t, { under: () => this.drawVessel(t, st, A) });
    A.mapLabels({ t });
    for (const w of st.wisps) {
      const p = (t - w.t) / 0.9; if (p < 0 || p > 1) continue;
      const [u, v] = A.lerp2(w.from, w.to, A.ease(p));
      A.glow(u, v + 5 * Math.sin(p * 9), 8, 'rgba(160,235,60,0.95)', 1 - 0.3 * p);
    }
    const f = this.fAt(t), tier = f >= 85 ? 3 : f >= 60 ? 2 : f >= 35 ? 1 : 0;
    A.ctx.save(); A.ctx.translate(A.R.sx, A.R.sy); ART.drawFatigueEdge(A.ctx, A.R.sw, A.R.sh, tier, t); A.ctx.restore();
    const tw = A.seg(t, this.swallowAt, this.swallowAt + 0.3) - A.seg(t, this.swallowAt + 1.8, this.swallowAt + 2.1);
    if (tw > 0) { const [u, v] = st.mac.pos(t); A.tag(u, v, 'swallowed: no toxin', A.PAL.kill, tw, -20); }
  },
  hudFrame(t, st, A) { A.hudOutput(A.R.bottom, Object.assign(st, { out: this.outAt(t), f: this.fAt(t) }), t); },
  spotRect(kind, A) {
    if (kind === 'vessel') return A.vesselRect();
    if (kind === 'organs') { const [x0, y0] = A.P(322, 0), [x1, y1] = A.P(400, A.VES * 1.1); return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)]; }
    if (kind === 'output') { const [x, y, w, h] = A.R.bottom; return [x + 52, y + 2, w - 56, h - 4]; }
    const [hx, hy] = A.R.hud.heart || [0, 0]; return [hx - 24, hy - 24, 48, 48];
  },
  overlay(t, st, A) {
    const S = this.spots, i = S.findIndex(s => t >= s[0] && t < s[1]); if (i < 0) return;
    const [t0, t1, kind, label] = S[i], prev = i > 0 && S[i - 1][1] === t0 ? S[i - 1] : null, next = S[i + 1] && S[i + 1][0] === t1;
    let rect = this.spotRect(kind, A);
    if (prev) { const q = A.ease(A.seg(t, t0, t0 + 0.35)), a = this.spotRect(prev[2], A); rect = rect.map((x, k) => A.lerp(a[k], x, q)); }
    const a = (prev ? 1 : A.seg(t, t0, t0 + 0.25)) - (next ? 0 : A.seg(t, t1 - 0.25, t1));
    A.spotlight(rect, a, label, t);
  },
  fingers(t, st, A) {
    const K = CYT_KIT, knob = v => () => { const s = A.R.hud.slider; return s ? [A.lerp(s.x0, s.x1, v), s.y] : [0, 0]; };
    A.finger(t, [[4.1, K.off], [4.5, knob(0.15)], [4.6, knob(0.15), true], [5.3, knob(0.95), true], [5.6, knob(0.95), false, 'out']]);
    A.finger(t, [[12.6, K.off], [13.0, knob(0.95)], [13.1, knob(0.95), true], [13.7, knob(0.35), true], [14.0, knob(0.35), false, 'out']]);
  },
};

// ---- 6. Waves and quorum bursts (v3 V26-V27: the scripted burst became a Staph quorum burst; Alex 2026-10-08 11:48) ----
// Staph-family germs that crowd up (20 within a tight circle by default since V28; 28 on Papercut, 36 on Flu season and Sore throat) grow a red bubble that pulls more Staph in. A yellow wick
// burns down clockwise from the top for 10 s, then it pops: every cell of yours within the blast dies and half the crowd
// at its core dies with it; 15 s cooldown per zone. Act 1: a Net pen thins the crowd in time and the bubble goes out.
// Act 2: a crowd left alone pops.
CYT_CLIPS.toxin = {
  id: 'toxin', title: 'Waves and quorum bursts', dur: 23.5,
  Q: 20, FUSE: 10, CORE: 26, BLAST: 130, // clip units: the game's 20 / 100 at this stage's scale
  C1: [112, 104], C2: [268, 196], glow2: 8.4,
  realtime: [[9.0, 17.8]], // the wick burns in real seconds
  cap: [[0, 'The bar on top is the level\'s script. Each badge is a wave. A ringed badge is a Staph wave big enough to crowd up.'], [2.5, 'When a Staph crowd gets big enough, a red bubble forms and pulls more in. Its wick burns down for 10 seconds.'], [4.0, 'Thin the crowd in time and the bubble goes out. A Net pen is the natural answer.'], [7.0, 'Leave a crowd alone and the wick burns down...'], [18.4, '...until it pops. Every cell of yours nearby dies, and half the crowd at its core dies too.'], [21.2, 'That zone can\'t pop again for 15 seconds. Thin Staph crowds early.']],
  hud: { top: true },
  bg: { wound: [120, 210], woundSize: 1.2, tile: 1.1 },
  build(st) {
    const A = CYT.api, K = CYT_KIT, r = A.rng(23), clip = this;
    st.pop = this.glow2 + this.FUSE;
    // a Staph clump arriving from the top edge and milling tightly round C; the bubble pulls it tighter from tg
    const pull = (C, p, tg, tEnd) => t => { const q = p(t); if (t < tg) return q; const s = 1 - 0.25 * A.ease(A.seg(Math.min(t, tEnd), tg, tg + clip.FUSE)); return [C[0] + (q[0] - C[0]) * s, C[1] + (q[1] - C[1]) * s]; };
    const clump = (n, C, t0, seed, tg, tEnd) => {
      const rr = A.rng(seed), out = [];
      for (let i = 0; i < n; i++) {
        const a = rr() * 6.283, d = Math.sqrt(rr()) * (clip.CORE - 6), tu = C[0] + Math.cos(a) * d, tv = C[1] + Math.sin(a) * d * 0.9;
        const ta = t0 + 0.06 * i, tl = ta + 1.4 + rr() * 0.4, v0 = C[1] + (rr() - 0.5) * 60;
        const mill = A.drift(tu, tv, 0, 0, 0, 3, seed + i * 1.7), arrive = A.path([[ta, -12, v0], [tl, tu, tv]], 2, seed + i);
        out.push(A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 4.4, rot: rr() * 6.283, t0: ta, die: 'pop', pos: pull(C, t => (t < tl ? arrive(t) : mill(t)), tg, tEnd) }));
      }
      return out;
    };
    st.netT = 4.5; st.penR = 34;
    st.a = clump(24, this.C1, 0.2, 41, 2.4, st.netT);
    st.b = clump(24, this.C2, 5.6, 77, this.glow2, st.pop);
    // strays the second bubble drags in
    for (let i = 0; i < 3; i++) {
      const a = 2.2 + i * 1.5, home = [this.C2[0] + Math.cos(a) * 62, this.C2[1] + Math.sin(a) * 56], to = [this.C2[0] + Math.cos(a) * 14, this.C2[1] + Math.sin(a) * 12];
      const ta = 5.0 + i * 0.3, tl = ta + 1.8, arrive = A.path([[ta, -12, home[1]], [tl, home[0], home[1]]], 2, 95 + i);
      const mill = A.drift(home[0], home[1], 0, 0, 0, 3, 90 + i), t1 = this.glow2 + 1 + i * 0.8, at = t => (t < tl ? arrive(t) : mill(t));
      st.b.push(A.ent({ art: 'bacterium', hitArt: 'bacterium-hit', r: 5, rot: r() * 6.283, die: 'pop', t0: ta, pos: t => (t < t1 ? at(t) : A.lerp2(at(t), to, A.ease(A.seg(Math.min(t, st.pop), t1, t1 + 3.5)))) }));
    }
    // Act 1: a Net neutrophil pens the first crowd and the neutrophils thin it below quorum
    st.net = A.ent({ art: 'neutrophil-net', r: 7, rot: 'vel', t0: 3.4, t1: st.netT, arrive: A.COLORS.net, die: null, layer: 2, pos: A.path([[3.4, this.C1[0] + 30, A.V - A.FVES + 4], [st.netT, this.C1[0], this.C1[1]]], 2, 4) });
    for (const g of st.a) g.hits.push(st.netT + 0.03);
    st.n1 = [K.recruit('neutrophil', -3, 60, 200, { r: 6, wob: 6, side: 'far' }), K.recruit('neutrophil', -3, 160, 210, { r: 6, wob: 6 }), K.recruit('neutrophil', -3, 40, 60, { r: 6, wob: 6, side: 'near' })];
    K.fight(st.n1, st.a.slice(0, 8), st.netT + 0.3, { hp: 2, every: 0.25, seed: 2 });
    K.fight(st.n1, st.a.slice(8), 7.2, { hp: 2, every: 0.5, seed: 9 }); // then they mop up the rest
    // Act 2: neutrophils and a macrophage near the second crowd chip at it, too slowly
    st.n2 = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + r() * 0.4, d = 44 + r() * 70; st.n2.push(K.recruit('neutrophil', -3 + i * 0.1, this.C2[0] + Math.cos(a) * d, Math.min(A.V - A.FVES - 10, Math.max(A.VES + 10, this.C2[1] + Math.sin(a) * d * 0.9)), { r: 6, wob: 8, seed: 30 + i })); }
    st.mac = K.recruit('macrophage-offense', -3, this.C2[0] + 70, this.C2[1] - 80, { r: 15, wob: 3 });
    K.fight(st.n2.slice(0, 3), st.b.slice(0, 1), 9.0, { hp: 3, every: 1.1, seed: 5 });
    // the pop: the shockwave front kills each of your cells within the blast as it passes; half the core dies
    const [cu, cv] = this.C2;
    for (const c of st.n2.concat([st.mac], st.n1)) {
      const [u, v] = c.pos(st.pop), d = Math.hypot(u - cu, v - cv);
      if (d < this.BLAST && c.t1 > st.pop) { c.t1 = st.pop + d / 600; c.deathAt = null; if (c.r > 10) c.big = true; }
    }
    let k = 0;
    for (const g of st.b) {
      if (g.t1 <= st.pop) continue;
      const [u, v] = g.pos(st.pop);
      if (Math.hypot(u - cu, v - cv) < this.CORE && k++ % 2 === 0) { g.t1 = st.pop + 0.05; continue; }
      // survivors scatter from the core
      const p = g.pos, a = Math.atan2(v - cv, u - cu), T = st.pop;
      g.pos = t => { const q = p(t); if (t < T) return q; const s = 34 * A.ease(A.seg(t, T, T + 0.9)); return [q[0] + Math.cos(a) * s, q[1] + Math.sin(a) * s]; };
    }
    // fresh cells come back in after the pop
    st.fresh = [];
    for (let i = 0; i < 6; i++) st.fresh.push(K.recruit('neutrophil', st.pop + 2.2 + i * 0.25, 190 + r() * 180, 90 + r() * 170, { r: 6, wob: 8 }));
    // act 1's wick: burns while Q+ of the crowd are alive inside the core, resets when it's thinned (sampled every 0.05 s)
    const tab = []; let f = 0;
    for (let t = 0; t <= this.dur + 0.05; t += 0.05) {
      const n = st.a.reduce((m, g) => { if (!A.alive(g, t)) return m; const [u, v] = g.pos(t); return m + (Math.hypot(u - this.C1[0], v - this.C1[1]) < this.CORE + 4 ? 1 : 0); }, 0);
      f = n >= this.Q ? Math.min(1, f + 0.05 / this.FUSE) : 0; tab.push(f);
    }
    st.fuse1 = t => tab[Math.max(0, Math.min(tab.length - 1, Math.round(t / 0.05)))];
  },
  fuse2(t) { const A = CYT.api; return t >= this.glow2 && t < this.glow2 + this.FUSE ? Math.max(0.001, A.seg(t, this.glow2, this.glow2 + this.FUSE)) : 0; },
  // V27 look: a red bubble round the crowd, a yellow wick on its rim burning down clockwise from the top, a spark at the burning end
  bubble(A, C, f, fade, t) {
    const a = f > 0 ? 1 : fade;
    if (a <= 0) return;
    const c = A.ctx, k = A.R.k, [x, y] = A.P(C[0], C[1]), R = (this.CORE + 8) * k;
    c.save();
    const g = c.createRadialGradient(x, y, R * 0.2, x, y, R);
    g.addColorStop(0, 'rgba(255,59,78,0.05)'); g.addColorStop(0.8, 'rgba(255,59,78,0.22)'); g.addColorStop(1, 'rgba(255,59,78,0.4)');
    c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(255,59,78,0.85)'; c.lineWidth = Math.max(1.2, 1.4 * k); c.stroke();
    if (f > 0) {
      const top = -Math.PI / 2, end = top + f * 6.283, wr = R + 3 * k;
      c.strokeStyle = '#FFD23F'; c.lineWidth = Math.max(2, 2.6 * k); c.lineCap = 'round';
      c.beginPath(); c.arc(x, y, wr, end, top + 6.283); c.stroke(); // what's left of the wick
      const sx = x + Math.cos(end) * wr, sy = y + Math.sin(end) * wr, on = Math.floor(t * 12) % 2 === 0;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, (on ? 9 : 6) * k);
      sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.35, 'rgba(255,210,63,0.9)'); sg.addColorStop(1, 'rgba(255,122,61,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, (on ? 9 : 6) * k, 0, 6.283); c.fill();
    }
    c.restore();
  },
  shake(t) { const d = t - this.glow2 - this.FUSE; return d > 0 && d < 0.5 ? 1 - d / 0.5 : 0; },
  fade1(st, t) { if (st.fuse1(t) > 0) return 0; for (let d = 0.05; d <= 0.4; d += 0.05) if (st.fuse1(t - d) > 0) return 1 - d / 0.4; return 0; },
  frame(t, st, A) {
    const tagWin = (a, b) => A.seg(t, a, a + 0.3) * (1 - A.seg(t, b - 0.3, b));
    const f1 = st.fuse1(t), f2 = this.fuse2(t), np = t - st.pop;
    A.scene(t, { under: () => {
      this.bubble(A, this.C1, f1, this.fade1(st, t), t);
      this.bubble(A, this.C2, f2, 0, t);
      A.pen(this.C1[0], this.C1[1], st.penR, t - st.netT, t, 2.5, 3);
      const p = np / 0.5; if (p > 0 && p < 1.4) A.spr('toxin-shockwave', this.C2[0], this.C2[1], this.BLAST * 2 * Math.max(0.05, p), null, Math.max(0, 1 - p * 0.7));
    } });
    A.ringFx(this.C1[0], this.C1[1], (t - st.netT) / 0.35, '#FFD23F', 6, st.penR);
    A.flash('rgba(180,92,255,1)', 0.18 * Math.max(0, 1 - np / 0.25) * (np > 0 ? 1 : 0));
    A.zoneName(0, 400, 'Wound');
    if (t > 5.6 && t < 7.0) A.tag(this.C1[0], this.C1[1] - this.CORE - 10, 'too few: bubble out', A.PAL.ui, tagWin(5.6, 7.0), -6);
    if (np > 1.0 && np < 5.0) A.tag(this.C2[0], this.C2[1], 'Wound: no pop for 15 s', A.PAL.ui, tagWin(st.pop + 1.0, st.pop + 5.0), -16);
  },
  // the game's banner while a wick burns
  overlay(t, st, A) {
    const f1 = st.fuse1(t), f2 = this.fuse2(t), f = f2 || f1, fd = f ? 1 : this.fade1(st, t);
    if (fd <= 0) return;
    let g1 = f1; for (let d = 0.05; !g1 && d <= 0.4; d += 0.05) g1 = st.fuse1(t - d); // while fading, hold the last count
    const left = f2 ? Math.ceil(st.pop - t) : Math.ceil(this.FUSE * (1 - Math.max(g1, 0.0001)));
    A.toast(`Staph crowd in the Wound: pops in ${Math.max(1, left)} s. Thin it.`, fd * A.seg(t, f2 ? this.glow2 : 2.3, (f2 ? this.glow2 : 2.3) + 0.25));
  },
  hudFrame(t, st, A) {
    const frac = 0.36 + t * 0.009, big = 0.47;
    A.hudProgress(A.R.top, frac, [{ at: 0.02, kind: 'wave' }, { at: 0.19, kind: 'wave' }, { at: big, kind: 'wave' }, { at: 0.66, kind: 'wave' }, { at: 0.86, kind: 'wave-final' }]);
    // the rail rings a Staph wave big enough to reach quorum on arrival (steady, never blinking)
    const p = A.R.hud.prog, x = A.lerp(p.x0, p.x1, big), c = A.ctx;
    c.globalAlpha = frac < big ? 0.95 : 0.3; c.strokeStyle = A.PAL.toxin; c.lineWidth = 1.8; c.beginPath(); c.arc(x, p.y, 12, 0, 6.283); c.stroke(); c.globalAlpha = 1;
  },
};

// ---- 7. The Cytokine storm ----
function stormScene(st, seed, A, K) {
  const r = A.rng(seed);
  st.germs = [].concat(
    K.crowd(13, [15, 90, 112, 278], seed + 1, { r: 4.4, vu: 3, wob: 5 }),
    K.crowd(14, [128, 80, 232, 278], seed + 2, { r: 4.4, vu: 3, wob: 5 }),
    K.crowd(11, [248, 80, 350, 278], seed + 3, { r: 4.4, vu: 2, wob: 5 }),
    K.crowd(5, [366, 90, 390, 270], seed + 4, { r: 4.4, vu: 0, wob: 3 }));
  st.neuts = [];
  for (let i = 0; i < 16; i++) st.neuts.push(K.recruit('neutrophil', -3, 15 + r() * 340, 70 + r() * 205, { r: 4.6, wob: 8, seed: i * 2.3 }));
  st.macs = [K.recruit('macrophage-offense', -3, 70, 140, { r: 9.5, wob: 2 }), K.recruit('macrophage-offense', -3, 185, 220, { r: 9.5, wob: 2 }), K.recruit('macrophage-offense', -3, 300, 130, { r: 9.5, wob: 2 })];
}
function stormHit(st, hitT, A, K, seed, noFight) {
  const r = A.rng(seed);
  // about 70% of germs (all of the ones in the Lymph node here) and 40% of neutrophils die on the hit
  st.germs.forEach((g, i) => { if (g.pos(hitT)[0] > 360 || r() < 0.62) { g.t1 = hitT + r() * 0.15; g.die = 'storm'; } });
  st.neuts.forEach(n => { if (r() < 0.4) { n.t1 = hitT + r() * 0.15; n.die = 'storm'; } });
  if (noFight) return;
  const left = st.germs.filter(g => g.t1 > hitT + 1);
  K.fight(st.neuts.filter(n => n.t1 > hitT + 1), left, hitT + 1.2, { hp: 3, every: 0.7, seed: 9 });
}
// The storm charges while the button is held (CHARGE seconds) and fires on release.
// Charge for a hold from t0 to t1 (the finger lifts at t1); a hold let go early drains back to 0.
const CHARGE = 5;
function holdCharge(t, t0, t1, drain = 0) {
  if (t < t0) return 0;
  const c1 = Math.min(1, (t1 - t0) / CHARGE);
  if (t <= t1) return Math.min(1, (t - t0) / CHARGE);
  return drain && t < t1 + drain ? c1 * (1 - (t - t1) / drain) : 0;
}
// Tension while charging: a red pulse closes in from the edges, faster as the charge fills
function chargeVignette(c, w, h, t, q) {
  if (q <= 0) return;
  const a = q * (0.22 + 0.14 * Math.sin(t * (5 + 9 * q))), r0 = Math.min(w, h) * (0.62 - 0.22 * q), r1 = Math.hypot(w, h) / 2;
  const g = c.createRadialGradient(w / 2, h / 2, r0, w / 2, h / 2, r1);
  g.addColorStop(0, 'rgba(255,59,78,0)'); g.addColorStop(1, `rgba(255,59,78,${Math.max(0, a)})`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function stormDraw(t, st, A, o) {
  const stun = t > o.hit && t < o.hit + 3;
  for (const m of st.macs) m.alpha = stun ? (tt => (tt > o.hit && tt < o.hit + 3 ? 0.5 + 0.3 * Math.sin(tt * 20) : 1)) : null;
  A.scene(t);
  A.mapLabels({ frac: st.timer(t)[0], busy: st.timer(t)[1], t });
  const c = A.ctx, w = A.R.sw, h = A.R.sh;
  c.save(); c.translate(A.R.sx, A.R.sy);
  const f = o.f(t), tier = f >= 85 ? 3 : f >= 60 ? 2 : f >= 35 ? 1 : 0;
  ART.drawFatigueEdge(c, w, h, tier, t);
  chargeVignette(c, w, h, t, o.charge(t));
  const [sx, sy] = A.P(A.U / 2, 0);
  if (t > o.hit - 1 && t < o.hit) ART.drawStorm(c, w, h, { phase: 'windup', p: t - (o.hit - 1), t, ox: sx - A.R.sx, oy: sy - A.R.sy });
  else if (t >= o.hit && t < o.hit + 0.45) ART.drawStorm(c, w, h, { phase: 'hit', p: (t - o.hit) / 0.45, t });
  else if (t >= o.hit && t < o.hit + 8 && !o.collapse) ART.drawStorm(c, w, h, { phase: 'afterburn', p: (t - o.hit) / 8, t });
  if (o.collapse && t > o.hit) ART.drawCollapse(c, w, h, Math.min(1, (t - o.hit) / 2));
  c.restore();
}
const chargeShake = q => q > 0.6 ? 0.45 * (q - 0.6) / 0.4 : 0;
CYT_CLIPS.storm = {
  id: 'storm', title: 'The Cytokine storm', dur: 15,
  cap: [[0, 'Overrun? The Cytokine storm is your nuclear option.'], [1.0, 'Press and hold the button. It takes 5 full seconds to charge, so you only fire it on purpose.'], [4.6, 'While it charges, the heart shows where your fatigue would land. Fully charged, it fires when you let go.'], [8.4, 'It kills about 70% of germs and 40% of your own neutrophils.'], [10.8, 'Fatigue jumps, then keeps climbing for 8 seconds. That\'s the afterburn.'], [12.8, 'Keep it under 100. Past that, your organs start taking damage.']],
  hud: { bottom: true },
  bg: { wound: [48, 205], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  press: 2.0, release: 7.4, hit: 8.4, realtime: [[2.0, 7.4]], // the hold runs in real seconds
  charge(t) { return holdCharge(t, this.press, this.release); },
  fAt(t) { const A = CYT.api; return t < this.hit ? 24 : 24 + 50 * A.ease(A.seg(t, this.hit, this.hit + 0.4)) + 2 * Math.min(8, Math.max(0, t - this.hit - 0.4)); },
  build(st) {
    const A = CYT.api, K = CYT_KIT;
    stormScene(st, 40, A, K);
    stormHit(st, this.hit, A, K, 41);
    st.timer = K.timerTable(st.germs, A.NODE_U, 0.05, this.dur, 0.25, 0.03);
  },
  shake(t) { return t > this.hit && t < this.hit + 0.5 ? 1.4 * (1 - (t - this.hit) / 0.5) : chargeShake(this.charge(t)); },
  frame(t, st, A) { stormDraw(t, st, A, { hit: this.hit, f: tt => this.fAt(tt), charge: tt => this.charge(tt) }); },
  hudFrame(t, st, A) {
    const [x, y, w, h] = A.R.bottom, q = this.charge(t), held = t > this.press && t < this.release, burning = t >= this.release && t < this.hit + 8;
    A.hudOutput([x, y, w - 64, h], Object.assign(st, { out: 0.45, f: this.fAt(t) }), t, { ghost: held ? 24 + 50 + 16 : null, burning: burning || q >= 1 });
    const label = held ? (q >= 1 ? 'Release' : `Hold ${Math.ceil(CHARGE * (1 - q) - 1e-6)}`) : t >= this.release && t < this.hit ? 'Storm…' : burning ? `${Math.ceil(this.hit + 8 - t)} s` : 'Storm';
    A.hudStorm([x + w - 58, y, 58, h], held ? 'held' : burning ? 'burning' : 'idle', label, held ? q : 0, t);
  },
  fingers(t, st, A) {
    const K = CYT_KIT, b = () => A.R.hud.storm || [0, 0];
    A.finger(t, [[1.6, K.off], [1.9, b], [this.press, b, true], [this.release, b, true], [this.release + 0.2, b, false, 'out']]);
  },
};
// The storm costs 50 fatigue plus 8 s of afterburn. Already tired, that lands past 100 (Overload) and the
// organs lose bars; the button's forecast says so while it charges (orange: Risky; red: Lethal, an organ would
// fail). Organ damage uses the game's overload rule (organTable); the afterburn and the recovery run a little
// faster than real time.
CYT_CLIPS.stormRisk = {
  id: 'stormRisk', title: 'Risky storms', dur: 19.5,
  cap: [[0, 'Already tired? While you charge, the heart shows where your fatigue would land.'], [2.6, 'Orange means this storm takes you past 100, so your organs will lose bars. Fully charged, it says Risky: you can still fire it.'], [7.9, 'Past 100 the heart floods red and every organ loses health. The heart goes fastest.'], [10.8, 'The further past 100, the faster they drop.'], [13.2, 'Above 100 your body recovers 4 times faster. Back under 100, the damage stops.'], [16.2, 'Now another storm would empty an organ, so it charges red. That\'s Host failure. Let go to cancel.']],
  hud: { bottom: true },
  bg: { wound: [48, 205], woundSize: 0.6, dividers: [120, 240, 360], lymph: [380, 175] },
  holds: [[0.8, 6.8, 0], [16.4, 18.4, 0.35]], hit: 7.8, burnEnd: 13.2, realtime: [[0.8, 6.8], [16.4, 18.75]],
  charge(t) { return Math.max(...this.holds.map(([a, b, d]) => holdCharge(t, a, b, d))); },
  build(st) {
    const A = CYT.api, K = CYT_KIT, hit = this.hit;
    stormScene(st, 60, A, K);
    stormHit(st, hit, A, K, 61);
    st.timer = K.timerTable(st.germs, A.NODE_U, 0.04, this.dur, 0.2, 0.03);
    st.tab = organTable(this.dur, 52, [4, 4, 4, 4, 4, 4],
      (t, f, hp, d) => (t < hit ? f : t < hit + 0.4 ? f + 125 * d : t < this.burnEnd ? f + 2 * d : f + fatigueRate(0.5, f, hp[1]) * d),
      t => (t < hit + 1 ? 1 : t < this.burnEnd ? 1.6 : t < 16 ? 3 : 1));
  },
  fAt(t, st) { return st.tab.at(t).f; },
  shake(t) { return t > this.hit && t < this.hit + 0.5 ? 1.4 * (1 - (t - this.hit) / 0.5) : chargeShake(this.charge(t)); },
  frame(t, st, A) { stormDraw(t, st, A, { hit: this.hit, f: tt => Math.min(100, st.tab.at(tt).f), charge: tt => this.charge(tt) }); },
  hudFrame(t, st, A) {
    const [x, y, w, h] = A.R.bottom, [h1, h2] = this.holds, q = this.charge(t), row = st.tab.at(t);
    const in1 = t > h1[0] && t < h1[1], in2 = t > h2[0] && t < h2[1], draining = t >= h2[1] && t < h2[1] + h2[2];
    const winding = t >= h1[1] && t < this.hit, burning = t >= this.hit && t < this.burnEnd;
    A.hudOutput([x, y, w - 64, h], Object.assign(st, { out: 0, f: row.f, organs: row.hp, organHit: st.tab.hit(t) }), t,
      { ghost: in1 || in2 ? row.f + 66 : null, lethal: in2, burning: winding || burning || q >= 1 });
    const left = Math.ceil(8 - (row.g - st.tab.at(this.hit).g) - 1e-6);
    const label = in1 || in2 ? (q >= 1 ? (in2 ? 'Lethal' : 'Risky') : `Hold ${Math.ceil(CHARGE * (1 - q) - 1e-6)}`) : draining ? 'Cancel' : winding ? 'Storm…' : burning ? `${Math.max(1, left)} s` : 'Storm';
    A.hudStorm([x + w - 58, y, 58, h], in1 ? 'risky' : in2 || draining ? 'lethal' : winding || burning ? 'burning' : 'idle', label, in1 || in2 || draining ? q : 0, t);
  },
  overlay(t, st, A) { A.spotlight(A.R.hud.organs, A.seg(t, 8.4, 8.7) - A.seg(t, 10.5, 10.8), 'Organs losing bars', t); },
  fingers(t, st, A) {
    const K = CYT_KIT, b = () => A.R.hud.storm || [0, 0], [h1, h2] = this.holds;
    A.finger(t, [[0.3, K.off], [0.7, b], [h1[0], b, true], [h1[1], b, true], [h1[1] + 0.2, b, false, 'out']]);
    A.finger(t, [[15.9, K.off], [16.3, b], [h2[0], b, true], [h2[1], b, true], [h2[1] + 0.2, b, false, 'out']]);
  },
};

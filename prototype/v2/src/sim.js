'use strict';
// ---------------------------------------------------------------------------
// Immune RTS prototype v2: simulation. No DOM, so it also runs headless under
// node (see src/headless.js). Spec: "Immune RTS: Simpler Prototype v2" doc.
//
// World coordinates: u runs along the lymph flow (0 = wound end, L = lymph
// node end), v runs across it (0 = blood vessel edge). The UI maps (u, v) to
// screen either as-is (landscape) or transposed (portrait).
// ---------------------------------------------------------------------------

// Every tunable number. The dev panel edits these live; the sim reads them each tick.
const DEFAULTS = {
  level:      { duration: 300, cellCap: 60, maxBacteria: 180, startNeut: 12, startMac: 4 },
  stream:     { start: 0.5, end: 1.4, clump: 3, armoredFrom: 90, armoredShare: 0.15 },
  marrow:     { neutEvery: 1, macEvery: 3 },
  output:     { start: 0.5, min: 0.5, max: 2, rest: 1.15, tire: 1.2, recover: 1.2 },
  fatigue:    { tired: 35, feverish: 60, exhausted: 85, tiredSpeed: 0.85, feverSpread: 0.3, feverLife: 0.7, exhaustedMarrow: 0.5, exhaustedRing: 0.6 },
  neutrophil: { speed: 46, range: 64, fireEvery: 0.8, life: 30, turnEvery: 0.3, zigzag: 1.5, stray: 0.25, standoff: 36, shotSpeed: 420, spread: 0.35 },
  macrophage: { speed: 20, eatEvery: 2, gulp: 0.45, reach: 11 },
  support:    { ring: 50, speedMul: 1.5 },
  bacteria:   { hp: 3, doubling: 10, armorDoubling: 20, jitter: 0.25, drift: 10, crowdDrift: 0.12, crowdStart: 25, crowdRadius: 10, crowdMax: 5, knock: 4, hitRadius: 4.5, armorRadius: 6 },
  toxin:      { warn: 2, notice: 6, sweep: 0.6 },
  lymph:      { fill: 20 },
};

// One line per tunable, shown in the dev panel.
const HINTS = {
  'level.duration': 'Seconds of scripted ingress (the progress bar). Win once it is full and the map is clear.',
  'stream.start': 'Bacteria per second streaming in through the Wound at 0:00, between the big waves.',
  'stream.end': 'Stream rate per second by the end of the level (it ramps up linearly).',
  'stream.clump': 'Stream bacteria arrive in clumps of up to this many.',
  'stream.armoredFrom': 'Seconds into the level before armored bacteria join the stream.',
  'stream.armoredShare': 'Share of the stream that is armored after that.',
  'output.start': 'Body output slider position at 0:00 (0 = lowest, 1 = highest).',
  'output.min': 'Marrow speed multiplier with the slider all the way down.',
  'output.max': 'Marrow speed multiplier with the slider all the way up.',
  'output.rest': 'Output multiplier the body can sustain: above it fatigue builds, below it fatigue recovers.',
  'output.tire': 'Fatigue points per second for each 1x of output above rest.',
  'output.recover': 'Fatigue points per second recovered for each 1x of output below rest.',
  'fatigue.tired': 'Fatigue (0-100) where Tired starts: your cells move slower.',
  'fatigue.feverish': 'Fatigue where Feverish starts: neutrophil shots spray and neutrophils die sooner.',
  'fatigue.exhausted': 'Fatigue where Exhausted starts: the marrow slows and Support rings shrink.',
  'fatigue.tiredSpeed': 'Speed multiplier for all your cells while Tired or worse.',
  'fatigue.feverSpread': 'Extra aim wobble (radians) while Feverish or worse.',
  'fatigue.feverLife': 'Neutrophil lifespan multiplier while Feverish or worse.',
  'fatigue.exhaustedMarrow': 'Marrow speed multiplier while Exhausted.',
  'fatigue.exhaustedRing': 'Support ring size multiplier while Exhausted.',
  'level.cellCap': 'Most of your cells allowed on the field at once.',
  'level.maxBacteria': 'Bacteria stop dividing at this many on the map.',
  'level.startNeut': 'Neutrophils on the field at 0:00.',
  'level.startMac': 'Macrophages on the field at 0:00.',
  'marrow.neutEvery': 'Seconds to make one neutrophil.',
  'marrow.macEvery': 'Seconds to make one macrophage.',
  'neutrophil.speed': 'Units per second (zones are 300 long).',
  'neutrophil.range': 'Firing range. A neutrophil is about 16 units across.',
  'neutrophil.fireEvery': 'Seconds between shots.',
  'neutrophil.life': 'Seconds a neutrophil lives.',
  'neutrophil.turnEvery': 'Seconds between zigzag turns.',
  'neutrophil.zigzag': 'How far each turn can veer off the target line (radians).',
  'neutrophil.stray': 'Chance each turn heads somewhere completely random instead.',
  'neutrophil.standoff': 'Neutrophils stop closing in at about this distance.',
  'neutrophil.shotSpeed': 'Antibody bullet speed.',
  'neutrophil.spread': 'Aim wobble in radians; more means more misses.',
  'macrophage.speed': 'Units per second.',
  'macrophage.eatEvery': 'Seconds between swallows on Offense.',
  'macrophage.gulp': 'Seconds a swallow takes.',
  'macrophage.reach': 'How close it must get to swallow.',
  'support.ring': 'Radius of a Support macrophage ring.',
  'support.speedMul': 'Speed multiplier for neutrophils inside a ring.',
  'bacteria.hp': 'Plain hits to kill a bacterium (tuned shots always kill).',
  'bacteria.doubling': 'Seconds for a bacterium to divide while it has room.',
  'bacteria.armorDoubling': 'Seconds for an armored bacterium to divide.',
  'bacteria.jitter': 'Random spread on division times (fraction).',
  'bacteria.drift': 'Lymph flow speed toward the Lymph node.',
  'bacteria.crowdDrift': 'Extra drift per bacterium in a zone beyond crowd start (spill-over).',
  'bacteria.crowdStart': 'Zone count where crowding starts pushing bacteria onward.',
  'bacteria.crowdRadius': 'Neighbour radius for the room check.',
  'bacteria.crowdMax': 'A bacterium will not divide with this many neighbours.',
  'bacteria.knock': 'How far a plain hit nudges a bacterium back.',
  'bacteria.hitRadius': 'How close a shot must pass to hit a plain bacterium.',
  'bacteria.armorRadius': 'How close a shot must pass to hit an armored bacterium.',
  'toxin.warn': 'Seconds the Wound flashes red before a burst.',
  'toxin.notice': 'Seconds before a burst that the banner starts counting down.',
  'toxin.sweep': 'Seconds for the toxin wave to cross the Wound.',
  'lymph.fill': 'Seconds of bacteria in the Lymph node before you lose. Holds while it is clear.',
};

// Scripted levels. Waves: b = bacteria, a = armored bacteria. Toxins are fractions of the level.
const LEVELS = {
  papercut: {
    name: 'Papercut',
    // Doc schedule with counts scaled up after balance runs, plus two small filler waves (0:50, 3:40)
    waves: [{ t: 0, b: 40 }, { t: 50, b: 30 }, { t: 90, a: 26, b: 24 }, { t: 150, b: 80 }, { t: 220, b: 40 }, { t: 255, b: 80, a: 28, final: true }],
    toxins: [1 / 3, 2 / 3],
  },
};

const clone = o => JSON.parse(JSON.stringify(o));
let CONFIG = clone(DEFAULTS);
function mergeConfig(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const g in saved) {
    if (!CONFIG[g]) continue;
    for (const k in saved[g]) if (k in DEFAULTS[g] && typeof saved[g][k] === 'number') CONFIG[g][k] = saved[g][k];
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Map: three zones of 300 along the flow; the blood vessel is a strip along v < VESSEL.
const L = 900, WIDTH = 460, ZONE = 300, VESSEL = 44;
const ZONES = ['Wound', 'Tissue', 'Lymph node'];
const zoneOf = u => (u < ZONE ? 0 : u < 2 * ZONE ? 1 : 2);
const WOUND = { u: 70, v: 270 }; // where waves spill in and toxins burst from
// Support/Offense posts inside a zone, in fill order (fractions of zone length / field width)
const POSTS = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.72], [0.3, 0.75], [0.7, 0.28], [0.5, 0.15], [0.5, 0.88]];

class Game {
  constructor(levelKey, seed) {
    this.key = levelKey || 'papercut';
    this.lv = LEVELS[this.key];
    this.seed = seed || 1;
    this.rand = mulberry32(this.seed * 9973 + 17);
    this.t = 0;
    this.bact = []; this.neut = []; this.mac = []; this.shots = [];
    this.fx = []; // visual events for the UI: {k, u, v, ...}
    this.zones = ZONES.map(name => ({ name, mode: 'offense', count: 0 }));
    this.marrow = { make: 'neut', prog: 0 };
    this.lymph = { timer: 0, peak: 0, reached: false, beat: 0 };
    this.waveIdx = 0; this.streamAcc = 0;
    this.output = CONFIG.output.start; this.fatigue = 0; this.tier = 0; this.fatiguePeak = 0; this.tierTime = [0, 0, 0, 0];
    this.toxins = this.lv.toxins.map(f => ({ at: f * CONFIG.level.duration, state: 'coming', front: 0 }));
    this.stats = { shotKills: 0, swallows: 0, made: 0, toxinDeaths: 0, peak: 0, bounced: 0 };
    this.history = []; this.histT = 0;
    this.result = null;
    this.id = 1;
    for (let i = 0; i < CONFIG.level.startNeut; i++) this.spawnNeut(60 + this.rand() * 300, VESSEL + 30 + this.rand() * 120);
    for (let i = 0; i < CONFIG.level.startMac; i++) this.spawnMac(true);
    this.runWaves();
  }

  // ---- player actions ----
  setMarrow(kind) { if (kind === 'neut' || kind === 'mac') { if (kind !== this.marrow.make) this.marrow.prog = 0; this.marrow.make = kind; } }
  toggleZone(z) { const zn = this.zones[z]; if (zn) zn.mode = zn.mode === 'offense' ? 'support' : 'offense'; }
  setZone(z, mode) { if (this.zones[z]) this.zones[z].mode = mode; }
  setOutput(x) { this.output = Math.max(0, Math.min(1, +x || 0)); }
  // Marrow speed multiplier from the slider (geometric between min and max, 1x in the middle by default)
  outputMul() { const O = CONFIG.output; return O.min * Math.pow(O.max / O.min, this.output); }
  // 0 fine, 1 Tired, 2 Feverish, 3 Exhausted
  fatigueTier() { const F = CONFIG.fatigue, f = this.fatigue; return f >= F.exhausted ? 3 : f >= F.feverish ? 2 : f >= F.tired ? 1 : 0; }
  // The toxin about to hit (inside its notice window) or mid-sweep, if any
  pendingToxin() {
    for (const tx of this.toxins) {
      if (tx.state === 'sweeping') return tx;
      if (tx.state === 'coming' && this.t >= tx.at - CONFIG.toxin.notice) return tx;
    }
    return null;
  }

  // ---- spawning ----
  spawnNeut(u, v) {
    this.neut.push({ id: this.id++, u, v, vu: 0, vv: 0, head: Math.PI / 2, turn: 0, cd: this.rand() * 0.5, age: 0, boosted: false, dead: false });
  }
  spawnMac(start) {
    // New macrophages take the zone with the fewest; ties go to the earlier zone
    const n = [0, 0, 0]; for (const m of this.mac) n[m.home]++;
    let home = 0; for (let z = 1; z < 3; z++) if (n[z] < n[home]) home = z;
    const slot = n[home] % POSTS.length;
    const pu = home * ZONE + POSTS[slot][0] * ZONE, pv = VESSEL + POSTS[slot][1] * (WIDTH - VESSEL);
    const u = start ? pu : Math.min(L - 20, Math.max(20, pu + (this.rand() - 0.5) * 80)), v = start ? pv : VESSEL * 0.5;
    this.mac.push({ id: this.id++, u, v, home, pu, pv, mode: 'offense', cd: 0, gulp: 0, prey: null, dead: false, flip: 0 });
  }
  spawnBact(armored, u, v) {
    if (this.bact.length >= CONFIG.level.maxBacteria + 140) return;
    const r = this.rand;
    this.bact.push({
      id: this.id++, armored: !!armored,
      u: u == null ? WOUND.u + (r() - 0.5) * 90 : u, v: v == null ? WOUND.v + (r() - 0.5) * 180 : v,
      hp: armored ? 1 : CONFIG.bacteria.hp, age: 0, div: this.divTime(armored), flash: 0, rot: r() * 6.283, dead: false, eaten: false,
    });
  }
  divTime(armored) { return (armored ? CONFIG.bacteria.armorDoubling : CONFIG.bacteria.doubling) * (1 + (this.rand() - 0.5) * 2 * CONFIG.bacteria.jitter); }

  runWaves() {
    const w = this.lv.waves;
    while (this.waveIdx < w.length && this.t >= w[this.waveIdx].t) {
      const wave = w[this.waveIdx++];
      for (let i = 0; i < (wave.b || 0); i++) this.spawnBact(false);
      for (let i = 0; i < (wave.a || 0); i++) this.spawnBact(true);
      this.fx.push({ k: 'wave', u: WOUND.u, v: WOUND.v, n: (wave.b || 0) + (wave.a || 0), armored: wave.a || 0, final: !!wave.final });
    }
  }
  // Progress-bar markers still to come: {t, kind: 'wave'|'toxin', final}
  markers() {
    const out = [];
    for (let i = this.waveIdx; i < this.lv.waves.length; i++) out.push({ t: this.lv.waves[i].t, kind: 'wave', final: !!this.lv.waves[i].final, armored: !!this.lv.waves[i].a });
    for (const tx of this.toxins) if (tx.state === 'coming') out.push({ t: tx.at, kind: 'toxin' });
    return out;
  }

  // ---- queries ----
  liveBact() { return this.bact.filter(b => !b.dead && !b.eaten); }
  nearestBact(u, v, maxD, filter) {
    let best = null, bd = maxD * maxD;
    for (const b of this.bact) {
      if (b.dead || b.eaten || (filter && !filter(b))) continue;
      const d = (b.u - u) ** 2 + (b.v - v) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  inRing(u, v) {
    const r2 = (this.ringR || CONFIG.support.ring) ** 2;
    for (const m of this.mac) if (!m.dead && m.mode === 'support' && (m.u - u) ** 2 + (m.v - v) ** 2 < r2) return true;
    return false;
  }
  cellCount() { return this.neut.length + this.mac.length; }

  // ---- tick ----
  step(dt) {
    if (this.result) return;
    const C = CONFIG, r = this.rand;
    this.t += dt;
    const t = this.t;
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);

    // Script: waves, trickle, toxins
    this.runWaves();
    // Constant stream through the Wound between the big waves, ramping up over the level
    if (t < C.level.duration) {
      const f = t / C.level.duration;
      this.streamAcc += dt * (C.stream.start + (C.stream.end - C.stream.start) * f);
      while (this.streamAcc >= 1) {
        const n = Math.max(1, Math.min(Math.floor(this.streamAcc), 1 + Math.floor(r() * C.stream.clump)));
        this.streamAcc -= n;
        const cu = WOUND.u + (r() - 0.5) * 60, cv = WOUND.v + (r() - 0.5) * 160;
        for (let i = 0; i < n; i++) this.spawnBact(t >= C.stream.armoredFrom && r() < C.stream.armoredShare, cu + (r() - 0.5) * 12, cv + (r() - 0.5) * 12);
        this.fx.push({ k: 'trickle', u: cu, v: cv });
      }
    }

    // Body output and fatigue: pushing the marrow past what the body can sustain builds fatigue
    const mul = this.outputMul(), O = C.output, F = C.fatigue;
    this.fatigue += (mul > O.rest ? (mul - O.rest) * O.tire : (mul - O.rest) * O.recover) * dt;
    this.fatigue = Math.max(0, Math.min(100, this.fatigue));
    this.fatiguePeak = Math.max(this.fatiguePeak, this.fatigue);
    const tier = this.fatigueTier();
    if (tier !== this.tier) { this.fx.push({ k: 'tier', tier, up: tier > this.tier }); this.tier = tier; }
    this.tierTime[tier] += dt;
    const slow = tier >= 1 ? F.tiredSpeed : 1;
    this.ringR = C.support.ring * (tier >= 3 ? F.exhaustedRing : 1);
    for (const tx of this.toxins) {
      if (tx.state === 'coming' && t >= tx.at) { tx.state = 'sweeping'; tx.front = 0; this.fx.push({ k: 'burst', u: WOUND.u, v: WOUND.v }); }
      if (tx.state === 'sweeping') {
        tx.front += dt / C.toxin.sweep;
        const reach = tx.front * 340; // radius from the wound that covers the whole zone
        const kill = c => c.u < ZONE && Math.hypot(c.u - WOUND.u, c.v - WOUND.v) < reach;
        for (const c of this.neut) if (!c.dead && kill(c)) { c.dead = true; this.stats.toxinDeaths++; this.fx.push({ k: 'die', u: c.u, v: c.v, who: 'neut' }); }
        for (const c of this.mac) if (!c.dead && kill(c)) { c.dead = true; this.stats.toxinDeaths++; if (c.prey) c.prey.eaten = false, c.prey = null; this.fx.push({ k: 'die', u: c.u, v: c.v, who: 'mac' }); }
        if (tx.front >= 1) tx.state = 'done';
      }
    }
    const warnTx = this.toxins.find(tx => tx.state === 'coming' && t >= tx.at - C.toxin.warn);
    this.warning = warnTx ? (warnTx.at - t) : 0;

    // Marrow: a steady flow of the chosen cell, held at the cap
    const every = this.marrow.make === 'neut' ? C.marrow.neutEvery : C.marrow.macEvery;
    if (this.cellCount() < C.level.cellCap) {
      this.marrow.prog += dt / every * mul * (tier >= 3 ? F.exhaustedMarrow : 1);
      if (this.marrow.prog >= 1) {
        this.marrow.prog = 0; this.stats.made++;
        if (this.marrow.make === 'neut') { const u = 40 + r() * (L - 80); this.spawnNeut(u, VESSEL * 0.5); this.fx.push({ k: 'arrive', u, v: VESSEL * 0.5 }); }
        else { this.spawnMac(false); const m = this.mac[this.mac.length - 1]; this.fx.push({ k: 'arrive', u: m.u, v: m.v }); }
      }
    } else this.marrow.prog = Math.min(1, this.marrow.prog);

    // Macrophages: mode comes from the zone they stand in
    for (const m of this.mac) {
      if (m.dead) continue;
      const mode = this.zones[zoneOf(m.u)].mode;
      if (mode !== m.mode) { m.mode = mode; m.flip = 0.4; if (mode === 'support' && m.prey) { m.prey.eaten = false; m.prey = null; m.gulp = 0; } }
      m.flip = Math.max(0, m.flip - dt);
      m.cd = Math.max(0, m.cd - dt);
      let tu = m.pu, tv = m.pv, sp = C.macrophage.speed * slow;
      if (m.gulp > 0) {
        m.gulp -= dt;
        if (m.prey) { m.prey.u += (m.u - m.prey.u) * Math.min(1, dt * 8); m.prey.v += (m.v - m.prey.v) * Math.min(1, dt * 8); }
        if (m.gulp <= 0 && m.prey) { m.prey.dead = true; m.prey = null; this.stats.swallows++; m.cd = C.macrophage.eatEvery; }
        sp = 0;
      } else if (m.mode === 'offense' && m.cd <= 0) {
        const lo = m.home * ZONE - 10, hi = (m.home + 1) * ZONE + 10;
        const b = this.nearestBact(m.u, m.v, 400, b => b.u >= lo && b.u < hi);
        if (b) {
          tu = b.u; tv = b.v;
          if (Math.hypot(b.u - m.u, b.v - m.v) < C.macrophage.reach) { m.prey = b; b.eaten = true; m.gulp = C.macrophage.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
        }
      }
      const du = tu - m.u, dv = tv - m.v, d = Math.hypot(du, dv);
      if (d > 1 && sp > 0) { const s = Math.min(d, sp * dt); m.u += du / d * s; m.v += dv / d * s; }
    }

    // Neutrophils: directed random walk toward the nearest bacterium, shooting anything in range
    for (const n of this.neut) {
      if (n.dead) continue;
      n.age += dt;
      if (n.age >= C.neutrophil.life * (tier >= 2 ? F.feverLife : 1)) { n.dead = true; this.fx.push({ k: 'expire', u: n.u, v: n.v }); continue; }
      n.boosted = this.inRing(n.u, n.v);
      const target = this.nearestBact(n.u, n.v, 2000);
      n.turn -= dt;
      if (n.turn <= 0) {
        n.turn = C.neutrophil.turnEvery * (0.6 + r() * 0.8);
        let want;
        if (target) {
          const d = Math.hypot(target.u - n.u, target.v - n.v);
          want = Math.atan2(target.v - n.v, target.u - n.u);
          if (d < C.neutrophil.standoff) want += Math.PI / 2 * (r() < 0.5 ? 1 : -1); // circle instead of crowding in
        } else {
          // Nothing to chase: drift toward the middle of the field
          want = Math.atan2(WIDTH * 0.55 - n.v, L * 0.45 - n.u) + (r() - 0.5) * 2;
        }
        // Directed random walk: veer off the line each turn, and sometimes just wander off
        n.head = r() < C.neutrophil.stray ? r() * 6.283 : want + C.neutrophil.zigzag * (r() * 2 - 1);
      }
      let sp = C.neutrophil.speed * slow * (n.boosted ? C.support.speedMul : 1);
      n.vu += (Math.cos(n.head) * sp - n.vu) * Math.min(1, dt * 6);
      n.vv += (Math.sin(n.head) * sp - n.vv) * Math.min(1, dt * 6);
      n.u = Math.max(8, Math.min(L - 8, n.u + n.vu * dt));
      n.v = Math.max(VESSEL * 0.3, Math.min(WIDTH - 8, n.v + n.vv * dt));
      if (n.v < VESSEL && n.vv < 0) n.vv *= -0.5;
      // Fire: prefer a target the shot can hurt
      n.cd -= dt;
      if (n.cd <= 0) {
        const can = n.boosted ? null : b => !b.armored;
        const aim = this.nearestBact(n.u, n.v, C.neutrophil.range, can) || this.nearestBact(n.u, n.v, C.neutrophil.range);
        if (aim) {
          n.cd = C.neutrophil.fireEvery;
          const d = Math.hypot(aim.u - n.u, aim.v - n.v), tt = d / C.neutrophil.shotSpeed;
          const au = aim.u + C.bacteria.drift * tt, av = aim.v;
          const a = Math.atan2(av - n.v, au - n.u) + (r() - 0.5) * 2 * (C.neutrophil.spread + (tier >= 2 ? F.feverSpread : 0));
          this.shots.push({ u: n.u, v: n.v, pu: n.u, pv: n.v, du: Math.cos(a), dv: Math.sin(a), life: C.neutrophil.range * 1.4 / C.neutrophil.shotSpeed, tuned: n.boosted, from: n.id });
        } else n.cd = 0.05;
      }
    }

    // Shots: straight tracers; the first bacterium touched takes the hit
    for (const s of this.shots) {
      s.pu = s.u; s.pv = s.v;
      const step = C.neutrophil.shotSpeed * dt;
      s.u += s.du * step; s.v += s.dv * step; s.life -= dt;
      for (const b of this.bact) {
        if (b.dead || b.eaten) continue;
        // distance from b to the segment travelled this tick
        const wu = b.u - s.pu, wv = b.v - s.pv, proj = Math.max(0, Math.min(step, wu * s.du + wv * s.dv));
        const cu = s.pu + s.du * proj, cv = s.pv + s.dv * proj;
        if ((b.u - cu) ** 2 + (b.v - cv) ** 2 > (b.armored ? C.bacteria.armorRadius : C.bacteria.hitRadius) ** 2) continue;
        s.life = 0;
        if (s.tuned) { b.dead = true; this.stats.shotKills++; this.fx.push({ k: 'pop', u: b.u, v: b.v, tuned: true, armored: b.armored }); }
        else if (b.armored) { this.stats.bounced++; this.fx.push({ k: 'bounce', u: cu, v: cv, du: -s.du, dv: -s.dv }); }
        else {
          b.hp--; b.flash = 0.12;
          b.u += s.du * C.bacteria.knock; b.v += s.dv * C.bacteria.knock;
          if (b.hp <= 0) { b.dead = true; this.stats.shotKills++; this.fx.push({ k: 'pop', u: b.u, v: b.v }); }
          else this.fx.push({ k: 'hit', u: cu, v: cv });
        }
        break;
      }
    }

    // Bacteria: drift with the flow, spill on crowding, divide while there is room
    const counts = [0, 0, 0];
    for (const b of this.bact) if (!b.dead && !b.eaten) counts[zoneOf(b.u)]++;
    const live = counts[0] + counts[1] + counts[2];
    const cr2 = C.bacteria.crowdRadius ** 2;
    const born = [];
    for (const b of this.bact) {
      if (b.dead || b.eaten) continue;
      b.flash = Math.max(0, b.flash - dt);
      const z = zoneOf(b.u);
      let drift = C.bacteria.drift + C.bacteria.crowdDrift * Math.max(0, counts[z] - C.bacteria.crowdStart);
      // Inside the Lymph node the flow pools: bacteria gather in a cloud around the node instead of piling at the far edge
      const pool = z === 2 && b.u > L - 220;
      if (pool) drift = (L - 130 - b.u) * 0.3;
      // neighbours: separation push and the room check
      let near = 0, pu = 0, pv = 0;
      for (const o of this.bact) {
        if (o === b || o.dead || o.eaten) continue;
        const du = b.u - o.u, dv = b.v - o.v, d2 = du * du + dv * dv;
        if (d2 < cr2) { near++; if (d2 > 0.01) { const d = Math.sqrt(d2); pu += du / d * (1 - d / C.bacteria.crowdRadius); pv += dv / d * (1 - d / C.bacteria.crowdRadius); } }
      }
      b.u += (drift + pu * 14) * dt;
      b.v += (pv * (pool ? 30 : 14) + (pool ? ((WIDTH + VESSEL) / 2 - b.v) * 0.12 : 0) + Math.sin(t * 0.7 + b.id) * (pool ? 8 : 3)) * dt;
      if (pool) b.u += pu * 16 * dt;
      b.u = Math.max(6, Math.min(L - 10, b.u));
      b.v = Math.max(VESSEL + 8, Math.min(WIDTH - 8, b.v));
      b.rot += dt * 0.3;
      if (live + born.length < C.level.maxBacteria && near < C.bacteria.crowdMax) {
        b.age += dt;
        if (b.age >= b.div) {
          b.age = 0; b.div = this.divTime(b.armored);
          const a = r() * 6.283;
          born.push([b.armored, b.u + Math.cos(a) * 5, b.v + Math.sin(a) * 5]);
          b.u -= Math.cos(a) * 3; b.v -= Math.sin(a) * 3;
          if (!b.armored) b.hp = C.bacteria.hp;
        }
      }
    }
    for (const nb of born) { this.spawnBact(nb[0], nb[1], nb[2]); this.fx.push({ k: 'divide', u: nb[1], v: nb[2] }); }

    // Cleanup
    if (this.neut.some(n => n.dead)) this.neut = this.neut.filter(n => !n.dead);
    if (this.mac.some(m => m.dead)) this.mac = this.mac.filter(m => !m.dead);
    if (this.bact.some(b => b.dead)) this.bact = this.bact.filter(b => !b.dead);
    if (this.shots.some(s => s.life <= 0)) this.shots = this.shots.filter(s => s.life > 0);

    // Zone counts, lymph node timer
    const zc = [0, 0, 0];
    for (const b of this.bact) if (!b.eaten) zc[zoneOf(b.u)]++;
    for (let z = 0; z < 3; z++) this.zones[z].count = zc[z];
    const total = zc[0] + zc[1] + zc[2];
    this.stats.peak = Math.max(this.stats.peak, total);
    if (zc[2] > 0) {
      if (!this.lymph.reached) { this.lymph.reached = true; this.fx.push({ k: 'breach' }); }
      this.lymph.timer = Math.min(1, this.lymph.timer + dt / C.lymph.fill);
      this.lymph.peak = Math.max(this.lymph.peak, this.lymph.timer);
    }
    this.histT -= dt;
    if (this.histT <= 0) { this.histT = 2; this.history.push({ t, z: zc.slice(), n: this.neut.length, m: this.mac.length, timer: this.lymph.timer, fatigue: this.fatigue, output: this.output }); }

    if (this.lymph.timer >= 1) this.finish(false, `Bacteria sat in the Lymph node for ${C.lymph.fill} s and multiplied there.`);
    else if (t >= C.level.duration && total === 0) this.finish(true, 'The bar is full and every bacterium is gone.');
  }

  finish(win, reason) {
    const st = this.stats;
    const goals = [
      { text: 'Clear every bacterium', hit: win },
      { text: 'Lymph node timer never passed half', hit: win && this.lymph.peak <= 0.5 },
      { text: 'No bacterium reached the Lymph node', hit: win && !this.lymph.reached },
    ];
    this.result = { win, reason, t: this.t, goals, stars: goals.filter(g => g.hit).length, stats: { ...st }, peakTimer: this.lymph.peak, fatiguePeak: this.fatiguePeak, tierTime: this.tierTime.slice() };
  }
}

if (typeof module !== 'undefined') module.exports = { Game, DEFAULTS, CONFIG, LEVELS, HINTS, mergeConfig, mulberry32, zoneOf, L, WIDTH, ZONE, VESSEL, WOUND, ZONES };

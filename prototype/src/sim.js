'use strict';
// ---------------------------------------------------------------------------
// Immune RTS fun-test prototype: simulation. No DOM in this part, so it also
// runs headless under node (see src/headless.js).
// ---------------------------------------------------------------------------

// Every tunable number. The dev panel edits these live; the sim reads them each tick.
const DEFAULTS = {
  world:        { stanceDelay: 4, popCap: 420, maxPathogens: 900 },
  bacteria:     { start: 15, inflow: 3.3, closeTime: 270, doublingTime: 16, capacity: 700, jitter: 0.35, crowdRadius: 12, crowdMax: 8, speed: 4, hostDmg: 0.0004, alarm: 0.08, loadCap: 500, edgeWeight: 1.5 },
  toxin:        { quorum: 9, radius: 60, chance: 0.014, hostDmg: 0.8, killChance: 0.6, cooldown: 17, inflam: 0.3 },
  pollen:       { start: 25, inflow: 1.2, life: 100, lifeJitter: 25, season: 250, loadWeight: 3, alarm: 0.04, engulf: 20, sample: 3 },
  neutrophil:   { speed: 60, sense: 80, eatCooldown: 2.1, maxEats: 2, life: 42, cost: 1 },
  trap:         { netRadius: 40, netLife: 20, killRate: 0.3, hostDmg: 0.005, inflam: 0.01, minTargets: 4, seekTime: 6 },
  macrophage:   { speed: 24, sense: 80, eatCooldown: 7, life: 220, cost: 3, inflam: 0.013, alarmBoost: 0.15 },
  repair:       { heal: 0.005, calm: 0.12, radius: 45 },
  production:   { rate: 2.2, alertBoost: 0.12, mix: 0.7 },
  alert:        { weight: [0.15, 1, 3, 6], inflam: [0, 0.0006, 0.014, 0.032], speed: [0.8, 1, 1.2, 1.4], eat: [0.85, 1, 1.2, 1.4] },
  inflammation: { decay: 0.03, diffuse: 1.5, hostDmg: 0.5, calm: 0.035, calmHold: 5 },
  alarm:        { decay: 0.5, diffuse: 3, recruit: 0.15 },
  host:         { scarFrac: 0.3 },
  fever:        { duration: 40, cooldown: 85, growth: 0.5, hostDmg: 0.25 },
  adaptive:     { sampleNeeded: 90, delay: 14, doubling: 12, startLevel: 0.03, leak: 0.08, leakBase: 0.4, decay: 0.06, fade: 0.07,
                  opsonize: 3, complementKill: 0.25, complementInflam: 0.08, complementAmbient: 0.008, allergyInflam: 0.18 },
  debris:       { life: 56, inflam: 0.003 },
};

// One line per tunable, shown in the dev panel.
const HINTS = {
  'world.stanceDelay': 'Seconds for a stance change to spread through a population',
  'world.popCap': 'Max friendly cells alive at once',
  'world.maxPathogens': 'Hard cap on pathogen agents (performance)',
  'bacteria.doublingTime': 'Seconds between divisions (before fever)',
  'bacteria.inflow': 'Bacteria per second pouring in through the cut at the start',
  'bacteria.closeTime': 'Seconds until the cut closes; inflow tapers to zero by then',
  'bacteria.capacity': 'Tissue carrying capacity: growth slows to zero as the count nears this',
  'bacteria.crowdMax': 'No division if this many neighbours within crowd radius',
  'bacteria.hostDmg': 'Host Damage % per second, per bacterium',
  'bacteria.loadCap': 'Weighted pathogen count that equals 100% load',
  'bacteria.edgeWeight': 'Load weight of bacteria in Blood entry and Lymph exit',
  'toxin.quorum': 'Neighbours needed before a bacterium can burst',
  'toxin.chance': 'Burst chance per check (about every 1.5 s)',
  'toxin.hostDmg': 'Host Damage % per burst',
  'toxin.cooldown': 'Min seconds between bursts, map-wide',
  'pollen.inflow': 'Grains per second during the season',
  'pollen.season': 'Seconds of pollen inflow',
  'pollen.loadWeight': 'Load weight of one grain',
  'pollen.sample': 'Sample gained per grain a macrophage eats',
  'pollen.engulf': 'Average seconds a macrophage needs to engulf one grain (neutrophils cannot)',
  'neutrophil.maxEats': 'Bacteria eaten before a neutrophil dies',
  'trap.killRate': 'Chance per second a pinned pathogen dies',
  'trap.hostDmg': 'Host Damage % per second, per net',
  'macrophage.inflam': 'Inflammation a Kill macrophage adds to its spot, per second',
  'repair.heal': 'Host Damage % healed per second, per Repair macrophage on damaged tissue',
  'repair.calm': 'Inflammation removed per second around a Repair macrophage',
  'production.rate': 'Marrow output units per second (neutrophil 1, macrophage 3)',
  'production.alertBoost': 'Extra output per alert step above Watch, summed over sectors',
  'production.mix': 'Starting neutrophil share of the marrow slider',
  'alert.weight': 'Recruitment pull: Quiet, Watch, Inflamed, Max',
  'alert.inflam': 'Inflammation added per second per tile: Quiet, Watch, Inflamed, Max',
  'alert.speed': 'Cell speed multiplier in the sector',
  'alert.eat': 'Eat speed multiplier in the sector',
  'inflammation.decay': 'Fraction lost per second (sets how long stand-down takes)',
  'inflammation.hostDmg': 'Host Damage % per second at 100% inflammation everywhere',
  'inflammation.calm': 'Mean inflammation below which the tissue counts as calm',
  'inflammation.calmHold': 'Seconds calm before the match ends',
  'alarm.recruit': 'How strongly damage alarms pull cells to a sector',
  'host.scarFrac': 'Share of all damage that is permanent scarring',
  'fever.growth': 'Bacterial growth multiplier during fever',
  'fever.hostDmg': 'Host Damage % per second during fever',
  'adaptive.sampleNeeded': 'Macrophage meals to fill the sample bar',
  'adaptive.delay': 'Seconds from choice until antibodies start',
  'adaptive.doubling': 'Seconds for antibody output to double',
  'adaptive.leak': 'Antibody delivery rate into tissue',
  'adaptive.leakBase': 'Delivery into uninflamed tissue (inflammation adds on top)',
  'adaptive.opsonize': 'Eat speed bonus at full antibody coverage',
  'adaptive.complementKill': 'Kill chance per second at full coverage',
  'adaptive.complementInflam': 'Inflammation per complement kill',
  'adaptive.allergyInflam': 'Pollen scenario: inflammation per antibody-coated grain',
};

const LEVELS = ['Quiet', 'Watch', 'Inflamed', 'Max'];
const SECTOR_DEFS = [
  { key: 'A', name: 'Blood entry', icon: 'sector-blood' },
  { key: 'B', name: 'Wound', icon: 'sector-wound' },
  { key: 'C', name: 'Lymph exit', icon: 'sector-lymph' },
];
const SCENARIOS = {
  papercut: { name: 'Papercut', icon: 'scenario-papercut', goal: 'Staph got into a cut. Clear it, then stand down.', alerts: [1, 1, 1], pollen: false },
  pollen:   { name: 'Pollen', icon: 'scenario-pollen', goal: 'Pollen is drifting into the tissue. Get the host through the season.', alerts: [1, 2, 1], pollen: true },
};

const clone = o => JSON.parse(JSON.stringify(o));
let CONFIG = clone(DEFAULTS);
function mergeConfig(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const g in saved) {
    if (!CONFIG[g]) continue;
    for (const k in saved[g]) {
      const d = DEFAULTS[g][k], v = saved[g][k];
      if (Array.isArray(d) ? (Array.isArray(v) && v.length === d.length) : typeof d === typeof v) CONFIG[g][k] = clone(v);
    }
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

// World: 600 x 900 units, three stacked sectors of 300. Fields on a 20-unit grid.
const W = 600, H = 900, SECTOR_H = 300, CELL = 20, GW = 30, GH = 45, N = GW * GH, ROWS_PER_SECTOR = 15;
const HB = 30, HX = 20, HY = 30; // spatial hash buckets
const secOf = y => (y < SECTOR_H ? 0 : y < 2 * SECTOR_H ? 1 : 2);
const cellIdx = (x, y) => {
  let gx = (x / CELL) | 0, gy = (y / CELL) | 0;
  if (gx < 0) gx = 0; else if (gx >= GW) gx = GW - 1;
  if (gy < 0) gy = 0; else if (gy >= GH) gy = GH - 1;
  return gy * GW + gx;
};

class Game {
  constructor(key, seed) {
    this.key = key; this.sc = SCENARIOS[key]; this.seed = seed;
    this.rng = mulberry32(seed);
    this.t = 0;
    this.inf = new Float32Array(N); this.alarm = new Float32Array(N); this.ab = new Float32Array(N);
    this.vis = new Float32Array(N); this.tmp = new Float32Array(N);
    this.sectors = SECTOR_DEFS.map((d, i) => ({ ...d, alert: this.sc.alerts[i], dmg: 0, inf: 0 }));
    this.secAlarm = [0, 0, 0];
    this.path = []; this.neut = []; this.mac = []; this.nets = []; this.debris = []; this.fx = [];
    this.scar = 0; this.heal = 0; this.healed = 0; this.taken = 0;
    this.bySource = { bacteria: 0, toxin: 0, inflammation: 0, nets: 0, fever: 0 };
    this.stance = { neut: 'eat', mac: 'kill' };
    this.mix = CONFIG.production.mix;
    this.acc = { n: 0, m: 0, pollen: 0 };
    this.fever = { active: false, left: 0, cd: 0, uses: 0 };
    this.sample = 0;
    this.ad = { state: 'none', choice: null, level: 0, t0: 0, prompted: false };
    this.phase = this.sc.pollen ? 'season' : 'breach';
    this.calmT = 0; this.result = null; this.meanInf = 0;
    this.history = []; this.events = []; this.notices = []; this.inputs = 0;
    this.peakLoad = 0; this.toxReady = 0; this.toxins = 0; this.histT = 0;
    this.hb = Array.from({ length: HX * HY }, () => []);
    const r = this.rng;
    if (this.sc.pollen) {
      for (let i = 0; i < CONFIG.pollen.start; i++) this.spawnPollen();
    } else {
      for (let i = 0; i < CONFIG.bacteria.start; i++) {
        // Seeded along the cut
        this.spawnBact(300 + (r() * 2 - 1) * 130, 450 + (r() + r() - 1) * 22);
      }
    }
    this.record();
  }

  // ---- spawning ----
  spawnBact(x, y) {
    const B = CONFIG.bacteria, r = this.rng;
    this.path.push({ kind: 'b', x, y, vx: 0, vy: 0, rot: r() * 6.28, div: B.doublingTime * (0.3 + r() * 0.9), pin: 0, tc: r() * 1.5, dead: false });
  }
  spawnPollen() {
    const P = CONFIG.pollen, r = this.rng;
    this.path.push({ kind: 'p', x: 40 + r() * 520, y: 450 + (r() + r() - 1) * 120, vx: 0, vy: 0, rot: r() * 6.28,
      life: P.life + (r() * 2 - 1) * P.lifeJitter, pin: 0, dead: false });
  }
  spawnCell(type) {
    const r = this.rng, C = CONFIG;
    const base = type === 'n' ? C.neutrophil.life : C.macrophage.life;
    const c = { type, x: 20 + r() * 560, y: 10, vx: 0, vy: 20, life: base * (0.85 + 0.3 * r()),
      stance: type === 'n' ? this.stance.neut : this.stance.mac, pend: null, pendAt: 0,
      tgt: null, tgtD: null, spot: null, rt: 0, cd: 0, eats: 0, seek: 0, lastEat: -99,
      home: 0, wx: 0, wy: 0, homeT: 6 + r() * 6, dead: false, ph: r() * 6.28 };
    this.setHome(c);
    (type === 'n' ? this.neut : this.mac).push(c);
  }
  randPoint(s) { const r = this.rng; return { x: 40 + r() * 520, y: s * SECTOR_H + 40 + r() * (SECTOR_H - 80) }; }
  chooseHome() {
    const C = CONFIG, w = [0, 0, 0]; let tot = 0;
    for (let s = 0; s < 3; s++) { w[s] = C.alert.weight[this.sectors[s].alert] * (1 + C.alarm.recruit * this.secAlarm[s]); tot += w[s]; }
    let x = this.rng() * tot;
    for (let s = 0; s < 3; s++) { x -= w[s]; if (x <= 0) return s; }
    return 2;
  }
  setHome(c) { c.home = this.chooseHome(); const p = this.randPoint(c.home); c.wx = p.x; c.wy = p.y; }

  // ---- spatial queries over pathogens ----
  rebuildHash() {
    for (const b of this.hb) b.length = 0;
    for (const p of this.path) {
      if (p.dead) continue;
      let bx = (p.x / HB) | 0, by = (p.y / HB) | 0;
      if (bx < 0) bx = 0; else if (bx >= HX) bx = HX - 1;
      if (by < 0) by = 0; else if (by >= HY) by = HY - 1;
      this.hb[by * HX + bx].push(p);
    }
  }
  forNear(x, y, r, fn) {
    const x0 = Math.max(0, ((x - r) / HB) | 0), x1 = Math.min(HX - 1, ((x + r) / HB) | 0);
    const y0 = Math.max(0, ((y - r) / HB) | 0), y1 = Math.min(HY - 1, ((y + r) / HB) | 0), r2 = r * r;
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      for (const p of this.hb[by * HX + bx]) {
        if (p.dead) continue;
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy <= r2) fn(p);
      }
    }
  }
  nearest(x, y, r, kind) {
    let best = null, bd = r * r;
    const x0 = Math.max(0, ((x - r) / HB) | 0), x1 = Math.min(HX - 1, ((x + r) / HB) | 0);
    const y0 = Math.max(0, ((y - r) / HB) | 0), y1 = Math.min(HY - 1, ((y + r) / HB) | 0);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      for (const p of this.hb[by * HX + bx]) {
        if (p.dead || (kind && p.kind !== kind)) continue;
        const dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best;
  }
  countNear(x, y, r) { let n = 0; this.forNear(x, y, r, () => n++); return n; }
  nearestDebris(x, y, r) {
    let best = null, bd = r * r;
    for (const d of this.debris) {
      if (d.dead) continue;
      const dx = d.x - x, dy = d.y - y, q = dx * dx + dy * dy;
      if (q < bd) { bd = q; best = d; }
    }
    return best;
  }

  // ---- meters ----
  hostDamage() { return this.scar + this.heal; }
  load() {
    const B = CONFIG.bacteria, P = CONFIG.pollen; let w = 0;
    for (const p of this.path) {
      if (p.dead) continue;
      w += p.kind === 'p' ? P.loadWeight : (secOf(p.y) === 1 ? 1 : B.edgeWeight);
    }
    return (w / B.loadCap) * 100;
  }
  addDmg(a, src, s) {
    if (a <= 0) return;
    const f = CONFIG.host.scarFrac;
    this.scar += a * f; this.heal += a * (1 - f); this.taken += a;
    this.bySource[src] += a;
    if (s != null) this.sectors[s].dmg += a;
  }
  // Eat-speed multiplier for a target: opsonized targets are eaten faster.
  opso(p) {
    const ad = this.ad;
    const o = ad.state === 'active' && ad.choice === 'opsonize' ? 1 + CONFIG.adaptive.opsonize * this.ab[cellIdx(p.x, p.y)] : 1;
    return o;
  }
  counts() {
    let b = 0, p = 0;
    for (const q of this.path) if (!q.dead) { if (q.kind === 'b') b++; else p++; }
    return { bacteria: b, pollen: p, neut: this.neut.length, mac: this.mac.length };
  }

  // ---- player inputs ----
  event(type, label) { this.events.push({ t: this.t, type, label }); }
  notice(text, kind) { this.notices.push({ text, kind: kind || 'info' }); }
  setAlert(s, lvl) {
    if (this.result || this.sectors[s].alert === lvl) return;
    this.sectors[s].alert = lvl; this.inputs++;
    this.event('alert', `${this.sectors[s].name}: ${LEVELS[lvl]}`);
  }
  setStance(type, st) {
    if (this.result || this.stance[type] === st) return;
    this.stance[type] = st; this.inputs++;
    const list = type === 'neut' ? this.neut : this.mac, d = CONFIG.world.stanceDelay;
    for (const c of list) { c.pend = st; c.pendAt = this.t + this.rng() * d; }
    this.event('stance', `${type === 'neut' ? 'Neutrophils' : 'Macrophages'}: ${st[0].toUpperCase() + st.slice(1)}`);
  }
  switchProgress(type) {
    const list = type === 'neut' ? this.neut : this.mac;
    if (!list.length) return 1;
    let p = 0; for (const c of list) if (c.pend) p++;
    return 1 - p / list.length;
  }
  setMix(v) {
    if (this.result) return;
    this.mix = Math.max(0, Math.min(1, v)); this.inputs++;
    this.event('mix', `Marrow: ${Math.round(this.mix * 100)}% neutrophils`);
  }
  startFever() {
    const F = this.fever;
    if (this.result || F.active || F.cd > 0) return false;
    F.active = true; F.left = CONFIG.fever.duration; F.uses++; this.inputs++;
    this.event('fever', 'Fever');
    return true;
  }
  chooseAntibody(ch) {
    const ad = this.ad;
    if (ad.state !== 'ready') return;
    this.inputs++;
    if (ch === 'hold') { this.event('hold', 'Held off on antibodies'); return; }
    ad.state = 'ramping'; ad.choice = ch; ad.t0 = this.t;
    this.event('antibody', ch === 'opsonize' ? 'Opsonize' : 'Complement');
  }

  // ---- main tick ----
  step(dt) {
    if (this.result) return;
    const C = CONFIG, r = this.rng;
    this.t += dt;
    const t = this.t;

    // Fever
    const F = this.fever;
    if (F.active) {
      F.left -= dt;
      this.addDmg(C.fever.hostDmg * dt, 'fever', null);
      if (F.left <= 0) { F.active = false; F.cd = C.fever.cooldown; this.notice('Fever broke'); this.event('feverEnd', 'Fever broke'); }
    } else if (F.cd > 0) { F.cd = Math.max(0, F.cd - dt); }
    const growth = F.active ? C.fever.growth : 1;

    // Bone marrow: continuous flow, boosted by escalation
    let boost = 0;
    for (const s of this.sectors) boost += Math.max(0, s.alert - 1);
    const rate = C.production.rate * (1 + C.production.alertBoost * boost);
    this.acc.n += rate * this.mix * dt / C.neutrophil.cost;
    this.acc.m += rate * (1 - this.mix) * dt / C.macrophage.cost;
    while (this.acc.n >= 1) { this.acc.n -= 1; if (this.neut.length + this.mac.length < C.world.popCap) this.spawnCell('n'); }
    while (this.acc.m >= 1) { this.acc.m -= 1; if (this.neut.length + this.mac.length < C.world.popCap) this.spawnCell('m'); }

    // Papercut: bacteria keep pouring in through the cut while it closes
    if (!this.sc.pollen) {
      const B = C.bacteria, sIn = B.inflow * Math.max(0, 1 - t / B.closeTime);
      if (sIn > 0) {
        this.acc.bact = (this.acc.bact || 0) + sIn * dt;
        while (this.acc.bact >= 1) { this.acc.bact -= 1; if (this.path.length < C.world.maxPathogens) this.spawnBact(300 + (r() * 2 - 1) * 130, 450 + (r() + r() - 1) * 14); }
      }
    }

    // Pollen season inflow
    if (this.sc.pollen && t < C.pollen.season) {
      this.acc.pollen += C.pollen.inflow * dt;
      while (this.acc.pollen >= 1) { this.acc.pollen -= 1; if (this.path.length < C.world.maxPathogens) this.spawnPollen(); }
    }

    this.rebuildHash();
    this.updateNets(dt);
    this.updatePathogens(dt, growth);
    this.updateNeut(dt);
    this.updateMac(dt);
    this.updateDebris(dt);
    this.updateFields(dt);
    this.updateAdaptive(dt);

    compact(this.path); compact(this.neut); compact(this.mac); compact(this.nets); compact(this.debris);
    for (const f of this.fx) if (t - f.born > f.dur) f.dead = true;
    compact(this.fx);

    this.checkEnd(dt);
    this.histT += dt;
    if (this.histT >= 1) { this.histT -= 1; this.record(); }
  }

  record() {
    this.history.push({ t: this.t, load: this.load(), host: this.hostDamage(), scar: this.scar, inf: this.meanInf, ab: this.ad.state === 'active' ? this.ad.level : 0 });
  }

  steer(c, tx, ty, sp, dt) {
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 6 * dt);
    c.vx += (dx / d * sp - c.vx) * k; c.vy += (dy / d * sp - c.vy) * k;
  }
  move(c, dt) {
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.x < 6) { c.x = 6; c.vx = Math.abs(c.vx); } else if (c.x > W - 6) { c.x = W - 6; c.vx = -Math.abs(c.vx); }
    if (c.y < 6) { c.y = 6; c.vy = Math.abs(c.vy); } else if (c.y > H - 6) { c.y = H - 6; c.vy = -Math.abs(c.vy); }
  }
  // No target in reach: follow the alarm gradient inside the home sector, else patrol.
  idle(c, sp, dt) {
    if (secOf(c.y) !== c.home) { this.steer(c, c.wx, c.wy, sp, dt); return; }
    const gx = Math.min(GW - 2, Math.max(1, (c.x / CELL) | 0)), gy = Math.min(GH - 2, Math.max(1, (c.y / CELL) | 0));
    const a = this.alarm, i = gy * GW + gx;
    const ax = a[i + 1] - a[i - 1], ay = a[i + GW] - a[i - GW], m = Math.hypot(ax, ay);
    if (m > 0.004) this.steer(c, c.x + ax / m * 50, c.y + ay / m * 50, sp, dt);
    else {
      if (Math.hypot(c.wx - c.x, c.wy - c.y) < 15) { const p = this.randPoint(c.home); c.wx = p.x; c.wy = p.y; }
      this.steer(c, c.wx, c.wy, sp * 0.6, dt);
    }
    c.homeT -= dt;
    if (c.homeT <= 0) { c.homeT = 6 + this.rng() * 6; this.setHome(c); }
  }

  // Bacteria are swallowed on contact; a pollen grain takes a while to engulf (faster when antibody-coated).
  engulfed(p, dt) {
    return p.kind !== 'p' || this.rng() < dt * this.opso(p) / CONFIG.pollen.engulf;
  }
  kill(p, sample) {
    p.dead = true;
    if (sample && this.ad.state === 'none') this.sample = Math.min(CONFIG.adaptive.sampleNeeded, this.sample + (p.kind === 'p' ? CONFIG.pollen.sample : 1));
    if (this.fx.length < 160) this.fx.push({ type: 'pop', x: p.x, y: p.y, born: this.t, dur: 0.35, kind: p.kind });
  }
  dieCell(c, leaveDebris) {
    c.dead = true;
    if (leaveDebris) this.debris.push({ x: c.x, y: c.y, life: CONFIG.debris.life, dead: false });
  }

  updateNets(dt) {
    const T = CONFIG.trap, r = this.rng, t = this.t;
    for (const n of this.nets) {
      n.life -= dt;
      if (n.life <= 0) { n.dead = true; continue; }
      const s = secOf(n.y), ci = cellIdx(n.x, n.y);
      this.addDmg(T.hostDmg * dt, 'nets', s);
      this.inf[ci] += T.inflam * dt;
      this.vis[ci] = Math.min(1, this.vis[ci] + 0.02 * dt);
      this.forNear(n.x, n.y, T.netRadius, p => {
        p.pin = t + 0.1;
        if (r() < T.killRate * dt) this.kill(p, false);
      });
    }
  }

  updatePathogens(dt, growth) {
    const C = CONFIG, B = C.bacteria, P = C.pollen, A = C.adaptive, r = this.rng, t = this.t, ad = this.ad;
    const active = ad.state === 'active', comp = active && ad.choice === 'complement';
    const dmg = [0, 0, 0];
    const n = this.path.length;
    let nb = 0;
    for (let i = 0; i < n; i++) if (this.path[i].kind === 'b' && !this.path[i].dead) nb++;
    const room = Math.max(0, 1 - nb / B.capacity);
    for (let i = 0; i < n; i++) {
      const p = this.path[i];
      if (p.dead) continue;
      const pinned = p.pin > t;
      if (!pinned) {
        const sp = p.kind === 'b' ? B.speed : 3;
        if (r() < dt * 0.7) { const a = r() * 6.28; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.rot = a; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 8) p.x = 8; else if (p.x > W - 8) p.x = W - 8;
        if (p.y < 30) p.y = 30; else if (p.y > H - 30) p.y = H - 30;
      }
      const ci = cellIdx(p.x, p.y);
      if (p.kind === 'b') {
        this.alarm[ci] += B.alarm * dt;
        dmg[secOf(p.y)] += B.hostDmg * dt;
        this.vis[ci] = Math.min(1, this.vis[ci] + 0.004 * dt);
        if (!pinned) {
          p.div -= dt * growth;
          if (p.div <= 0) {
            const crowded = r() > room || this.countNear(p.x, p.y, B.crowdRadius) >= B.crowdMax;
            if (!crowded && this.path.length < C.world.maxPathogens) {
              const a = r() * 6.28;
              this.spawnBact(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5);
              this.path[this.path.length - 1].div = B.doublingTime * (1 + (r() * 2 - 1) * B.jitter);
            }
            p.div = B.doublingTime * (1 + (r() * 2 - 1) * B.jitter) * (crowded ? 0.5 : 1);
          }
        }
        p.tc -= dt;
        if (p.tc <= 0) {
          p.tc = 1 + r();
          if (t >= this.toxReady && r() < C.toxin.chance && this.countNear(p.x, p.y, C.toxin.radius * 0.5) >= C.toxin.quorum) this.toxinBurst(p.x, p.y);
        }
      } else {
        p.life -= dt;
        if (p.life <= 0) { p.dead = true; continue; }
        this.alarm[ci] += P.alarm * dt;
        if (active) this.inf[ci] += A.allergyInflam * this.ab[ci] * dt;
      }
      if (comp && r() < A.complementKill * this.ab[ci] * dt) {
        this.kill(p, false);
        this.inf[ci] += A.complementInflam;
      }
    }
    for (let s = 0; s < 3; s++) this.addDmg(dmg[s], 'bacteria', s);
  }

  toxinBurst(x, y) {
    const X = CONFIG.toxin, s = secOf(y), r = this.rng, R = X.radius;
    this.toxReady = this.t + X.cooldown; this.toxins++;
    this.addDmg(X.hostDmg, 'toxin', s);
    const g0x = Math.max(0, ((x - R) / CELL) | 0), g1x = Math.min(GW - 1, ((x + R) / CELL) | 0);
    const g0y = Math.max(0, ((y - R) / CELL) | 0), g1y = Math.min(GH - 1, ((y + R) / CELL) | 0);
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const d = Math.hypot((gx + 0.5) * CELL - x, (gy + 0.5) * CELL - y);
      if (d > R) continue;
      const i = gy * GW + gx, f = 1 - d / R;
      this.inf[i] += X.inflam * f; this.alarm[i] += 0.5 * f; this.vis[i] = Math.min(1, this.vis[i] + 0.3 * f);
    }
    for (const list of [this.neut, this.mac]) for (const c of list) {
      if (c.dead) continue;
      if (Math.hypot(c.x - x, c.y - y) < R && r() < X.killChance * (c.type === 'm' ? 0.4 : 1)) this.dieCell(c, true);
    }
    this.fx.push({ type: 'toxin', x, y, born: this.t, dur: 1.1, r: R });
    this.notice(`Toxin burst in the ${this.sectors[s].name.toLowerCase()}`, 'bad');
    this.event('toxin', 'Toxin burst');
  }

  updateNeut(dt) {
    const C = CONFIG, NC = C.neutrophil, T = C.trap, t = this.t, r = this.rng;
    for (const c of this.neut) {
      if (c.dead) continue;
      c.life -= dt;
      if (c.life <= 0) { this.dieCell(c, true); continue; }
      if (c.pend && t >= c.pendAt) { c.stance = c.pend; c.pend = null; c.tgt = null; c.seek = 0; }
      const lvl = this.sectors[secOf(c.y)].alert, sp = NC.speed * C.alert.speed[lvl];
      c.cd -= dt; c.rt -= dt;
      if (c.stance === 'eat') {
        if (!c.tgt || c.tgt.dead || c.rt <= 0) { c.tgt = this.nearest(c.x, c.y, NC.sense, 'b'); c.rt = 0.35 + r() * 0.2; }
        const g = c.tgt;
        if (g) {
          this.steer(c, g.x, g.y, sp, dt);
          if (Math.hypot(g.x - c.x, g.y - c.y) < 7 && c.cd <= 0 && this.engulfed(g, dt)) {
            this.kill(g, false); c.eats++; c.tgt = null;
            c.cd = NC.eatCooldown / (C.alert.eat[lvl] * this.opso(g));
            if (c.eats >= NC.maxEats) { this.dieCell(c, true); continue; }
          }
        } else this.idle(c, sp, dt);
      } else { // trap: find a crowd, cast a net, die
        c.seek += dt;
        if (!c.tgt || c.tgt.dead || c.rt <= 0) { c.tgt = this.nearest(c.x, c.y, NC.sense * 1.5, 'b'); c.rt = 0.5; }
        const g = c.tgt;
        if (g) {
          this.steer(c, g.x, g.y, sp, dt);
          if (Math.hypot(g.x - c.x, g.y - c.y) < 12) {
            const k = this.countNear(c.x, c.y, T.netRadius);
            if (k >= T.minTargets || c.seek > T.seekTime) {
              c.dead = true;
              this.nets.push({ x: c.x, y: c.y, life: T.netLife, max: T.netLife, rot: r() * 6.28, dead: false });
              continue;
            }
          }
        } else this.idle(c, sp, dt);
      }
      this.move(c, dt);
    }
  }

  updateMac(dt) {
    const C = CONFIG, M = C.macrophage, R = C.repair, t = this.t, r = this.rng;
    const rr = Math.ceil(R.radius / CELL);
    for (const c of this.mac) {
      if (c.dead) continue;
      c.life -= dt;
      if (c.life <= 0) { this.dieCell(c, false); continue; }
      if (c.pend && t >= c.pendAt) { c.stance = c.pend; c.pend = null; c.tgt = null; c.tgtD = null; c.spot = null; c.rt = 0; }
      const lvl = this.sectors[secOf(c.y)].alert, sp = M.speed * C.alert.speed[lvl];
      c.cd -= dt; c.rt -= dt;
      const ci = cellIdx(c.x, c.y);
      if (c.stance === 'kill') {
        if (!c.tgt || c.tgt.dead || c.rt <= 0) {
          c.tgt = this.nearest(c.x, c.y, M.sense);
          c.tgtD = c.tgt ? null : this.nearestDebris(c.x, c.y, M.sense);
          c.rt = 0.5 + r() * 0.3;
        }
        if (c.tgt) {
          this.steer(c, c.tgt.x, c.tgt.y, sp, dt);
          if (Math.hypot(c.tgt.x - c.x, c.tgt.y - c.y) < 10 && c.cd <= 0 && this.engulfed(c.tgt, dt)) {
            const g = c.tgt;
            this.kill(g, true); c.lastEat = t; c.tgt = null;
            c.cd = M.eatCooldown / (C.alert.eat[lvl] * this.opso(g));
          }
        } else if (c.tgtD && !c.tgtD.dead) {
          this.steer(c, c.tgtD.x, c.tgtD.y, sp, dt);
          if (Math.hypot(c.tgtD.x - c.x, c.tgtD.y - c.y) < 10) { c.tgtD.dead = true; c.tgtD = null; }
        } else this.idle(c, sp, dt);
        this.inf[ci] += M.inflam * dt;
        if (t - c.lastEat < 4) this.alarm[ci] += M.alarmBoost * dt;
      } else { // repair: clean debris, go where tissue is hurt or inflamed, heal and calm
        if (c.rt <= 0) {
          c.rt = 1.2 + r() * 0.5;
          c.tgtD = this.nearestDebris(c.x, c.y, M.sense);
          c.spot = null;
          if (!c.tgtD) {
            let best = 0.03;
            for (let k = 0; k < 8; k++) {
              const a = r() * 6.28, d = r() * M.sense, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
              if (x < 0 || x > W || y < 0 || y > H) continue;
              const i = cellIdx(x, y), sc = this.inf[i] + this.vis[i];
              if (sc > best) { best = sc; c.spot = { x, y }; }
            }
          }
          c.tgt = this.nearest(c.x, c.y, 14);
        }
        if (c.tgtD && !c.tgtD.dead) {
          this.steer(c, c.tgtD.x, c.tgtD.y, sp, dt);
          if (Math.hypot(c.tgtD.x - c.x, c.tgtD.y - c.y) < 10) { c.tgtD.dead = true; c.tgtD = null; }
        } else if (c.spot) {
          const d = Math.hypot(c.spot.x - c.x, c.spot.y - c.y);
          if (d > 8) this.steer(c, c.spot.x, c.spot.y, sp * 0.8, dt); else { c.vx *= 0.9; c.vy *= 0.9; }
        } else this.idle(c, sp * 0.7, dt);
        if (c.tgt && !c.tgt.dead && Math.hypot(c.tgt.x - c.x, c.tgt.y - c.y) < 10 && c.cd <= 0 && this.engulfed(c.tgt, dt)) {
          this.kill(c.tgt, false); c.tgt = null; c.cd = M.eatCooldown * 2;
        }
        if (this.inf[ci] + this.vis[ci] > 0.02 && this.heal > 0) {
          const a = Math.min(this.heal, R.heal * dt);
          this.heal -= a; this.healed += a;
        }
        const gx = (c.x / CELL) | 0, gy = (c.y / CELL) | 0;
        for (let y = Math.max(0, gy - rr); y <= Math.min(GH - 1, gy + rr); y++)
          for (let x = Math.max(0, gx - rr); x <= Math.min(GW - 1, gx + rr); x++) {
            const i = y * GW + x;
            this.inf[i] = Math.max(0, this.inf[i] - R.calm * dt);
            this.vis[i] = Math.max(0, this.vis[i] - 0.03 * dt);
          }
      }
      this.move(c, dt);
    }
  }

  updateDebris(dt) {
    const D = CONFIG.debris;
    for (const d of this.debris) {
      if (d.dead) continue;
      d.life -= dt;
      if (d.life <= 0) { d.dead = true; continue; }
      this.inf[cellIdx(d.x, d.y)] += D.inflam * dt;
    }
  }

  diffuse(f, k) {
    const tmp = this.tmp;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, v = f[i];
      tmp[i] = ((x > 0 ? f[i - 1] : v) + (x < GW - 1 ? f[i + 1] : v) + (y > 0 ? f[i - GW] : v) + (y < GH - 1 ? f[i + GW] : v)) * 0.25;
    }
    for (let i = 0; i < N; i++) f[i] += k * (tmp[i] - f[i]);
  }

  updateFields(dt) {
    const C = CONFIG, I = C.inflammation, AL = C.alarm, A = C.adaptive, ad = this.ad;
    const inf = this.inf, al = this.alarm, ab = this.ab, vis = this.vis;
    for (let s = 0; s < 3; s++) {
      const e = C.alert.inflam[this.sectors[s].alert] * dt;
      if (e > 0) for (let i = s * ROWS_PER_SECTOR * GW, end = (s + 1) * ROWS_PER_SECTOR * GW; i < end; i++) inf[i] += e;
    }
    const L = ad.state === 'active' ? ad.level : 0, comp = ad.state === 'active' && ad.choice === 'complement';
    this.diffuse(inf, Math.min(0.24, I.diffuse * dt));
    this.diffuse(al, Math.min(0.24, AL.diffuse * dt));
    if (ad.state === 'active') this.diffuse(ab, Math.min(0.24, 2 * dt));
    const di = 1 - I.decay * dt, da = 1 - AL.decay * dt, dab = 1 - A.decay * dt;
    const sums = [0, 0, 0], asums = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const s = ((i / GW) / ROWS_PER_SECTOR) | 0;
      if (L > 0) ab[i] += L * A.leak * (A.leakBase + inf[i]) * dt;
      if (comp) inf[i] += A.complementAmbient * ab[i] * dt;
      let v = inf[i] * di; inf[i] = v > 1 ? 1 : v;
      v = al[i] * da; al[i] = v > 2 ? 2 : v;
      v = ab[i] * dab; ab[i] = v > 1 ? 1 : v;
      v = vis[i] + inf[i] * 0.003 * dt; vis[i] = v > 1 ? 1 : v;
      sums[s] += inf[i]; asums[s] += al[i];
    }
    const per = N / 3;
    let tot = 0;
    for (let s = 0; s < 3; s++) {
      this.sectors[s].inf = sums[s] / per;
      this.secAlarm[s] = asums[s];
      this.addDmg(I.hostDmg * (sums[s] / N) * dt, 'inflammation', s);
      tot += sums[s];
    }
    this.meanInf = tot / N;
  }

  updateAdaptive(dt) {
    const A = CONFIG.adaptive, ad = this.ad;
    if (ad.state === 'none' && this.sample >= A.sampleNeeded) {
      ad.state = 'ready';
      this.event('sample', 'Sample ready');
      this.notice('A sample reached the lymph node', 'good');
    } else if (ad.state === 'ramping' && this.t - ad.t0 >= A.delay) {
      ad.state = 'active'; ad.level = A.startLevel;
      this.event('abArrive', 'Antibodies arriving');
      this.notice('Antibodies are arriving', 'good');
    } else if (ad.state === 'active') {
      const any = this.path.length > 0;
      ad.level = any ? Math.min(1, ad.level * Math.pow(2, dt / A.doubling)) : ad.level * (1 - A.fade * dt);
    }
  }

  checkEnd(dt) {
    const I = CONFIG.inflammation;
    const load = this.load(), host = this.hostDamage();
    if (load > this.peakLoad) this.peakLoad = load;
    if (host >= 100) return this.finish(false, 'host');
    if (load >= 100) return this.finish(false, 'pathogen');
    if (this.phase !== 'standdown') {
      const clear = this.path.length === 0 && (this.sc.pollen || this.t >= CONFIG.bacteria.closeTime);
      if (this.sc.pollen && this.t >= CONFIG.pollen.season && this.path.length === 0) return this.finish(true, 'season');
      if (clear && !this.sc.pollen) {
        this.phase = 'standdown';
        this.event('standdown', this.sc.pollen ? 'Season over' : 'Infection cleared');
        this.notice(this.sc.pollen ? 'Pollen season is over' : 'Infection cleared', 'good');
      }
    } else {
      this.calmT = this.meanInf < I.calm ? this.calmT + dt : 0;
      if (this.calmT >= I.calmHold) this.finish(true, this.sc.pollen ? 'season' : 'cleared');
    }
  }

  finish(win, reason) {
    this.record();
    const host = this.hostDamage(), scarPct = this.scar;
    let stars = 0, goals = [];
    if (this.sc.pollen) {
      goals = [['Get through the season', win], ['Host Damage 15% or less', win && host <= 15], ['Host Damage 5% or less', win && host <= 5]];
    } else {
      goals = [['Clear the infection and stand down', win], ['Host Damage 50% or less', win && host <= 50], ['Scarring 15% or less', win && scarPct <= 15]];
    }
    for (const g of goals) if (g[1]) stars++;
    this.result = { win, reason, t: this.t, host, scar: scarPct, peakLoad: this.peakLoad, stars, goals,
      inputs: this.inputs, feverUses: this.fever.uses, choice: this.ad.choice, healed: this.healed };
    this.event('end', win ? 'Won' : 'Lost');
  }
}

function compact(a) {
  let j = 0;
  for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i];
  a.length = j;
}

if (typeof module !== 'undefined') module.exports = { Game, DEFAULTS, SCENARIOS, LEVELS, getConfig: () => CONFIG, mergeConfig, clone };

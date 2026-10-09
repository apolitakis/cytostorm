'use strict';
// ---------------------------------------------------------------------------
// Mechanics workshop layer on top of the v3 game (prototype/v3/src/sim.js,
// which the build thread owns; it is inlined read-only and never edited here).
// No DOM, so it runs under node too. It adds, from the outside:
// - a Sandbox level (no script) next to v3's real levels,
// - live spawn rates for antigens and your cells, marrow on/off,
// - cheats: No fatigue, No death, Immortal cells, No division,
// - Toxin load (notes/organ-fatigue-brainstorm.md), driven by v3's fx events.
// Call ws.step(dt) instead of game.step(dt).
// ---------------------------------------------------------------------------

// Workshop-only tunables (v3's own numbers stay in CONFIG)
const WS_DEFAULTS = {
  toxload: { perKill: 0.7, perEndo: 1.7, perBurst: 10, clear: 1.4, clearTired: 0.12, feed: 0.02, safe: 25, puddleAt: 50, puddleSlow: 0.6, puddleLife: 8, puddleR: 9 },
  toxheart: { perKill: 0.01, perEndo: 0.04, perBurst: 3 }, // per-kill toxin /3 since V28's x3 armies
  organs: { liverShare: 0.35, minClear: 0.15, kidneyToxAt: 40, kidneyToxBars: 0.04 },
  leakers: { hepSpeed: 70, ecoliSpeed: 55, ecoliHp: 2, ecoliDivide: 20, ecoliTox: 1.7, wobble: 0.35, leak: 0.08 },
  measles: { speed: 26, seek: 140, incubate: 12, burst: 5, radius: 2.2 },
};
const WS_HINTS = {
  'toxload.perKill': 'Toxin added per antigen killed by a shot, net or storm. Swallows and viruses add none.',
  'toxload.perEndo': 'Toxin per Pseudomonas or Clostridium killed messily (the endotoxin-heavy ones).',
  'toxload.perBurst': 'Toxin added by each scripted toxin burst.',
  'toxload.clear': 'Share of the toxin your liver and kidneys clear per second when rested (1.4: half is gone in about 0.5 s; about 4 s when exhausted).',
  'toxload.clearTired': 'Clearance multiplier at fatigue 100. It slides from 1 at fatigue 0 down to this.',
  'toxload.feed': 'Fatigue per second for each point of toxin above the safe level.',
  'toxload.safe': 'Toxin your liver and kidneys handle for free. Only the backlog above this feeds the heart.',
  'toxload.puddleAt': 'Above this toxin, messy kills leave puddles.',
  'toxload.puddleSlow': 'Speed multiplier for your cells inside a puddle.',
  'toxload.puddleLife': 'Seconds a puddle lasts.',
  'toxload.puddleR': 'Puddle radius.',
  'toxheart.perKill': 'Feed the heart mode: fatigue added per antigen killed by a shot, net or storm. Swallows and viruses add none.',
  'toxheart.perEndo': 'Feed the heart mode: fatigue per Pseudomonas or Clostridium killed messily.',
  'toxheart.perBurst': 'Feed the heart mode: fatigue added by each scripted toxin burst.',
  'organs.liverShare': 'Share of toxin clearance done by the liver; the kidneys do the rest.',
  'organs.minClear': 'Clearance never drops below this share, even with both organs failed.',
  'organs.kidneyToxAt': 'Above this toxin, the kidneys take damage.',
  'organs.kidneyToxBars': 'Kidney bars lost per second while toxin is above that mark.',
  'leakers.hepSpeed': 'Hepatitis swim speed toward the blood vessel.',
  'leakers.ecoliSpeed': 'E. coli swim speed toward the blood vessel.',
  'leakers.ecoliHp': 'Hits to kill an E. coli.',
  'leakers.ecoliDivide': 'Seconds between E. coli divisions.',
  'leakers.leak': 'Share of the organ\'s breach clock each leaker adds when it reaches the blood (0.08: about 12 leaks per bar; it was 0.25 before V28 tripled the leaker swarms).',
  'leakers.ecoliTox': 'Toxin when an E. coli is shot, netted or stormed (it is endotoxin-heavy). Swallowing adds none.',
  'leakers.wobble': 'How much leakers weave side to side on their way to the vessel.',
  'measles.speed': 'Measles swim speed toward a macrophage.',
  'measles.seek': 'How far Measles can sense a macrophage.',
  'measles.incubate': 'Seconds a hijacked macrophage stays dark before it bursts.',
  'measles.burst': 'Measles released when a hijacked macrophage bursts.',
  'measles.radius': 'Measles body size.',
};
const WS = JSON.parse(JSON.stringify(WS_DEFAULTS));
function mergeWs(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const g in saved) if (WS[g]) for (const k in saved[g]) if (k in WS_DEFAULTS[g] && typeof saved[g][k] === 'number') WS[g][k] = saved[g][k];
}

// The sandbox: no waves, no trickle, no toxin bursts, never "ends". Every unit type is available.
LEVELS.sandbox = {
  name: 'Sandbox', blurb: 'No script. The Workshop panel decides what spawns.', duration: 1e9, units: ['neut', 'net', 'nk', 'mac'],
  waves: [], stream: { start: 0, end: 0, clump: 1, kinds: [{ k: 'staph', w: 1 }] }, toxins: [],
};

// What can be spawned, in groups. size = antigens per group (Strep and Tapeworm come as whole chains).
// Group sizes are x3 since Play V28 (Alex: every unit count on both sides x3); the Tapeworm stays one worm.
const SPAWNABLE = [
  { k: 'staph', size: 18, about: 'The grunt. 3 hits, divides.' },
  { k: 'mrsa', size: 9, about: 'Armored. Support rings kill it in one hit; plain shots take 12 and it heals when it divides.' },
  { k: 'pseudo', size: 9, about: 'Settles and grows a slime dome. Offense tears domes down.' },
  { k: 'flu', size: 36, about: 'One-hit swarm. Splits in the Tissue. Nets love it.' },
  { k: 'spore', size: 15, about: 'Inert, then hatches into fast-dividing Clostridium.' },
  { k: 'tb', size: 6, about: 'Tough. Infects any macrophage that swallows it.' },
  { k: 'toxic', size: 12, about: 'Fatigue builds twice as fast while any live.' },
  { k: 'strep', size: 3, about: 'A chain that sprints for the Lymph node.' },
  { k: 'virus', size: 18, about: 'Herpes. Hides in neutrophils. NK cells pop them.' },
  { k: 'measles', size: 12, about: 'Workshop only. Hijacks macrophages: they go dark, then burst into more Measles. NK cells pop them.' },
  { k: 'worm', size: 1, about: 'The Tapeworm boss.' },
  { k: 'hep', size: 18, about: 'Hepatitis. Swims for the left blood vessel. Each leak hurts the liver. Nets catch the swarm.' },
  { k: 'ecoli', size: 12, about: 'E. coli. Swims for the left blood vessel and hurts the kidneys. Shooting it dumps toxin: swallow it.' },
  { k: 'yeast', size: 9, about: 'Candida. Settles and grows threads germs ride to the Lymph node. Nets cut them.' },
];
const FRIENDLY = ['neut', 'net', 'nk', 'mac'];
const ZERO_RATES = () => Object.fromEntries(SPAWNABLE.map(s => [s.k, 0]));
function defaultDev() {
  return {
    level: 'sandbox', rates: ZERO_RATES(), friendly: { neut: 0, net: 0, nk: 0, mac: 0 }, marrowOn: true, spawnMul: 1,
    toxinLoad: false, toxinSimple: false, organs: true, leakZone: 'random', puddles: false, noFatigue: false, noDeath: false, immortal: false, noDivision: false,
  };
}
const NO_TOXIN = { flu: 1, virus: 1 };   // viruses: nets against flu stay clean
const ENDO = { pseudo: 1, clos: 1 };

class Workshop {
  constructor(dev, seed) {
    this.dev = dev;
    this.game = new Game(LEVELS[dev.level] ? dev.level : 'sandbox', seed);
    const g = this.game;
    this.tox = { load: 0, peak: 0, pinned: 0, added: 0, fed: 0, puddles: [] };
    // the main game owns organ health (g.organs, 0-4 bars); this only keeps leak counts and the pop text for the map
    this.organs = { pops: [], leaks: { liver: 0, kidney: 0 } };
    this.leakers = [];
    this.acc = {}; this.facc = {}; this.nextZone = 0;
    this.nearLosses = [];
    // Immortal cells shrug off toxin bursts and the storm's friendly fire
    const kill = g.killCell.bind(g);
    g.killCell = (c, why) => { if (this.dev.immortal && (why === 'toxin' || why === 'storm')) return; kill(c, why); };
  }
  get sandbox() { return this.game.key === 'sandbox'; }

  // ---- spawning ----
  spawnGroup(k) {
    const g = this.game, r = g.rand, C = CONFIG;
    const s = SPAWNABLE.find(x => x.k === k); if (!s) return;
    const cu = WOUND.u + (r() - 0.5) * 60, cv = WOUND.v + (r() - 0.5) * 160;
    if (k === 'strep') for (let i = 0; i < s.size; i++) g.spawnChain('strep', C.strep.links, WOUND.u + 30 + i * 12, cv + (r() - 0.5) * 60);
    else if (k === 'worm') g.spawnChain('worm', C.worm.segments, WOUND.u + 60, WOUND.v);
    else if (k === 'measles') for (let i = 0; i < s.size; i++) this.spawnMeasles(cu + (r() - 0.5) * 24, cv + (r() - 0.5) * 24);
    else if (k === 'hep' || k === 'ecoli') {
      // leakers start on the far side of a zone from the vessel and have to cross that zone's cells
      const z = this.dev.leakZone === 'random' || this.dev.leakZone == null ? Math.floor(r() * NZ) : Math.min(NZ - 1, +this.dev.leakZone);
      const lu = zStart(z) + zLen(z) * (0.25 + r() * 0.5), lv = WIDTH - (typeof FAR_VESSEL === 'number' ? FAR_VESSEL : 0) - 12; // just inside the far vessel's wall
      for (let i = 0; i < s.size; i++) this.spawnLeaker(k, lu + (r() - 0.5) * 30, lv - r() * 20);
    }
    else for (let i = 0; i < s.size; i++) g.spawnAg(k, cu + (r() - 0.5) * 24, cv + (r() - 0.5) * 24, k === 'spore' ? { hatchAt: g.t + C.spore.hatch } : null);
    g.fx.push({ k: 'trickle', u: cu, v: cv });
  }
  // Measles rides on v3's one-hit 'flu' body (shots, nets, storm and swallows already handle it),
  // flagged hj so this layer steers it at macrophages instead of letting it swim to the Lymph node.
  spawnMeasles(u, v, vu, vv) {
    const a = this.game.spawnAg('flu', u, v, { split: true });
    if (a) { a.hj = true; a.r = WS.measles.radius; a.vu = vu || 0; a.vv = vv || 0; }
    return a;
  }
  spawnLeaker(k, u, v) {
    const g = this.game, Lk = WS.leakers;
    const a = k === 'hep' ? g.spawnAg('flu', u, v, { split: true }) : g.spawnAg('staph', u, v);
    if (!a) return null;
    a.leak = a.organ = k === 'hep' ? 'liver' : 'kidney'; // organ: whose breach clock it fills in the Lymph node and on a leak
    if (k === 'ecoli') { a.hp = a.maxHp = Lk.ecoliHp; a.div = Infinity; a.ediv = Lk.ecoliDivide * (0.8 + 0.4 * g.rand()); }
    this.leakers.push(a);
    return a;
  }
  // ---- organs: v3 owns them (4 bars each, breach clocks). A leak into the blood vessel adds CONFIG.lymph.leak to its
  // organ's breach clock (a full clock costs a bar). Toxin hurts the kidneys through g.hurtOrgan (stops at organs.otherFloor).
  // This is the one place leak damage happens.
  leak(organ) {
    const g = this.game, o = this.organs; o.leaks[organ]++;
    g.fx.push({ k: 'leak', organ });
    if (!this.dev.organs) return;
    o.pops.push({ organ, t: 0, txt: `+${Math.round(WS.leakers.leak * 100)}%` });
    g.breach(organ, WS.leakers.leak, organ === 'liver' ? 'Hepatitis' : 'E. coli');
  }
  // h: share of full health (1 = 4 bars), as the Workshop buttons and combos give it
  setOrgan(organ, h) { this.game.setOrgan(organ, h * 4); }
  stepOrgans(dt) {
    const g = this.game, d = this.dev, o = this.organs, O = WS.organs, Lk = WS.leakers;
    // leakers swim for the vessel; E. coli divides on its own clock
    let marked = false;
    for (const a of this.leakers) {
      if (a.dead || a.eaten) { if (a.eaten) a.wasEaten = true; continue; }
      const sp = a.leak === 'liver' ? Lk.hepSpeed : Lk.ecoliSpeed;
      // the sim just moved it with its own drift toward the Lymph node; swap that drift for ours, keep collisions
      const tu = Math.sin(g.t * 1.7 + a.id) * sp * Lk.wobble, tv = -sp;
      if (!a.pen) { a.u += (tu - a.vu) * dt; a.v += (tv - a.vv) * dt; a.vu = tu; a.vv = tv; }
      else { a.u += (tu * 0.3 - a.vu) * dt; a.v += (tv * 0.3 - a.vv) * dt; } // caught in a net: sluggish
      if (a.v < VESSEL + 8) { a.dead = true; a.leaked = true; marked = true; this.leak(a.leak); continue; }
      if (a.leak === 'kidney' && !d.noDivision) {
        a.ediv -= dt;
        if (a.ediv <= 0) { a.ediv = Lk.ecoliDivide; const b = this.spawnLeaker('ecoli', a.u + (g.rand() - 0.5) * 8, a.v + (g.rand() - 0.5) * 8); if (b) b.blink = a.blink = typeof BLINK !== 'undefined' ? BLINK : 0.6; }
      }
    }
    if (marked) g.ag = g.ag.filter(a => !a.dead);
    // E. coli killed messily dumps extra toxin (the sim's pop already counted it as a plain kill)
    for (const a of this.leakers) if (a.dead && !a.leaked && !a.wasEaten && !a.counted && a.leak === 'kidney') {
      a.counted = true;
      if (d.toxinLoad && !d.toxinSimple) this.addToxin(Math.max(0, Lk.ecoliTox - WS.toxload.perKill));
      else if (d.toxinLoad && d.toxinSimple && !d.noFatigue) this.feed(Math.max(0, WS.toxheart.perEndo - WS.toxheart.perKill));
    }
    if (this.leakers.length > 50) this.leakers = this.leakers.filter(a => !a.dead);
    for (const p of o.pops) p.t += dt; if (o.pops.length) o.pops = o.pops.filter(p => p.t < 1.4);
    // high toxin wears the kidneys down
    if (d.organs && d.toxinLoad && !d.toxinSimple && this.tox.load > O.kidneyToxAt) g.hurtOrgan('kidney', O.kidneyToxBars * dt, 'toxin');
  }
  hijack(m) {
    const g = this.game;
    if (m.prey) g.release(m);
    m.infected = WS.measles.incubate; m.hj = true;
    g.fx.push({ k: 'infect', u: m.u, v: m.v }); g.fx.push({ k: 'hijack', u: m.u, v: m.v });
  }
  stepMeasles(dt) {
    const g = this.game, M = WS.measles;
    let marked = false;
    for (const a of g.ag) {
      if (!a.hj || a.dead) continue;
      if (a.eaten) { // swallowed: the macrophage that ate it is hijacked
        const m = g.cells.find(c => c.prey === a);
        a.dead = true; marked = true;
        if (m && !m.hj && !m.tb) this.hijack(m);
        continue;
      }
      let host = null, bd = M.seek * M.seek;
      for (const c of g.cells) if (c.type === 'mac' && !c.dead && !c.hj && !c.tb) { const d = (c.u - a.u) ** 2 + (c.v - a.v) ** 2; if (d < bd) { bd = d; host = c; } }
      if (!host) continue;
      const d = Math.sqrt(bd) || 1;
      if (d < host.r + a.r + 1) { a.dead = true; marked = true; this.hijack(host); continue; }
      a.vu = (host.u - a.u) / d * M.speed; a.vv = (host.v - a.v) / d * M.speed;
    }
    if (marked) g.ag = g.ag.filter(a => !a.dead);
    // hijacked macrophages: dark (no ring, no eating), then burst into more Measles
    for (const m of g.cells) {
      if (!m.hj || m.dead) continue;
      m.stun = Math.max(m.stun, 0.25);
      m.infected -= dt;
      if (m.infected <= 0) {
        m.infected = 0; // so v3 doesn't release Herpes; we release Measles instead
        g.killCell(m, 'burst');
        for (let i = 0; i < M.burst; i++) { const an = g.rand() * 6.283; const b = this.spawnMeasles(m.u, m.v, Math.cos(an) * 50, Math.sin(an) * 50); if (b) b.blink = typeof BLINK !== 'undefined' ? BLINK : 0.6; }
        g.fx.push({ k: 'measlesBurst', u: m.u, v: m.v });
      }
    }
    if (g.cells.some(c => c.dead)) g.cells = g.cells.filter(c => !c.dead);
  }
  spawnFriendly(type, n) {
    const g = this.game;
    for (let i = 0; i < (n || 1); i++) {
      const z = this.nextZone; this.nextZone = (this.nextZone + 1) % NZ;
      const c = g.spawnCell(type, z);
      g.fx.push({ k: 'arrive', u: c.u, v: c.v, type });
    }
  }
  clearMap() {
    const g = this.game; for (const a of g.ag) if (!a.eaten) a.dead = true; g.domes.length = 0;
    if (g.hyphae) { g.hyphae.length = 0; g.fungi.length = 0; }
  }
  toxinBurstNow() { const g = this.game; g.toxins.push({ at: g.t + 0.01, state: 'coming', front: 0 }); }

  // ---- the tick ----
  step(dt) {
    const g = this.game, d = this.dev, C = CONFIG;
    if (g.result) return;
    if (g.fx.length > 450) g.fx.splice(0, g.fx.length - 450); // so the sim's own trim never shifts our read position
    // spawn rates: groups (or cells) per 10 s
    for (const s of SPAWNABLE) {
      const rate = d.rates[s.k] || 0; if (!rate) { this.acc[s.k] = 0; continue; }
      this.acc[s.k] = (this.acc[s.k] || 0) + dt * rate / 10 * (d.spawnMul == null ? 1 : d.spawnMul);
      while (this.acc[s.k] >= 1) { this.acc[s.k] -= 1; this.spawnGroup(s.k); }
    }
    for (const u of FRIENDLY) {
      const rate = d.friendly[u] || 0; if (!rate) { this.facc[u] = 0; continue; }
      this.facc[u] = (this.facc[u] || 0) + dt * rate / 10;
      while (this.facc[u] >= 1) { this.facc[u] -= 1; this.spawnFriendly(u); }
    }
    // marrow off: hold every zone's production progress at zero
    if (!d.marrowOn) for (const zn of g.zones) for (const u in zn.prog) zn.prog[u] = Math.min(zn.prog[u], 0);
    // cheats that work by holding values
    if (d.noDivision) for (const a of g.ag) a.div = Infinity;
    else for (const a of g.ag) if (a.div === Infinity && !a.leak) a.div = g.divTime(a.k);
    if (d.immortal) for (const c of g.cells) if (c.type === 'neut' || c.type === 'nk') c.age = Math.min(c.age, 1);
    if (d.noFatigue) g.fatigue = 0;

    // Fever slows division lives in the sim now (CONFIG.fever, Play V26); the Workshop panel switches CONFIG.fever.on
    const from = g.fx.length, u0 = new Map();
    if (this.tox.puddles.length) for (const c of g.cells) u0.set(c, [c.u, c.v]);
    g.organLoss = !d.noDeath && !d.immortal; // the cheats keep a failed organ from ending the match
    g.step(dt);
    if (!g.result) this.stepMeasles(dt);
    if (!g.result) this.stepOrgans(dt);

    // Toxin load reads what just happened from the sim's event list
    const T = WS.toxload;
    if (d.toxinLoad && d.toxinSimple) {
      // Feed the heart: messy kills add fatigue directly, no separate bar
      const H = WS.toxheart;
      for (let i = from; i < g.fx.length; i++) {
        const f = g.fx[i];
        const amt = f.k === 'pop' ? (NO_TOXIN[f.kind] ? 0 : ENDO[f.kind] ? H.perEndo : H.perKill) : f.k === 'burst' ? H.perBurst : 0;
        if (amt && !d.noFatigue && !g.result) { this.feed(amt); this.tox.added += amt; }
      }
      if (this.tox.load) this.tox.load = 0;
    } else if (d.toxinLoad) {
      for (let i = from; i < g.fx.length; i++) {
        const f = g.fx[i];
        if (f.k === 'pop') {
          if (NO_TOXIN[f.kind]) continue;
          const amt = ENDO[f.kind] ? T.perEndo : T.perKill;
          this.addToxin(amt);
          if (d.puddles && this.tox.load > T.puddleAt && this.tox.puddles.length < 160) this.tox.puddles.push({ u: f.u, v: f.v, r: T.puddleR, life: T.puddleLife, max: T.puddleLife });
        } else if (f.k === 'burst') this.addToxin(T.perBurst);
      }
      // Clearance is proportional to the load (a half-life): very fast when rested, slow when exhausted.
      // The toxin left over feeds the heart, so it only matters once fatigue has slowed clearance.
      const k = this.clearRate();
      this.tox.load = Math.max(0, this.tox.load * Math.exp(-k * dt));
      if (!d.noFatigue && !g.result && this.tox.load > T.safe) this.tox.fed += this.feed(T.feed * (this.tox.load - T.safe) * dt);
      if (this.tox.load >= 99.9) this.tox.pinned += dt;
    } else if (this.tox.load) this.tox.load = 0;
    // puddles fade (faster as the load drops) and slow your cells passing through
    if (this.tox.puddles.length) {
      const fade = d.toxinLoad && this.tox.load > T.puddleAt ? 1 : 2.5;
      for (const p of this.tox.puddles) p.life -= dt * fade;
      this.tox.puddles = this.tox.puddles.filter(p => p.life > 0);
      for (const c of g.cells) {
        const was = u0.get(c); if (!was) continue;
        for (const p of this.tox.puddles) if ((c.u - p.u) ** 2 + (c.v - p.v) ** 2 < p.r * p.r) {
          c.u = was[0] + (c.u - was[0]) * T.puddleSlow; c.v = was[1] + (c.v - was[1]) * T.puddleSlow; break;
        }
      }
    }
    if (d.noFatigue) g.fatigue = 0;
    if (d.immortal) for (const c of g.cells) if (c.type === 'neut' || c.type === 'nk') c.age = Math.min(c.age, 1);

    // No death: an organ at 0 would have been Host failure; log it and keep playing (g.organLoss is off, so it keeps its worst penalty)
    if (d.noDeath) for (let i = from; i < g.fx.length; i++) if (g.fx[i].k === 'organFail') { this.nearLosses.push({ t: g.t, cause: g.fx[i].organ }); g.fx.push({ k: 'nearLoss', cause: g.fx[i].organ }); }
    if (g.result && !g.result.win && d.noDeath) { g.fx.push({ k: 'nearLoss', cause: g.result.cause }); this.forgive(); }
  }
  // undo a loss and play on (No death, or "Keep going" on the end screen)
  forgive() {
    const g = this.game; if (!g.result) return;
    this.nearLosses.push({ t: g.t, cause: g.result.cause });
    g.fatigue = Math.min(g.fatigue, 90); g.storm.after = 0; g.storm.wind = 0; g.result = null;
  }
  // Toxin feeds fatigue up to 100 but never pushes it into Overload (only body output and the storm do that)
  feed(n) { const g = this.game, f0 = g.fatigue; if (f0 < 100) g.fatigue = Math.min(100, f0 + n); return g.fatigue - f0; }
  // Toxin cleared per second per point of load (so the half-life is ln 2 / clearRate)
  clearRate() { const T = WS.toxload; return T.clear * this.fatigueClear() * this.clearFactor(); }
  fatigueClear() { const T = WS.toxload; return 1 + (T.clearTired - 1) * Math.min(1, this.game.fatigue / 100); }
  // liver and kidneys share the clearing, by their health in the main game (4 bars = full)
  clearFactor() { const o = this.game.organs, O = WS.organs; return Math.max(O.minClear, (O.liverShare * o.liver + (1 - O.liverShare) * o.kidney) / 4); }
  addToxin(n) {
    if (!n) return;
    this.tox.load = Math.min(100, this.tox.load + n);
    this.tox.added += n;
    this.tox.peak = Math.max(this.tox.peak, this.tox.load);
  }

  // Live numbers for the readout
  census() {
    const g = this.game, out = {};
    for (const a of g.ag) if (!a.dead && !a.eaten) { const k = a.hj ? 'measles' : a.leak === 'liver' ? 'hep' : a.leak === 'kidney' ? 'ecoli' : a.k; out[k] = (out[k] || 0) + 1; }
    return out;
  }
}

if (typeof module !== 'undefined') module.exports = { Workshop, WS, WS_DEFAULTS, WS_HINTS, mergeWs, SPAWNABLE, FRIENDLY, defaultDev, ZERO_RATES };

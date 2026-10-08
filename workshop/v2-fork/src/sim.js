'use strict';
// ---------------------------------------------------------------------------
// Immune RTS mechanics workshop: the v2 sim (prototype/v2/src/sim.js, forked
// 2026-10-07) plus the antigen roster (notes/antigen-roster.md), Net
// neutrophils, NK cells and the Cytokine storm. A sandbox: hostile and
// friendly spawn rates and dev toggles live in game.dev; Papercut's script
// is optional. Plain JS, no DOM; runs under node for headless checks.
// Coordinates: u runs along the lymph flow (Wound -> Lymph node), v across.
// ---------------------------------------------------------------------------

const DEFAULTS = {
  level:      { duration: 300, cellCap: 60, maxBacteria: 180, startNeut: 12, startMac: 4 },
  stream:     { start: 0.5, end: 1.4, clump: 3, armoredFrom: 90, armoredShare: 0.15 },
  marrow:     { neutEvery: 1, macEvery: 3, netEvery: 2.5, nkEvery: 3 },
  output:     { start: 0.5, min: 0.5, max: 2, rest: 1.15, tire: 1.2, recover: 1.2 },
  fatigue:    { tired: 35, feverish: 60, exhausted: 85, tiredSpeed: 0.85, feverSpread: 0.3, feverLife: 0.7, exhaustedMarrow: 0.5, exhaustedRing: 0.6 },
  neutrophil: { speed: 46, range: 64, fireEvery: 0.8, life: 30, turnEvery: 0.3, zigzag: 1.5, stray: 0.25, standoff: 36, shotSpeed: 420, spread: 0.35 },
  macrophage: { speed: 20, eatEvery: 2, gulp: 0.45, reach: 11 },
  support:    { ring: 50, speedMul: 1.5 },
  bacteria:   { hp: 3, doubling: 10, armorDoubling: 20, jitter: 0.25, drift: 10, crowdDrift: 0.12, crowdStart: 25, crowdRadius: 10, crowdMax: 5, knock: 4, hitRadius: 4.5, armorRadius: 6 },
  toxin:      { warn: 2, notice: 6, sweep: 0.6 },
  lymph:      { fill: 20 },
  // ---- antigen roster ----
  mrsa:       { doubling: 20, spitIgnore: 4 },
  flu:        { swarm: 40, speed: 30, splitInto: 3 },
  pseudo:     { doubling: 14, settleAfter: 6, domeR: 34, domeGrow: 4, domeSpread: 0.25, domeMax: 60, domeHp: 6, domeDrift: 0.15 },
  tb:         { hp: 12, doubling: 25, drift: 0.6, spitEvery: 6, infectedHp: 8, infectedLife: 40 },
  spore:      { clump: 8, hatchAfter: 30, drift: 0.5, hp: 2, doubling: 6 },
  toxic:      { fatigueMul: 2 },
  strep:      { minLinks: 6, maxLinks: 10, speed: 26, hp: 2, spacing: 7 },
  herpes:     { swarm: 8, burstAfter: 12, burstInto: 8 },
  tapeworm:   { segments: 10, segHp: 40, speed: 7.5, tunedDmg: 5, spacing: 18, smallHp: 4, smallSpeed: 24 },
  // ---- new friendly tools ----
  net:        { speed: 50, radius: 34, fuse: 12, linger: 4 },
  nk:         { speed: 40, life: 40, killEvery: 1, reach: 10 },
  toxload:    { perKill: 2, perEndo: 5, perBurst: 10, drainRested: 3, drainTired: 0.5, spill: 1, puddleAt: 50, puddleSlow: 0.6, puddleLife: 8, puddleR: 9 },
  storm:      { windup: 1, hit: 0.4, kill: 0.7, friendly: 0.4, cost: 50, afterburn: 8, burnRate: 2, collapse: 100, worm: 0.15, stun: 3 },
};

// One line per tunable, shown in the tuning panel.
const HINTS = {
  'level.duration': 'Script only: seconds of scripted ingress (the progress bar).',
  'stream.start': 'Script only: bacteria per second streaming in at 0:00.',
  'stream.end': 'Script only: stream rate by the end of the level.',
  'level.cellCap': 'Most of your cells allowed on the field at once.',
  'level.maxBacteria': 'Enemies stop dividing at this many on the map.',
  'level.startNeut': 'Neutrophils on the field at the start.',
  'level.startMac': 'Macrophages on the field at the start.',
  'marrow.neutEvery': 'Seconds to make one neutrophil.',
  'marrow.macEvery': 'Seconds to make one macrophage.',
  'marrow.netEvery': 'Seconds to make one Net neutrophil.',
  'marrow.nkEvery': 'Seconds to make one NK cell.',
  'output.rest': 'Output multiplier the body can sustain: above it fatigue builds, below it fatigue recovers.',
  'output.tire': 'Fatigue points per second for each 1x of output above rest.',
  'output.recover': 'Fatigue points per second recovered for each 1x of output below rest.',
  'neutrophil.fireEvery': 'Seconds between shots.',
  'neutrophil.life': 'Seconds a neutrophil lives.',
  'neutrophil.range': 'Firing range. A neutrophil is about 16 units across; zones are 300 long.',
  'bacteria.hp': 'Plain hits to kill a Staph (tuned shots always kill).',
  'bacteria.doubling': 'Seconds for Staph and Toxic-shock Staph to divide.',
  'bacteria.drift': 'Lymph flow speed toward the Lymph node.',
  'mrsa.doubling': 'Seconds for MRSA to divide.',
  'mrsa.spitIgnore': 'Seconds macrophages leave an MRSA alone after spitting it out.',
  'flu.swarm': 'Flu particles per swarm.',
  'flu.speed': 'Flu drift speed (normal flow is 10).',
  'flu.splitInto': 'Each flu that reaches the Tissue becomes this many.',
  'pseudo.settleAfter': 'Seconds before a Pseudomonas stops and grows a dome.',
  'pseudo.domeR': 'Dome radius it grows to quickly.',
  'pseudo.domeSpread': 'After that, the dome keeps creeping outward this many units per second.',
  'pseudo.domeMax': 'Largest a dome can get.',
  'pseudo.domeHp': 'Offense macrophage gulps to tear a dome down (each also shrinks it).',
  'tb.hp': 'Plain hits to kill a TB.',
  'tb.spitEvery': 'An infected macrophage spits out a new TB this often.',
  'tb.infectedHp': 'Plain hits to kill an infected macrophage.',
  'tb.infectedLife': 'Seconds before an infected macrophage dies on its own.',
  'spore.clump': 'Spores per clump.',
  'spore.hatchAfter': 'Seconds from landing to hatching.',
  'spore.doubling': 'Hatched Clostridium divide this fast.',
  'toxic.fatigueMul': 'Fatigue builds this many times faster while any Toxic-shock Staph is alive.',
  'strep.speed': 'Chain sprint speed (normal flow is 10).',
  'strep.hp': 'Plain hits per chain link.',
  'herpes.swarm': 'Herpes particles per swarm.',
  'herpes.burstAfter': 'Seconds from infection until the neutrophil bursts.',
  'herpes.burstInto': 'Particles released by each burst.',
  'tapeworm.segments': 'Segments per tapeworm (plus the head).',
  'tapeworm.segHp': 'Plain hits per segment.',
  'tapeworm.tunedDmg': 'Damage per tuned shot on a segment.',
  'tapeworm.speed': 'Crawl speed (900 units from Wound to Lymph node).',
  'net.radius': 'Net burst radius. Kills every small enemy inside.',
  'net.fuse': 'Seconds before a Net neutrophil bursts wherever it is.',
  'net.linger': 'Seconds the net stays sticky and keeps killing small enemies.',
  'nk.life': 'Seconds an NK cell lives.',
  'nk.killEvery': 'Seconds between NK kills.',
  'toxload.perKill': 'Toxin load added per enemy killed by a shot, Net or storm (swallows add none).',
  'toxload.perEndo': 'Toxin per Pseudomonas or Clostridium killed messily (the endotoxin-heavy ones). Viruses add none.',
  'toxload.perBurst': 'Toxin added by each toxin burst.',
  'toxload.drainRested': 'Toxin drained per second at 0 fatigue.',
  'toxload.drainTired': 'Toxin drained per second at 100 fatigue (it slides in between).',
  'toxload.spill': 'Fatigue per second while toxin load is pinned at 100.',
  'toxload.puddleAt': 'Above this toxin load, kills leave green puddles.',
  'toxload.puddleSlow': 'Speed multiplier for your cells inside a puddle.',
  'toxload.puddleLife': 'Seconds a puddle lasts (twice as fast below the threshold, frozen while toxin is maxed).',
  'storm.kill': 'Share of enemies the storm kills.',
  'storm.friendly': 'Share of your neutrophils, Net neutrophils and NK cells it kills.',
  'storm.cost': 'Fatigue added the moment it hits.',
  'storm.afterburn': 'Seconds of afterburn after the hit.',
  'storm.burnRate': 'Fatigue per second during the afterburn (half with Body output at its lowest).',
  'storm.collapse': 'Fatigue that kills you during a storm or its afterburn.',
  'storm.worm': 'Share of each tapeworm segment\'s health the storm takes.',
  'storm.stun': 'Seconds macrophages are stunned.',
};

// Enemy kinds. shot: plain | armor (plain shots bounce) | immune (shots pass through) | boss (damage per hit).
// swallow: eat | spit | infect | no. small: Net bursts kill it.
const KINDS = {
  staph:   { name: 'Staph', hit: 4.5, small: true, swallow: 'eat', shot: 'plain' },
  mrsa:    { name: 'MRSA', hit: 6, small: false, swallow: 'spit', shot: 'armor' },
  armored: { name: 'Armored', hit: 6, small: false, swallow: 'eat', shot: 'armor' }, // v2's armored bacterium, from the Papercut script
  flu:     { name: 'Influenza', hit: 3.2, small: true, swallow: 'eat', shot: 'plain', virus: true },
  pseudo:  { name: 'Pseudomonas', hit: 4.5, small: true, swallow: 'eat', shot: 'plain' },
  tb:      { name: 'Tuberculosis', hit: 5.5, small: false, swallow: 'infect', shot: 'plain' },
  spore:   { name: 'Spore', hit: 4, small: false, swallow: 'no', shot: 'immune' },
  clos:    { name: 'Clostridium', hit: 4.5, small: true, swallow: 'eat', shot: 'plain' },
  toxic:   { name: 'Toxic-shock Staph', hit: 4.5, small: true, swallow: 'eat', shot: 'plain' },
  strep:   { name: 'Strep link', hit: 3.8, small: true, swallow: 'eat', shot: 'plain' },
  herpes:  { name: 'Herpes', hit: 3.2, small: true, swallow: 'eat', shot: 'plain', virus: true },
  worm:    { name: 'Tapeworm', hit: 10, small: false, swallow: 'no', shot: 'boss' },
  wormlet: { name: 'Small worm', hit: 4.5, small: true, swallow: 'eat', shot: 'plain' },
};
// What the workshop can spawn, in roster order. group = units per group.
const SPAWNABLE = [
  { kind: 'staph', label: 'Staph', group: 5, trait: 'The grunt. 3 hits, divides.' },
  { kind: 'mrsa', label: 'MRSA', group: 3, trait: 'Armored and spat out. Only tuned shots kill it.' },
  { kind: 'flu', label: 'Influenza', group: 'flu.swarm', trait: 'Swarm of one-hit zerglings. Splits in the Tissue.' },
  { kind: 'pseudo', label: 'Pseudomonas', group: 3, trait: 'Grows shot-proof domes. Offense tears them down.' },
  { kind: 'tb', label: 'Tuberculosis', group: 2, trait: 'Tanky. Infects macrophages that eat it.' },
  { kind: 'spore', label: 'Clostridium', group: 'spore.clump', trait: 'Untouchable spores that hatch together.' },
  { kind: 'toxic', label: 'Toxic-shock Staph', group: 3, trait: 'Fatigue builds twice as fast while it lives.' },
  { kind: 'strep', label: 'Strep chain', group: 1, trait: 'Sprinting chain. Splits where a link dies.' },
  { kind: 'herpes', label: 'Herpes', group: 'herpes.swarm', trait: 'Hides in neutrophils, then bursts out.' },
  { kind: 'worm', label: 'Tapeworm', group: 1, trait: 'Boss. About 400 hits, sheds small worms.' },
];
const FRIENDLY = [
  { kind: 'neut', label: 'Neutrophils' },
  { kind: 'mac', label: 'Macrophages' },
  { kind: 'net', label: 'Net neutrophils' },
  { kind: 'nk', label: 'NK cells' },
];

// Scripted level (optional in the workshop). Waves: b = Staph, a = armored.
const LEVELS = {
  papercut: {
    name: 'Papercut',
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
function groupSize(s) { if (typeof s.group === 'number') return s.group; const [g, k] = s.group.split('.'); return CONFIG[g][k]; }

function defaultDev() {
  return {
    rates: Object.fromEntries(SPAWNABLE.map(s => [s.kind, 0])),     // groups per 10 s
    friendly: Object.fromEntries(FRIENDLY.map(s => [s.kind, 0])),   // free cells per 10 s, on top of the marrow
    marrowOn: true, script: false, toxinLoad: true,
    noFatigue: false, noDeath: false, immortal: false, noDivision: false, bigCaps: false,
  };
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
const WOUND = { u: 70, v: 270 }; // where enemies spill in and toxins burst from
const POOL_U = L - 220;          // inside the Lymph node the flow pools around the node
const POSTS = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.72], [0.3, 0.75], [0.7, 0.28], [0.5, 0.15], [0.5, 0.88]];
const GRID = 12;

class Game {
  constructor(levelKey, seed, dev) {
    this.key = levelKey || 'papercut';
    this.lv = LEVELS[this.key];
    this.dev = Object.assign(defaultDev(), dev ? clone(dev) : {});
    this.seed = seed || 1;
    this.rand = mulberry32(this.seed * 9973 + 17);
    this.t = 0;
    this.bact = []; this.neut = []; this.mac = []; this.shots = [];
    this.runners = []; this.webs = []; this.nk = []; this.domes = [];
    this.fx = []; // visual events for the UI: {k, u, v, ...}
    this.zones = ZONES.map(name => ({ name, mode: 'offense', count: 0 }));
    this.marrow = { make: 'neut', prog: 0 };
    this.lymph = { timer: 0, peak: 0, reached: false, beat: 0 };
    this.waveIdx = 0; this.streamAcc = 0;
    this.spawnAcc = {}; this.friendAcc = {};
    this.output = CONFIG.output.start; this.fatigue = 0; this.tier = 0; this.fatiguePeak = 0; this.tierTime = [0, 0, 0, 0];
    this.storm = { phase: null, p: 0, left: 0, count: 0 };
    this.toxLoad = 0; this.puddles = []; this.toxPinned = 0; this.toxPeak = 0;
    this.toxins = this.dev.script ? this.lv.toxins.map(f => ({ at: f * CONFIG.level.duration, state: 'coming', front: 0 })) : [];
    this.stats = {
      shotKills: 0, tunedKills: 0, swallows: 0, netKills: 0, nkKills: 0, stormKills: 0, made: 0, toxinDeaths: 0, peak: 0, bounced: 0,
      lost: { age: 0, toxin: 0, storm: 0, herpes: 0, tb: 0 }, byKind: {}, nearLosses: [],
      toxinFrom: { shot: 0, net: 0, storm: 0, burst: 0 },
    };
    this.history = []; this.histT = 0;
    this.result = null;
    this.id = 1; this.chainId = 1;
    for (let i = 0; i < CONFIG.level.startNeut; i++) this.spawnNeut(60 + this.rand() * 300, VESSEL + 30 + this.rand() * 120);
    for (let i = 0; i < CONFIG.level.startMac; i++) this.spawnMac(true);
    if (this.dev.script) this.runWaves();
  }

  // ---- caps ----
  cellCap() { return CONFIG.level.cellCap * (this.dev.bigCaps ? 2.5 : 1); }
  bactCap() { return CONFIG.level.maxBacteria * (this.dev.bigCaps ? 2.5 : 1); }

  // ---- player actions ----
  setMarrow(kind) { if (['neut', 'mac', 'net', 'nk'].includes(kind)) { if (kind !== this.marrow.make) this.marrow.prog = 0; this.marrow.make = kind; } }
  toggleZone(z) { const zn = this.zones[z]; if (zn) zn.mode = zn.mode === 'offense' ? 'support' : 'offense'; }
  setZone(z, mode) { if (this.zones[z]) this.zones[z].mode = mode; }
  setOutput(x) { this.output = Math.max(0, Math.min(1, +x || 0)); }
  outputMul() { const O = CONFIG.output; return O.min * Math.pow(O.max / O.min, this.output); }
  fatigueTier() { const F = CONFIG.fatigue, f = this.fatigue; return f >= F.exhausted ? 3 : f >= F.feverish ? 2 : f >= F.tired ? 1 : 0; }
  pendingToxin() {
    for (const tx of this.toxins) {
      if (tx.state === 'sweeping') return tx;
      if (tx.state === 'coming' && this.t >= tx.at - CONFIG.toxin.notice) return tx;
    }
    return null;
  }
  toxinNow() { this.toxins.push({ at: this.t + CONFIG.toxin.warn, state: 'coming', front: 0 }); }
  // Cytokine storm: fires any time. Wind-up, then the hit, then the afterburn.
  fireStorm() {
    if (this.result || this.storm.phase === 'windup' || this.storm.phase === 'hit') return false;
    this.storm.phase = 'windup'; this.storm.left = CONFIG.storm.windup; this.storm.p = 0; this.storm.count++;
    this.fx.push({ k: 'stormWindup' });
    return true;
  }
  // Where the storm would leave fatigue: the instant cost and the afterburn's worst case
  stormPreview() {
    const S = CONFIG.storm, burn = S.afterburn * S.burnRate * (this.output <= 0.001 ? 0.5 : 1);
    return { ghost: this.dev.noFatigue ? 0 : S.cost, burn: this.dev.noFatigue ? 0 : burn };
  }

  // ---- spawning: friendly ----
  spawnNeut(u, v) {
    this.neut.push({ id: this.id++, u, v, vu: 0, vv: 0, head: Math.PI / 2, turn: 0, cd: this.rand() * 0.5, age: 0, boosted: false, dead: false, infected: 0 });
  }
  spawnMac(start) {
    const n = [0, 0, 0]; for (const m of this.mac) n[m.home]++;
    let home = 0; for (let z = 1; z < 3; z++) if (n[z] < n[home]) home = z;
    const slot = n[home] % POSTS.length;
    const pu = home * ZONE + POSTS[slot][0] * ZONE, pv = VESSEL + POSTS[slot][1] * (WIDTH - VESSEL);
    const u = start ? pu : Math.min(L - 20, Math.max(20, pu + (this.rand() - 0.5) * 80)), v = start ? pv : VESSEL * 0.5;
    this.mac.push({ id: this.id++, u, v, home, pu, pv, mode: 'offense', cd: 0, gulp: 0, prey: null, dome: null, dead: false, flip: 0, stun: 0, infected: null });
  }
  spawnRunner(u, v) { this.runners.push({ id: this.id++, u, v, age: 0, tu: u, tv: v, retarget: 0, hasTarget: false, dead: false }); }
  spawnNK(u, v) { this.nk.push({ id: this.id++, u, v, age: 0, cd: 0, wander: this.rand() * 6.283, dead: false }); }
  spawnFriendly(kind) {
    const r = this.rand, u = 40 + r() * (L - 80), v = VESSEL * 0.5;
    if (kind === 'mac') { this.spawnMac(false); const m = this.mac[this.mac.length - 1]; this.fx.push({ k: 'arrive', u: m.u, v: m.v }); return; }
    if (kind === 'neut') this.spawnNeut(u, v);
    else if (kind === 'net') this.spawnRunner(u, v);
    else if (kind === 'nk') this.spawnNK(u, v);
    this.fx.push({ k: 'arrive', u, v });
  }
  cellCount() { return this.neut.length + this.mac.length + this.runners.length + this.nk.length; }

  // ---- spawning: enemies ----
  spawnEnemy(kind, u, v, extra) {
    if (this.bact.length >= this.bactCap() + 200) return null;
    const r = this.rand, C = CONFIG;
    const hp = { staph: C.bacteria.hp, toxic: C.bacteria.hp, mrsa: 1, armored: 1, flu: 1, pseudo: C.bacteria.hp, tb: C.tb.hp, spore: 1, clos: C.spore.hp, strep: C.strep.hp, herpes: 1, worm: C.tapeworm.segHp, wormlet: C.tapeworm.smallHp }[kind];
    const b = {
      id: this.id++, kind, armored: KINDS[kind].shot === 'armor',
      u: u == null ? WOUND.u + (r() - 0.5) * 90 : u, v: v == null ? WOUND.v + (r() - 0.5) * 180 : v,
      hp, maxHp: hp, age: 0, div: this.divTime(kind), life: 0, flash: 0, rot: r() * 6.283, dead: false, eaten: false,
      lead: null, chain: 0, head: false, settled: false, shield: false, spitT: 0, hatchAt: 0, split: false,
    };
    if (extra) Object.assign(b, extra);
    b.v = Math.max(VESSEL + 8, Math.min(WIDTH - 8, b.v)); b.u = Math.max(6, Math.min(L - 10, b.u));
    this.bact.push(b);
    return b;
  }
  // Back-compat with the v2 cheats and script
  spawnBact(armored, u, v) { return this.spawnEnemy(armored ? 'armored' : 'staph', u, v); }
  doublingOf(kind) {
    const C = CONFIG;
    return { staph: C.bacteria.doubling, toxic: C.bacteria.doubling, armored: C.bacteria.armorDoubling, mrsa: C.mrsa.doubling, pseudo: C.pseudo.doubling, tb: C.tb.doubling, clos: C.spore.doubling }[kind] || 0;
  }
  divTime(kind) { const d = this.doublingOf(kind); return d ? d * (1 + (this.rand() - 0.5) * 2 * CONFIG.bacteria.jitter) : Infinity; }

  // One group of an antigen at the Wound (see SPAWNABLE for sizes)
  spawnGroup(kind) {
    const r = this.rand, C = CONFIG;
    const cu = WOUND.u + (r() - 0.5) * 60, cv = WOUND.v + (r() - 0.5) * 140;
    const near = (k, s, extra) => this.spawnEnemy(k, cu + (r() - 0.5) * s, cv + (r() - 0.5) * s * 2, extra);
    switch (kind) {
      case 'flu': for (let i = 0; i < C.flu.swarm; i++) near('flu', 50); break;
      case 'herpes': for (let i = 0; i < C.herpes.swarm; i++) near('herpes', 30); break;
      case 'spore': { const at = this.t + C.spore.hatchAfter; for (let i = 0; i < C.spore.clump; i++) near('spore', 30, { hatchAt: at }); break; }
      case 'strep': {
        const n = C.strep.minLinks + Math.floor(r() * (C.strep.maxLinks - C.strep.minLinks + 1)), chain = this.chainId++;
        let lead = null;
        for (let i = 0; i < n; i++) {
          const b = this.spawnEnemy('strep', 30 - i * C.strep.spacing * 0.5, cv, { chain, lead, head: !lead });
          if (b) lead = b;
        }
        break;
      }
      case 'worm': {
        const chain = this.chainId++;
        let lead = null;
        for (let i = 0; i <= C.tapeworm.segments; i++) {
          const hp = i ? C.tapeworm.segHp : C.tapeworm.segHp * 1.5;
          const b = this.spawnEnemy('worm', 40 - i * 4, WOUND.v, { chain, lead, head: !lead, hp, maxHp: hp });
          if (b) lead = b;
        }
        break;
      }
      default: {
        const s = SPAWNABLE.find(x => x.kind === kind), n = s ? groupSize(s) : 1;
        for (let i = 0; i < n; i++) near(kind, 24);
      }
    }
    this.fx.push({ k: 'trickle', u: cu, v: cv, kind });
  }

  runWaves() {
    const w = this.lv.waves;
    while (this.waveIdx < w.length && this.t >= w[this.waveIdx].t) {
      const wave = w[this.waveIdx++];
      for (let i = 0; i < (wave.b || 0); i++) this.spawnEnemy('staph');
      for (let i = 0; i < (wave.a || 0); i++) this.spawnEnemy('armored');
      this.fx.push({ k: 'wave', u: WOUND.u, v: WOUND.v, n: (wave.b || 0) + (wave.a || 0), armored: wave.a || 0, final: !!wave.final });
    }
  }
  markers() {
    const out = [];
    if (this.dev.script) for (let i = this.waveIdx; i < this.lv.waves.length; i++) out.push({ t: this.lv.waves[i].t, kind: 'wave', final: !!this.lv.waves[i].final, armored: !!this.lv.waves[i].a });
    for (const tx of this.toxins) if (tx.state === 'coming') out.push({ t: tx.at, kind: 'toxin' });
    return out;
  }

  // ---- queries ----
  liveBact() { return this.bact.filter(b => !b.dead && !b.eaten); }
  countByKind() {
    const n = {};
    for (const b of this.bact) if (!b.dead && !b.eaten) n[b.kind] = (n[b.kind] || 0) + 1;
    return n;
  }
  // Can a neutrophil see and shoot this? (spores are inert, dome cover hides them)
  shootable(b) { return !b.dead && !b.eaten && b.kind !== 'spore' && !b.shield; }
  nearestBact(u, v, maxD, filter) {
    let best = null, bd = maxD * maxD;
    for (const b of this.bact) {
      if (b.dead || b.eaten || (filter && !filter(b))) continue;
      const d = (b.u - u) ** 2 + (b.v - v) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // Neutrophil targets: shootable enemies plus TB-infected macrophages
  nearestTarget(u, v, maxD, filter) {
    let best = this.nearestBact(u, v, maxD, b => this.shootable(b) && (!filter || filter(b)));
    let bd = best ? (best.u - u) ** 2 + (best.v - v) ** 2 : maxD * maxD;
    for (const m of this.mac) {
      if (m.dead || !m.infected) continue;
      const d = (m.u - u) ** 2 + (m.v - v) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  inRing(u, v) {
    const r2 = (this.ringR || CONFIG.support.ring) ** 2;
    for (const m of this.mac) if (!m.dead && !m.infected && m.mode === 'support' && m.stun <= 0 && (m.u - u) ** 2 + (m.v - v) ** 2 < r2) return true;
    return false;
  }
  domeAt(u, v) { for (const d of this.domes) if ((d.u - u) ** 2 + (d.v - v) ** 2 < d.r * d.r) return d; return null; }

  // ---- kills ----
  kill(b, source, quiet) {
    if (b.dead) return;
    b.dead = true; b.eaten = false;
    const st = this.stats;
    if (source === 'shot') st.shotKills++; else if (source === 'tuned') { st.shotKills++; st.tunedKills++; }
    else if (source === 'swallow') st.swallows++; else if (source === 'net') st.netKills++; else if (source === 'nk') st.nkKills++; else if (source === 'storm') st.stormKills++;
    st.byKind[b.kind] = (st.byKind[b.kind] || 0) + 1;
    if (source === 'shot' || source === 'tuned' || source === 'net' || source === 'storm') this.addToxin(b, source === 'tuned' ? 'shot' : source);
    if (b.kind === 'worm') {
      // A broken segment sheds a small fast worm
      this.spawnEnemy('wormlet', b.u, b.v);
      this.fx.push({ k: 'shed', u: b.u, v: b.v });
    }
    if (!quiet) this.fx.push({ k: source === 'storm' ? 'stormKill' : 'pop', u: b.u, v: b.v, tuned: source === 'tuned', armored: b.armored, kind: b.kind });
  }
  // Toxin load: messy kills dump toxin; swallows are clean; viruses carry none
  addToxin(b, source) {
    if (!this.dev.toxinLoad) return;
    const T = CONFIG.toxload;
    const amt = source === 'burst' ? T.perBurst : KINDS[b.kind].virus ? 0 : (b.kind === 'pseudo' || b.kind === 'clos') ? T.perEndo : T.perKill;
    if (!amt) return;
    this.toxLoad = Math.min(100, this.toxLoad + amt);
    this.stats.toxinFrom[source] = (this.stats.toxinFrom[source] || 0) + amt;
    if (b && this.toxLoad > T.puddleAt && this.puddles.length < 160) this.puddles.push({ u: b.u, v: b.v, life: T.puddleLife, max: T.puddleLife, r: T.puddleR * (0.8 + this.rand() * 0.5) });
  }
  // Speed multiplier for one of your cells standing in a puddle
  puddleMul(u, v) {
    for (const p of this.puddles) if ((p.u - u) ** 2 + (p.v - v) ** 2 < p.r * p.r) return CONFIG.toxload.puddleSlow;
    return 1;
  }
  loseCell(c, why, kind) {
    if (c.dead) return;
    c.dead = true; this.stats.lost[why] = (this.stats.lost[why] || 0) + 1;
    if (kind === 'neut' && c.infected > 0 && why !== 'age') this.herpesBurst(c);
    if (kind === 'mac' && c.prey) { c.prey.eaten = false; c.prey = null; }
    this.fx.push({ k: why === 'age' ? 'expire' : why === 'storm' ? 'stormKill' : 'die', u: c.u, v: c.v, who: kind });
  }
  herpesBurst(n) {
    for (let i = 0; i < CONFIG.herpes.burstInto; i++) {
      const a = this.rand() * 6.283;
      this.spawnEnemy('herpes', n.u + Math.cos(a) * 6, n.v + Math.sin(a) * 6);
    }
    this.fx.push({ k: 'herpesBurst', u: n.u, v: n.v });
  }

  // ---- tick ----
  step(dt) {
    if (this.result) return;
    const C = CONFIG, r = this.rand, D = this.dev;
    this.t += dt;
    const t = this.t;
    if (this.fx.length > 600) this.fx.splice(0, this.fx.length - 600);

    // ---- script (optional) ----
    if (D.script) {
      this.runWaves();
      if (t < C.level.duration) {
        const f = t / C.level.duration;
        this.streamAcc += dt * (C.stream.start + (C.stream.end - C.stream.start) * f);
        while (this.streamAcc >= 1) {
          const n = Math.max(1, Math.min(Math.floor(this.streamAcc), 1 + Math.floor(r() * C.stream.clump)));
          this.streamAcc -= n;
          const cu = WOUND.u + (r() - 0.5) * 60, cv = WOUND.v + (r() - 0.5) * 160;
          for (let i = 0; i < n; i++) this.spawnEnemy(t >= C.stream.armoredFrom && r() < C.stream.armoredShare ? 'armored' : 'staph', cu + (r() - 0.5) * 12, cv + (r() - 0.5) * 12);
          this.fx.push({ k: 'trickle', u: cu, v: cv });
        }
      }
    }
    // ---- workshop spawn rates ----
    for (const s of SPAWNABLE) {
      const rate = +D.rates[s.kind] || 0; if (rate <= 0) continue;
      if (this.spawnAcc[s.kind] == null) this.spawnAcc[s.kind] = 0.6; // first group comes quickly
      this.spawnAcc[s.kind] += rate / 10 * dt;
      while (this.spawnAcc[s.kind] >= 1) { this.spawnAcc[s.kind] -= 1; this.spawnGroup(s.kind); }
    }
    for (const f of FRIENDLY) {
      const rate = +D.friendly[f.kind] || 0; if (rate <= 0) continue;
      this.friendAcc[f.kind] = (this.friendAcc[f.kind] || 0) + rate / 10 * dt;
      while (this.friendAcc[f.kind] >= 1) { this.friendAcc[f.kind] -= 1; if (this.cellCount() < this.cellCap()) this.spawnFriendly(f.kind); }
    }

    // ---- body output, fatigue, storm ----
    const mul = this.outputMul(), O = C.output, F = C.fatigue, S = C.storm;
    const toxicAlive = this.bact.some(b => b.kind === 'toxic' && !b.dead);
    this.toxicAlive = toxicAlive;
    this.fatigue += (mul > O.rest ? (mul - O.rest) * O.tire * (toxicAlive ? C.toxic.fatigueMul : 1) : (mul - O.rest) * O.recover) * dt;
    const st = this.storm;
    if (st.phase) {
      st.left -= dt;
      const len = st.phase === 'windup' ? S.windup : st.phase === 'hit' ? S.hit : S.afterburn;
      st.p = Math.max(0, Math.min(1, 1 - st.left / len));
      if (st.phase === 'afterburn' || st.phase === 'hit') this.fatigue += S.burnRate * (this.output <= 0.001 ? 0.5 : 1) * dt * (st.phase === 'hit' ? 0 : 1);
      if (st.left <= 0) {
        if (st.phase === 'windup') { st.phase = 'hit'; st.left = S.hit; st.p = 0; this.stormHit(); }
        else if (st.phase === 'hit') { st.phase = 'afterburn'; st.left = S.afterburn; st.p = 0; }
        else { st.phase = null; st.p = 0; this.fx.push({ k: 'stormEnd' }); }
      }
    }
    // Toxin load drains faster when rested; pinned at 100 it spills into fatigue
    if (D.toxinLoad) {
      const T = C.toxload, fNow = Math.max(0, Math.min(100, this.fatigue));
      const pinned = this.toxLoad >= 100 - 1e-6;
      if (pinned) { this.fatigue += T.spill * dt; this.toxPinned += dt; }
      this.toxLoad = Math.max(0, this.toxLoad - (T.drainRested + (T.drainTired - T.drainRested) * fNow / 100) * dt);
      this.toxPeak = Math.max(this.toxPeak, this.toxLoad);
      for (const p of this.puddles) if (!pinned) p.life -= dt * (this.toxLoad < T.puddleAt ? 2 : 1);
      if (this.puddles.some(p => p.life <= 0)) this.puddles = this.puddles.filter(p => p.life > 0);
    } else if (this.toxLoad || this.puddles.length) { this.toxLoad = 0; this.puddles.length = 0; }
    if (D.noFatigue) this.fatigue = 0;
    // Collapse: fatigue reaching the limit during a storm or its afterburn kills you
    if (st.phase && st.phase !== 'windup' && this.fatigue >= S.collapse) {
      if (D.noDeath) { this.nearLoss('collapse', `Organ failure: fatigue hit ${S.collapse} during a storm`); this.fatigue = S.collapse - 0.01; }
      else { this.fatigue = Math.min(100, this.fatigue); this.finish(false, `Cytokine storm: organ failure. Fatigue hit ${S.collapse} during the storm.`, 'collapse'); return; }
    }
    this.fatigue = Math.max(0, Math.min(100, this.fatigue));
    this.fatiguePeak = Math.max(this.fatiguePeak, this.fatigue);
    const tier = this.fatigueTier();
    if (tier !== this.tier) { this.fx.push({ k: 'tier', tier, up: tier > this.tier }); this.tier = tier; }
    this.tierTime[tier] += dt;
    const slow = tier >= 1 ? F.tiredSpeed : 1;
    this.ringR = C.support.ring * (tier >= 3 ? F.exhaustedRing : 1);

    // ---- toxin bursts ----
    for (const tx of this.toxins) {
      if (tx.state === 'coming' && t >= tx.at) { tx.state = 'sweeping'; tx.front = 0; this.fx.push({ k: 'burst', u: WOUND.u, v: WOUND.v }); this.addToxin(null, 'burst'); }
      if (tx.state === 'sweeping') {
        tx.front += dt / C.toxin.sweep;
        const reach = tx.front * 340;
        const hit = c => !c.dead && c.u < ZONE && Math.hypot(c.u - WOUND.u, c.v - WOUND.v) < reach;
        if (!D.immortal) {
          for (const c of this.neut) if (hit(c)) { this.stats.toxinDeaths++; this.loseCell(c, 'toxin', 'neut'); }
          for (const c of this.mac) if (hit(c)) { this.stats.toxinDeaths++; this.loseCell(c, 'toxin', 'mac'); }
          for (const c of this.runners) if (hit(c)) { this.stats.toxinDeaths++; this.loseCell(c, 'toxin', 'net'); }
          for (const c of this.nk) if (hit(c)) { this.stats.toxinDeaths++; this.loseCell(c, 'toxin', 'nk'); }
        }
        if (tx.front >= 1) tx.state = 'done';
      }
    }
    const warnTx = this.toxins.find(tx => tx.state === 'coming' && t >= tx.at - C.toxin.warn);
    this.warning = warnTx ? (warnTx.at - t) : 0;

    // ---- marrow ----
    const make = this.marrow.make;
    const every = { neut: C.marrow.neutEvery, mac: C.marrow.macEvery, net: C.marrow.netEvery, nk: C.marrow.nkEvery }[make];
    if (D.marrowOn && this.cellCount() < this.cellCap()) {
      this.marrow.prog += dt / every * mul * (tier >= 3 ? F.exhaustedMarrow : 1);
      if (this.marrow.prog >= 1) { this.marrow.prog = 0; this.stats.made++; this.spawnFriendly(make); }
    } else this.marrow.prog = Math.min(1, this.marrow.prog);

    // ---- domes: shelter what's under them ----
    for (const d of this.domes) {
      const grow = d.r < C.pseudo.domeR ? C.pseudo.domeGrow : C.pseudo.domeSpread;
      d.r = Math.min(C.pseudo.domeMax, d.r + grow * dt);
    }
    for (const b of this.bact) b.shield = !b.dead && !b.eaten && b.kind !== 'worm' && !!this.domeAt(b.u, b.v);

    this.stepMacrophages(dt, slow);
    this.stepNeutrophils(dt, slow, tier);
    this.stepRunners(dt, slow);
    this.stepNK(dt, slow);
    this.stepShots(dt);
    this.stepEnemies(dt);

    // ---- cleanup ----
    if (this.neut.some(n => n.dead)) this.neut = this.neut.filter(n => !n.dead);
    if (this.mac.some(m => m.dead)) this.mac = this.mac.filter(m => !m.dead);
    if (this.runners.some(m => m.dead)) this.runners = this.runners.filter(m => !m.dead);
    if (this.nk.some(m => m.dead)) this.nk = this.nk.filter(m => !m.dead);
    if (this.bact.some(b => b.dead)) this.bact = this.bact.filter(b => !b.dead);
    if (this.shots.some(s => s.life <= 0)) this.shots = this.shots.filter(s => s.life > 0);
    if (this.webs.some(w => w.life <= 0)) this.webs = this.webs.filter(w => w.life > 0);
    if (this.domes.some(d => d.hp <= 0)) {
      for (const d of this.domes) if (d.hp <= 0) for (const b of this.bact) if (b.settled === d) { b.settled = false; b.life = 0; }
      this.domes = this.domes.filter(d => d.hp > 0);
    }

    // ---- zone counts, lymph node timer ----
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
    if (this.histT <= 0) { this.histT = 2; this.history.push({ t, z: zc.slice(), n: this.neut.length, m: this.mac.length, timer: this.lymph.timer, fatigue: this.fatigue, output: this.output, tox: this.toxLoad }); if (this.history.length > 900) this.history.splice(0, 300); }

    if (this.lymph.timer >= 1) {
      if (D.noDeath) { this.nearLoss('lymph', 'The Lymph node timer filled'); this.lymph.timer = 0; }
      else this.finish(false, `Enemies sat in the Lymph node for ${C.lymph.fill} s and took hold.`, 'lymph');
    } else if (D.script && t >= C.level.duration && total === 0) this.finish(true, 'The bar is full and every enemy is gone.');
  }

  nearLoss(kind, text) {
    this.stats.nearLosses.push({ t: this.t, kind, text });
    this.fx.push({ k: 'nearLoss', text });
  }

  // The storm lands: decimate enemies, hurt your own cells, stun macrophages
  stormHit() {
    const S = CONFIG.storm, r = this.rand, D = this.dev;
    for (const b of this.bact) {
      if (b.dead || b.eaten || b.kind === 'spore' || b.shield) continue;
      if (b.kind === 'worm') { b.hp -= b.maxHp * S.worm; b.flash = 0.3; if (b.hp <= 0) this.kill(b, 'storm'); continue; }
      if (r() < S.kill) this.kill(b, 'storm');
    }
    if (!D.immortal) {
      for (const n of this.neut) if (r() < S.friendly) this.loseCell(n, 'storm', 'neut');
      for (const n of this.runners) if (r() < S.friendly) this.loseCell(n, 'storm', 'net');
      for (const n of this.nk) if (r() < S.friendly) this.loseCell(n, 'storm', 'nk');
      for (const m of this.mac) if (m.infected && r() < S.friendly) this.loseCell(m, 'storm', 'mac');
    }
    for (const m of this.mac) { if (m.dead) continue; m.stun = S.stun; if (m.prey) { m.prey.eaten = false; m.prey = null; } m.gulp = 0; m.dome = null; }
    if (!D.noFatigue) this.fatigue += S.cost;
    this.fx.push({ k: 'stormHit' });
  }

  stepMacrophages(dt, slow) {
    const C = CONFIG;
    for (const m of this.mac) {
      if (m.dead) continue;
      // TB-infected: rooted, spits out new TB until it dies or is shot down
      if (m.infected) {
        const inf = m.infected;
        inf.age += dt; inf.spit -= dt;
        if (inf.spit <= 0) { inf.spit = C.tb.spitEvery; this.spawnEnemy('tb', m.u + (this.rand() - 0.5) * 16, m.v + (this.rand() - 0.5) * 16); this.fx.push({ k: 'spit', u: m.u, v: m.v }); }
        if (inf.age >= C.tb.infectedLife) this.loseCell(m, 'tb', 'mac');
        continue;
      }
      const mode = this.zones[zoneOf(m.u)].mode;
      if (mode !== m.mode) { m.mode = mode; m.flip = 0.4; if (mode === 'support' && (m.prey || m.dome)) { if (m.prey) m.prey.eaten = false; m.prey = null; m.dome = null; m.gulp = 0; } }
      m.flip = Math.max(0, m.flip - dt);
      m.cd = Math.max(0, m.cd - dt);
      if (m.stun > 0) { m.stun -= dt; continue; }
      let tu = m.pu, tv = m.pv, sp = C.macrophage.speed * slow * (this.puddles.length ? this.puddleMul(m.u, m.v) : 1);
      if (m.gulp > 0) {
        m.gulp -= dt; sp = 0;
        if (m.prey) { m.prey.u += (m.u - m.prey.u) * Math.min(1, dt * 8); m.prey.v += (m.v - m.prey.v) * Math.min(1, dt * 8); }
        if (m.gulp <= 0) {
          m.cd = C.macrophage.eatEvery;
          if (m.dome) {
            const d = m.dome; d.hp--; d.r *= 0.85; m.dome = null;
            this.fx.push({ k: d.hp <= 0 ? 'domePop' : 'domeChew', u: d.u, v: d.v, r: d.r });
          } else if (m.prey) {
            const b = m.prey, how = KINDS[b.kind].swallow;
            m.prey = null;
            if (how === 'spit') {
              b.eaten = false; b.spitT = C.mrsa.spitIgnore;
              const a = this.rand() * 6.283; b.u += Math.cos(a) * 16; b.v = Math.max(VESSEL + 8, Math.min(WIDTH - 8, b.v + Math.sin(a) * 16));
              this.fx.push({ k: 'spit', u: b.u, v: b.v });
            } else if (how === 'infect') {
              this.kill(b, 'swallow', true);
              m.infected = { hp: C.tb.infectedHp, age: 0, spit: C.tb.spitEvery };
              this.fx.push({ k: 'infect', u: m.u, v: m.v });
            } else this.kill(b, 'swallow', true);
          }
        }
      } else if (m.mode === 'offense' && m.cd <= 0) {
        const lo = m.home * ZONE - 10, hi = (m.home + 1) * ZONE + 10;
        // Domes first: they're the one thing only macrophages can break
        let dome = null, dd = Infinity;
        for (const d of this.domes) if (d.u >= lo && d.u < hi) { const q = Math.hypot(d.u - m.u, d.v - m.v) - d.r; if (q < dd) { dd = q; dome = d; } }
        if (dome) {
          tu = dome.u; tv = dome.v;
          if (dd < C.macrophage.reach) { m.dome = dome; m.gulp = C.macrophage.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
        } else {
          const b = this.nearestBact(m.u, m.v, 400, b => b.u >= lo && b.u < hi && KINDS[b.kind].swallow !== 'no' && b.spitT <= 0);
          if (b) {
            tu = b.u; tv = b.v;
            if (Math.hypot(b.u - m.u, b.v - m.v) < C.macrophage.reach) { m.prey = b; b.eaten = true; m.gulp = C.macrophage.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
          }
        }
      }
      const du = tu - m.u, dv = tv - m.v, d = Math.hypot(du, dv);
      if (d > 1 && sp > 0) { const s = Math.min(d, sp * dt); m.u += du / d * s; m.v += dv / d * s; }
    }
  }

  stepNeutrophils(dt, slow, tier) {
    const C = CONFIG, F = C.fatigue, r = this.rand, D = this.dev;
    for (const n of this.neut) {
      if (n.dead) continue;
      n.age += dt;
      if (!D.immortal && n.age >= C.neutrophil.life * (tier >= 2 ? F.feverLife : 1)) { this.loseCell(n, 'age', 'neut'); continue; }
      if (n.infected > 0) { n.infected -= dt; if (n.infected <= 0) { n.dead = true; this.stats.lost.herpes++; this.herpesBurst(n); continue; } }
      n.boosted = this.inRing(n.u, n.v);
      n.turn -= dt;
      if (n.turn <= 0) {
        n.turn = C.neutrophil.turnEvery * (0.6 + r() * 0.8);
        const target = this.nearestTarget(n.u, n.v, 2000);
        let want;
        if (target) {
          const d = Math.hypot(target.u - n.u, target.v - n.v);
          want = Math.atan2(target.v - n.v, target.u - n.u);
          if (d < C.neutrophil.standoff) want += Math.PI / 2 * (r() < 0.5 ? 1 : -1);
        } else want = Math.atan2(WIDTH * 0.55 - n.v, L * 0.45 - n.u) + (r() - 0.5) * 2;
        n.head = r() < C.neutrophil.stray ? r() * 6.283 : want + C.neutrophil.zigzag * (r() * 2 - 1);
      }
      const sp = C.neutrophil.speed * slow * (n.boosted ? C.support.speedMul : 1) * (this.puddles.length ? this.puddleMul(n.u, n.v) : 1);
      n.vu += (Math.cos(n.head) * sp - n.vu) * Math.min(1, dt * 6);
      n.vv += (Math.sin(n.head) * sp - n.vv) * Math.min(1, dt * 6);
      n.u = Math.max(8, Math.min(L - 8, n.u + n.vu * dt));
      n.v = Math.max(VESSEL * 0.3, Math.min(WIDTH - 8, n.v + n.vv * dt));
      if (n.v < VESSEL && n.vv < 0) n.vv *= -0.5;
      n.cd -= dt;
      if (n.cd <= 0) {
        const can = n.boosted ? null : b => !b.armored;
        const aim = this.nearestTarget(n.u, n.v, C.neutrophil.range, can) || this.nearestTarget(n.u, n.v, C.neutrophil.range);
        if (aim) {
          n.cd = C.neutrophil.fireEvery;
          const d = Math.hypot(aim.u - n.u, aim.v - n.v), tt = d / C.neutrophil.shotSpeed;
          const au = aim.u + (aim.kind ? C.bacteria.drift * tt : 0), av = aim.v;
          const a = Math.atan2(av - n.v, au - n.u) + (r() - 0.5) * 2 * (C.neutrophil.spread + (tier >= 2 ? F.feverSpread : 0));
          this.shots.push({ u: n.u, v: n.v, pu: n.u, pv: n.v, du: Math.cos(a), dv: Math.sin(a), life: C.neutrophil.range * 1.4 / C.neutrophil.shotSpeed, tuned: n.boosted, from: n.id });
        } else n.cd = 0.05;
      }
    }
  }

  // Net neutrophils run for the thickest crowd of small enemies, then burst
  stepRunners(dt, slow) {
    const C = CONFIG, r = this.rand, D = this.dev;
    let smalls = null;
    for (const n of this.runners) {
      if (n.dead) continue;
      n.age += dt; n.retarget -= dt;
      if (n.retarget <= 0) {
        n.retarget = 0.8;
        smalls = smalls || this.bact.filter(b => !b.dead && !b.eaten && !b.shield && KINDS[b.kind].small);
        let best = null, bn = 0;
        const R2 = C.net.radius * C.net.radius;
        for (let i = 0; i < Math.min(24, smalls.length); i++) {
          const c = smalls[Math.floor(r() * smalls.length)];
          let k = 0; for (const o of smalls) if ((o.u - c.u) ** 2 + (o.v - c.v) ** 2 < R2) k++;
          k -= Math.hypot(c.u - n.u, c.v - n.v) / 200; // prefer closer crowds a little
          if (k > bn) { bn = k; best = c; }
        }
        if (best) { n.tu = best.u; n.tv = best.v; } else { n.tu = L * 0.4; n.tv = WIDTH * 0.55; }
        n.hasTarget = !!best;
      }
      const du = n.tu - n.u, dv = n.tv - n.v, d = Math.hypot(du, dv);
      const sp = C.net.speed * slow * (this.puddles.length ? this.puddleMul(n.u, n.v) : 1);
      if (d > 1) { const s = Math.min(d, sp * dt); n.u += du / d * s; n.v += dv / d * s; }
      if ((n.hasTarget && d < 8) || (!D.immortal && n.age >= C.net.fuse) || (D.immortal && n.hasTarget && n.age >= C.net.fuse)) {
        n.dead = true;
        this.webs.push({ u: n.u, v: n.v, r: C.net.radius, life: C.net.linger, max: C.net.linger });
        this.netSweep(n.u, n.v, C.net.radius);
        this.fx.push({ k: 'netBurst', u: n.u, v: n.v });
      }
    }
    for (const w of this.webs) { w.life -= dt; this.netSweep(w.u, w.v, w.r * (0.6 + 0.4 * Math.max(0, w.life) / w.max)); }
  }
  netSweep(u, v, rad) {
    const r2 = rad * rad;
    for (const b of this.bact) if (!b.dead && !b.eaten && !b.shield && KINDS[b.kind].small && (b.u - u) ** 2 + (b.v - v) ** 2 < r2) this.kill(b, 'net');
  }

  // NK cells hunt infected neutrophils first, then free virus particles
  stepNK(dt, slow) {
    const C = CONFIG, D = this.dev;
    for (const k of this.nk) {
      if (k.dead) continue;
      k.age += dt; k.cd = Math.max(0, k.cd - dt);
      if (!D.immortal && k.age >= C.nk.life) { this.loseCell(k, 'age', 'nk'); continue; }
      let prey = null, pd = Infinity;
      for (const n of this.neut) if (!n.dead && n.infected > 0) { const d = Math.hypot(n.u - k.u, n.v - k.v); if (d < pd) { pd = d; prey = n; } }
      if (!prey) { const b = this.nearestBact(k.u, k.v, 400, b => KINDS[b.kind].virus && !b.shield); if (b) { prey = b; pd = Math.hypot(b.u - k.u, b.v - k.v); } }
      let tu, tv;
      if (prey) { tu = prey.u; tv = prey.v; }
      else { k.wander += (this.rand() - 0.5) * dt * 2; tu = k.u + Math.cos(k.wander) * 30; tv = k.v + Math.sin(k.wander) * 30; if (k.v < VESSEL + 20) k.wander = Math.PI / 2; }
      const du = tu - k.u, dv = tv - k.v, d = Math.hypot(du, dv), sp = C.nk.speed * slow * (this.puddles.length ? this.puddleMul(k.u, k.v) : 1);
      if (d > 1) { const s = Math.min(d, sp * dt); k.u = Math.max(8, Math.min(L - 8, k.u + du / d * s)); k.v = Math.max(VESSEL * 0.4, Math.min(WIDTH - 8, k.v + dv / d * s)); }
      if (prey && pd < C.nk.reach && k.cd <= 0) {
        k.cd = C.nk.killEvery;
        if (prey.kind) this.kill(prey, 'nk');
        else { prey.dead = true; prey.infected = 0; this.stats.nkKills++; this.stats.byKind.infected = (this.stats.byKind.infected || 0) + 1; this.fx.push({ k: 'nkPop', u: prey.u, v: prey.v }); }
      }
    }
  }

  // Shots: straight tracers; the first thing touched takes the hit. Domes swallow shots.
  stepShots(dt) {
    const C = CONFIG;
    for (const s of this.shots) {
      s.pu = s.u; s.pv = s.v;
      const step = C.neutrophil.shotSpeed * dt;
      s.u += s.du * step; s.v += s.dv * step; s.life -= dt;
      for (const d of this.domes) {
        const inNow = (s.u - d.u) ** 2 + (s.v - d.v) ** 2 < d.r * d.r, inBefore = (s.pu - d.u) ** 2 + (s.pv - d.v) ** 2 < d.r * d.r;
        if (inNow && !inBefore) { s.life = 0; this.fx.push({ k: 'absorb', u: s.u, v: s.v }); break; }
      }
      if (s.life <= 0) continue;
      const hitTest = (x, y, rad) => {
        const wu = x - s.pu, wv = y - s.pv, proj = Math.max(0, Math.min(step, wu * s.du + wv * s.dv));
        const cu = s.pu + s.du * proj, cv = s.pv + s.dv * proj;
        return (x - cu) ** 2 + (y - cv) ** 2 <= rad * rad ? [cu, cv] : null;
      };
      let done = false;
      for (const b of this.bact) {
        if (b.dead || b.eaten || b.shield || b.kind === 'spore') continue;
        const k = KINDS[b.kind], at = hitTest(b.u, b.v, b.kind === 'worm' && b.head ? 12 : k.hit);
        if (!at) continue;
        s.life = 0; done = true;
        if (k.shot === 'boss') {
          b.hp -= s.tuned ? C.tapeworm.tunedDmg : 1; b.flash = 0.12;
          if (b.hp <= 0) this.kill(b, s.tuned ? 'tuned' : 'shot'); else this.fx.push({ k: 'hit', u: at[0], v: at[1] });
        } else if (s.tuned) this.kill(b, 'tuned');
        else if (k.shot === 'armor') { this.stats.bounced++; this.fx.push({ k: 'bounce', u: at[0], v: at[1], du: -s.du, dv: -s.dv }); }
        else {
          b.hp--; b.flash = 0.12;
          if (!b.lead && !b.settled) { b.u += s.du * C.bacteria.knock; b.v += s.dv * C.bacteria.knock; }
          if (b.hp <= 0) this.kill(b, 'shot'); else this.fx.push({ k: 'hit', u: at[0], v: at[1] });
        }
        break;
      }
      if (done) continue;
      for (const m of this.mac) {
        if (m.dead || !m.infected || !hitTest(m.u, m.v, 9)) continue;
        s.life = 0;
        m.infected.hp -= s.tuned ? 3 : 1;
        this.fx.push({ k: 'hit', u: m.u, v: m.v });
        if (m.infected.hp <= 0) this.loseCell(m, 'tb', 'mac');
        break;
      }
    }
  }

  // Enemies: drift with the flow, spill on crowding, divide while there is room, plus each kind's trick
  stepEnemies(dt) {
    const C = CONFIG, r = this.rand, t = this.t, D = this.dev;
    const counts = [0, 0, 0];
    for (const b of this.bact) if (!b.dead && !b.eaten) counts[zoneOf(b.u)]++;
    const live = counts[0] + counts[1] + counts[2];
    // Spatial grid for the neighbour checks
    const grid = new Map();
    for (const b of this.bact) {
      if (b.dead || b.eaten) continue;
      const key = ((b.u / GRID) | 0) * 1000 + ((b.v / GRID) | 0);
      let cell = grid.get(key); if (!cell) grid.set(key, cell = []); cell.push(b);
    }
    const cr = C.bacteria.crowdRadius, cr2 = cr * cr;
    const born = [];
    for (const b of this.bact) {
      if (b.dead || b.eaten) continue;
      b.flash = Math.max(0, b.flash - dt);
      b.spitT = Math.max(0, b.spitT - dt);
      b.life += dt;
      const z = zoneOf(b.u), pool = z === 2 && b.u > POOL_U;
      // Spores: inert, then hatch together
      if (b.kind === 'spore' && t >= b.hatchAt) {
        b.kind = 'clos'; b.hp = b.maxHp = C.spore.hp; b.age = 0; b.div = this.divTime('clos');
        this.fx.push({ k: 'hatch', u: b.u, v: b.v });
      }
      // Chains (Strep, Tapeworm): links follow the one ahead; a dead or eaten lead frees the rest as a new chain
      if (b.lead && (b.lead.dead || b.lead.eaten)) { b.lead = null; b.head = true; }
      if ((b.kind === 'strep' || b.kind === 'worm') && !(b.kind === 'strep' && pool)) {
        const sp = b.kind === 'strep' ? C.strep.spacing : C.tapeworm.spacing;
        if (b.lead) {
          const du = b.lead.u - b.u, dv = b.lead.v - b.v, d = Math.hypot(du, dv);
          if (d > sp) { b.u += du / d * (d - sp); b.v += dv / d * (d - sp); }
          if (d > 0.01) b.rot = Math.atan2(dv, du);
        } else {
          const speed = b.kind === 'strep' ? C.strep.speed : C.tapeworm.speed;
          const stopAt = b.kind === 'worm' ? L - 150 : L;
          const wig = Math.sin(t * (b.kind === 'strep' ? 3 : 1.2) + b.id) * (b.kind === 'strep' ? 26 : 14);
          const toward = ((WIDTH + VESSEL) / 2 - b.v) * 0.15;
          if (b.u < stopAt) b.u += speed * dt;
          b.v += (wig + toward) * dt;
          b.rot = Math.atan2(wig + toward, speed);
        }
        b.u = Math.max(6, Math.min(L - 10, b.u)); b.v = Math.max(VESSEL + 8, Math.min(WIDTH - 8, b.v));
        continue;
      }
      if (b.kind === 'strep' && pool && b.lead) { b.lead = null; b.head = true; }
      // Pseudomonas settles and grows a dome
      if (b.kind === 'pseudo' && !b.settled && b.life >= C.pseudo.settleAfter && z < 2) {
        const d = this.domeAt(b.u, b.v);
        if (d) b.settled = d;
        else { const nd = { id: this.id++, u: b.u, v: b.v, r: 6, hp: C.pseudo.domeHp, maxHp: C.pseudo.domeHp }; this.domes.push(nd); b.settled = nd; this.fx.push({ k: 'dome', u: b.u, v: b.v }); }
      }
      // Flow
      let drift = C.bacteria.drift + C.bacteria.crowdDrift * Math.max(0, counts[z] - C.bacteria.crowdStart);
      if (b.kind === 'flu') drift = C.flu.speed;
      else if (b.kind === 'wormlet') drift = C.tapeworm.smallSpeed;
      else if (b.kind === 'tb') drift *= C.tb.drift;
      else if (b.kind === 'spore') drift *= C.spore.drift;
      else if (b.kind === 'herpes') drift *= 1.2;
      if (b.settled && b.kind === 'pseudo') drift = 0;
      else if (b.shield) drift *= C.pseudo.domeDrift;
      if (pool) drift = (L - 130 - b.u) * 0.3;
      // Flu splits when it reaches the Tissue
      if (b.kind === 'flu' && !b.split && b.u >= ZONE) {
        b.split = true;
        for (let i = 1; i < C.flu.splitInto; i++) born.push(['flu', b.u + (r() - 0.5) * 8, b.v + (r() - 0.5) * 8, { split: true }]);
        this.fx.push({ k: 'split', u: b.u, v: b.v });
      }
      // Neighbours: separation push and the room check
      let near = 0, pu = 0, pv = 0;
      const gu = (b.u / GRID) | 0, gv = (b.v / GRID) | 0;
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
        const cell = grid.get((gu + a) * 1000 + gv + c); if (!cell) continue;
        for (const o of cell) {
          if (o === b || o.dead || o.eaten) continue;
          const du = b.u - o.u, dv = b.v - o.v, d2 = du * du + dv * dv;
          if (d2 < cr2) { near++; if (d2 > 0.01) { const d = Math.sqrt(d2); pu += du / d * (1 - d / cr); pv += dv / d * (1 - d / cr); } }
        }
      }
      const jumpy = b.kind === 'flu' || b.kind === 'herpes';
      b.u += (drift + pu * 14) * dt;
      b.v += (pv * (pool ? 30 : 14) + (pool ? ((WIDTH + VESSEL) / 2 - b.v) * 0.12 : 0) + Math.sin(t * (jumpy ? 2.3 : 0.7) + b.id) * (pool ? 8 : jumpy ? 12 : 3)) * dt;
      if (pool) b.u += pu * 16 * dt;
      b.u = Math.max(6, Math.min(L - 10, b.u));
      b.v = Math.max(VESSEL + 8, Math.min(WIDTH - 8, b.v));
      b.rot += dt * 0.3;
      // Herpes: hitch a ride inside a neutrophil
      if (b.kind === 'herpes') {
        for (const n of this.neut) {
          if (n.dead || n.infected > 0 || (n.u - b.u) ** 2 + (n.v - b.v) ** 2 > 64) continue;
          n.infected = C.herpes.burstAfter; b.dead = true; this.fx.push({ k: 'infectN', u: n.u, v: n.v });
          break;
        }
        if (b.dead) continue;
      }
      // Division
      if (!D.noDivision && b.div < Infinity && live + born.length < this.bactCap() && near < C.bacteria.crowdMax) {
        b.age += dt;
        if (b.age >= b.div) {
          b.age = 0; b.div = this.divTime(b.kind);
          const a = r() * 6.283;
          born.push([b.kind, b.u + Math.cos(a) * 5, b.v + Math.sin(a) * 5, b.kind === 'pseudo' && b.settled ? { settled: b.settled } : null]);
          b.u -= Math.cos(a) * 3; b.v -= Math.sin(a) * 3;
          b.hp = b.maxHp;
        }
      }
    }
    for (const nb of born) { if (this.spawnEnemy(nb[0], nb[1], nb[2], nb[3])) this.fx.push({ k: 'divide', u: nb[1], v: nb[2] }); }
  }

  finish(win, reason, why) {
    const st = this.stats;
    const goals = [
      { text: 'Clear every enemy', hit: win },
      { text: 'Lymph node timer never passed half', hit: win && this.lymph.peak <= 0.5 },
      { text: 'No enemy reached the Lymph node', hit: win && !this.lymph.reached },
    ];
    this.result = { win, reason, why: why || null, t: this.t, goals, stars: goals.filter(g => g.hit).length, stats: { ...st }, peakTimer: this.lymph.peak, fatiguePeak: this.fatiguePeak, toxPeak: this.toxPeak, toxPinned: this.toxPinned, tierTime: this.tierTime.slice() };
  }
}

if (typeof module !== 'undefined') module.exports = { Game, DEFAULTS, CONFIG, LEVELS, HINTS, KINDS, SPAWNABLE, FRIENDLY, defaultDev, groupSize, mergeConfig, mulberry32, zoneOf, L, WIDTH, ZONE, VESSEL, WOUND, ZONES };

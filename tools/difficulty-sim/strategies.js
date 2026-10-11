'use strict';
// Difficulty simulator: the strategy space. Everything here only presses the buttons a player has (per-sector
// Response mix, Offense/Support, sectors On/Off, Stress, Cytokine storm); nothing places units.
// Needs the game's sim.js and bots.js loaded as globals first (see run.js).

// ---- reactive strategies: v3's own good-play bot (bots.js makeStrategy) with its habits varied ----
// look = how often it looks at the game (s); the rest are bots.js GOOD keys. Ranges are on the V28+ x3 unit scale.
const SPACE = [
  { key: 'look', steps: [0.5, 1, 1.5, 2, 3, 5] },
  { key: 'macs', min: 0, max: 54, int: true },
  { key: 'macShare', min: 0.2, max: 0.8 },
  { key: 'style', steps: ['react', 'support', 'offense'] },
  { key: 'counters', bool: true },
  { key: 'crowd', min: 30, max: 360, int: true },
  { key: 'base', min: 0, max: 1 },
  { key: 'push', min: 0, max: 1 },
  { key: 'restAt', min: 20, max: 100, int: true },
  { key: 'storm', bool: true },
  { key: 'stormAt', min: 300, max: 900, int: true },
  { key: 'sectors', steps: ['all', 'shift', 'noLymph', 'front2'] },
];
// Sector habits: all on; switch off empty sectors (bots.js shifter); never use the Lymph node; Wound + Tissue only
const SECTORS = {
  all: null,
  shift: g => {
    const s = scan(g), busy = s.map(q => q.n + q.hyph > 0);
    if (busy.some(b => b)) { busy.forEach((b, z) => { if (b) g.setZoneOn(z, true); }); busy.forEach((b, z) => { if (!b) g.setZoneOn(z, false); }); }
    else for (let z = 0; z < g.zones.length; z++) g.setZoneOn(z, true);
  },
  noLymph: g => { g.setZoneOn(LYMPH, false); },
  front2: g => { for (let z = 2; z < g.zones.length; z++) g.setZoneOn(z, false); },
};

// Latin hypercube over SPACE: n strategies spread evenly over every range (same n gives the same list)
function sampleReactive(n, salt) {
  const rnd = mulberry32(7331 + n * 31 + (salt || 0));
  const cols = SPACE.map(() => {
    const a = []; for (let i = 0; i < n; i++) a.push((i + rnd()) / n);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = {};
    SPACE.forEach((d, k) => {
      const x = cols[k][i];
      p[d.key] = d.bool ? x < 0.5 : d.steps ? d.steps[Math.min(d.steps.length - 1, Math.floor(x * d.steps.length))]
        : d.int ? Math.round(d.min + x * (d.max - d.min)) : +(d.min + x * (d.max - d.min)).toFixed(3);
    });
    out.push(p);
  }
  return out;
}
function reactivePolicy(p) {
  const { sectors, ...habits } = p;
  const f = makeStrategy(habits), sec = SECTORS[sectors || 'all'];
  let tick = 0;
  const lookEvery = Math.max(1, Math.round((p.look || 0.5) / 0.5));
  return g => { f(g); if (sec && tick++ % lookEvery === 0) sec(g); };
}

// ---- set-and-forget: one setup chosen at the start, never touched again ----
// mix: the Response for every sector; stance: Offense/Support per sector (Wound, Tissue, Deep tissue, Lymph node);
// sectors: which are on; stress: the slider (0..1)
const MIXES = {
  gunners: u => ({ neut: 1 }),
  balanced: u => ({ neut: 0.6, mac: 0.4 }),
  macs: u => ({ neut: 0.3, mac: 0.7 }),
  counter: u => { const m = { neut: 0.5, mac: 0.2 }; const sp = u.filter(x => x !== 'neut' && x !== 'mac'); for (const x of sp) m[x] = 0.3 / sp.length; return m; },
  even: u => Object.fromEntries(u.map(x => [x, 1 / u.length])),
};
const STANCES = { offense: 'OOOO', support: 'SSSS', frontO: 'OOSS', frontS: 'SSOO' };
const SECTOR_SETS = { all: [1, 1, 1, 1], front2: [1, 1, 0, 0], noLymph: [1, 1, 1, 0], wound: [1, 0, 0, 0], middle: [0, 1, 1, 0] };
// Stress slider positions: 0 = the 25% floor (Alex: "set stress to 25% and chill"), 0.5 = 71%, 0.85 = 146%
const STRESS = [0.5, 0, 0.85];
function staticSetups(units) {
  const out = [], seen = new Set();
  for (const mix in MIXES) for (const stance in STANCES) for (const sectors in SECTOR_SETS) {
    const m = MIXES[mix](units); for (const k in m) if (!units.includes(k)) delete m[k];
    const sig = JSON.stringify([m, stance, sectors]);
    if (seen.has(sig)) continue; // e.g. "counter" on a level with no special cells
    seen.add(sig);
    out.push({ mix, stance, sectors, stress: 0.5 });
  }
  return out;
}
function staticPolicy(s) {
  let done = false;
  return g => {
    if (done) return;
    done = true;
    const m = MIXES[s.mix](g.units); for (const k in m) if (!g.units.includes(k)) delete m[k];
    const on = SECTOR_SETS[s.sectors], st = STANCES[s.stance];
    for (let z = 0; z < g.zones.length; z++) { g.setMix(z, m); g.setZone(z, st[z] === 'S' ? 'support' : 'offense'); }
    for (let z = 0; z < g.zones.length; z++) if (on[z]) g.setZoneOn(z, true);
    for (let z = 0; z < g.zones.length; z++) if (!on[z]) g.setZoneOn(z, false);
    g.setOutput(s.stress);
  };
}
// Neighbours of a set-and-forget setup (one choice changed), for the exploit hunt's second round
function staticNeighbours(s) {
  const out = [];
  for (const mix in MIXES) if (mix !== s.mix) out.push({ ...s, mix });
  for (const stance in STANCES) if (stance !== s.stance) out.push({ ...s, stance });
  for (const sectors in SECTOR_SETS) if (sectors !== s.sectors) out.push({ ...s, sectors });
  for (const stress of STRESS) if (stress !== s.stress) out.push({ ...s, stress });
  return out;
}
const staticKey = s => `${s.mix}/${s.stance}/${s.sectors}/${s.stress}`;
const STATIC_NAMES = {
  mix: { gunners: 'gunners only', balanced: '60/40 neutrophils/macrophages', macs: '30/70 neutrophils/macrophages', counter: 'counter-heavy', even: 'even split' },
  stance: { offense: 'all Offense', support: 'all Support', frontO: 'front Offense, back Support', frontS: 'front Support, back Offense' },
  sectors: { all: 'every sector', front2: 'Wound + Tissue only', noLymph: 'Lymph node off', wound: 'Wound only', middle: 'Tissue + Deep tissue only' },
};
const stressPct = x => { const O = CONFIG.output; return Math.round(O.min * Math.pow(O.max / O.min, x) * 100); };
const describeStatic = s => `${STATIC_NAMES.sectors[s.sectors]}, ${STATIC_NAMES.mix[s.mix]}, ${STATIC_NAMES.stance[s.stance]}, stress ${stressPct(s.stress)}%`;

module.exports = { SPACE, SECTORS, sampleReactive, reactivePolicy, MIXES, STANCES, SECTOR_SETS, staticSetups, staticPolicy, staticNeighbours, staticKey, describeStatic };

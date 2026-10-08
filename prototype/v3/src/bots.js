'use strict';
// ---------------------------------------------------------------------------
// Bot players for v3 balance runs. Shared by src/headless.js (node) and the
// difficulty tuner. Bots only press the buttons a player has (zone mixes,
// Offense/Support, body output, storm); the levels never react to how they
// are doing (no rubber banding).
// ---------------------------------------------------------------------------
const BOT_LEVELS = JSON.parse(JSON.stringify(LEVELS)); // the live game's scripts

// What is in each zone right now
function scan(g) {
  const z = [0, 1, 2].map(() => ({ n: 0, mrsa: 0, tb: 0, flu: 0, worm: 0, strep: 0, virus: 0, pseudo: 0, infected: 0, domes: 0, hyph: 0 }));
  for (const a of g.ag) {
    if (a.dead || a.eaten) continue;
    const s = z[zoneOf(a.u)];
    s.n++;
    if (a.k in s) s[a.k]++;
    if (a.k === 'wormlet') s.worm++;
  }
  for (const c of g.cells) if (c.infected || c.tb) z[zoneOf(c.u)].infected++;
  for (const d of g.domes) z[zoneOf(d.u)].domes++;
  for (const h of g.hyphae || []) if (!h.wither) z[zoneOf(h.u)].hyph++;
  return z;
}
const soonWave = (g, s) => g.markers().some(m => (m.kind === 'wave' || m.kind === 'hatch') && m.t > g.t && m.t - g.t < s);

// A zone mix: macrophages until there are `macs` of them, the level's special cell where it counters
// something, the rest neutrophils
function counterMix(g, z, s, p) {
  const mix = { neut: 1 };
  const macs = g.count('mac');
  if (g.units.includes('mac') && macs < p.macs) mix.mac = p.macShare;
  if (p.counters) {
    if (g.units.includes('net') && (s[z].flu > 5 || s[z].hyph > 0 || s[z].n > p.netAt || (z < 2 && s[z + 1] && s[z + 1].flu > 5))) mix.net = p.net;
    if (g.units.includes('nk') && (s[z].infected > 0 || s[z].virus > 0 || s.some(q => q.virus > 3))) mix.nk = p.nk;
  } else {
    // no reading of the map: a fixed even sprinkle of everything
    for (const u of g.units) if (u !== 'neut' && u !== 'mac') mix[u] = p.net * 0.5;
  }
  g.setMix(z, mix);
}
// Offense or Support for a zone
function zoneMode(g, z, s, p) {
  const q = s[z];
  const must = q.mrsa > 0 || q.worm > 0 || (q.tb > 0 && p.counters);
  const crowded = q.n > p.crowd;
  let sup;
  if (p.style === 'support') sup = z > 0 || must || crowded;          // rings in Tissue and Lymph node all game
  else if (p.style === 'offense') sup = q.mrsa > 0 && p.counters;      // swallow everything; Support only for MRSA
  else sup = (p.counters && must) || crowded;                          // react to what shows up
  if ((q.domes > 0 || q.hyph > 3) && p.counters && q.mrsa === 0) sup = false;                          // offense tears domes down
  g.setZone(z, sup ? 'support' : 'offense');
}
function outputFor(g, p) {
  if (g.storm.after > 0) return 0;                                    // halve the afterburn
  if (g.fatigue > p.restAt) return Math.min(p.base, 0.15);
  return soonWave(g, 15) || g.ag.length > 60 ? p.push : p.base;
}
function maybeStorm(g, p) {
  if (!p.storm || g.stormActive()) return;
  const panic = g.lymph.timer > 0.45 || g.ag.length > p.stormAt;
  if (panic && g.stormForecast() < 92) g.useStorm();
}

// Every policy is called every 0.5 s of game time. `every` makes a bot look less often.
const every = (n, fn) => g => { if ((g.botTick = (g.botTick || 0) + 1) % n === 0) fn(g); };
function play(p) {
  return every(Math.max(1, Math.round(p.look / 0.5)), g => {
    const s = scan(g);
    for (let z = 0; z < 3; z++) { counterMix(g, z, s, p); zoneMode(g, z, s, p); }
    g.setOutput(outputFor(g, p));
    maybeStorm(g, p);
  });
}
function funnel(keep) { const f = play(GOOD); return g => { f(g); g.setZoneOn(keep, true); for (let z = 0; z < 3; z++) if (z !== keep) g.setZoneOn(z, false); }; }
const GOOD = { look: 0.5, macs: 14, macShare: 0.5, counters: true, net: 0.35, netAt: 25, nk: 0.35, crowd: 40, style: 'react', base: 0.5, push: 0.85, restAt: 45, storm: true, stormAt: 220 };

function randomPress(g) {
  const x = g.rand2(), z = Math.floor(g.rand2() * 3), u = g.units[Math.floor(g.rand2() * g.units.length)];
  if (x < 0.25) g.toggleZone(z);
  else if (x < 0.35) g.toggleZoneOn(z);
  else if (x < 0.55) g.setShare(z, u, g.rand2());
  else if (x < 0.7) g.allIn(z, u);
  else if (x < 0.95) g.setOutput(g.rand2());
  else g.useStorm();
}

const POLICIES = {
  idle: () => {},
  // Random button mashing: every half second, maybe press something (storm included)
  random: g => { if (g.rand2() < 0.5) randomPress(g); },
  // The same mashing with the storm button never pressed
  randomCalm: g => { if (g.rand2() < 0.5) { const s = g.useStorm; g.useStorm = () => false; randomPress(g); g.useStorm = s; } },
  // Plays well but fires the storm every time it can
  stormSpam: (() => { const f = play(GOOD); return g => { f(g); if (!g.stormActive()) g.useStorm(); }; })(),
  smart: play(GOOD),
  // Good play, but every cell is made for one zone (the other two switched off)
  funnelWound: funnel(0), funnelTissue: funnel(1), funnelLymph: funnel(2),
  // Good play that switches production off in empty zones and back on when something arrives
  shifter: (() => { const f = play(GOOD); return g => { f(g); const s = scan(g); const busy = s.map(q => q.n + q.hyph > 0); if (busy.some(b => b)) { busy.forEach((b, z) => { if (b) g.setZoneOn(z, true); }); busy.forEach((b, z) => { if (!b) g.setZoneOn(z, false); }); } else for (let z = 0; z < 3; z++) g.setZoneOn(z, true); }; })(),
  // Two distinct winning styles the roster asks for
  supportHeavy: play({ ...GOOD, style: 'support', macs: 18, macShare: 0.6 }),
  offenseHeavy: play({ ...GOOD, style: 'offense', macs: 18, macShare: 0.8, crowd: 999 }),
  // Gunners only: never makes macrophages
  gunner: play({ ...GOOD, macs: 0 }),
  // Skill ladder between mashing and good play
  beginner: every(6, (() => { const f = play({ ...GOOD, counters: false, base: 0.5, push: 0.5, storm: false }); return g => { if (g.rand2() < 0.35) randomPress(g); else f(g); }; })()),
  casual: every(3, (() => { const f = play({ ...GOOD, base: 0.5, push: 0.5, storm: false }); return g => { if (g.rand2() < 0.1) randomPress(g); else f(g); }; })()),
};

const SKILLS = [
  { key: 'idle', name: 'Does nothing', about: 'Never touches a control. The floor.' },
  { key: 'random', name: 'Button masher', about: 'Presses a random control about once a second, storm included.' },
  { key: 'beginner', name: 'Beginner', about: 'Looks every 3 s. One look in three is a random press. Ignores what the antigens are.' },
  { key: 'casual', name: 'Casual', about: 'Looks every 1.5 s. Counters what shows up, leaves body output in the middle.' },
  { key: 'smart', name: 'Good player', about: 'Looks every 0.5 s. Counters each antigen, paces body output, storms only in a pinch.' },
];
const STYLES = [
  { key: 'supportHeavy', name: 'Support-heavy', about: 'Max macrophages, Tissue and Lymph node on Support all game.' },
  { key: 'offenseHeavy', name: 'Offense-heavy', about: 'Max macrophages, everything on Offense except where MRSA is.' },
  { key: 'gunner', name: 'Gunners only', about: 'Never makes macrophages; neutrophils plus the level\'s special cell.' },
  { key: 'stormSpam', name: 'Storm spammer', about: 'Plays well but fires the storm every time it can. Should lose.' },
];

// A family of strategies a player could follow, as ranges of inputs (for the tuner's explorer)
const STRATEGY = [
  { key: 'look', name: 'Looks at the game every', unit: 's', min: 0.5, max: 3, steps: [0.5, 1, 1.5, 2, 3] },
  { key: 'macs', name: 'Macrophages kept on the field', min: 0, max: 18, int: true },
  { key: 'style', name: 'Macrophage style', steps: ['react', 'support', 'offense'] },
  { key: 'counters', name: 'Makes the counter cell for what shows up', bool: true },
  { key: 'crowd', name: 'Switches a zone to Support above this many antigens', min: 10, max: 120, int: true },
  { key: 'base', name: 'Body output most of the time', slider: true, min: 0, max: 1 },
  { key: 'push', name: 'Body output before a wave or when swamped', slider: true, min: 0, max: 1 },
  { key: 'restAt', name: 'Turns output right down at fatigue', min: 20, max: 100, int: true },
  { key: 'storm', name: 'Storms when the Lymph node is in trouble', bool: true },
];
function makeStrategy(p) { return play({ ...GOOD, ...p }); }
function sampleStrategies(n) {
  const rnd = mulberry32(4242 + n);
  const cols = STRATEGY.map(() => { const a = []; for (let i = 0; i < n; i++) a.push((i + rnd()) / n); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = {};
    STRATEGY.forEach((d, k) => {
      const x = cols[k][i];
      p[d.key] = d.bool ? x < 0.5 : d.steps ? d.steps[Math.min(d.steps.length - 1, Math.floor(x * d.steps.length))] : d.int ? Math.round(d.min + x * (d.max - d.min)) : +(d.min + x * (d.max - d.min)).toFixed(3);
    });
    out.push(p);
  }
  return out;
}

// Put a settings bundle in place: {tune: {group: {key: n}}, levels: {key: {waves, toxins, stream, duration}}, pressure: {key: x}}
function applySettings(s) {
  for (const g in DEFAULTS) Object.assign(CONFIG[g], DEFAULTS[g]);
  s = s || {};
  mergeConfig(s.tune);
  for (const k in BOT_LEVELS) {
    const base = JSON.parse(JSON.stringify(BOT_LEVELS[k])), over = s.levels && s.levels[k];
    if (over) for (const f of ['waves', 'toxins', 'stream', 'duration']) if (over[f] != null) base[f] = JSON.parse(JSON.stringify(over[f]));
    // pressure: one number per level that scales every wave and the trickle (1 = as written)
    const f = s.pressure && s.pressure[k];
    if (f && f !== 1) {
      for (const w of base.waves) for (const x in KINDS) if (w[x] && x !== 'worm') w[x] = Math.max(1, Math.round(w[x] * f));
      base.stream.start *= f; base.stream.end *= f;
    }
    base.waves.sort((a, b) => a.t - b.t);
    Object.assign(LEVELS[k], base);
  }
}

// One bot match that can be advanced in slices (so a page can stay responsive)
function startMatch(level, policy, seed, params) {
  const g = new Game(level, seed);
  g.rand2 = (() => { let a = seed * 7919 + 3; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const fn = params ? makeStrategy(params) : POLICIES[policy];
  // The storm has to be charged (held) before it fires, so a bot's storm lands CONFIG.storm.charge seconds after it asks
  const fire = g.useStorm.bind(g); let chargeAt = -1;
  g.useStorm = () => { if (g.result || g.stormActive() || chargeAt >= 0) return false; chargeAt = g.t + (CONFIG.storm.charge || 0); return true; };
  let maxA = 0;
  const limit = g.duration + 240;
  return {
    game: g,
    advance(steps) {
      for (let i = 0; i < steps; i++) {
        if (g.result || g.t >= limit) return this.summary();
        if (chargeAt >= 0 && g.t >= chargeAt) { chargeAt = -1; fire(); }
        if (Math.round(g.t * 60) % 30 === 0) fn(g);
        g.step(1 / 60);
        g.fx.length = 0;
        if (g.ag.length > maxA) maxA = g.ag.length;
      }
      return g.result || g.t >= limit ? this.summary() : null;
    },
    summary() {
      const r = g.result || { win: false, stars: 0, t: g.t, reason: 'timeout', cause: 'timeout', stats: g.stats, peakTimer: g.lymph.peak };
      return {
        level, policy, seed, params, win: !!r.win, stars: r.stars || 0, t: r.t, reason: r.reason, cause: r.cause,
        peakTimer: r.peakTimer || 0, fatiguePeak: g.fatiguePeak, maxAg: maxA, storms: g.stats.storms,
        curve: g.history.map(h => h.z[0] + h.z[1] + h.z[2]),
      };
    },
  };
}
function runMatch(level, policy, seed, params) { const m = startMatch(level, policy, seed, params); let s; while (!(s = m.advance(6000))); return s; }

if (typeof module !== 'undefined') module.exports = { POLICIES, SKILLS, STYLES, STRATEGY, sampleStrategies, makeStrategy, applySettings, startMatch, runMatch, BOT_LEVELS, scan };

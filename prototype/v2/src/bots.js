'use strict';
// ---------------------------------------------------------------------------
// Bot players for balance runs. Shared by src/headless.js (node) and the
// difficulty tuner page (tuner/), so both measure the same thing.
// Bots only press the same buttons a player has; the level never reacts to
// how they are doing (no rubber banding).
// ---------------------------------------------------------------------------
const BOT_LEVEL0 = JSON.parse(JSON.stringify(LEVELS.papercut)); // the live game's script

const armoredIn = (g, z) => g.bact.some(b => b.armored && !b.eaten && Math.floor(b.u / ZONE) === z);
function randomPress(g) {
  const x = g.rand2();
  if (x < 0.4) g.toggleZone(Math.floor(g.rand2() * 3));
  else if (x < 0.7) g.setMarrow(g.rand2() < 0.5 ? 'neut' : 'mac');
  else g.setOutput(g.rand2());
}
// Sensible zone and marrow choices: some macrophages, Support where armor shows up or a zone is swamped
function sensible(g) {
  g.setMarrow(g.mac.length < 14 ? 'mac' : 'neut');
  for (let z = 0; z < 3; z++) g.setZone(z, armoredIn(g, z) || g.zones[z].count > 30 ? 'support' : 'offense');
}
// Body output: up before waves and when busy, down when getting tired
function pacedOutput(g) {
  const soon = g.markers().some(m => m.kind === 'wave' && m.t - g.t < 15);
  const busy = soon || g.bact.length > 40;
  g.setOutput(g.fatigue > 45 ? 0.2 : busy && g.fatigue < 30 ? 0.85 : 0.5);
}
// Every policy is called every 0.5 s of game time. `every` makes a bot look less often.
const every = (n, fn) => g => { if ((g.botTick = (g.botTick || 0) + 1) % n === 0) fn(g); };

const POLICIES = {
  idle: () => {},
  supportAll: g => { for (let z = 0; z < 3; z++) g.setZone(z, 'support'); },
  supportWound: g => { g.setZone(0, 'support'); },
  macHeavy: g => { g.setMarrow('mac'); },
  maxOutput: g => { g.setOutput(1); },
  minOutput: g => { g.setOutput(0); },
  smart: g => { sensible(g); pacedOutput(g); },
  smartFlat: g => { sensible(g); g.setOutput(0.5); },
  smartMax: g => { sensible(g); g.setOutput(1); },
  // Random button mashing: every half second, maybe press something
  random: g => { if (g.rand2() < 0.5) randomPress(g); },
  randomSlow: g => { if (g.rand2() < 0.06) randomPress(g); },
  // Skill ladder between mashing and good play
  beginner: every(6, g => { if (g.rand2() < 0.35) randomPress(g); else { sensible(g); g.setOutput(0.5); } }),
  casual: every(3, g => { if (g.rand2() < 0.1) randomPress(g); else { sensible(g); g.setOutput(0.5); } }),
};

// The ladder the tuner shows, weakest first
const SKILLS = [
  { key: 'idle', name: 'Does nothing', about: 'Never touches a control. The floor.' },
  { key: 'random', name: 'Button masher', about: 'Presses a random control about once a second.' },
  { key: 'beginner', name: 'Beginner', about: 'Looks every 3 s. One look in three is a random press. Leaves the slider alone.' },
  { key: 'casual', name: 'Casual', about: 'Looks every 1.5 s. Sensible zones and marrow, slider left in the middle.' },
  { key: 'smart', name: 'Good player', about: 'Looks every 0.5 s. Support against armor, output up before waves, rests when tired.' },
];

// A family of strategies a player could follow, as ranges of inputs. The tuner samples
// many of them at one difficulty and reports which input ranges tend to win.
const STRATEGY = [
  { key: 'look', name: 'Looks at the game every', unit: 's', min: 0.5, max: 3, steps: [0.5, 1, 1.5, 2, 3] },
  { key: 'macs', name: 'Macrophages kept on the field', min: 0, max: 30, int: true },
  { key: 'armor', name: 'Switches a zone to Support when armor shows up', bool: true },
  { key: 'crowd', name: 'Switches a zone to Support above this many bacteria', min: 10, max: 80, int: true },
  { key: 'base', name: 'Body output most of the time', slider: true, min: 0, max: 1 },
  { key: 'push', name: 'Body output before a wave or when swamped', slider: true, min: 0, max: 1 },
  { key: 'restAt', name: 'Turns output right down at fatigue', min: 20, max: 100, int: true },
];
function makeStrategy(p) {
  const look = Math.max(1, Math.round(p.look / 0.5));
  return every(look, g => {
    g.setMarrow(g.mac.length < p.macs ? 'mac' : 'neut');
    for (let z = 0; z < 3; z++) g.setZone(z, (p.armor && armoredIn(g, z)) || g.zones[z].count > p.crowd ? 'support' : 'offense');
    const soon = g.markers().some(m => m.kind === 'wave' && m.t - g.t < 15);
    g.setOutput(g.fatigue > p.restAt ? Math.min(p.base, 0.15) : soon || g.bact.length > 40 ? p.push : p.base);
  });
}
// n strategies spread evenly over every input (Latin hypercube), the same n always gives the same set
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

// Put a settings bundle in place: {tune: {group: {key: n}}, waves: [...], toxins: [seconds]}
function applySettings(s) {
  for (const g in DEFAULTS) Object.assign(CONFIG[g], DEFAULTS[g]);
  s = s || {};
  mergeConfig(s.tune);
  const lv = LEVELS.papercut;
  lv.waves = (s.waves || BOT_LEVEL0.waves).map(w => ({ ...w })).sort((a, b) => a.t - b.t);
  lv.toxins = s.toxins ? s.toxins.map(t => t / CONFIG.level.duration) : BOT_LEVEL0.toxins.slice();
}

// One bot match that can be advanced in slices (so a page can stay responsive)
function startMatch(policy, seed, params) {
  const g = new Game('papercut', seed);
  g.rand2 = (() => { let a = seed * 7919 + 3; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const fn = params ? makeStrategy(params) : POLICIES[policy];
  let maxB = 0;
  return {
    game: g,
    // Run up to `steps` ticks. Returns a summary once the match is over, else null.
    advance(steps) {
      for (let i = 0; i < steps; i++) {
        if (g.result || g.t >= 600) return this.summary();
        if (Math.round(g.t * 60) % 30 === 0) fn(g);
        g.step(1 / 60);
        g.fx.length = 0;
        if (g.bact.length > maxB) maxB = g.bact.length;
      }
      return g.result || g.t >= 600 ? this.summary() : null;
    },
    summary() {
      const r = g.result || { win: false, stars: 0, t: g.t, reason: 'timeout', stats: g.stats, peakTimer: g.lymph.peak };
      return {
        policy, seed, params, win: !!r.win, stars: r.stars || 0, t: r.t, reason: r.reason,
        peakTimer: r.peakTimer || 0, fatiguePeak: g.fatiguePeak, maxBact: maxB,
        kills: r.stats.shotKills + r.stats.swallows, toxinDeaths: r.stats.toxinDeaths,
        // bacteria on the map every 2 s
        curve: g.history.map(h => h.z[0] + h.z[1] + h.z[2]),
      };
    },
  };
}
function runMatch(policy, seed, params) { const m = startMatch(policy, seed, params); let s; while (!(s = m.advance(6000))); return s; }

if (typeof module !== 'undefined') module.exports = { POLICIES, SKILLS, STRATEGY, sampleStrategies, makeStrategy, applySettings, startMatch, runMatch, BOT_LEVEL0 };

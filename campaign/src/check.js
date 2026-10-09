'use strict';
// Campaign bot check: v3's own bots on v3's levels, with campaign builds and treatments applied.
// Run from a copy outside /mnt/project-files:
//   V3=<copy of prototype/v3/src> node check.js <levels|all> <policies> <seeds> [build] [treatments]
// env P = pressure multiplier on waves and trickle, or 'ramp' for the campaign's own per-map pressure. build: none | third | late | full (rank 2 of everything plus every vaccine). treatments: comma list or 'all'.
// Prints wins and the Samples each match would pay (first clear).
const os = require('os'), path = require('path'), { fork } = require('child_process');
const V3 = process.env.V3 || path.join(__dirname, '../../prototype/v3/src');
Object.assign(global, require(path.join(V3, 'sim.js')));
Object.assign(global, require(path.join(V3, 'bots.js')));
const CAMPAIGN = require('./campaign.js');
const BASE = JSON.parse(JSON.stringify(CONFIG));

function buildState(name) {
  const st = CAMPAIGN.fresh();
  if (name && name[0] === '{') { Object.assign(st.upgrades, JSON.parse(name)); return st; } // e.g. '{"marrow":3}'
  if (name === 'third') for (const id of ['marrow', 'trigger', 'gulp', 'rings', 'recover', 'stamina']) st.upgrades[id] = 1;
  if (name === 'third') st.upgrades.marrow = 2;
  // about what a first run has earned by the last map (~2000 Samples): every upgrade once, the core ones twice, one vaccine
  if (name === 'late') { for (const u of CAMPAIGN.UPGRADES) st.upgrades[u.id] = 1; for (const id of ['marrow', 'trigger', 'gulp', 'stamina', 'recover']) st.upgrades[id] = 2; st.vaccines.staph = true; }
  if (name === 'full') { for (const u of CAMPAIGN.UPGRADES) st.upgrades[u.id] = 2; for (const k of new Set(Object.values(CAMPAIGN.VACCINE_OF))) st.vaccines[k] = true; }
  return st;
}
function run(level, policy, seed, buildName, treat) {
  const st = buildState(buildName);
  for (const k of LEVEL_ORDER) st.cleared[k] = true; // every specialist unlocked
  st.cleared[level] = false;
  CAMPAIGN.applyConfig(CONFIG, BASE, st, treat);
  const orig = LEVELS[level];
  LEVELS[level] = CAMPAIGN.scaleLevel(orig, process.env.P === 'ramp' ? CAMPAIGN.pressure(LEVEL_ORDER.indexOf(level), LEVEL_ORDER.length) : +process.env.P || 1);
  LEVELS[level].units = CAMPAIGN.unitsFor(CAMPAIGN.loadout(st, LEVELS, LEVEL_ORDER));
  const m = startMatch(level, policy, seed);
  LEVELS[level] = orig;
  const tr = CAMPAIGN.instrument(m.game, st, treat);
  let s; while (!(s = m.advance(6000)));
  return { level, policy, seed, build: buildName, treat, win: s.win, cause: s.cause, value: tr.value, kills: tr.kills, pay: CAMPAIGN.payout(st, level, tr, true, orig, CONFIG).total };
}
if (process.argv[2] === '--worker') {
  process.on('message', jobs => { for (const j of jobs) process.send(run(j.level, j.policy, j.seed, j.build, j.treat)); process.exit(0); });
} else {
  const levels = !process.argv[2] || process.argv[2] === 'all' ? LEVEL_ORDER : process.argv[2].split(',');
  const pols = (process.argv[3] || 'smart,random').split(','), seeds = +process.argv[4] || 2, build = process.argv[5] || 'none';
  const treats = !process.argv[6] ? ['none'] : process.argv[6] === 'all' ? CAMPAIGN.TREATMENTS.map(t => t.id) : process.argv[6].split(',');
  const jobs = [];
  for (const level of levels) for (const policy of pols) for (const treat of treats) for (let s = 1; s <= seeds; s++) jobs.push({ level, policy, seed: s, build, treat });
  const n = Math.min(os.cpus().length, jobs.length), res = []; let done = 0; const t0 = Date.now();
  for (let w = 0; w < n; w++) {
    const c = fork(__filename, ['--worker'], { env: process.env });
    c.on('message', s => res.push(s));
    c.on('exit', () => { if (++done === n) report(); });
    c.send(jobs.filter((_, i) => i % n === w));
  }
  function report() {
    const pad = (s, k) => String(s).padEnd(k);
    console.log(`build ${build}`);
    console.log(pad('level', 10) + pols.flatMap(p => treats.map(t => pad(`${p}/${t}`.slice(0, 22), 23))).join(''));
    for (const level of levels) console.log(pad(level, 10) + pols.flatMap(p => treats.map(t => {
      const r = res.filter(x => x.level === level && x.policy === p && x.treat === t), w = r.filter(x => x.win).length;
      return pad(`${w}/${r.length} pays ${Math.round(r.reduce((a, x) => a + x.pay, 0) / r.length)}`, 23);
    })).join(''));
    console.log(`(wins/seeds, mean first-clear Samples)  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, JSON.stringify(res));
  }
}

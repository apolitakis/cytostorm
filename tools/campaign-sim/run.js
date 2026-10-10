'use strict';
// Campaign strategy simulator: data collection. Plays v3's own bots on the campaign's maps with sampled upgrade
// builds, vaccines and treatments, and writes one JSON line per game (win, how close it was, Samples earned).
// Reads the frozen game release and the campaign rules read-only. Run from a copy outside /mnt/project-files:
//   V3=<copy of prototype/v3/releases/v34> CAMP=<copy of campaign/src> node run.js <plan> <out.jsonl>
// plans: builds (sampled builds, no treatment) | treat (each treatment on every map at two builds)
// Already-written jobs in out.jsonl are skipped, so a stopped run resumes.
const os = require('os'), path = require('path'), fs = require('fs'), { fork } = require('child_process');
const V3 = process.env.V3, CAMP = process.env.CAMP;
Object.assign(global, require(path.join(V3, 'sim.js')));
Object.assign(global, require(path.join(V3, 'bots.js')));
const CAMPAIGN = require(path.join(CAMP, 'campaign.js'));
// The campaign's UI fills the specialist list from the sim's unit table at boot (Campaign V13 on); do the same
if (CAMPAIGN.setUnits) CAMPAIGN.setUnits(['neut', 'net', 'nk', 'mac', ...Object.keys(global.SPECIAL || {})]);
const BASE = JSON.parse(JSON.stringify(CONFIG));
const ORIG = JSON.parse(JSON.stringify(LEVELS));
const N = LEVEL_ORDER.length;

// Vaccine kinds you could have met by map i (every map up to and including it)
function metBy(i) {
  const s = new Set();
  for (let j = 0; j <= i; j++) for (const k of CAMPAIGN.kindsIn(ORIG[LEVEL_ORDER[j]])) s.add(CAMPAIGN.VACCINE_OF[k]);
  return [...s];
}
// What's open on a first visit to map i: Clinic parts and unlocked units
const firstVisit = i => ({ ...CAMPAIGN.fresh(), cleared: Object.fromEntries(LEVEL_ORDER.slice(0, i).map(k => [k, true])) });
const clinicHas = (i, id) => CAMPAIGN.clinicOpen(firstVisit(i), LEVEL_ORDER, ORIG).some(c => c.id === id);
const unlockedBy = i => new Set(LEVEL_ORDER.slice(0, i + 1).flatMap(k => ORIG[k].units));
// A random build costing about `budget` Samples, as the shop allows at map i
function sampleBuild(i, budget, rnd) {
  const up = {}, vax = {};
  let left = budget, spent = 0;
  const kinds = clinicHas(i, 'vax') ? metBy(i) : [], un = unlockedBy(i);
  for (let tries = 0; tries < 200; tries++) {
    const opts = [];
    for (const u of CAMPAIGN.UPGRADES) { const r = up[u.id] || 0; if (r < 3 && u.cost[r] <= left && (!u.need || un.has(u.need))) opts.push(['u', u, u.cost[r]]); }
    for (const k of kinds) if (!vax[k] && CAMPAIGN.VACCINE_COST <= left) opts.push(['v', k, CAMPAIGN.VACCINE_COST]);
    if (!opts.length) break;
    const [t, x, c] = opts[Math.floor(rnd() * opts.length)];
    if (t === 'u') up[x.id] = (up[x.id] || 0) + 1; else vax[x] = true;
    left -= c; spent += c;
  }
  return { up, vax: Object.keys(vax), spent };
}
function stateFor(level, job) {
  const st = CAMPAIGN.fresh();
  const i = LEVEL_ORDER.indexOf(level);
  for (let j = 0; j < i; j++) st.cleared[LEVEL_ORDER[j]] = true; // specialists unlocked as they would be on a first visit
  Object.assign(st.upgrades, job.up);
  for (const k of job.vax) st.vaccines[k] = true;
  return st;
}
function run(job) {
  const { level, policy, seed, treat } = job, i = LEVEL_ORDER.indexOf(level);
  const st = stateFor(level, job);
  CAMPAIGN.applyConfig(CONFIG, BASE, st, treat);
  LEVELS[level] = CAMPAIGN.scaleLevel(ORIG[level], CAMPAIGN.pressure(i, N));
  LEVELS[level].units = CAMPAIGN.unitsFor(CAMPAIGN.loadout(st, LEVELS, LEVEL_ORDER, level)); // the stage's default loadout
  const units = LEVELS[level].units.slice();
  const m = startMatch(level, policy, seed);
  const lv = LEVELS[level];
  const tr = CAMPAIGN.instrument(m.game, st, treat);
  let s; while (!(s = m.advance(6000)));
  const g = m.game, budget = CAMPAIGN.budget(lv, CONFIG);
  const organs = ORGAN_KEYS.map(k => g.organs[k]);
  LEVELS[level] = ORIG[level];
  return { ...job, units, win: s.win, cause: s.cause, t: +s.t.toFixed(1), dur: lv.duration, peak: +s.peakTimer.toFixed(3), minOrgan: +Math.min(...organs).toFixed(2), organSum: +organs.reduce((a, b) => a + b, 0).toFixed(2),
    fatiguePeak: Math.round(s.fatiguePeak || 0), storms: s.storms, value: +tr.value.toFixed(1), stormKills: tr.storm, budget: +budget.toFixed(1), base: Math.round(Math.min(tr.value, budget) * CAMPAIGN.RATE) };
}

function plan(name) {
  const jobs = [];
  if (name === 'builds') {
    const per = +(process.env.PER || 24), pols = (process.env.POLS || 'smart,casual').split(',');
    for (let b = 0; b < per; b++) for (let i = 0; i < N; i++) for (const policy of pols) {
      const rnd = mulberry32(1000 * i + b + 17);
      const max = Math.min(5000, 300 + 450 * i);
      const budget = b === 0 ? 0 : Math.round((b / (per - 1)) * max * (0.85 + 0.3 * rnd()));
      const bd = i === 0 && b > per / 2 ? { up: {}, vax: [], spent: 0 } : sampleBuild(i, budget, rnd);
      jobs.push({ id: `b${b}-${LEVEL_ORDER[i]}-${policy}`, level: LEVEL_ORDER[i], policy, seed: 1 + b, treat: 'none', ...bd });
    }
  }
  if (name === 'treat') {
    const pols = (process.env.POLS || 'smart,casual').split(',');
    for (let i = 0; i < N; i++) for (const t of CAMPAIGN.TREATMENTS) for (const policy of pols) for (const s of [1, 2]) {
      if (t.id === 'none') continue;
      const rnd = mulberry32(777 + 31 * i + s);
      const bd = s === 1 ? { up: {}, vax: [], spent: 0 } : sampleBuild(i, Math.min(5000, 150 + 225 * i), rnd);
      jobs.push({ id: `t${s}-${LEVEL_ORDER[i]}-${t.id}-${policy}`, level: LEVEL_ORDER[i], policy, seed: 50 + s, treat: t.id, ...bd });
    }
  }
  return jobs;
}

if (process.argv[2] === '--list') { for (const j of plan(process.argv[3])) console.log(JSON.stringify(j)); }
else if (process.argv[2] === '--worker') {
  process.on('message', j => { if (j === 'done') process.exit(0); process.send(run(j)); });
} else {
  const out = process.argv[3];
  const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const jobs = plan(process.argv[2]).filter(j => !done.has(j.id)).slice(0, +(process.env.MAXJOBS || 1e9)); // MAXJOBS: stop after this many (run in chunks)
  console.log(`${jobs.length} games to play (${done.size} already in ${out})`);
  const n = Math.min(+(process.env.CORES || os.cpus().length), jobs.length);
  let next = 0, fin = 0; const t0 = Date.now();
  for (let w = 0; w < n; w++) {
    const c = fork(__filename, ['--worker'], { env: process.env });
    const feed = () => c.send(next < jobs.length ? jobs[next++] : 'done');
    c.on('message', r => { fs.appendFileSync(out, JSON.stringify(r) + '\n'); fin++; if (fin % 20 === 0) console.log(`${fin}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)} s`); feed(); });
    feed();
  }
}

'use strict';
// Difficulty simulator: plays bot games on single maps and writes one JSON line per game.
// Reads a frozen game release read-only. Run from a copy outside /mnt/project-files (node can fail on that cwd):
//   V3=<copy of prototype/v3/releases/v35> node run.js <plan> <out.jsonl> [levels=all]
// plans:
//   gate     fixed bots (idle, random, stormSpam, beginner, casual, smart), seeds 1-2
//   static1  set-and-forget round 1: 20 setups per level, seed 1
//   static2  set-and-forget round 2: neighbours of each level's best 2 setups, and the best 3 again on seed 2
//   sweep    reactive strategies (SWEEP_N, default 40) on seeds 1-2
//   coast    Alex's low-stress complaint: chill + coast bots (seeds 1-2) and the static1 setups at stress 25%
//   pressure the live map at other wave pressures (PRESSURES, default 0.8,1.25): gate bots, best setup, best 3 strategies
// COAST_STATIC=0 skips the stress-25% setups in the coast plan. DIFF=hard plays Hard. Jobs already in out.jsonl are skipped, so a stopped run resumes.
const os = require('os'), path = require('path'), fs = require('fs'), { fork } = require('child_process');
const V3 = process.env.V3;
if (!V3) { console.error('Set V3 to a copy of prototype/v3/releases/<version>'); process.exit(1); }
Object.assign(global, require(path.join(V3, 'sim.js')));
Object.assign(global, require(path.join(V3, 'bots.js')));
const S = require('./strategies.js');
const DIFF = process.env.DIFF || 'normal';
// Alex 2026-10-10: "too easy to set stress to 25% and chill" between waves. chill = the starting Response, stress at the
// 25% floor, nothing else; coast = good play that keeps stress at the floor between waves. From V38 the release's
// bots.js has its own chill/coast (and setForget), which win over these fallbacks so both threads measure the same bots
POLICIES.chill = POLICIES.chill || (g => { if (!g.chilled) { g.chilled = true; g.setOutput(0); } });
POLICIES.coast = POLICIES.coast || makeStrategy({ base: 0 });

// ---- one game ----
function play(job) {
  applySettings(job.pressure && job.pressure !== 1 ? { pressure: { [job.level]: job.pressure } } : null);
  setDifficulty(DIFF);
  const fn = job.kind === 'static' ? S.staticPolicy(job.setup) : job.kind === 'reactive' ? S.reactivePolicy(job.params) : POLICIES[job.policy];
  const key = `ds:${job.id}`;
  POLICIES[key] = fn;
  const m = startMatch(job.level, key, job.seed);
  delete POLICIES[key];
  const g = m.game, kills = {};
  const tick = g.tick.bind(g);
  g.tick = (k, n) => { if (k.startsWith('kill.')) { const how = k.slice(5, k.indexOf('.', 5)); kills[how] = (kills[how] || 0) + (n || 1); } tick(k, n); };
  let s; while (!(s = m.advance(6000)));
  kills.swallow = g.stats.swallows; kills.storm = g.stats.stormKills;
  const bars = ORGAN_KEYS.reduce((a, k) => a + g.organLevel(k), 0);
  // how far it got: a win scores 1 plus a little for organ bars kept; a loss scores the share of the fight survived
  const score = s.win ? 1 + bars / (ORGAN_KEYS.length * 4) / 4 : Math.min(0.95, s.t / g.duration) * 0.9;
  return {
    id: job.id, plan: job.plan, level: job.level, seed: job.seed, kind: job.kind, policy: job.policy, setup: job.setup, params: job.params, si: job.si,
    pressure: job.pressure || 1, diff: DIFF,
    win: s.win, cause: s.cause, t: Math.round(s.t), dur: g.duration, score: +score.toFixed(4),
    bars, barsMax: ORGAN_KEYS.length * 4, peakBreach: +(s.peakTimer || 0).toFixed(3), fatiguePeak: Math.round(s.fatiguePeak || 0),
    maxAg: s.maxAg, storms: s.storms, pops: s.pops, evolved: s.evolved, kills,
  };
}

// ---- plans ----
const readOut = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const GATE = ['idle', 'random', 'stormSpam', 'beginner', 'casual', 'smart'];
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function bestBy(rows, keyOf, n) {
  const by = {};
  for (const r of rows) (by[keyOf(r)] = by[keyOf(r)] || []).push(r);
  return Object.values(by).map(rs => ({ row: rs[0], score: mean(rs.map(r => r.score)), wins: rs.filter(r => r.win).length, n: rs.length }))
    .sort((a, b) => b.score - a.score).slice(0, n);
}
function jobsFor(plan, levels, prior) {
  const jobs = [];
  for (const level of levels) {
    const units = LEVELS[level].units;
    if (plan === 'gate') for (const policy of GATE) for (const seed of [1, 2]) jobs.push({ kind: 'bot', policy, level, seed });
    if (plan === 'static1') {
      // 20 setups: 4 per sector set, picked by a fixed per-level shuffle
      const all = S.staticSetups(units), rnd = mulberry32(hash(level));
      for (const sec in S.SECTOR_SETS) {
        const pool = all.filter(s => s.sectors === sec);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        for (const setup of pool.slice(0, 4)) jobs.push({ kind: 'static', setup, level, seed: 1 });
      }
    }
    if (plan === 'coast') {
      for (const policy of ['chill', 'coast', 'setForget', 'setForget2'].filter(p => POLICIES[p])) for (const seed of [1, 2]) jobs.push({ kind: 'bot', policy, level, seed });
      if (process.env.COAST_STATIC !== '0') for (const j of jobsFor('static1', [level], prior)) jobs.push({ kind: 'static', setup: { ...j.setup, stress: 0 }, level, seed: 1 });
    }
    if (plan === 'static2') {
      const rows = prior.filter(r => r.level === level && r.kind === 'static' && r.pressure === 1);
      const done = new Set(rows.map(r => S.staticKey(r.setup)));
      const top = bestBy(rows, r => S.staticKey(r.setup), 3);
      const add = [];
      for (const t of top.slice(0, 2)) for (const nb of S.staticNeighbours(t.row.setup)) { const k = S.staticKey(nb); if (!done.has(k)) { done.add(k); add.push(nb); } }
      for (const setup of add.slice(0, 16)) jobs.push({ kind: 'static', setup, level, seed: 1 });
      for (const t of top) jobs.push({ kind: 'static', setup: t.row.setup, level, seed: 2 });
    }
    if (plan === 'sweep') {
      const n = +process.env.SWEEP_N || 40, P = S.sampleReactive(n);
      P.forEach((params, si) => { for (const seed of [1, 2]) jobs.push({ kind: 'reactive', params, si, level, seed }); });
    }
    if (plan === 'pressure') {
      const pr = (process.env.PRESSURES || '0.8,1.25').split(',').map(Number);
      const rows = prior.filter(r => r.level === level && r.pressure === 1);
      const st = bestBy(rows.filter(r => r.kind === 'static'), r => S.staticKey(r.setup), 1);
      const re = bestBy(rows.filter(r => r.kind === 'reactive'), r => r.si, 3);
      for (const pressure of pr) {
        for (const policy of ['idle', 'random', 'casual', 'smart']) jobs.push({ kind: 'bot', policy, level, seed: 1, pressure });
        for (const t of st) jobs.push({ kind: 'static', setup: t.row.setup, level, seed: 1, pressure });
        for (const t of re) jobs.push({ kind: 'reactive', params: t.row.params, si: t.row.si, level, seed: 1, pressure });
      }
    }
  }
  for (const j of jobs) {
    j.plan = plan;
    const what = j.kind === 'static' ? S.staticKey(j.setup) : j.kind === 'reactive' ? `r${j.si}` : j.policy;
    j.id = `${DIFF}|${j.level}|${j.kind}|${what}|s${j.seed}|p${j.pressure || 1}`;
  }
  return jobs;
}

if (process.argv[2] === '--worker') {
  process.on('message', j => { if (!j) process.exit(0); process.send(play(j)); });
} else {
  const [plan, out] = [process.argv[2], process.argv[3]];
  if (!plan || !out) { console.error('usage: V3=... node run.js <gate|static1|coast|static2|sweep|pressure> <out.jsonl> [levels]'); process.exit(1); }
  const levels = !process.argv[4] || process.argv[4] === 'all' ? LEVEL_ORDER.slice() : process.argv[4].split(',');
  const prior = readOut(out), have = new Set(prior.map(r => r.id));
  // longest maps first so the cores finish together
  const jobs = jobsFor(plan, levels, prior).filter(j => !have.has(j.id));
  const total = jobs.length, t0 = Date.now();
  console.log(`${plan}: ${total} games to play (${prior.length} already in ${out})`);
  if (!total) process.exit(0);
  let live = Math.max(1, Math.min(os.cpus().length, total)), done = 0;
  for (let c = 0, n = live; c < n; c++) {
    const w = fork(__filename, ['--worker']);
    const next = () => w.send(jobs.length ? jobs.shift() : null);
    w.on('message', r => {
      fs.appendFileSync(out, JSON.stringify(r) + '\n');
      done++;
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${total} ${r.level} ${r.kind} ${r.policy || (r.setup ? S.staticKey(r.setup) : 'r' + r.si)} s${r.seed} p${r.pressure}: ${r.win ? 'WIN' : r.cause} ${r.t}s · ${el.toFixed(0)} s elapsed, ~${(el / done * (total - done) / 60).toFixed(0)} min left`);
      next();
    });
    w.on('exit', () => { if (--live === 0) console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`); });
    next();
  }
}

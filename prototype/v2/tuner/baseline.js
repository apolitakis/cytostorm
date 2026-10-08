// Results for the live game's numbers, shipped inside the tuner page so it opens with real data.
// node tuner/baseline.js [ladderSeeds=16] [strategies=480] -> tuner/baseline.json  (runs on every core)
const path = require('path'), fs = require('fs'), os = require('os'), { fork } = require('child_process');
const src = path.join(__dirname, '..', 'src');
function load() {
  const sim = require(path.join(src, 'sim.js'));
  Object.assign(global, sim);
  return require(path.join(src, 'bots.js'));
}
const slim = r => ({ win: r.win, stars: r.stars, t: Math.round(r.t), peakTimer: +r.peakTimer.toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), curve: r.curve.filter((_, i) => i % 5 === 0) });

if (process.argv[2] === 'worker') {
  const B = load();
  process.on('message', jobs => {
    const S = {};
    const out = jobs.map(j => {
      const params = j.i != null ? (S[j.n] = S[j.n] || B.sampleStrategies(j.n))[j.i] : undefined;
      return { job: j, r: slim(B.runMatch(j.policy, j.seed, params)) };
    });
    process.send(out); process.exit(0);
  });
} else {
  const B = load();
  const nSeeds = +process.argv[2] || 16, nStrat = +process.argv[3] || 480;
  const jobs = [];
  for (let s = 1; s <= nSeeds; s++) for (const sk of B.SKILLS) jobs.push({ policy: sk.key, seed: s });
  for (let i = 0; i < nStrat; i++) jobs.push({ policy: 'strategy', seed: 1000 + i, i, n: nStrat });
  const cores = Math.max(1, os.cpus().length), parts = Array.from({ length: cores }, () => []);
  jobs.forEach((j, k) => parts[k % cores].push(j));
  const t0 = Date.now();
  Promise.all(parts.map(p => new Promise(res => { const c = fork(__filename, ['worker']); c.on('message', res); c.send(p); }))).then(all => {
    const res = all.flat();
    const ladder = { sig: 'live', n: nSeeds, runs: res.filter(x => x.job.i == null).map(x => ({ policy: x.job.policy, seed: x.job.seed, ...x.r })) };
    const strat = { sig: 'live', n: nStrat, runs: res.filter(x => x.job.i != null).map(x => ({ i: x.job.i, win: x.r.win, stars: x.r.stars, t: x.r.t })) };
    fs.writeFileSync(path.join(__dirname, 'baseline.json'), JSON.stringify({ ladder, strat }));
    const w = strat.runs.filter(r => r.win).length;
    console.log(`baseline: ${jobs.length} games in ${((Date.now() - t0) / 1000).toFixed(0)} s; strategies won ${w}/${nStrat}`);
    for (const sk of B.SKILLS) { const rs = ladder.runs.filter(r => r.policy === sk.key); console.log(`  ${sk.name.padEnd(14)} ${rs.filter(r => r.win).length}/${rs.length}`); }
  });
}

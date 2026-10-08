// Results for the live game's numbers on every level, shipped inside the tuner page so it opens with real data.
// node tuner/baseline.js [seeds=8] [strategies=120] [levels=all] -> tuner/baseline.json
// Runs one worker process per core. Run it from a folder outside /mnt/project-files (node can fail on that cwd):
//   cd /tmp && node /mnt/project-files/prototype/v3/tuner/baseline.js
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { fork } = require('child_process');
const src = path.join(__dirname, '..', 'src');
function load() {
  Object.assign(global, require(path.join(src, 'sim.js')));
  const B = require(path.join(src, 'bots.js'));
  Object.assign(global, B);
  return B;
}
// The page compares this with the code it was built from, so results from older code are flagged
const srcHash = () => crypto.createHash('sha1').update(Buffer.concat(['sim.js', 'bots.js'].map(f => fs.readFileSync(path.join(src, f))))).digest('hex').slice(0, 12);
const slim = r => ({ win: r.win, stars: r.stars, t: Math.round(r.t), cause: r.cause, peakTimer: +(r.peakTimer || 0).toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), maxAg: r.maxAg, curve: r.curve.filter((_, i) => i % 5 === 0) });

if (process.argv[2] === '--worker') {
  const B = load(), S = {};
  process.on('message', j => {
    if (!j) process.exit(0);
    const params = j.i != null ? (S[j.n] = S[j.n] || B.sampleStrategies(j.n))[j.i] : undefined;
    process.send({ job: j, r: slim(B.runMatch(j.level, j.policy, j.seed, params)) });
  });
} else {
  const B = load();
  const nSeeds = +process.argv[2] || 8, nStrat = +process.argv[3] || 120;
  const levels = !process.argv[4] || process.argv[4] === 'all' ? LEVEL_ORDER.slice() : process.argv[4].split(',');
  const pols = B.SKILLS.concat(B.STYLES).map(p => p.key);
  const jobs = [];
  for (const level of levels) {
    for (let s = 1; s <= nSeeds; s++) for (const policy of pols) jobs.push({ level, policy, seed: s });
    for (let i = 0; i < nStrat; i++) jobs.push({ level, policy: 'strategy', seed: 1000 + i, i, n: nStrat });
  }
  const total = jobs.length, res = [], t0 = Date.now();
  const cores = Math.max(1, Math.min(os.cpus().length, total));
  let live = cores, lastLog = 0;
  for (let c = 0; c < cores; c++) {
    const w = fork(__filename, ['--worker']);
    const next = () => w.send(jobs.length ? jobs.shift() : null);
    w.on('message', m => {
      res.push(m);
      const now = Date.now();
      if (now - lastLog > 30000) {
        lastLog = now;
        const el = (now - t0) / 1000;
        console.log(`${res.length}/${total} games, ${el.toFixed(0)} s, about ${(el / res.length * (total - res.length) / 60).toFixed(1)} min left`);
      }
      next();
    });
    w.on('exit', () => { if (--live === 0) done(); });
    next();
  }
  function done() {
    const out = { src: srcHash(), made: new Date().toISOString(), took: Math.round((Date.now() - t0) / 1000), levels: {} };
    for (const level of levels) {
      const mine = res.filter(x => x.job.level === level);
      out.levels[level] = {
        ladder: { n: nSeeds, runs: mine.filter(x => x.job.i == null).map(x => ({ policy: x.job.policy, seed: x.job.seed, ...x.r })) },
        strat: { n: nStrat, runs: mine.filter(x => x.job.i != null).map(x => ({ i: x.job.i, win: x.r.win, stars: x.r.stars, t: x.r.t, cause: x.r.cause })).sort((a, b) => a.i - b.i) },
      };
    }
    fs.writeFileSync(path.join(__dirname, 'baseline.json'), JSON.stringify(out));
    console.log(`baseline: ${total} games in ${out.took} s (${cores} cores), code ${out.src}`);
    const pad = (s, k) => String(s).padEnd(k);
    console.log(pad('level', 10) + pols.map(p => pad(p, 13)).join('') + 'strategies');
    for (const level of levels) {
      const L = out.levels[level];
      console.log(pad(level, 10) + pols.map(p => {
        const r = L.ladder.runs.filter(x => x.policy === p), st = r.filter(x => x.cause === 'storm').length;
        return pad(`${r.filter(x => x.win).length}/${r.length}${st ? ` of${st}` : ''}`, 13);
      }).join('') + `${L.strat.runs.filter(x => x.win).length}/${L.strat.runs.length}`);
    }
    console.log('(wins/games; "of" = organ-failure losses from the storm)');
  }
}

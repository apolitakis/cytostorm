'use strict';
// Balance runs: node headless.js [levels|all] [policies] [seeds]
// e.g. node headless.js all idle,random,stormSpam,smart,supportHeavy,offenseHeavy 8
// MUL=5 scales the unit counts (sim.js setSwarm); without it the workers run the v3 numbers (x1)
// Runs on every core (one worker process per core).
const os = require('os'), { fork } = require('child_process');
Object.assign(global, require('./sim.js'));
Object.assign(global, require('./bots.js'));
if (process.argv[2] === '--worker') {
  process.on('message', jobs => {
    if (process.env.TUNE) applySettings(JSON.parse(process.env.TUNE));
    if (process.env.MUL) setSwarm(+process.env.MUL); // swarm stress test: MUL=5 node headless.js papercut ...
    for (const j of jobs) { const s = runMatch(j.level, j.policy, j.seed); delete s.curve; process.send(s); }
    process.exit(0);
  });
} else {
  const levels = !process.argv[2] || process.argv[2] === 'all' ? LEVEL_ORDER : process.argv[2].split(',');
  const pols = (process.argv[3] || 'idle,random,stormSpam,smart,supportHeavy,offenseHeavy,gunner').split(',');
  const seeds = +process.argv[4] || 6;
  const jobs = [];
  for (const level of levels) for (const policy of pols) for (let s = 1; s <= seeds; s++) jobs.push({ level, policy, seed: s });
  const n = Math.min(os.cpus().length, jobs.length), res = [];
  let done = 0;
  const t0 = Date.now();
  for (let w = 0; w < n; w++) {
    const c = fork(__filename, ['--worker']);
    c.on('message', s => res.push(s));
    c.on('exit', () => { if (++done === n) report(); });
    c.send(jobs.filter((_, i) => i % n === w));
  }
  function report() {
    const pad = (s, k) => String(s).padEnd(k);
    console.log(pad('level', 10) + pols.map(p => pad(p, 13)).join(''));
    for (const level of levels) {
      console.log(pad(level, 10) + pols.map(p => {
        const r = res.filter(x => x.level === level && x.policy === p), w = r.filter(x => x.win).length;
        const st = r.filter(x => x.cause === 'storm' || x.cause === 'host').length;
        return pad(`${w}/${r.length}${st ? ` s${st}` : ''} ${Math.round(r.reduce((a, x) => a + x.peakTimer, 0) / r.length * 100)}%`, 13);
      }).join(''));
    }
    console.log(`(wins/seeds, s = host-failure losses, then mean peak lymph timer)  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, JSON.stringify(res));
  }
}

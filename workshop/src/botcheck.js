'use strict';
// Bot check for the workshop's Toxin load on v3's real levels, using v3's own bots.
// node src/botcheck.js [levels] [policies] [seeds]      e.g. node src/botcheck.js papercut,pool smart,offenseHeavy 6
// env V3=<dir with v3's sim.js and bots.js> (default ../../prototype/v3/src; the workshop runs it from a copy)
//     DEV='{"rates":{"ecoli":3}}' adds Sandbox spawns or dev switches on top of a level
//     TOXIN=on|off|both (default both)   TUNE='{"macrophage":{"eatEvery":1}}'   WS='{"toxload":{"perKill":2}}'
// One worker process per core. Bots press only the player's buttons; Toxin load is the workshop layer.
const os = require('os'), path = require('path'), { fork } = require('child_process');
const V3 = path.resolve(process.env.V3 || path.join(__dirname, '../../prototype/v3/src'));
Object.assign(global, require(path.join(V3, 'sim.js')));
Object.assign(global, require(path.join(V3, 'bots.js')));
Object.assign(global, require('./layer.js'));

function run(level, policy, seed, toxinLoad) {
  const dev = Object.assign(defaultDev(), { level, toxinLoad });
  if (process.env.DEV) { const x = JSON.parse(process.env.DEV); if (x.rates) Object.assign(dev.rates, x.rates); Object.assign(dev, x, { rates: dev.rates }); }
  const ws = new Workshop(dev, seed), g = ws.game;
  g.rand2 = (() => { let a = seed * 7919 + 3; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const fn = POLICIES[policy], limit = g.duration + 240;
  while (!g.result && g.t < limit) {
    if (Math.round(g.t * 60) % 30 === 0) fn(g);
    ws.step(1 / 60);
    g.fx.length = 0;
  }
  const r = g.result || { win: false, cause: 'timeout' };
  return { level, policy, seed, toxinLoad, win: !!r.win, cause: r.cause, toxPeak: ws.tox.peak, pinned: ws.tox.pinned, fed: ws.tox.fed || 0, liver: g.organs.liver, kidney: g.organs.kidney, organs: Object.assign({}, g.organs), leaks: ws.organs.leaks.liver + ws.organs.leaks.kidney, organFail: Object.values(g.organs).filter(h => h <= 0).length, fatPeak: g.fatiguePeak, swallows: g.stats.swallows, shots: g.stats.shotKills + g.stats.netKills };
}

if (process.argv[2] === '--worker') {
  process.on('message', jobs => {
    if (process.env.TUNE) mergeConfig(JSON.parse(process.env.TUNE));
    if (process.env.WS) mergeWs(JSON.parse(process.env.WS));
    for (const j of jobs) process.send(run(j.level, j.policy, j.seed, j.tox));
    process.exit(0);
  });
} else {
  const levels = !process.argv[2] || process.argv[2] === 'all' ? LEVEL_ORDER : process.argv[2].split(',');
  const pols = (process.argv[3] || 'idle,random,smart,supportHeavy,offenseHeavy,gunner').split(',');
  const seeds = +process.argv[4] || 6;
  const modes = process.env.TOXIN === 'on' ? [true] : process.env.TOXIN === 'off' ? [false] : [false, true];
  const jobs = [];
  for (const level of levels) for (const policy of pols) for (const tox of modes) for (let s = 1; s <= seeds; s++) jobs.push({ level, policy, seed: s, tox });
  const n = Math.min(os.cpus().length, jobs.length), res = [];
  let done = 0;
  for (let w = 0; w < n; w++) {
    const c = fork(__filename, ['--worker']);
    c.on('message', s => res.push(s));
    c.on('exit', () => { if (++done === n) report(); });
    c.send(jobs.filter((_, i) => i % n === w));
  }
  function report() {
    const pad = (s, k) => String(s).padEnd(k);
    console.log(pad('level', 10) + pols.map(p => pad(p, 22)).join(''));
    for (const level of levels) {
      console.log(pad(level, 10) + pols.map(p => pad(modes.map(tox => {
        const r = res.filter(x => x.level === level && x.policy === p && x.toxinLoad === tox), w = r.filter(x => x.win).length;
        const peak = Math.max(0, ...r.map(x => x.toxPeak));
        return `${w}/${r.length}${tox ? ` t${Math.round(peak)}` : ''}`;
      }).join(' | '), 22)).join(''));
    }
    console.log(`(wins/seeds; ${modes.length > 1 ? 'toxin off | toxin on, ' : ''}t = highest toxin load seen)`);
    if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, JSON.stringify(res));
  }
}

// Headless balance runs: node src/headless.js [seeds] [policies]. Bots live in src/bots.js.
const sim = require('./sim.js');
Object.assign(global, sim); // bots.js expects the sim's names as globals, as in the browser
const { POLICIES: policies, startMatch } = require('./bots.js');
const { Game, LEVELS, mergeConfig } = sim;
if (process.env.TUNE) mergeConfig(JSON.parse(process.env.TUNE));
if (process.env.WAVES) LEVELS.papercut.waves = JSON.parse(process.env.WAVES);
const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
const names = process.argv[3] ? process.argv[3].split(',') : Object.keys(policies);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
for (const name of names) {
  const rows = [];
  for (const seed of seeds) {
    const m = startMatch(name, seed), g = m.game;
    let sum; while (!(sum = m.advance(6000)));
    const maxB = sum.maxBact;
    const r = g.result || { win: false, stars: 0, t: g.t, reason: 'timeout', stats: g.stats, peakTimer: g.lymph.peak };
    const curve = g.history.filter((_, i) => i % 15 === 0).map(h => h.z[0] + h.z[1] + h.z[2]).join(' ');
    rows.push(`  seed ${seed}: ${r.win ? 'WIN ' : 'LOSE'} ${fmt(r.t)} stars ${r.stars} peak ${maxB} timerPeak ${(r.peakTimer * 100).toFixed(0)}% kills ${r.stats.shotKills}+${r.stats.swallows}sw toxinDeaths ${r.stats.toxinDeaths} fatiguePeak ${Math.round(g.fatiguePeak)} | bact/30s: ${curve}`);
  }
  if (process.env.COMPACT) console.log(`${name.padEnd(12)} ${rows.map(r => r.match(/(WIN |LOSE) (\S+) stars (\d)/).slice(1).join(' ')).join(' | ')}`);
  else { console.log(name); console.log(rows.join('\n')); }
}

// Headless smoke runs for the workshop sim: node src/headless.js [seconds] [combo,...]
// Each combo runs with a simple bot (Support in the Tissue, marrow per combo) and prints what happened.
const sim = require('./sim.js');
const { COMBOS } = require('./combos.js');
const { Game, mergeConfig } = sim;
if (process.env.TUNE) mergeConfig(JSON.parse(process.env.TUNE));
const secs = +(process.argv[2] || 120);
const names = process.argv[3] ? process.argv[3].split(',') : Object.keys(COMBOS);
for (const name of names) {
  const c = COMBOS[name];
  const g = new Game('papercut', 1, c.dev);
  if (c.marrow) g.setMarrow(c.marrow);
  (c.zones || []).forEach((m, z) => g.setZone(z, m));
  if (c.output != null) g.setOutput(c.output);
  if (c.boss) for (const k of c.boss) g.spawnGroup(k);
  const t0 = Date.now(); let maxB = 0, stormed = false;
  while (g.t < secs && !g.result) {
    g.step(1 / 60);
    g.fx.length = 0;
    maxB = Math.max(maxB, g.bact.length);
    if (process.env.STORM && !stormed && g.t > +process.env.STORM) { g.fireStorm(); stormed = true; }
    for (const b of g.bact) if (!isFinite(b.u) || !isFinite(b.v)) throw new Error(`${name}: NaN position on ${b.kind}`);
  }
  const s = g.stats, ms = Date.now() - t0;
  const live = Object.entries(g.countByKind()).map(([k, n]) => `${k}:${n}`).join(' ');
  console.log(`${name.padEnd(12)} ${g.result ? (g.result.win ? 'WIN ' : 'LOSE') + ' ' + g.result.t.toFixed(0) + 's ' + (g.result.why || '') : 'alive'} | peak ${maxB} | now ${live || 'clear'} | cells ${g.neut.length}n ${g.mac.length}m ${g.runners.length}net ${g.nk.length}nk inf ${g.mac.filter(m => m.infected).length} | domes ${g.domes.length} | kills shot ${s.shotKills} (tuned ${s.tunedKills}) sw ${s.swallows} net ${s.netKills} nk ${s.nkKills} storm ${s.stormKills} | lost ${JSON.stringify(s.lost)} | fatigue ${g.fatigue.toFixed(0)} tox ${g.toxLoad.toFixed(0)} (peak ${g.toxPeak.toFixed(0)}) | timer ${(g.lymph.timer * 100).toFixed(0)}% | ${(ms / (secs * 60)).toFixed(3)} ms/step`);
}

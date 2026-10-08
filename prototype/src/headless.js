// Headless balance runs: node src/headless.js [seeds]
const { Game } = require('./sim.js');
const DT = 1 / 60;
const inB = g => g.path.filter(p => !p.dead && p.y >= 300 && p.y < 600).length;
const inS = (g, s) => g.path.filter(p => !p.dead && Math.floor(p.y / 300) === s).length;
const smartAlerts = (g, hi = 150) => {
  for (let s = 0; s < 3; s++) { const n = inS(g, s); g.setAlert(s, n > hi ? 3 : n > 40 ? 2 : n > 5 ? 1 : 0); }
};
const standDown = g => { if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); return true; } };
const policies = {
  smart: g => { if (standDown(g)) return; if (Math.round(g.t * 60) % 120 === 0) smartAlerts(g); if (g.ad.state === 'ready') g.chooseAntibody('opsonize'); },
  smartNoAb: g => { if (standDown(g)) return; if (Math.round(g.t * 60) % 120 === 0) smartAlerts(g); },
  smartComp: g => { if (standDown(g)) return; if (Math.round(g.t * 60) % 120 === 0) smartAlerts(g); if (g.ad.state === 'ready') g.chooseAntibody('complement'); },
  smartFever: g => { if (standDown(g)) return; if (Math.round(g.t * 60) % 120 === 0) smartAlerts(g); if (inB(g) > 100) g.startFever(); if (g.ad.state === 'ready') g.chooseAntibody('opsonize'); },
  idle: () => {},
  idleOpso: g => { if (g.ad.state === 'ready') g.chooseAntibody('opsonize'); },
  sensible: g => {
    if (g.t < 0.1) g.setAlert(1, 2);
    if (g.ad.state === 'ready') g.chooseAntibody('opsonize');
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  sensibleFever: g => {
    if (g.t < 0.1) g.setAlert(1, 2);
    if (g.t > 60) g.startFever();
    if (g.ad.state === 'ready') g.chooseAntibody('opsonize');
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  complement: g => {
    if (g.t < 0.1) g.setAlert(1, 2);
    if (g.ad.state === 'ready') g.chooseAntibody('complement');
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  maxAll: g => {
    for (let s = 0; s < 3; s++) g.setAlert(s, 3);
    g.startFever();
    if (g.ad.state === 'ready') g.chooseAntibody('complement');
  },
  noStandDown: g => {
    if (g.t < 0.1) g.setAlert(1, 2);
    if (g.ad.state === 'ready') g.chooseAntibody('opsonize');
  },
  trap: g => {
    if (g.t < 0.1) { g.setAlert(1, 2); g.setStance('neut', 'trap'); }
    if (g.ad.state === 'ready') g.chooseAntibody('opsonize');
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  inflamedNoAb: g => {
    if (g.t < 0.1) g.setAlert(1, 2);
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  bMax: g => {
    if (g.t < 0.1) g.setAlert(1, 3);
    if (g.ad.state === 'ready') g.chooseAntibody('opsonize');
    if (g.phase === 'standdown') { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); }
  },
  restrain: g => { if (g.t < 0.1) { g.setAlert(0, 0); g.setAlert(1, 0); g.setAlert(2, 0); g.setStance('mac', 'repair'); } },
};
const runs = {
  papercut: ['idle', 'smart', 'smartNoAb', 'smartComp', 'smartFever', 'idleOpso', 'inflamedNoAb', 'sensible', 'sensibleFever', 'complement', 'bMax', 'trap', 'noStandDown', 'maxAll'],
  pollen: ['idle', 'restrain', 'idleOpso', 'maxAll'],
};
const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
const only = process.argv[3];
for (const sc in runs) for (const pol of runs[sc]) {
  if (only && !only.split(',').includes(pol)) continue;
  const rows = [];
  for (const seed of seeds) {
    const g = new Game(sc, seed);
    const marks = {};
    let maxB = 0;
    const t0 = Date.now();
    while (!g.result && g.t < 1200) {
      policies[pol](g);
      g.step(DT);
      const c = g.path.length; if (c > maxB) maxB = c;
      if (g.ad.state !== 'none' && marks.sample == null) marks.sample = g.t;
      if (g.ad.state === 'active' && marks.ab == null) marks.ab = g.t;
      if (g.phase === 'standdown' && marks.sd == null) marks.sd = g.t;
      if (Math.abs(g.t % 60) < DT / 2 && g.t > 1) (marks.L = marks.L || []).push(g.load().toFixed(0) + '/' + g.hostDamage().toFixed(0));
    }
    const r = g.result || { win: '-', reason: 'timeout', host: g.hostDamage(), scar: g.scar, peakLoad: g.peakLoad, stars: 0 };
    rows.push(`  seed ${seed}: ${r.win ? 'WIN ' : 'LOSE'} ${r.reason.padEnd(9)} t=${(g.t / 60).toFixed(1)}m host=${r.host.toFixed(0)} scar=${r.scar.toFixed(0)} peakLoad=${r.peakLoad.toFixed(0)} L/H by min=${(marks.L||[]).join(' ')} stars=${r.stars} sample@${marks.sample?.toFixed(0)} ab@${marks.ab?.toFixed(0)} sd@${marks.sd?.toFixed(0)} maxPath=${maxB} toxins=${g.toxins} src=${Object.entries(g.bySource).map(([k, v]) => k[0] + v.toFixed(0)).join(',')} (${Date.now() - t0}ms)`);
  }
  console.log(`${sc} / ${pol}`); console.log(rows.join('\n'));
}

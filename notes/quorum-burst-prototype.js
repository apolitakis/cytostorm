// Scratch prototype of the quorum burst, applied by wrapping Game.step. Not game code.
const sim = require('./sim.js');
const P = JSON.parse(process.env.QP || '{}');
const GR = P.gr || 45; const Q = P.q || 12, R = P.r || 20, HOLD = P.hold || 6, POP = P.pop || 45, GKILL = P.gkill ?? 0.6, CD = P.cd || 15;
const FAM = new Set(['staph', 'mrsa', 'toxic']);
const step = sim.Game.prototype.step;
sim.Game.prototype.step = function (dt) {
  step.call(this, dt);
  if (this.result || !process.env.QP) return;
  const q = this.quorum || (this.quorum = { acc: 0, glow: new Array(sim.NZ).fill(0), cd: new Array(sim.NZ).fill(0), pops: 0, germKills: 0, cellKills: 0 });
  q.acc += dt; if (q.acc < 0.5) return; const st = q.acc; q.acc = 0;
  const fam = this.ag.filter(a => !a.dead && !a.eaten && !a.domed && FAM.has(a.k));
  const best = new Array(sim.NZ).fill(null);
  for (const a of fam) { let n = 0; for (const b of fam) if ((a.u - b.u) ** 2 + (a.v - b.v) ** 2 < R * R) n++; const z = sim.zoneOf(a.u); if (!best[z] || n > best[z].n) best[z] = { n, a }; }
  for (let z = 0; z < sim.NZ; z++) {
    q.cd[z] = Math.max(0, q.cd[z] - st);
    const b = best[z];
    if (!b || b.n < Q || q.cd[z] > 0) { q.glow[z] = 0; continue; }
    q.glow[z] += st;
    if (q.glow[z] < HOLD) continue;
    const u = b.a.u, v = b.a.v; q.glow[z] = 0; q.cd[z] = CD; q.pops++;
    for (const c of this.cells) if (!c.dead && (c.u - u) ** 2 + (c.v - v) ** 2 < POP * POP) { this.killCell(c, 'toxin'); this.stats.toxinDeaths++; q.cellKills++; }
    for (const a of this.ag) if (!a.dead && !a.eaten && a.k !== 'worm' && a.k !== 'spore' && (a.u - u) ** 2 + (a.v - v) ** 2 < GR * GR && this.rand() < GKILL) { a.dead = true; q.germKills++; if (a.k === 'strep') this.unlink(a, false); }
  }
};

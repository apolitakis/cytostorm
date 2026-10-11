'use strict';
// Germ-only lab: one wave lands in an empty Wound (no player cells, no trickle, no quorum), and we watch it move.
// node lab.js <simDir> <kind> <N> [tuneJSON] [seed] [seconds]   (simDir holds sim.js + bots.js, e.g. a copy of prototype/v3/releases/v32)
const path = require('path');
const dir = path.resolve(process.argv[2]);
const S = require(path.join(dir, 'sim.js'));
Object.assign(global, S);
const B = require(path.join(dir, 'bots.js'));
const kind = process.argv[3] || 'staph', N = +process.argv[4] || 749;
const tune = process.argv[5] ? JSON.parse(process.argv[5]) : null;
const seed = +process.argv[6] || 1, DUR = +process.argv[7] || 8;
B.applySettings({ tune });
const lv = S.LEVELS.papercut;
lv.waves = [{ t: 0, [kind]: N }]; lv.stream = { start: 0, end: 0, clump: 1, kinds: [{ k: 'staph', w: 1 }] }; lv.duration = 999; lv.quorum = 1e9;
S.CONFIG.caps.cells = 0; S.CONFIG.evolve.on = 0;
const g = new S.Game('papercut', seed);
g.cells = [];
const DT = 1 / 60, W = 15; // 0.25 s windows
const hist = []; // per step: Map id -> [u, v]
const spawnOver = [];
const born = new Map();
const vis = { '0-1s': [], '1-2s': [], '2-4s': [], '4-8s': [] };
const com = [];
const reach = [null, null, null, null];
for (let s = 0; s < DUR * 60; s++) {
  const before = new Set(g.ag.map(a => a.id));
  g.step(DT); g.fx.length = 0;
  for (const a of g.ag) if (!before.has(a.id) && !born.has(a.id)) {
    born.set(a.id, g.t);
    // how much it overlaps others the moment it lands
    let o = 0; for (const b of g.ag) if (b !== a) { const d = Math.hypot(a.u - b.u, a.v - b.v); if (d < a.r + b.r) o += (a.r + b.r - d) / (a.r + b.r); }
    spawnOver.push(o);
  }
  for (const a of g.ag) if (!a.dead) { const z = S.zoneOf(a.u); if (z && reach[z] == null) reach[z] = +g.t.toFixed(1); }
  const m = new Map(); let su = 0, n = 0;
  for (const a of g.ag) if (!a.dead) { m.set(a.id, [a.u, a.v]); su += a.u; n++; }
  hist.push(m); com.push(n ? su / n : 0);
  if (hist.length > W) {
    const old = hist[hist.length - 1 - W];
    for (const [id, p] of m) { const q = old.get(id); if (!q) continue; const age = g.t - born.get(id); if (age < W * DT) continue;
      const sp = Math.hypot(p[0] - q[0], p[1] - q[1]) / (W * DT);
      const k = age < 1 ? '0-1s' : age < 2 ? '1-2s' : age < 4 ? '2-4s' : '4-8s'; vis[k].push(sp); }
  }
}
const q = (a, x) => { if (!a.length) return 0; a.sort((p, r) => p - r); return Math.round(a[Math.min(a.length - 1, Math.floor(x * a.length))]); };
spawnOver.sort((a, b) => a - b);
const comSpeed = (t0, t1) => ((com[Math.round(t1 * 60) - 1] - com[Math.round(t0 * 60)]) / (t1 - t0)).toFixed(1);
const out = { reach, kind, N, tune, landingOverlap: { mean: +(spawnOver.reduce((a, b) => a + b, 0) / spawnOver.length).toFixed(2), p90: +spawnOver[Math.floor(spawnOver.length * 0.9)].toFixed(2) },
  massSpeed: { '0-2s': +comSpeed(0, 2), '2-4s': +comSpeed(2, 4), '4-8s': +comSpeed(4, 8) },
  visible: Object.fromEntries(Object.entries(vis).map(([k, a]) => [k, { p50: q(a, 0.5), p90: q(a, 0.9), p99: q(a, 0.99), over30: +(a.filter(x => x > 30).length / a.length * 100).toFixed(1) }])) };
if (process.env.JSON) console.log(JSON.stringify(out));
else {
  console.log(`${kind} x${N} ${JSON.stringify(tune || {})}: landing overlap mean ${out.landingOverlap.mean} p90 ${out.landingOverlap.p90}; mass forward speed 0-2s ${out.massSpeed['0-2s']} 2-4s ${out.massSpeed['2-4s']} 4-8s ${out.massSpeed['4-8s']} u/s`);
  console.log(`  first germ reached Tissue ${reach[1]} s, Deep tissue ${reach[2]} s, Lymph node ${reach[3]} s`);
  for (const [k, r] of Object.entries(out.visible)) console.log(`  age ${k.padEnd(5)} speed over 0.25 s: p50 ${r.p50} p90 ${r.p90} p99 ${r.p99}  (>30 u/s: ${r.over30}%)`);
}

'use strict';
// How fast do bodies visibly move in a real match? Speeds are measured over 0.25 s windows (what the eye sees),
// split by what the body is and how long ago it spawned. Also: each wave's forward speed over its first 3 s.
// node measure.js <simDir> <level> <policy> <seed> [tuneJSON] [seconds]
const path = require('path');
const dir = path.resolve(process.argv[2]);
const S = require(path.join(dir, 'sim.js'));
Object.assign(global, S);
const B = require(path.join(dir, 'bots.js'));
Object.assign(global, B);
const [level, policy, seed] = [process.argv[3], process.argv[4], +process.argv[5] || 1];
const tune = process.argv[6] ? JSON.parse(process.argv[6]) : null;
const secs = +process.argv[7] || 0;
B.applySettings({ tune });

const G = S.Game.prototype;
const origRun = G.runWaves, origQ = G.stepQuorum, origAg = G.stepAntigens, origSpawn = G.spawnAg, origStep = G.step;
G.runWaves = function () { this._src = 'wave'; const r = origRun.apply(this, arguments); this._src = 'trickle'; return r; };
G.stepQuorum = function () { this._src = 'other'; return origQ.apply(this, arguments); };
G.stepAntigens = function () { this._src = 'born'; return origAg.apply(this, arguments); };
G.spawnAg = function () { const a = origSpawn.apply(this, arguments); if (a) { a._born = this.t; a._src = this._src || 'other'; a._u0 = a.u; a._w = this.waveIdx - 1; } return a; };

const W = 15; // 0.25 s at 60 steps/s
const speeds = {}; // class + age -> [speeds]
const perW = {};
let snap = new Map(), stepN = 0;
const ageB = x => x < 1 ? '0-1s' : x < 3 ? '1-3s' : '3s+';
G.step = function (dt) {
  origStep.call(this, dt);
  stepN++;
  for (const a of this.ag) if (!a.dead && !a.eaten && a._src === 'wave' && !a._fd && this.t - a._born >= 3) {
    a._fd = 1; const w = perW[a._w] || (perW[a._w] = { n: 0, du: 0 }); w.n++; w.du += a.u - a._u0;
  }
  if (stepN % W) return;
  const now = new Map();
  const rec = (b, cls, age) => {
    now.set(b, [b.u, b.v]);
    const p = snap.get(b); if (!p || age < W * dt) return;
    const k = cls + ' ' + ageB(age);
    (speeds[k] || (speeds[k] = [])).push(Math.hypot(b.u - p[0], b.v - p[1]) / (W * dt));
  };
  for (const a of this.ag) if (!a.dead && !a.eaten) rec(a, a.prev || a.next ? 'germ chain' : a.k === 'flu' ? 'germ flu' : 'germ ' + a._src, this.t - a._born);
  for (const c of this.cells) if (!c.dead) rec(c, 'cell ' + c.type, c.age);
  snap = now;
};

const m = B.startMatch(level, policy, seed);
let res;
while (!(res = m.advance(60)) && (!secs || m.game.t < secs));
res = res || m.summary();
const q = (a, x) => Math.round(a[Math.min(a.length - 1, Math.floor(x * a.length))]);
const rows = {};
for (const k of Object.keys(speeds).sort()) { const a = speeds[k].sort((x, y) => x - y); rows[k] = { n: a.length, p50: q(a, 0.5), p90: q(a, 0.9), p99: q(a, 0.99), max: q(a, 1), over30: +(a.filter(x => x > 30).length / a.length * 100).toFixed(1), over60: +(a.filter(x => x > 60).length / a.length * 100).toFixed(1) }; }
const waves = Object.entries(perW).map(([w, x]) => ({ w: +w, n: x.n, fwd3: +(x.du / x.n / 3).toFixed(1) }));
const out = { level, policy, seed, tune, win: res.win, t: Math.round(res.t), waves, rows };
if (process.env.JSON) console.log(JSON.stringify(out));
else {
  console.log(`${level} ${policy} seed ${seed} ${JSON.stringify(tune || {})} -> ${res.win ? 'win' : 'loss'} at ${out.t}s`);
  console.log('  waves (germs that lived 3 s, forward u/s over their first 3 s): ' + waves.map(w => `${w.n}@${w.fwd3}`).join('  '));
  console.log('  ' + 'class age'.padEnd(22) + 'samples'.padStart(9) + '  p50  p90  p99  max  >30u/s  >60u/s');
  for (const [k, r] of Object.entries(rows)) console.log('  ' + k.padEnd(22) + String(r.n).padStart(9) + [r.p50, r.p90, r.p99, r.max].map(x => String(x).padStart(5)).join('') + (r.over30 + '%').padStart(8) + (r.over60 + '%').padStart(8));
}

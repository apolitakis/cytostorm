'use strict';
// Campaign strategy simulator: fit. Reads run.js output and writes model.json, the per-map win model the page uses.
//   V3=<copy of releases/v34> CAMP=<copy of campaign/src> node fit.js model.json builds.jsonl [treat.jsonl ...]
// Model (one per skill: casual, smart): logit P(win) = A[map] + sum over upgrades of B[upgrade] x rank
//   + V x (share of the map's germs, by Samples value, that you're vaccinated against) + T[map][treatment].
// Ridge-regularised logistic regression (Newton steps), so maps every game won stay finite.
const path = require('path'), fs = require('fs');
const V3 = process.env.V3, CAMP = process.env.CAMP;
Object.assign(global, require(path.join(V3, 'sim.js')));
const CAMPAIGN = require(path.join(CAMP, 'campaign.js'));
const [out, ...files] = process.argv.slice(2);
const rows = files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const N = LEVEL_ORDER.length, UP = CAMPAIGN.UPGRADES.map(u => u.id), TR = CAMPAIGN.TREATMENTS.map(t => t.id).filter(t => t !== 'none');
const SKILLS = ['casual', 'smart'];

// Share of each map's Samples value by vaccine kind (waves plus trickle, at the campaign's pressure)
function shares(key, i) {
  const lv = CAMPAIGN.scaleLevel(LEVELS[key], CAMPAIGN.pressure(i, N)), C = CONFIG, V = CAMPAIGN.VALUE, by = {};
  const add = (k, v) => { const q = CAMPAIGN.VACCINE_OF[k]; by[q] = (by[q] || 0) + v; };
  for (const w of lv.waves) for (const k in V) if (w[k]) add(k, w[k] * V[k] * (k === 'strep' ? C.strep.links : k === 'worm' ? C.worm.segments : 1));
  const S = lv.stream, tot = S.kinds.reduce((a, x) => a + x.w, 0);
  for (const x of S.kinds) add(x.k, (S.start + S.end) / 2 * lv.duration * (x.w / tot) * V[x.k] * (1 - (x.from || 0) / lv.duration));
  const sum = Object.values(by).reduce((a, b) => a + b, 0);
  for (const k in by) by[k] = +(by[k] / sum).toFixed(3);
  return by;
}
const SH = Object.fromEntries(LEVEL_ORDER.map((k, i) => [k, shares(k, i)]));
const cover = r => Object.entries(SH[r.level]).reduce((a, [k, s]) => a + (r.vax.includes(k) ? s : 0), 0);

// Solve (H) x = g by Gaussian elimination
function solve(H, g) {
  const n = g.length, M = H.map((row, i) => [...row, g[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function newton(X, y, lam, n) {
  let w = new Array(n).fill(0);
  for (let it = 0; it < 50; it++) {
    const g = w.map((v, i) => -lam[i] * v), H = Array.from({ length: n }, (_, i) => { const a = new Array(n).fill(0); a[i] = -lam[i]; return a; });
    X.forEach((x, j) => {
      let z = 0; for (const [i, v] of x) z += w[i] * v;
      const p = 1 / (1 + Math.exp(-z)), d = p * (1 - p);
      for (const [i, v] of x) { g[i] += (y[j] - p) * v; for (const [k, u] of x) H[i][k] -= d * v * u; }
    });
    const step = solve(H.map(r => r.map(v => -v)), g);
    w = w.map((v, i) => v + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-6) break;
  }
  return w;
}
// An upgrade only counts where it can act: Wide nets needs Net neutrophils, Hardy NK needs NK cells (unlocked by that stage),
// and Cool head (shorter storm afterburn) does nothing for the casual bot, which never storms
const NEED = Object.fromEntries(CAMPAIGN.UPGRADES.filter(u => u.need).map(u => [u.id, u.need]));
const INERT = { casual: ['cool'] };
const unlockedAt = key => { const i = LEVEL_ORDER.indexOf(key), s = new Set(); for (let j = 0; j <= i; j++) for (const u of LEVELS[LEVEL_ORDER[j]].units) s.add(u); return s; };
const counts = (u, key, sk) => !(INERT[sk] || []).includes(u) && (!NEED[u] || unlockedAt(key).has(NEED[u]));
function fitSkill(sk) {
  const R = rows.filter(r => r.policy === sk);
  // parameters: A[map] x N, B[upgrade] x 12, V, T[map][treatment]
  const idx = {}; let n = 0;
  for (const k of LEVEL_ORDER) idx['A.' + k] = n++;
  for (const u of UP) idx['B.' + u] = n++;
  idx.V = n++;
  for (const k of LEVEL_ORDER) for (const t of TR) if (R.some(r => r.level === k && r.treat === t)) idx[`T.${k}.${t}`] = n++;
  const lam = Object.keys(idx).map(k => k[0] === 'A' ? 0.15 : k[0] === 'T' ? 1.0 : k === 'V' ? 0.5 : 2.0); // ridge per parameter
  const X = R.map(r => {
    const x = new Map([[idx['A.' + r.level], 1]]);
    for (const u of UP) if (r.up[u] && counts(u, r.level, sk)) x.set(idx['B.' + u], r.up[u]);
    const c = cover(r); if (c) x.set(idx.V, c);
    if (r.treat !== 'none') x.set(idx[`T.${r.level}.${r.treat}`], 1);
    return x;
  });
  const y = R.map(r => r.win ? 1 : 0);
  const train = (keep, lam0) => {
    const lm = lam0.slice(), Xk = X.filter((_, j) => keep(j)), yk = y.filter((_, j) => keep(j));
    let w = new Array(n).fill(0);
    for (let pass = 0; pass < 14; pass++) {
      w = newton(Xk, yk, lm, n);
      const neg = Object.keys(idx).filter(k => (k[0] === 'B' || k === 'V') && w[idx[k]] < 0);
      if (!neg.length) break;
      for (const k of neg) lm[idx[k]] = 1e7;
    }
    return w;
  };
  const prob = (w, x) => { let z = 0; for (const [i, v] of x) z += w[i] * v; return 1 / (1 + Math.exp(-z)); };
  let cv = null;
  if (process.env.CV) { // 5-fold held-out log loss: this model vs stage difficulty only
    const only = lam.map((v, i) => Object.keys(idx)[i][0] === 'A' ? v : 1e7);
    const score = lm => { let s = 0; for (let f = 0; f < 5; f++) { const w = train(j => j % 5 !== f, lm); X.forEach((x, j) => { if (j % 5 === f) { const p = Math.min(1 - 1e-6, Math.max(1e-6, prob(w, x))); s -= Math.log(y[j] ? p : 1 - p); } }); } return +(s / X.length).toFixed(3); };
    cv = { model: score(lam), stageOnly: score(only) };
  }
  let w = new Array(n).fill(0);
  // Upgrades and vaccines are pure buffs: a boost that fits below zero is noise, so pin it at zero and refit
  for (let pass = 0; pass < 14; pass++) {
    w = newton(X, y, lam, n);
    const neg = Object.keys(idx).filter(k => (k[0] === 'B' || k === 'V') && w[idx[k]] < 0);
    if (!neg.length) break;
    for (const k of neg) lam[idx[k]] = 1e7;
  }
  const get = k => idx[k] == null ? 0 : +w[idx[k]].toFixed(3);
  const pred = X.map(x => { let z = 0; for (const [i, v] of x) z += w[i] * v; return 1 / (1 + Math.exp(-z)); });
  const ll = -R.reduce((a, r, j) => a + Math.log(y[j] ? pred[j] : 1 - pred[j]), 0) / R.length;
  const per = Object.fromEntries(LEVEL_ORDER.map(k => {
    const J = R.map((r, j) => j).filter(j => R[j].level === k);
    const wins = J.filter(j => y[j]).length, P = J.reduce((a, j) => a + pred[j], 0);
    const W = J.filter(j => y[j]), Lo = J.filter(j => !y[j]);
    const mean = (A, f) => A.length ? Math.round(A.reduce((a, j) => a + f(R[j]), 0) / A.length) : null;
    return [k, { games: J.length, wins, predicted: +P.toFixed(1), payWin: mean(W, r => r.base), payLoss: mean(Lo, r => r.base), lossAt: Lo.length ? +(Lo.reduce((a, j) => a + R[j].t / R[j].dur, 0) / Lo.length).toFixed(2) : null }];
  }));
  return {
    A: Object.fromEntries(LEVEL_ORDER.map(k => [k, get('A.' + k)])),
    B: Object.fromEntries(UP.map(u => [u, get('B.' + u)])),
    V: get('V'),
    T: Object.fromEntries(LEVEL_ORDER.map(k => [k, Object.fromEntries(TR.map(t => [t, get(`T.${k}.${t}`)]).filter(([, v]) => v))])),
    games: R.length, logloss: +ll.toFixed(3), cv, per,
  };
}
const model = {
  made: new Date().toISOString(), inert: INERT, release: path.basename(V3), games: rows.length,
  levels: LEVEL_ORDER.map((k, i) => ({ key: k, name: LEVELS[k].name, where: CAMPAIGN.PLACES[k].where, pressure: +CAMPAIGN.pressure(i, N).toFixed(3), units: LEVELS[k].units, kinds: [...CAMPAIGN.kindsIn(LEVELS[k])].filter(x => x !== 'spore' && x !== 'wormlet'), shares: SH[k] })),
  names: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.name])), units: UNIT_NAMES,
  skills: Object.fromEntries(SKILLS.filter(s => rows.some(r => r.policy === s)).map(s => [s, fitSkill(s)])),
};
// Pay per map: pooled across skills where a skill has no example
for (const k of LEVEL_ORDER) {
  const all = rows.filter(r => r.level === k), W = all.filter(r => r.win), L = all.filter(r => !r.win);
  const m = A => A.length ? Math.round(A.reduce((a, r) => a + r.base, 0) / A.length) : null;
  const pw = m(W) != null ? m(W) : Math.round(all[0].budget * CAMPAIGN.RATE), pl = m(L); // no win seen: a win kills about the whole budget
  for (const s in model.skills) { const q = model.skills[s].per[k]; if (q.payWin == null) q.payWin = pw; if (q.payLoss == null) q.payLoss = pl != null ? pl : Math.round((pw || 0) * 0.4); }
}
fs.writeFileSync(out, JSON.stringify(model));
for (const s in model.skills) {
  const m = model.skills[s];
  console.log(`\n${s}: ${m.games} games, log loss ${m.logloss}${m.cv ? ` (held out: model ${m.cv.model}, stage only ${m.cv.stageOnly})` : ''}, vaccine coverage ${m.V}`);
  console.log('upgrade logit per rank: ' + UP.map(u => `${u} ${m.B[u]}`).join(', '));
  for (const k of LEVEL_ORDER) { const q = m.per[k]; console.log(`  ${k.padEnd(9)} A ${String(m.A[k]).padEnd(7)} won ${q.wins}/${q.games} (model ${q.predicted})  pays win ${q.payWin} loss ${q.payLoss} ${JSON.stringify(m.T[k])}`); }
}

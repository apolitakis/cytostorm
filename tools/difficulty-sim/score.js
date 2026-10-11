'use strict';
// Difficulty simulator: turns run.js results into the per-level difficulty score and the data the page shows.
//   V3=<copy of the release> node score.js <results.jsonl> <out.json>
// The score is a utility function, not pass/fail rules (Alex, 2026-10-10): each component maps a measurement to
// 0..1 and the level's score is the weighted average out of 100. Edit COMPONENTS to change what counts.
const path = require('path'), fs = require('fs');
const V3 = process.env.V3;
Object.assign(global, require(path.join(V3, 'sim.js')));
const S = require('./strategies.js');

const clamp = x => Math.max(0, Math.min(1, x));
const ramp = (x, lo, hi) => clamp((x - lo) / (hi - lo));          // 0 at lo, 1 at hi (lo > hi ramps down)
const band = (x, z0, a, b, z1) => (x < a ? ramp(x, z0, a) : x > b ? ramp(x, z1, b) : 1); // 1 inside [a, b]
const pct = x => `${Math.round(x * 100)}%`;
const COMPONENTS = [
  { key: 'mustLose', name: 'Must-lose bots lose', w: 3, u: m => 1 - m.mustLose, show: m => `idle, random, storm spam and chill won ${pct(m.mustLose)} (${m.mustLoseTxt})` },
  { key: 'trivial', name: 'No trivial wins', w: 2, u: m => ramp(m.trivial, 0.6, 0.1), show: m => `best set-and-forget setup won ${pct(m.trivial)}${m.trivialDesc ? `: ${m.trivialDesc}` : ''}` },
  { key: 'breadth', name: 'Many ways to win', w: 2, u: m => (m.breadth == null ? null : band(m.breadth, 0, 0.15, 0.6, 0.9)), show: m => (m.breadth == null ? 'strategy sweep not run yet' : `sampled strategies won ${pct(m.breadth)} of their games`) },
  { key: 'good', name: 'Good player wins', w: 2, u: m => ramp(m.good, 0.5, 0.9), show: m => `the good bot won ${pct(m.good)}` },
  { key: 'variety', name: 'Variety', w: 1, u: m => (m.breadth == null ? null : m.styles >= 2 ? 1 : m.styles === 1 ? 0.6 : 0), show: m => (m.breadth == null ? 'strategy sweep not run yet' : `${m.styles} winning style${m.styles === 1 ? '' : 's'}${m.styleTxt ? ` (${m.styleTxt})` : ''}`) },
  { key: 'skill', name: 'Skill matters', w: 1, u: m => ramp(m.good - m.beginner, 0, 0.5), show: m => `good bot ${pct(m.good)} vs beginner ${pct(m.beginner)}` },
  { key: 'close', name: 'Feels close', w: (m, i) => (i < 3 ? 0.5 : 1), u: m => (m.close == null ? 0 : ramp(m.close, 0, 0.5)), show: m => (m.close == null ? 'nothing won' : `median winner closeness ${m.close.toFixed(2)} (organ bars lost / 4, or peak breach clock)`) },
];
const STYLE_NAMES = { shot: 'neutrophil fire', tuned: 'Support rings', swallow: 'swallowing', net: 'Nets', storm: 'storm' };

const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const rate = rs => (rs.length ? rs.filter(r => r.win).length / rs.length : 0);
const styleOf = r => { const k = r.kills || {}; let best = null, n = 0; for (const m of ['shot', 'tuned', 'swallow', 'net']) if ((k[m] || 0) > n) { n = k[m]; best = m; } return best; };
const closeness = r => Math.max((r.barsMax - r.bars) / 4, r.peakBreach);

function levelSummary(level, i, rows) {
  const live = rows.filter(r => r.pressure === 1);
  const bot = p => live.filter(r => r.kind === 'bot' && r.policy === p);
  const must = ['idle', 'random', 'stormSpam', 'chill'].map(p => ({ p, rs: bot(p) }));
  const stat = live.filter(r => r.kind === 'static'), reac = live.filter(r => r.kind === 'reactive');
  // set-and-forget: every setup tried, best first (by wins, then how far it got)
  const byS = {};
  for (const r of stat) (byS[S.staticKey(r.setup)] = byS[S.staticKey(r.setup)] || { setup: r.setup, rs: [] }).rs.push(r);
  const setups = Object.values(byS).map(x => ({ key: S.staticKey(x.setup), desc: S.describeStatic(x.setup), setup: x.setup, wins: x.rs.filter(r => r.win).length, n: x.rs.length, score: x.rs.reduce((a, r) => a + r.score, 0) / x.rs.length }))
    .sort((a, b) => b.wins / b.n - a.wins / a.n || b.score - a.score);
  const bestS = setups[0];
  // reactive strategies
  const byR = {};
  for (const r of reac) (byR[r.si] = byR[r.si] || { si: r.si, params: r.params, rs: [] }).rs.push(r);
  const strats = Object.values(byR).map(x => ({ si: x.si, params: x.params, wins: x.rs.filter(r => r.win).length, n: x.rs.length }));
  const wins = reac.filter(r => r.win), styleCount = {};
  for (const r of wins) { const s = styleOf(r); if (s) styleCount[s] = (styleCount[s] || 0) + 1; }
  // a style counts when at least 2 winning games and a tenth of the wins used it
  const styles = Object.entries(styleCount).filter(([, n]) => n >= 2 && n >= wins.length * 0.1).sort((a, b) => b[1] - a[1]);
  const allWins = live.filter(r => r.win && (r.kind === 'reactive' || (r.kind === 'bot' && ['smart', 'casual'].includes(r.policy))));
  const m = {
    mustLose: rate(must.flatMap(x => x.rs)), mustLoseTxt: must.map(x => `${x.p} ${x.rs.filter(r => r.win).length}/${x.rs.length}`).join(', '),
    trivial: bestS ? bestS.wins / bestS.n : 0, trivialDesc: bestS && bestS.wins ? bestS.desc : '',
    breadth: reac.length ? rate(reac) : null, good: rate(bot('smart')), casual: rate(bot('casual')), beginner: rate(bot('beginner')),
    styles: styles.length, styleTxt: styles.map(([s, n]) => `${STYLE_NAMES[s]} ${n}`).join(', '),
    close: median(allWins.map(closeness)),
  };
  // a part with no data yet (u = null) is left out of the score, not counted as 0
  const comps = COMPONENTS.map(c => { const w = typeof c.w === 'function' ? c.w(m, i) : c.w, raw = c.u(m), u = raw == null ? null : clamp(raw); return { key: c.key, name: c.name, w, u: u == null ? null : +u.toFixed(3), lost: u == null ? 0 : +(w * (1 - u)).toFixed(3), detail: c.show(m) }; });
  const got = comps.filter(c => c.u != null), W = got.reduce((a, c) => a + c.w, 0), score = Math.round(100 * got.reduce((a, c) => a + c.w * c.u, 0) / W);
  // which habits of the reactive strategies go with winning
  const habits = S.SPACE.filter(d => d.key !== 'stormAt').map(d => {
    let bins;
    if (d.bool) bins = [true, false].map(v => ({ label: v ? 'yes' : 'no', test: x => !!x === v }));
    else if (d.steps) bins = d.steps.map(v => ({ label: String(v), test: x => x === v }));
    else { const w = (d.max - d.min) / 3; bins = [0, 1, 2].map(k => ({ label: `${+(d.min + k * w).toFixed(d.int ? 0 : 2)}–${+(d.min + (k + 1) * w).toFixed(d.int ? 0 : 2)}`, test: x => x >= d.min + k * w && (x < d.min + (k + 1) * w || k === 2) })); }
    for (const b of bins) { const rs = reac.filter(r => b.test(r.params[d.key])); b.n = rs.length; b.rate = +rate(rs).toFixed(3); delete b.test; }
    const solid = bins.filter(b => b.n >= 6), spread = solid.length > 1 ? Math.max(...solid.map(b => b.rate)) - Math.min(...solid.map(b => b.rate)) : 0;
    return { key: d.key, bins, spread: +spread.toFixed(3) };
  }).sort((a, b) => b.spread - a.spread);
  // other pressures (rough: one seed each)
  const pressures = [...new Set(rows.map(r => r.pressure))].sort((a, b) => a - b).map(p => {
    const rs = rows.filter(r => r.pressure === p), get = f => rs.filter(f);
    const one = f => { const x = get(f); return { w: x.filter(r => r.win).length, n: x.length }; };
    return {
      p, idle: one(r => r.kind === 'bot' && (r.policy === 'idle' || r.policy === 'random')), casual: one(r => r.kind === 'bot' && r.policy === 'casual'),
      smart: one(r => r.kind === 'bot' && r.policy === 'smart'), static: one(r => r.kind === 'static'), reactive: one(r => r.kind === 'reactive'),
    };
  });
  return {
    key: level, name: LEVELS[level].name, i, units: LEVELS[level].units, score, comps, m,
    bots: Object.fromEntries(['idle', 'random', 'stormSpam', 'chill', 'beginner', 'casual', 'coast', 'setForget', 'setForget2', 'smart'].map(p => [p, { w: bot(p).filter(r => r.win).length, n: bot(p).length }]).filter(([, b]) => b.n)),
    setups: setups.slice(0, 8).map(({ setup, ...x }) => ({ ...x, score: +x.score.toFixed(3) })), setupsTried: setups.length, setupWins: setups.filter(s => s.wins).length,
    strategies: strats.length, strategyWinners: strats.filter(s => s.wins).length, habits, pressures,
    games: rows.length,
  };
}

if (require.main === module) {
  const [inp, out] = process.argv.slice(2);
  const rows = fs.readFileSync(inp, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const levels = LEVEL_ORDER.map((k, i) => levelSummary(k, i, rows.filter(r => r.level === k)));
  const res = { made: new Date().toISOString(), release: process.env.RELEASE || path.basename(V3), diff: rows[0] ? rows[0].diff : 'normal', games: rows.length, components: COMPONENTS.map(c => ({ key: c.key, name: c.name, w: typeof c.w === 'function' ? 'varies' : c.w })), levels };
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  for (const L of levels) console.log(`${L.name.padEnd(16)} ${String(L.score).padStart(3)}  ${L.comps.filter(c => c.lost > 0.2).sort((a, b) => b.lost - a.lost).map(c => `${c.name}: ${c.detail}`).join(' | ')}`);
}
module.exports = { COMPONENTS, levelSummary };

const src = process.argv[2];
Object.assign(global, require(src + '/sim.js')); Object.assign(global, require(src + '/bots.js'));
const lv = process.argv[3], pol = process.argv[4] || 'smart';
const m = startMatch(lv, pol, 1); const g = m.game; const made = {}; let maxT = {};
let s; let n = 0;
while (!(s = m.advance(600))) { const c = {}; for (const x of g.cells) if (!x.dead) c[x.type] = (c[x.type] || 0) + 1; for (const k in c) maxT[k] = Math.max(maxT[k] || 0, c[k]); }
const t = {}; for (const h of g.history) for (const [k, v] of Object.entries(h.d || {})) if (/^(tag|eos|mast|plt|kill\.eos|kill\.swallow\.mrsa)/.test(k)) { const kk = k.startsWith("tag.") ? "tag" : k; t[kk] = (t[kk] || 0) + v; }
console.log(lv, pol, s.win ? 'WIN' : 'lose ' + s.cause, Math.round(g.t) + 's', JSON.stringify(maxT), JSON.stringify(t), 'primed', Object.keys(g.primed).join(','), 'calm', g.calmMul().toFixed(2));

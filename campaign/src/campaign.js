'use strict';
// ---------------------------------------------------------------------------
// Cytostorm campaign: the rules layer. No DOM, so it also runs under node.
// Spec: notes/campaign-brainstorm.md ("Locked for building", Alex 2026-10-08).
//
// Everything is applied from outside v3's sim (prototype/v3/src/sim.js, read-only):
// - upgrades and treatments change CONFIG before each map (reset from a base copy first),
// - the loadout swaps the level's unit list while the Game is built,
// - Samples, antibiotics, vaccines wrap a few methods on the one Game instance
//   (tick, damage, spawnAg, stepAntigens, stepMac).
// ---------------------------------------------------------------------------
const CAMPAIGN = (() => {
  const BACTERIA = new Set(['staph', 'mrsa', 'pseudo', 'clos', 'tb', 'toxic', 'strep']);
  // Samples per kill, by toughness. Tapeworm counts per segment (12 segments, about 140 a worm at V28 scale).
  const VALUE = { staph: 1, mrsa: 4, pseudo: 2, flu: 0.5, spore: 1, clos: 1, tb: 4, toxic: 1.5, strep: 1, virus: 0.5, worm: 12, wormlet: 1, yeast: 3 };
  const CUT_VALUE = 0.2;     // per hypha segment cut by a net or chewed
  const RATE = 0.12 / 3.9;   // Samples = RATE x kill value (calibrated with bots so a first clear pays roughly 150-300).
                             // Play V28 sends 3.9x the germs (3x units, then waves x1.3), so the rate is divided by 3.9 to keep the shop prices.
  const FIRST_BONUS = 0.5;   // first clear pays 50% extra
  const REPEAT = 0.25;       // replays and losses pay a quarter
  const SLOTS = 2;           // specialist slots in the loadout
  const SPECIALISTS = ['net', 'nk'];
  const UNIT_ORDER = ['neut', 'net', 'nk', 'mac'];

  // Where each map sits on the body (viewBox 0 0 724 1448, the body art's). Every map is a wound there, named "Stage N: <where>" (Alex, 2026-10-08).
  // Unknown levels fall back to a spot by the side.
  const PLACES = {
    papercut: { where: 'Finger', x: 636, y: 756 }, hospital: { where: 'Elbow', x: 176, y: 472 },
    pool: { where: 'Ear', x: 290, y: 172 }, flu: { where: 'Nose', x: 362, y: 168 }, soil: { where: 'Knee', x: 282, y: 944 },
    foot: { where: 'Foot', x: 434, y: 1296 }, lungs: { where: 'Chest', x: 294, y: 356 }, throat: { where: 'Neck', x: 362, y: 270 },
    coldsore: { where: 'Lip', x: 362, y: 220 }, gut: { where: 'Belly', x: 362, y: 560 },
  };

  // What a vaccine is called and covers (wormlets share the Tapeworm's, hatched Clostridium the spore's)
  const VACCINE_OF = { staph: 'staph', mrsa: 'mrsa', pseudo: 'pseudo', flu: 'flu', spore: 'clos', clos: 'clos', tb: 'tb', toxic: 'toxic', strep: 'strep', virus: 'virus', worm: 'worm', wormlet: 'worm', yeast: 'yeast' };
  const VACCINE_COST = 120;
  const vaccineWhat = k => k === 'flu' ? 'Influenza stops splitting.' : k === 'virus' ? "Herpes can't hide in your neutrophils." : k === 'mrsa' || k === 'worm' ? 'Shots and nets do 1 extra damage to it.' : 'Shots and nets do 1 extra damage to it, and macrophages swallow it twice as fast.';

  // ---- upgrades: bought with Samples, kept all campaign ----
  const pct = x => `${Math.round(x * 100)}%`;
  const UPGRADES = [
    { id: 'marrow', group: 'Production', name: 'Production rate', cost: [80, 160, 260], what: r => `Cells are made ${pct(0.05 * r)} faster.`, apply: (C, r) => { C.marrow.rate *= 1 + 0.05 * r; } },
    { id: 'heart', group: 'Production', name: 'Big heart', cost: [100, 200, 320], what: r => `Stress tops out at ${Math.round((2 + 0.15 * r) * 100)}%.`, apply: (C, r) => { C.output.max += 0.15 * r; } },
    { id: 'trigger', group: 'Neutrophils', name: 'Quick trigger', cost: [80, 160, 260], what: r => `Neutrophils fire ${pct(1 / (1 - 0.03 * r) - 1)} more often.`, apply: (C, r) => { C.neutrophil.fireEvery *= 1 - 0.03 * r; } },
    { id: 'life', group: 'Neutrophils', name: 'Long-lived', cost: [60, 120, 200], what: r => `Neutrophils live ${1.5 * r} s longer.`, apply: (C, r) => { C.neutrophil.life += 1.5 * r; } },
    { id: 'nets', group: 'Neutrophils', name: 'Wide nets', cost: [70, 140, 220], need: 'net', what: r => `Net neutrophil pens are ${pct(0.12 * r)} wider.`, apply: (C, r) => { C.net.burst *= 1 + 0.12 * r; } },
    { id: 'gulp', group: 'Macrophages', name: 'Big appetite', cost: [90, 180, 280], what: r => `Macrophages on Offense swallow ${pct(1 / (1 - 0.15 * r) - 1)} more often.`, apply: (C, r) => { C.macrophage.eatEvery *= 1 - 0.15 * r; } },
    { id: 'rings', group: 'Macrophages', name: 'Wide rings', cost: [90, 180, 280], what: r => `Support rings are ${pct(0.1 * r)} wider.`, apply: (C, r) => { C.support.ring *= 1 + 0.1 * r; } },
    { id: 'macs', group: 'Macrophages', name: 'Reserve', cost: [80, 160, 260], what: r => `${6 * r} more macrophages allowed at once.`, apply: (C, r) => { C.caps.mac += 6 * r; } },
    { id: 'nk', group: 'Specialists', name: 'Hardy NK cells', cost: [70, 140, 220], need: 'nk', what: r => `NK cells are ${pct(0.2 * r)} faster and live ${15 * r} s longer.`, apply: (C, r) => { C.nk.speed *= 1 + 0.2 * r; C.nk.life += 15 * r; } },
    { id: 'recover', group: 'Body', name: 'Fast recovery', cost: [80, 160, 260], what: r => `Fatigue recovers ${pct(0.12 * r)} faster.`, apply: (C, r) => { C.output.recover *= 1 + 0.12 * r; } },
    { id: 'stamina', group: 'Body', name: 'Stamina', cost: [100, 200, 320], what: r => `You can hold ${Math.round((1.15 + 0.06 * r) * 100)}% stress before tiring.`, apply: (C, r) => { C.output.rest += 0.06 * r; } },
    { id: 'cool', group: 'Body', name: 'Cool head', cost: [70, 140, 220], what: r => `Storm afterburn is ${1.5 * r} s shorter.`, apply: (C, r) => { C.storm.after = Math.max(1, C.storm.after - 1.5 * r); } },
  ];

  // ---- treatments: one per map, passive, cost on that map only (Alex, 2026-10-08) ----
  const TREATMENTS = [
    { id: 'none', name: 'No treatment', plus: 'Nothing changes.', minus: '' },
    { id: 'antibiotics', name: 'Antibiotics', plus: 'Shots and nets do double damage to bacteria.', minus: 'About 1 in 5 arriving bacteria are resistant: armored like MRSA.', apply: () => {} },
    { id: 'antifungals', name: 'Antifungals', plus: 'Fungus threads creep a third as fast, bud a third as often, and yeast dies in half the hits.', minus: 'Hard on the liver: fatigue recovers 1% slower.',
      apply: C => { C.fungus.grow *= 3; C.fungus.budEvery *= 3; C.fungus.hp = Math.max(1, Math.ceil(C.fungus.hp / 2)); C.output.recover *= 0.99; } },
    { id: 'antivirals', name: 'Antivirals', plus: "Herpes can't hide in your cells and Influenza can't split.", minus: 'Bacteria divide 20% faster.',
      apply: C => { C.herpes.seek = 0; C.flu.split = 1; for (const k of ['staph', 'mrsa', 'pseudo', 'clos', 'tb', 'toxic']) C[k].doubling /= 1.2; } },
    { id: 'steroids', name: 'Steroids', plus: 'Calms the body: fatigue builds half as fast and the storm costs 30 instead of 50.', minus: 'You make 30% fewer cells.',
      apply: C => { C.output.tire *= 0.5; C.storm.cost *= 0.6; C.marrow.rate *= 0.7; } },
    { id: 'fever', name: 'Fever reducer', plus: 'Every fatigue tier starts 10 points later.', minus: "Fever no longer slows bacteria: they divide at full speed even when you're tired.",
      apply: C => { C.fatigue.tired += 10; C.fatigue.feverish += 10; C.fatigue.exhausted += 10; if (C.fever) C.fever.on = 0; } },
  ];
  const treatment = id => TREATMENTS.find(t => t.id === id) || TREATMENTS[0];

  // ---- campaign state ----
  const fresh = () => ({ v: 1, samples: 0, cleared: {}, plays: {}, upgrades: {}, vaccines: {}, loadout: null, treat: {}, earned: 0, seen: {} });

  // The Clinic opens one part at a time over the first stages, each with a short note (Alex, 2026-10-08).
  // Stage 1 has no Clinic. A part opens once you reach that stage (0-based), and stays open on replays.
  const CLINIC = [
    { id: 'shop', tab: 'Shop', at: 1, title: 'The Clinic',
      text: 'Before each stage you prepare the patient here. Kills earn Samples. Spend them in the Shop on upgrades that last the whole campaign. More of the Clinic opens over the next stages.' },
    { id: 'treat', tab: 'Treatment', at: 2, title: 'New: Treatment',
      text: 'Pick one drug for this stage. Each one helps a lot and costs you something, on this stage only. No treatment is a fine choice.' },
    { id: 'vax', tab: 'Vaccines', at: 3, title: 'New: Vaccines',
      text: "Vaccinate against a germ you've already met. You pay once, and your cells hit it harder for the rest of the campaign." },
    { id: 'loadout', tab: 'Loadout', at: 4, title: 'New: Loadout',
      text: `Choose which specialists come to a stage. Neutrophils and macrophages always come, plus up to ${SLOTS} specialists.` },
  ];
  const clinicOpen = (st, order) => CLINIC.filter(c => reached(st, order) >= c.at);
  // A map is open once the one before it is cleared
  function isOpen(st, order, key) { const i = order.indexOf(key); return i === 0 || !!st.cleared[order[i - 1]]; }
  function reached(st, order) { let i = 0; while (i < order.length - 1 && st.cleared[order[i]]) i++; return i; }
  function kindsIn(lv) {
    const s = new Set();
    for (const w of lv.waves) for (const k in VALUE) if (w[k]) s.add(k);
    for (const x of (lv.stream && lv.stream.kinds) || []) s.add(x.k);
    return s;
  }
  // Specialists unlock free when you reach the map that introduces them (PvZ style)
  function unlocked(st, levels, order) {
    const upTo = reached(st, order), out = [];
    for (const sp of SPECIALISTS) { const at = order.findIndex(k => levels[k].units.includes(sp)); if (at >= 0 && at <= upTo) out.push(sp); }
    return out;
  }
  function unlockAt(sp, levels, order) { return order.find(k => levels[k].units.includes(sp)); }
  // Antigens you've met: in any map you've played
  function met(st, levels, order) {
    const s = new Set();
    for (const k of order) if (st.plays[k] || st.cleared[k]) for (const x of kindsIn(levels[k])) s.add(VACCINE_OF[x]);
    return [...s].filter(Boolean);
  }
  function loadout(st, levels, order) {
    const un = unlocked(st, levels, order);
    const pick = Array.isArray(st.loadout) ? st.loadout.filter(x => un.includes(x)) : un.slice(0, SLOTS);
    // newly unlocked specialists join while there's a free slot
    for (const x of un) if (pick.length < SLOTS && !pick.includes(x) && !(st.dropped || []).includes(x)) pick.push(x);
    return pick.slice(0, SLOTS);
  }
  const unitsFor = pick => UNIT_ORDER.filter(u => u === 'neut' || u === 'mac' || pick.includes(u));
  const rank = (st, id) => st.upgrades[id] || 0;
  const nextCost = (st, u) => u.cost[rank(st, u.id)];

  // ---- per-map setup ----
  function applyConfig(C, base, st, treatId) {
    for (const g in base) if (C[g]) Object.assign(C[g], base[g]);
    for (const u of UPGRADES) { const r = rank(st, u.id); if (r) u.apply(C, r); }
    if (st.vaccines.virus) C.herpes.seek = 0;
    const t = treatment(treatId); if (t.apply) t.apply(C);
  }
  // Wrap one Game: count Samples, antibiotics and vaccines. Returns the tracker.
  function instrument(game, st, treatId) {
    const vac = k => !!st.vaccines[VACCINE_OF[k]];
    const anti = treatId === 'antibiotics';
    const tr = { value: 0, kills: 0, storm: 0, cut: 0, paid: false, treat: treatId };
    const tick = game.tick, damage = game.damage, spawnAg = game.spawnAg, stepAntigens = game.stepAntigens, stepMac = game.stepMac;
    let dividing = false;
    game.tick = function (key, n) {
      if (key.startsWith('kill.')) {
        const p = key.split('.'), how = p[1], k = p[2];
        if (how === 'storm') tr.storm += n || 1; // nothing to learn from a massacre
        else { tr.value += (VALUE[k] || 1) * (n || 1); tr.kills += n || 1; }
      } else if (key.startsWith('cut.')) { tr.value += CUT_VALUE * (n || 1); tr.cut += n || 1; }
      return tick.call(this, key, n);
    };
    game.damage = function (a, n, how, hu, hv) {
      if (how === 'shot' || how === 'net') {
        if (anti && BACTERIA.has(a.k)) n *= 2;
        if (vac(a.k)) n += 1;
      }
      return damage.call(this, a, n, how, hu, hv);
    };
    game.stepAntigens = function (dt) { dividing = true; try { return stepAntigens.call(this, dt); } finally { dividing = false; } };
    game.spawnAg = function (k, u, v, extra) {
      // antibiotics: some arriving bacteria are resistant (not their offspring, or resistance would snowball)
      if (anti && !dividing && (k === 'staph' || k === 'pseudo' || k === 'toxic') && this.rand() < 0.2) k = 'mrsa';
      const a = spawnAg.call(this, k, u, v, extra);
      if (a && k === 'flu' && vac('flu')) a.split = true;
      return a;
    };
    game.stepMac = function (m, dt, slow) {
      const had = m.prey;
      const out = stepMac.call(this, m, dt, slow);
      if (!had && m.prey && m.prey.k && vac(m.prey.k)) m.gulp *= 0.5;
      return out;
    };
    game.campaign = tr;
    return tr;
  }
  // Campaign pressure: maps later in the run send more, because you arrive with upgrades (authored, the same for
  // everyone, never reacting to how you're doing). PRESSURE[i] multiplies map i's waves and trickle.
  const PRESSURE_END = 1.5;
  const pressure = (i, n) => 1 + (PRESSURE_END - 1) * (n > 1 ? i / (n - 1) : 0);
  function scaleLevel(lv, p) { // always a copy, so the caller can change it freely
    const out = JSON.parse(JSON.stringify(lv));
    for (const w of out.waves) for (const k in VALUE) if (w[k] && k !== 'worm') w[k] = Math.max(1, Math.round(w[k] * p));
    out.stream.start *= p; out.stream.end *= p;
    return out;
  }
  // A map's germs are finite: kills pay up to the value of what the level sends in (waves plus trickle),
  // so letting bacteria multiply to farm their offspring doesn't pay
  function budget(lv, C) {
    let v = 0;
    for (const w of lv.waves) for (const k in VALUE) if (w[k]) v += w[k] * VALUE[k] * (k === 'strep' ? C.strep.links : k === 'worm' ? C.worm.segments : 1);
    const S = lv.stream, tot = S.kinds.reduce((a, x) => a + x.w, 0);
    const per = S.kinds.reduce((a, x) => a + x.w / tot * VALUE[x.k] * (1 - (x.from || 0) / lv.duration), 0);
    v += (S.start + S.end) / 2 * lv.duration * ((C.trickle && C.trickle.mul) || 1) * per;
    return v;
  }
  // What a finished map pays; first clears get a bonus, replays and losses a quarter
  function payout(st, key, tr, win, lv, C) {
    const base = Math.round(Math.min(tr.value, lv && C ? budget(lv, C) : Infinity) * RATE);
    const first = win && !st.cleared[key];
    const total = first ? Math.round(base * (1 + FIRST_BONUS)) : Math.round(base * REPEAT);
    return { base, first, total, bonus: first ? total - base : 0 };
  }

  return { BACTERIA, VALUE, RATE, FIRST_BONUS, REPEAT, SLOTS, SPECIALISTS, PLACES, UPGRADES, TREATMENTS, VACCINE_OF, VACCINE_COST, vaccineWhat,
    budget, pressure, scaleLevel, treatment, fresh, CLINIC, clinicOpen, isOpen, reached, kindsIn, unlocked, unlockAt, met, loadout, unitsFor, rank, nextCost, applyConfig, instrument, payout };
})();

if (typeof module !== 'undefined') module.exports = CAMPAIGN;

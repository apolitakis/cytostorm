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
  // Filled from the sim's UNIT table at boot (setUnits), so new units join the loadout without changes here
  const SPECIALISTS = ['net', 'nk'];
  const UNIT_ORDER = ['neut', 'net', 'nk', 'mac'];
  function setUnits(keys) {
    UNIT_ORDER.splice(0, UNIT_ORDER.length, ...keys);
    SPECIALISTS.splice(0, SPECIALISTS.length, ...keys.filter(k => k !== 'neut' && k !== 'mac'));
  }

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
  // Germ cards in the Clinic: what it does, what beats it (unit = the cell that counters it), keyed like vaccines
  // units = the cells that counter it, best first; the card and the loadout warning only nag when none of them is packed.
  // Play V39's units (Alex, 2026-10-10) each answer their own stage's new germ.
  const GERM = {
    staph: { does: 'Drifts toward the Lymph node and doubles. Big crowds set off quorum bursts.', beat: 'Neutrophils shoot it; macrophages swallow it.', units: ['neut'] },
    mrsa: { does: 'Armored. Plain shots barely scratch it and macrophages spit it out.', beat: 'Support macrophages tune shots to kill it in one hit. B cells tag it so macrophages can swallow it.', units: ['mac', 'bcell'], art: 'macrophage-support' },
    pseudo: { does: 'Settles and grows a slime dome that shots, nets and storms bounce off.', beat: 'Offense macrophages tear the domes down. Eosinophils latch on and pop them.', units: ['mac', 'eos'] },
    flu: { does: 'Tiny, fast swarms. Each one that reaches the Tissue splits.', beat: 'Net neutrophils wipe out whole clusters.', units: ['net'] },
    clos: { does: 'Spores sit inert, then hatch into fast-dividing bacteria.', beat: 'A platelet wall holds the hatch; nets pen it.', units: ['plt', 'net'] },
    tb: { does: 'Slow and tough. A macrophage that swallows it turns into a TB factory.', beat: 'NK cells kill infected macrophages.', units: ['nk'] },
    toxic: { does: 'While any are alive, fatigue builds much faster.', beat: 'Kill it fast with neutrophils. Regulatory T cells calm the fatigue it causes.', units: ['treg'] },
    strep: { does: 'Chains sprint for the Lymph node. Shooting a link splits the chain.', beat: 'Macrophages swallow links without splitting them. A platelet wall stops the sprint.', units: ['mac', 'plt'] },
    virus: { does: 'Hides inside your neutrophils and bursts out of them later.', beat: 'NK cells pop infected neutrophils. Interferon haze stops it hiding.', units: ['nk', 'ifn'] },
    worm: { does: 'The boss. Crawls to the Lymph node; broken segments become small fast worms.', beat: 'Mast cell mucus slows its crawl and eosinophils pop its segments.', units: ['mast', 'eos'] },
    yeast: { does: 'Grows threads toward the Lymph node that other germs ride. Shots pass through them.', beat: 'Net neutrophils cut the threads. Eosinophils pop yeast and threads.', units: ['net', 'eos'] },
  };
  // When a germ (vaccine key) shows up in a stage, from its wave list and the trickle between waves
  function arrival(lv, kind) {
    const n = lv.waves.length, at = [];
    lv.waves.forEach((w, i) => { if (Object.keys(w).some(k => VACCINE_OF[k] === kind && w[k] > 0)) at.push(i + 1); });
    const drip = ((lv.stream && lv.stream.kinds) || []).some(x => VACCINE_OF[x.k] === kind);
    const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : `${a[0]}`;
    let s = '';
    if (at.length === n) s = 'Every wave';
    else if (at.length === 1) s = at[0] === n ? 'The final wave' : at[0] === 1 ? 'The first wave' : `Wave ${at[0]} of ${n}`;
    else if (at.length > 1 && at[at.length - 1] === n && at.length === n - at[0] + 1) s = `From wave ${at[0]} on`;
    else if (at.length) s = `Waves ${list(at)} of ${n}`;
    if (drip) s = s ? `${s}, and trickles in between` : 'Trickles in between waves';
    return s;
  }
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
    // one line per Play V39 unit (Alex, 2026-10-10), locked until the unit joins
    { id: 'bcell', group: 'Specialists', name: 'Big clouds', cost: [70, 140, 220], need: 'bcell', what: r => `B cell antibody clouds are ${pct(0.15 * r)} wider.`, apply: (C, r) => { C.bcell.cloud *= 1 + 0.15 * r; } },
    { id: 'eos', group: 'Specialists', name: 'Short fuse', cost: [70, 140, 220], need: 'eos', what: r => `Eosinophils pop ${pct(0.15 * r)} sooner after latching on.`, apply: (C, r) => { C.eos.charge *= 1 - 0.15 * r; } },
    { id: 'plt', group: 'Specialists', name: 'Tough clots', cost: [70, 140, 220], need: 'plt', what: r => `Platelets hold the wall ${3 * r} s longer.`, apply: (C, r) => { C.plt.hp += 3 * r; } },
    { id: 'dc', group: 'Specialists', name: 'Swift couriers', cost: [70, 140, 220], need: 'dc', what: r => `Dendritic couriers walk ${pct(0.2 * r)} faster.`, apply: (C, r) => { C.dc.speed *= 1 + 0.2 * r; } },
    { id: 'treg', group: 'Specialists', name: 'Deep calm', cost: [70, 140, 220], need: 'treg', what: r => `Each Regulatory T cell calms fatigue by ${5 + r}% instead of 5%.`, apply: (C, r) => { C.treg.calm += 0.01 * r; } },
    { id: 'ifn', group: 'Specialists', name: 'Wide haze', cost: [70, 140, 220], need: 'ifn', what: r => `Interferon haze is ${pct(0.15 * r)} wider.`, apply: (C, r) => { C.ifn.haze *= 1 + 0.15 * r; } },
    { id: 'mast', group: 'Specialists', name: 'Long mucus', cost: [70, 140, 220], need: 'mast', what: r => `Mast cell mucus lasts ${1.5 * r} s longer.`, apply: (C, r) => { C.mast.mucus += 1.5 * r; } },
    { id: 'recover', group: 'Body', name: 'Fast recovery', cost: [80, 160, 260], what: r => `Fatigue recovers ${pct(0.12 * r)} faster.`, apply: (C, r) => { C.output.recover *= 1 + 0.12 * r; } },
    { id: 'stamina', group: 'Body', name: 'Stamina', cost: [100, 200, 320], what: r => `You can hold ${Math.round(6 * r)}% more Stress before tiring (${Math.round((1.15 + 0.06 * r) * 100)}% with no sector on Support).`, apply: (C, r) => { C.output.rest += 0.06 * r; } }, // V41: restLevel() subtracts Support upkeep from this
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
  const fresh = () => ({ v: 1, samples: 0, cleared: {}, plays: {}, upgrades: {}, vaccines: {}, loadout: null, treat: {}, earned: 0, seen: {}, diff: null });

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
  // Once there are more specialists by Stage 4 than slots, Loadout opens there and Vaccines moves to Stage 5
  function clinicAt(order, levels) {
    const early = levels ? SPECIALISTS.filter(sp => { const i = order.findIndex(k => levels[k].units.includes(sp)); return i >= 0 && i <= 3; }).length : 0;
    return early > SLOTS ? { loadout: 3, vax: 4 } : {};
  }
  const clinicOpen = (st, order, levels) => {
    const at = clinicAt(order, levels);
    return CLINIC.map(c => (c.id in at ? Object.assign({}, c, { at: at[c.id] }) : c)).sort((a, b) => a.at - b.at).filter(c => reached(st, order) >= c.at);
  };
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
  // Until you pick, a stage brings its own new unit, then the best counter (first in GERM.units) of its germs that
  // nothing packed answers yet (its new germs count double), then the next specialists in the sim's order
  function suggest(st, levels, order, key) {
    const un = unlocked(st, levels, order);
    if (!key || !levels[key]) return un.slice(0, SLOTS);
    const seen = new Set();
    for (const k of order.slice(0, order.indexOf(key))) for (const x of kindsIn(levels[k])) seen.add(VACCINE_OF[x]);
    const germs = [...new Set([...kindsIn(levels[key])].map(y => VACCINE_OF[y]))].filter(x => GERM[x]);
    const pick = un.filter(u => unlockAt(u, levels, order) === key).slice(0, SLOTS);
    const best = x => GERM[x].units.find(u => u === 'neut' || u === 'mac' || un.includes(u));
    while (pick.length < Math.min(SLOTS, un.length)) {
      const score = u => germs.reduce((s, x) => s + (best(x) === u ? (seen.has(x) ? 1 : 2) : 0), 0);
      const rest = un.filter(u => !pick.includes(u));
      pick.push(rest.reduce((b, u) => (score(u) > score(b) ? u : b), rest[0]));
    }
    return pick;
  }
  // Germs on a stage whose counters are unlocked but none packed: [[germ, [unlocked counters]]]
  function gaps(st, levels, order, key, pick) {
    const un = unlocked(st, levels, order), units = unitsFor(pick), out = [];
    for (const x of new Set([...kindsIn(levels[key])].map(y => VACCINE_OF[y]))) {
      const g = GERM[x]; if (!g || g.units.some(u => units.includes(u))) continue;
      const can = g.units.filter(u => un.includes(u)); if (can.length) out.push([x, can]);
    }
    return out;
  }
  function loadout(st, levels, order, key) {
    const un = unlocked(st, levels, order);
    const pick = Array.isArray(st.loadout) ? st.loadout.filter(x => un.includes(x)) : suggest(st, levels, order, key);
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
  // capMul: Hard sends more germs (DIFFICULTIES.hard.waves), so its cap grows with them
  function payout(st, key, tr, win, lv, C, capMul = 1) {
    const base = Math.round(Math.min(tr.value, lv && C ? budget(lv, C) * capMul : Infinity) * RATE);
    const first = win && !st.cleared[key];
    const total = first ? Math.round(base * (1 + FIRST_BONUS)) : Math.round(base * REPEAT);
    return { base, first, total, bonus: first ? total - base : 0 };
  }

  return { BACTERIA, VALUE, RATE, FIRST_BONUS, REPEAT, SLOTS, SPECIALISTS, setUnits, PLACES, UPGRADES, TREATMENTS, VACCINE_OF, VACCINE_COST, vaccineWhat, GERM, arrival,
    budget, pressure, scaleLevel, treatment, fresh, CLINIC, clinicOpen, isOpen, reached, kindsIn, unlocked, unlockAt, met, suggest, gaps, loadout, unitsFor, rank, nextCost, applyConfig, instrument, payout };
})();

if (typeof module !== 'undefined') module.exports = CAMPAIGN;

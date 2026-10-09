'use strict';
// ---------------------------------------------------------------------------
// Immune RTS prototype v3: simulation. No DOM, so it also runs headless under
// node (see src/headless.js). Builds on v2 with:
// - per-zone production mixes (each zone's card decides what fights there),
// - physics: every body has mass and velocity, bodies collide and get knocked,
// - the antigen roster (notes/antigen-roster.md) and the cytokine storm.
//
// World coordinates: u runs along the lymph flow (0 = wound end, L = lymph
// node end), v runs across it (0 = blood vessel edge).
// ---------------------------------------------------------------------------

// Every tunable number. The dev panel and the tuner edit these; the sim reads them each tick.
const DEFAULTS = {
  marrow:     { rate: 10.8, neut: 1, net: 4, nk: 5, mac: 6 },
  caps:       { cells: 540, mac: 54, nk: 36 },
  start:      { neut: 90, mac: 12 },
  output:     { start: 0.5, min: 0.5, max: 2, rest: 1.15, tire: 1.2, recover: 1.2, curve: 0.585 },
  fatigue:    { tired: 35, feverish: 60, exhausted: 85, tiredSpeed: 0.85, feverSpread: 0.3, feverLife: 0.7, exhaustedRing: 0.6, max: 150 },
  organs:     { dmg: 0.008, knee: 25, overRecover: 4, heal: 60, otherFloor: 1, wHeart: 1, wKidney: 0.8, wLungs: 0.6, wLiver: 0.6, wSpleen: 0.4, wBrain: 0.5, heart3: 1.75, heart2: 1.5, heart1: 1.25, kidney3: 0.75, kidney2: 0.5, kidney1: 0.25, lungs3: 0.9, lungs2: 0.8, lungs1: 0.7, liver3: 0.85, liver2: 0.7, liver1: 0.55, spleen3: 450, spleen2: 360, spleen1: 270, brain3: 1.2, brain2: 1.4, brain1: 1.6, brainJitter: 150, brainDelay: 3 },
  physics:    { stiff: 0.6, bounce: 0.25, flowGrip: 1.5, brownian: 45 },
  neutrophil: { speed: 52, accel: 320, radius: 3, range: 54, fireEvery: 0.7, life: 25, turnEvery: 0.3, zigzag: 1.4, stray: 0.2, standoff: 28, shotSpeed: 420, spread: 0.32, leash: 25 },
  net:        { speed: 64, radius: 3.4, burst: 30, damage: 1, fuse: 8, stick: 2.5 },
  nk:         { speed: 34, radius: 4, life: 60, reach: 9 },
  macrophage: { speed: 22, radius: 8, eatEvery: 2, gulp: 0.45, reach: 12 },
  support:    { ring: 50, speedMul: 1.5 },
  bacteria:   { maxCount: 1350, drift: 10, crowdDrift: 0.08, crowdStart: 180, crowdRadius: 8, crowdMax: 5, jitter: 0.25, knock: 40, maxSpeed: 70 },
  staph:      { hp: 3, doubling: 10, radius: 2.4 },
  mrsa:       { hp: 12, doubling: 20, radius: 3.2 },
  pseudo:     { hp: 3, doubling: 20, radius: 2.6, settle: 6, domeMax: 30, domeGrow: 2, domeHp: 4, domeCap: 18, shield: 0.25 },
  flu:        { radius: 1.6, speed: 24, split: 3 },
  spore:      { hatch: 30, radius: 2.2 },
  clos:       { hp: 2, doubling: 6, radius: 2.4 },
  tb:         { hp: 12, doubling: 30, radius: 3.6, infectLife: 30, spitEvery: 6, macHp: 10 },
  toxic:      { hp: 3, doubling: 12, radius: 2.5, fatigueMul: 2 },
  strep:      { hp: 2, radius: 2.4, speed: 20, links: 8 },
  herpes:     { radius: 1.5, speed: 30, seek: 120, incubate: 8, burst: 8, life: 40 },
  worm:       { segments: 12, segHp: 99, radius: 9, cross: 120, tunedDamage: 5, wormletHp: 5, wormletSpeed: 26 },
  fungus:     { hp: 4, radius: 3, settle: 5, grow: 1.1, seg: 9, maxSegs: 45, branch: 0.12, wiggle: 0.35, budEvery: 20, highway: 2.5, reach: 7, wither: 3, chew: 3, cap: 2100 },
  storm:      { kill: 0.7, friendly: 0.4, cost: 50, after: 8, afterRate: 2, worm: 0.15, stun: 3, windup: 1, charge: 5 },
  toxin:      { warn: 2, notice: 6, sweep: 0.6 },
  quorum:     { n: 20, radius: 20, fuse: 10, pull: 45, suck: 70, pop: 100, germRadius: 20, germKill: 0.5, cooldown: 15, check: 0.5, badge: 36 },
  lymph:      { fill: 20, drain: 60, crowd: 0.033, crowdCap: 2, leak: 0.25 },
  wall:       { soft: 0.12 },
  trickle:    { mul: 2.6 },
  wave:       { pour: 1.2 },
  evolve:     { on: 1, share: 0.75, min: 60, max: 2, warn: 5, wall: 0.75, slick: 0.5, hardy: 0.5 },
  fever:      { on: 1, tired: 0.85, feverish: 0.6, exhausted: 0.45 },
};

// One line per tunable, shown in the dev panel and the tuner.
const HINTS = {
  'marrow.rate': 'Marrow output at 100% stress, in neutrophil-sized cells per second across all three zones.',
  'marrow.neut': 'Production cost of a neutrophil (1 = one neutrophil).',
  'marrow.net': 'Production cost of a net neutrophil, in neutrophils.',
  'marrow.nk': 'Production cost of an NK cell, in neutrophils.',
  'marrow.mac': 'Production cost of a macrophage, in neutrophils.',
  'wall.soft': 'Vessel wall limit: how much one sector can take beyond its even share. Lower = focusing on fewer sectors wastes more output (0.12: 2 sectors on make 60%, 1 sector 33%).',
  'evolve.on': 'Evolution on (1) or off (0): germs adapt to the way you mostly kill them.',
  'evolve.share': 'Before each wave, a germ kind evolves if one kill method did at least this share of its kills since the last wave.',
  'evolve.min': 'Kills of a kind since the last wave needed before it can evolve.',
  'evolve.max': 'Most traits one kind can evolve in a level.',
  'evolve.warn': 'Seconds before the wave that the evolution is announced.',
  'evolve.wall': 'Thick wall (vs plain shots): plain shots do this much damage.',
  'evolve.slick': 'Slick coat (vs Nets): Net damage multiplier.',
  'evolve.hardy': 'Hardy (vs the storm): storm kill chance multiplier.',
  'fever.on': 'Fever slows division on (1) or off (0). The campaign\'s Fever reducer switches it off.',
  'fever.tired': 'Fever slows division: bacteria divide at this speed while you are Tired (1 = normal). Viruses don\'t care.',
  'fever.feverish': 'Bacteria division speed while Feverish.',
  'fever.exhausted': 'Bacteria division speed while Exhausted.',
  'wave.pour': 'Seconds a wave takes to pour in (Alex, 2026-10-08: a big rush, not one frame). Most of it lands early: half in the first third.',
  'trickle.mul': 'Multiplies every level\'s trickle between waves (Alex, 2026-10-08: it should pose a real threat).',
  'caps.cells': 'Most of your cells on the field at once.',
  'caps.mac': 'Most macrophages at once (Support is meant to be scarce).',
  'caps.nk': 'Most NK cells at once.',
  'start.neut': 'Neutrophils on the field at 0:00, spread over the zones.',
  'start.mac': 'Macrophages on the field at 0:00.',
  'output.start': 'Stress slider position at 0:00 (0 = lowest, 1 = highest; 0.5 = 100%).',
  'output.min': 'Stress with the slider all the way down (1 = 100%).',
  'output.max': 'Stress with the slider all the way up.',
  'output.rest': 'Stress the body can sustain: above it fatigue builds, below it fatigue recovers.',
  'output.curve': 'Diminishing returns: cell output = stress to this power (0.585: 200% stress makes 1.5x the cells, Alex 2026-10-08). 1 = no diminishing returns.',
  'output.tire': 'Fatigue points per second for each 1x of output above rest.',
  'output.recover': 'Fatigue points per second recovered for each 1x of output below rest.',
  'fatigue.tired': 'Fatigue (0-100) where Tired starts: your cells move slower.',
  'fatigue.feverish': 'Fatigue where Feverish starts: neutrophil shots spray and neutrophils die sooner.',
  'fatigue.exhausted': 'Fatigue where Exhausted starts: Support rings shrink.',
  'fatigue.tiredSpeed': 'Speed multiplier for all your cells while Tired or worse.',
  'fatigue.feverSpread': 'Extra aim wobble (radians) while Feverish or worse.',
  'fatigue.feverLife': 'Neutrophil lifespan multiplier while Feverish or worse.',
  'fatigue.exhaustedRing': 'Support ring size multiplier while Exhausted.',
  'fatigue.max': 'Highest fatigue can go. Past 100 is Overload: every organ takes damage.',
  'organs.dmg': 'Organ bars lost per second for each point of fatigue over 100 (before the weight and the knee).',
  'organs.knee': 'Damage grows with overload: at this many points over 100 it is doubled per point.',
  'organs.overRecover': 'While over 100, recovery runs this many times faster than normal.',
  'organs.heal': 'Seconds to regain one bar of liver or lungs while Fine (0 = no healing). Heart, kidneys and spleen never heal in a match.',
  'organs.otherFloor': 'Lowest bars a non-overload hit (a leak, toxin) can leave an organ at. 1 = only overload can take the last bar.',
  'organs.wHeart': 'Share of overload damage the heart takes (1 = full).',
  'organs.wKidney': 'Share of overload damage the kidneys take.',
  'organs.wLungs': 'Share of overload damage the lungs take.',
  'organs.wLiver': 'Share of overload damage the liver takes.',
  'organs.wSpleen': 'Share of overload damage the spleen takes.',
  'organs.wBrain': 'Share of overload damage the brain takes.',
  'organs.brain3': 'Wander multiplier for all your cells with the brain at 3 bars (1.2 = 20% more).',
  'organs.brain2': 'Wander multiplier at 2 brain bars (production mix changes are also delayed).',
  'organs.brain1': 'Wander multiplier at 1 brain bar (plus delirium on screen).',
  'organs.brainJitter': 'Random push (per second) given to every cell for each 1.0 of extra wander.',
  'organs.brainDelay': 'Seconds a production mix change takes to kick in with the brain at 2 bars or fewer.',
  'organs.heart3': 'Top stress with the heart at 3 bars.',
  'organs.heart2': 'Top stress at 2 heart bars.',
  'organs.heart1': 'Top stress at 1 heart bar.',
  'organs.kidney3': 'Recovery speed multiplier with the kidneys at 3 bars.',
  'organs.kidney2': 'Recovery multiplier at 2 kidney bars.',
  'organs.kidney1': 'Recovery multiplier at 1 kidney bar.',
  'organs.lungs3': 'Speed multiplier for all your cells with the lungs at 3 bars (stacks with Tired).',
  'organs.lungs2': 'Cell speed multiplier at 2 lung bars.',
  'organs.lungs1': 'Cell speed multiplier at 1 lung bar.',
  'organs.liver3': 'Cell production multiplier with the liver at 3 bars.',
  'organs.liver2': 'Production multiplier at 2 liver bars.',
  'organs.liver1': 'Production multiplier at 1 liver bar.',
  'organs.spleen3': 'Total cell limit with the spleen at 3 bars.',
  'organs.spleen2': 'Total cell limit at 2 spleen bars.',
  'organs.spleen1': 'Total cell limit at 1 spleen bar.',
  'physics.stiff': 'How hard overlapping bodies push apart each tick (0-1).',
  'physics.bounce': 'How bouncy collisions are (0 = dead stop, 1 = billiard balls).',
  'physics.flowGrip': 'How quickly bacteria settle back into the lymph flow after a knock.',
  'physics.brownian': 'Random jostling force on bacteria.',
  'neutrophil.speed': 'Units per second (zones are 300 long).',
  'neutrophil.accel': 'How fast a neutrophil can change velocity. Lower feels heavier.',
  'neutrophil.radius': 'Body size for collisions.',
  'neutrophil.range': 'Firing range.',
  'neutrophil.fireEvery': 'Seconds between shots.',
  'neutrophil.life': 'Seconds a neutrophil lives.',
  'neutrophil.turnEvery': 'Seconds between zigzag turns.',
  'neutrophil.zigzag': 'How far each turn can veer off the target line (radians).',
  'neutrophil.stray': 'Chance each turn heads somewhere completely random instead.',
  'neutrophil.standoff': 'Neutrophils stop closing in at about this distance.',
  'neutrophil.shotSpeed': 'Antibody bullet speed.',
  'neutrophil.spread': 'Aim wobble in radians; more means more misses.',
  'neutrophil.leash': 'How far past its zone edge a cell will chase before turning back.',
  'net.speed': 'Net neutrophil speed while running to the thickest crowd.',
  'net.burst': 'Radius of the pen a net neutrophil throws up around the crowd.',
  'net.damage': 'Damage the net does to everything small inside it.',
  'net.fuse': 'Seconds before a net neutrophil bursts wherever it is.',
  'net.stick': 'Seconds the pen holds antigens in (it tightens as it fades).',
  'nk.speed': 'NK cell speed.',
  'nk.life': 'Seconds an NK cell lives.',
  'nk.reach': 'How close an NK cell must get to pop an infected cell.',
  'macrophage.speed': 'Units per second.',
  'macrophage.eatEvery': 'Seconds between swallows on Offense.',
  'pseudo.shield': 'Slime domes are a shield, not a wall (Alex, 2026-10-08): shots that hit a germ under a dome do this share of their damage (0.25: 12 plain hits on Pseudomonas, like MRSA; tuned shots do 1).',
  'macrophage.gulp': 'Seconds a swallow takes.',
  'macrophage.reach': 'How close it must get to swallow.',
  'support.ring': 'Radius of a Support macrophage ring.',
  'support.speedMul': 'Speed multiplier for neutrophils inside a ring.',
  'bacteria.maxCount': 'Antigens stop dividing at this many on the map.',
  'bacteria.drift': 'Lymph flow speed toward the Lymph node.',
  'bacteria.crowdDrift': 'Extra drift per antigen in a zone beyond crowd start (spill-over).',
  'bacteria.crowdStart': 'Zone count where crowding starts pushing antigens onward.',
  'bacteria.crowdRadius': 'Neighbour radius for the room-to-divide check.',
  'bacteria.crowdMax': 'An antigen will not divide with this many neighbours.',
  'bacteria.jitter': 'Random spread on division times (fraction).',
  'bacteria.knock': 'How hard a plain hit knocks an antigen back.',
  'staph.hp': 'Staph: plain hits to kill.',
  'staph.doubling': 'Staph: seconds to divide.',
  'mrsa.hp': 'MRSA: plain shots it takes to kill (Alex, 2026-10-08: plain fire wears it down slowly; it heals fully when it divides). Tuned shots kill it at once.',
  'mrsa.doubling': 'MRSA: seconds to divide.',
  'pseudo.settle': 'Pseudomonas: seconds before it stops and grows a slime dome.',
  'pseudo.domeMax': 'Dome radius when fully grown.',
  'pseudo.domeGrow': 'Dome growth per second.',
  'pseudo.domeHp': 'Macrophage bites to tear a dome down.',
  'pseudo.domeCap': 'Most slime domes on the map at once.',
  'fungus.hp': 'Candida yeast: hits to kill while it is still a loose yeast cell.',
  'fungus.radius': 'Candida yeast body radius.',
  'fungus.settle': 'Seconds in the Wound or Tissue before a yeast settles and sprouts a hypha.',
  'fungus.grow': 'Seconds per new hypha segment (lower = faster creep).',
  'fungus.seg': 'Length of one hypha segment.',
  'fungus.maxSegs': 'Most segments one fungus grows.',
  'fungus.branch': 'Chance that a new segment also branches.',
  'fungus.wiggle': 'How much a hypha wanders (radians per segment).',
  'fungus.budEvery': 'Seconds between new yeast budding off a fungus tip.',
  'fungus.highway': 'Speed multiplier for antigens riding along a hypha toward the Lymph node.',
  'fungus.reach': 'How close an antigen must be to a hypha to ride it.',
  'fungus.wither': 'Seconds a cut-off piece of hypha takes to wither away.',
  'fungus.chew': 'Hypha segments an Offense macrophage chews off per bite.',
  'fungus.cap': 'Most hypha segments on the map at once.',
  'flu.speed': 'Influenza swim speed toward the Lymph node.',
  'flu.split': 'Each flu that reaches the Tissue becomes this many.',
  'spore.hatch': 'Clostridium: seconds from arrival to hatching.',
  'clos.doubling': 'Hatched Clostridium: seconds to divide.',
  'tb.hp': 'Tuberculosis: plain hits to kill.',
  'tb.infectLife': 'Seconds an infected macrophage lives.',
  'tb.spitEvery': 'Seconds between new TB from an infected macrophage.',
  'toxic.fatigueMul': 'While any Toxic-shock Staph lives, fatigue builds this many times faster.',
  'strep.speed': 'Strep chain sprint speed.',
  'strep.links': 'Links per chain.',
  'herpes.incubate': 'Seconds before an infected neutrophil bursts.',
  'herpes.burst': 'Virus particles released by a burst.',
  'worm.segments': 'Tapeworm segments.',
  'worm.segHp': 'Hits per tapeworm segment.',
  'worm.cross': 'Seconds the tapeworm takes to crawl the whole map.',
  'storm.kill': 'Share of antigens the cytokine storm kills.',
  'storm.friendly': 'Share of your neutrophils it kills.',
  'storm.charge': 'Seconds the storm button must be held (real time) before releasing fires it. Bots wait this long in game time.',
  'storm.cost': 'Fatigue added at once by a storm.',
  'storm.after': 'Seconds of afterburn after a storm.',
  'storm.afterRate': 'Fatigue per second during afterburn (halved at the lowest stress).',
  'quorum.n': 'Quorum burst: Staph-family germs within the radius of one germ that make a crowd glow (a level can set its own).',
  'quorum.radius': 'How close germs must be to count toward one crowd.',
  'quorum.fuse': 'Seconds a crowd glows before it pops (it resets if the crowd drops below quorum).',
  'quorum.pull': 'While a crowd glows, its bubble pulls Staph-family germs within this distance toward its centre.',
  'quorum.suck': 'How hard the bubble pulls (speed gained per second).',
  'quorum.pop': 'A pop kills every one of your cells within this distance.',
  'quorum.germRadius': 'A pop also kills germs this close to its centre (the colony spends itself)...',
  'quorum.germKill': '...each one with this chance.',
  'quorum.cooldown': 'Seconds before the same sector can pop again.',
  'quorum.check': 'Seconds between quorum checks.',
  'quorum.badge': 'A wave with this many Staph-family germs gets a burst badge on the progress rail.',
  'toxin.warn': 'Seconds the Wound flashes red before a burst.',
  'toxin.notice': 'Seconds before a burst that the banner starts counting down.',
  'lymph.fill': 'Seconds an organ\'s germs must sit in the Lymph node to fill its breach clock (costs that organ a bar).',
  'lymph.drain': 'Seconds for a full breach clock to drain once that organ\'s germs are gone from the node.',
  'lymph.crowd': 'Extra clock speed per extra germ of that organ in the node (0.1 = +10% each).',
  'lymph.crowdCap': 'Most the crowd can speed a clock up (2 = twice as fast).',
  'lymph.leak': 'Breach clock added by one blood vessel leak (Sandbox Hepatitis and E. coli).',
};

// Antigen kinds: what they look like to the rest of the sim
const KINDS = {
  staph:   { name: 'Staph', organ: 'spleen', hpKey: 'staph', divides: true, edible: true, small: true },
  mrsa:    { name: 'MRSA', organ: 'heart', hpKey: 'mrsa', divides: true, armored: true, small: false },
  pseudo:  { name: 'Pseudomonas', organ: 'lungs', hpKey: 'pseudo', divides: true, edible: true, small: true },
  flu:     { name: 'Influenza', organ: 'lungs', hp: 1, edible: true, small: true },
  spore:   { name: 'Clostridium spore', organ: 'brain', inert: true },
  clos:    { name: 'Clostridium', organ: 'brain', hpKey: 'clos', divides: true, edible: true, small: true },
  tb:      { name: 'Tuberculosis', organ: 'lungs', hpKey: 'tb', divides: true, edible: true, small: true, slow: true },
  toxic:   { name: 'Toxic-shock Staph', organ: 'heart', hpKey: 'toxic', divides: true, edible: true, small: true },
  strep:   { name: 'Strep chain', organ: 'heart', hpKey: 'strep', edible: true, small: true, chain: true },
  virus:   { name: 'Herpes', organ: 'brain', hp: 1, edible: true, small: true },
  worm:    { name: 'Tapeworm', organ: 'liver', big: true, chain: true },
  wormlet: { name: 'Tapeworm piece', organ: 'liver', edible: true, small: true },
  yeast:   { name: 'Candida', organ: 'spleen', hpKey: 'fungus', edible: true, small: true },
};
const radiusOf = k => {
  const C = CONFIG;
  return { staph: C.staph.radius, mrsa: C.mrsa.radius, pseudo: C.pseudo.radius, flu: C.flu.radius, spore: C.spore.radius, clos: C.clos.radius, tb: C.tb.radius, toxic: C.toxic.radius, strep: C.strep.radius, virus: C.herpes.radius, worm: C.worm.radius, wormlet: 2.6, yeast: C.fungus.radius }[k];
};
const UNIT_NAMES = { neut: 'Neutrophils', net: 'Net neutrophils', nk: 'NK cells', mac: 'Macrophages' };

// Levels. Waves: t plus a count per antigen kind (strep = chains, worm = worms).
// V28 (Alex, 2026-10-08): every unit count on both sides x3 (caps, production, start, waves, trickle, spleen, quorum x2),
// then waves and trickle x1.3 because the bigger armies won too easily. The Tapeworm stays one worm with x3 segment hp.
// stream: antigens trickling in between waves, rate ramping from start to end per second.
// evolve: false keeps Evolution out of a level (the intro level teaches the basics first).
// quorum: Staph-family crowd size that starts a quorum burst here (default CONFIG.quorum.n). Scripted toxin bursts were replaced by quorum bursts (Alex, 2026-10-08).
const LEVELS = {
  papercut: {
    quorum: 28, evolve: false, name: 'Papercut', blurb: 'Staph spills out of a small cut. Learn the basics.', duration: 240, units: ['neut', 'mac'],
    waves: [{ t: 0, staph: 281 }, { t: 45, staph: 281 }, { t: 100, staph: 562 }, { t: 160, staph: 421 }, { t: 200, staph: 749, final: true }],
    stream: { start: 2.88, end: 7.2, clump: 12, kinds: [{ k: 'staph', w: 1 }] }, // waves x1.2 (2026-10-08): with the second vessel, doing nothing won at x1. Quorum 14: at 10 the opening wave popped within seconds and gunners lost 3/4
  },
  hospital: {
    name: 'Hospital visit', blurb: 'MRSA shrugs off plain shots and slips out of macrophages. Only Support rings kill it.', duration: 300, units: ['neut', 'mac'],
    waves: [{ t: 0, staph: 195 }, { t: 50, staph: 156, mrsa: 31 }, { t: 110, staph: 312, mrsa: 47 }, { t: 170, staph: 234 }, { t: 240, staph: 390, mrsa: 70, final: true }],
    stream: { start: 1.8, end: 4.8, clump: 12, kinds: [{ k: 'staph', w: 1 }, { k: 'mrsa', w: 0.12, from: 60 }] },
  },
  pool: {
    name: 'Pool water', blurb: 'Pseudomonas settles down and grows slime domes that shots cannot pierce. Macrophages tear them down.', duration: 300, units: ['neut', 'mac'],
    waves: [{ t: 0, staph: 156 }, { t: 40, pseudo: 47 }, { t: 90, staph: 234, mrsa: 31 }, { t: 150, pseudo: 47, staph: 156 }, { t: 240, staph: 234, pseudo: 39, mrsa: 31, final: true }],
    stream: { start: 1.5, end: 3.9, clump: 12, kinds: [{ k: 'staph', w: 1 }, { k: 'pseudo', w: 0.12, from: 30 }, { k: 'mrsa', w: 0.05, from: 90 }] },
  },
  flu: {
    quorum: 36, name: 'Flu season', blurb: 'Influenza swarms in by the dozen and splits in the Tissue. Net neutrophils wipe out whole clusters.', duration: 300, units: ['neut', 'net', 'mac'],
    waves: [{ t: 0, staph: 374 }, { t: 35, flu: 488 }, { t: 90, flu: 601, staph: 300 }, { t: 150, flu: 749 }, { t: 210, staph: 523, flu: 488 }, { t: 250, flu: 975, staph: 374, final: true }],
    stream: { start: 3.456, end: 8.064, clump: 12, kinds: [{ k: 'staph', w: 1 }] }, // waves x1.6 (2026-10-07, breach clocks), then x1.2 (2026-10-08, second vessel): doing nothing won before each
  },
  soil: {
    name: 'Soil cut', blurb: 'Clostridium spores sit harmless, then hatch all at once. Rest before the hatch, push hard on it.', duration: 300, units: ['neut', 'net', 'mac'],
    waves: [{ t: 0, staph: 187, spore: 187 }, { t: 70, mrsa: 62, staph: 187 }, { t: 110, spore: 312 }, { t: 180, staph: 312, mrsa: 62 }, { t: 220, spore: 374, staph: 250, final: true }],
    stream: { start: 1.92, end: 4.8, clump: 9, kinds: [{ k: 'staph', w: 1 }, { k: 'mrsa', w: 0.1, from: 60 }] }, // waves x1.6 (2026-10-08): with Deep tissue and plain shots hurting MRSA, doing nothing won
  },
  foot: {
    name: "Athlete's foot", blurb: 'Fungus grows threads toward the Lymph node and germs ride them like a highway. Shots pass through the threads. Nets cut them; macrophages chew them slowly.', duration: 300, units: ['neut', 'net', 'mac'],
    waves: [{ t: 0, staph: 234 }, { t: 30, yeast: 23 }, { t: 80, staph: 281, yeast: 20 }, { t: 140, yeast: 39, staph: 187 }, { t: 200, staph: 328 }, { t: 240, yeast: 39, staph: 374, final: true }],
    stream: { start: 1.8, end: 4.68, clump: 12, kinds: [{ k: 'staph', w: 1 }, { k: 'yeast', w: 0.04, from: 60 }] }, // waves x1.2 (2026-10-08): with the second vessel, a random player won 1 in 6
  },
  lungs: {
    name: 'Lungs', blurb: 'Tuberculosis turns any macrophage that swallows it into a TB factory. Only NK cells can kill an infected macrophage. Offense is a trap here.', duration: 300, units: ['neut', 'net', 'nk', 'mac'],
    waves: [{ t: 0, staph: 117, tb: 23 }, { t: 60, pseudo: 47, tb: 23 }, { t: 120, tb: 39, staph: 156 }, { t: 180, pseudo: 62, tb: 31 }, { t: 240, tb: 39, pseudo: 39, staph: 195, final: true }],
    stream: { start: 1.2, end: 3.3, clump: 9, kinds: [{ k: 'staph', w: 1 }, { k: 'tb', w: 0.08, from: 30 }, { k: 'pseudo', w: 0.1, from: 60 }] },
  },
  throat: {
    quorum: 36, name: 'Sore throat', blurb: 'Strep chains sprint for the Lymph node, and Toxic-shock Staph makes you tire twice as fast.', duration: 300, units: ['neut', 'net', 'mac'],
    waves: [{ t: 0, staph: 234 }, { t: 40, strep: 23 }, { t: 90, toxic: 140, staph: 187 }, { t: 140, strep: 39 }, { t: 200, toxic: 164, strep: 27 }, { t: 250, strep: 55, staph: 468, toxic: 140, final: true }],
    stream: { start: 2.52, end: 6.12, clump: 12, kinds: [{ k: 'staph', w: 1 }, { k: 'toxic', w: 0.1, from: 80 }] }, // waves x1.2 (2026-10-08): with the second vessel, doing nothing won at x1
  },
  coldsore: {
    name: 'Cold sore', blurb: 'Herpes hides inside your own neutrophils and bursts out later. NK cells find and pop infected cells.', duration: 300, units: ['neut', 'net', 'nk', 'mac'],
    waves: [{ t: 0, staph: 195 }, { t: 40, virus: 156 }, { t: 100, staph: 273, virus: 117 }, { t: 160, virus: 195 }, { t: 220, staph: 312, virus: 156, final: true }],
    stream: { start: 1.5, end: 3.9, clump: 12, kinds: [{ k: 'staph', w: 1 }, { k: 'virus', w: 0.12, from: 60 }] },
  },
  gut: {
    name: 'Gut', blurb: 'A tapeworm crawls from the Wound to the Lymph node. Break it apart before it gets there.', duration: 300, units: ['neut', 'net', 'nk', 'mac'],
    waves: [{ t: 0, staph: 195 }, { t: 30, worm: 1 }, { t: 90, staph: 351 }, { t: 160, staph: 273, flu: 273 }, { t: 200, worm: 1 }, { t: 230, staph: 468, final: true }],
    stream: { start: 2.1, end: 5.1, clump: 12, kinds: [{ k: 'staph', w: 1 }] },
  },
};
// Antigens blink when they reproduce (division, splits, hatching, budding, bursts): seconds of strobe on parent and offspring
const BLINK = 0.6, BLINK_WARN = 0.7;
// organs, worst first for overload; ORGAN_WKEY names each one's overload weight in CONFIG.organs
const ORGAN_KEYS = ['heart', 'kidney', 'lungs', 'liver', 'spleen', 'brain'];
const ORGAN_NAMES = { heart: 'Heart', kidney: 'Kidney', lungs: 'Lung', liver: 'Liver', spleen: 'Spleen', brain: 'Brain' };
const ORGAN_WKEY = { heart: 'wHeart', kidney: 'wKidney', lungs: 'wLungs', liver: 'wLiver', spleen: 'wSpleen', brain: 'wBrain' };
// Evolution (Alex, 2026-10-08; notes/mechanics-brainstorm.md idea 2): whatever does most of the killing, the survivors resist.
// Only kinds that divide (bacteria, fungi) evolve. Kill method -> the counter-trait a germ kind evolves. Tuned shots, NK cells and quorum pops never trigger one, so mixing pays.
const EVOLVE = {
  shot: { trait: 'wall', name: 'thick wall', what: 'Plain shots need an extra hit; tuned shots still kill it' },
  swallow: { trait: 'capsule', name: 'capsule', what: 'Macrophages need two gulps' },
  net: { trait: 'slick', name: 'slick coat', what: 'Nets do half damage' },
  storm: { trait: 'hardy', name: 'hardy core', what: 'The storm kills half as many' },
};
const NO_EVOLVE = new Set(['worm', 'wormlet', 'spore']);
const QUORUM_KINDS = new Set(['staph', 'mrsa', 'toxic']); // the Staph family counts its neighbours (quorum sensing)
const LEVEL_ORDER = ['papercut', 'hospital', 'pool', 'flu', 'soil', 'foot', 'lungs', 'throat', 'coldsore', 'gut'];

const clone = o => JSON.parse(JSON.stringify(o));
let CONFIG = clone(DEFAULTS);
function mergeConfig(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const g in saved) {
    if (!CONFIG[g]) continue;
    for (const k in saved[g]) if (k in DEFAULTS[g] && typeof saved[g][k] === 'number') CONFIG[g][k] = saved[g][k];
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Map: three zones of 300 along the flow; the blood vessel is a strip along v < VESSEL.
const L = 900, WIDTH = 460, VESSEL = 44;
// Four sectors, top to bottom (Alex, 2026-10-08): Wound, Tissue, Deep tissue 30% each, then a thin Lymph node (10%)
// so there's time to see trouble coming before germs reach the node. ZB = sector edges along the map.
const ZB = [0, 270, 540, 810, L], NZ = ZB.length - 1, LYMPH = NZ - 1, ZONE = 270;
const zStart = z => ZB[z], zLen = z => ZB[z + 1] - ZB[z], zMid = z => (ZB[z] + ZB[z + 1]) / 2;
// Second, thinner vessel on the far edge (Alex, 2026-10-08): half of new cells enter there, so the fight no longer drifts away from the left vessel
const FAR_VESSEL = 20;
const ZONES = ['Wound', 'Tissue', 'Deep tissue', 'Lymph node'];
const zoneOf = u => { let z = 0; while (z < LYMPH && u >= ZB[z + 1]) z++; return z; };
// Middle of the playable strip between the two vessels (2026-10-08, notes/battlefield-drift.md follow-up): the wound, the node and
// the idle aim sat right of it on the two-vessel map, which kept the fight leaning right
const MID_V = (VESSEL + WIDTH - FAR_VESSEL) / 2;
const WOUND = { u: 70, v: MID_V };
const NODE = { u: L - 45, v: MID_V }; // the middle of the Lymph node sector
const POSTS = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.72], [0.3, 0.75], [0.7, 0.28], [0.5, 0.15], [0.5, 0.88]];

// Uniform grid of buckets for neighbour queries
const CELL = 16, GC = Math.ceil(L / CELL) + 1, GR = Math.ceil(WIDTH / CELL) + 1;
class Grid {
  constructor() { this.b = Array.from({ length: GC * GR }, () => []); this.used = []; }
  clear() { for (const k of this.used) this.b[k].length = 0; this.used.length = 0; }
  key(u, v) { const c = Math.max(0, Math.min(GC - 1, Math.floor(u / CELL))), r = Math.max(0, Math.min(GR - 1, Math.floor(v / CELL))); return r * GC + c; }
  add(o) { const k = this.key(o.u, o.v), a = this.b[k]; if (!a.length) this.used.push(k); a.push(o); }
  // call fn(o) for everything in buckets overlapping the circle (u, v, rad)
  each(u, v, rad, fn) {
    const c0 = Math.max(0, Math.floor((u - rad) / CELL)), c1 = Math.min(GC - 1, Math.floor((u + rad) / CELL));
    const r0 = Math.max(0, Math.floor((v - rad) / CELL)), r1 = Math.min(GR - 1, Math.floor((v + rad) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const a = this.b[r * GC + c]; for (let i = 0; i < a.length; i++) if (fn(a[i]) === false) return; }
  }
}

class Game {
  constructor(levelKey, seed) {
    this.key = LEVELS[levelKey] ? levelKey : 'papercut';
    this.lv = LEVELS[this.key];
    this.duration = this.lv.duration;
    this.units = this.lv.units.slice();
    this.seed = seed || 1;
    this.rand = mulberry32(this.seed * 9973 + 17);
    this.t = 0;
    this.ag = [];      // antigens
    this.cells = [];   // your cells: {type: neut | net | nk | mac}
    this.shots = []; this.domes = []; this.webs = [];
    this.hyphae = []; this.fungi = []; this.gH = null;
    this.fx = [];
    const share = 1 / this.units.length;
    this.zones = ZONES.map(name => {
      const mix = {}, prog = {};
      // the starting mix is plain: neutrophils and macrophages. Counters (Net, NK) are the player's call
      for (const u of this.units) { mix[u] = u === 'neut' ? 0.8 : 0; prog[u] = 0; }
      const rest = this.units.includes('mac') ? ['mac'] : this.units.filter(u => u !== 'neut');
      for (const u of rest) mix[u] = 0.2 / rest.length;
      return { name, mode: 'offense', on: true, count: 0, mix, prog, share };
    });
    this.lymph = { timer: 0, peak: 0, reached: false }; // timer = the fullest breach clock
    this.clocks = {}; this.inNode = {}; // breach clock per organ (0-1), and how many of its germs sit in the node
    this.startState = () => ({ output: CONFIG.output.start, zones: this.zones.map(z => ({ mode: z.mode, on: z.on, mix: Object.fromEntries(this.units.map(u => [u, Math.round(z.mix[u] * 100)])) })) });
    this.waveIdx = 0; this.streamAcc = 0; this.pourQ = []; // germs of a wave still pouring in: {at, k, u, v, extra} or {at, chain, n, u, v}
    this.output = CONFIG.output.start; this.fatigue = 0; this.tier = 0; this.fatiguePeak = 0; this.tierTime = [0, 0, 0, 0];
    this.organs = Object.fromEntries(ORGAN_KEYS.map(k => [k, 4])); this.organHit = Object.fromEntries(ORGAN_KEYS.map(k => [k, 0])); this.overT = 0;
    this.organLoss = true; // Sandbox cheats set this false: an organ at 0 keeps its worst penalty but doesn't end the match
    this.storm = { wind: 0, after: 0, used: 0 };
    this.toxins = (this.lv.toxins || []).map(at => ({ at, state: 'coming', front: 0 })); // legacy scripted bursts (the Sandbox's "burst now" still pushes one)
    this.evo = { win: {}, traits: {}, pending: [], checked: 0 }; // kills per kind and method since the last wave; evolved traits per kind
    this.quorum = { acc: 0, glow: new Array(NZ).fill(0), cd: new Array(NZ).fill(0), crowd: new Array(NZ).fill(null), pops: 0 };
    this.stats = { shotKills: 0, swallows: 0, netKills: 0, stormKills: 0, made: 0, toxinDeaths: 0, peak: 0, bounced: 0, storms: 0 };
    this.history = []; this.histT = 0;
    // Fight log: every player input, scripted event and a sample every 2 s (shareable as feedback)
    this.log = { inputs: [], events: [] }; this.tally = {};
    this.result = null;
    this.id = 1;
    this.gA = new Grid(); this.gF = new Grid(); this.gH = new Grid();
    for (let i = 0; i < CONFIG.start.neut; i++) {
      const u = 40 + this.rand() * (L - 120);
      this.spawnCell('neut', zoneOf(u), u, VESSEL + 20 + this.rand() * (WIDTH - FAR_VESSEL - VESSEL - 40)); // across the full width
    }
    for (let i = 0; i < CONFIG.start.mac; i++) this.spawnCell('mac', i % 3, null, null, true);
    this.runWaves();
  }

  // ---- player actions ----
  // Production mix for a zone: shares across the level's unit types, always summing to 1
  setShare(z, type, x) {
    const zn = this.zones[z]; if (!zn || !(type in zn.mix)) return;
    x = Math.max(0, Math.min(1, +x || 0));
    const others = this.units.filter(u => u !== type), s = others.reduce((a, u) => a + zn.mix[u], 0);
    zn.mix[type] = x;
    for (const u of others) zn.mix[u] = s > 1e-6 ? zn.mix[u] * (1 - x) / s : (1 - x) / others.length;
    this.logMix(z, 'slider', type);
  }
  allIn(z, type) { const zn = this.zones[z]; if (!zn || !(type in zn.mix)) return; for (const u of this.units) zn.mix[u] = u === type ? 1 : 0; this.logMix(z, 'allIn', type); }
  setMix(z, mix) {
    const zn = this.zones[z]; if (!zn) return;
    let s = 0; for (const u of this.units) s += Math.max(0, +mix[u] || 0);
    for (const u of this.units) zn.mix[u] = s > 0 ? Math.max(0, +mix[u] || 0) / s : 1 / this.units.length;
    this.logMix(z, 'set');
  }
  // Switch a zone's production off (its share of the marrow goes to the zones still on) or back on. One zone always stays on.
  setZoneOn(z, on) {
    const zn = this.zones[z]; on = !!on; if (!zn || zn.on === on) return false;
    if (!on && this.zones.filter(q => q.on).length <= 1) return false;
    zn.on = on; this.logInput({ a: 'production', z, on }); return true;
  }
  // Copy one zone's production mix to every zone (stance and On/Off stay as they are)
  copyMixToAll(z) {
    const src = this.zones[z]; if (!src) return;
    for (const q of this.zones) if (q !== src) for (const u of this.units) q.mix[u] = src.mix[u];
    this.logInput({ a: 'mixAll', z, mix: Object.fromEntries(this.units.map(u => [u, Math.round(src.mix[u] * 100)])) });
  }
  toggleZoneOn(z) { const zn = this.zones[z]; return zn ? this.setZoneOn(z, !zn.on) : false; }
  zonesOn() { let n = 0; for (const q of this.zones) if (q.on) n++; return Math.max(1, n); }
  // Vessel wall (Alex, 2026-10-08): cells reach a sector by squeezing through its vessel wall, and each wall only takes so many.
  // A sector's share of the marrow (1 / sectors on) passes in full at the even share (all four on) and saturates above it,
  // so switching sectors off to focus wastes output. Returns the fraction of the full marrow this sector actually gets.
  zoneOutput(z) {
    const zn = this.zones[z]; if (!zn || !zn.on) return 0;
    const s = 1 / this.zonesOn(), even = 1 / this.zones.length, b = Math.max(1e-3, CONFIG.wall.soft);
    return s * (even + b) / (s + b);
  }
  toggleZone(z) { const zn = this.zones[z]; if (zn) { zn.mode = zn.mode === 'offense' ? 'support' : 'offense'; this.logInput({ a: 'mode', z, mode: zn.mode }); } }
  setZone(z, mode) { const zn = this.zones[z]; if (zn && zn.mode !== mode) { zn.mode = mode; this.logInput({ a: 'mode', z, mode }); } }
  setOutput(x) {
    const o = Math.max(0, Math.min(1, +x || 0));
    if (Math.abs(o - this.output) < 1e-6) return;
    this.output = o; this.logInput({ a: 'output', x: +o.toFixed(2), mul: +this.outputMul().toFixed(2) }, 'output');
  }
  // ---- fight log ----
  // A player input. Rapid repeats of the same control (a slider being dragged) collapse into the last value.
  logInput(e, key) {
    const L = this.log.inputs, last = L[L.length - 1];
    e.t = +this.t.toFixed(2);
    if (key && last && last.key === key && e.t - last.t < 1) { Object.assign(last, e); return; }
    if (key) e.key = key;
    L.push(e);
    if (L.length > 4000) L.splice(0, L.length - 4000);
  }
  logMix(z, how, type) {
    const zn = this.zones[z], mix = {};
    for (const u of this.units) mix[u] = Math.round(zn.mix[u] * 100);
    const L = this.log.inputs;
    for (let i = L.length - 1; i >= 0; i--) if (L[i].a === 'mix' && L[i].z === z) { if (JSON.stringify(L[i].mix) === JSON.stringify(mix)) return; break; }
    this.logInput({ a: 'mix', z, how, type, mix }, `mix${z}`);
  }
  logEvent(e) { e.t = +this.t.toFixed(2); this.log.events.push(e); if (this.log.events.length > 4000) this.log.events.splice(0, 1000); }
  tick(key, n) {
    this.tally[key] = (this.tally[key] || 0) + (n || 1);
    if (key.charCodeAt(0) === 107 && key.startsWith('kill.')) { // kill.<method>.<kind>: feeds evolution
      const i = key.indexOf('.', 5), how = key.slice(5, i), k = key.slice(i + 1), w = this.evo.win[k] || (this.evo.win[k] = {});
      w[how] = (w[how] || 0) + (n || 1);
    }
  }
  // Traits live on each germ: ones that arrive after their kind evolved carry it, and pass it to their offspring
  hasTrait(a, t) { return !!a.tr && a.tr.includes(t); }
  // A few seconds before each wave: any kind that mostly died one way evolves that way's counter (applied when the wave lands)
  stepEvolve() {
    const E = CONFIG.evolve, w = this.lv.waves, ev = this.evo;
    if (!E.on || this.lv.evolve === false || this.waveIdx >= w.length || ev.checked > this.waveIdx || this.t < w[this.waveIdx].t - E.warn || w[this.waveIdx].t <= 0) return;
    ev.checked = this.waveIdx + 1;
    for (const k in ev.win) {
      if (NO_EVOLVE.has(k) || !KINDS[k] || !KINDS[k].divides) continue; // bacteria and fungi evolve; viruses don't
      const tally = ev.win[k], total = Object.values(tally).reduce((a, b) => a + b, 0), have = ev.traits[k] || [];
      if (total < E.min || have.length >= E.max) continue;
      const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0], X = EVOLVE[top];
      if (!X || tally[top] / total < E.share || have.includes(X.trait) || ev.pending.some(p => p.k === k)) continue;
      ev.pending.push({ k, trait: X.trait, how: top });
      this.fx.push({ k: 'evolveSoon', kind: k, trait: X.trait, name: X.name, what: X.what, how: top, share: tally[top] / total });
      this.logEvent({ e: 'evolve', kind: k, trait: X.trait, how: top, share: +(tally[top] / total).toFixed(2), kills: total });
    }
    ev.win = {};
  }
  // ---- organs: 4 bars each; the penalty steps up with each whole bar lost; any organ at 0 is Host failure
  organLevel(k) { return Math.max(0, Math.min(4, Math.ceil(this.organs[k] - 1e-9))); }
  organVal(k, healthy) { const l = this.organLevel(k); return l >= 4 ? healthy : CONFIG.organs[k + Math.max(1, l)]; }
  // Breach clocks: each organ's germs in the Lymph node fill its own clock; a full clock costs that organ a bar
  breach(k, amount, why) {
    if (this.result || !(k in this.organs) || !(amount > 0)) return;
    const c = (this.clocks[k] || 0) + amount;
    if (c >= 1) { this.clocks[k] = 0; this.fx.push({ k: 'breachHit', organ: k }); this.hurtOrgan(k, 1, why || 'breach', 0); }
    else this.clocks[k] = c;
  }
  organOf(a) { return a.organ || (KINDS[a.k] && KINDS[a.k].organ) || 'spleen'; }
  // brain at 2 bars or fewer: a production mix change takes organs.brainDelay s to kick in
  usedMix(zn, t) {
    if (!zn.used) zn.used = Object.assign({}, zn.mix);
    let same = true; for (const u of this.units) if (Math.abs(zn.used[u] - zn.mix[u]) > 1e-9) { same = false; break; }
    if (same) { zn.pend = null; return zn.used; }
    if (zn.pend == null) zn.pend = t;
    if (this.organLevel('brain') > 2 || t - zn.pend >= CONFIG.organs.brainDelay) { zn.used = Object.assign({}, zn.mix); zn.pend = null; }
    return zn.used;
  }
  // brain: extra wander for every cell (1 = none)
  wanderMul() { return this.organVal('brain', 1); }
  // Sandbox: set an organ directly (0-4 bars); never ends the match by itself
  setOrgan(k, bars) { if (k in this.organs) this.organs[k] = Math.max(0, Math.min(4, +bars || 0)); }
  heartCap() { return this.organVal('heart', CONFIG.output.max); }
  recoverMul() { return this.organVal('kidney', 1); }
  moveMul() { return this.organVal('lungs', 1); }
  makeMul() { return this.organVal('liver', 1); }
  cellCap() { return Math.min(CONFIG.caps.cells, this.organVal('spleen', CONFIG.caps.cells)); }
  overload() { return Math.max(0, this.fatigue - 100); }
  // Stress (the slider, Alex 2026-10-08; was "body output"), capped by the heart. Fatigue keys off this.
  effMul() { return Math.min(this.outputMul(), this.heartCap()); }
  // What stress buys: cell output with diminishing returns (stress^curve, so 200% stress = 1.5x the cells, 50% = 0.67x)
  prodMul() { return Math.pow(this.effMul(), CONFIG.output.curve); }
  // floor: lowest it can push the organ (default: overload can take the last bar, other causes stop at organs.otherFloor)
  hurtOrgan(k, bars, why, floor) {
    if (this.result || !(k in this.organs) || bars <= 0) return;
    const before = this.organLevel(k), lo = floor != null ? floor : (why || 'overload') === 'overload' ? 0 : CONFIG.organs.otherFloor;
    if (this.organs[k] <= lo) return;
    this.organs[k] = Math.max(lo, this.organs[k] - bars); this.organHit[k] = 0.6;
    const after = this.organLevel(k), cause = why || 'overload';
    if (cause !== 'overload') this.fx.push({ k: 'organHit', organ: k, amount: bars, cause });
    if (after < before) { this.fx.push({ k: 'organLevel', organ: k, level: after }); this.logEvent({ e: 'organ', organ: k, level: after, why: cause, fatigue: Math.round(this.fatigue) }); }
    if (after === 0 && before > 0) this.fx.push({ k: 'organFail', organ: k });
    if (this.organs[k] <= 0 && this.organLoss) this.finish(false, `Host failure. ${ORGAN_NAMES[k]} function lost ${cause === 'breach' ? 'to germs in the Lymph node' : cause === 'overload' ? `at fatigue ${Math.round(this.fatigue)}` : `(${cause})`}.`, 'host');
  }
  // Rough look ahead for the storm preview: fatigue path and the worst organ left, assuming nothing changes
  stormOutcome() {
    const C = CONFIG, S = C.storm, O = C.output, G = C.organs, F = C.fatigue;
    let f = Math.min(F.max, this.fatigue + S.cost), after = S.after, peak = f, worst = 4;
    const hp = Object.assign({}, this.organs), mul = this.effMul();
    for (let t = 0, dt = 0.2; t < 240; t += dt) {
      const kl = Math.max(0, Math.min(4, Math.ceil(hp.kidney - 1e-9))), rm = kl >= 4 ? 1 : G['kidney' + Math.max(1, kl)];
      let df = mul > O.rest ? (mul - O.rest) * O.tire : (mul - O.rest) * O.recover * rm;
      if (after > 0) { after -= dt; df = Math.max(0, df) + S.afterRate * (this.output <= 0.001 ? 0.5 : 1); }
      else if (df < 0 && f > 100) df *= G.overRecover;
      f = Math.max(0, Math.min(F.max, f + df * dt)); peak = Math.max(peak, f);
      const over = f - 100;
      if (over > 0) for (const k of ORGAN_KEYS) { hp[k] -= this.organRate(k, over) * dt; worst = Math.min(worst, hp[k]); }
      else if (after <= 0) break;
    }
    return { peak, worst, hurt: peak > 100, fatal: worst <= 0 };
  }
  organRate(k, over) { const G = CONFIG.organs; return G.dmg * over * (1 + over / G.knee) * G[ORGAN_WKEY[k]]; }
  // Cytokine storm: fires after a short wind-up, any time. Fatigue past 100 hurts every organ; an organ at 0 is Host failure.
  useStorm() { if (this.result || this.storm.wind > 0) return false; this.storm.wind = CONFIG.storm.windup; this.fx.push({ k: 'stormStart' }); this.logInput({ a: 'storm', fatigue: Math.round(this.fatigue) }); return true; }
  stormActive() { return this.storm.wind > 0 || this.storm.after > 0; }
  // Where a storm started now would leave fatigue, roughly (for the ghost bar)
  stormForecast() { const S = CONFIG.storm; return Math.min(CONFIG.fatigue.max, this.fatigue + S.cost + S.after * S.afterRate * (this.output <= 0.001 ? 0.5 : 1)); }

  outputMul() { const O = CONFIG.output; return O.min * Math.pow(O.max / O.min, this.output); }
  fatigueTier() { const F = CONFIG.fatigue, f = this.fatigue; return f >= F.exhausted ? 3 : f >= F.feverish ? 2 : f >= F.tired ? 1 : 0; }
  // A wave big enough in Staph-family germs to reach quorum as it lands (gets a burst badge on the rail)
  waveQuorum(w) { return (w.staph || 0) + (w.mrsa || 0) + (w.toxic || 0) >= CONFIG.quorum.badge; }
  // Quorum burst (Alex, 2026-10-08; replaces the scripted toxin burst; spec notes/toxin-burst-alternatives.md).
  // Staph counts its neighbours: when a sector's densest Staph-family crowd reaches quorum it glows, and if it's still that big
  // when the fuse runs out it pops, killing your cells around it and half the germs at its core. Then that sector cools down.
  stepQuorum(dt) {
    const Q = CONFIG.quorum, q = this.quorum;
    // the bubble (Alex, 2026-10-08): a glowing crowd pulls nearby Staph in, so it reads as a thing in the physics, not a sticker
    for (let z = 0; z < NZ; z++) {
      const b = q.crowd[z]; if (!b) continue;
      this.gA.each(b.u, b.v, Q.pull, a => {
        if (a.dead || a.eaten || a.domed || !QUORUM_KINDS.has(a.k)) return;
        const du = b.u - a.u, dv = b.v - a.v, d = Math.hypot(du, dv);
        if (d > 3 && d < Q.pull) { a.vu += du / d * Q.suck * dt; a.vv += dv / d * Q.suck * dt; }
      });
    }
    q.acc += dt; if (q.acc < Q.check) return;
    const st = q.acc; q.acc = 0;
    const need = this.lv.quorum || Q.n, r2 = Q.radius * Q.radius;
    const best = new Array(NZ).fill(null);
    for (const a of this.ag) {
      if (a.dead || a.eaten || a.domed || !QUORUM_KINDS.has(a.k)) continue;
      let n = 0;
      this.gA.each(a.u, a.v, Q.radius, b => { if (!b.dead && !b.eaten && !b.domed && QUORUM_KINDS.has(b.k) && (b.u - a.u) ** 2 + (b.v - a.v) ** 2 < r2) n++; });
      const z = zoneOf(a.u);
      if (!best[z] || n > best[z].n) best[z] = { n, u: a.u, v: a.v };
    }
    for (let z = 0; z < NZ; z++) {
      q.cd[z] = Math.max(0, q.cd[z] - st);
      const b = best[z];
      if (!b || b.n < need || q.cd[z] > 0) { q.glow[z] = 0; q.crowd[z] = null; continue; }
      // the bubble glides toward the densest spot instead of jumping
      const o = q.crowd[z]; if (o) { b.u = o.u + (b.u - o.u) * 0.5; b.v = o.v + (b.v - o.v) * 0.5; }
      q.glow[z] += st; q.crowd[z] = b;
      if (q.glow[z] < Q.fuse) continue;
      q.glow[z] = 0; q.crowd[z] = null; q.cd[z] = Q.cooldown; q.pops++;
      let cells = 0, germs = 0;
      for (const c of this.cells) if (!c.dead && (c.u - b.u) ** 2 + (c.v - b.v) ** 2 < Q.pop * Q.pop) { this.killCell(c, 'toxin'); this.stats.toxinDeaths++; cells++; }
      for (const a of this.ag) if (!a.dead && !a.eaten && a.k !== 'worm' && a.k !== 'spore' && (a.u - b.u) ** 2 + (a.v - b.v) ** 2 < Q.germRadius * Q.germRadius && this.rand() < Q.germKill) {
        a.dead = true; germs++; this.tick('kill.quorum.' + a.k); if (a.k === 'strep') this.unlink(a, false);
        this.fx.push({ k: 'pop', u: a.u, v: a.v, kind: a.k });
      }
      this.fx.push({ k: 'burst', u: b.u, v: b.v, z, r: Q.pop });
      this.logEvent({ e: 'quorum', z, crowd: b.n, cellsLost: cells, germsLost: germs });
    }
  }
  // Sectors whose Staph crowd is glowing: [{z, u, v, n, f (0-1 of the fuse), left (s)}]
  quorumGlow() { const q = this.quorum, F = CONFIG.quorum.fuse, out = []; for (let z = 0; z < NZ; z++) if (q.crowd[z]) out.push({ z, ...q.crowd[z], f: Math.min(1, q.glow[z] / F), left: Math.max(0, F - q.glow[z]) }); return out; }
  pendingToxin() {
    for (const tx of this.toxins) {
      if (tx.state === 'sweeping') return tx;
      if (tx.state === 'coming' && this.t >= tx.at - CONFIG.toxin.notice) return tx;
    }
    return null;
  }
  // Progress-bar markers still to come: {t, kind: 'wave' | 'toxin' | 'hatch', kinds, final}
  markers() {
    const out = [];
    for (let i = this.waveIdx; i < this.lv.waves.length; i++) {
      const w = this.lv.waves[i];
      out.push({ t: w.t, kind: 'wave', final: !!w.final, kinds: Object.keys(KINDS).filter(k => w[k] > 0), armored: !!w.mrsa, quorum: this.waveQuorum(w) });
    }
    for (const w of this.lv.waves) if (w.spore && w.t + CONFIG.spore.hatch > this.t) out.push({ t: w.t + CONFIG.spore.hatch, kind: 'hatch' });
    for (const tx of this.toxins) if (tx.state === 'coming') out.push({ t: tx.at, kind: 'toxin' });
    return out;
  }
  // Every scripted event, past and future (for the progress bar)
  levelEvents() {
    const ev = [];
    for (const w of this.lv.waves) if (w.t > 0) ev.push({ t: w.t, kind: 'wave', final: !!w.final, kinds: Object.keys(KINDS).filter(k => w[k] > 0), armored: !!w.mrsa, quorum: this.waveQuorum(w) });
    for (const w of this.lv.waves) if (w.spore) ev.push({ t: w.t + CONFIG.spore.hatch, kind: 'hatch' });
    for (const tx of this.toxins) ev.push({ t: tx.at, kind: 'toxin' });
    return ev;
  }
  liveAg() { return this.ag.filter(a => !a.dead && !a.eaten); }
  count(type) { let n = 0; for (const c of this.cells) if (c.type === type && !c.dead) n++; return n; }
  cellCount() { return this.cells.length; }
  get neut() { return this.cells.filter(c => c.type === 'neut' || c.type === 'net'); }
  get mac() { return this.cells.filter(c => c.type === 'mac'); }
  get bact() { return this.ag; }

  // ---- spawning ----
  spawnCell(type, home, u, v, start) {
    const C = CONFIG, r = this.rand;
    // every cell has the same fields (keeps the JS engine fast)
    const c = {
      id: this.id++, type, home, u: 0, v: 0, vu: 0, vv: 0, r: 3, m: 1, age: 0, dead: false, stun: 0,
      head: Math.PI / 2, turn: 0, cd: r() * 0.5, boosted: false, infected: 0, target: null, retarget: 0, tu: -1, tv: -1,
      pu: 0, pv: 0, mode: 'offense', gulp: 0, prey: null, flip: 0, tb: null,
    };
    if (type === 'mac') {
      const n = this.cells.filter(m => m.type === 'mac' && m.home === home).length, slot = n % POSTS.length;
      c.pu = zStart(home) + POSTS[slot][0] * zLen(home); c.pv = VESSEL + POSTS[slot][1] * (WIDTH - VESSEL);
      c.r = C.macrophage.radius; c.m = 10; c.cd = 0;
      if (start) { c.u = c.pu; c.v = c.pv; }
    } else if (type === 'nk') { c.r = C.nk.radius; c.m = 2; }
    else if (type === 'net') { c.r = C.net.radius; c.m = 1.6; }
    else { c.r = C.neutrophil.radius; c.m = 1.4; }
    if (!start) {
      c.u = u != null ? u : zStart(home) + Math.min(20, zLen(home) * 0.2) + r() * zLen(home) * (zLen(home) > 100 ? 1 - 40 / zLen(home) : 0.6);
      c.v = v != null ? v : VESSEL * 0.5;
      if (v == null) {
        c.vv = 60 + r() * 40; // pushed out of the vessel into the tissue
        if (type !== 'mac' && r() < 0.5) { c.v = WIDTH - FAR_VESSEL * 0.5; c.vv = -c.vv; } // or out of the far vessel
      }
    }
    this.cells.push(c);
    if (!start) this.tick('made.' + type);
    return c;
  }
  spawnAg(k, u, v, extra) {
    const C = CONFIG, r = this.rand;
    if (this.ag.length >= C.bacteria.maxCount + 780) return null;
    const K = KINDS[k];
    const hp = K.hp || (K.hpKey ? C[K.hpKey].hp : k === 'worm' ? C.worm.segHp : k === 'wormlet' ? C.worm.wormletHp : 1);
    const a = {
      id: this.id++, k, u: u == null ? WOUND.u + (r() - 0.5) * 90 : u, v: v == null ? WOUND.v + (r() - 0.5) * 180 : v,
      vu: 0, vv: 0, r: radiusOf(k), hp, maxHp: hp, age: 0, div: this.divTime(k), flash: 0, blink: 0, rot: r() * 6.283,
      dead: false, eaten: false, domed: false, prev: null, next: null, m: 1, split: false, anchored: false, hatchAt: 0,
    };
    a.m = Math.max(0.6, a.r * a.r / 6) * (k === 'worm' ? 3 : 1);
    if (extra) { if (extra.hatchAt) a.hatchAt = extra.hatchAt; if (extra.split) a.split = true; }
    a.tr = this.evo.traits[k] ? this.evo.traits[k].slice() : null; // evolved traits (see stepEvolve)
    this.ag.push(a);
    this.tick('in.' + k);
    return a;
  }
  divTime(k) {
    const C = CONFIG, base = { staph: C.staph.doubling, mrsa: C.mrsa.doubling, pseudo: C.pseudo.doubling, clos: C.clos.doubling, tb: C.tb.doubling, toxic: C.toxic.doubling }[k];
    return base ? base * (1 + (this.rand() - 0.5) * 2 * C.bacteria.jitter) : Infinity;
  }
  // A chain of links following a head (Strep chains, the Tapeworm)
  spawnChain(k, n, u, v) {
    let prev = null; const sp = radiusOf(k) * 2.1;
    for (let i = 0; i < n; i++) {
      const a = this.spawnAg(k, u - i * sp, v + Math.sin(i * 0.7) * 3);
      if (!a) break;
      if (prev) { a.prev = prev; prev.next = a; }
      prev = a;
    }
  }
  // A wave pours in over CONFIG.wave.pour seconds instead of landing in one step (Alex, 2026-10-08): positions are
  // picked when it starts; spawn times ease out, so it still lands as one big rush.
  runWaves() {
    const w = this.lv.waves, r = this.rand;
    while (this.waveIdx < w.length && this.t >= w[this.waveIdx].t) {
      const wave = w[this.waveIdx++];
      for (const p of this.evo.pending) { (this.evo.traits[p.k] || (this.evo.traits[p.k] = [])).push(p.trait); this.fx.push({ k: 'evolved', kind: p.k, trait: p.trait }); }
      this.evo.pending = [];
      const jobs = [];
      let n = 0;
      for (const k of Object.keys(KINDS)) {
        const c = wave[k] || 0; if (!c) continue;
        if (k === 'strep') { for (let i = 0; i < c; i++) jobs.push({ chain: 'strep', n: CONFIG.strep.links, u: WOUND.u + 30, v: WOUND.v + (r() - 0.5) * 200 }); n += c * CONFIG.strep.links; }
        else if (k === 'worm') { for (let i = 0; i < c; i++) jobs.push({ chain: 'worm', n: CONFIG.worm.segments, u: WOUND.u + 60, v: WOUND.v }); n += c; }
        else if (k === 'spore') { for (let i = 0; i < c; i++) jobs.push({ k: 'spore', u: null, v: null, extra: { hatchAt: wave.t + CONFIG.spore.hatch } }); n += c; }
        else if (k === 'flu') { const cu = WOUND.u, cv = WOUND.v + (r() - 0.5) * 80; for (let i = 0; i < c; i++) jobs.push({ k: 'flu', u: cu + (r() - 0.5) * 50, v: cv + (r() - 0.5) * 70 }); n += c; }
        else { for (let i = 0; i < c; i++) jobs.push({ k, u: null, v: null }); n += c; }
      }
      // shuffle so kinds arrive mixed, then give each an arrival time on an ease-out curve
      for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = jobs[i]; jobs[i] = jobs[j]; jobs[j] = x; }
      const P = CONFIG.wave.pour, N = jobs.length;
      jobs.forEach((j, i) => { j.at = wave.t + P * (1 - Math.sqrt(1 - i / N)); this.pourQ.push(j); });
      this.logEvent({ e: 'wave', final: !!wave.final, counts: Object.fromEntries(Object.keys(KINDS).filter(k => wave[k] > 0).map(k => [k, wave[k]])) });
      this.fx.push({ k: 'wave', u: WOUND.u, v: WOUND.v, n, kinds: Object.keys(KINDS).filter(k => wave[k] > 0), counts: Object.fromEntries(Object.keys(KINDS).filter(k => wave[k] > 0).map(k => [k, wave[k]])), final: !!wave.final });
    }
    if (!this.pourQ.length) return;
    let i = 0;
    for (; i < this.pourQ.length && this.pourQ[i].at <= this.t; i++) {
      const j = this.pourQ[i];
      if (j.chain) this.spawnChain(j.chain, j.n, j.u, j.v); else this.spawnAg(j.k, j.u, j.v, j.extra);
    }
    if (i) this.pourQ.splice(0, i);
  }

  // ---- queries ----
  // Shots and nets can hurt it (not inert, not under a dome)
  hittable(a) { return !a.dead && !a.eaten && !a.domed && a.k !== 'spore'; }
  inRing(u, v) {
    const r2 = (this.ringR || CONFIG.support.ring) ** 2;
    // every neutrophil asks this every step, so scan a cached list of the macrophages (same answer as scanning every cell).
    // The list is rebuilt whenever the cell list changes: cells are only ever appended, or the dead filtered into a new array.
    const cs = this.cells;
    if (this._macOf !== cs || this._macN !== cs.length) { this._macOf = cs; this._macN = cs.length; this._macs = cs.filter(c => c.type === 'mac'); }
    for (const m of this._macs) if (!m.dead && !m.tb && m.mode === 'support' && m.stun <= 0 && (m.u - u) ** 2 + (m.v - v) ** 2 < r2) return true;
    return false;
  }
  nearestAg(u, v, maxD, filter) {
    let best = null, bd = maxD * maxD;
    const test = a => {
      if (a.dead || a.eaten || (filter && !filter(a))) return;
      const d = (a.u - u) ** 2 + (a.v - v) ** 2;
      if (d < bd) { bd = d; best = a; }
    };
    if (maxD <= 80) this.gA.each(u, v, maxD, test); else for (const a of this.ag) test(a);
    return best;
  }
  band(z) { const lsh = CONFIG.neutrophil.leash; return [ZB[z] - lsh, ZB[z + 1] + lsh]; }

  // ---- tick ----
  step(dt) {
    if (this.result) return;
    const C = CONFIG, r = this.rand;
    this.t += dt;
    const t = this.t;
    if (this.fx.length > 1500) this.fx.splice(0, this.fx.length - 1500);

    // --- script: waves, stream, spores, toxins
    this.stepEvolve();
    this.runWaves();
    if (t < this.duration) {
      const S = this.lv.stream, f = t / this.duration;
      this.streamAcc += dt * (S.start + (S.end - S.start) * f) * C.trickle.mul;
      while (this.streamAcc >= 1) {
        const n = Math.max(1, Math.min(Math.floor(this.streamAcc), 1 + Math.floor(r() * S.clump)));
        this.streamAcc -= n;
        const ks = S.kinds.filter(x => !x.from || t >= x.from), tot = ks.reduce((a, x) => a + x.w, 0);
        let pick = r() * tot, k = ks[0].k;
        for (const x of ks) { if ((pick -= x.w) <= 0) { k = x.k; break; } }
        const cu = WOUND.u + (r() - 0.5) * 60, cv = WOUND.v + (r() - 0.5) * 160;
        for (let i = 0; i < n; i++) this.spawnAg(k, cu + (r() - 0.5) * 12, cv + (r() - 0.5) * 12);
        this.fx.push({ k: 'trickle', u: cu, v: cv });
      }
    }
    for (const a of this.ag) if (a.k === 'spore' && !a.dead && t >= a.hatchAt) {
      a.k = 'clos'; a.hp = a.maxHp = C.clos.hp; a.r = radiusOf('clos'); a.div = this.divTime('clos'); a.age = 0; a.blink = BLINK;
      this.fx.push({ k: 'hatch', u: a.u, v: a.v }); this.tick('hatch');
    }

    // --- stress, fatigue, storm
    const mul = this.effMul(), O = C.output, F = C.fatigue, S = C.storm, G = C.organs;
    const toxicAlive = this.ag.some(a => a.k === 'toxic' && !a.dead);
    this.toxicDrain = toxicAlive;
    // above rest fatigue builds; below it the body recovers (slower with hurt kidneys, much faster while in overload)
    let df = mul > O.rest ? (mul - O.rest) * O.tire * (toxicAlive ? C.toxic.fatigueMul : 1) : (mul - O.rest) * O.recover * this.recoverMul() * (this.fatigue > 100 ? G.overRecover : 1);
    if (this.storm.wind > 0) {
      this.storm.wind -= dt;
      if (this.storm.wind <= 0) this.fireStorm();
    } else if (this.storm.after > 0) {
      this.storm.after -= dt;
      df = Math.max(0, df) + S.afterRate * (this.output <= 0.001 ? 0.5 : 1);
    }
    this.fatigue = Math.max(0, Math.min(F.max, this.fatigue + df * dt));
    this.fatiguePeak = Math.max(this.fatiguePeak, this.fatigue);
    this.storm.justFired = false;
    // overload: past 100 every organ takes damage, faster the further over; rested, the liver and lungs heal
    const over = this.overload();
    for (const k of ORGAN_KEYS) this.organHit[k] = Math.max(0, this.organHit[k] - dt);
    if (over > 0) {
      if (this.overT === 0) this.fx.push({ k: 'overload' });
      this.overT += dt;
      for (const k of ORGAN_KEYS) { this.hurtOrgan(k, this.organRate(k, over) * dt, 'overload'); if (this.result) return; }
    } else {
      this.overT = 0;
      if (this.fatigue < F.tired && G.heal > 0) for (const k of ['liver', 'lungs']) this.organs[k] = Math.min(4, this.organs[k] + dt / G.heal);
    }
    const tier = this.fatigueTier();
    if (tier !== this.tier) { this.fx.push({ k: 'tier', tier, up: tier > this.tier }); this.logEvent({ e: 'tier', tier, fatigue: Math.round(this.fatigue) }); this.tier = tier; }
    this.tierTime[tier] += dt;
    const slow = (tier >= 1 ? F.tiredSpeed : 1) * this.moveMul();
    this.ringR = C.support.ring * (tier >= 3 ? F.exhaustedRing : 1);

    for (const tx of this.toxins) {
      if (tx.state === 'coming' && t >= tx.at) { tx.state = 'sweeping'; tx.front = 0; this.fx.push({ k: 'burst', u: WOUND.u, v: WOUND.v }); this.logEvent({ e: 'toxin', cellsInWound: this.cells.filter(c => !c.dead && c.u < ZONE).length }); }
      if (tx.state === 'sweeping') {
        tx.front += dt / C.toxin.sweep;
        const reach = tx.front * 340;
        for (const c of this.cells) if (!c.dead && c.u < ZB[1] && Math.hypot(c.u - WOUND.u, c.v - WOUND.v) < reach) { this.killCell(c, 'toxin'); this.stats.toxinDeaths++; }
        if (tx.front >= 1) tx.state = 'done';
      }
    }
    const warnTx = this.toxins.find(tx => tx.state === 'coming' && t >= tx.at - C.toxin.warn);
    this.warning = warnTx ? (warnTx.at - t) : 0;
    this.stepQuorum(dt);

    // --- production: the marrow is shared evenly by the zones that are on, through each one's vessel wall, then split by its mix
    const rate0 = C.marrow.rate * this.prodMul() * this.makeMul();
    const nMac = this.count('mac'), nNk = this.count('nk'), cellCap = this.cellCap();
    let total = this.cells.length;
    for (let z = 0; z < NZ; z++) {
      const zn = this.zones[z];
      if (!zn.on) continue;
      const mix = this.usedMix(zn, t), rate = rate0 * this.zoneOutput(z);
      for (const u of this.units) {
        zn.prog[u] += dt * rate * mix[u] / C.marrow[u];
        if (zn.prog[u] >= 1) {
          const capped = total >= cellCap || (u === 'mac' && nMac >= C.caps.mac) || (u === 'nk' && nNk >= C.caps.nk);
          if (capped) { zn.prog[u] = 1; continue; }
          zn.prog[u] -= 1; total++; this.stats.made++;
          const c = this.spawnCell(u, z);
          this.fx.push({ k: 'arrive', u: c.u, v: c.v, type: u });
        }
      }
    }

    // --- grids
    this.gA.clear(); this.gF.clear();
    for (const a of this.ag) if (!a.dead && !a.eaten) this.gA.add(a);
    for (const c of this.cells) if (!c.dead) this.gF.add(c);
    this.gH.clear();
    for (const h of this.hyphae) if (!h.dead && !h.wither) this.gH.add(h);
    // domes: mark what is sheltered, grow them
    for (const d of this.domes) d.r = Math.min(C.pseudo.domeMax, d.r + C.pseudo.domeGrow * dt * (d.hp / C.pseudo.domeHp));
    for (const a of this.ag) {
      a.domed = false;
      for (const d of this.domes) if ((a.u - d.u) ** 2 + (a.v - d.v) ** 2 < d.r * d.r) { a.domed = true; break; }
    }
    for (const w of this.webs) { w.life -= dt; w.r = this.penR(w); }
    if (this.webs.length) this.webs = this.webs.filter(w => w.life > 0);

    // --- your cells (a hurt brain makes every cell wander)
    const wob = (this.wanderMul() - 1) * C.organs.brainJitter;
    for (const c of this.cells) {
      if (c.dead) continue;
      c.age += dt;
      c.stun = Math.max(0, c.stun - dt);
      if (c.type === 'mac') this.stepMac(c, dt, slow);
      else if (c.type === 'neut') this.stepNeut(c, dt, slow, tier);
      else if (c.type === 'net') this.stepNet(c, dt, slow);
      else if (c.type === 'nk') this.stepNk(c, dt, slow);
      if (wob > 0) { const an = this.rand() * 6.283; c.vu += Math.cos(an) * wob * dt; c.vv += Math.sin(an) * wob * dt; }
    }
    // integrate and keep in bounds
    for (const c of this.cells) {
      if (c.dead) continue;
      c.u += c.vu * dt; c.v += c.vv * dt;
      if (c.u < 6) { c.u = 6; c.vu = Math.abs(c.vu) * 0.3; }
      if (c.u > L - 6) { c.u = L - 6; c.vu = -Math.abs(c.vu) * 0.3; }
      if (c.v < VESSEL * 0.3) { c.v = VESSEL * 0.3; c.vv = Math.abs(c.vv) * 0.3; }
      if (c.v > WIDTH - 6) { c.v = WIDTH - 6; c.vv = -Math.abs(c.vv) * 0.3; }
    }

    // --- fungus: yeast settles, hyphae creep and bud
    this.stepFungus(dt);

    // --- shots
    this.stepShots(dt);

    // --- antigens
    this.stepAntigens(dt);

    // --- collisions (your cells and antigens push each other around)
    this.collide();
    if (this.webs.length) this.penWalls();

    // --- cleanup
    if (this.cells.some(c => c.dead)) this.cells = this.cells.filter(c => !c.dead);
    if (this.ag.some(a => a.dead)) this.ag = this.ag.filter(a => !a.dead);
    if (this.shots.some(s => s.life <= 0)) this.shots = this.shots.filter(s => s.life > 0);
    if (this.domes.some(d => d.hp <= 0)) this.domes = this.domes.filter(d => d.hp > 0);
    if (this.hyphae.some(h => h.dead)) { this.hyphae = this.hyphae.filter(h => !h.dead); for (const f of this.fungi) f.list = f.list.filter(h => !h.dead); this.fungi = this.fungi.filter(f => f.list.length); }

    // --- zone counts, lymph node timer, end
    const zc = new Array(NZ).fill(0);
    for (const a of this.ag) if (!a.eaten && a.k !== 'spore') zc[zoneOf(a.u)]++;
    const th = new Array(NZ).fill(0);
    for (const h of this.hyphae) if (!h.wither) th[zoneOf(h.u)]++;
    for (let z = 0; z < NZ; z++) { this.zones[z].count = zc[z]; this.zones[z].threads = th[z]; }
    const live = this.ag.filter(a => !a.eaten).length;
    this.stats.peak = Math.max(this.stats.peak, live);
    // breach clocks: per organ, fill while its germs sit in the node (a bigger crowd fills a little faster), drain once they're gone
    const inNode = {};
    for (const a of this.ag) if (!a.eaten && !a.dead && a.k !== 'spore' && zoneOf(a.u) === LYMPH) { const k = this.organOf(a); inNode[k] = (inNode[k] || 0) + 1; }
    if (th[2] > 0) inNode.spleen = (inNode.spleen || 0) + 1; // Candida threads count as Candida
    this.inNode = inNode;
    if (zc[2] > 0 || th[2] > 0) {
      if (!this.lymph.reached) { this.lymph.reached = true; this.fx.push({ k: 'breach' }); this.logEvent({ e: 'breach', antigens: zc[2] }); }
    }
    const LY = C.lymph;
    for (const k of ORGAN_KEYS) {
      const n = inNode[k] || 0;
      if (n > 0) this.breach(k, dt / LY.fill * Math.min(LY.crowdCap, 1 + LY.crowd * (n - 1)), 'breach');
      else if (this.clocks[k]) this.clocks[k] = Math.max(0, this.clocks[k] - dt / LY.drain);
      if (this.result) return;
    }
    this.lymph.timer = Math.max(0, ...ORGAN_KEYS.map(k => this.clocks[k] || 0));
    this.lymph.peak = Math.max(this.lymph.peak, this.lymph.timer);
    this.histT -= dt;
    if (this.histT <= 0) {
      this.histT = 2;
      const ag = {}, cells = {};
      for (const a of this.ag) if (!a.dead && !a.eaten) ag[a.k] = (ag[a.k] || 0) + 1;
      for (const c of this.cells) if (!c.dead) { const k = c.type === 'mac' ? (c.tb ? 'macTB' : c.mode === 'support' ? 'macSupport' : 'macOffense') : c.type; cells[k] = (cells[k] || 0) + 1; }
      this.history.push({ t: +t.toFixed(1), z: zc.slice(), n: this.cells.length, m: nMac, timer: +this.lymph.timer.toFixed(3), clocks: Object.fromEntries(Object.entries(this.clocks).filter(([, v]) => v > 0).map(([k, v]) => [k, +v.toFixed(2)])), fatigue: +this.fatigue.toFixed(1), output: +this.output.toFixed(2), off: this.zones.map((q, i) => q.on ? -1 : i).filter(i => i >= 0), tier: this.tier, organs: Object.fromEntries(ORGAN_KEYS.map(k => [k, +this.organs[k].toFixed(2)])), domes: this.domes.length, hyphae: th[0] + th[1] + th[2], ag, cells, d: this.tally });
      this.tally = {};
    }
    const hidden = this.cells.some(c => c.infected) || this.hyphae.length > 0;
    if (t >= this.duration && live === 0 && !hidden && !this.pourQ.length) this.finish(true, 'The bar is full and every antigen is gone.');
  }

  // Steer a body toward a desired velocity with limited acceleration
  steer(c, du, dv, accel, dt) {
    let au = du - c.vu, av = dv - c.vv;
    const a = Math.hypot(au, av), lim = accel * dt;
    if (a > lim) { au *= lim / a; av *= lim / a; }
    c.vu += au; c.vv += av;
  }
  // Keep a cell near its home zone
  leashTarget(c) { const [lo, hi] = this.band(c.home); return c.u < lo ? 1 : c.u > hi ? -1 : 0; }

  stepNeut(n, dt, slow, tier) {
    const C = CONFIG, F = C.fatigue, r = this.rand, N = C.neutrophil;
    if (n.age >= N.life * (tier >= 2 ? F.feverLife : 1)) { this.killCell(n, 'age'); return; }
    if (n.infected) {
      n.infected -= dt;
      if (n.infected <= 0) { this.killCell(n, 'burst'); return; }
    }
    n.boosted = this.inRing(n.u, n.v);
    const [lo, hi] = this.band(n.home);
    n.turn -= dt;
    if (n.turn <= 0) {
      n.turn = N.turnEvery * (0.6 + r() * 0.8);
      const out = this.leashTarget(n);
      const tgt = this.nearestAg(n.u, n.v, 2000, a => a.u >= lo && a.u <= hi && a.k !== 'spore');
      let want;
      if (out) want = Math.atan2(NODE.v * 0.6 + n.v * 0.4 - n.v, out * 100);
      else if (tgt) {
        const d = Math.hypot(tgt.u - n.u, tgt.v - n.v);
        want = Math.atan2(tgt.v - n.v, tgt.u - n.u);
        if (d < N.standoff) want += Math.PI / 2 * (r() < 0.5 ? 1 : -1);
      } else want = Math.atan2(MID_V + (r() - 0.5) * 200 - n.v, zMid(n.home) - n.u) + (r() - 0.5) * 2;
      const wm = this.wanderMul(); n.head = !out && r() < N.stray * wm ? r() * 6.283 : want + N.zigzag * wm * (r() * 2 - 1) * (out ? 0.3 : 1);
    }
    const sp = N.speed * slow * (n.boosted ? C.support.speedMul : 1);
    this.steer(n, Math.cos(n.head) * sp, Math.sin(n.head) * sp, N.accel, dt);
    // Fire: prefer a target the shot can hurt
    n.cd -= dt;
    if (n.cd <= 0 && n.stun <= 0) {
      const can = n.boosted ? a => this.hittable(a) : a => this.hittable(a) && a.k !== 'mrsa';
      // germs under a slime dome are the last resort: shots only chip them (pseudo.shield)
      const aim = this.nearestAg(n.u, n.v, N.range, can) || this.nearestAg(n.u, n.v, N.range, a => this.hittable(a)) || this.nearestAg(n.u, n.v, N.range, a => !a.dead && !a.eaten && a.domed);
      if (aim) {
        n.cd = N.fireEvery;
        const d = Math.hypot(aim.u - n.u, aim.v - n.v), tt = d / N.shotSpeed;
        const au = aim.u + (aim.vu || 0) * tt, av = aim.v + (aim.vv || 0) * tt;
        const a = Math.atan2(av - n.v, au - n.u) + (r() - 0.5) * 2 * (N.spread + (tier >= 2 ? F.feverSpread : 0));
        this.shots.push({ u: n.u, v: n.v, pu: n.u, pv: n.v, du: Math.cos(a), dv: Math.sin(a), life: N.range * 1.4 / N.shotSpeed, tuned: n.boosted, from: n.id });
        n.vu -= Math.cos(a) * 4; n.vv -= Math.sin(a) * 4; // a little recoil
      } else n.cd = 0.05;
    }
  }
  stepNet(c, dt, slow) {
    const C = CONFIG, N = C.net;
    if (c.infected) { c.infected -= dt; if (c.infected <= 0) { this.killCell(c, 'burst'); return; } }
    const [lo, hi] = this.band(c.home);
    c.retarget -= dt;
    if (c.retarget <= 0) {
      c.retarget = 0.8;
      // the thickest crowd of small things in this zone
      let best = 0, bu = null, bv = null;
      const score = i => {
        const cu = (i % GC + 0.5) * CELL, cvv = (Math.floor(i / GC) + 0.5) * CELL;
        if (cu < lo || cu > hi) return;
        let n = 0; this.gA.each(cu, cvv, N.burst * 0.8, a => { if (this.netable(a)) n++; });
        // fungal threads count extra: only nets can cut them
        this.gH.each(cu, cvv, N.burst * 0.8, () => { n += 1.5; });
        if (n > best) { best = n; bu = cu; bv = cvv; }
      };
      for (const i of this.gA.used) if (this.gA.b[i].length >= 2) score(i);
      for (const i of this.gH.used) score(i);
      if (bu != null) { c.tu = bu; c.tv = bv; }
    }
    if (c.tu >= 0) {
      const du = c.tu - c.u, dv = c.tv - c.v, d = Math.hypot(du, dv);
      if (d < 7 || c.age >= N.fuse) { this.burstNet(c); return; }
      this.steer(c, du / d * N.speed * slow, dv / d * N.speed * slow, 260, dt);
    } else {
      if (c.age >= N.fuse) { this.burstNet(c); return; }
      this.steer(c, (zMid(c.home) - c.u) * 0.3, (NODE.v - c.v) * 0.3, 120, dt);
    }
  }
  netable(a) { return this.hittable(a) && a.k !== 'mrsa' && a.k !== 'worm' ? true : a.k === 'worm' && this.hittable(a); }
  burstNet(c) {
    const C = CONFIG, N = C.net;
    c.dead = true;
    // A pen, not a literal net: a closed perimeter that keeps the antigens caught inside (they still jostle and collide) and keeps others out
    const w = { u: c.u, v: c.v, r: N.burst, r0: N.burst, life: N.stick, max: N.stick, id: this.id++ };
    this.webs.push(w);
    this.fx.push({ k: 'net', u: c.u, v: c.v, r: N.burst });
    const hit = [];
    this.gA.each(c.u, c.v, N.burst, a => { if ((a.u - c.u) ** 2 + (a.v - c.v) ** 2 < N.burst * N.burst && this.netable(a)) hit.push(a); });
    for (const a of hit) this.damage(a, N.damage * (this.hasTrait(a, 'slick') ? CONFIG.evolve.slick : 1), 'net');
    for (const a of hit) if (!a.dead && !a.eaten && a.k !== 'worm') a.pen = w;
    const cut = [];
    this.gH.each(c.u, c.v, N.burst, h => { if (!h.dead && (h.u - c.u) ** 2 + (h.v - c.v) ** 2 < N.burst * N.burst) cut.push(h); });
    for (const h of cut) this.cutHypha(h);
    if (cut.length) { this.tick('cut.net', cut.length); this.fx.push({ k: 'cut', u: c.u, v: c.v, n: cut.length }); }
  }
  stepNk(c, dt, slow) {
    const C = CONFIG, K = C.nk;
    if (c.age >= K.life) { this.killCell(c, 'age'); return; }
    const [lo, hi] = this.band(c.home);
    c.retarget -= dt;
    if (c.retarget <= 0 || (c.target && c.target.dead)) {
      c.retarget = 0.5; c.target = null; let bd = Infinity;
      for (const o of this.cells) if ((o.infected || o.tb) && !o.dead && o !== c && o.u >= lo - 40 && o.u <= hi + 40) { const d = (o.u - c.u) ** 2 + (o.v - c.v) ** 2; if (d < bd) { bd = d; c.target = o; } }
    }
    const tg = c.target;
    if (tg) {
      const du = tg.u - c.u, dv = tg.v - c.v, d = Math.hypot(du, dv);
      if (d < K.reach + tg.r) { this.killCell(tg, 'nk'); this.fx.push({ k: 'nkPop', u: tg.u, v: tg.v }); c.target = null; return; }
      this.steer(c, du / d * K.speed * slow, dv / d * K.speed * slow, 150, dt);
    } else {
      // patrol among your neutrophils in the zone
      this.steer(c, (zMid(c.home) + Math.sin(this.t * 0.3 + c.id) * Math.min(90, zLen(c.home) * 0.3) - c.u) * 0.2, (NODE.v + Math.cos(this.t * 0.4 + c.id) * 120 - c.v) * 0.2, 80, dt);
    }
  }
  stepMac(m, dt, slow) {
    const C = CONFIG, M = C.macrophage, r = this.rand;
    if (m.tb) {
      m.tb.life -= dt; m.tb.spit -= dt;
      if (m.tb.spit <= 0) { m.tb.spit = C.tb.spitEvery; const a = this.spawnAg('tb', m.u + (r() - 0.5) * 10, m.v + (r() - 0.5) * 10); if (a) { a.blink = BLINK; a.vu = (r() - 0.5) * 60; a.vv = (r() - 0.5) * 60; } this.fx.push({ k: 'spit', u: m.u, v: m.v }); }
      if (m.tb.life <= 0 || m.tb.hp <= 0) { this.killCell(m, 'tb'); return; }
      this.steer(m, C.bacteria.drift * 0.5, Math.sin(this.t + m.id) * 6, 40, dt);
      return;
    }
    const mode = this.zones[m.home].mode;
    if (mode !== m.mode) { m.mode = mode; m.flip = 0.4; if (mode === 'support' && m.prey) this.release(m); }
    m.flip = Math.max(0, m.flip - dt);
    m.cd = Math.max(0, m.cd - dt);
    let tu = m.pu, tv = m.pv, sp = M.speed * slow;
    if (m.stun > 0) sp = 0;
    else if (m.gulp > 0) {
      m.gulp -= dt;
      const p = m.prey;
      if (p && p.hypha) { if (m.gulp <= 0) { const n = this.chewHypha(p.hypha); this.tick('cut.chew', n); this.fx.push({ k: 'chew', u: m.u, v: m.v }); m.prey = null; m.cd = M.eatEvery; } }
      else if (p && p.dome) { if (m.gulp <= 0) { p.dome.hp -= 1; p.dome.r *= 0.82; this.fx.push({ k: 'chew', u: m.u, v: m.v }); m.prey = null; m.cd = M.eatEvery; } }
      else if (p) {
        p.u += (m.u - p.u) * Math.min(1, dt * 8); p.v += (m.v - p.v) * Math.min(1, dt * 8);
        if (m.gulp <= 0 && this.hasTrait(p, 'capsule') && !p.stripped) {
          // capsule: the first gulp only strips it off, and the macrophage lets go
          p.stripped = true; this.release(m); m.cd = M.eatEvery; this.fx.push({ k: 'chew', u: m.u, v: m.v });
        } else if (m.gulp <= 0) {
          p.dead = true; m.prey = null; this.stats.swallows++; m.cd = M.eatEvery; this.tick('kill.swallow.' + p.k);
          if (p.k === 'strep') this.unlink(p, true);
          if (p.k === 'tb') { m.tb = { life: C.tb.infectLife, spit: C.tb.spitEvery * 0.5, hp: C.tb.macHp }; this.fx.push({ k: 'infect', u: m.u, v: m.v }); }
        }
      }
      sp = 0;
    } else if (m.mode === 'offense' && m.cd <= 0) {
      const lo = ZB[m.home] - 10, hi = ZB[m.home + 1] + 10;
      const b = this.nearestAg(m.u, m.v, 2000, a => KINDS[a.k].edible && !a.domed && a.u >= lo && a.u < hi);
      let dome = null, dd = Infinity;
      for (const d of this.domes) if (d.u >= lo && d.u < hi) { const x = Math.hypot(d.u - m.u, d.v - m.v) - d.r; if (x < dd) { dd = x; dome = d; } }
      const bd = b ? Math.hypot(b.u - m.u, b.v - m.v) : Infinity;
      // fungal threads: chew the nearest tip
      let tip = null, td = Infinity;
      if (this.hyphae.length) for (const h of this.hyphae) if (!h.dead && !h.wither && h.u >= lo && h.u < hi && !h.kids.some(k => !k.dead && !k.wither)) { const x = Math.hypot(h.u - m.u, h.v - m.v); if (x < td) { td = x; tip = h; } }
      if (tip && td < bd && td < dd) {
        tu = tip.u; tv = tip.v;
        if (td < M.reach) { m.prey = { hypha: tip, u: tip.u, v: tip.v }; m.gulp = M.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
      } else if (dome && dd < bd) {
        tu = dome.u; tv = dome.v;
        if (dd < M.reach) { m.prey = { dome }; m.gulp = M.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
      } else if (b) {
        tu = b.u; tv = b.v;
        if (bd < M.reach + b.r) { m.prey = b; b.eaten = true; m.gulp = M.gulp; this.fx.push({ k: 'gulp', id: m.id, u: m.u, v: m.v }); sp = 0; }
      }
    }
    const du = tu - m.u, dv = tv - m.v, d = Math.hypot(du, dv);
    const want = d > 2 ? Math.min(sp, d * 2) : 0;
    this.steer(m, d > 0.01 ? du / d * want : 0, d > 0.01 ? dv / d * want : 0, 60, dt);
  }
  release(m) { if (m.prey && !m.prey.dome) m.prey.eaten = false; m.prey = null; m.gulp = 0; }

  // ---- fungus (Candida) ----
  stepFungus(dt) {
    const F = CONFIG.fungus, r = this.rand;
    for (const a of this.ag) {
      if (a.k !== 'yeast' || a.dead || a.eaten || a.domed || zoneOf(a.u) > 1 || a.age < F.settle || this.hyphae.length >= F.cap) continue;
      // settles and sprouts: the yeast becomes the root of a thread
      a.dead = true;
      const f = { id: this.id++, list: [], grow: F.grow, bud: F.budEvery * (0.6 + r() * 0.6) };
      const root = this.addHypha(f, null, a.u, a.v, (r() - 0.5) * 1.0);
      f.root = root; this.fungi.push(f);
      this.tick('sprout'); this.fx.push({ k: 'sprout', u: a.u, v: a.v });
    }
    for (const f of this.fungi) {
      // threads stop creeping once the level's script is over, so the last ones can be cleared
      if (!f.root || f.root.dead || f.root.wither || this.t >= this.duration) continue;
      f.grow -= dt;
      while (f.grow <= 0) {
        f.grow += F.grow;
        if (f.list.length >= F.maxSegs || this.hyphae.length >= F.cap) break;
        const tips = f.list.filter(h => !h.dead && !h.wither && h.u < L - 40 && !h.kids.some(k => !k.dead && !k.wither));
        if (!tips.length) break;
        const tip = tips[Math.floor(r() * tips.length)];
        this.extendHypha(f, tip, tip.dir + (r() - 0.5) * 2 * F.wiggle);
        if (r() < F.branch) this.extendHypha(f, tip, tip.dir + (r() < 0.5 ? -0.8 : 0.8));
      }
      f.bud -= dt;
      if (f.bud <= 0 && f.list.length >= 8) {
        f.bud = F.budEvery;
        const live = f.list.filter(h => !h.dead && !h.wither);
        const h = live[Math.floor(r() * live.length)];
        if (h) { const y = this.spawnAg('yeast', h.u, h.v); if (y) { y.blink = BLINK; y.vu = (r() - 0.5) * 30; y.vv = (r() - 0.5) * 30; } }
      }
    }
    for (const h of this.hyphae) if (h.wither > 0) { h.wither -= dt; if (h.wither <= 0) h.dead = true; }
  }
  addHypha(f, parent, u, v, dir) {
    const h = { id: this.id++, u, v, p: parent, kids: [], dir, wither: 0, dead: false, age: 0, f: f.id };
    if (parent) parent.kids.push(h);
    f.list.push(h); this.hyphae.push(h);
    return h;
  }
  extendHypha(f, tip, dir) {
    const F = CONFIG.fungus;
    dir *= 0.9; // drift back toward the Lymph node (downstream)
    let u = tip.u + Math.cos(dir) * F.seg, v = tip.v + Math.sin(dir) * F.seg;
    if (v < VESSEL + 10 || v > WIDTH - FAR_VESSEL - 10) { dir = -dir; v = Math.max(VESSEL + 10, Math.min(WIDTH - FAR_VESSEL - 10, tip.v + Math.sin(dir) * F.seg)); }
    u = Math.max(6, Math.min(L - 20, u));
    return this.addHypha(f, tip, u, v, dir);
  }
  // A net cuts a segment: it dies, and everything past it is cut off from the root and withers
  cutHypha(h) {
    if (h.dead) return;
    h.dead = true;
    const stack = h.kids.slice();
    while (stack.length) { const k = stack.pop(); if (k.dead) continue; if (!k.wither) k.wither = CONFIG.fungus.wither; for (const c of k.kids) stack.push(c); }
  }
  // A macrophage chews a few segments back from a tip (nothing withers)
  chewHypha(tip) {
    let h = tip, n = 0;
    while (h && !h.dead && n < CONFIG.fungus.chew && !h.kids.some(k => !k.dead && !k.wither)) { h.dead = true; n++; h = h.p; }
    return n;
  }
  stepShots(dt) {
    const C = CONFIG, N = C.neutrophil;
    for (const s of this.shots) {
      s.pu = s.u; s.pv = s.v;
      const step = N.shotSpeed * dt;
      s.u += s.du * step; s.v += s.dv * step; s.life -= dt;
      if (s.life <= 0) continue;
      // domes no longer swallow shots: like MRSA's armor they cut damage hard (pseudo.shield) but don't stop it
      let hit = null, best = Infinity;
      this.gA.each((s.u + s.pu) / 2, (s.v + s.pv) / 2, step / 2 + 10, a => {
        if (a.dead || a.eaten) return;
        const wu = a.u - s.pu, wv = a.v - s.pv, proj = Math.max(0, Math.min(step, wu * s.du + wv * s.dv));
        const cu = s.pu + s.du * proj, cv = s.pv + s.dv * proj;
        if ((a.u - cu) ** 2 + (a.v - cv) ** 2 > (a.r + 1.3) ** 2) return;
        if (proj < best) { best = proj; hit = a; }
      });
      // TB-infected macrophages are left to NK cells (like NK and killer T cells in the body): shots pass by them
      if (!hit) continue;
      s.life = 0;
      const cu = s.pu + s.du * best, cv = s.pv + s.dv * best;
      if (hit.k === 'spore') { this.stats.bounced++; this.fx.push({ k: 'bounce', u: cu, v: cv, du: -s.du, dv: -s.dv }); continue; }
      if (hit.domed && hit.k !== 'worm') {
        hit.vu += s.du * C.bacteria.knock / hit.m * 0.2; hit.vv += s.dv * C.bacteria.knock / hit.m * 0.2;
        this.stats.bounced++; this.fx.push({ k: 'fizzle', u: cu, v: cv });
        this.damage(hit, s.tuned ? 1 : C.pseudo.shield * (this.hasTrait(hit, 'wall') ? C.evolve.wall : 1), s.tuned ? 'tuned' : 'shot', cu, cv);
        continue;
      }
      const kb = C.bacteria.knock / hit.m * (hit.k === 'mrsa' ? 0.4 : 1);
      hit.vu += s.du * kb; hit.vv += s.dv * kb;
      if (hit.k === 'mrsa' && !s.tuned) this.stats.bounced++; // plain shots only chip the armor (hp)
      if (hit.k === 'worm') this.damage(hit, s.tuned ? C.worm.tunedDamage : 1, 'shot', cu, cv);
      else if (s.tuned) this.damage(hit, Infinity, 'tuned', cu, cv);
      else this.damage(hit, this.hasTrait(hit, 'wall') ? C.evolve.wall : 1, 'shot', cu, cv);
    }
  }
  // Apply damage; handles chains splitting, tapeworm pieces
  damage(a, n, how, hu, hv) {
    if (a.dead) return;
    a.hp -= n; a.flash = 0.12;
    if (a.hp > 0) { this.fx.push({ k: 'hit', u: hu == null ? a.u : hu, v: hv == null ? a.v : hv }); return; }
    a.dead = true;
    if (how === 'net') this.stats.netKills++; else this.stats.shotKills++;
    this.tick(`kill.${how || 'shot'}.${a.k}`);
    this.fx.push({ k: 'pop', u: a.u, v: a.v, tuned: how === 'tuned', armored: a.k === 'mrsa', kind: a.k });
    if (a.k === 'strep') this.unlink(a, how === 'tuned');
    if (a.k === 'worm') {
      this.unlink(a, false);
      const w = this.spawnAg('wormlet', a.u, a.v); if (w) { w.vu = (this.rand() - 0.5) * 80; w.vv = (this.rand() - 0.5) * 80; }
    }
  }
  // Remove a link from its chain: rejoin the neighbours, or split the chain in two
  unlink(a, rejoin) {
    const p = a.prev, n = a.next;
    if (n) n.prev = rejoin ? p : null;
    if (p) p.next = rejoin ? n : null;
    a.prev = a.next = null;
  }
  killCell(c, why) {
    if (c.dead) return;
    c.dead = true;
    this.tick(`lost.${c.type}.${why || 'other'}`);
    if (c.type === 'mac' && c.prey) this.release(c);
    if (c.infected && why !== 'nk' && why !== 'age') {
      // Herpes bursts out of its host
      for (let i = 0; i < CONFIG.herpes.burst; i++) { const a = this.spawnAg('virus', c.u, c.v); if (a) { a.blink = BLINK; const an = this.rand() * 6.283; a.vu = Math.cos(an) * 50; a.vv = Math.sin(an) * 50; } }
      this.fx.push({ k: 'virusBurst', u: c.u, v: c.v });
    }
    this.fx.push({ k: why === 'age' ? 'expire' : 'die', u: c.u, v: c.v, who: c.type });
  }

  stepAntigens(dt) {
    const C = CONFIG, P = C.physics, B = C.bacteria, r = this.rand, t = this.t;
    const counts = new Array(NZ).fill(0);
    for (const a of this.ag) if (!a.dead && !a.eaten) counts[zoneOf(a.u)]++;
    let live = counts.reduce((a, b) => a + b, 0);
    const cr2 = B.crowdRadius ** 2;
    const born = [];
    const F = C.fungus, hw = this.hyphae.length > 0;
    // Fever slows division (Alex, 2026-10-08, from the Sandbox): bacteria age slower toward their next division while you run hot.
    // Viruses copy themselves inside your cells, so they don't care.
    const fev = C.fever.on ? [1, C.fever.tired, C.fever.feverish, C.fever.exhausted][this.fatigueTier()] : 1;
    for (const a of this.ag) {
      if (a.dead || a.eaten) continue;
      a.flash = Math.max(0, a.flash - dt); if (a.blink > 0) a.blink -= dt;
      a.age += KINDS[a.k] && KINDS[a.k].divides ? dt * fev : dt;
      const z = zoneOf(a.u), K = KINDS[a.k];
      // what this antigen wants to do: a target velocity
      let tu = B.drift + B.crowdDrift * Math.max(0, counts[z] - B.crowdStart), tv = 0, grip = P.flowGrip;
      const pool = z === LYMPH;
      if (a.k === 'flu' || a.k === 'wormlet') { const sp = a.k === 'flu' ? C.flu.speed : C.worm.wormletSpeed; const d = Math.hypot(NODE.u - a.u, NODE.v - a.v) || 1; tu = (NODE.u - a.u) / d * sp + B.drift; tv = (NODE.v - a.v) / d * sp + Math.sin(t * 3 + a.id) * 8; grip = 3; }
      else if (a.k === 'virus') {
        let host = null, bd = C.herpes.seek ** 2;
        this.gF.each(a.u, a.v, C.herpes.seek, c => { if ((c.type === 'neut' || c.type === 'net') && !c.infected && !c.dead) { const d = (c.u - a.u) ** 2 + (c.v - a.v) ** 2; if (d < bd) { bd = d; host = c; } } });
        if (host) {
          const d = Math.sqrt(bd) || 1;
          if (d < host.r + a.r + 1) { a.dead = true; host.infected = C.herpes.incubate; this.fx.push({ k: 'infect', u: host.u, v: host.v }); continue; }
          tu = (host.u - a.u) / d * C.herpes.speed; tv = (host.v - a.v) / d * C.herpes.speed; grip = 4;
        }
        if (a.age > C.herpes.life) { a.dead = true; continue; }
      } else if (K.chain && !a.prev) {
        // chain head
        const sp = a.k === 'strep' ? C.strep.speed : L / C.worm.cross;
        const d = Math.hypot(NODE.u - a.u, NODE.v - a.v) || 1;
        tu = (NODE.u - a.u) / d * sp; tv = (NODE.v - a.v) / d * sp + Math.sin(t * (a.k === 'strep' ? 4 : 1.2) + a.id) * (a.k === 'strep' ? 10 : 4);
        grip = a.k === 'worm' ? 2 : 4;
      } else if (K.chain && a.prev) {
        // follow the link ahead
        const p = a.prev, gap = a.r + p.r + 0.4, du = p.u - a.u, dv = p.v - a.v, d = Math.hypot(du, dv) || 1;
        const pull = (d - gap) * 8;
        tu = p.vu + du / d * pull; tv = p.vv + dv / d * pull; grip = 10;
      } else if (a.k === 'pseudo' && a.anchored) { tu = 0; tv = 0; grip = 8; }
      else if (a.domed) { tu *= 0.1; }
      else if (pool) { tu = (NODE.u - a.u) * 0.3; tv = (NODE.v - a.v) * 0.12; }
      if (a.k === 'spore') tu *= 0.5;
      if (K.slow) tu *= 0.5;
      // riding a fungal thread: a highway toward the Lymph node
      if (hw && !(K.chain && a.prev) && !a.anchored && !a.domed && a.k !== 'spore') {
        let on = false; this.gH.each(a.u, a.v, F.reach, h => { if ((h.u - a.u) ** 2 + (h.v - a.v) ** 2 < F.reach * F.reach) { on = true; return false; } });
        if (on) { tu = Math.max(tu, B.drift) * F.highway; grip = Math.max(grip, 3); }
      }
      if (a.pen) { if (a.pen.life <= 0) a.pen = null; else { tu *= 0.3; tv *= 0.3; } } // penned: sluggish, still pushing and colliding
      a.vu += (tu - a.vu) * Math.min(1, grip * dt);
      a.vv += (tv - a.vv) * Math.min(1, grip * dt);
      if (!K.chain) { a.vu += (r() - 0.5) * P.brownian * dt; a.vv += (r() - 0.5) * P.brownian * dt; }
      const sp = Math.hypot(a.vu, a.vv); if (sp > B.maxSpeed) { a.vu *= B.maxSpeed / sp; a.vv *= B.maxSpeed / sp; }
      a.u += a.vu * dt; a.v += a.vv * dt;
      a.u = Math.max(4, Math.min(L - 6, a.u));
      if (a.v < VESSEL + 6) { a.v = VESSEL + 6; a.vv = Math.abs(a.vv) * 0.3; }
      if (a.v > WIDTH - FAR_VESSEL - 6) { a.v = WIDTH - FAR_VESSEL - 6; a.vv = -Math.abs(a.vv) * 0.3; }
      a.rot += dt * (K.chain ? 0 : 0.3);
      if (K.chain) a.rot = a.prev ? Math.atan2(a.prev.v - a.v, a.prev.u - a.u) : Math.atan2(a.vv, a.vu);
      // flu splits once when it reaches the Tissue
      if (a.k === 'flu' && !a.split && a.u >= ZB[1]) {
        a.split = true; a.blink = BLINK;
        for (let i = 1; i < C.flu.split; i++) { const b = this.spawnAg('flu', a.u, a.v + (r() - 0.5) * 6, { split: true }); if (b) { b.blink = BLINK; b.vu = a.vu; b.vv = (r() - 0.5) * 40; } }
        this.fx.push({ k: 'split', u: a.u, v: a.v });
      }
      // pseudomonas settles and grows a dome
      if (a.k === 'pseudo' && !a.anchored && z < 2 && a.age > C.pseudo.settle && !a.domed && this.domes.length < C.pseudo.domeCap && !this.domes.some(d => Math.hypot(d.u - a.u, d.v - a.v) < d.r + 30)) {
        a.anchored = true; this.domes.push({ u: a.u, v: a.v, r: 8, hp: C.pseudo.domeHp, id: this.id++ });
        this.fx.push({ k: 'dome', u: a.u, v: a.v }); this.tick('dome');
      }
      // division
      if (KINDS[a.k].divides && live + born.length < B.maxCount) {
        let near = 0; this.gA.each(a.u, a.v, B.crowdRadius, o => { if (o !== a && (o.u - a.u) ** 2 + (o.v - a.v) ** 2 < cr2) near++; });
        if (near < B.crowdMax && a.age >= a.div) {
          a.age = 0; a.div = this.divTime(a.k);
          const an = r() * 6.283;
          born.push([a.k, a.u + Math.cos(an) * a.r * 1.6, a.v + Math.sin(an) * a.r * 1.6, Math.cos(an) * 12, Math.sin(an) * 12, a.tr]);
          a.vu -= Math.cos(an) * 8; a.vv -= Math.sin(an) * 8;
          a.hp = a.maxHp; a.blink = BLINK;
        } else if (a.age >= a.div) a.age = a.div;
      }
    }
    for (const nb of born) { const b = this.spawnAg(nb[0], nb[1], nb[2]); if (b) { b.tr = nb[5] || null; b.vu = nb[3]; b.vv = nb[4]; b.blink = BLINK; this.fx.push({ k: 'divide', u: nb[1], v: nb[2] }); } }
  }

  // Soft collisions: overlapping bodies push apart and trade momentum
  // Net pens tighten from full size to 75% as they fade
  penR(w) { return w.r0 * (0.75 + 0.25 * Math.max(0, w.life) / w.max); }
  // Pen walls: antigens inside bounce off the rim from within; antigens outside bounce off it from outside
  penWalls() {
    const e = 0.6;
    for (const w of this.webs) {
      if (w.life <= 0) continue;
      const R = w.r;
      this.gA.each(w.u, w.v, R + 10, a => {
        if (a.dead || a.eaten || a.k === 'worm') return;
        const du = a.u - w.u, dv = a.v - w.v, d = Math.hypot(du, dv) || 1e-6, nu = du / d, nv = dv / d;
        const vr = a.vu * nu + a.vv * nv;
        if (a.pen === w) {
          const lim = Math.max(0.5, R - a.r);
          if (d > lim) { a.u = w.u + nu * lim; a.v = w.v + nv * lim; if (vr > 0) { a.vu -= (1 + e) * vr * nu; a.vv -= (1 + e) * vr * nv; } }
        } else if (!a.pen) {
          const lim = R + a.r;
          if (d < lim) { a.u = w.u + nu * lim; a.v = w.v + nv * lim; if (vr < 0) { a.vu -= (1 + e) * vr * nu; a.vv -= (1 + e) * vr * nv; } }
        }
      });
    }
  }
  collide() {
    const C = CONFIG, P = C.physics;
    const pair = (a, b) => {
      if (a === b || a.dead || b.dead || a.eaten || b.eaten) return;
      if (a.prev === b || a.next === b) return;
      const du = b.u - a.u, dv = b.v - a.v, rr = a.r + b.r, d2 = du * du + dv * dv;
      if (d2 >= rr * rr || d2 < 1e-6) return;
      const d = Math.sqrt(d2), nu = du / d, nv = dv / d, over = rr - d;
      const ia = 1 / a.m, ib = 1 / b.m, wa = ia / (ia + ib), wb = ib / (ia + ib);
      a.u -= nu * over * wa * P.stiff; a.v -= nv * over * wa * P.stiff;
      b.u += nu * over * wb * P.stiff; b.v += nv * over * wb * P.stiff;
      const vr = (b.vu - a.vu) * nu + (b.vv - a.vv) * nv;
      if (vr < 0) {
        const j = -(1 + P.bounce) * vr / (ia + ib);
        a.vu -= j * ia * nu; a.vv -= j * ia * nv; b.vu += j * ib * nu; b.vv += j * ib * nv;
      }
    };
    // rebuild buckets after movement
    this.gA.clear(); this.gF.clear();
    for (const a of this.ag) if (!a.dead && !a.eaten) this.gA.add(a);
    for (const c of this.cells) if (!c.dead) this.gF.add(c);
    // Grid.each written out here so no closure is made per body per step; same buckets, same order, same pairs
    const near = (grid, o, after) => {
      const u = o.u, v = o.v, rad = o.r + 9, id = o.id, B = grid.b;
      const c0 = Math.max(0, Math.floor((u - rad) / CELL)), c1 = Math.min(GC - 1, Math.floor((u + rad) / CELL));
      const r0 = Math.max(0, Math.floor((v - rad) / CELL)), r1 = Math.min(GR - 1, Math.floor((v + rad) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const a = B[r * GC + c]; for (let i = 0; i < a.length; i++) if (!after || a[i].id > id) pair(o, a[i]); }
    };
    for (const a of this.ag) { if (a.dead || a.eaten) continue; near(this.gA, a, true); }
    for (const c of this.cells) {
      if (c.dead) continue;
      near(this.gF, c, true);
      near(this.gA, c, false);
    }
  }

  fireStorm() {
    const C = CONFIG, S = C.storm, r = this.rand;
    let kills = 0;
    for (const a of this.ag) {
      if (a.dead || a.eaten || a.k === 'spore' || a.domed) continue;
      if (a.k === 'worm') { a.hp -= a.maxHp * S.worm; if (a.hp <= 0) this.damage(a, 0, 'storm'); continue; }
      if (r() < S.kill * (this.hasTrait(a, 'hardy') ? C.evolve.hardy : 1)) { a.dead = true; kills++; this.tick('kill.storm.' + a.k); if (a.k === 'strep') this.unlink(a, false); this.fx.push({ k: 'pop', u: a.u, v: a.v, storm: true, kind: a.k }); }
    }
    for (const c of this.cells) {
      if (c.dead) continue;
      if (c.type === 'neut' || c.type === 'net') { if (r() < S.friendly) this.killCell(c, 'storm'); }
      else if (c.type === 'mac') { c.stun = S.stun; if (c.prey) this.release(c); }
    }
    this.stats.stormKills += kills; this.stats.storms++;
    const before = this.fatigue;
    this.fatigue = Math.min(C.fatigue.max, this.fatigue + S.cost);
    this.logEvent({ e: 'storm', kills, fatigueBefore: Math.round(before), fatigueAfter: Math.round(this.fatigue) });
    this.storm.after = S.after; this.storm.justFired = true;
    this.fx.push({ k: 'storm', kills });
  }

  finish(win, reason, cause) {
    const st = this.stats;
    const goals = [
      { text: 'Clear every antigen', hit: win },
      { text: 'No breach clock passed half', hit: win && this.lymph.peak <= 0.5 },
      { text: 'No antigen reached the Lymph node', hit: win && !this.lymph.reached },
    ];
    this.logEvent({ e: 'end', win, cause: cause || (win ? 'win' : 'lymph') });
    this.result = { win, reason, cause: cause || (win ? 'win' : 'lymph'), t: this.t, goals, stars: goals.filter(g => g.hit).length, stats: { ...st }, peakTimer: this.lymph.peak, fatiguePeak: this.fatiguePeak, tierTime: this.tierTime.slice(), organs: Object.assign({}, this.organs) };
  }
}

if (typeof module !== 'undefined') module.exports = { BLINK, BLINK_WARN, ORGAN_KEYS, ORGAN_NAMES, Game, DEFAULTS, CONFIG, LEVELS, LEVEL_ORDER, KINDS, UNIT_NAMES, HINTS, mergeConfig, mulberry32, zoneOf, L, WIDTH, ZONE, ZB, NZ, LYMPH, zStart, zLen, zMid, VESSEL, FAR_VESSEL, MID_V, EVOLVE, WOUND, NODE, ZONES };

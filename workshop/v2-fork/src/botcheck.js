// Bot check for workshop mechanics on the Papercut script: node src/botcheck.js [seeds] [policies]
// Runs each policy with Toxin load off and on (TOXIN=on|off|both, default both) and prints wins and toxin peaks.
// Bots press only the player's buttons (marrow, zone modes, Body output, storm), every 0.5 s of game time.
const sim = require('./sim.js');
const { Game, ZONE, mergeConfig } = sim;
if (process.env.TUNE) mergeConfig(JSON.parse(process.env.TUNE));

const armoredIn = (g, z) => g.bact.some(b => b.armored && !b.eaten && Math.floor(b.u / ZONE) === z);
function randomPress(g) {
  const x = g.rand2();
  if (x < 0.35) g.toggleZone(Math.floor(g.rand2() * 3));
  else if (x < 0.65) g.setMarrow(['neut', 'mac', 'net', 'nk'][Math.floor(g.rand2() * 4)]);
  else if (x < 0.97) g.setOutput(g.rand2());
  else g.fireStorm();
}
function pacedOutput(g) {
  const soon = g.markers().some(m => m.kind === 'wave' && m.t - g.t < 15);
  const busy = soon || g.bact.length > 40;
  g.setOutput(g.fatigue > 45 ? 0.2 : busy && g.fatigue < 30 ? 0.85 : 0.5);
}
const POLICIES = {
  idle: () => {},
  random: g => { if (g.rand2() < 0.5) randomPress(g); },
  randomSlow: g => { if (g.rand2() < 0.06) randomPress(g); },
  // v2's good player: some macrophages, Support where armor shows up or a zone is swamped
  smart: g => {
    g.setMarrow(g.mac.length < 14 ? 'mac' : 'neut');
    for (let z = 0; z < 3; z++) g.setZone(z, armoredIn(g, z) || g.zones[z].count > 30 ? 'support' : 'offense');
    pacedOutput(g);
  },
  // Kill fast: a few macrophages for rings, then all neutrophils; Support anywhere with work to do
  shootHeavy: g => {
    g.setMarrow(g.mac.length < 8 ? 'mac' : 'neut');
    for (let z = 0; z < 3; z++) g.setZone(z, armoredIn(g, z) || g.zones[z].count > 12 ? 'support' : 'offense');
    pacedOutput(g);
  },
  // Kill clean: lots of macrophages, Offense everywhere, Support only when a zone is swamped
  swallowHeavy: g => {
    g.setMarrow(g.mac.length < 22 ? 'mac' : 'neut');
    for (let z = 0; z < 3; z++) g.setZone(z, g.zones[z].count > 35 ? 'support' : 'offense');
    pacedOutput(g);
  },
  swallowAll: g => {
    g.setMarrow(g.mac.length < 32 ? 'mac' : 'neut');
    for (let z = 0; z < 3; z++) g.setZone(z, g.zones[z].count > 45 ? 'support' : 'offense');
    pacedOutput(g);
  },
};

const seeds = (process.argv[2] || '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number);
const names = process.argv[3] ? process.argv[3].split(',') : Object.keys(POLICIES);
const modes = process.env.TOXIN === 'on' ? [true] : process.env.TOXIN === 'off' ? [false] : [false, true];
for (const name of names) {
  const line = [];
  for (const tox of modes) {
    let wins = 0, toxPeak = 0, pinned = 0, fat = 0, collapses = 0;
    for (const seed of seeds) {
      const g = new Game('papercut', seed, { script: true, toxinLoad: tox });
      g.rand2 = (() => { let a = seed * 7919 + 3; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
      while (!g.result && g.t < 600) {
        if (Math.round(g.t * 60) % 30 === 0) POLICIES[name](g);
        g.step(1 / 60); g.fx.length = 0;
      }
      if (g.result && g.result.win) wins++;
      if (g.result && g.result.why === 'collapse') collapses++;
      toxPeak = Math.max(toxPeak, g.toxPeak); pinned += g.toxPinned; fat = Math.max(fat, g.fatiguePeak);
    }
    line.push(`toxin ${tox ? 'on ' : 'off'}: ${String(wins).padStart(2)}/${seeds.length} wins${collapses ? ` (${collapses} storm deaths)` : ''}, toxin peak ${toxPeak.toFixed(0)}, pinned ${(pinned / seeds.length).toFixed(0)} s/match, fatigue peak ${fat.toFixed(0)}`);
  }
  console.log(`${name.padEnd(13)} ${line.join(' | ')}`);
}

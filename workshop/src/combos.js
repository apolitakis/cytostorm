'use strict';
// Starting combos for the Sandbox: spawn rates (groups per 10 s), a production mix for every zone,
// zone modes and body output, plus the question each one tests. Applying one restarts the match.
const R = o => Object.assign(ZERO_RATES(), o);
const COMBOS = {
  sandbox:  { name: 'Empty sandbox', blurb: 'Nothing spawns. Add whatever you want.', rates: R({}) },
  staph:    { name: 'Staph stream', blurb: 'A steady stream of grunts. The baseline.', rates: R({ staph: 7 }) },
  mrsaDome: { name: 'MRSA + Pseudomonas', blurb: 'One wants Support, the other wants Offense. Which zone gets which?', rates: R({ mrsa: 1, pseudo: 1, staph: 1.5 }), mix: { neut: 0.7, mac: 0.3 } },
  flu:      { name: 'Flu season', blurb: 'Swarms of one-hit flu that split in the Tissue. Try Nets.', rates: R({ flu: 4, staph: 3 }), mix: { neut: 0.6, net: 0.4 } },
  tb:       { name: 'TB trap', blurb: 'Offense feeds TB, but Pseudomonas domes need Offense.', rates: R({ tb: 2.5, pseudo: 1, staph: 2 }), mix: { neut: 0.7, mac: 0.2, nk: 0.1 } },
  spores:   { name: 'Spore timing', blurb: 'Rest the slider while spores sit, push it before they hatch.', rates: R({ spore: 0.5, mrsa: 0.5, staph: 2 }) },
  drain:    { name: 'Toxic drain', blurb: 'Fatigue builds twice as fast while toxic Staph lives.', rates: R({ toxic: 3.5, strep: 0.8 }), output: 0.75 },
  strep:    { name: 'Strep rush', blurb: 'Chains sprint for the Lymph node and split when shot.', rates: R({ strep: 2.5, staph: 3 }) },
  herpes:   { name: 'Herpes sleeper', blurb: 'Your neutrophils turn on you. NK cells pop them first.', rates: R({ virus: 2, staph: 4 }), mix: { neut: 0.7, nk: 0.3 } },
  worm:     { name: 'Tapeworm boss', blurb: 'One huge worm crawls in. Support rings hit it harder.', rates: R({ staph: 3 }), boss: true, zones: ['support', 'support', 'offense'] },
  storm:    { name: 'Storm or die', blurb: 'Far too much at once. Is a storm worth it?', rates: R({ staph: 6, flu: 0.6, mrsa: 0.8 }) },
  chaos:    { name: 'Everything', blurb: 'A little of every antigen. Pure chaos.', rates: R({ staph: 1.2, mrsa: 0.4, pseudo: 0.4, flu: 0.4, spore: 0.15, tb: 0.3, toxic: 0.3, strep: 0.3, virus: 0.3 }), mix: { neut: 0.55, net: 0.15, nk: 0.1, mac: 0.2 } },
  fever:    { name: 'Fever gamble', blurb: 'Run hot so Fever slows the Staph down, but your cells suffer. (Fever slows division is on unless you switched it off.)', rates: R({ staph: 8, toxic: 0.5 }), output: 0.8 },
  measles:  { name: 'Measles', blurb: 'A virus that hijacks macrophages. Offense feeds it. NK cells are the answer.', rates: R({ measles: 1.2, staph: 3 }), mix: { neut: 0.6, mac: 0.25, nk: 0.15 } },
  fungus:   { name: 'Fungus highway', blurb: 'Candida grows threads that carry Staph to the Lymph node. No Nets yet: add some to cut them.', rates: R({ yeast: 3, staph: 3 }), mix: { neut: 0.85, mac: 0.15 } },
  jaundice: { name: 'Jaundice', blurb: 'A Hepatitis stream crosses the Tissue for the left blood vessel. Every leak costs the liver part of a bar, and a hurt liver makes new cells slower. Nets catch swarms.', rates: R({ hep: 7, staph: 2 }), dev: { organs: true, leakZone: '1' }, mix: { neut: 0.55, mac: 0.45 } },
  badWater: { name: 'Bad water', blurb: 'E. coli plus Staph at high Stress. Leaks hurt the kidneys. With Toxin load on, shooting E. coli dumps toxin: swallow it.', rates: R({ ecoli: 5, staph: 4 }), dev: { organs: true, leakZone: 'random' }, output: 0.85, mix: { neut: 0.55, mac: 0.45 } },
  empty:    { name: 'Running on empty', blurb: 'Liver and kidneys start at 2 of 4 bars and fatigue at 60. Toxin clears slowly. Can you stay calm enough to recover?', rates: R({ staph: 4, ecoli: 1 }), dev: { organs: true }, organs: { liver: 0.5, kidney: 0.5 }, fatigue: 60 },
  clean:    { name: 'Kill clean', blurb: 'Toxin load on and lots of Pseudomonas. Can swallowing keep up?', rates: R({ pseudo: 1.5, staph: 5 }), mix: { neut: 0.4, mac: 0.6 } },
};
if (typeof module !== 'undefined') module.exports = { COMBOS };

// Starting combos for the workshop: each sets spawn rates (groups per 10 s), the marrow and zone modes,
// and a one-line question it's meant to test. Applying one restarts the match.
const R = o => Object.assign({ staph: 0, mrsa: 0, flu: 0, pseudo: 0, tb: 0, spore: 0, toxic: 0, strep: 0, herpes: 0, worm: 0 }, o);
const COMBOS = {
  sandbox:  { name: 'Empty sandbox', blurb: 'Nothing spawns. Add whatever you want.', dev: { rates: R({}) } },
  staph:    { name: 'Staph stream', blurb: 'The v2 baseline: a steady stream of grunts.', dev: { rates: R({ staph: 2 }) } },
  mrsaDome: { name: 'MRSA + Pseudomonas', blurb: 'One wants Support, the other wants Offense. Which zone gets which?', dev: { rates: R({ mrsa: 1, pseudo: 1.2, staph: 1 }) } },
  flu:      { name: 'Flu season', blurb: 'Swarms of one-hit flu. Try Nets against rings.', dev: { rates: R({ flu: 0.6, staph: 0.6 }) }, marrow: 'net' },
  tb:       { name: 'TB trap', blurb: 'Offense feeds TB. Pseudomonas wants Offense anyway.', dev: { rates: R({ tb: 1, pseudo: 0.8 }) } },
  spores:   { name: 'Spore timing', blurb: 'Rest the slider while spores sit, push it before they hatch.', dev: { rates: R({ spore: 0.35, mrsa: 0.5 }) } },
  drain:    { name: 'Toxic drain', blurb: 'Fatigue builds twice as fast while toxic Staph lives.', dev: { rates: R({ toxic: 1.2, strep: 0.4 }) }, output: 0.75 },
  strep:    { name: 'Strep rush', blurb: 'Chains sprint for the Lymph node and split when shot.', dev: { rates: R({ strep: 1, staph: 1 }) } },
  herpes:   { name: 'Herpes sleeper', blurb: 'Your neutrophils turn on you. NK cells pop them first.', dev: { rates: R({ herpes: 0.5, staph: 1 }) }, marrow: 'nk' },
  worm:     { name: 'Tapeworm boss', blurb: 'One huge worm crawls in. Everything at once.', dev: { rates: R({ staph: 0.8 }) }, boss: ['worm'], zones: ['support', 'support', 'offense'] },
  storm:    { name: 'Storm or die', blurb: 'Far too much at once. Is a storm worth it?', dev: { rates: R({ staph: 4, flu: 0.5, mrsa: 0.8 }) } },
  chaos:    { name: 'Everything', blurb: 'A little of every antigen. Pure chaos.', dev: { rates: R({ staph: 0.8, mrsa: 0.4, flu: 0.25, pseudo: 0.4, tb: 0.3, spore: 0.15, toxic: 0.3, strep: 0.3, herpes: 0.25 }), bigCaps: true } },
  papercut: { name: 'Papercut script', blurb: 'The v2 level: scripted waves and toxin bursts.', dev: { rates: R({}), script: true } },
};
if (typeof module !== 'undefined') module.exports = { COMBOS };

# v3 Version 34 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 34, id 1791641505-5779, published 2026-10-10.
Built on Version 33 (V32 sources + tutorial clips V25, which it still inlines). See ../v32/README.md for the V32 changes and API notes.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes

1. **Looser waves** (Clumped spawn speed thread, notes/spawn-physics/; Alex agreed 2026-10-10). The patch notes/spawn-physics/proposal-loose-wave.diff, applied unchanged to sim.js:
   - `bacteria.crowdDrift` 0.08 -> **0**. Big waves no longer get pushed at several times the lymph flow; collisions do the spilling.
   - New **`bacteria.driftSpread` 0.3**: each germ rides the flow at 0.7x-1.3x, fixed by its id (no extra rand() call), so a wave smears into a stream. `bacteria.drift` (10) is now the single knob for a blob's net speed.
   - `spawnAg` with no position given (waves, spores) lands germs uniformly in a round blob 100 long and 200 wide instead of a 90 x 180 box. Same two rand() calls.
   - New **`pseudo.drag` 0.3** replaces the hard-coded 0.1 for germs under a slime dome (without it Lungs stalls).
   - Antigen collisions unchanged.
2. **Stress presets at narrow widths** (template.html): at max-width 400 px, .spresets gap 2 px and 10 px labels, so "200%" sits about 3.6 px inside each border of its 30.6 px button at 375 px.

New CONFIG keys: `bacteria.driftSpread`, `pseudo.drag`. Changed value: `bacteria.crowdDrift` 0. The Sandbox panel may want sliders for `bacteria.drift` and `pseudo.drag`.

## Bots (2 seeds each)

- Normal (all nine bots): idle, random, randomCalm, stormSpam lose every level. smart wins every level. supportHeavy 9/10 (Athlete's foot 1/2). focus wins 9/10 (loses Flu).
- Hard (idle, random, randomCalm, stormSpam, smart, focus): the four must-lose bots lose every level. smart wins 8/10 (Athlete's foot 1/2, Lungs 1/2). focus wins 9/10 (loses Flu). Hard stays flagged not balanced.

## Clips

No tutorial clip needs changing: the clips are hand-animated (their own drift paths, not the sim), and the wave caption ("Germs pour out of the Wound and drift down toward the Lymph node") still holds.

# v3 Version 36 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 36, id 1791649834-1e1c, published 2026-10-10.
Built on Version 35 (see ../v35/README.md, ../v34/README.md, ../v32/README.md). To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes

1. **NK cells stay from Lungs on** (Alex, 2026-10-10). Sore throat's `LEVELS.throat.units` gains 'nk' (now neut, net, nk, mac), so no level after Lungs drops NK cells. The starting Response mix is unchanged (neutrophils 80% + macrophages; counters stay the player's call). Only sim.js changed, by that one line.
2. **Tutorial clips V26** inlined (Tutorial animations thread): adds the Adrenaline surge basic and puts the syringe above Pause in every clip.
3. Alex kept the breach crowd bonus at +3.3% per germ (lymph.crowd 0.033, cap 2x): no change.

## Bots (Sore throat only, 4 seeds)

- Normal: idle, random, randomCalm, stormSpam 0/4; smart 4/4; supportHeavy 4/4; focus 4/4.
- Hard: idle, random, randomCalm, stormSpam 0/4; smart 4/4; supportHeavy 4/4; focus 4/4.
Every other level is unchanged from v34/v35.

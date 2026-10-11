# v3 Version 38 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 38, version id 1791655324-cf23, published 2026-10-10.
Built on Version 37 (see ../v37/README.md and earlier). Still inlines tutorial clips V26. UI unchanged.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes (Alex, 2026-10-10): a drip of germs between waves, with ebb and flow

"The levels need more steady drip enemies between big waves otherwise it's too easy to set stress to 25% and chill", and "not a perfectly steady drip either, it should still feel a little ebb and flow-y between waves, but don't communicate the minor ebbs and flows to the player".

sim.js:
- `CONFIG.trickle.mul` 2.6 -> 3.4: the between-wave stream is about 1.3x what it was.
- New `trickle.ebb` 0.5, `trickle.ebbA` 37, `trickle.ebbB` 16: the stream rate is multiplied by 1 + ebb x (0.6 sin(2 pi t / ebbA + phase) + 0.4 sin(2 pi t / ebbB + phase2)), never below 0. The phases come from the seed, so each run swells at different moments. Nothing on screen, no toast, no marker announces these swells.

bots.js:
- New `chill`: sets Stress to 25% at the start and never touches anything again.
- New `coast`: good play (counters, stances, storm), but Stress 25% between waves and 50% only in the 15 s before a wave (`crowdPush: false` means it doesn't push for germ count).
- New `setForget` / `setForget2`: every sector Support, 60/40 neutrophils/macrophages, Stress at 67%, never touched again (setForget2 also switches off Deep tissue and the Lymph node).
- `outputFor` takes `p.crowdPush` (default true).

## Bot results (2 seeds per level)
- chill: lost every level on Normal and on Hard.
- coast (good play, but 25% between waves): Normal still wins about half (papercut, hospital, flu, soil, throat; loses pool, foot, coldsore, half of lungs and gut). Hard: loses 6 of 10 (wins hospital, flu, soil, gut). Left that way on purpose: it still reads the map and counters every wave, and Normal is the friends setting.
- smart: 10/10 on Normal. Hard (1 seed): smart 8/10, supportHeavy 9/10, focus 8/10; every level won by at least one of them.
- setForget (Normal): still wins 8/10 (loses foot and coldsore). The drip does not beat set-and-forget Support at the default 67% Stress.
- idle/random/randomCalm/stormSpam were not rerun in full: the drip only adds germs, and they lost every level on V34.

# Immune RTS prototype v2

The simpler v2 design from the "Immune RTS: Simpler Prototype v2" doc, as one self-contained page. v1 still lives one folder up and builds on its own.

- `src/sim.js`: the simulation and every tunable number (`DEFAULTS`), plus the Papercut script (`LEVELS`). No DOM; runs under node.
- `src/ui.js`: canvas rendering, HUD, guide, dev tools. Draws flow left to right on wide screens and top to bottom on tall ones.
- `src/template.html`: layout and styles.
- `src/headless.js`: balance bots. `node src/headless.js 1,2,3 [idle,smart,smartFlat,smartMax,random,randomSlow,supportAll,supportWound,macHeavy,maxOutput,minOutput]`. Run it from a folder outside /mnt/project-files (node there can fail on the cwd).
- `build.py`: inlines `../assets/assets.js` + src into `index.html`. Rebuild after any change, including a new art drop.

## Round 2 (Alex's feedback, 2026-10-04)
- A constant stream through the Wound between waves: 0.5 bacteria/s at the start ramping to 1.4/s, in clumps; armored bacteria join the stream (15%) after 1:30.
- About 3× more of everything: cell cap 60, bacteria cap 180, waves 40 / 30 / 24 + 26 armored / 80 / 40 / final 80 + 28 armored, 12 neutrophils and 4 macrophages at the start.
- All unit sprites drawn at 62% size (hit radii shrunk to match).
- Neutrophil walk is much more random: each turn veers up to 1.5 rad off the target line, and 25% of turns head somewhere completely random.
- Body output slider (0.5× to 2× marrow speed, 1× in the middle). Above 1.15× fatigue builds; below it recovers. Fatigue tiers: Tired at 35 (all cells 15% slower), Feverish at 60 (neutrophil shots spray, neutrophils live 30% shorter), Exhausted at 85 (marrow at half speed, Support rings shrink). Meter sits under the slider; Feverish and worse tint the screen edges.

## Changes from the doc's starting numbers
- Neutrophils fire every 0.8 s (doc 0.5) with some aim wobble.
- The doc's wave times and both toxin bursts are unchanged; two filler waves at 0:50 and 3:40.
- No retreat from toxin bursts (Alex's call): every cell in the Wound dies at each burst. The banner counts down from 6 s; the Wound flashes red for the last 2 s.

## Balance baseline (12 seeds each)
- Random button mashing (often or rarely): 0 wins.
- Doing nothing, one fixed zone setting all match, all macrophages, output pinned at max or min: 0 wins.
- Sensible zones but never touching the slider: 2 wins in 12.
- Sensible zones plus raising output ahead of waves and easing off when fatigue passes 45: 12 wins in 12, 3 stars. A real player reacts slower than this bot, so expect fewer stars.

## Difficulty tuner (2026-10-07)
`tuner/` builds a separate page (https://claude.ai/artifact/UktMrhuVzQ8gSXhBBXb9ci) that runs `src/sim.js` with the bots in `src/bots.js` inside Web Workers. Skill ladder: Does nothing, Button masher, Beginner, Casual, Good player. Winning strategies: a family of 7 habits (look interval, macrophages kept, Support on armor, Support crowd threshold, normal output, pre-wave output, ease-off fatigue) sampled evenly; the page shows the input ranges where winners sit. `node tuner/baseline.js` recomputes the live game's results that the page opens with; `python3 tuner/build.py` builds `tuner/index.html` and `tuner/play.html` (the game, reading the tuner's settings).

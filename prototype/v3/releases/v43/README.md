# v3 Version 43 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 43, version id 1791667423-9b99, published 2026-10-10.
V43 = V42 + unpredictable wave timing. Clips unchanged (V27). To rebuild it, this folder's build.py expects its files in a `src/` subfolder.

## Why
Alex, 2026-10-10 21:13: "stop telling you exactly when the antigen wave comes ... say X waves remaining, next Y, but not give times. and within a level the spawn times should be varied randomly by up to 10 seconds so you can't anticipate too much. it's just too strong to spike max stress 15 seconds before the big wave."

## Changes
- **sim.js, jitter:** `CONFIG.wave.jitter` 10, `CONFIG.wave.gap` 12. `game.rollWaves(jseed)` moves every wave after the opening one by up to ±10 s (kept in order, at least 12 s apart, at most duration − 20). Its own RNG, so the rest of the game's randomness is unchanged. Each wave keeps its scripted time in `w.t0`; `w.t` is the real time. The constructor rolls from the seed (bots reproducible); Play calls `game.rollWaves(random)` right after `new Game`, because Play's sim seed is fixed, so every attempt differs. Fight reports carry `jseed` and `waveTimes`.
- **Evolution warning** now fires at scripted time − jitter − evolve.warn, so it never dates the real arrival.
- **markers()** waves carry `t0`; spore hatch markers only for spores that already landed. Bots time "a wave is soon" off `t0` (what a player could learn), not the real time.
- **ui.js, rail:** no timeline. Waves still to come sit evenly spaced in order (the next one bigger, landed ones dim, quorum ring kept); the fill steps one badge per wave. No hatch/toxin markers on the rail (the spore banner still counts down after spores land).
- **ui.js, banner:** "N waves left. Next: a wave with MRSA / a Staph wave / the final wave[, big enough to reach quorum]." After the last wave: "Final wave is in. Hold on until the drip dries up, then clear what's left."
- Goal guide text and win line reworded (no "bar is full"); sim win message "Every wave is in and every antigen is gone."

## Downstream
- Campaign builds on Play's ui.js, so it should call `game.rollWaves(random)` after its own `new Game` if it creates games outside Play's newGame.
- Sandbox has its own ui.js fork with the old timed rail and "Next: ... in 0:12" banner; the sim jitter applies there too unless it sets CONFIG.wave.jitter 0.
- Tutorial clips that draw the old timed rail or a "Next: wave in" line are now out of date.

## Bots (Normal, 1 seed per level; bots-normal.txt)
idle, chill, setForget, coast 0/10; smart 8/10 (loses Athlete's foot, Gut); supportHeavy 7/10 (loses foot, Lungs, Cold sore).

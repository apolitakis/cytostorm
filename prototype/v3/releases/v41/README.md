# v3 Version 41 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 41, version id 1791664742-a1d8, published 2026-10-10.
V41 = V40 + Support upkeep (Difficulty simulator proposal, tools/difficulty-sim/proposals/support-upkeep.md) + a Cold sore ease. Clips unchanged (V27); no clip shows the Stress track mark moving, so none needed.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder.

## Changes
- **Support upkeep (sim.js):** `CONFIG.support.upkeep` 0.5. New `game.restLevel()` = output.rest − upkeep × (Support sectors on ÷ sectors on). Fatigue build-up/recovery and the storm preview (stormOutcome) use it instead of output.rest. All on Support: sustainable Stress 65%; half: 90%; none: 115%. Switching sectors off doesn't dodge it.
- **Stress track (ui.js):** the cool/hot boundary on the Stress slider follows `game.restLevel()` (checked each HUD tick; `setTrack`). Guide Controls line: "Sectors on Support inflame the body and lower that line (down to 65% with every sector on Support)".
- **Cold sore (LEVELS.coldsore):** final wave staph 312 → 273, drip stream end 3.9 → 3.2. With upkeep alone no bot won Cold sore on Normal.

## Bots (1 seed per level; raw tables bots-normal.txt, bots-hard.txt here)
Normal (run before the Cold sore ease; Cold sore re-run separately with 2 seeds):
| Bot | Wins |
|---|---|
| idle, random, chill, coast | 0/10 |
| setForget (all Support, 67%, untouched) | 0/10 (V39: 8/10) |
| setForget2 (same, Wound + Tissue only) | 0/10 |
| smart | 9/10, loses Cold sore → after ease Cold sore 2/2 |
| supportHeavy | 8/10 (loses foot, Cold sore) → Cold sore 1/2 after ease |
| focus | 8/10 (loses flu, Cold sore) → Cold sore 1/2 after ease |
| offenseHeavy | 3/10 |
| gunner | 3/10 |
Cold sore after the ease (2 seeds): idle 0/2, chill 0/2, setForget 0/2, smart 2/2, supportHeavy 1/2, focus 1/2.

Hard (with the ease): idle, random, chill, setForget, setForget2 0/10; smart 8/10 (loses Soil cut, Athlete's foot); supportHeavy 8/10 (loses foot, Cold sore); focus 3/10.

## Checks
- tools/browser-tests/v41/track.js: start rest 115% (mark at 73% of the track), all Support 65% (46%), back to Offense 115%; no page errors.
- lay30.js: 375/390/430/1280, no page errors.

## Not balanced yet
- Hard: Athlete's foot (as before), Soil cut lost by smart in this one-seed run.
- Cold sore is now the tightest Normal map (good play wins about half to all).

# Difficulty simulator (single maps)

Owned by the "Difficulty simulator" thread. Spec: /mnt/project-files/notes/difficulty-simulator-spec.md. The campaign layer is tools/campaign-sim/ (a different thread).

Bots press only the player's buttons: per-sector Response mix, Offense/Support, sectors On/Off, Stress and the Cytokine storm. The results become a **difficulty score** per map. It's a utility function, not pass/fail rules (Alex, 2026-10-10): seven weighted parts, each scored 0 to 1, averaged out of 100. The parts are must-lose bots lose, no trivial wins, many ways to win, good player wins, variety, skill matters and feels close. The weights and curves are in `COMPONENTS` in score.js.

## Files
- `strategies.js`: the strategy space.
  - **Reactive** strategies are v3's good-play bot (bots.js `makeStrategy`) with 12 habits varied by Latin hypercube, including how often it looks and a sector habit.
  - **Set-and-forget** setups are one mix, stance pattern, sector set and Stress chosen at the start and never touched.
- `run.js`: plays games on every core and appends one JSON line per game. Rerunning skips games already in the file, so a stopped run resumes. Plans:
  - `gate`: fixed bots.
  - `static1`: 20 set-and-forget setups per map.
  - `static2`: neighbours of the best 2 setups, plus the best 3 on seed 2.
  - `sweep`: 40 reactive strategies × 2 seeds.
  - `pressure`: waves and trickle at 0.8× and 1.25×.
- `score.js`: results to `data.json`, which holds the score, its parts, the best set-and-forget setups, win rate by habit and the pressure rows.
- `page/`: the Difficulty map page. `node page/build.js data.json index.html` inlines the data into template.html.
- `results/`: raw results per release and difficulty, e.g. `v35-normal.jsonl`.

## Run
It reads a frozen release, never live src. Copy this folder and the release outside /mnt/project-files first (node can fail on that cwd):

    cp -r /mnt/project-files/tools/difficulty-sim ds && mkdir v35 && cp /mnt/project-files/prototype/v3/releases/v35/*.js v35/
    cd ds && for p in gate static1 static2 sweep pressure; do V3=../v35 node run.js $p v35-normal.jsonl; done
    V3=../v35 node score.js v35-normal.jsonl data.json && node page/build.js data.json index.html

`DIFF=hard` plays Hard. Cost on V35: about 5–20 s per game per core, depending on how many germs pile up. A full Normal pass is roughly 1,450 games, about 2 hours on 4 cores.

## Status (2026-10-10, paused)
Paused at Alex's word (20:40): don't chase precise balance now, and the next build changes the difficulty levels (today's Hard becomes Normal).

- **Published map:** https://claude.ai/artifact/3HhTD7wFad2UiT4wTZC8gM shows the V35 early readout (fixed bots, set-and-forget, Stress 25%). It's stale.
- **Results kept in `results/`:**
  - `v35-normal.jsonl`: gate, static1, static2, coast, and 287 of 800 sweep games.
  - `v38-normal.jsonl`: coast plan (chill, coast, setForget bots and the Stress 25% setups) plus most of gate.
  - `v41pre-normal.jsonl`: V39 with the Support upkeep patch, which is V41 minus the Cold sore ease. It holds gate and the coast bots, 209 games. Every map except Cold sore matches V41. Its 20 Cold sore rows don't match V41's eased Cold sore and should be dropped.
  - `lever-screens/`: the headless tables behind the Support upkeep proposal (`proposals/support-upkeep.md`, shipped in V41).
- **A future rerun needs:**
  - Point V3 at the frozen release with the new difficulty levels. Use `DIFF=hard` where the old Hard is meant.
  - Run `gate coast static1 static2 sweep` (pressure is optional).
  - Then `RELEASE='V4x' node score.js` and `node page/build.js`, and republish to the same link.
  - At about 40 core-seconds per game, `COAST_STATIC=0 SWEEP_N=24` is roughly 1,000 games, about 2.5–3 hours on 4 cores.

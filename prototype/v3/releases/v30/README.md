# v3 Version 30 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 30, id 1791550509-e3d7, published 2026-10-09. Inlines tutorial clips as of tutorial/tutorial.js on 2026-10-09 (V23).
These are exactly the sources that built it. src/ in the parent folder can move ahead of this.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

New since V28/V29 (Alex, 2026-10-09 playtest):
- Difficulty setting: sim DIFFICULTIES {normal, hard}, setDifficulty(d), global DIFFICULTY; new Game(level, seed, difficulty?) defaults to the global. game.difficulty, game.diff. Normal = V29 balance. Hard = waves and trickle x1.25 (Flu x1 via DIFFICULTIES.hard.levels) + Unwatched tissue: germs in a switched-off sector divide CONFIG.unwatched.div (2)x faster. Hard is flagged "not balanced yet". UI keeps the pick in localStorage cytostormV3.difficulty; fight reports carry difficulty. headless: DIFF=hard.
- Quorum fuse 10 s -> 6 s on both difficulties (Alex: "more unfair").
- Layout: narrower map (can squeeze to MIN_SX 0.72 to keep its height); progress rail on the far left, then each sector's germ count and output % (#sideL .sinfo); right of the map each sector's Response button, stance button and power button (#sideR .sctl). The bottom production cards (#zones, .zcard) are gone; the stance chips and counts are no longer drawn on the map. Stress presets 50/100/150/200% ([data-stress]); cells meter (#cells, #cellFill, #cellCut = spleen cut).
- lymph.crowd hint text now explains 0.033.

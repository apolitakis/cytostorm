# Cytostorm prototype v3 (round 3)

Round 3 of the web prototype, published as its own link (https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW). v2 lives one folder up, unchanged.

- `src/sim.js`: the simulation, every tunable number (`DEFAULTS`, `HINTS`), the antigen kinds (`KINDS`) and the 9 levels (`LEVELS`, `LEVEL_ORDER`). No DOM; runs under node. The mechanics workshop (/mnt/project-files/workshop/) builds straight from this file and calls `spawnAg`, `spawnChain`, `spawnCell`, `killCell`, and listens for fx `pop`/`burst`; keep those names.
- `src/ui.js`: rendering, HUD, per-zone production cards and the mix sheet, storm button, level list, guide, dev tools.
- `src/template.html`: layout and styles.
- `src/bots.js`: bot players shared with the tuner. `src/headless.js`: `node headless.js [levels|all] [policies] [seeds]`, one process per core. Run from a copy outside /mnt/project-files.
- `build.py`: inlines `../assets/assets.js`, `/mnt/project-files/tutorial/tutorial.js` (tutorial clips, owned by the Tutorial animations thread) and src into `index.html`. Clips play once before each level with something new and replay from the guide's How to play tab.
- `tuner/`: the difficulty tuner (https://claude.ai/artifact/UktMrhuVzQ8gSXhBBXb9ci). `node tuner/baseline.js 8 60` refreshes its built-in results, `python3 tuner/build.py` builds `tuner/index.html` and `tuner/play.html`.

## What changed from v2
- Production is a mix, one card per zone. Each zone gets a third of the marrow and splits it by its mix; sliders are fixed-sum (moving one rescales the others) and All in makes one type only. New cells enter from the vessel along their zone and stay near it (leash band).
- Smaller, more numerous cells that collide (soft collisions with mass and restitution), steer with limited acceleration and carry momentum; shots knock bacteria back.
- The whole antigen roster (notes/antigen-roster.md): Staph, MRSA, Pseudomonas with slime domes, Influenza, Clostridium spores, TB, Toxic-shock Staph, Strep chains, Herpes, Tapeworm; Net neutrophils and NK cells.
- Cytokine storm as revised with Alex: fires any time after a 1 s wind-up, about 70% of antigens and 40% of your neutrophils die, macrophages are stunned 3 s, +50 fatigue then an 8 s afterburn (+2/s, halved at minimum output); fatigue reaching 100 during it is "organ failure". Hold the button to see a ghost bar of the cost.
- 10 levels, one new antigen each. Candida (fungus) settles and grows hyphae that carry germs downstream; Net neutrophils cut threads, Offense macrophages chew tips, shots pass through (level Athlete's foot).
- Fatigue is shown as a beating heart (canvas `#heart`, `drawHeart` in ui.js): faster and darker as it fills, storm ghost while the button is held.

## Balance (2026-10-07, 6-8 seeds per bot)
- Button mashing and storm spamming lose every level. Doing nothing loses everywhere except Flu season (wins most) and Sore throat (rarely).
- Papercut, Hospital visit, Soil cut, Sore throat, Cold sore and Gut: at least two styles win.
- Pool water, Flu season, Lungs and Athlete's foot are flagged "not balanced yet" in the level list (`ROUGH` in ui.js) for playtesting (Alex: time-box bot balancing to ~10 minutes, then flag and ship).

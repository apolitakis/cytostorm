# v3 Version 39 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 39, version id 1791657892-6460, published 2026-10-10.
Built on Version 38 (see ../v38/README.md and earlier). Still inlines tutorial clips V26 (no intro clips for the new units yet).
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## 1. Seven new friendly units, one per level (Alex, 2026-10-10)

"I like the new unit ideas. Can you build them into campaign and do a quick balancing pass (doesn't have to be ultra balanced)". Spec: notes/campaign-features-brainstorm.md section 2. Each level keeps its old units and adds its own:

| Level | Key | Unit | Cost | Cap | What it does (sim.js) |
|---|---|---|---|---|---|
| 2 Hospital visit | bcell | B cells | 5 | 15 | stepBcell: hangs back ~50 from the nearest germ in its band, every 3.5 s puffs an antibody cloud (g.clouds, r 24, 4 s, drifts at 0.6x flow). stepClouds tags germs touched (a.tag 12 s, a.cu/a.cv = cloud centre). Tagged germs pull toward their cloud's moving centre and roll at 0.6x flow; macrophages can swallow them (MRSA too) in half the gulp time. |
| 3 Pool water | eos | Eosinophils | 4 | 30 | stepEos: seeks slime domes, Tapeworm, yeast or hyphae in its band, latches (c.latch), charges 2.5 s, pops: dome hp -2 and r x0.75, Tapeworm 33 damage, cuts hyphae within 16, 2 damage to small germs within 16. Dies quietly ('spent'). |
| 5 Soil cut | plt | Platelets | 2 | 45 | stepPlt: takes a slot (by id) across the downstream edge of its sector. clotWalls(): a platelet in place stops germs (not virus, flu, worm) from passing it; it loses hp while holding (8 s of pushing). One gA query per platelet. |
| 6 Athlete's foot | dc | Dendritic couriers | 6 | 6 | stepDc: grabs a sample from the nearest germ of a kind not yet primed, walks to the Lymph node; then g.primed[kind] = true and damage() x1.5 for that kind for the rest of the level. |
| 8 Sore throat | treg | Regulatory T cells | 5 | 15 | No combat. calmMul(): fatigue build-up and overload organ damage x (1 - min(0.4, 0.05 n)). dragMul(): neutrophil fire interval and macrophage gulp x (1 + min(0.2, 0.025 n)). |
| 9 Cold sore | ifn | Interferon cells | 5 | 18 | stepIfn: follows nearby neutrophils. hazeAt(): Herpes can't infect cells within 40; flu inside moves at 0.5x. |
| 10 Gut | mast | Mast cells | 6 | 9 | stepMast: holds a post; a worm or yeast within 60 sets g.mucus[zone] = 5 s (12 s cooldown per cell). Germs in a mucus sector move at 0.5x, your cells at 0.8x. |

API for downstream (campaign loadout, sandbox): unit keys above; `SPECIAL` (exported) maps key -> step method; `UNIT_NAMES`, `CONFIG.marrow[key]`, `CONFIG.caps[key]`, `CONFIG[key]` (tunables, with HINTS). Each LEVELS[k].units list gains its key. New game state: g.clouds, g.primed, g.mucus, g.nTreg, g.nIfn; antigen fields tag, cu, cv; cell fields hp, latch, charge, sample, puff. New fx: puff, latch, eosPop, sample, primed, mucus.

ui.js: UNIT entries (name, art, color, one-line blurb kept short for the phone Response sheet), sprites from art kit V10 (b-cell / b-cell-puff, eosinophil / -latched / -pop, platelet / -stuck, dendritic-cell / -carrying, treg, interferon-cell + interferon-haze, mast-cell + mucus, antibody-cloud, bacterium-opsonized for tagged Staph; other tagged germs get a thin gold ring). Guide Units tab lists only the new unit this level makes. Toasts: courier delivered (names the kind), first mucus.

bots.js: counterMix adds each unit where it counters something (B cells on MRSA or crowds, eosinophils on domes/worm/fungus, platelets on crowds outside the Lymph node, couriers a little everywhere, Tregs in the Wound when fatigue > 40, interferon on virus/flu, mast on worm/yeast). New `leanNew` bot: good play plus 35% of the new unit everywhere.

## 2. iPhone speed-ups (Alex approved, from notes/performance/)
- collision-grid.diff (sim.js): collisions use their own 8-unit buckets and look only as far as the biggest body present.
- canvas-2x.diff (ui.js): the map canvas draws at most 2x device pixels, not 3x.
See notes/performance/README.md for the measurements.

## Bot results (1 seed per level unless noted)
- Normal, all 10 levels with the speed-ups: idle and chill lose all 10, smart wins all 10.
- Normal, the 7 unit levels: idle, random, chill and gunner lose all 7; smart wins all 7; leanNew wins only 2 of 7 (piling into the new unit is not a free win).
- Hard, the 7 unit levels: idle and chill lose all; smart wins 5, supportHeavy 6; Athlete's foot lost by both (already flagged not balanced yet on Hard).
- **Not balanced yet:** an untouched all-Support start at default Stress (setForget) still wins most levels on Normal (8/10 on V38). Tried letting tuned-shot kills drive germ evolution (thick walls then take two tuned hits): setForget still won 7/10 while smart fell to 2/10, so it is not in this release.

## Handoff for the next build thread ("Main game builds")

Workflow:
- prototype/v3/src = V39 = this folder. Work in progress lives in your own scratchpad copy. At each publish: copy the scratch src to prototype/v3/src, run `python3 build.py`, cmp the result with the published index.html, freeze releases/vNN (src + build.py + README), and send the coordinator the version and id. Publish to the same artifact URL (5ia5PRfq2KuoAvYLXXCfJW).
- Bots: `node <abs path>/src/headless.js <levels|all> <policies> <seeds>`. Settings: env `DIFF=hard` and `TUNE='{"tune":{...}}'`. Use absolute paths when backgrounding. 4 cores, and each game costs about 40 core-seconds, so all 10 levels x 3 bots x 1 seed takes about 4 minutes. Run in the foreground (or wait on it): Alex watches whether the thread shows as working.
- Must lose (Alex's rule, both difficulties): idle, random, randomCalm, stormSpam, chill (25% Stress, untouched). Should win most: smart, supportHeavy, focus. Informational: coast (good counters, 25% between waves), setForget/setForget2 (all Support, 67%, untouched), gunner, offenseHeavy, leanNew (35% of the level's new unit everywhere).
- Tools copied from the old thread's scratchpad: prototype/v3/tools/unitcheck.js (`node tools/unitcheck.js <abs src dir> <level> <policy>` prints the result, peak count of each cell type, and new-unit tallies: tag, eos.pop, mast.mucus, plt.hold, primed kinds, Treg calm), and tools/browser-tests/ (Playwright; run with `SRC=<built index.html> node <test>.js`): lay30.js (layout at 375/390/430/1280, page errors), v32/pan.js, v32/strain.js, v32/surge.js, v32/end.js, v39/units.js (each unit level on a 390 px phone, with screenshots and Response sheet height).

Balance notes on the seven units (quick pass, Alex: "doesn't have to be ultra balanced"):
- Smart uses each unit only where it counters something (counterMix in bots.js). Leaning hard on the new unit loses, so none is a free win. No unit has been tuned for strength beyond that.
- B cells were toned down after the first look (cap 30 -> 15, cloud life 6 -> 4 s) because nearly every germ on Hospital visit turned gold.
- Platelets hold about 250 germ-seconds a game on Soil cut, a modest effect. A cheap way to make them matter more: plt.hp or the wall reach in clotWalls.
- Possible follow-ups: intro clips for the seven units (Tutorial animations); the Response sheet scrolls on 5-unit levels (Sore throat, Cold sore, Gut) on a 390 px phone.

Not balanced yet:
- ROUGH set in ui.js (level list flags): unchanged from V36.
- Hard: Athlete's foot. In the V39 one-seed check, smart and supportHeavy both lost; on V38 only focus won it.
- Set-and-forget Support (all sectors Support, 60/40 neut/mac, 67% Stress, never touched) wins 8/10 on Normal (loses foot and coldsore). The coordinator counts it under Alex's "idle must lose" rule, as a goal, not a gate. Dropped experiment: count tuned-shot kills toward the 'shot' evolution (thick wall), and make thick-walled germs take 2 tuned hits. Normal results with it: setForget 7/10, smart 2/10, supportHeavy 2/10, focus 5/10. It punished good play far more, so it was reverted. Untried levers: Support mac pause threshold (support.cover), decay of Support macs over time, ring boost strength.

# Mechanics workshop (on v3)

A dev build of the real v3 game for trying mechanics and combos. It uses v3's physics, per-zone production, the full antigen roster and the Cytokine storm, and puts a Workshop panel on top. The panel sets spawn rates for both sides, has cheats (No fatigue, No death, Immortal cells, No division), adds Toxin load as an on/off layer, and lets you change any number while the game runs.

Owned by the "Antigen types and counters" thread. Since 2026-10-07 it runs on v3's `prototype/v3/src/sim.js`. That file is owned by the build thread and is inlined read-only at build time, never edited here. The earlier v2-based fork is kept in `v2-fork/` for reference.

## Files

- `src/layer.js`: the workshop layer. It has no DOM, so it also runs under node. It adds a Sandbox level (no script) beside v3's levels, the spawn rates, the marrow on/off switch, the cheats, and Toxin load. Toxin load reads v3's `fx` events: `pop` for messy kills, `burst` for toxin bursts. Call `ws.step(dt)` instead of `game.step(dt)`.
- `src/combos.js`: Sandbox starting combos (spawn rates, zone mixes, modes, output).
- `fork_ui.py`: regenerates `src/ui.js` and `src/template.html` from v3's current `ui.js` and `template.html`, then applies the workshop's changes. Every anchor is asserted, so a v3 change that moves an anchor stops the script and names it. After v3 changes its UI, run `python3 fork_ui.py && python3 build.py`.
- `src/ui-blocks.js` and `src/workshop.css`: the large workshop pieces that `fork_ui.py` splices in: start screen, tuning list, Workshop panel, toxin HUD, and styles. Edit these, not `src/ui.js`.
- `src/botcheck.js`: v3's own bots (`prototype/v3/src/bots.js`) on v3's levels, run with Toxin load off and on. Example: `V3=<copy of v3/src> node src/botcheck.js all smart,offenseHeavy 6`. It also takes `TOXIN=on|off|both`, `TUNE='{json}'` and `WS='{json}'`.
- `build.py`: run `python3 build.py` here to inline the art, v3's sim, the layer, the combos and the UI into `index.html`. Rebuild whenever v3's sim changes.

## No hook needed in v3

Everything is done from outside the sim:

- **Spawning:** `spawnAg`, `spawnChain` and `spawnCell`.
- **Cheats:** set values around each `step`. Immortal holds `age` down and wraps `killCell` on the instance. No division sets `div`.
- **Toxin load:** reads the `fx` list.
- **Puddles:** scale back each cell's movement for that tick.

If v3 renames `fx` kinds or those methods, the layer needs a matching update.

## Workshop panel

- **Playing:** Sandbox (no script) or any of v3's 9 levels. Combos (13) switch to the Sandbox.
- **Antigens:** a rate per kind (groups per 10 s), a + button to send one group now, and how many are on the map. Also Stop all and Clear map.
- **Your cells:** marrow on or off, extra cells per 10 s for each type, and +5 buttons.
- **Toxin load:** an on/off toggle, its 6 numbers, and the macrophage gulp interval.
- **Cheats:** No fatigue, No death, Immortal cells, No division. Buttons for Toxin burst now, Storm now, and setting fatigue to 0, 50 or 90.
- **Live readout** and setups: Copy setup and Load setup save and restore the spawn rates, cheats and every changed number as JSON.
- **Speed, seed, overlays, and the full tuning list:** v3's numbers plus Toxin load.

## Bot check on v3 (2026-10-07, 6 seeds per level, all 9 levels)

Wins out of 54 for each style, with Toxin load off and then on at the spec numbers (2 per messy kill, 5 per Pseudomonas or Clostridium):

| Style | Toxin off | Toxin on | On, macrophage gulp every 1 s |
|---|---|---|---|
| Random mashing | 0 | 0 | 0 |
| Good player (smart) | 36 | 38 | 37 |
| Support-heavy | 45 | 42 | 47 |
| Offense-heavy | 43 | 43 | 47 |
| Gunners only | 30 | 30 | 31 |

- On v3, toxin reaches 100 in nearly every match and stays maxed about 14 s per match on average. It still hardly changes who wins: it only adds a few points of fatigue.
- The reason is that swallowing is rare in v3. Swallows are 5 to 10% of kills even for the Offense-heavy bot (macrophages are capped at 18), so "kill clean" barely exists yet. Faster eating helps a little (Offense-heavy goes from 43 to 47).
- v3 balance notes for the build thread: Pool water is the hard level (0 to 4 of 6 for every style), and in Flu season a player who does nothing wins 5 of 6 with toxin off.

## Reproduction prototypes (2026-10-07, from Alex's reproduction idea)

- **Fever slows division** (New mechanics toggle, also the "Fever gamble" combo). While you're Tired, Feverish or Exhausted, bacteria divide at 85%, 60% or 45% speed. Viruses aren't affected. In a Staph-heavy sandbox at high body output, it cut the antigens on the map from about 450 to about 110 over 150 s.
- **Measles** (spawn slider, also the "Measles" combo). A workshop-only virus that hijacks macrophages. It rides on v3's one-hit flu body, flagged `hj`, and the layer steers it. A hijacked macrophage goes dark (no ring, no eating) for 12 s, then bursts into 5 more. Swallowing one hijacks the macrophage too. NK cells pop hijacked macrophages, because v3's NK cells already hunt anything marked `infected`. The art is a placeholder (`pollen`).
- Alex's decisions: keep the spore hatch, keep MRSA dividing. "Fixed load" antigens that never multiply already exist in v3: Strep chains, the Tapeworm, and Influenza after its single split.

## 2026-10-07: v3 version 5 (Candida, heart meter)

The workshop is re-forked from v3 version 5. It now has Candida (fungal threads), the beating-heart fatigue meter with the storm preview, and Athlete's foot in the level list. Candida is also on the Antigens list, and there's a "Fungus highway" combo. Clear map now clears the threads too. The toxin bar sits under the fatigue line next to the heart.

Quick bot check, 3 seeds, toxin off | on:
- smart: papercut 3|3, foot 3|1, coldsore 3|3
- offenseHeavy: papercut 3|2, foot 3|3, coldsore 3|3
- random: 0 everywhere

## 2026-10-07: v3 version 6 (divide blink)

Re-forked from v3 version 6, so every antigen that reproduces now strobes white, plus a short warning strobe just before a division. Measles strobes too when it bursts out of a hijacked macrophage: the layer sets `blink = BLINK` on each new Measles. Its render no longer skips v3's blink check. Bot check (3 seeds, toxin off | on) matches version 5.

## 2026-10-07: v3 version 7 (tutorial clips)

`build.py` now inlines `../tutorial/tutorial.js` (owned by Tutorial animations, read-only) at v3's `/*TUT*/` marker, and skips any marker the template doesn't have. `fork_ui.py`'s start-screen splice stops at v3's `// ---- tutorial clips` helpers, so they're kept. The guide's "How to play" tab plays the clips. The Sandbox's own Start button still starts right away, with no clips before a level.

## 2026-10-07: puddles off, vertical on phones (version 9)

- Alex found the green toxin puddles hard to read, so they're off by default (`dev.puddles`, the "Toxin puddles" toggle in the Toxin group). Toxin load itself is unchanged.
- The toxin row made the map a little shorter than v3's, so phones fell under v3's portrait cutoff and drew it sideways. The fork uses `cssH > cssW * 0.9` instead of 1.05.

## 2026-10-07: v3 version 8, Host failure (version 10)

- The Sandbox's own text now says "Host failure" (the No death toast and the live readout), matching v3.
- Fixed a freeze on any loss in the Sandbox level: its duration is 1e9, and the end graph labeled the time axis every 60 s up to the duration. The fork sizes the axis to the match length on the Sandbox.

## 2026-10-07: Toxin load feeds the heart (version 11)

Alex didn't like the bar's scale: it pinned at 100 in almost every match and was a third thing to watch. The default is now **Feed the heart** (`dev.toxinHeart`): no bar, and each messy kill adds fatigue directly (`WS.toxheart`: 0.03 per kill, 0.12 per Pseudomonas or Clostridium, 3 per toxin burst). Swallows and viruses add none. Switching the toggle off brings back the old bar (`WS.toxload`).

Bots, 10 levels × 3 seeds, wins with toxin off | on:

| perKill | smart | support | offense | gunner | random |
|---|---|---|---|---|---|
| 0.03 (default) | 21 \| 21 | 27 \| 26 | 27 \| 23 | 16 \| 18 | 0 \| 0 |
| 0.06 | 21 \| 15 | 27 \| 21 | 27 \| 14 | 16 \| 8 | 0 \| 0 |
| 0.1 | 21 \| 7 | 27 \| 11 | 27 \| 3 | 16 \| 3 | 0 \| 0 |

At 0.03 it raises the average peak fatigue by about 6 to 13 points. Kill-clean still barely helps, because swallows are only 5 to 10% of kills in v3.

`fork_ui.py` now accepts v3's newer frame loop (with `devSpawn`) and skips the portrait patch once v3 carries its own fix.

## 2026-10-07: antigens per second (version 12)

Alex asked for debug sliders to raise antigen spawns. The Workshop's antigen sliders now read in antigens per second: 0 to 30 each, Tapeworm 0 to 0.5. They're still stored as groups per 10 s, so the combos are unchanged. An **All antigens ×** multiplier (0 to 5, `dev.spawnMul`) scales them all. v3's own "Extra antigens" debug group is hidden in the Sandbox (`workshop.css`), since it duplicates these sliders. `fork_ui.py` keeps v3's `devSpawn` call in the frame loop.

## 2026-10-07: toxin clears fast when rested (version 13)

Alex: "pushing the immune system too hard wins the battle but loses the war", and toxin should barely matter when you're rested. Toxin load now works like a half-life:

- **Clearance per second** = load × `clear` (1.4 since Version 16; was 0.7) × a fatigue factor that slides from 1 at fatigue 0 to `clearTired` (0.12; was 0.1) at fatigue 100 × `clearFactor()`. `clearFactor()` is the hook for liver and kidney health from the organ spec, and returns 1 for now.
- **Feeding the heart:** fatigue rises by `feed` (0.02) per second for each point above the `safe` level (25).
- The old linear drain and the spill-at-100 are gone. The earlier "feed the heart directly" version is now Simple mode (`dev.toxinSimple`, off by default).

Bots, 10 levels × 3 seeds, wins with toxin off | on:

| Safe level | smart | support | offense | gunner | casual | random |
|---|---|---|---|---|---|---|
| none | 21 \| 14 | 27 \| 19 | 27 \| 15 | 16 \| 9 | 6 \| 5 | 0 \| 0 |
| 20 | 21 \| 22 | 27 \| 27 | 27 \| 27 | 16 \| 18 | 6 \| 5 | 0 \| 0 |
| 30 | 21 \| 21 | 27 \| 27 | 27 \| 27 | 16 \| 18 | 6 \| 5 | 0 \| 0 |

With no safe level, a match's ~900 messy kills fed about 70 fatigue even to good bots. With a safe level of 20 to 30, toxin feeds about 7 to 19 fatigue per match on average, mostly while tired.

## 2026-10-07: v3 version 9, Reset (version 14)

- Regenerated from v3 version 9, which is always vertical. The fork's portrait tweak is gone.
- **Reset** in the top bar restarts the current level or combo from zero with the same settings. After a loss, the end screen's Play again does the same.
- Alex's app crash on losing came from the Sandbox-level end-graph loop, fixed in version 10. A retest on a phone viewport after a long session shows both loss types reaching the end screen in under a second.

## 2026-10-07: organ health (version 15)

Built from "Organ health: Sandbox build spec" in `notes/organ-fatigue-brainstorm.md`, which is owned by Organ systems and fatigue and is read-only here.

- **Organs** (`ws.organs`, `dev.organs`): the liver and kidneys are drawn in the vessel strip at the Lymph-node end, with canvas placeholders. Toxin tints the vessel. `clearFactor()` = max(minClear, 0.35·liver + 0.65·kidney). `marrowFactor()` scales `CONFIG.marrow.rate` around each step by 0.6 + 0.4·liver.
- The liver heals 0.5%/s below Tired. The kidneys lose 1%/s while toxin is above 40 and never heal. Each leak costs 12% of its organ.
- At 0 an organ fails for the rest of the match, with an `organFail` fx and a banner. Optional `dev.organKill`: with an organ failed, fatigue 100 is Host failure.
- **Leakers** (`spawnLeaker`): Hepatitis rides a split flu body (`leak: 'liver'`). E. coli rides a Staph body (`leak: 'kidney'`, 2 hp) and divides on its own 20 s clock. Both spawn on the far side of a zone (`dev.leakZone`) and swim for the vessel. Each step, the sim's drift is swapped for theirs, so collisions stay. Reaching v < VESSEL + 8 is a leak.
- E. coli killed messily adds `ecoliTox` (5) in total. Leakers don't fill the Lymph timer: the layer restores it when only leakers are in zone 3.
- Speeds are Hepatitis 70 and E. coli 55, not the spec's 34 and 22. At the spec speeds, the default army stopped every leaker.
- **Controls:** Organs group, Hepatitis and E. coli antigen rows, and the Jaundice, Bad water and Running on empty combos. Combos can carry `organs` and `fatigue`.
- **Bots** (`DEV='{"rates":{"ecoli":2}}'` adds spawns to a level): random 0/30. A rested body (output 0.5, 300 s) takes 0 fatigue from toxin. On papercut, hospital and soil × 4 seeds, wins without | with E. coli: smart 7|5, offenseHeavy 11|8, gunner 4|3, supportHeavy 12|7. The kidneys failed in about 40% of the E. coli matches. **Not balanced yet.**

## Version 16 (id 1791412541-fa94): organ art, body view, toxin clip
- Forked from v3 Version 12 (pen Net, "Body output" label) on disk.
- Art kit v7 sprites: `liver-*` / `kidneys-*` by state (healthy above 70, damaged 30-70, failing under 30 and flickering, failed), drawn side by side in the vessel at the Lymph node end (`ORGAN_AT` in ui-blocks.js organfns). Leaks pop `leak-splat` with the flash and "-12%". Hepatitis uses `hepatitis`, E. coli uses `e-coli` and swaps to `e-coli-dividing` for its last second, with the v3 warn blink (fork_ui.py `ewarn`). Progress markers `hepatitis` / `e-coli`.
- Body view: `#bodyBtn` under the heart (both organ sprites + health; hidden when Organ health is off). Tapping it opens `openModal('body')`, which pauses like every modal: liver (marrow factor, share of clearing, healing), kidneys (share, toxin damage, no healing), whole body (organ factor, fatigue factor, live toxin half-life vs rested, safe mark, organ-failure rule). No meds.
- Guide: How to play has a "Systems" section with `CytoTutorial.SYSTEMS` (Fatigue and toxins). Enemies tab lists Hepatitis and E. coli; Controls tab explains organ health and the button.
- Toxin clearance retuned to the clip: `clear` 1.4, `clearTired` 0.12, so half-life is ~0.5 s rested and ~4.1 s at fatigue 100. Layer has `clearRate()` and `fatigueClear()`.
- Bots, all 10 levels x 3 seeds, toxin on, old vs new clearance: smart 20 -> 21/30, offense-heavy 26 -> 28, support-heavy 24 -> 23, gunner 19 -> 17, random 0 -> 0. Toxin now feeds about 1-3 fatigue per match (was 10-16) and kidneys end around 96-99% (was 81-87%): rested play barely notices toxin; it bites only near Exhausted.
- Version 17 (id 1791412766-c09b, tutorial clips V11 with the "marrow" label fixed): with Organ health on, the toxin bar is hidden; toxin shows as the vessel tint and a thin green strip on the organ button (brighter when over the safe mark). With Organ health off the bar returns.

## Version 18 (id 1791416297-7fb6): on v3 Version 15 (six organs, breach clocks), toxin off by default
- v3 now owns organ health: `g.organs` (heart, kidney, lungs, liver, spleen; 0-4 bars), `hurtOrgan(k, bars, cause, floor)`, `setOrgan`, `organLevel`, `organLoss`, factor getters. Its organ button (in the fatigue row) and Organ status window (key O) replace the Sandbox's own body view.
- layer.js no longer simulates organs. `leak(organ)` is the one place leak damage happens: `g.hurtOrgan(organ, WS.organs.hepBars | ecoliBars, 'Hepatitis' | 'E. coli')` (switch it to v3's breach-clock call when that lands). Toxin over `kidneyToxAt` calls `hurtOrgan('kidney', kidneyToxBars * dt, 'toxin')`. Both stop at `CONFIG.organs.otherFloor` (default 1 bar); the Workshop's "Leaks and toxin can take the last bar" checkbox sets it to 0. `clearFactor()` = 0.35·liver/4 + 0.65·kidney/4 (floor 0.15). The liver marrow cut is gone (v3's makeMul does it). No death / Immortal set `g.organLoss = false`.
- Toxin feeds fatigue only up to 100 (`ws.feed`), never into Overload.
- UI: no toxin bar; toxin = vessel tint + a green strip appended to v3's #bodyBtn; a Toxin card (`wsToxCard`) heads v3's Organ status window. Liver and kidneys still drawn in the vessel with art-kit v8 states (leak splat, "-1/6 bar"). Workshop Organs group: bar buttons (4/2/1) for all five organs, Heal all.
- Bots (10 levels x 3 seeds): toxin off and on win the same (only smart on Hospital 1 -> 0). Toxin feeds 1-3 fatigue per match. E. coli 0.8/s and Hepatitis 1.2/s on papercut/hospital/soil/gut x 4: good bots win 12-16/16, 1-5 leaks per match, no organ failures; random 0 (Host failure from Overload).
- Version 18 changes on top of the above: v3 Version 15 adds the brain and per-organ breach clocks. `ws.leak()` now calls `g.breach(organ, CONFIG.lymph.leak, cause)` (25% of the clock per leak; a full clock costs a bar, including the last). Leakers carry `a.organ`, so in the Lymph node they fill their organ's clock like any germ; the old lymph-timer restore hack is gone. Toxin load is an Experiment toggle, off by default (Alex 23:14: main game stays toxin-free; kidneys set fatigue recovery); with it off there's no strip, card, tint or kidney toxin damage. "Toxin can take the last bar" sets CONFIG.organs.otherFloor. No death logs an organ at 0 as a near loss (g.organLoss off); "Keep going" calls ws.forgive().
- Bots on V15 (10 levels x 3): toxin off and on win about the same. Leaker streams (4 levels x 4, toxin off): E. coli 0.8/s smart 14/16, offense-heavy 7/16; Hepatitis 1.2/s smart 9/16, support-heavy 12/16; losses are Host failure. Not balanced yet.
- Version 19 (id 1791418049-a9c4): re-forked onto v3 Version 19 UI (double-tap zoom, per-sector power buttons, number-only counters) with tutorial clips V15; no workshop code changes.
- Version 20 (id 1791419546-e57b): re-forked onto v3 Version 20 (sound + mute button, key M); build.py now inlines audio/cytosound.js (read-only, owned by Music and sound samples) at /*AUDIO*/.
- Version 21 (id 1791421500-fac3): re-forked onto v3 Version 21 (wider phone map, vertical progress rail, no unit legend) with tutorial clips V16 and the new cytosound.js. The Sandbox census is drawn rotated along the rail; fork_ui.py accepts either the old or the new drawProg anchor.
- Version 22 (id 1791423316-1cb6): re-forked onto v3 Version 22 (second blood vessel on the right edge, FAR_VESSEL = 20; half of non-macrophage cells enter there) with tutorial clips V17. Leaker streams now start at WIDTH - FAR_VESSEL - 12 (was WIDTH - 24, inside the far vessel clamp) and still swim for the left vessel; leaker text says "left blood vessel".

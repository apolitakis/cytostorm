# Cytostorm tutorial clips

Short animated clips that teach the game before a level starts. Owned by the thread "Tutorial clips" (was "Tutorial animations" until 2026-10-10).
Preview Artifact: see the thread (published from `index.html`).

## Files
- `src/engine.js`: drawing engine. Clips are pure functions of time t, authored in the sim's (u, v) frame on a 400 x 300 stage; on a tall canvas the stage is transposed exactly like the game (flow top to bottom, vessel on the left).
- Playback runs at `CytoTutorial.SPEED` (0.5: half speed, so captions stay up twice as long; Alex 2026-10-08). A clip's `realtime: [[t0, t1]]` spans (clip seconds) play at 1× (the storm's 5 s hold). `CytoTutorial.length(id)` is the real length; `clipTime(clip, realSeconds)` maps real time to clip time.
- tutorial.js is wrapped in one function scope; its only global is `window.CytoTutorial` (`CytoTutorial.engine` is the clip engine, for test scripts).
- `src/clips-basics.js`: shared choreography helpers + the 11 basics: goal, divide, cards, shutoff, modes, output, organs, toxin, storm, stormRisk, surge (BASICS list in player.js).
- `src/clips-antigens.js`: one clip per new antigen: mrsa, pseudo, flu (+ Net neutrophil), spore, yeast, tb, strep, toxic, herpes (+ NK cell), worm.
- `src/clips-units.js`: one intro clip per new friendly unit (Play V39): bcell, eos, plt, dc, treg, ifn, mast. Numbers follow v3 releases/v39 sim.js CONFIG.
- `src/player.js`: the embeddable player (`CytoTutorial`).
- `src/preview.html`: the preview page template.
- `build.py`: writes `tutorial.js` (the module) and `index.html` (preview with the art kit inlined). Run `python3 build.py` after any edit.

## Wiring it into the game
`tutorial.js` needs the global `ART` (prototype/assets/assets.js) and nothing from sim.js or ui.js. Include it after assets.js.

```js
await CytoTutorial.ready();                          // loads the art kit images
const ids = CytoTutorial.forLevel(levelKey, newIn(levelKey));  // papercut -> the 10 basics; later levels -> clip per new antigen kind
if (ids.length) CytoTutorial.play(hostEl, ids, { eyebrow: levelKey === 'papercut' ? 'How to play' : 'New antigen', onDone(skipped) { /* start the level */ } });
```

`CytoTutorial.SYSTEMS` lists clips for Sandbox-only systems (today `toxload`, "Fatigue and toxins": toxin in the blood, the liver and kidneys clearing it, fatigue feeding back). The Sandbox can play them from its guide with `CytoTutorial.play(host, CytoTutorial.SYSTEMS)`. Toxin load stays out of the main game (Alex, 2026-10-07), so `toxload` is never part of BASICS.

A clip can point at UI with `A.spotlight(rect, alpha, label, t)` from its `overlay(t, st, A)` hook. The hook draws over the HUD and under the finger.
- `hostEl` needs a height (the player fills it: canvas, caption, Back / Replay / Next, Skip). Tap the picture to pause.
- `CytoTutorial.BY_KIND` maps sim antigen kinds to clip ids (`virus` -> `herpes`, `clos` -> `spore`). `CytoTutorial.drawFrame(canvas, id, t)` renders one frame (thumbnails). For a thumbnail, use `CLIPS[id].thumb` (clip seconds) when a clip sets it, else your default: `const c = TUT.CLIPS[id]; TUT.drawFrame(cv, id, c.thumb != null ? c.thumb : c.dur * 0.6)`. The seven unit clips set it to a frame with no tags or toasts.
- Suggested: show them once per level (remember in localStorage), plus a "How to play" button in the guide that replays any clip.

## Conventions
- Reproduction blink matches the game (sim.js `BLINK` 0.6 s, `BLINK_WARN` 0.7 s; ui.js white radial strobe at 7 Hz, radius r x 2.4): parent warns before dividing, parent and offspring blink after. Used for division, flu splitting, spore hatching, Candida budding, TB spat out, Herpes bursting, strep chain splits, tapeworm pieces.
- Numbers in captions follow sim.js DEFAULTS (Staph 3 hits, doubles every 10 s; storm 70% / 40%, +50 fatigue, 8 s afterburn, 5 s press-and-hold charge that fires on release (shown in real time); flu splits in 3; tuned shots x5 on the tapeworm). Clip timing is compressed, not to scale.
- Candida uses ui.js's stand-in `yeast` sprite until the art kit has one.

## V30 layout (clips Version 24, 2026-10-09)
- `hud.side: 'map'` draws the game's info column left of the map (germ count, output %) and the controls column right of it (Response button, stance button, power button per sector). A clip's `side(t, st, A)` returns `{ counts, pct, off, mix, mode, on, flip, shake, open, press }`; `mapLabels({ counts })` feeds counts too. Finger targets: `R.hud.ctl.resp / mode / pwr [zone]`.
- `hud.side: 'ctl'` is a zoomed sector with only its controls on the right; `zoneChip()` now draws its stance button there (no on-map chips in V30).
- `hud.rail` puts the level rail down the far left (`A.rail(landed, events)` since clips Version 28, see below). The old top bar (`hud.top`, `hudProgress`) is unused.
- `hud.bottom` is the V30 Stress panel (100 px): heart, Stress %, slider, 50/100/150/200 presets, tier + organs, Cells meter (`st.cellCount`).
- `hudSheet({ tabs, stance, power, ... })` matches V30's Response sheet (zone tabs + Done, On/Off, Offense/Support rows).

## V35 surge (clips Version 26)
- With `hud.bottom`, the engine now draws a 46 px column right of the Stress panel: the syringe (adrenaline surge) above Pause, as in Play V35. A clip can drive it with `surge(t) -> {left, on, drain, press: 'surge'|'pause'}`; finger targets are `R.hud.surge` and `R.hud.pause`.
- New basic `surge` (after stormRisk): tap the syringe, the fight runs at 0.1x scene time (`ts(t)`), change the Wound Response to 100% neutrophils, tap again to end. Real length 19 s.
- The organ window no longer pauses: it reads BODY with a Close button, and the organs clip keeps the fight moving behind it.

## Working on the clips (handoff notes, 2026-10-10)
- **Inputs, read only:** game rules come from the frozen Play release `prototype/v3/releases/vNN/` (README = changes + API; sim.js DEFAULTS/CONFIG for numbers, ui.js for looks). Art comes from `prototype/assets/` (`assets.js` defines global ART; sprite keys are the svg names). Never edit prototype/.
- **Routine after each change:**
  1. `python3 build.py` (concatenates src into tutorial.js and index.html).
  2. Render-check from a scratch dir (writes PNGs to cwd): `T=1,4,8 node /mnt/project-files/tutorial/tools/shotsH.js <clip> 360 640` writes sheet-<clip>-360.png, which you then look at. Also try 520 400 (wide) and 320 560.
  3. Error sweep: `node tools/allclips.js` (every clip × 10 frames × 3 sizes). Page check: `node tools/page.js` (no horizontal overflow at 390/1280).
  4. Copy index.html to the scratchpad as cytostorm-tutorial.html and republish to the Clips Artifact (URL in team memory cytostorm-tutorial-clips), as a new version on the same link.
  5. Send the coordinator the version + id, so Play rebuilds to inline the clips; Sandbox and Campaign follow.
  6. Update team memory cytostorm-tutorial-clips (keep it under 4KB).
- **Authoring a clip** (`CYT_CLIPS.<id> = {...}`): `id, title, dur, cap: [[t, text], ...]`, `bg` (`{tile}` for a close-up, or `{wound, woundSize, dividers, lymph}` for the map view), `hud` (`side: 'map'|'ctl'`, `rail`, `bottom`), `build(st)` makes entities once, `frame(t, st, A)` draws the scene (`A.scene(t, {under, over})`), plus optional `side`, `hudFrame`, `overlay`, `fingers` and `surge` hooks. Captions use clip time and play at SPEED 0.5.
- **Kit** (`CYT_KIT` in clips-basics.js): `crowd(n, [u0,v0,u1,v1], seed, o)`, `recruit(art, t0, u, v, o)` (cell arrives from the vessel), `fight(shooters, targets, t0, {hp, every, seed})` (schedules shots and kills), `timerTable`, `count`, `off` (finger parked offscreen).
- **Engine api** (`CYT.api`, engine.js): `ent({art, r, pos})`, `drift`, `path`, `divide`, `gulp(mac, germ, t)`, `shot(t, from, to, {tuned})`, `spr(art, u, v, r, rot, alpha)`, `tag(u, v, text, colour, a, dy)`, `toast`, `finger`, `zoneName`, `zoneChip`, `mapLabels`, `hudSheet`, `hudOutput`, `hudPcol`, `rail`, `organPanel`, `spotlight`, `seg`, `ease`, `rng`, `noise`.
- **Antigen clips** play on the level that introduces the kind (`BY_KIND` / `forLevel` in player.js). The new friendly-unit clips are storyboarded in `drafts/new-units.md`. Build each one only from the Play release that adds its unit, and check the [bracketed] numbers there against that release.
- **Alex's rules for clips:** only reproduction may blink (no other strobing); layout is always vertical with the Wound on top; clinical wording; the loss state is "Host failure"; say "your body recovers"; no bpm on the heart; "Response" is the in-battle cell mix; no "All in" or "marrow" anywhere.

## New units (clips Version 27, for Play V39)
- Seven intro clips, one per new friendly unit, in `src/clips-units.js`: `bcell` (Hospital visit), `eos` (Pool water), `plt` (Soil cut), `dc` (Athlete's foot), `treg` (Sore throat), `ifn` (Cold sore), `mast` (Gut). Each ends by spotlighting the sector's Response button ("Make them in Response").
- `forLevel(levelKey, newKinds, newUnits?)` now returns the level's antigen clips and then its unit clip. `newUnits` is optional: without it, `CytoTutorial.LEVEL_UNIT[levelKey]` is used, so **Play's existing call `TUT.forLevel(key, newIn(key))` needs no change** and the Campaign (same level keys) gets them too. Pass `newUnits` (unit keys) only if a mode adds units differently.
- New exports: `CytoTutorial.UNITS` (the seven clip ids, for a guide list like `ANTIGENS`), `BY_UNIT` (unit key -> clip id), `LEVEL_UNIT` (level key -> unit key).
- Optional for Play: the guide's How to play tab lists `BASICS` and `ANTIGENS`; add `<h4>Cells</h4>${TUT.UNITS.filter(id => TUT.CLIPS[id]).map(btn).join('')}` to list the unit clips too.
- The engine knows the new units' colours (`COLORS.bcell` etc., from ui.js UNIT), so a clip's Response mini bar can show them.

## Untimed waves (clips Version 28, for Play V43)
- Play V43 (Alex, 2026-10-10) stopped dating waves, so the clips did too. `A.rail(landed, events)` now matches V43's rail: events `[{ kind, ring }]` in order, evenly spaced, the first `landed` dim, the fill stepping one badge per landed wave, the next badge bigger. No times anywhere on it.
- Waves and quorum bursts: first caption reworded ("lists the waves to come, in order, but not when"); the ringed Staph wave lands with the second clump at 5.6.
- Clostridium spores: no hatch ring on the rail (V43 has none); the game's "Spores hatch in N s" banner counts down instead, and the caption points at it.
- Also out with this release: `CLIPS[id].thumb` on the seven unit clips (see the guide note above). No Play call changed.

## Pending for the next clip release (source only, 10-10)
- `drawFrame` lays out a canvas narrower than 320 px at 320 px wide and scales it down (`THUMB_W` in player.js). At the guide's ~150 px the HUD crowded its own labels on top of each other (Dendritic couriers, Regulatory T cells), whatever the thumb time. The thumb times stay as they are. No Play change: Play's guide already calls `TUT.drawFrame`.

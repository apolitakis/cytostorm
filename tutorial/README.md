# Cytostorm tutorial clips

Short animated clips that teach the game before a level starts. Owned by the thread "Tutorial animations".
Preview Artifact: see the thread (published from `index.html`).

## Files
- `src/engine.js`: drawing engine. Clips are pure functions of time t, authored in the sim's (u, v) frame on a 400 x 300 stage; on a tall canvas the stage is transposed exactly like the game (flow top to bottom, vessel on the left).
- Playback runs at `CytoTutorial.SPEED` (0.5: half speed, so captions stay up twice as long; Alex 2026-10-08). A clip's `realtime: [[t0, t1]]` spans (clip seconds) play at 1× (the storm's 5 s hold). `CytoTutorial.length(id)` is the real length; `clipTime(clip, realSeconds)` maps real time to clip time.
- tutorial.js is wrapped in one function scope; its only global is `window.CytoTutorial` (`CytoTutorial.engine` is the clip engine, for test scripts).
- `src/clips-basics.js`: shared choreography helpers + the 10 basics: goal, divide, cards, shutoff, modes, output, organs, toxin, storm, stormRisk.
- `src/clips-antigens.js`: one clip per new antigen: mrsa, pseudo, flu (+ Net neutrophil), spore, yeast, tb, strep, toxic, herpes (+ NK cell), worm.
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
- `CytoTutorial.BY_KIND` maps sim antigen kinds to clip ids (`virus` -> `herpes`, `clos` -> `spore`). `CytoTutorial.drawFrame(canvas, id, t)` renders one frame (thumbnails).
- Suggested: show them once per level (remember in localStorage), plus a "How to play" button in the guide that replays any clip.

## Conventions
- Reproduction blink matches the game (sim.js `BLINK` 0.6 s, `BLINK_WARN` 0.7 s; ui.js white radial strobe at 7 Hz, radius r x 2.4): parent warns before dividing, parent and offspring blink after. Used for division, flu splitting, spore hatching, Candida budding, TB spat out, Herpes bursting, strep chain splits, tapeworm pieces.
- Numbers in captions follow sim.js DEFAULTS (Staph 3 hits, doubles every 10 s; storm 70% / 40%, +50 fatigue, 8 s afterburn, 5 s press-and-hold charge that fires on release (shown in real time); flu splits in 3; tuned shots x5 on the tapeworm). Clip timing is compressed, not to scale.
- Candida uses ui.js's stand-in `yeast` sprite until the art kit has one.

## V30 layout (clips Version 24, 2026-10-09)
- `hud.side: 'map'` draws the game's info column left of the map (germ count, output %) and the controls column right of it (Response button, stance button, power button per sector). A clip's `side(t, st, A)` returns `{ counts, pct, off, mix, mode, on, flip, shake, open, press }`; `mapLabels({ counts })` feeds counts too. Finger targets: `R.hud.ctl.resp / mode / pwr [zone]`.
- `hud.side: 'ctl'` is a zoomed sector with only its controls on the right; `zoneChip()` now draws its stance button there (no on-map chips in V30).
- `hud.rail` puts the level rail down the far left (`A.rail(frac, events)`, event `ring` colour). The old top bar (`hud.top`, `hudProgress`) is unused.
- `hud.bottom` is the V30 Stress panel (100 px): heart, Stress %, slider, 50/100/150/200 presets, tier + organs, Cells meter (`st.cellCount`).
- `hudSheet({ tabs, stance, power, ... })` matches V30's Response sheet (zone tabs + Done, On/Off, Offense/Support rows).

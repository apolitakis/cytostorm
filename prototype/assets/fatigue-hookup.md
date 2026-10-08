# Hooking up the fatigue art in prototype/v2

Tested in a scratch copy of `prototype/v2` (not committed there; the build thread owns that folder). Three swaps in `src/`:

1. **Meter** (`ui.js`, in `hud()`): replace the `#fFill` width/background line with
   ```js
   $('#ftrack').innerHTML = ART.fatigueMeterSVG(g.fatigue, CONFIG.fatigue);
   $('#fIcon').src = artUrl(['fatigue-fine', 'fatigue-tired', 'fatigue-feverish', 'fatigue-exhausted'][g.tier]);
   ```
   and drop the boot loop that appends `<u>` tick marks (the SVG draws its own ticks at the tier thresholds).
2. **Markup** (`template.html`): add `<img id="fIcon" alt="" style="width:18px;height:18px">` before `#fTier`, and make `.ftrack` `height: 10px; display: flex;` (no background or overflow needed).
3. **Edge glow** (`ui.js`, in `render`): replace the "Fatigue: a warm vignette" block with
   ```js
   ART.drawFatigueEdge(ctx, VW, VH, g.tier, ts);
   ```

Optional: `ART.outputTrackCSS(Math.log(rest / min) / Math.log(max / min))` gives a slider-track gradient that is cool up to the sustainable 1.15x point and heats past it (apply it to the range input's track).

## Cytokine storm (art kit v6)

- **Button**: `storm.svg` normally; swap to `storm-lethal.svg` while held if `fatigue + 50 >= 100` or the afterburn would carry it there. Show `storm-afterburn.svg` beside the 8 s countdown afterwards.
- **Ghost bar** while the button is held:
  ```js
  $('#ftrack').innerHTML = ART.fatigueMeterSVG(g.fatigue, CONFIG.fatigue, 10, { ghost: 50, burn: 16 }); // burn = 8 s x 2/s (8 at min output)
  ```
  Hatched white if you survive, red tail if the afterburn might kill you, all red if the spike alone does. During the afterburn pass `{ burning: true }` for a red outline.
- **Storm effect** (`render`, after the world): `ART.drawStorm(ctx, VW, VH, { phase, p, t, ox, oy })` with `phase` one of `'windup'` (1 s, shockwave rolls out from the button at `ox, oy`), `'hit'` (0.4 s flash, apply the kills here), `'afterburn'` (8 s red edge pulse); `p` is 0 to 1 through the phase, `t` is seconds. Throw a few `storm-shard` particles from each cell it kills.
- **Organ failure loss**: `ART.drawCollapse(ctx, VW, VH, p)` over ~2 s (p 0 to 1), then the `organ-failure.svg` emblem (128 box) over "Cytokine storm: organ failure".

## Organ health (art kit v7)

- **Organs**: `liver-<state>` and `kidneys-<state>`, state = `healthy` (above 70), `damaged` (30 to 70), `failing` (under 30), `failed` (0). Each is a 64x48 box (`meta.box`, `meta.anchor` = centre). With `meta.worldR` 19 they draw about 45 x 34 world units, so liver and kidneys sit side by side in the 44-unit vessel strip at the Lymph-node end. Flicker `failing` (alpha .55 to 1, a few times a second).
- **Leak**: pop `leak-splat` on the organ that was hit (scale 0.6 to 1.2 over ~0.3 s, then fade), with the organ flash and "-12%".
- **Leakers**: `hepatitis` (worldR 4, swarms of 6), `e-coli` (worldR 6.5) and `e-coli-dividing` (blink between the two for the last ~1 s before a split). Progress-bar kinds `hepatitis` and `e-coli` (`marker-hepatitis`, `marker-e-coli`).

## Five organs, 4 health bars (art kit v8)

- `<organ>-<state>` for organ `heart`, `lungs`, `liver`, `kidneys`, `spleen` and state `healthy`, `strained`, `damaged`, `failing`, `failed`. Same 64x48 box, `meta.radius` 27, `meta.worldR` 19 as before.
- One state per bar count: 4 bars `healthy`, 3 `strained` (new: dimmer green, one hairline crack), 2 `damaged`, 1 `failing` (flicker it), 0 `failed`. If you'd rather keep 4 states, skip `strained` and show `healthy` for 4 and 3 bars.
- `heart-*` is the organ, separate from the fatigue meter's heart icon.

## Brain and Rabies (art kit v9)

- `brain-<state>`: the sixth organ, with the same five states, 64x48 box and worldR 19 as the others.
- `rabies` (worldR 4.5) is the brain's antigen: a lilac bullet-shaped virus. `rabies-budding` is its reproduce frame; blink to it for the last ~1 s before a copy splits off. Progress-bar kind `rabies` (`marker-rabies`).

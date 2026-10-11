# v3 Version 32 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 32, id 1791633240-890a, published 2026-10-10.
Built on Version 31 (V30 sources + tutorial clips V24, which it still inlines). Seven asks from Alex, 2026-10-10, all on Normal and Hard.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes

1. **Support macrophages spread out.** In stepMac, a Support macrophage walks its post (m.pu/m.pv) away from other Support macrophages closer than CONFIG.support.spread x ring radius (1.7), at support.spreadSpeed 30, clamped to its home sector. The rings tile the sector instead of stacking.
2. **Covered sectors pause macrophages.** New Game.stepCover(dt), every support.check 0.5 s: samples a 10x10 grid per sector and sets zone.cover (0-1 share inside a live Support ring). zone.macPaused turns on above support.cover 0.8 (Support stance only) and off below support.uncover 0.7. While paused, production uses the Response mix with the macrophage share set to 0 and the rest scaled up proportionally (zone.mix itself is unchanged). Event log: {e:'macPause', z, on, cover}. UI: the sector's Response button hatches the macrophage segment and reads "Macs paused"; the Response sheet shows the coverage %.
3. **Fatigue strain.** ui.js strainTick: a red vignette (#strain in #stage, z-index 1, under the side controls) creeps in from the edges. Faint at Tired, stronger at Feverish, heavy at Exhausted/Overload, with a small pulse on each beat from Feverish up. The heartbeat is now scheduled here with AU.play('heartbeat', {vol}): faster (gap 0.95 s to 0.33 s) and louder (vol 0.15 to 1.2) with fatigue, skipping a beat in Overload. AU.heartbeat(state) is no longer used (called with null). The audio module's `hard` timbre param isn't reachable via play(), so the timbre doesn't darken.
4. **Cytokine storm scales with depth.** CONFIG.storm.kill (flat 0.7) is replaced by **storm.depth [0.3, 0.55, 0.8, 0.95]** per sector, Wound to Lymph node, picked by zoneOf(a.u). Hardy trait still multiplies it. Friendly losses and fatigue cost unchanged. **Sandbox/Campaign: any code reading storm.kill must switch to storm.depth.**
5. **Map taps don't change stance.** A single tap on the map does nothing; stance changes only from the .sstance button (or keys 1-4). Double-tap still zooms in or out. While zoomed in, a pointer drag pans the view (zoomPan, clamped to the map; the zoom chip names the sector in view). #cv gets touch-action none only while zoomed.
6. **25% Stress.** CONFIG.output.min 0.5 -> **0.25**; output.start 0.5 -> **2/3** (still 100% stress). The slider position `game.output` now maps 0..1 to 25%..200%. Presets are 25/50/100/150/200% (`[data-stress="0.25"]` added; the .spresets grid has 5 columns). 25% stress makes 0.44x the cells and recovers fatigue faster. bots.js slider() maps the bots' old slider positions to the same stress on the new slider, except 0 (the lowest setting during afterburn), which is now 25%.
7. **Quorum burst falls off.** Cells within CONFIG.quorum.core 30 of the pop always die; from there out to quorum.pop 100 the kill chance falls linearly to quorum.edgeKill 0.6. Germ kill, fuse 6 s and cooldown unchanged.
8. **Switched-off sectors lose their cells.** CONFIG.idle.half 20: every friendly cell standing in a sector that is off dies with a 20 s half-life (kill reason 'fade', the quiet 'expire' fx, no splotch). Herpes-infected cells still burst. Stops when the sector is back on.

Text updated: guide (Support macrophage, Zoom, Stance, Stress, Power buttons, Quorum burst, Storm), canvas aria-label, power toast, Response sheet hints.

## Bots (2 seeds each, `node headless.js all ... 2`, DIFF=hard for Hard)

- Normal: idle, random, randomCalm, stormSpam lose every level. smart and supportHeavy win every level. focus wins 9/10 (loses Flu). gunner is mixed (sweeps 4 levels).
- Hard: idle, random, randomCalm, stormSpam lose every level. smart wins 8/10 levels (Athlete's foot 0/2, Lungs 1/2). supportHeavy 9/10 (loses Athlete's foot). focus wins 8/10 (loses Flu, Soil cut). Hard stays flagged not balanced.
- Off-sector die-off didn't stop the focus bot: it keeps its cells in the sectors it leaves on.

## Clips to check (tutorial/)

- Storm clip caption "It kills about 70% of germs": now 30% at the Wound rising to 95% at the Lymph node.
- Any clip showing the Stress buttons: there is now a 25% button first.
- Support clip "macrophages stand still inside a ring": they now spread out from each other.
- No clip shows tapping a sector to switch stance (the stance clip already uses the button).
- Quorum burst clip, if it says it kills everything in range: the rim now has survivors.

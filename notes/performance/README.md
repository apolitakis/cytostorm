# iPhone performance check (2026-10-10)

Thread "iPhone performance" asked: would a native iOS app help, and can engine simplifications help without changing gameplay?
Measured on releases/v37 (sim identical to the live V36). No Safari or WebKit in the container: numbers are Chromium on a
Xeon core with an emulated iPhone 14 screen (390x844, 3x pixels). iPhone figures are inferred, not measured.

## Where the time goes

Game logic per tick (node, smart bot, seed 1, Normal), worst levels:

| Level | Peak germs | Mean | p95 | p99 |
|---|---|---|---|---|
| Flu | 2,130 | 1.9 ms | 6.2 ms | 12.4 ms |
| Lungs | 734 | 0.8 | 2.8 | 3.2 |
| Papercut | 762 | 0.8 | 2.4 | 2.9 |
| Sore throat | 1,008 | 0.6 | 1.4 | 3.3 |
| Others | 220-770 | 0.3-0.8 | 0.5-2.1 | 0.7-2.5 |

Hard runs bigger crowds (Papercut 1,430 germs, Lungs p95 5.2 ms). A 60 fps frame has 16.7 ms for everything.

CPU profile at the Flu peak: collisions (germs and cells pushing each other) are 58% of game logic; the
neighbour loop alone is 37%. Then target searches (nearestAg ~12%) and the per-step passes in step().

Browser frames (emulated iPhone 14, deploy/site/play V36), held at the moment of peak crowd:

| Moment | Sprite draws/frame | fps | Logic per tick |
|---|---|---|---|
| Papercut t=208 (560 germs, 360 cells) | ~1,100 | 56 | 2.3 ms |
| Flu t=255 (2,100 germs) | ~2,500 | 12 | 11.3 ms |
| Papercut, CPU slowed 4x | ~1,100 | 9 | 9.4 ms |
| Flu, CPU slowed 4x | ~2,500 | 3 | 41 ms |

When a frame runs long, ui.js catches up with up to 4 ticks per frame (MAX_STEPS), so a slow tick costs up to 4x.
At 2x/3x game speed every frame runs 2-3 ticks anyway.

## Simplifications tested

Both patches are against releases/v38 (they also apply to v37; v38 changed only the trickle, not collisions).

1. **Finer collision grid** (collision-grid.diff, sim.js): collisions use their own 8-unit buckets and
   look only as far as the biggest body present (+1) instead of a fixed +9. Same rules, same bounce; it finds the same
   contacts with fewer checks. Pair order changes, so games are not byte-identical (the sim is chaotic), which is why
   the bots are rerun. Flu peak tick 11.3 -> 6.4 ms in the browser; node p99 12.4 -> 4.9 ms.
2. **Canvas at 2x pixels instead of 3x** (canvas-2x.diff, ui.js resize(): `Math.min(3, devicePixelRatio)` -> 2): Flu 12 -> 18 fps.
   Sprites a touch softer on 3x iPhones. No gameplay effect.
3. Both: Flu peak 12 -> 29 fps; Papercut with CPU slowed 4x 9 -> 15 fps.

Not tried (would change feel, so not recommended unless 1-2 fall short): fewer collision passes inside dense crowds,
merging germs into clumps, capping germ counts. Smaller visual-only option: skip rotating tiny round germs
(saves two setTransform calls per germ; setTransform is ~5% of the Flu profile).

## Bot check (base v37 sim vs collision-grid sim, 4 seeds, all levels)

Alex approved both speed-ups (2026-10-10 17:49; iPhone 18 Pro, worst at big waves on 3x speed).

v37 sim + collision grid, 4 seeds, all 10 levels (headless.js, policies idle, random, randomCalm, stormSpam, smart, supportHeavy, focus):
- Normal: the four must-lose bots lose every level (all host failure). smart 10/10, supportHeavy 10/10, focus 9/10 (loses Flu, as on V34).
- Hard: the four must-lose bots lose every level. smart 8/10 (Athlete's foot 0/4, Cold sore 2/4), supportHeavy 9/10 (Athlete's foot 0/4), focus 9/10 (loses Flu).
- Hard recheck, smart, 12 seeds, old sim vs new: Athlete's foot 2/12 vs 1/12, Cold sore 10/12 vs 9/12, Lungs 11/12 vs 11/12. Within noise; Athlete's foot is weak on Hard either way (flagged not balanced).
- Bot runs got faster too: the 36-game recheck took 276 s vs 354 s.

v38 + collision grid, Normal, 2 seeds: chill and idle lose every level; smart 10/10; focus 9/10 (loses Flu). Matches the v38 README.

## Native app

- Wrapping this web game in an app shell (WKWebView/Capacitor): same JavaScriptCore engine and canvas, so little or no gain.
- Native rewrite (Swift + SpriteKit, the design doc's pick): drawing becomes cheap (SpriteKit batches thousands of sprites on the GPU)
  and compiled Swift usually runs tight loops like the collision check several times faster than JS. Very likely smooth even at the Flu peak,
  but it is a rewrite of sim.js (~1,550 lines) and ui.js (~1,780 lines), and the bot tools would need the same sim.

Scripts (scratch, not kept): simprof.js (per-tick timing), browse.js (Playwright frame timing with CPU throttling).

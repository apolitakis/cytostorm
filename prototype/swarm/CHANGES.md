# Swarm test: changes from prototype/v3

This fork was taken from v3 before Version 26, so it doesn't have quorum bursts, the "response" wording or zone output. Port these edits by hand; don't copy whole files.
"Perf-only" means the edit changes neither gameplay nor the look.

## src/sim.js
1. `LEVEL_ORDER = ['papercut']`: only the intro level. **Swarm only.**
2. `SWARM`, `SWARM_BASE`, `SWARM_KEYS`, `setSwarm(m)` (just after `mergeConfig`): scale marrow rate, the cell/mac/NK caps, start units, `bacteria.maxCount`/`crowdStart`, the spleen caps and every papercut wave and trickle by m, using the v3 numbers. A call during a match takes effect at once. `SWARM` and `setSwarm` are exported. **Swarm only.**
3. `spawnAg`: hard antigen ceiling `C.bacteria.maxCount + 260 * SWARM.mul` (was a fixed +260). **Swarm only.**
4. `Game.inRing(u, v)`: scans a cached list of the macrophages instead of every cell. The list (`this._macs`) is rebuilt when `this.cells` changes, either a new array or a new length. **Perf-only**, results identical. Cost went from O(neutrophils × cells) to O(neutrophils × macs) per step.
5. `Game.collide()`: the three `Grid.each(..., closure)` calls are replaced by a local `near(grid, o, after)` loop over the same buckets, in the same order, calling the same `pair`. **Perf-only**, results identical.
   - Items 4 and 5 were checked with 12 full bot matches (x1, x5 and x10; smart, idle, random, supportHeavy, offenseHeavy). Each match's state fingerprint, taken every 10 s, matched the original bit for bit.
   - Headless sim cost, smart bot: x5 1.55 → 1.18 ms/step, x10 4.5 → 2.9, x20 15.8 → 8.9.

## src/ui.js
1. localStorage keys renamed `immuneRtsV3.*`/`cytostormV3.*` → `cytostormSwarm.*`. **Swarm only.**
2. Startup: after the levels override line, `setSwarm(store.get('cytostormSwarm.mul') || 5)` and `const MULS = [1, 2, 3, 5, 8, 10, 15, 20]`. **Swarm only.**
3. `showStart()`: eyebrow changed to "Cytostorm · swarm test". Adds a `.mulpick` row of `.mulb[data-mul]` buttons (aria-pressed marks the current one) and a hint line. Tapping one calls `setMul(m, true)`, `newGame()`, `showStart()`. **Swarm only.**
4. `setMul(m, quiet)` and the `#mulBtn` click handler (next to the `#ffBtn` handler). The button goes to the next MULS value; setMul applies it live through `setSwarm`, stores it, updates the button, shows the toast "Units ×n (new waves and caps)" and refreshes `cardsHud`/`sheetHud`/`hud`. **Swarm only.**
5. `#tuneReset` handler: calls `setSwarm(SWARM.mul)` after the reset so the swarm numbers stay. **Swarm only.**
6. Feedback report (`fightReport()`): `build: 'swarm'`, plus a new `swarm: SWARM.mul` field. **Swarm only.**
7. `perf` and `perfTick()` (just before `frame`), plus a `window.__cyto.perf` getter: every 0.5 s, `#perf` shows fps, sim ms and draw ms per frame, game speed % and the germ/cell/shot counts. **Swarm/diagnostic; worth keeping in v3 behind a dev toggle.**
8. `frame()`: times the step loop and `render(now)` with `performance.now()` and calls `perfTick`. The catch-up cap `MAX_STEPS = 4` was 16, and `if (n === MAX_STEPS) acc = 0` is kept. **Changes feel on slow devices:** the game slows down instead of stalling.
9. `cv.getContext('2d', { alpha: false })`: an opaque map canvas. **Perf-only.**
10. `buildBackground()`: fills `PAL.void` first, so `bg` is opaque. **Perf-only**, same pixels.
11. `render()`, clear and background: when not zoomed (`zoomE === 0`), only the margins around the map are filled, and `bg` is copied 1:1 at whole device pixels with `drawImage(bg, 0, 0, bw, bh, bx, by, bw, bh)`. The old path (full fill, then a scaled `drawImage` under the clip) is still used while zoomed. **Perf-only**; the background can move up to half a device pixel. This was the biggest render hotspot here: the scaled background copy cost about 73 ms a frame.
12. `render()` stores the map transform in `TA/TD/TE/TF`. **Perf-only.**
13. `draw()`: rotated or stretched sprites now use one `ctx.setTransform(...)`, computed as translate × scale(1/SX) × rotate on the map transform, then a reset to `TA..TF`. This replaces save/translate/scale/rotate/restore, and the heading is kept with a normalised vector instead of atan2. **Perf-only.**
14. `buildGraphics()`: makes `blinkGlow`, a sprite with the white radial gradient. The blink loop in `render()` now draws it with `drawImage` instead of a new `createRadialGradient` and ellipse fill for each blinking germ every frame, and it no longer calls save/restore. **Perf-only.**
15. `render()`, antigen loop: the `preyOf` Map is built once per frame, the first time a swallowed antigen is seen. It replaces `g.cells.find(mm => mm.prey === a)` for each swallowed antigen. **Perf-only.**

## src/template.html
1. `<title>Cytostorm swarm test</title>`. **Swarm only.**
2. `#mulBtn` (class `hbtn`) after `#ffBtn` in the HUD row. **Swarm only.**
3. `<div id="perf" aria-hidden="true">` inside `#stage`, before `#cv`. **Swarm/diagnostic.**
4. CSS: `#mulBtn`, `.mulpick`, `.mulrow`, `.mulb`, `#perf` (absolute top-left, z-index 3, pointer-events none, 10 px monospace on a dark background) and `#perf.slow`, which turns orange below 90% game speed. **Swarm only.**

## src/headless.js
1. The worker calls `setSwarm(+process.env.MUL)` when `MUL` is set, after `TUNE`; there's also a comment line. Example: `MUL=5 node src/headless.js papercut idle,smart 4`. **Swarm only.**

## src/bots.js
No changes.

## 2026-10-08 13:00: rebased onto v3 Version 26
src/ is now v3 releases/v26 plus the swarm block and storage-key rename from the original fork, with the edits above applied as patches (all applied cleanly). Bots at x5 on V26 (4 seeds): idle 1/4, random, randomCalm and stormSpam 0/4, smart, supportHeavy, offenseHeavy and gunner 4/4.

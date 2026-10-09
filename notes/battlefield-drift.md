# Battlefield drift (2026-10-08)

Alex: defenders diffuse in from the left, so the whole fight drifts right over time.

## Cause (v3 sim.js)
- Every new cell spawns in the one blood vessel on the left edge (`spawnCell`: v = VESSEL/2, pushed right at 60-100 px/s).
- Shots knock germs away from the shooter (`stepShots`, `bacteria.knock`), and shooters are nearly always on the vessel side.
- Germs have no sideways pull (`stepAntigens`: tv = 0), so every push sticks. Germs that wander left meet fresh cells and die first, so the survivors sit right.
- The wound spawn point is already a little right of centre (WOUND.v 270 vs middle 252).

## Measured (bot "smart", 10 levels x 3 seeds; -1 = vessel edge, +1 = far edge)
| Variant | Germs avg | Germs in far third | Pinned on far wall | Your cells avg |
|---|---|---|---|---|
| Live V20 | +0.42 | 64% | 6% (Lungs 22%) | -0.19 |
| No shot knockback | +0.32 | 54% | 2% | -0.20 |
| Spawn without the push | +0.44 | 63% | 10% | -0.21 |
| **Second vessel on the far edge** (half of cells enter there) | +0.13 | 19% | 0% | 0.00 |
| Capillaries anywhere across the sector | +0.17 | 32% | 0% | +0.03 |
| Lymph flow pulls germs to the middle (0.05) | +0.17 | 15% | 0% | -0.22 |

## Balance side effect
All three working fixes make levels easier (the drift was hiding germs from fresh cells). With the second vessel, idle wins Papercut 3/4, Flu 3/4, Throat 3/4; Pool and Lungs become winnable for smart bots (2/4, 4/4). Waves x1.2 on Papercut, Flu and Throat puts idle back to 0/4 while smart, supportHeavy, offenseHeavy and gunner still win (Flu gets tighter).

## Second vessel, as tested
In `spawnCell`, for non-macrophages with no position given, half the time: `c.v = WIDTH - 10; c.vv = -c.vv`. The real build also needs: a vessel strip drawn on the far edge, germs kept out of it (mirror the `VESSEL + 6` clamp), and the wave pressure bump above. Test scripts: the drift thread's scratchpad (measure.js, summary.js, variants.js).

## Follow-up (2026-10-08 noon): still drifting right after the second vessel (Play V25)
Spawning is not biased: half of new cells use each vessel (`spawnCell`, `r() < 0.5`), and your cells average +0.04 across the map. The remaining lean comes from spots that were centred on the old map and are now right of the middle of the playable strip. Since FAR_VESSEL = 20, that strip runs from VESSEL (44) to WIDTH - FAR_VESSEL (440), so the middle is 242.
- `WOUND.v = 270` is +0.14 off centre: waves and the trickle spawn right of the middle, and nothing pulls germs back.
- `NODE.v = (WIDTH + VESSEL) / 2 = 252`, which is the target for Flu, Strep, the Tapeworm, the node pool, Net idling and NK patrols.
- The neutrophil idle aim in `stepNeut` is `(WIDTH + VESSEL) / 2`.
- The 30 starting neutrophils are placed at `VESSEL + 20 + rand * 160` (64 to 224), so they all start on the left and shove the first wave right (germs average +0.35 in the first 20 s).

Measured (smart bot, 10 levels x 3 seeds; -1 = left edge, +1 = right edge):
| | Germs avg | Germs in far third |
|---|---|---|
| Play V25 sim | +0.17 | 22% |
| Centre fix (below) | +0.01 | 6% |
Over a Hospital fight the germs stay between -0.03 and +0.09 the whole match (they were +0.06 to +0.35). Bots: idle and random still lose every level, and the other bots' results match V25 within seed noise.

Patch (sim.js):
```js
const MID_V = (VESSEL + WIDTH - FAR_VESSEL) / 2;         // middle of the playable strip, between the two vessels
const WOUND = { u: 70, v: MID_V };
const NODE = { u: L - 45, v: MID_V };
// stepNeut idle aim: replace (WIDTH + VESSEL) / 2 with MID_V
// starting neutrophils: VESSEL + 20 + this.rand() * (WIDTH - FAR_VESSEL - VESSEL - 40)
```
ui.js line ~241 also draws the node at `(WIDTH + VESSEL) / 2`; switch it to MID_V so the art matches. Optional, small effect: macrophage posts use `VESSEL + p * (WIDTH - VESSEL)`; `(WIDTH - FAR_VESSEL - VESSEL)` would centre them, and macrophages whose post is on the right half could leave from the far vessel (germs +0.13 with only that change).
For the vessel-wall bottleneck: keep the 50/50 vessel pick unbiased, and if each wall has its own limit, count both vessels' walls separately so a full left wall doesn't push everyone out of the right one (or the other way round).

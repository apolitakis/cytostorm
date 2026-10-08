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

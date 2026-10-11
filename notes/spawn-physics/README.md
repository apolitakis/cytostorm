# Why clumped spawns move so fast

Thread "Fast clumped spawns", 2026-10-10. Measured on the frozen V32 sim (prototype/v3/releases/v32), with V31 checks before V32 landed (same result: V32 didn't touch germ movement, spawning or collisions).

## Short answer

It isn't the pour, and it isn't the collisions. It's the **crowd push** rule in `stepAntigens`:

```js
let tu = B.drift + B.crowdDrift * Math.max(0, counts[z] - B.crowdStart), ...
```

Every germ in a sector gets extra forward speed for each germ in that whole sector above `crowdStart`. V28 tripled `crowdStart` (60 -> 180) with the 3x unit counts but left the slope `crowdDrift` at 0.08, so the same relative crowd now pushes three times harder. A 749-Staph wave gives every germ in the Wound a target speed of 10 + 0.08 x 569 = 55 u/s, 5.5x the lymph flow (capped by `bacteria.maxSpeed` 70). Because it reads the head count of the whole sector, a lone germ at the far edge zooms as fast as the ones in the middle of the clump. It looks like the crowd behind is shoving the front, which is why it reads like a collision problem.

## Evidence

### Germ-only lab (749 Staph land in an empty Wound; no cells, no trickle, no quorum)

| Rule | Wave's forward speed, 2-4 s after landing | Germs over 30 u/s (2-4 s old) | First germ in Tissue / Deep tissue / Lymph node |
|---|---|---|---|
| V32 today (1.2 s pour) | 53 u/s (5.3x flow) | 70% | 3.8 / 9.5 / 14.7 s |
| V32, pour off | 53 u/s | – | 3.3 / 9.0 / 14.3 s |
| V32, 3 s pour | 43 u/s | 70% | 4.4 / 10.6 / 15.9 s |
| V27 slope (crowdDrift 0.027) | 24 u/s | 21% | 7.0 / 17.7 / 27.0 s |
| Push capped at +10 u/s | 19 u/s | 0% | 8.3 / 21.7 / 35.3 s |
| No crowd push | 10 u/s | 0% | 14.9 / 39.2 / 65.6 s |
| No crowd push, pour off | 10 u/s | – | 14.3 / 39.1 / 65.5 s |
| No push, loose wave (see fixes) | 10 u/s | 0% | 12.7 / 33.3 / 53.7 s |

- The pour is not the cause. Turning it off makes the wave slightly faster (all 749 count toward the push at once); a 3 s pour makes it slightly slower. With the crowd push off, the pour makes no difference at all (10 u/s either way).
- Collisions are not the cause. Waves land with a mean overlap of 0.3 contact-widths (p90 0.7); `collide()` resolves that in a couple of frames, a hop smaller than a germ. With the push off, no germ in the lab ever moved faster than 30 u/s over a quarter second.
- Lab speed is measured over 0.25 s windows (what the eye sees), not per frame. Script: tools/lab.js.

### In a real match (Papercut, smart bot, seed 1, V32)

| | Final wave's forward speed, first 3 s | Wave germs 1-3 s old: median / p90 | Over 30 u/s |
|---|---|---|---|
| V32 today | 27.6 u/s | 23 / 39 u/s | 31% |
| Loose wave fix | 5.8 u/s | 9 / 18 u/s | 1.9% |

Earlier V31 runs: Throat's biggest wave crossed at 42 u/s and Flu's Staph waves at 38 u/s median. The few germs still over 30 u/s with the fix are shot knockback (`bacteria.knock`), which is meant to be visible. Script: tools/measure.js.

### Friendly cells

Nothing like the germ problem. Neutrophils (walk 52) and Net neutrophils (64) move at their own speeds. The one outlier is the macrophage: it leaves the vessel at 60-100 u/s (`spawnCell`, "pushed out of the vessel into the tissue") and walks at 22, so for its first second it moves 2-4x its walking speed before it settles. That's an intended pop out of the vessel, but if it reads as zooming, launch macrophages at 30-45 u/s instead (one line in `spawnCell`). V32's spreading Support macrophages are fine: their posts move at 30 u/s, but the cell itself still walks at 22.

Strep chain links run at 26-38 u/s against a head speed of 20 (the follow spring whips, and the fast Staph mass shoves them); with the crowd push off they drop to about 26.

## Fixes compared

All keep collisions, jostling and the pour exactly as they are.

1. **No crowd push** (`bacteria.crowdDrift` 0). Simplest: one number. Every germ rides the lymph flow at 10 u/s and collisions do any spilling over. Downside: a big wave keeps its spawn box shape and travels as a neat rectangle, which reads like the "big static blob" look Alex dislikes.
2. **No push, loose wave** (recommended). Fix 1, plus two small things so the wave doesn't move as a block: waves land in a round blob instead of a rectangle (same area, same rand() calls), and each germ rides the flow at its own pace, 0.7x to 1.3x (`bacteria.driftSpread` 0.3, taken from the germ's id, so no extra rand() call). The wave smears into a comet as it travels: fast ones lead, stragglers lag, and it still jostles. First arrivals reach the node a little sooner than fix 1 (54 s vs 66 s in the lab), but four times later than today.
3. **Push capped at 2x** (new `bacteria.crowdPush` 10). Keeps the rule but no germ goes past 20 u/s. The whole sector still speeds up together, so a big wave still glides as one block, just slower.
4. **V27 slope** (`crowdDrift` 0.027, the /3 V28 missed). Restores pre-V28 speeds: 2.5x flow in the biggest waves, 21% of germs over 30 u/s. Smallest change, but some of the zoom stays.

## Bots (V32, 3 seeds per level, all 10 levels, Normal)

| Variant | idle | random | smart | focus |
|---|---|---|---|---|
| V32 as published | 0/30 | 0/30 | 30/30 | 27/30 (loses Flu) |
| 1. No crowd push | 0/30 | 0/30 | 28/30 (Lungs 1/3) | 25/30 (Flu 0/3, Throat 1/3) |
| 2. No push, loose wave | 0/30 | 0/30 | 29/30 (Lungs 2/3) | 27/30 (Flu 0/3) |
| 3. Push capped at 2x | 0/30 | 0/30 | 30/30 | 27/30 (Flu 0/3) |
| **2 + slime drag 0.3 (final)** | **0/30** | **0/30** | **30/30** | **27/30 (loses Flu, same as V32)** |

**Side effect found: slime domes.** Without the push, the smart bot's Lungs losses were timeouts, not breaches: around 900 Staph sat in the Wound, about 750 of them under 11 Pseudomonas slime domes, and the match never ended. Germs under a dome ride the flow at 0.1x (1 u/s), plain shots do a quarter damage there, and they keep dividing. Today's crowd push quietly flushed them out: a 900-germ crowd pushed even domed germs at about 6 u/s. With the push gone, domes became permanent shelters. Raising the dome drag to 0.3x (3 u/s, new `pseudo.drag`) fixes it: smart and focus won Lungs, Pool and Hospital 6/6 each. 0.5 also worked; 0.3 keeps the domes stickier.

## Recommendation

Fix 2, **no push, loose wave**, plus the slime drag at 0.3. Alex agreed on 2026-10-10 ("conceptually 1 and 2 both make sense", "it should be not that strong"). It removes the zoom completely (a 749 wave moves at the lymph flow, 10 u/s, instead of 53), keeps every collision and the jostle, and the wave spreads into a ragged stream instead of travelling as a block. The blob's net speed is now one knob, `bacteria.drift`. It also takes a rule away rather than adding one (the crowd push stays in the code at 0 so the Sandbox can turn it back on).

Keep the pour. It isn't the cause and it slightly softens the landing.

Fallback if playtesting says big waves now feel too lazy: fix 3 (cap the push at +10 u/s) matched V32's bot results exactly.

## Patch

proposal-loose-wave.diff is a unified diff against prototype/v3/releases/v32/sim.js (sim.js only; `patch -p1` applies it cleanly in a folder holding that sim.js):
- `bacteria.crowdDrift` 0.08 -> 0, hint updated.
- New `bacteria.driftSpread` 0.3: each germ rides the flow at 0.7x-1.3x, from its id (no extra rand() call), in `stepAntigens`.
- `spawnAg`: germs with no given position (waves, spores) land uniformly in a round blob 100 long and 200 wide instead of a 90 x 180 box. Same two rand() calls.
- New `pseudo.drag` 0.3 replaces the hard-coded 0.1 for germs under a slime dome.

No UI, bots or level changes. Checked: the patched sim plays identically to the experiment switches used for the bot runs. tools/experiment-switches.diff adds those switches (crowdPush, driftSpread, wave.blob, pseudo.drag, all at today's values by default) if anyone wants to rerun the comparisons. Note bots.js `applySettings` wants `{"tune": {...}}`, so TUNE must be wrapped that way.

The Sandbox panel may want a slider for `bacteria.drift` (blob speed) and `pseudo.drag`.

Demo: Wave Speed Lab artifact (link in the thread) runs this sim side by side, today on the left and a chosen fix on the right.

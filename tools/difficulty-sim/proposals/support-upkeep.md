# Proposal: Support upkeep (inflammation)

From the Difficulty simulator thread, 2026-10-10, measured on releases/v39 (Normal). The patch is `support-upkeep.diff`: sim.js only, against v39, about 15 lines.

## The problem
An untouched setup wins most Normal maps. setForget picks all Support, 60/40 neutrophils/macrophages and 67% Stress at the start, then never touches anything. It won 16/20 games (2 seeds × 10 maps). Alex counts untouched as idle, and idle must lose.

## The lever
Holding sectors in Support inflames the body. The Stress the body can sustain (`output.rest`, 115%) drops by `support.upkeep` × (Support sectors ÷ sectors in use), with upkeep 0.5:

- With every sector you use on Support, the sustainable Stress is 65%.
- With half of them on Support, it's 90%.
- With none, it stays at 115%.

So leaving everything on Support at the default Stress (100%) climbs steadily into overload: an organ fails at about 4:40 (3:30 on Flu and Cold sore). A player who eases Stress when the heart fills, or flips quiet sectors to Offense, is fine.

It counts sectors in use, so switching sectors off doesn't dodge it. An early version divided by all 4 sectors, and setForget2 (Wound + Tissue only) still won 7/10. It uses the stress and fatigue the player already watches, with no new button and nothing new to track. The biology holds up: inflammation is expensive.

## Results (V39 Normal, wins over games, 2 seeds × 10 maps unless noted)

| Bot | V39 now | Upkeep 0.5 |
|---|---|---|
| setForget (all Support, 67%, untouched) | 16/20 | **0/20** |
| setForget2 (same, Wound + Tissue only) | 7/10 (1 seed) | **0/20** |
| idle, chill, coast, random | 0 | 0 |
| smart | 20/20 | 19/20 |
| supportHeavy | 19/20 | 17/20 |
| focus | 17/20 | 13/20 |
| offenseHeavy (1 seed) | 3/10 | 3/10 |
| casual | 5/20 | 2/20 |
| gunner | 5/20 | 3/20 |

## Costs
- **Cold sore becomes the hardest map.** smart wins it 1 of 2, supportHeavy 1 of 2, focus 0 of 2. These losses are germs reaching the Lymph node, not overload: the bots ease Stress at fatigue 45 and fall behind.
- **focus and casual lose a few more,** mostly on Papercut, Soil cut and Gut.

## Rejected
- **Upkeep 0.3:** no effect (setForget 8/10).
- **Upkeep 0.4:** setForget 5/10, smart 10/10. Between 0.4 and 0.5 is a cliff, because untouched play either reaches overload before the fight ends or doesn't.
- **Ring wear** (Support rings shrink the longer a sector stays on Support): smart 7/10, focus 1/10, setForget still 3/10. It hurt good play more than untouched play.
- **Counting only sectors that hold Support macrophages,** to spare gunners: no measurable difference (gunner 3/20 either way), so the simple version is proposed.

## For the build thread
- The UI still draws the sustainable-Stress mark on the Stress track at the fixed `output.rest` (ui.js, `#output --track`). It should follow `game.restLevel()`, and the guide's "Above N% fatigue builds" line should mention Support.
- Hard was not tested.
- Cold sore may want a small ease (its wave pressure or NK help) if the cost there feels wrong.

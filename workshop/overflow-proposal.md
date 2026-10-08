# Fatigue over 100: organ damage curve (proposal, 2026-10-07)

Alex (22:42): instead of dying above 100 fatigue, organs take rapid damage that scales with how far past 100 you are, so you can push there in a dire moment and recover.

Waiting on v3 to let fatigue pass 100 and expose the overflow. Not built yet.

**Curve.** Overflow x = fatigue - 100. Liver and kidneys each lose d(x) = 0.0015 x + 0.00015 x^2 of their health per second (both organs, same rate). Reads as "gentle just over 100, brutal far over".

| Overflow | Damage per organ |
|---|---|
| 5 | 1.1%/s |
| 10 | 3%/s |
| 20 | 9%/s |
| 30 | 18%/s |
| 50 | 45%/s |

**Scenarios** (assumed fatigue rates: about +1/s at 2x output, -0.8/s at 0.5x, -0.2/s at 1.0x):
- Push to 110, hold 4 s, then drop output to 0.5x: organs end at about 60% (Damaged). This is the "dire moment, recovered" case.
- Same push, but stay at 1.0x output: organs end at about 13% (Failing), because draining from 110 is slow. Recovering means actually resting.
- Push to 120, then rest at 0.5x: both organs fail.
- Storm (+50, then +2/s for 8 s): storm at 50 fatigue leaves organs at about 30%, and storm at 60 or above fails both. Today any storm at 34 or above is Host failure, so this is more forgiving.

**Open questions:**
1. What ends the match? Default proposal: Host failure when both liver and kidneys have failed while fatigue is still over 100. Otherwise you could sit at 150 forever.
2. Should fatigue be capped at 150, so a storm can't take it to absurd values?
3. The Workshop's "Organ failure loses" toggle becomes redundant and would be removed.

Failed organs already feed back: liver failure slows the marrow, kidney failure slows toxin clearance, and toxin feeds fatigue. So a reckless push spirals, and a careful one recovers.

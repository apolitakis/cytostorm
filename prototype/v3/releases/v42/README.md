# v3 Version 42 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 42, version id 1791665280-07c4, published 2026-10-10.
V42 = V41 with the difficulties shifted up. Clips unchanged (V27). To rebuild it, this folder's build.py expects its files in a `src/` subfolder.

## Why
Alex, 2026-10-10 20:40: "Cleared on hard without too much trouble. I think current hard difficulty is about right for a normal setting but we can make it much harder on higher difficulty. Don't worry about the precise balance right now."

## Changes
- sim.js `DIFFICULTIES`:
  - normal = V41's Hard: waves x1.25, drip (trickle stream) x1.25, Unwatched tissue on (switched-off sectors divide CONFIG.unwatched.div 2x faster), Flu kept at x1.
  - hard = new: waves x1.6, drip x1.6, Unwatched tissue on, Flu x1.25. Flagged "Not balanced yet" on the start screen.
  - Keys unchanged ('normal', 'hard'), so saved settings (cytostormV3.difficulty etc.) carry over; a player on Normal now gets V41's Hard.
- ui.js: start-screen hint now explains Unwatched tissue on Normal too; Hard's hint says much bigger waves and a heavier drip. Guide Controls line no longer says "On Hard" for unwatched sectors.

## Downstream
- Sandbox ("always Normal") and Campaign now get x1.25 waves/drip and unwatched sectors on Normal, on top of Campaign's own pressure ramp. Campaign Hard = x1.6.

## Bots (quick sanity only, 1 seed per level; tables here)
- New Normal: idle 0/10, setForget 0/10.
- New Hard: smart 5/10 (wins Papercut, Pool water, Soil cut, Lungs, Sore throat).

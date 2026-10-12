# v3 Version 45 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 45, version id 1791737000-e5f3, published 2026-10-11.
V45 = V44 + a small neutrophil nerf. Clips unchanged (V28). To rebuild it, this folder's build.py expects its files in a `src/` subfolder.

## Why
Alex, 2026-10-11 16:25: keep the untimed waves; make counters "slightly more rewarded than they are today ... maybe just a tiny neutrophil nerf to start and then we park sharper unit counters for later".

## Change
- sim.js: `CONFIG.neutrophil.fireEvery` 0.7 -> 0.75 s (about 7% less neutrophil damage, plain and tuned shots alike). Nothing else.

## Bots (Normal, 1 seed per level; noisy, the wave jitter adds variance)
| Bot | V44 | fireEvery 0.8 (tried) | 0.75 (shipped) |
|---|---|---|---|
| smart | 8/10 | 6/10 | 4/10 |
| supportHeavy | 7/10 (V43) | 4/10 | 8/10 |
| setForget | 0/10 (V43) | 0/10 | 0/10 |
| idle | 0/10 | 0/10 | not rerun |
| gunner | 0/10 | 0/10 | not rerun |
| offenseHeavy | 1/10 | 1/10 | not rerun |
Raw tables in this folder (0.75 run: smart, supportHeavy, setForget only; it's in the coordinator note / thread).
0.8 was dropped as too big a step for "tiny". With one seed the 0.75 numbers swing a lot (smart lost Papercut and Pool, which it won at 0.8); Alex said not to chase precise balance. Normal is not balanced yet after V42-V45.

## Parked (Alex, 2026-10-11)
Sharper unit counters (each germ takes much more from its counter, less from everything else): later.

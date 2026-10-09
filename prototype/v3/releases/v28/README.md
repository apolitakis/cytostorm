# v3 Version 28 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 28, id 1791468950-0984, published 2026-10-08. Inlines tutorial clips V22.
These are exactly the sources that built it. src/ in the parent folder can move ahead of this.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

New since V27 (Alex, 2026-10-08 13:16):
- 3x units on both sides: marrow.rate 10.8, caps 540/54/36, start 90 neut + 12 mac, bacteria.maxCount 1350 and crowdStart 180, spleen limits 450/360/270, domeCap 18, fungus cap 2100, worm segHp 99 (still one worm), evolve.min 60, lymph.crowd 0.033, quorum.badge 36, spawn ceiling maxCount + 780.
- Quorum crowd sizes x2 (default 20, Papercut 28, Flu and Sore throat 36): x3 almost never popped.
- Then every wave and the trickle x1.3 (trickle.mul 2.6): the 3x armies won too easily.
- Waves pour in over CONFIG.wave.pour = 1.2 s (ease-out, half in the first third) via Game.pourQ, instead of one step.
- Bot count thresholds x3 (GOOD macs 42, netAt 75, crowd 120, stormAt 660).
- Perf ports from prototype/swarm/CHANGES.md: sim items 4-5 (cached macrophage list, closure-free collide); ui items 8-15 (opaque canvas, 1:1 background copy, setTransform sprites, blink glow sprite, preyOf map, MAX_STEPS 4). The #perf readout was not ported.
- Slime dome hint text now says shots barely dent germs under it.

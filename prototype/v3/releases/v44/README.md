# v3 Version 44 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 44, version id 1791667831-9a86, published 2026-10-10.
V44 = V43 + tutorial clips V28 (id 1791667719-0148) inlined. sim.js and bots.js unchanged from V43 (see ../v43/README.md for the untimed waves and API). To rebuild it, this folder's build.py expects its files in a `src/` subfolder.

## Changes
- Clips V28: "Waves and quorum bursts" and "Clostridium spores" draw the V43 untimed rail.
- ui.js: guide thumbnails draw at `TUT.CLIPS[id].thumb ?? dur * 0.6` (one line in showGuide).

## Checks
- tools/browser-tests/v40/clips.js (390 px): every unit level plays antigen clip then unit clip and starts; Cells row lists all seven; no page errors. v43/rail.js: no page errors.
- Thumbnails: Mast cells now clean. Dendritic couriers and Regulatory T cells still show overlapping labels at their thumb time (5.0 s); for the clips thread.

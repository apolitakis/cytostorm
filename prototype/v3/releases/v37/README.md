# v3 Version 37 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 37, id 1791650655-f0d7, published 2026-10-10.
Built on Version 36 (see ../v36/README.md and earlier). UI-only: sim.js, bots.js and headless.js are byte-identical to v36. Still inlines tutorial clips V26.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes (Alex, 2026-10-10): postgame charts

The end screen's chart (#graph) now has three views, picked by a row of pills (.gviews [data-gv]) above it:
- **Germs vs cells** (default): total germs (pink, filled) against your cells on the field (cyan) from game.history's 2 s samples (sum of p.z, and p.n).
- **By sector**: germs in each of the four sectors (the old chart). Double-tap or double-click the chart to flip between this and Germs vs cells.
- **Fatigue**: fatigue over the fight, with Tired / Feverish / Exhausted / Overload bands labelled on the right.
All three mark waves (small ticks on top), quorum bursts (thin purple lines) and storms (orange lines) from game.log.events. The legend shows each line's peak, and the canvas aria-label states the peaks. The legacy scripted-toxin marks are gone (no level uses them).

ui.js: GVIEWS, graphView, drawGraph() rewritten; showEnd() markup. template.html: .gviews, #graph 150 px tall, legend tweaks.

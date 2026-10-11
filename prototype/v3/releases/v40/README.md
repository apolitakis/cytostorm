# v3 Version 40 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 40, version id 1791659330-5f71, published 2026-10-10.
V40 = V39 + tutorial clips V27 (id 1791658768-3a7e) inlined. sim.js, bots.js and headless.js are unchanged from V39, so V39's balance numbers and API (../v39/README.md) still hold.
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; it inlines /mnt/project-files/tutorial/tutorial.js as it is on disk, so a later clips rebuild changes the output.

## Changes
- Intro clips for the seven new units play on their level after that level's antigen clip(s) (CytoTutorial.LEVEL_UNIT inside `TUT.forLevel(key, newIn(key))`; no Play call changed). Hospital visit, for example, now shows "1 of 2" MRSA then "2 of 2" B cells.
- Guide, How to play tab: a third row "Cells" lists the unit clips (TUT.UNITS), after Basics and Antigens. One line in ui.js (showGuide, tab 'howto'); hidden if the clips file has no unit clips.

## Checks
- Browser (tools/browser-tests/v40/clips.js, 390 px phone): Papercut and all seven unit levels play their clips and start the game; the Cells row lists all seven; no page errors; no horizontal scroll.
- Bots, all 10 levels Normal, 1 seed: idle loses all 10, smart wins all 10 (same as V39, sim unchanged).

## Known
- Guide thumbnails draw each clip at 60% of its length. For Regulatory T cells, Dendritic couriers and Mast cells that frame falls mid-transition, so overlapping labels show in the thumbnail (the clips themselves play fine). Fix belongs in the clips (a cleaner frame at 60%, or a per-clip thumbnail time Play could read).
- Not balanced yet: unchanged from V39 (set-and-forget Support wins most Normal levels; Hard Athlete's foot).

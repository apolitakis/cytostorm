# v3 Version 35 (frozen)

Artifact https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, Version 35, id 1791649097-5efa, published 2026-10-10.
Built on Version 34 (see ../v34/README.md and ../v32/README.md). Still inlines tutorial clips V25. **sim.js, bots.js and headless.js are byte-identical to v34**: this is a UI-only release (ui.js, template.html).
To rebuild it, this folder's build.py expects its files in a `src/` subfolder; downstream threads should read these files directly.

## Changes (Alex, 2026-10-10)

1. **Adrenaline surge.** A syringe button (#surgeBtn, with the count in #surgeN) sits above Pause in a new `.pcol` column (Pause is now the lower half). Tapping it slows the fight 10x for 10 real seconds; tap again to end it early. 3 per map, the same on Normal and Hard. No combat effect: it only scales the UI's sim speed (ui.js SURGE {n: 3, real: 10, slow: 0.1}; simSpeed = SPEEDS[speedIdx] x 0.1 while surgeT > 0). The surge timer only runs while the fight runs. While a surge is on, the button fills with the time left and the map gets a thin cyan inner edge (#stage.surging). Key A. Logged as input {a:'surge', on, left}. It's Alex's own exception to the no-new-active-abilities rule.
2. **Menus don't pause the fight.** The Organ status window and the guide (? button) now let the sim run behind them (LIVE_MODALS in ui.js; `halted()` replaces the old `paused || modal` checks). Their buttons say Close instead of Resume. Pause, the start and end screens, tutorial clips and the feedback form still stop it. The Response sheet never paused.

Downstream (Sandbox fork_ui / Campaign): the bottom bar markup changed. #pauseBtn is now inside `<div class="pcol">` after #surgeBtn.

## Bots

Sim and bots are unchanged from v34, so the v34 results hold. Normal: idle, random, randomCalm and stormSpam lose every level, smart wins all 10, focus wins 9. Hard: the four must-lose bots lose every level, smart wins 8, focus wins 9. Browser check: 2 s of real time advances the sim 2.0 s normally and 0.2 s during a surge; with the organ window open it keeps running; Pause still stops it. Layout test at 375/390/430/1280 has no page errors.

# Campaign strategy simulator

Owned by the "Campaign strategic layer simulator" thread (2026-10-10). Alex asked for "a campaign strategic layer simulator where I can get realistic per mission rewards based on what upgrades I have and play out the campaign upgrade system".

The deliverable is the **Cytostorm Campaign Planner** page (an Artifact; link in team memory). You play the campaign's meta layer only: buy upgrades and vaccines in the Clinic, pick a treatment, press Play, and the page rolls a win or a loss with the odds the bots measured for that stage and that build, and pays Samples by the campaign's own rules. A forecast plays the rest of the campaign 1,000 times under three spending habits.

It reads the frozen game release and the campaign rules read-only: `prototype/v3/releases/v34` and `campaign/src/campaign.js` (owned by other threads; never edited here).

## Files

- `run.js`: data collection. Plays the game's own bots (`casual`, `smart` from bots.js) on each campaign stage with the campaign's pressure ramp, a randomly bought build of the size you could afford by that stage, and specialists unlocked as on a first visit. Writes one JSON line per game (win, cause, when, organ bars, Samples base). Resumes where it stopped.
  - `V3=<copy of releases/v34> CAMP=<copy of campaign/src> node run.js builds builds.jsonl` (PER=24 builds x 10 stages x 2 skills = 480 games; one game is about 40 core-seconds, so about 85 minutes on 4 cores)
  - `... node run.js treat treat.jsonl` (each treatment on each stage, no build and a mid build, 200 games)
  - Run from copies outside /mnt/project-files (as campaign/src/check.js does).
- `fit.js`: fits the win model and writes `model.json`. Per skill: logit P(win) = stage difficulty + a fixed boost per upgrade rank + a vaccine boost scaled by the share of the stage's germs (by Samples value) the vaccines cover + a per-stage treatment effect. Ridge-regularised logistic regression. Win pay = the bots' mean Samples base on wins at that stage; loss pay = their mean base on losses (both then go through the first-clear x1.5 / quarter rule).
- `page.html` + `build.py`: the page. `CAMP=<campaign/src> MODEL=model.json python3 build.py` inlines the campaign rules and the model into `index.html`.
- `data/`: the raw game logs the current model was fitted on.

## Known limits

- One bot game per build, so one stage's odds can be off by 10-15 points. Where bots won every game the model only knows "very likely".
- Upgrade boosts are shared across stages (one number per upgrade per skill), so an upgrade that matters on one stage only is averaged out.
- Loadout isn't modelled: with 2 slots and 2 specialists, every stage brings everything unlocked.
- Replays use first-visit odds and the build you have now.

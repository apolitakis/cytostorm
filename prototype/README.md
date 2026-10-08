# Immune RTS fun-test prototype

Throwaway web build of the thin vertical slice in `../notes/prototype-scope.md`. One self-contained page: `index.html`.

## Files

- `index.html` - the built page (art, sim and UI inlined). Open it directly in a browser or publish it.
- `build.py` - rebuilds `index.html` from the pieces below. Run `python3 build.py` after any edit.
- `src/sim.js` - the simulation. No DOM; every tunable number is in `DEFAULTS` at the top.
- `src/ui.js` - canvas rendering, HUD, controls, end screen, dev tools.
- `src/template.html` - page markup and CSS.
- `src/headless.js` - balance runs with simple bot players: `node src/headless.js 1,2,3 [policy,...]`.
- `assets/` - art kit, owned by the "Prototype art assets" thread. `build.py` inlines `assets/assets.js`, so a new art drop just needs a rebuild.

## What's in it

3 sectors (Blood entry, Wound, Lymph exit) with per-sector alert levels; bacteria that double, pour in through the cut until it closes (4:30 by default), and fire quorum toxin bursts; neutrophils (Eat / Trap) and macrophages (Kill / Repair) with a few seconds of stance spread; a bone-marrow mix slider; fever with cooldown; Pathogen Load and Host Damage (with a permanent scarring share); a faked adaptive phase (sample bar, Opsonize or Complement, exponential antibody ramp, antibodies delivered faster into inflamed tissue); Papercut and Pollen scenarios; stars; and an end screen with a meter graph and damage breakdown.

Dev tools (Dev button): speed 0.25x to 4x, pause, step, seed, restart, cheats, field overlay, and a live tuning panel for every number in `DEFAULTS`. Tuning changes persist in that browser; "Copy changes as JSON" exports them.

## Balance baseline (headless bots, seeds 1-3)

Papercut: doing nothing loses to Pathogen Load at about 2 min; adjusting alerts plus Opsonize wins at about 4:40 with 1 to 3 stars; the same play without antibodies loses or barely survives; Max on the wound all game wins with about 55% Host Damage; Max everywhere plus fever loses to Host Damage at about 3 min; Trap all game wins but costs about 70%.
Pollen: grains are harmless and neutrophils can't eat them, so Pathogen Load sits around 60-75% all season. Doing nothing ends at about 24% Host Damage (1 star); Quiet everywhere plus Repair gets 3 stars; Max plus fever loses.

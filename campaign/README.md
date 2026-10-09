# Cytostorm campaign

Owned by the "Immune mechanics brainstorm" thread. Built 2026-10-08 from the "Locked for building" section of notes/campaign-brainstorm.md, Alex's spec. Playable at https://claude.ai/artifact/So5dsH9Ess5Q3EgKJG2Zdn (see the coordinator's memory for the current version).

It wraps the main game without editing it. At build time it reads prototype/v3/src (owned by "Build the web prototype"), the art kit, the tutorial clips and the sound, all read-only. Rebuild on each main-game handoff, from the frozen release folder it names, never live src (which can hold half-built work): `V3=releases/v26 python3 build.py` writes `index.html`. Then republish the same Artifact.

## Files

- `src/campaign.js`: the rules, with no DOM, so it runs under node. It holds the Samples values and payout, upgrades, treatments, vaccines, the loadout and unlocks, the pressure ramp, and `instrument(game)`, which wraps `tick`, `damage`, `spawnAg`, `stepAntigens` and `stepMac` on one Game instance.
- `src/camp-ui.js`: the body map, Clinic (Shop / Loadout / Treatment tabs) and the Samples panel on the end screen. Exposes `window.CampaignHooks`.
- `src/campaign.css`: campaign styles, appended to v3's.
- `src/body-art.js`: the body map's front outline and muscle segments, from the npm package react-native-body-highlighter 3.2.0 (MIT; its license is copied in the file and ships in the page).
- `build.py`: copies v3's ui.js and adds five hook calls: showStart, before and after `new Game`, the end of showEnd, and init at boot. Every anchor is asserted, so a v3 change that moves one stops the build and names it. It also renames v3's saved keys to `cytostormCampaign.*` so the campaign never touches the main game's settings. Campaign progress is in `cytostormCampaign.state` (localStorage, per browser).
- `src/check.js`: bot check. Run from a copy outside /mnt: `V3=<copy of v3/src> P=ramp node check.js all idle,random,smart 2 late all`. Builds are none, third or late (about what a first run has earned by the last map), full, or a JSON object of upgrade ranks.

## Rules as built

- **Stages:** every map is a wound on the body, named "Stage 1: Finger", "Stage 2: Elbow" and so on (`PLACES` in campaign.js). The level's own blurb stays.
- **The Clinic opens over the first stages** (`CLINIC` in campaign.js): Stage 1 has no Clinic and starts straight away. Then the Shop opens at Stage 2, Treatment at 3, Vaccines at 4 and Loadout at 5. Each part shows a short note the first time, with a dot on its tab. Before a part opens, the defaults apply (no treatment; every specialist you have comes along).

- **Samples:** each kill is worth an amount by toughness (Staph 1, MRSA 4, TB 4, yeast 3, tapeworm segment 12, and so on), times 0.12 / 3.9. Play V28 sends 3.9x the germs, so the rate was divided to keep first clears paying about what they did before. A map pays at most the value of what it sends in (its waves plus the trickle), so letting bacteria multiply doesn't farm. Storm kills pay 0. A first clear pays +50%; replays and losses pay a quarter. A first run earns about 2,300; the shop plus vaccines costs about 7,300.
- **Pressure:** later maps send more, from ×1.0 on map 1 up to ×1.5 on map 10 (`PRESSURE_END`). The ramp is fixed per map and never reacts to the player. The Clinic shows it.
- **Upgrades (12, 3 ranks each):** Production rate, Big heart, Quick trigger, Long-lived, Wide nets, Big appetite, Wide rings, Reserve (+6 macrophages per rank on V28's 3x caps), Hardy NK cells, Fast recovery, Stamina, Cool head. Neutrophil upgrades are kept small because neutrophils win fights on their own.
- **Vaccines:** 120 Samples each, for any germ in a map you've played. Shots and nets do +1 damage to it, and macrophages swallow it twice as fast. Vaccinated Influenza stops splitting, and vaccinated Herpes can't hide in your cells.
- **Loadout:** neutrophils and macrophages always come, plus up to 2 specialists. Net and NK unlock free when you reach Flu season and Lungs.
- **Treatments:** passive, cost on that map only. Antibiotics (shots and nets do x2 to bacteria; 1 in 5 arriving bacteria turn MRSA). Antifungals (threads creep and bud a third as fast, yeast hp halved; fatigue recovers 1% slower). Antivirals (no Herpes hiding, no flu split; bacteria divide 20% faster). Steroids (fatigue builds half as fast, storm costs 30; marrow x0.7). Fever reducer (tiers +10; cost: CONFIG.fever.on = 0, so fever stops slowing bacterial division).

## Bot check (2026-10-08, Play V28 from releases/v28, campaign pressure ramp on, 2 seeds per map)

- Random mashing loses every map with no build and with a late build.
- With no upgrades: idle loses every map. Smart wins about 4 or 5 of 10: it loses Nose and Neck and wins half of Foot, Chest, Lip and Belly.
- With a late build (about 2,000 Samples), doing nothing still wins about 7 of 10 maps. Flagged as not balanced yet. Options: a steeper ramp, weaker upgrades, or upgrades that only pay off with active play.
- First-clear Samples match V27 (Papercut 251, Nose 356), so the shop prices still fit.
- One pass of `check.js all` takes about 6 minutes on V28.

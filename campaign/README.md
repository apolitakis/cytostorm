# Cytostorm campaign

Owned by the "Campaign builds" thread (fresh thread from 2026-10-10 18:47; before that "Immune mechanics brainstorm" / "Campaign builds to V12"). Built 2026-10-08 from the "Locked for building" section of notes/campaign-brainstorm.md, Alex's spec. Playable at https://claude.ai/artifact/So5dsH9Ess5Q3EgKJG2Zdn (see the coordinator's memory for the current version).

It wraps the main game without editing it. At build time it reads prototype/v3/src (owned by "Build the web prototype"), the art kit, the tutorial clips and the sound, all read-only. Rebuild on each main-game handoff, from the frozen release folder it names, never live src (which can hold half-built work): `V3=releases/v45 python3 build.py` writes `index.html`. Then republish the same Artifact.

## Files

- `src/campaign.js`: the rules, with no DOM, so it runs under node. It holds the Samples values and payout, upgrades, treatments, vaccines, the loadout and unlocks, the pressure ramp, and `instrument(game)`, which wraps `tick`, `damage`, `spawnAg`, `stepAntigens` and `stepMac` on one Game instance.
- `src/camp-ui.js`: the body map, Clinic (Shop / Loadout / Treatment tabs) and the Samples panel on the end screen. Exposes `window.CampaignHooks`.
- `src/campaign.css`: campaign styles, appended to v3's.
- `src/body-art.js`: the body map's front outline and muscle segments, from the npm package react-native-body-highlighter 3.2.0 (MIT; its license is copied in the file and ships in the page).
- `build.py`: copies v3's ui.js and adds five hook calls: showStart, before and after `new Game`, the end of showEnd, and init at boot. Every anchor is asserted, so a v3 change that moves one stops the build and names it. It also renames v3's saved keys to `cytostormCampaign.*` so the campaign never touches the main game's settings. Campaign progress is in `cytostormCampaign.slots` (localStorage, per browser).
- `src/check.js`: bot check. Run from a copy outside /mnt: `V3=<copy of v3/src> P=ramp node check.js all idle,random,smart 2 late all`. Builds are none, third or late (about what a first run has earned by the last map), full, or a JSON object of upgrade ranks.

- `tests/pw7.js`, `pw8.js`, `pw9.js`: Playwright (Chromium only) browser tests at 390x844. pw7 = save slots, old-save migration, new run on Hard, delete with confirm, Clinic tabs by stage, a fight paying into its slot. pw8 = germ cards, body-map germ rows, card tap opens the guide and closes back to the Clinic. pw9 = loadout warning, treatment "Here:" lines, shop undo. pw10 (V13) = Clinic tabs and default loadout per stage, "New here" tag, warnings when a loadout misses a germ's counters, new-unit shop lines locked until the unit joins, the fight's Response sheet showing the loadout's units. Each prints "errors: none" when clean.

## How to rebuild and publish (checklist for a fresh session)

1. The coordinator names a frozen release, e.g. `prototype/v3/releases/v39`. Build: `cd /mnt/project-files/campaign && V3=releases/v39 python3 build.py` (writes index.html; the art kit, tutorial clips and sound are inlined live from prototype/assets, tutorial/, audio/).
2. Browser tests: `S=<scratchpad>; mkdir -p $S/shots; cp index.html $S/camp.html; for t in pw7 pw8 pw9 pw10; do NODE_PATH=$(npm root -g) node tests/$t.js $S; done`.
3. Bots, only when the sim changed: `cp -r ../prototype/v3/releases/v39 $S/v3copy; cp src/campaign.js src/check.js $S/; cd $S; V3=$S/v3copy P=ramp node check.js all idle,random,smart 2 none` (about 12 min on 4 cores; prints a wins table) then `V3=$S/v3copy P=ramp node check.js all idle,smart 1 late` (about 4 min). Run in the foreground in under-10-minute chunks (Alex reads idle threads as stuck). Pass: random and idle with no build lose everything, smart with no build wins most; late-build idle still winning several stages means keep the "not balanced yet" flag.
4. Publish: copy index.html into the scratchpad, `Artifact read` https://claude.ai/artifact/So5dsH9Ess5Q3EgKJG2Zdn first, then publish with that `url` (a path the session hasn't published before otherwise creates a NEW artifact; that's how the stray duplicate https://claude.ai/artifact/MZc8yVGTxMFbPXka1bCXhY happened on 10-10).
5. Send the coordinator the version, version id and bot numbers; update the bot section below and team memory `cytostorm-campaign-build`.

## The seven new units (Campaign V13, on Play V39's units; Alex 2026-10-10 17:34, "build them into campaign and do a quick balancing pass")

Done (section 2 of notes/campaign-features-brainstorm.md): B cells (Stage 2 Elbow), Eosinophils (3 Ear), Net (4 Nose, as before), Platelets (5 Knee), Dendritic couriers (6 Foot), NK (7 Chest, as before), Regulatory T cells (8 Neck), Interferon cells (9 Lip), Mast cells (10 Belly). Still 2 specialist slots.
- Unlocks: each unit joins on the first stage whose Play level lists it (`setUnits` + `unlocked`); no campaign table to keep in sync.
- Clinic: Loadout opens at Stage 4 and Vaccines at 5 (`clinicAt`, automatic once 3 specialists are out by Stage 4).
- Shop: one line per unit in the Specialists group, locked until the unit joins, 70/140/220 like Hardy NK: Big clouds (bcell.cloud +15%/rank), Short fuse (eos.charge -15%/rank), Tough clots (plt.hp +3 s/rank), Swift couriers (dc.speed +20%/rank), Deep calm (treg.calm +1 point/rank), Wide haze (ifn.haze +15%/rank), Long mucus (mast.mucus +1.5 s/rank).
- Counters: `GERM[x].units` is a list, best first. Cards and the loadout warning only flag a germ when none of its counters is packed, and the warning names only unlocked ones ("Tapeworm is coming: Mast cells or Eosinophils beat it.").
- Default loadout (`suggest`): until the player picks, a stage brings its own new unit, then the best counter of any germ nothing packed answers (new germs count double), then the next specialist in the sim's order. Result: Elbow B cells; Ear Eos + B cells; Nose Net + B cells; Knee Platelets + Net; Foot Couriers + Net; Chest NK + Net; Neck Tregs + Net; Lip Interferon + NK; Belly Mast + Net. Once the player toggles a unit the pick is theirs and carries over (new units join only into a free slot), as before. The stage's own unit gets a "New here" tag in the Loadout tab.
- Loadout comparisons (smart bot, no build, 4 seeds): Lip Interferon + NK 2/4 vs NK + Net 0/4 and Interferon + Net 0/4; Foot Couriers + Net 0/4, Eos + Net 0/4, Couriers + Eos 1/4.
- Open: Foot is the hard stage whatever the loadout (Play wins it without the campaign's +28% pressure). Late-build idle still wins half the stages.

## Rules as built

- **Save slots:** three, in localStorage `cytostormCampaign.slots` (Alex, 2026-10-10). Opening the page always lands on the Campaigns screen; nothing resumes on its own. Each slot shows its next stage, difficulty, stages cleared and Samples, with Continue and Delete (tap twice). An empty slot offers New campaign, and it's only saved once a difficulty is picked. A campaign saved before slots existed (`cytostormCampaign.state`) moves into slot 1. The body map's "All campaigns" link goes back to the list.
- **New campaign:** asks for a difficulty first (Normal preselected, or Hard, flagged not balanced yet), kept in the run's state (`st.diff`) and applied with `setDifficulty` before every fight. Then a one-time goal screen. Saves from before this carry on at Normal. On Hard the Samples cap grows with Hard's wave multiplier. (Alex, 2026-10-10)
- **Stages:** every map is a wound on the body, named "Stage 1: Finger", "Stage 2: Elbow" and so on (`PLACES` in campaign.js). The level's own blurb stays.
- **Germ previews** (spec 1a in notes/campaign-features-brainstorm.md, Alex 2026-10-10): the Clinic's "Coming in" row is one card per germ: name, a New tag the stage it first appears, a Vaccinated tick, one line on what it does, what beats it with that unit's icon (orange "Not in your loadout" / "Not unlocked yet" when you won't have it), and when it arrives, worked out from the stage's wave list and trickle (`GERM` and `arrival` in campaign.js). Tapping a card opens the guide's Antigens tab scrolled to that germ. Body map rows list every germ in the stage, vaccinated ones ticked. Stage 1 has no Clinic, so its only preview is the body map row.
- **Clinic helpers** (spec 1b-1d, Alex 2026-10-10 17:09): the Loadout tab warns in one line when a germ's counter isn't packed ("Herpes is coming: NK cells beat it."), never blocking Start. Each treatment card says what it does on this stage ("Here: stops Herpes hiding.", "Nothing here for it to treat."; Steroids and Fever reducer work anywhere). Shop upgrades and vaccines bought on this Clinic visit can be undone newest first with the Undo button under the Samples line, until Start (or switching save slot); the list lives in memory only.
- **New units (Alex 2026-10-10 17:34, section 2 of notes/campaign-features-brainstorm.md):** the specialist list comes from the sim's `UNIT` table at boot (`setUnits`), and each one unlocks on the first stage whose Play level lists it, so new units join the loadout without campaign changes. Once more specialists than slots are unlocked by Stage 4, Loadout opens at Stage 4 and Vaccines moves to 5 (`clinicAt`). Still to do when each unit's Play release lands: its shop upgrade line, its counters in `GERM`, and a bot pass.
- **The Clinic opens over the first stages** (`CLINIC` in campaign.js): Stage 1 has no Clinic and starts straight away. Then the Shop opens at Stage 2, Treatment at 3, Loadout at 4 and Vaccines at 5 (V13; before the new units it was Vaccines 4, Loadout 5). Each part shows a short note the first time, with a dot on its tab. Before a part opens, the defaults apply (no treatment; every specialist you have comes along).

- **Samples:** each kill is worth an amount by toughness (Staph 1, MRSA 4, TB 4, yeast 3, tapeworm segment 12, and so on), times 0.12 / 3.9. Play V28 sends 3.9x the germs, so the rate was divided to keep first clears paying about what they did before. A map pays at most the value of what it sends in (its waves plus the trickle), so letting bacteria multiply doesn't farm. Storm kills pay 0. A first clear pays +50%; replays and losses pay a quarter. A first run earns about 2,300; the shop plus vaccines costs about 7,300.
- **Pressure:** later maps send more, from ×1.0 on map 1 up to ×1.5 on map 10 (`PRESSURE_END`). The ramp is fixed per map and never reacts to the player. The Clinic shows it.
- **Upgrades (19, 3 ranks each; the seven unit lines are in the units section above):** Production rate, Big heart, Quick trigger, Long-lived, Wide nets, Big appetite, Wide rings, Reserve (+6 macrophages per rank on V28's 3x caps), Hardy NK cells, Fast recovery, Stamina, Cool head. Neutrophil upgrades are kept small because neutrophils win fights on their own.
- **Vaccines:** 120 Samples each, for any germ in a map you've played. Shots and nets do +1 damage to it, and macrophages swallow it twice as fast. Vaccinated Influenza stops splitting, and vaccinated Herpes can't hide in your cells.
- **Loadout:** neutrophils and macrophages always come, plus up to 2 specialists. Each specialist unlocks free on the stage that introduces it (B cells at Elbow ... Mast cells at Belly; Net at Nose, NK at Chest). Until you choose, each stage packs its own unit plus a counter (see the units section above).
- **Treatments:** passive, cost on that map only. Antibiotics (shots and nets do x2 to bacteria; 1 in 5 arriving bacteria turn MRSA). Antifungals (threads creep and bud a third as fast, yeast hp halved; fatigue recovers 1% slower). Antivirals (no Herpes hiding, no flu split; bacteria divide 20% faster). Steroids (fatigue builds half as fast, storm costs 30; marrow x0.7). Fever reducer (tiers +10; cost: CONFIG.fever.on = 0, so fever stops slowing bacterial division).

## Bot check (2026-10-11, Play V45 from releases/v45, Normal, ramp on): Campaign V16

V45 = neutrophils fire every 0.75 s (was 0.7). Sanity pass, default loadouts:
- No build, 1 seed: idle 0/10, smart 1/10 (wins only Chest). Extra seeds, smart no build: Finger 1/3, Elbow 2/3, Ear 0/3, Nose 1/3.
- Small build ("third", ~800 Samples), smart 3 seeds: Finger 3/3, Elbow 3/3, Ear 1/3, Nose 3/3.
- Late build, 1 seed: idle 4/10 (Finger, Nose, Neck, Belly), smart 10/10.
- Not balanced yet: Stage 1 (Finger) is a coin flip for good play with no upgrades, Ear is the hardest early stage, and late-build idle still wins 4.

## Bot check (2026-10-10, Play V43 sim (= V44) from releases/v43, Normal, ramp on): Campaign V15

V43 moves each wave after the first up to 10 s off script. The campaign starts games through Play's own newGame, so Play's `game.rollWaves(random)` re-rolls the timing every attempt there too (the line sits right after the campaign's afterGame hook). rollWaves edits the game's own scaled copy of the level, never the campaign's saved original. Germ cards only name wave numbers, never times. Sanity pass, 1 seed per stage:
- No build: idle 0/10, smart 5/10 (loses Ear, Foot, Neck, Lip).
- Late build: idle 4/10 (Finger, Nose, Neck, Belly), smart 10/10. Late-build idle stays "not balanced yet".

## Bot check (2026-10-10, Play V42 from releases/v42, new Normal = old Hard x1.25 on top of the ramp): Campaign V14

Sanity pass only (Alex 20:40: don't worry about precise balance now), 1 seed per stage, default loadouts.
- No build: idle 0/10, smart 6/10 (loses Ear, Nose, Foot, Lip).
- Late build (~2000 Samples): idle 4/10 (wins Finger, Nose, Neck, Belly), smart 10/10.
- Not balanced yet: late-build idle still wins 4 stages even with V41's Support upkeep. Normal also pays about 25% more Samples (more germs, same rate).
- V41's Support upkeep goes through game.restLevel() = output.rest - upkeep; Stamina still raises output.rest, so the two combine (its text now says "+N% ... with no sector on Support").

## Bot check (2026-10-10, Play V39 sim from releases/v39 at Normal, ramp on; V40 has the same sim and bots): Campaign V13 (version id 1791659546-679e, built on releases/v40)

Default loadouts per stage (each stage's own unit plus a counter).
- No build, 2 seeds per stage: random 0/20, idle 0/20, smart 16/20 (loses Foot 0/2, Nose 1/2, Lip 1/2).
- Late build (the twelve V12 lines, ~2000 Samples), 1 seed: idle 5/10 (wins Finger, Ear, Nose, Neck, Belly, same set as V12), smart 10/10.
- Full build (everything rank 2, every vaccine; more than a run earns), smart 7/7 and idle 6/7 on the unit stages: the new lines apply without errors.
- Not balanced yet: Foot (smart loses it with any loadout), and late-build idle winning half the stages.

## Bot check (2026-10-10, Play V38 from releases/v38 at Normal, campaign pressure ramp on): Campaign V12

V38 adds the 1.3x between-wave drip with unannounced ebb and flow, stacked on the campaign's pressure ramp.
- No build, 2 seeds per stage: random 0/20, idle 0/20, smart 18/20 (loses Foot 0/2).
- Late build (~2000 Samples), 1 seed: idle 5/10 (wins Finger, Ear, Nose, Neck, Belly), smart 10/10.
- So: idle with a late build still wins half the stages. Still flagged not balanced yet.

## Bot check (2026-10-10, Play V34 from releases/v34 at Normal, campaign pressure ramp on, 2 seeds per map)

- Random mashing loses every map with no build and with a late build.
- With no upgrades: idle loses every map. Smart wins 17 of 20 runs: both seeds everywhere except Foot (0/2) and Lip (1/2).
- With a late build (about 2,000 Samples), doing nothing still wins 6 of 10 maps (Finger, Elbow, Ear, Nose, Neck, Belly). Flagged as not balanced yet. Options: a steeper ramp, weaker upgrades, or upgrades that only pay off with active play.
- First-clear Samples match V27 onward (Finger 251, Nose 356), so the shop prices still fit.
- One pass of `check.js all` takes about 7-11 minutes on V34 (slower waves, longer fights).
- Bots run at Normal. build.py gives the campaign its own `cytostormCampaign.difficulty` key, so a difficulty picked in Play on the same site doesn't carry over.

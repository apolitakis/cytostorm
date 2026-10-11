# Campaign features brainstorm

Written 2026-10-10 for Alex ("take stock of the campaign experience and brainstorm what campaign features could be added"). Discussion only, nothing built here. Based on Campaign V11 (on Play V36), campaign/src, notes/campaign-brainstorm.md, the Campaign Planner's bot data (tools/campaign-sim/model.json, fitted on V34, still rough) and the design doc's parked ideas (pp. 12-13).

Already in progress, so not proposed here: the Normal/Hard pick, the one-time goal intro, 3 save slots, the between-wave drip, postgame charts.

**Decisions (Alex, 2026-10-10 17:09):** loves all the friendly unit suggestions and wants **one new unit per campaign stage** (table in section 2). QoL: **yes** to the loadout warning (1b), treatment cards that say what they'd do on this stage (1c) and shop undo until Start (1d); the germ preview (1a) was already routed at 17:05. **Not right now:** the loss screen (1e).

**Revised 17:05 after Alex's reply:** Alex wants quality-of-life improvements first (for example, a proper preview of the next stage's germs), and more friendly units to make the loadout interesting, rather than reworking upgrades. Sections 1 and 2 are the new focus; the first pass's other ideas are kept at the end.

## Where the campaign stands

**What works**
- The loop is clean: body map, then the Clinic, then the fight, then Samples. The Clinic opening one tab per stage (Shop at 2, Treatment 3, Vaccines 4, Loadout 5) teaches it without a wall of text.
- Samples can't be farmed (capped at what a map sends in, storm kills pay 0, replays pay a quarter).
- Treatments are real tradeoffs on one map. Losing a stage costs a retry, never the run.
- The win screen already has a "Next: <stage>" button straight into the next Clinic.

**What's thin**
1. **The next stage's germs are hard to read.** The Clinic's "Coming in" row is small icons only. Their names are hover tooltips, which a phone never shows. Nothing says what each germ does, what beats it, when it shows up, or whether you've vaccinated it. The body map rows show only the germs that are new.
2. **The loadout is never a choice.** There are 2 specialist slots and only 2 specialists (Net, NK), so every stage brings both.
3. **Some upgrades barely register.** In the planner's bot data, Wide nets and Hardy NK cells made no measurable difference. (This is what the first pass's "dead ones get merged" meant: fold those two into one upgrade you'd actually notice, or cut them. Parked per Alex's reply.)
4. **Late-build idle play still wins 6 of 10 stages.** New units won't fix that on their own; it stays a balance item.

## 1. Quality-of-life, best first

### 1a. A real "Coming in" preview (Alex's example)
On the Clinic, replace the icon row with one compact card per germ in the stage:
- Its art and **name**, with a **New** tag the first time you meet it.
- **One line on what it does** ("hides inside your neutrophils and bursts out later").
- **What beats it**, with the unit's icon ("NK cells pop infected cells"). If that unit isn't in your loadout, the line turns amber: "not in your loadout".
- **When it shows up**, from the stage's wave list: "from the first wave", "waves 3 and 5", "the final wave".
- A **Vaccinated** tick if you've bought its vaccine.
- Tapping a card opens that germ's page in the existing guide.

The body map's stage rows show every germ in the stage (vaccinated ones ticked), not just the new ones. Everything the cards need is already in the code: the level's waves list times and counts, and the guide has the text.

### 1b. Counter check in the Loadout tab
When the next stage has a germ whose counter you didn't pack, the Loadout tab says so in one line: "Herpes is coming: NK cells beat it." It never blocks Start. Matters more once there are more units than slots (section 2).

### 1c. Treatments say what they'd do here
Each treatment card names this stage's germs it affects: "Antivirals: stops Herpes hiding here", or "Nothing here for it to treat". Today you have to cross-reference the germ list yourself.

### 1d. Undo in the shop
Anything bought on this Clinic visit can be refunded until you press Start. There's still no respec, but a mis-tap on a phone shouldn't cost the campaign.

### 1e. A loss screen that says what went wrong
On Host failure: which organ failed and which germ filled its breach clock, plus one Clinic hint ("A Staph vaccine or Antibiotics would help here"). Information only; the stage itself never changes.

### 1f. Smaller ones
- Upgrades for a unit you didn't bring are greyed with "not in your loadout".
- "Restart stage" in the pause menu (pays like a loss: a quarter).
- When the patient recovers, one summary card: stages, retries, Samples earned, the build you finished with.

## 2. New friendly units for the loadout

The rule for every one: a cell you **make** from the sector cards like the others, never steer, with no button to press during the fight. Each has a clear job, a counter it's best at, and a cost. The campaign's loadout keeps 2 specialist slots, so with 5 specialists every stage from 5 on is a real pick. All of these need sim work in the main game, so they go through "Build the web prototype", and they'd appear in Play and Sandbox too.

### B cells (antibody clouds), recommended first
- **What it does:** a slow cell that sits back and puffs an antibody cloud every few seconds. The cloud drifts with the flow. Germs it touches get **tagged**: macrophages swallow tagged germs twice as fast, MRSA becomes swallowable, and tagged germs **stick to each other** into heavy clumps that roll slowly.
- **Best against:** MRSA (finally a second answer besides Support rings), Flu swarms and Strep chains (clumps are perfect for a Net or the storm).
- **Cost:** it kills nothing itself, so every cell spent on it is a shooter not made. It only pays off with macrophages and Nets around it.
- **Why it's fun:** physics. Germs colliding and clumping into rolling balls is exactly the "chaotic colliding cells" Alex likes.
- **Biology:** right. Antibodies really do tag germs for eating (opsonize) and glue them together (agglutinate).
- **Unlock:** Stage 2 (Elbow), the MRSA stage. The art already exists (antibody, antibody-cloud, bacterium-opsonized).
- **Overlap with vaccines:** a vaccine permanently tags one kind everywhere; B cells tag everything, locally, only while you pay for them. They stack.

### Platelets (clot walls)
- **What it does:** platelets drift to the downstream edge of their sector and stick together into a wall across the flow. Germs pile up against it and chew through (each platelet has some health). Neutrophils shoot over it. A full wall across the Wound seals it: the trickle halves while it holds.
- **Best against:** Strep chains (rushers), the Clostridium hatch, the Tapeworm's crawl.
- **Cost:** the wall slows your own cells crossing it, platelets are fragile alone, and they kill nothing.
- **Why it's fun:** the Wall-nut of Cytostorm, and the biggest physics spectacle on the list. A packed crowd behind a wall sets up Nets, B cell clumps and the storm.
- **Biology:** right (immunothrombosis: clots really trap bacteria).
- **Unlock:** Stage 5 (Knee), the spore-hatch stage, so the first loadout pick is real.
- **Risk:** many stuck-together bodies may be slow on an iPhone. Needs a performance check first.

### Eosinophils (sticky bombers)
- **What it does:** ignores small germs. Latches onto anything big (Tapeworm segments, Candida threads and yeast, slime domes), pulses for a few seconds, then pops for heavy damage.
- **Best against:** the Tapeworm boss and Athlete's foot. Gives the finale a counter unit instead of "everything at once".
- **Cost:** useless against swarms; a stage without big targets wastes the slot.
- **Biology:** right for worms (eosinophils are the anti-parasite cells), a slight bend for fungus.
- **Unlock:** Stage 6 (Foot).

### Regulatory T cells (calmers)
- **What it does:** kills nothing. While some are alive, fatigue builds more slowly and overload hurts organs less, but your other cells fire and swallow a little slower.
- **Best against:** Toxic-shock Staph (which doubles fatigue) and long fights. It's the only unit that protects the body instead of fighting germs, a different kind of pick.
- **Biology:** right; Tregs exist to dampen the immune response.
- **Unlock:** Stage 8 (Neck), the Toxic-shock stage.
- **Caveat:** close to the Steroids treatment. Steroids is the strong whole-stage version paid in production; Tregs are a small one you build up. If that feels like the same card twice, drop this one.

### Dendritic cells (couriers)
- **What it does:** grabs a sample from the nearest germ and walks it down to the Lymph node on its own. If it arrives, every cell does more damage to that germ kind for the rest of the stage.
- **Why it's fun:** it's watchable, a little VIP you protect only by what you build around it. (It's immunity developing inside one map, which Alex was less into on 2026-10-07; Alex approved all units on 2026-10-10.)

### One new unit per stage (Alex, 17:09)
Alex wants one new unit per campaign stage. Stage 1 keeps neutrophils and macrophages, so stages 2-10 need 9 specialists: Net and NK as now, the five above, and two more (Interferon cells and Mast cells, below). Each one arrives on the stage whose new germ it answers best.

| Stage | New germ | New unit | Why it fits |
|---|---|---|---|
| 2 Elbow | MRSA | B cells | Tagging makes MRSA swallowable |
| 3 Ear | Pseudomonas | Eosinophils | Latch onto slime domes and pop them (later fungus threads and the Tapeworm) |
| 4 Nose | Influenza | Net neutrophils (as now) | Nets wipe swarms |
| 5 Knee | Clostridium | Platelets | The wall holds the spore hatch rush |
| 6 Foot | Candida | Dendritic couriers | A sample walked to the Lymph node makes every cell hit that germ harder for the rest of the stage |
| 7 Chest | Tuberculosis | NK cells (as now) | Only NK kills infected macrophages |
| 8 Neck | Strep, Toxic-shock Staph | Tregs | Calm the fatigue that Toxic-shock doubles |
| 9 Lip | Herpes | Interferon cells | Cells near them can't be hijacked |
| 10 Belly | Tapeworm | Mast cells | "Weep and sweep": mucus slows the worm's crawl |

**The two new ones:**
- **Interferon cells** (plasmacytoid dendritic cells). Kill nothing. Each gives off an interferon haze: your cells inside it can't be hijacked by Herpes, and viruses in it split more slowly. Cost: no damage, and the haze is small. Biology: right; interferon is the body's antiviral alarm. It prevents infection, while NK cells clean it up afterwards, so the two stack.
- **Mast cells.** Sit where they're made. When a big germ comes near, they release histamine and mucus: the flow in their sector slows (the Tapeworm crawls at half speed) for a few seconds, and your own cells there slow too. Biology: right; "weep and sweep" (mucus plus gut contractions) is how the gut fights worms.

**Loadout:** keep 2 specialist slots, so the production cards never show more than 4 units on a phone. With a new specialist every stage, a pick is needed from Stage 4 (3 specialists for 2 slots), so the Loadout tab should open at Stage 4 instead of 5. Default: Shop 2, Treatment 3, Loadout 4, Vaccines 5.

**Play:** each Play level adds the unit that level introduces, so Play and the campaign stay in sync. Play has no loadout, so later levels keep their current lists plus their own new unit, not all nine.

**Build order (default):** in stage order, a few at a time, so each batch can be bot-checked: B cells and Eosinophils, then Platelets (after an iPhone performance check) and Dendritic couriers, then Tregs, Interferon cells and Mast cells. Each unit needs sim work and a production card (build thread), a sprite (art thread; B cells already have art), a guide entry, and one shop upgrade line in the campaign.

## Kept from the first pass, lower priority now

- **Upgrades with a catch:** give the always-on boosts a cost, like treatments, so builds become styles and idle play stops winning late. Parked; the late-build balance is still open.
- **The patient's chart:** a one-line case note per stage, a few fixed host conditions ("pulled an all-nighter: fatigue tiers start 10 earlier", the parked "host behavior events", p. 13), and healed marks on the body map.
- **Germs come back changed:** a later stage brings back a drifted strain that an old vaccine only half covers (parked "memory library", p. 13).
- **A fork in the route:** at two or three points pick one of two wounds. Limited by the teach-one-germ-per-stage order.
- **Later:** a second patient (parked "host's lifetime": infancy with a borrowed vaccine, old age with slower cells), harder patients after a win.

## Considered and skipped

| Idea | Why not |
|---|---|
| Bonus objectives per stage for extra Samples | Stars by another name |
| Random events during a fight | Uninteractive, and adds a thing to watch |
| A random shop with rotating offers | Makes builds luck-driven |
| Antibiotics that breed resistance across the campaign | Campaign-long treatment costs are out |
| Easier stages after repeated losses | Rubber-banding |
| Carrying Samples or upgrades into the next campaign | Cross-campaign meta power |
| Killer T cells as a unit | Too close to NK |
| A unit you place or aim | The player controls what gets made, never where |

## Who builds what

- Section 1 (Clinic, loadout tab, loss screen, shop undo): the campaign's owner, "Immune mechanics brainstorm" (campaign/). 1a and 1b need no main-game change.
- Section 2 (new units): "Build the web prototype" for the sim and production cards, the art thread for sprites (B cells have art already), then the campaign picks them up in the loadout.

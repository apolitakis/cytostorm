# Mechanics brainstorm: more immune ideas, judged on fun

Written 2026-10-07 for Alex's ask: "a more extended brainstorm on other potential mechanics with immune inspiration but an eye toward being fun."

**Alex's verdict (2026-10-07 17:21):** many of these work better as buffs that persist across a campaign than as in-map mechanics. Not keen on immunity developing during a single map. Likes the loadout, and persistent upgrades bought with currency from kills. Follow-up design is in notes/campaign-brainstorm.md.

This builds on what's already designed (the 10-antigen roster, Net and NK, the storm, Toxin load, the parked organ leakers, and the reproduction ideas being tried in the workshop) and doesn't repeat them. Everything is framed for Cytostorm as it is now: tower defense, "Plants vs Zombies but immune system", where you choose what gets made and never where it goes.

## Short answer: my top five

1. **Antibodies kick in.** The lymph node learns each antigen as you fight it, then you pick one antibody power and the tide turns. This gives a match its arc, and it's the biggest thing the game is missing.
2. **Pathogens evolve against you.** Whatever kills an antigen most, its next wave resists. That's the "dynamic counter system", and it rewards switching your mix instead of finding one setting.
3. **Antibiotics.** One or two pill charges per level that flush bacteria, but whatever survives comes back resistant. A panic button that costs you later instead of now.
4. **Clot walls.** Make platelets and they stack into a physical wall the enemy piles up against. The Wall-nut of Cytostorm, and a physics spectacle.
5. **Loadout before a level.** Like picking seed packets in PvZ: see what's coming, pick which cells you bring. Keeps the production cards small on a phone as the roster grows.

1 to 4 can each be a workshop toggle. 5 waits until there are more unit types than fit on a card.

## How I judged them

An idea scores well if it does most of these:

- **Makes you change something mid-match.** The best fights in v3 are the ones where you flip a zone's mix. Ideas that cause more of that win.
- **Works through what you make**, not where things go.
- **Shows up on the battlefield**, readable in a glance on a phone. No new meters beyond fatigue and toxin (the two-things-to-watch rule).
- **Creates a moment**: something you'd tell a friend about ("my own neutrophils turned on me", "the antibodies came in just in time").
- **Adds chaos with a lever attached.** More stuff on screen is good if you can do something about it.

Biology is the seasoning, not the test. Each idea notes what it's riffing on.

---

## Tier 1: the big ones

### 1. Antibodies kick in (the adaptive response)

**Riffing on:** for the first few days your innate cells (neutrophils, macrophages) hold the line alone. Meanwhile the lymph node studies the invader and B cells start mass-producing antibodies made for exactly that germ. Then the infection collapses.

**How it plays**
- Each antigen kind already has a marker on the progress bar. Now each marker also fills up as the lymph node "learns" that kind.
- Learning comes from two places: macrophages in Offense swallowing it (they show the lymph node what they ate), and that kind dying inside the Lymph node zone.
- When a marker fills: a short fanfare, the lymph node swells and glows, and gold antibody clouds start drifting out with the flow. Every antigen of that kind they touch gets **tagged** (a gold rim).
- **The first time any marker fills, you pick one antibody power for the match.** One tap, game paused, three or four cards:

| Power | What tagged antigens do | Good against |
|---|---|---|
| Opsonize | Get swallowed twice as fast. MRSA becomes swallowable | MRSA, toxin-heavy levels (clean kills) |
| Agglutinate | Stick together into heavy clumps that roll slowly | Flu swarms, Strep chains; Nets and storm wipe a whole clump |
| Complement | Pop on their own a few seconds after tagging | Anything, fast, but every pop is messy (toxin) |
| Neutralize | Can't hijack cells or split | Herpes, Measles, Flu splitting |

**Why it's fun**
- It gives every match a shape: hold the line, then turn the tide. The early scope note called this out as the payoff the game needed, and v3 doesn't have it yet.
- It gives Offense macrophages a second job (teaching), which pulls against Support and against TB, where swallowing is a trap. The zone-mode choice gets richer without a new control.
- The power pick is a real decision against the level's mix, and it's the "antibody choice" from v1 brought back as one quick, readable moment instead of a menu.
- Real immune fights are blowouts, which fits Alex's balance rule: once antibodies land you should feel powerful.

**Risks:** it can snowball. Late waves need to still bite, which is what Evolution (next) and the antigen-per-level escalation are for. The learning speed is the main tuning knob.

**Variant:** a **dendritic cell courier** you can make in the Wound. It grabs a sample and runs the gauntlet to the Lymph node on its own. If it makes it, that marker jumps forward a big chunk. It's a little VIP you can't steer, so your only way to protect it is what you build around it. Very watchable.

### 2. Pathogens evolve against you (the dynamic counter system)

**Riffing on:** selection pressure. Whatever kills most of a population, the survivors resist it. It's how MRSA exists.

**How it plays**
- The game quietly tallies how each antigen kind is dying: shots, swallows, Nets, storm.
- At each wave marker, if one method did most of the killing (say over 60%), the next wave of that kind arrives with a counter-trait, announced by a banner ("Staph evolved: thick wall") and visible on the sprite.

| If you mostly kill it with | It evolves | Looks like |
|---|---|---|
| Shots | Thick wall: plain shots do half | Doubled outline |
| Swallows | Capsule: takes two gulps | Shiny slime coat |
| Nets | Loners: stop clumping | Spread out, darting |
| Storm | Hardy: a third survive storms | Dark core |

- Cap it at two traits per kind per level, so it never runs away.

**Why it's fun**
- It makes you change your mix every few waves, which is the core decision of the game, instead of settling on one setting and watching.
- It rewards mixed strategies: if no single method dominates, nothing evolves. So it widens the set of winning strategies rather than narrowing it, which is what Alex wants from high difficulty.
- It isn't rubber-banding. It reacts to *how* you play, not to whether you're winning; a strong player and a weak player both get it.
- It makes stories: "I was crushing it with Support rings and then they grew capsules."

**Risks:** it feels unfair if it's a surprise. The banner has to land before the wave, and the trait has to be visible on the sprite. A small "pressure" tick on each progress-bar marker could hint it's coming.

**Boss version (later):** a **Trypanosome** that swaps its coat color every 20 seconds, shedding any antibodies stuck to it. Only works once Antibodies (idea 1) exist.

### 3. Antibiotics (outside help with a price)

**Riffing on:** medicine, and the most famous immune-adjacent lesson there is: overuse breeds resistance.

**How it plays**
- Each level gives you one or two pill charges (the PvZ lawnmower or Plant Food slot).
- Tap the pill: a capsule drops into the Wound and dissolves into a cloud that drifts down the flow over about 10 seconds, killing most bacteria it touches.
- It does nothing to viruses, spores, parasites, or bacteria under a Pseudomonas dome.
- **The price:** any bacterium that survives the cloud becomes resistant, armored like MRSA. Pill too early, while the crowd is thin and spread out, and the stragglers become a wave of tanks.

**Why it's fun**
- It's a panic button with a different shape from the storm: no fatigue cost now, a nastier enemy later. Two panic buttons with different costs is a decision, not redundancy.
- The best time to use it is when bacteria are packed (behind a clot wall, or agglutinated), which links it to other ideas.
- It's a safety net that makes the early levels kinder for friends who are new to the game, without lowering the difficulty for anyone who doesn't use it.
- It's funny and true, which is the tone the game already has.

**Risks:** overlap with the storm. Keep them clearly different: the storm hits everything instantly and costs you now; the pill is bacteria-only, slow, and costs you later.

**Siblings, if pills land:** a **vaccine** (between levels, start one antigen's marker already full) and **ibuprofen** (fatigue drops 20, but your cells slow for 10 s, because fever helps you fight).

### 4. Clot walls (platelets)

**Riffing on:** platelets plug a wound, and clots really do trap bacteria in a mesh (immunothrombosis).

**How it plays**
- A new thing to make on a zone's production card: platelets.
- They drift to the downstream edge of that zone and stick to each other, building a wall across the flow, one small physics body at a time.
- Antigens pile up against it and chew through (each platelet has some HP). Your neutrophils shoot over it.
- A complete wall across the Wound "seals the wound" and halves the trickle while it holds.
- **The price:** the wall also slows your own cells crossing it, and every slice of production spent on platelets isn't spent on shooters.

**Why it's fun**
- It's the most PvZ thing on this list: a cheap holding tool that buys time, here for the antibodies to arrive.
- Physics pile-ups are a spectacle, and they set up combos: a packed crowd behind a wall is perfect for a Net, the storm, agglutination or a pill.
- It gives Strep chains, which sprint, something to slam into, and the Tapeworm something to chew through.

**Risks:** many linked bodies may cost performance, and walls could make levels too easy if they're cheap. Platelets should be slow to build and fragile alone.

### 5. Loadout before a level (seed packets)

**Riffing on:** less biology, more PvZ. Before each level the lawn shows which zombies are coming and you pick your plants.

**How it plays**
- The level intro shows the antigens coming (the progress bar markers, bigger).
- You pick three or four cell types to bring (from neutrophils, macrophages, Net, NK, platelets, eosinophils, dendritic couriers...). The production cards then only show those.
- Neutrophils and macrophages could be always-in, with two or three flexible slots.

**Why it's fun:** it's a planning puzzle you solve before the chaos starts, when you have time to think, and it's where knowing the counters pays off. It also keeps each production card short on a phone screen.

**When:** once there are more unit types than fit comfortably on a card. Today there are four, so not yet.

---

## Tier 2: good adds

Shorter write-ups. Each would be a new antigen, unit or level twist.

**Quorum sensing (enemy behavior).** Bacteria in a dense group glow brighter as the group grows. When a group hits a quorum (say 12 together) they all flip at once: toxin spike, armor up, or start a dome. You see it building and thin the crowd before it flips. Nice tension with Agglutinate and clot walls, which pack bacteria together on purpose. *Riffing on: real bacteria count each other with chemical signals and switch on attacks only when there are enough of them.*

**Eosinophils (sticky bombers).** A specialist unit for parasites. They latch onto anything big (the Tapeworm, future worms) and blink, then pop for heavy damage. A boss covered in blinking stickers is a great image, and it gives the boss level a counter unit instead of "everything at once". *Riffing on: eosinophils really are the anti-worm cells.*

**Fungus (Candida).** Grows hyphae, thin threads that creep across zones like Zerg creep. Bacteria travel faster along them. Hyphae are too big to swallow and shrug off shots; only Nets cut them. That gives the Net a second job besides flu. *Riffing on: this is real; neutrophil nets are a main defense against fungal threads that are too big to eat.*

**Phage bloom (a chaotic ally).** A level event or reward: tiny spider-like phages appear and hop from bacterium to bacterium; each kill releases more phages. A chain reaction you didn't make but can feed (more bacteria alive means a bigger bloom). They fizzle when bacteria run out. Pure fun to watch. *Riffing on: bacteriophages, viruses that only eat bacteria.*

**Allergy season (a restraint level).** Pollen drifts in and is harmless, but every shot spent on it adds fatigue and builds a histamine surge that slows your cells. The answer is to make fewer neutrophils in the zones pollen drifts through and lean on macrophages, who ignore it. A one-level twist, not a system. It revives v1's Pollen scenario with today's controls. Restraint levels are rarely fun for long, so once is enough.

**Cough (a physics button for the Lungs and Sore throat levels).** A level-specific button that blasts everything in a zone back upstream, your cells included. Long cooldown. Shoving a hundred bodies at once is the kind of physics joy the game is built for. Sneeze for a nose level is the same thing.

**Swarm frenzy.** When a neutrophil dies, the ones near it get a short rage boost (faster, firing more, red tint). Last stands turn heroic and the screen gets wilder exactly when things go wrong. No UI, no decision, just feel. *Riffing on: real neutrophils release a "swarm here" signal that pulls others in.*

**Pus.** Dead neutrophils leave yellow debris that slows everyone and piles up physically. Macrophages in Support could clean it. Gross in a way players will love, and it makes a long fight look like a long fight. Risk: clutter that hurts readability, so it should fade.

**Patients (cheap level variety).** Each level is a patient with one twist on a card: "Marathon runner: fatigue recovers fast", "Grandpa: marrow is slow but macrophages are tough", "Smoker: Lungs zone starts gunked up". One rule tweak per level makes old antigens feel new without new code paths.

---

## Tier 3: juice (cheap, mostly feel)

- **Heartbeat.** New cells arrive in pulses on a heartbeat. The heart rate (and the music's tempo) rises with Body output and fatigue. You start to *hear* your fatigue, which helps the two-things-to-watch rule more than any meter.
- **Swelling lymph node.** It visibly grows as antibodies ramp up. Progress you can see without a bar.
- **Callouts and combos.** "Gulp ×5", "Net: 23!", "Storm: 140". Small numbers popping up turn chaos into score.
- **Star rating.** Stars for a clean win (low fatigue, low toxin, no storm), so replaying a level has a goal.
- **Body map level select.** The campaign screen is a body silhouette with levels pinned on it (fingertip, throat, lungs, gut). Cute, cheap, and it explains the setting instantly.

## Tier 4: between levels (for the Campaign)

- **Immune memory.** Beat a level and its new antigen goes into your memory. Next time it shows up, its antibody marker starts half full. Progression that's also the real biology of why you rarely catch the same thing twice, and a natural easing for replays without rubber-banding.
- **Bestiary.** A page per antigen with its look, trait, counters and a funny line, unlocked when you first beat it. PvZ's Almanac; collection is fun on its own.
- **Scars** (option C in the organ brainstorm) pair well with memory: a messy win leaves a scar, a clean one leaves nothing. Still parked until there's a campaign.

---

## What I'd skip

- **Cancer (your own tissue turning rogue).** Slow and creeping; it wants a different game. NK cells already cover "find the hidden thing".
- **Malaria coming out of the blood vessel.** Making your own spawn line dangerous is confusing to read.
- **Inflame a zone.** It's zone calling by another name, and Alex prefers controlling what gets made, not where.
- **Killer T cells as their own unit.** Too close to NK. If they come back, they're part of the antibody era, not a fifth card.
- **Good gut bacteria you mustn't shoot.** Friendly fire with no aiming is frustrating. Allergy season covers restraint better.
- **Brain fog (sliders drifting on their own).** Unfair on a phone. It was already a maybe-once-for-a-boss idea.

---

## How the top ones fit together

A sample run of Hospital visit (Staph and MRSA) with ideas 1 to 4 switched on:

1. **Early:** Staph trickles in. You put some platelets in the Wound card; a wall starts forming. Macrophages on Offense swallow Staph and teach the lymph node.
2. **First wave:** a crowd piles against the wall. You were mostly shooting, so a banner says "Staph evolved: thick wall".
3. **MRSA arrives:** tough and unswallowable. The Staph marker fills and you pick **Opsonize**, because it makes MRSA swallowable.
4. **Crisis:** a big wave plus thick-walled Staph pressing on the wall. You could storm (fatigue now) or pill (resistant stragglers later). You pill, because they're packed against the wall and few will survive it.
5. **Payoff:** gold antibody clouds roll down the flow, macrophages gobble tagged MRSA, the lymph node glows. Final wave, mop-up.

Every step there is a decision made through production, and none of them adds a meter. The only things to watch are still fatigue and toxin.

## Suggested order to try

1. **Antibodies kick in** in the workshop first, since it changes the shape of every match and the other ideas lean on it. Bots should show it doesn't make the idle or random player win.
2. **Evolution**, once antibodies are in, so late waves stay hard after the tide turns. Bot check: a mixed-strategy bot should trigger it least and do best.
3. **Antibiotics**, a small add once 1 and 2 feel right.
4. **Clot walls**, after a quick performance check on many linked bodies on an iPhone.
5. Loadout, immune memory and the bestiary wait for the Campaign card on the hub.

Tier 2 ideas slot in as one new thing per level, the same rule the roster follows.

## Questions for Alex

1. Antibodies kick in: **workshop it** (recommended) or later?
2. The antibody power pick: **once per match** (recommended) or every time a marker fills?
3. Antibiotics: **in** (recommended) or out?
4. Any Tier 2 idea you'd want as the next new antigen? My pick: **Fungus**, since it gives Nets a second job.

---

## Build notes: Fungus and the heart meter (Alex asked to build both, 2026-10-07 17:26)

Being built into v3 by "Build the web prototype". These are suggestions from the brainstorm thread; the builder decides.

**Fungus (Candida)**
- New antigen: a yeast cell (round, budding, about 4 hits, swallowable while it's loose).
- After a few seconds in the Wound or Tissue it settles and sprouts a **hypha**: a thin thread growing downstream toward the Lymph node, wiggling and sometimes branching, up to a max length. Once sprouted, the root becomes part of the thread.
- **Highway:** antigens touching a thread drift along it about 2 to 3 times faster toward the Lymph node. That's the threat.
- **Spreading:** thread tips bud off a new yeast every so often.
- **Counters:** shots pass straight through threads. **Net neutrophils cut them**: a net bursting on a thread kills every segment in its radius, and anything cut off from the root withers. Nets should count thread segments when picking the thickest crowd, so they go for threads. Fallback: Offense macrophages chew threads slowly, a few segments per gulp (like domes). The storm doesn't touch threads.
- Level idea: "Athlete's foot", after Soil cut, units Neutrophils, Nets, Macrophages. Blurb: "Fungus grows threads toward the Lymph node and germs ride them like a highway. Shots can't touch the threads. Nets cut them; macrophages chew them slowly."
- Toxin load (workshop): fungal kills could count like Pseudomonas (+5).

**Beating heart fatigue meter (Alex's spec)**
- Replace the fatigue bar with an animated beating heart that **beats faster** and **fills up with increasingly scary colors** as fatigue mounts.
- Suggested: heart rate from about 60 bpm at 0 fatigue to about 180 at 100; fill rises from the bottom; colors per tier: Fine calm pink-red, Tired orange, Feverish hot red, Exhausted dark purple-black with a flicker. An irregular, skipping beat near 100.
- Keep the storm ghost preview: while the storm button is held, show where the fill would land (a pale outline level), and during the afterburn make it pound.
- The heartbeat could also pulse the screen edge and drive a sound later (the brainstorm's "hear your fatigue" idea).

# Organs under fatigue: proposal

Started 2026-10-07 from Alex's question: would it be fun if fatigue hit specific body systems (kidneys shutting down separately from keeping food down, and so on), or would that spiral into complexity? Last updated 2026-10-07 23:20 to match the work in the "Build the web prototype" and "Antigen types and counters" threads.

**Owners.**
- The main game's organ rules: `notes/organ-levels.md`, owned by Build the web prototype. It's the source of truth for the five organs and their bars, so this file doesn't repeat its numbers.
- Toxin (Sandbox only), the leakers and the Sandbox: owned by Antigen types and counters (`workshop/README.md`).
- This file: the design picture, the open questions and the parked ideas.

## Where it stands

### In the main game (being built now)

Alex approved these at 22:44 to 22:51 in Build the web prototype:

- **Five organs, 4 bars each:** heart, kidneys, lungs, liver and spleen. Each whole bar lost steps up that organ's penalty. Alex's rule is that **every penalty hits every unit**, so you can't dodge it by making a different cell type.
  - **Heart:** caps Body output.
  - **Kidneys:** slow fatigue recovery.
  - **Lungs:** slow every cell.
  - **Liver:** slows cell production.
  - **Spleen:** lowers the total cell limit.
- **Overload replaces the storm insta-death.** Fatigue can go past 100 (up to 150). While it's over 100, every organ loses health each second, faster the further over you are, and the heart takes it hardest. You also shed fatigue 4x faster up there, so you can push into overload in a dire moment and climb back out.
- **Any organ at 0 bars is Host failure.** Alex picked this over "both organs fail" and "never lose". "Host failure" is the cold, clinical name for the whole-body loss.
- **Healing:** the liver and lungs regain a bar every 60 s while you're Fine. The heart, kidneys and spleen don't heal during a match.
- **Exhausted** now only shrinks Support rings. It no longer slows production.
- **Body view (Alex, 22:19):** a small organ button under the heart shows a compact summary. Tapping it pauses the game and opens an Organ status window, which lists every penalty and buff the organs are causing right now.
- **Art:** art kit v8 has heart, lungs, spleen, liver and kidneys, each in healthy, strained, damaged, failing and failed states. That's one look per bar count.

### In the Sandbox (Version 17, being re-forked onto the main game's organs)

- **Decision (Alex, 23:14): Toxin load stays in the Sandbox and isn't planned for the main game.** It's "too hard to follow" with all the other systems in play. In the main game, the kidneys set how fast fatigue recovers, which Alex finds the more elegant version. Everything about toxin below is Sandbox-only.
- **Toxin load** works the way Alex asked at 21:36 and 21:37.
  - Messy kills (shots, Nets, the storm) add toxin. Swallows and viruses add none.
  - Clearance is proportional to the load, like a half-life: about 0.5 s rested and about 4 s at fatigue 100.
  - Toxin above a safe level of 25 feeds the heart. Rested play barely notices it, at 1 to 3 fatigue per match, and it bites near Exhausted.
  - With organs on there's no toxin bar. Toxin shows as the vessel's green tint and a thin strip on the organ button.
- **Leakers:** Hepatitis hurts the liver and E. coli hurts the kidneys. They skip the Lymph node and swim across a zone into the blood vessel. In the Sandbox, shooting E. coli dumps toxin and swallowing it doesn't.
- **After the re-fork,** the Sandbox drops its own organ health and hooks into the main game's.
  - Each leak becomes about half a bar.
  - Sandbox only: toxin over 40 costs the kidneys about 0.04 bar per second, and toxin clearance reads the liver and kidneys' bars.

### Still true from the original brainstorm

- **Two things to watch in a match:** the heart and the Lymph node timer. The organs live in the button and the pause window, not in always-on meters, and they only change on overload and breaches (plus high toxin, in the Sandbox only). This is how five organs avoid the "full dashboard" problem the brainstorm warned about. They're readable when you want them, and you're never forced to watch them.
- **Every organ responds to a lever you already have.** Body output drives overload. How fast you clear the Lymph node drives the breach clocks. The production mix in the zones leakers cross decides how many get through.
- **Lost with toxin:** the kill-clean versus kill-fast choice was the reason to favor Offense swallowing. Without toxin, Offense mode stands on its own counters (MRSA can't be swallowed, Pseudomonas domes, Candida tips). That seems fine, but worth watching in playtests.

## Open questions (my recommendations)

1. **Can a leak or toxin cause Host failure?** *Settled by the breach clocks below (23:03).* Breaches are now the main way to lose, so any organ's clock can take its last bar, leaks included.
2. **Who clears toxin once it reaches the main game?** *Settled at 23:14: toxin isn't coming to the main game.* The Sandbox keeps its own 65/35 kidney and liver split.
3. **Lungs and spleen damage sources.** Today only overload hurts them. Ideas from organ-levels.md: Influenza or TB reaching the Lymph node chips the lungs, and blood-borne germs chip the spleen. **Recommendation:** wait until the first two leakers feel right.

## Breaches hurt organs instead of ending the match (Alex, 22:59 and 23:03)

**Approved by Alex at 23:05 ("all great thinking. do it").** Build the web prototype builds it in v3, and the brain row goes into its organ-levels.md.

Alex's rules:
- Antigens that get through should **damage organs instead of ending the match on the spot**.
- Because antigens divide, it's about **one bar per clump, not per antigen**.
- **Every antigen harms exactly one clear organ.**
- **Different organs fill at the same time.** For example, Rabies and Hepatitis sitting in the Lymph node together damage the brain and the liver at once.
- **Add a brain** as an organ that takes its own damage.

### One breach clock per organ

- **Each organ has its own breach clock.** It fills while any antigen mapped to that organ is in the Lymph node, at today's speed (`lymph.fill`, 20 s to full).
- **Count barely matters.** Fill speed depends on how long the antigens sit there, not on how many there are, so division inside the node isn't punished per antigen. An optional small crowd bonus can fill it faster (x(1 + 0.1 per extra antigen), capped at 2x).
- **Clocks run side by side.** Staph and Herpes in the node together fill the spleen's clock and the brain's clock together.
- **When a clock fills,** that organ loses one bar and the clock resets to 0.
- **When an organ's germs are gone from the node,** its clock drains slowly (over about 60 s) instead of holding. A clump you clear fast costs nothing, and two half-cleared clumps close together cost about one bar.
- **Blood vessel leakers** (Hepatitis and E. coli dive into the vessel instead of heading for the node) use the same clocks. Each leak adds +25% to its organ's clock, so a clump of about 4 costs a bar. This replaces the separate "dose" rule.
- **Ignoring the node still loses.** An organ's 4th bar is Host failure. That's about 80 s of one organ's germs camping the node, compared with 20 s today, so the waves will need retuning.

### On screen (still two things to watch)

The single Lymph node ring becomes the breach display:
- While a clock is ticking, its organ's icon sits on the ring with its own small arc filling.
- Two germ types in the node means two icons filling side by side.
- When an arc fills, the icon cracks and a bar drops on the organ button.

Clocks at 0 are hidden, so a clean node looks exactly like it does today.

### Which organ each antigen harms

Every antigen harms one organ, picked from real disease links where one exists:

| Organ | Antigens | Real link |
|---|---|---|
| Brain (new) | Herpes, Clostridium, Measles (Sandbox), Rabies (new) | Herpes encephalitis; Clostridium is tetanus (soil cuts); measles brain damage; rabies |
| Lungs | Influenza, Tuberculosis, Pseudomonas | Pneumonia |
| Heart | MRSA, Toxic-shock Staph, Strep chains | Endocarditis, toxic shock, rheumatic fever |
| Liver | Hepatitis, Tapeworm | Hepatitis; tapeworm cysts settle in the liver |
| Kidneys | E. coli | Kidney infection |
| Spleen | Staph, Candida | Bloodstream infection; Candida can seed the spleen |

Staph is the most common antigen, so in early levels the spleen takes most of the hits. Later levels spread damage around as they add new antigens.

### The brain (6th organ, proposal)

Its job is coordination: how well your cells find and chase targets. Following Alex's rule, every penalty hits every unit.

| Brain bars | Penalty |
|---|---|
| 4 | None |
| 3 | All your cells wander 20% more (sloppier pursuit) |
| 2 | 40% more wander, and changes to the production mix take 3 s to kick in |
| 1 | 60% more wander, and delirium: the screen edges blur |
| 0 | Host failure |

- **Overload weight:** 0.5, so fever past 100 hurts it moderately.
- **Healing:** none during a match.
- **Art:** needs brain sprites in the same 5 states as the other organs, plus a Rabies sprite.

**Rabies** isn't designed yet. Its hook is to fill the brain's clock twice as fast while it's in the node: it's rare, but you must not let it sit.

## Parked ideas

### Organ meds (Alex, 2026-10-07, design only)

Alex's words: "we could also have meds you can take that give a specific organ a buff for a fight at the cost of something else, like meds to make your heart work better at the cost of fatigue".

**The rule:** you take a med before the fight, in the loadout, with no new in-battle button. One organ works better this fight, and the cost lands on a different system **in the same fight**. Following Alex's penalty rule, buffs and costs hit every unit, not one cell type.

| Med | Organ | This fight | Cost (same fight) |
|---|---|---|---|
| Adrenaline (Alex's example) | Heart | Body output cap +0.25x, and lost heart bars don't lower the cap | Fatigue builds 30% faster |
| Diuretic | Kidneys | Fatigue recovery +50% | Every cell lives 15% shorter |
| Inhaler | Lungs | Lung slowdown ignored, cells +10% speed | The heart takes 50% more overload damage (racing heart) |
| Milk thistle | Liver | The liver heals a bar every 30 s and takes half damage | The kidneys take 25% more damage |
| G-CSF (a real immune booster) | Spleen | Total cell limit +30, cells made 10% faster | The spleen takes double overload damage (real side effect: enlarged spleen) |
| Dialysis (rescue) | Kidneys | The kidneys can't drop below 1 bar | Body output tops out at 1.5x |

**How it fits the campaign** (`notes/campaign-brainstorm.md`, owned by the mechanics brainstorm thread):
- **Meds share the one-treatment-per-map slot.** The Pharmacy gets two shelves. **Treatments** (antibiotics, antifungals, antivirals) are strong now and you pay over the rest of the campaign. **Organ support** (the meds) helps now and you pay now. Each map then asks one question: hit the germ and pay later, or prop up an organ and pay now.
- Steroids and Fever reducer in that file already work like organ support, since their cost lands on the same map. Moving them to that shelf is the campaign file owner's call.
- **In the Organ status window,** the active med shows as a pill on its organ, with its buff and its cost listed.

### Organ scars between maps

organ-levels.md says campaign scars come later, and they fit naturally now. Bars the heart, kidneys or spleen lose don't heal in a match, so they could carry into the next map as scars. The Clinic's Rest day heals one, and Antifungals leave a liver scar (as campaign-brainstorm.md already proposes). Meds like Dialysis or Milk thistle are how you play through a scarred organ.

### Organ power routing, FTL-style (Alex, 2026-10-07)

Alex's words: "FTL style system power up/down but for organs (so you can divert power from your liver to make your kidneys work better - i think this idea kind of rocks but it sounds really complicated for a phone game)".

**The worry:** FTL pauses and has room for a full systems panel, and a phone game mid-fight has neither. Routing power by hand is also close to directing units, which Alex dislikes.

**How it could fit now:** each organ already has an overload weight (how hard it's hit past 100 fatigue). The phone-sized version is a pre-fight **Shield** pick: choose one organ to take half overload damage while the others take a little more. It's a one-tap loadout choice that never comes up during the fight, and the meds above are the richer version of the same idea.

### Organ ideas not used yet

- **Bone marrow** (optional 6th): it overlaps with the liver's production penalty. If it's added, the liver needs a different job.

## How we got here (2026-10-07)

1. The brainstorm offered four options:
   - A: organ-named fatigue tiers.
   - B: Toxin load, a second meter with its own lever.
   - C: scars between maps.
   - D: a live organ dashboard.
   Alex picked B and parked the rest.
2. The first Toxin load spec used a linear drain and a bar. In the workshop, toxin per kill went 0.5 → 2, and a 1 s macrophage gulp made swallowing viable. On v3 the bar pinned at 100 and barely mattered, so it was reworked.
3. Alex reframed toxin as "pushing the immune system too hard wins the battle but loses the war": very fast clearance when rested, and clearance proportional to load. The Sandbox built that (Version 13), then retuned it to the tutorial clip's half-lives (Version 16).
4. Alex said "build it" to organ health. The Sandbox built the liver, kidneys and the two leakers (Version 15), the body view (Version 16), and folded the toxin bar into the organ button (Version 17).
5. Alex renamed the whole-body loss "Host failure" and asked for meds and FTL-style routing to be parked.
6. In Build the web prototype, Alex moved organs into the main game: overload past 100 instead of the storm insta-death, any organ at 0 is Host failure, 4 bars per organ, five organs, and every penalty hits every unit. That design is in `notes/organ-levels.md`, and it supersedes this file's earlier Sandbox organ spec. That spec lived here until 23:00 and is summarized in `workshop/README.md` (Version 15).
7. Alex designed the breach clocks and the brain and approved them at 23:05: per-organ clocks fill while that organ's germs sit in the Lymph node. At 23:14 Alex decided the main game stays toxin-free and Toxin load stays Sandbox-only.

# Toxin burst: alternatives, and the pick

Alex, 2026-10-08 11:28: the toxin burst is uninteractive. **Alex picked A, the Quorum burst, at 11:48**, with two changes:

- Pops also kill a lot of germs, the way the storm does, so a pop isn't something you can never recover from.
- Bursts come from a big bolus of germs arriving and getting off a group ability.

More germ group abilities will be brainstormed later. They stay germ-side, and the player gets no new button (Alex, 11:41).

## Spec for the build (tested in a scratch copy of v3 V25)

The scripted bursts go away: `LEVELS[k].toxins`, the rail diamonds and the "Toxin burst in N s" banner. In their place, every sector runs a quorum check.

- **Who:** Staph-family germs only (Staph, MRSA, Toxic-shock Staph). Germs under a slime dome don't count.
- **Quorum:** every 0.5 s, find each sector's densest Staph-family crowd, counting germs within 20 units of one germ. If that count is at least `quorum` (default **10**), the sector's crowd starts to glow.
- **Fuse:** the glow builds over **6 s**. If the crowd drops below quorum during that time, the glow resets. That's your window: Nets, more neutrophils in that sector, or Offense macrophages can break it up.
- **Pop**, centred on the crowd:
  - It kills every one of your cells within **100 units**. Macrophages die too.
  - It kills **half the germs within 20 units** of the centre, so the colony spends itself.
  - That sector then can't pop again for **15 s**.
- **Bolus:** fresh arrivals count. So a big Staph wave landing as a dense clump is what sets off a burst, and wave size is how a level authors it. Home-grown crowds can also pop if you let one grow.
- **Per-level knob:** `LEVELS[k].quorum` (default 10). Sore throat and Flu season use **18**.
- **Look:**
  - The crowd gets a steady purple halo in the toxin colour that thickens over the fuse. It must never strobe, because blinking means reproduction (Alex's rule).
  - The pop reuses the toxin shockwave art at the crowd, scaled to 100 units.
  - The rail badges a Staph wave big enough to reach quorum on arrival (12 or more Staph-family germs). This replaces the diamonds.
- **Hint line:** "Staph is crowding in the {sector}. Thin it before it pops." This replaces the burst countdown.
- **Knock-ons:**
  - Keep fx `burst` (now with `u, v`) for the shake, toast and sound. The Sandbox's layer.js adds toxin on `burst`.
  - Keep `killCell(c, 'toxin')` and `stats.toxinDeaths` ("cells lost to toxin").
  - The shutoff tutorial clip loses its reason; a quorum clip replaces that lesson.
  - The guide's "Toxin burst" entry gets rewritten.
  - Bots that read `toxins` or `pendingToxin()` need a look.
- Reference code: [quorum-burst-prototype.js](quorum-burst-prototype.js). It's a wrapper around `Game.step` used for the bot runs, not drop-in game code.

### Bot results (4 seeds per bot, all 10 levels)

| Setup | Doing nothing | Random | Smart | Gunner |
|---|---|---|---|---|
| Scripted bursts (today) | loses all 10 | loses all 10 | wins 8 (Pool 2/4, Lungs 2/4) | wins 7 |
| No bursts at all | **wins 6 levels** | loses all 10 | wins all 10 | wins 9 |
| Quorum burst, 60% germ kill over the whole pop | **wins 8 levels** | loses all 10 | wins all 10 | wins all 10 |
| Quorum burst as specced, quorum 10 everywhere | **loses all 10** | **loses all 10** | wins 8 | wins 7 |

- Killing germs across the whole pop handed idle play the win. That's why the germ kill only covers the crowd's core while the cell kill reaches 100 units.
- Doing nothing sees 6 to 12 pops a match. The smart bot sees about 1 on most levels, and none on Lungs.
- **Sore throat and Flu season are "not balanced yet."** At quorum 10 the smart bot lost Sore throat 4/4 and won Flu 2/4. At 18 (6 seeds) the results were:
  - Sore throat: smart 4/6, Support-heavy 6/6, gunner 0/6.
  - Flu season: smart 6/6, Support-heavy 6/6, gunner 4/6.
  - Idle and random lost both levels.
  - Sore throat's waves look heavy whatever the burst does (the gunner lost it with no bursts at all too). Flu season was already flagged.

## What's wrong with it today

- Every level has 1 or 2 bursts at fixed times (`LEVELS[k].toxins`, for example 100 s and 200 s). They show as diamonds on the rail and get a 6 s banner and a 2 s red flash. Then a shockwave kills every one of your cells in the Wound. Germs are unharmed.
- It happens the same way no matter how well you play. The only answer is to switch the Wound off before it hits, and even that doesn't save the cells already standing there.
- **It's doing real balance work, though.** I ran the bots on all 10 levels, 4 seeds each, with bursts on and off:

| Level | Doing nothing, bursts on | Doing nothing, bursts off |
|---|---|---|
| Pool water | 0/4 | **4/4** |
| Athlete's foot | 0/4 | **4/4** |
| Soil cut | 0/4 | **3/4** |
| Cold sore | 0/4 | **3/4** |
| Gut | 0/4 | **3/4** |
| Hospital visit | 0/4 | **2/4** |
| Papercut, Flu season, Lungs, Sore throat | 0/4 | 0/4 |

The random player loses every level either way, and the smart bot wins every level either way. In short, the burst is the main thing beating an idle player on 6 of 10 levels. The idle player keeps a full Wound and the burst wipes it. Whatever replaces it, cutting it included, has to bring back that pressure on the idle player.

## The options (as first written, before Alex's pick)

### A. Quorum burst (recommended)

Toxin comes from germ crowds instead of a script.

- **Rule:** when enough Staph-family germs (Staph, MRSA, Toxic-shock Staph) pile up in one spot, the crowd starts to glow. If it's still that big a few seconds later, it pops. The pop kills your cells in a small circle around it, about a Net pen and a half, not the whole sector. Then the crowd scatters and that sector gets a short cooldown.
- **How you stop it:** thin the crowd before it pops. Net neutrophils already run to the thickest crowd, so they're the natural answer. More neutrophils in that sector also works, and so do Offense macrophages chewing at the edge.
- **Why it's interactive:** it only happens where you've lost control. Every lever you already have changes it: the mix, Nets, a sector's share, switching a sector off. No new button.
- **Biology:** this is real, and it's how *Staph aureus* works. It counts its own neighbours with a chemical signal (quorum sensing) and switches on its neutrophil-killing toxins only once there are enough of them. It's also already in mechanics-brainstorm.md as an idea.
- **Readability:** the glow lives on the battlefield, so it isn't a third thing to watch. It must not look like the reproduction blink (Alex's rule). Use a steady purple halo that thickens, in the existing toxin colour, never a strobe.
- **Tested** (bursts off, quorum counted but not applied; 2 seeds on Papercut, Hospital visit and Sore throat). The rule I tried: 10 to 16 germs within 20 units, held 8 s, counting only germs at least 6 s old.
  - Winning bots (smart, gunner, offense-heavy) almost never saw a pop: 0 per match, with one on Papercut for offense-heavy.
  - Doing nothing saw 4 to 5 pops per match. So did the gunner while it was losing Sore throat.
  - Without the 6 s age rule, pops landed right as each wave arrived. That just recreates the scripted burst, so **fresh arrivals must not count**.
- **Risks:**
  - A pop hits a player who's already behind, which could snowball into a match you can't save. The small radius, the scatter and the per-sector cooldown are there to stop that. A bot should check that a player who falls behind can still recover.
  - As tested, good players barely see it. That's fine if Alex wants it as a "don't let it fester" threat. If Alex wants it as a regular beat, lower the age rule (around 3 s) and good players will see about one per match.
- **What changes in the build:**
  - The `toxins` loop in sim.js and the rail diamonds go, and a per-sector quorum check comes in.
  - fx `burst` can stay the pop's name, with a position. The Sandbox listens for it (layer.js adds toxin on `burst`), and so do the shake, toast and sound.
  - `toxinDeaths` stays.
  - The banner's "Toxin burst in N s" becomes a hint when a crowd starts glowing.
  - The shutoff tutorial clip loses its reason. Its lesson becomes a quorum clip.
  - Macrophages still die to pops, so they're not immortal outside TB.
  - Per-level difficulty becomes a level setting, the quorum size, instead of burst times.

### B. Shelter in Support (smallest change)

- Keep the scripted bursts, banner and diamonds. Cells inside a Support ring survive the shockwave.
- **The lever:** flip the Wound to Support during the 6 s warning. That costs killing power in the Wound right while the burst is coming. Exhausted shrinks the rings to 60%, so it ties into fatigue too.
- **Pros:** no new art and almost no code. It uses a control that already exists.
- **Cons:** it's still a scripted beat with one correct button press. That's better than nothing, but it's a quick-time event rather than a decision, so I don't think it fixes what Alex disliked.

### C. Ripening toxin carrier

- Some waves bring a swollen Staph that ripens for about 15 s, then pops like A. Kill it first and nothing happens. A twist: if a macrophage swallows it, it's defused cleanly.
- **Pros:** very readable, with one obvious blob and a timer you can see.
- **Cons:** you control what gets made, never where it goes, so you can't point anything at it. In practice the answer is "have enough firepower in that sector", which is less of a decision than A. It's also one more antigen on a roster that already adds one per level.

### D. Cut it entirely

- **Pros:** the fewest systems. Alex prefers fewer, cleaner systems, and the burst predates nearly every antigen. It was the main threat back when Staph was the only germ.
- **Cons:** doing nothing would win 6 of 10 levels (table above). Waves on those levels would need roughly x1.2 to x1.5 and a fresh bot pass. Macrophages would only ever die to TB.
- Close second if Alex would rather the game had one less rule than a new one.

## Side by side

| | Interactive? | New rules | Build size | Keeps pressure on idle play |
|---|---|---|---|---|
| A Quorum burst | Yes, every lever matters | 1 (replaces the burst) | Medium | Yes, measured |
| B Shelter in Support | A little | 0 | Small | Yes (bursts stay) |
| C Ripening carrier | Some | 1 antigen | Medium | Partly |
| D Cut it | n/a | -1 | Small plus rebalancing | No, waves must rise |

## Questions for Alex

1. Which one: A, B, C or D?
2. If A, should it be rare (only when you've lost a sector) or show up about once a match for good players too?

Odd result to recheck in any rebalance: on Sore throat the gunner bot won 4/4 with bursts on and lost 4/4 with them off.

# Antigen roster: enemy types and their counters

Written 2026-10-07. Built on the v2 rules (Wound > Tissue > Lymph node; since main game Version 24 the map is Wound > Tissue > Deep tissue > Lymph node, split 30/30/30/10, scripted waves, per-zone macrophage Offense/Support, Body output slider). **Alex approved all of it on 2026-10-07 and wants it all built, plus the Cytokine storm ability below.** Where an open question at the end isn't answered yet, the builder uses the recommendation given there.

## The idea

Every antigen gets one trait you can read at a glance from its sprite, and one counter you answer with **what you make and how you set each zone**, never by pointing units somewhere. Like Plants vs. Zombies, a level introduces one new antigen at a time, and the progress bar shows its icon before it arrives so you can get ready.

Rules every antigen follows:

1. **One trait, one look.** If you can't tell what it does from its shape and color in a crowd, it's cut.
2. **Counters live in today's controls where possible**: marrow choice, Body output, zone mode. Where a new tool is needed it's a new thing to *produce*, not a new thing to steer.
3. **Hard counter plus a costly fallback.** Each antigen has a best answer and a worse one (usually "throw more neutrophils at it and pay in fatigue"). That keeps harder levels from having one narrow path, as you asked.
4. **Counters should pull against each other.** The interesting levels are the ones where two antigens want opposite settings in the same zone.

## The counter toolkit

What v2 already has:

| Tool | What it's good at | What it's bad at |
|---|---|---|
| Plain neutrophil fire | Volume. Lots of small hits everywhere | Armor (bounces), big HP pools |
| Support ring (tuned shots) | Armor, one-shots, faster neutrophils | Only works inside the ring; no macrophages eating |
| Offense macrophages | Steady single kills, anything shots can't reach | Slow (one gulp every 2 s), easy to swamp |
| Body output slider | Burst production when it matters | Fatigue: slower cells, sprayed shots, then a slow marrow |

Proposed new tools, only if we like the antigens that need them:

| New tool | What it is | Art |
|---|---|---|
| **Net neutrophil** (marrow option) | A neutrophil that runs to the thickest crowd and bursts into a sticky net: kills every small thing in a radius, then fades. Area damage, built by choosing to make it | `net.svg`, `neutrophil-trap.svg`, `stance-trap.svg` already exist from v1 |
| **NK cell** (marrow option) | Slow killer that only targets infected or hidden things. Ignores normal bacteria | New |

## Antigen roster

**Today** means today's controls answer it (it still needs the enemy built). **New tool** means it needs one of the tools above.

### 1. Staph (the grunt) — Today
Already in v2. 3 hits, divides every 10 s. Every other antigen is defined against it.

### 2. MRSA (the tank) — Today
Armored, and also too slippery to swallow: Offense macrophages spit it out. **Tuned shots kill it in one hit.**
- Counter: Support mode in whichever zone it's reaching.
- Fallback (changed 2026-10-08, main game Version 24): plain neutrophil fire wears it down slowly. It takes 12 hits and heals back to full whenever it divides (every 20 s), so plain fire only wins where enough gunners focus it. Alex's reason: Support macrophages don't chase MRSA, so a hard lock left "frustrating unsalvageable situations". It used to be a hard lock (only tuned shots), and levels still cap its share and warn early on the progress bar.
- Look: today's armored bacterium with a hazard-stripe shell.

### 3. Influenza (zerglings) — New tool (Net neutrophil)
Tiny, fast, one hit kills, arrives in swarms of 40+ all at once. Doesn't divide; instead every flu that reaches Tissue splits into 3.
- Counter: Net neutrophils. One net wipes a cluster.
- Fallback: crank Body output and flood plain neutrophils. Works, but costs you a Feverish stretch.
- Why it's fun: Support's one-shot tuned fire is wasted on enemies that already die in one hit, so it pulls you off your "Support everywhere" habit.
- Look: small pale spheres with spikes, swarming like a school of fish.

### 4. Pseudomonas (the builder) — Today
Stops in a zone and grows a slime dome (biofilm). The dome works like MRSA's armor: shots into it, plain or tuned, do only a small fraction of their damage, so a focused gunline still grinds bacteria under it down, just slowly. It never blocks damage completely (changed 2026-10-08 after Alex's Pool playtest; it used to make them immune). Domes keep spreading if left alone.
- Counter: Offense macrophages tear domes down (each gulp chews a chunk).
- Fallback: concentrated neutrophil fire wears down the bacteria under a dome slowly, and keeps the ones around it thin while macrophages arrive.
- Why it's fun: it's the reason to keep Offense on. It pulls directly against MRSA, which wants Support.
- Look: green-tinted bacterium; the dome is a translucent bubble over the zone floor.

### 5. Tuberculosis (the trojan horse) — Today
Slow, tanky (12 hits). If a macrophage swallows it, the macrophage becomes infected, turns magenta, and spits out new TB every few seconds until it dies.
- Counter: no Offense where TB is. Support rings and sustained neutrophil fire.
- Infected macrophages: only NK cells go after them (Alex, 2026-10-07). Neutrophils ignore them and their shots pass by, as in the body, where NK and killer T cells kill infected macrophages. So the fallback for a swallow is NK cells, not neutrophil fire.
- Why it's fun: it punishes the Offense default, so a TB + Pseudomonas level asks a real question: which zone gets which mode?
- Look: thick rod with a waxy outline.

### 6. Clostridium spores (the time bomb) — Today
Arrives as inert spores you can't hurt. After 30 s they hatch all at once into fast-dividing bacteria. The hatch time shows on the progress bar.
- Counter: Body output timing. Rest the slider while spores sit, then max it right before the hatch.
- Fallback: a constant high army, which means living Tired most of the match.
- Why it's fun: it makes the slider a planning tool, not just "turn it up".
- Look: hard little pods that crack open with a flash.

### 7. Toxic-shock Staph (the drain) — Today
Normal 3-hit bacterium, but while any are alive your fatigue builds twice as fast.
- Counter: kill it first. Since you can't target, that means Offense macrophages in the Wound where it enters, so it never reaches the crowd.
- Fallback: keep Body output low and win slowly.
- Look: staph with an orange pulse that also tints the fatigue meter.

### 8. Strep chains (the rushers) — Today
Chains of 6 to 10 bacteria linked in a line. They ignore lymph flow speed and sprint for the Lymph node. Shooting a middle link splits the chain into two shorter chains that both keep going.
- Counter: Support in Tissue (faster neutrophils reach them, one-shots stop the splitting) or Offense in the Lymph node (macrophages gulp them one link at a time on arrival).
- Fallback: hold more neutrophils so the lymph timer survives the hit.
- Why it's fun: two equally good answers in two different zones.
- Look: bead strings that wriggle.

### 9. Herpes (the sleeper) — New tool (NK cell)
Hides inside your own neutrophils. Infected neutrophils look normal for a while, then burst into 8 virus particles each.
- Counter: NK cells, which find and pop infected cells before they burst.
- Fallback: a high neutrophil turnover so infected ones die of old age first (they live 30 s).
- Look: infected neutrophils get a faint purple flicker, so a sharp-eyed player can see it coming.
- Honest take: this is the most complex one; it's here in case you want a "your own army turns on you" moment.

### 10. Tapeworm (the boss) — Today
One huge segmented worm, about 400 hits, crawls Wound to Lymph node over two minutes. Too big to swallow. Tuned shots do 5 damage instead of a one-shot. Each segment you break off becomes a small fast worm.
- Counter: everything at once. Mass neutrophils with Support rings along its path, then spend your Body output on its last stretch.
- Fallback: none needed; it's the end-of-level exam.
- Look: the only thing on screen bigger than a macrophage.

## Counter matrix

✓ strong, ~ works at a cost, ✗ useless or backfires.

| Antigen | Plain fire | Support (tuned) | Offense (swallow) | Body output | New tool |
|---|---|---|---|---|---|
| Staph | ✓ | ✓ | ✓ | ~ | |
| MRSA | ~ (12 hits, heals on division) | ✓ | ✗ | ~ | |
| Influenza | ~ | ~ | ✗ (too many) | ~ | Net ✓ |
| Pseudomonas | ~ (domed: heavily reduced) | ~ (domed: heavily reduced) | ✓ (domes) | ~ | |
| Tuberculosis | ✓ | ✓ | ✗ (infects) | ~ | NK ✓ (infected macrophages) |
| Clostridium | ✓ after hatch | ✓ | ✓ | ✓ timing | |
| Toxic-shock Staph | ✓ | ✓ | ✓ in Wound | ✗ (drain) | |
| Strep chains | ~ (splits) | ✓ in Tissue | ✓ in Lymph | ~ | |
| Herpes | ~ | ~ | ~ | ~ | NK ✓ |
| Tapeworm | ✓ volume | ✓ | ✗ (too big) | ✓ late | |

Eight of ten work with today's controls. Influenza and Herpes are the two that need a new produced unit.

## Cytokine storm (player ability)

Alex's idea: an active ability that decimates the antigens on screen but costs heavy fatigue.

**What it does.** One big button. After a 1 s wind-up (screen flushes red, a shockwave rolls out from the marrow side), every zone takes the hit at once:
- Kills about 70% of the antigens on the map, picked at random. It decimates rather than wipes, so a wave still has stragglers to clean up.
- Kills about 40% of your own neutrophils too. It's a storm, and it hits everyone.
- Macrophages survive it but are stunned for 3 s.

**What it costs.** (Revised with Alex, 2026-10-07: it's a last-ditch desperation move that can kill you, like a real cytokine storm.)
- It can fire at any time. There's no gate and no cooldown.
- Fatigue jumps by 50 points at once. Then an **afterburn** runs for 8 s: fatigue keeps climbing by 2 points a second (+16 total), halved if the Body output slider is at its lowest.
- **If fatigue reaches 100 during the storm or its afterburn, the body collapses and you lose** ("Cytokine storm: organ failure"). This is a new lose condition, but only during a storm. Normal slider play still stops at 100 without killing you, so v2's slider balance doesn't change.
- So from fresh (under about 35) you survive and land Feverish or Exhausted. From Tired it's a gamble that you survive only if you drop the slider right away. From Feverish it kills you. A second storm in one match almost always kills you.
- The fatigue meter shows a ghost bar of where the storm would land you while your finger is on the button, so the gamble is informed. The afterburn keeps it from being an exact calculation.

**What it doesn't touch.** This is what keeps the roster meaningful instead of letting the storm answer everything:
- Clostridium spores (inert, so they shrug it off; storm too early and the hatch arrives while you're Feverish)
- Bacteria under a Pseudomonas dome
- Herpes hiding inside your neutrophils (the storm kills the host neutrophil, which releases the virus)
- The Tapeworm takes a flat 15% of its health, not 70%
- Toxic-shock Staph dies normally, but if any survive, the doubled fatigue gain stacks on top of the storm's cost

**Why it's not a mash button.** Mashing it kills you, and a well-timed one still trades your army and most of your stamina for a temporary clear. It's for when the lymph timer is about to fill and nothing else will save the match. The bot checks: a `random` bot that may hit the storm must still lose; a "storm when the lymph timer passes 70%" bot should rescue some matches a no-storm bot loses; and a bot that storms often should mostly die of collapse. Winning must never require the storm.

**Look and feel.** A full-screen magenta-red flash, the cyan cells flicker, then shards everywhere. The fatigue meter visibly jumps. The `fever.svg` and `toxin-shockwave.svg` art can stand in until the art thread makes a dedicated effect and button icon.

**Tuning knobs** (for the tuning page): kill share (0.7), friendly share (0.4), fatigue cost (50), afterburn length (8 s), afterburn rate (2/s, halved at minimum output), collapse threshold (100), Tapeworm share (0.15), macrophage stun (3 s).

## How levels would mix them

- **One new antigen per level**, shown on the progress bar with its own marker, the way PvZ shows a new zombie.
- **At most three antigen types per level**, so you can still read the screen.
- **At least one pairing that pulls opposite ways**: MRSA + Pseudomonas (Support vs Offense), TB + Pseudomonas, Influenza + MRSA (nets vs rings). That's where the decisions come from.
- **Hard counters get a share cap.** MRSA never makes up most of a level, so a player who sets Support late loses ground but not the match.
- **Bot check per level.** Random mashing still has to lose, and at least two distinct bot strategies (say "Support-heavy" and "Offense-heavy") should both win each level. That's the measurable version of "many strategies still win".

A sample early arc:

| Level | New antigen | Mix | The question it asks |
|---|---|---|---|
| 1 Papercut | Staph | Staph | Basics |
| 2 Hospital visit | MRSA | Staph + MRSA | When to flip to Support |
| 3 Pool water | Pseudomonas | Staph + Pseudomonas + MRSA | Which zone gets which mode |
| 4 Flu season | Influenza | Influenza + Staph | Make nets, not rings |
| 5 Soil cut | Clostridium | Clostridium + MRSA | Time the slider |
| 6 Lungs | Tuberculosis | TB + Pseudomonas | Offense is a trap here |
| 7 Sore throat | Strep chains | Strep + Toxic-shock Staph | Defend the lymph node without burning out |
| 8 Gut | Tapeworm | Tapeworm + Staph | Everything at once |

## Open questions

1. Is a third marrow option (Net neutrophil) okay, or should area damage come from an existing unit instead (for example, Offense macrophages that gulp a whole cluster of tiny things at once)?
2. Keep Herpes and the NK cell, or cut them as too complex for now?
3. ~~MRSA as a true hard-lock (only tuned shots), or should macrophages be able to swallow it slowly as a fallback?~~ Answered 2026-10-08 (Alex): plain neutrophil fire kills it slowly; macrophages still can't swallow it.
4. Should the progress bar show which antigen is coming in each wave, or only that a new one is coming?
5. Which one or two would you want to try first in the prototype? My pick: MRSA's swallow immunity plus Pseudomonas, since both are pure enemy changes and together they make the zone-mode choice matter.

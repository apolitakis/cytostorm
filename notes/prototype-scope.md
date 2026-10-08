# Immune RTS: what to mock up first

Based on *Immune RTS: Preliminary Design* (Oct 4, 2026).

## The question the mockup has to answer

The doc's M0 asks "is the swarm fun to watch?" That's necessary but it isn't the fun risk. Set-orders-and-watch games usually fail by feeling passive: the player makes a choice, nothing they can read happens, and they stop caring. The real question is:

> **Does adjusting a few dials, with escalation costing the host, produce interesting decisions minute to minute, and does the match have an arc?**

The hook in the pitch is "overreacting can lose as surely as underreacting." The prototype should be able to show that in its first 10 minutes of play, or it hasn't tested the game.

## Recommended scope: one thin slice through the whole arc

Rather than build M0 → M1 → M2 in order, take a thin slice of each so one match goes breach → payoff → stand down.

### In

| Area | What to build | Why |
|---|---|---|
| Map | One tissue area, 3 sectors (blood entry, wound, lymph exit) | Enough for "where" to matter, small enough to read on a phone |
| Enemy | Bacteria only: doubling growth, one toxin burst (area damage) | Exponential growth is what creates the time pressure |
| Friendly | Neutrophils (Eat / Trap) and macrophages (Kill / Repair) | Two cards, each with a real tradeoff. Skip Wall off for now |
| Sector control | Alert level per sector (Quiet / Watch / Inflamed / Max) | The main dial, and the main source of self-inflicted damage |
| Production | Bone marrow mix as a single neutrophil ↔ macrophage slider | Tests flow economy without a second panel |
| Body-wide | Fever only | One big costly lever with a cooldown |
| Meters | Pathogen Load and Host Damage | The core tension |
| Adaptive (faked) | A sample bar fills as macrophages eat bacteria. When full, one choice: **Opsonize** (macrophages eat faster, clean) or **Complement** (direct damage, more inflammation). Antibody cloud then ramps up exponentially | This is the payoff of the arc. Without it the match is flat attrition |
| Scenarios | Same map, two setups: **Papercut** (rout) and **Pollen** (restraint: harmless invader, win by not hurting the host) | Tests both directions of the core tension with zero extra systems |
| Dev tools | Speed slider (0.25×–4×), pause, live tuning panel for all numbers, fixed random seed, end-of-match graph of both meters over time | Tuning is most of the work at this stage |

### Out (fake or skip)

- Scouts as units, interception, lymph node travel (replaced by the sample bar)
- Antibody targets, mutation pressure, Ship now / Refine
- Commanders and doctrines. Add one later as the first M2 extension; Treg is the best first one because it supports the restraint pillar
- NK, killer T, viruses, fungi, parasites, biofilm, capsules
- Slowed-time vs. pause for the lymph node panel (the single choice is quick enough to just pause)
- Art beyond glowing circles on black, sound, menus, progression

## Build it as a throwaway web prototype

SpriteKit is the right engine for the game, but the fun test doesn't depend on it. A single-page HTML5 canvas build:

- iterates faster (edit, refresh, no Xcode/device deploy),
- opens on any phone from a link, so friends can playtest without TestFlight,
- forces you to throw it away rather than grow it into the real codebase.

Keep the iPhone performance question (thousands of agents) as a separate SpriteKit spike. A few hundred agents is plenty to judge fun.

## How to tell if it's fun

Watch 4–6 people play 2–3 matches each without coaching. Good signs:

- They change a setting at least every 30–60 seconds, unprompted.
- At least some players lose to Host Damage by overreacting, and realise why.
- In Pollen, they figure out on their own that the answer is to hold back.
- They can point to the moment the antibodies kicked in, and it felt good.
- They ask to play again or try a different strategy.

Bad signs, and what each one points to:

- Long stretches of watching with no input → settings aren't consequential enough, or effects are too slow (shorten the stance delay, raise growth rates).
- Players can't tell why they lost → readability problem; the meter graph and per-sector damage need to be clearer before adding anything.
- One setting combination always wins → tradeoffs are mistuned; widen the cost of Max alert and fever.
- Stand-down phase feels like a chore → the Repair switch needs a visible payoff (scarring score, star rating).

If this slice passes, the doc's M2 (real scouts, antibody targets, commanders) and M3 (chokepoint map) are the next additions, in that order.

# Difficulty simulator: spec

Draft for Alex to react to (2026-10-08). Nothing below is built yet unless it says "exists".

## Short answer: did we build it?

Partly. On 2026-10-07 the build thread added a **"How many ways to win" tab** to the Tuner (https://claude.ai/artifact/UktMrhuVzQ8gSXhBBXb9ci, code `prototype/v3/tuner/`). It does a rough version of what you described:

- It builds a "strategy" from 9 habits: how often you look, macrophages kept, Offense/Support style, whether you make counter cells, the crowd size that flips a zone to Support, body output normally and before waves, the fatigue where you rest, and whether you storm when the Lymph node is in trouble.
- It samples N strategies spread evenly across those ranges, plays one game each, and reports the share that won ("Narrow path" / "A few ways" / "Many ways to win").
- For each habit it shows the win rate by range, the band the middle 80% of winners sat in, and whether that habit "decides it", "matters" or "barely matters".

Why it hasn't been doing the job since:

- **Stale.** It was last built on 2026-10-07 at 14:35, before organs, the four sectors with On/Off, the vessel wall, quorum bursts and the rest of V9–V26. Its saved results are from that older game.
- **Too narrow.** It can't switch sectors off, so it could never have found the focus exploit (Deep tissue + Lymph node off). It has no set-and-forget strategies and no real storm-timing choice.
- **One game per strategy.** The game is chaotic (tiny timing differences snowball), so a single game per strategy is mostly noise.
- **Not wired into how we balance.** Day-to-day balancing uses the fixed bots in `headless.js` (idle, random, smart, supportHeavy, offenseHeavy, gunner, plus the funnel/focus/shifter bots). That's why the focus win was found by hand, not by a tool.

So the idea exists, but there's nothing current that solves for winning ranges. The rest of this doc is the version worth building.

## What "difficulty" should mean, as tests

Your balance rules from project memory, turned into numbers a simulator can check. The thresholds are my proposal; change any of them.

| Your rule | Measured as | Proposed target |
|---|---|---|
| Idle and random play must lose | idle, random and storm-spam bots, 8 seeds | 0 wins (hard fail) |
| No trivial focus wins | best **set-and-forget** strategy: one Response, sectors and stances picked at the start and never touched | ≤10% on Papercut, 0% from Pool water on |
| Many strategies win | share of the strategy space that wins at least half its seeds | 25–60% early levels, 10–35% late |
| ...and they're actually different | distinct **winning styles** (clusters of winners by how they killed: shots, swallows, Nets, NK, storm; which sectors carried the fight) | ≥2 per level, ≥3 once NK is in |
| Challenging, not impossible | the good bot (smart) | wins 80–100% |
| Challenging | how close winners come: peak breach clock, organ bars lost, peak fatigue | from Soil cut on, the median winner loses ≥1 organ bar or fills a breach clock past half |
| No unsalvageable situations | **point of no return**: how long before a loss the game was already decided | in most losses, under ~45 s |
| Authored pressure, no rubber-banding | nothing to measure; the simulator never changes the level while it plays | (rule for the tool) |
| Difficulty rises across the campaign | skill needed to win (see Level 3), level by level | mostly rising along LEVEL_ORDER, no cliffs |

## The ladder of simulation levels

You're right that there are several levels. Each one answers a different question, costs a different amount, and they stack: cheap ones run on every build, expensive ones when a level is being tuned.

### Level 0: capacity math (no simulation)

**Question:** can this wave be beaten at all, and what's the bare minimum production?

A spreadsheet-style model per sector: germs arriving per second (trickle + waves + division) against kills per second per cell type, production rate, the 180-cell cap and organ penalties. It runs in microseconds and explains *why* a level is hard ("Flu wave 3 needs 2.1 Net neutrophils a second in Tissue; max production gives 1.6").

- **Catches:** impossible spikes and dead-easy levels, before any bot runs.
- **Misses:** everything physical: crowding, knockback, leaks, domes, quorum pops. The real game is mostly physics.
- **Recommendation:** skip it for now. The real sim is fast enough (below) that the approximation buys little. Revisit if we want a wave-designer's helper.

### Level 1: fixed bots (exists)

**Question:** do the hand-written players behave as expected?

`headless.js` with idle, random, stormSpam, smart, supportHeavy, offenseHeavy, gunner, focus/funnel and the skill ladder (beginner, casual). This is today's regression test: V26 is smart 37/40, supportHeavy 38/40, gunner 33/40, offenseHeavy 20/40, idle/random 0/40.

- **Keep it** as the fast gate on every publish (about 4 minutes for 6 bots × 10 levels × 4 seeds).
- **Limit:** it only tests strategies someone thought to write.

### Level 2: strategy sweep ("how many ways to win")

**Question:** across everything a player could reasonably do, how much of it wins, and what do the winners have in common?

This is the Tuner tab, rebuilt for V26 and run on several seeds.

**The strategy space.** Only what you control: what gets made, never where units go.

- **Per-sector Response.** The share of each unit type, from a few archetypes (gunner-heavy, macrophage-heavy, counter-heavy, even) plus "counter what shows up" on or off.
- **Sectors on/off.** All 15 non-empty On/Off combinations of the 4 sectors, held for the whole game or switched off when a sector is empty.
- **Stance per sector.** Offense or Support, either fixed or "react to crowding / MRSA / domes".
- **Body output.** Resting level, push level, and the fatigue at which to back off.
- **Cytokine storm.** Never, or at a threshold (Lymph node breach %, germ count), with the 5 s hold modelled as today.
- **Attention.** How often the strategy looks (0.5–5 s) and a reaction delay. This is the "skill" dial.
- **Saved Responses.** Modelled as switching between 2–3 fixed Responses on wave markers.

**Two families:**

- **Set-and-forget** (attention = never). The space is small enough to enumerate fully, about 2,000 combinations per level. It's the exploit check: if any static setup wins, that's a trivial win, and the report names it ("Wound + Tissue only, both Support, 60/40 neut/mac: wins 4/4").
- **Reactive.** About 200 strategies per level sampled evenly across the ranges, each played on 3 seeds. A strategy "wins" if it takes 2 of 3.

**Output per level:**

- Win share, with the verdict (narrow / a few / many).
- Which habits decide it, and the winning band for each (as the Tuner does now).
- Winning styles: winners clustered by kill mix and which sectors carried the fight. "Three styles win: gunner wall in Wound; Support rings in Tissue + Lymph; Net-heavy."
- The best set-and-forget strategy and its win rate.
- Closeness of the median winner (organ bars, peak breach, fatigue).

### Level 3: search ("solve for it")

**Question:** what's the *least* a player can do and still win, and is there an exploit we haven't thought of?

Instead of sampling evenly, an optimizer (cross-entropy search: keep the best 20%, resample around them, repeat) hunts the strategy space for specific targets:

- **Skill floor.** The slowest attention (longest look interval) that still wins ≥50%. This becomes the level's difficulty number, and it should rise along the campaign. It's the cleanest single answer to "how hard is this level".
- **Exploit hunt.** The highest win rate under "dumb" constraints: few inputs per minute, one sector, no counters, storm spam. A hit is a design bug, found automatically the way the focus bot was found by hand.
- **Style coverage.** "Best strategy that never makes macrophages", "...never uses Support", "...never storms". If one of these can't reach 50%, that style is dead on this level. Sometimes that's intended (Lungs punishes Offense), and the report says so.

### Level 4: branching from the middle of a fight (salvageability)

**Question:** when you lose, when did you actually lose? Are there doomed stretches where nothing you do matters?

The sim is fully deterministic (fixed 1/60 s step, seeded RNG; checked: the same seed and inputs replay identically). So any moment of any game can be rebuilt by replaying from the start, then branched: from time T, hand control to the best known strategies and see if any of them still wins.

- **Point of no return.** For each loss, the latest T from which some strategy still wins. Short means you lost to your recent choices (fun). Long means the level ground you down after it was already over (bad).
- **Comeback rate.** From states that look bad (breach clock ≥50%, an organ down to 1 bar), how often good play recovers. This directly tests "no unsalvageable situations".
- **Cost.** Expensive (a replay per branch). Run it on demand for one level, not every build. A small `Game.snapshot()` / `restore()` hook in sim.js would make it about 10× cheaper. That's a request for the build thread, not needed to start.

### Level 5: you, measured against the bots

**Question:** where does an actual human sit on this scale?

The fight report ("Send feedback") already records level, seed and inputs, so your games can be replayed in the sim. Two uses:

- Place you on the attention/skill scale ("you played like a look-every-1.5 s strategy") and check the bots' "good player" is honest.
- Run Level 4 on your own losses: "you were saved until 3:10; after that nothing wins."

Small gap: the log merges slider drags within 1 s, so replays are close but not exact. Logging raw slider values would fix it (build thread, later).

## Solving for ranges of the *level*, not just the player

The levels above look at player strategies for a fixed level. The tuning question is the reverse: **which range of a level's numbers passes every test?**

Use one dial per level, the **pressure** factor that `applySettings` already supports (scales every wave and the trickle). For each level, the tool finds the **playable window**:

- **Low edge:** the lowest pressure where idle, random and every set-and-forget strategy still lose.
- **High edge:** the highest pressure where the good bot still wins ≥80% and ≥2 styles still win.
- The current level sits somewhere in that window or outside it.

Output: one row per level, drawn as a bar with the live value marked. For example (made-up numbers): "Flu season: playable from 0.85× to 1.30×; live is 1.0×, in the easy half."

A missing window (low edge above high edge) means pressure alone can't fix the level: it needs a design change, not a number. That's the most useful signal of the lot. The same search works for any single knob (quorum size, wall softness, trickle multiplier, Evolution thresholds in V27).

## Cost

Measured on V26 in this container: one bot game takes 2–6 s of one CPU core. This container has 4 cores, so roughly 1 game a second, about 3,600 games an hour.

| Run | Games | Time here |
|---|---|---|
| Level 1 gate (6 bots × 10 levels × 4 seeds) | 240 | ~4 min |
| Level 2, one level (2,000 static + 200 reactive × 3 seeds) | 2,600 | ~45 min |
| Level 2, all levels | 26,000 | ~7 h, so overnight, or cut static to ~300 by grouping similar mixes (~1.5 h) |
| Level 3 search, one target, one level | ~1,500 | ~25 min |
| Pressure window, one level (~6 bisection steps × Level 1 + a small sweep) | ~1,500 | ~25 min |
| Level 4, one level | depends | ~1 h |

Games that are clearly lost end early (Host failure), which helps. If this is too slow, there are two levers: run the static family at fewer seeds, or ask the build thread for a "fast mode" that skips the history and fx bookkeeping the UI needs.

## What you'd see

One Artifact, **"Difficulty map"**, rebuilt after each run, replacing the old Tuner:

1. **Scorecard.** One row per level with a pass or fail for each test in the table above, and the skill floor.
2. **Level page.** The win share and styles, the "what winning looks like" habit bands (the Tuner's best idea, kept), the best set-and-forget strategy, and the pressure window bar.
3. **Exploits found.** Plain sentences, each with a "watch it" link that opens the main game on that seed with that strategy auto-playing, so you can see the exploit rather than read about it.

Numbers come with their seed counts, and "not balanced yet" levels stay flagged the way they are today.

## Build plan

All code in `tools/difficulty-sim/`. It reads a frozen release, `prototype/v3/releases/<version>/` (V26 today), read-only, so half-built work never leaks into the numbers. It never edits `prototype/` or `workshop/`. Sim hooks go to the build thread through the coordinator.

1. **Sweep + exploit check (Level 2).** New strategy space, set-and-forget enumeration, 3 seeds per strategy, winning styles, CLI report. *Recommended first.* It would have caught the focus win, and it gives the "ways to win" answer on V26.
2. **Pressure windows.** One window per level. Small on top of step 1.
3. **Difficulty map Artifact.** Replaces the Tuner page; the old Tuner gets a "retired" note.
4. **Search (Level 3).** Skill floor per level and the exploit hunt.
5. **Salvageability (Level 4).** On demand, after the snapshot hook if the build thread can add it.
6. **Your fights (Level 5).** When you send fight reports.

Steps 1–3 are a solid first version. V27 (Evolution) should land before step 1's numbers matter much, since Evolution exists to punish one-method play. The tool runs on V26 now and re-runs when V27 publishes.

## Questions for you

1. **Build steps 1–3 now?** *Recommended: yes.* Steps 4–6 wait until you've seen the first map.
2. **Are the targets in the table right?** The two that most shape the game are "≤10% for the best set-and-forget strategy" and "the median late-level winner loses ≥1 organ bar".
3. **Should the simulator ever block a publish,** or only report? *Recommended: only report.* This matches your 10-minute rule: flag "not balanced yet" and ship.

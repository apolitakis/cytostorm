# Fever on/off bot runs (2026-10-08 12:31-12:45): NOT published V26

**These ran on the build thread's in-progress Evolution draft (CONFIG.evolve on), not on published V26.** The build thread's rerun on published V26: smart 37/40, supportHeavy 38/40, gunner 33/40, offenseHeavy 20/40, idle and random 0/40. Only the fever on vs off comparison here is meaningful (it barely moves wins).

Run by "Antigen types and counters" from a copy of prototype/v3/src (sim.js, bots.js, headless.js) taken at 12:31, outside /mnt.

Commands (seeds 1-4 for every level and bot; headless.js uses seed = 1..N):

    TUNE='{"tune":{"fever":{"on":1}}}' DUMP=on.json  node headless.js all idle,random,smart,supportHeavy,offenseHeavy,gunner 4 > on.txt
    TUNE='{"tune":{"fever":{"on":0}}}' DUMP=off.json node headless.js all idle,random,smart,supportHeavy,offenseHeavy,gunner 4 > off.txt

Files: on.txt / off.txt are the headless.js tables; on.json / off.json are the raw per-match results (curve removed).

Source copy (sha256 prefix):
b52fb9539dfa  sim.js
2d1a999382f3  bots.js
43df7064884c  headless.js

Totals (wins out of 40): idle 0/0, random 0/0, smart 10/10, supportHeavy 20/16, offenseHeavy 3/2, gunner 3/2 (fever on / off). Every loss is Host failure.

prototype/v3/src/sim.js has changed since this copy was taken, so the exact sources used are saved in src/ here. To reproduce, run the commands above from a copy of that folder outside /mnt.

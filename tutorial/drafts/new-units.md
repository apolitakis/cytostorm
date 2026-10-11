# Draft clips for the new friendly units (prep, not built)

Coordinator heads-up 2026-10-10 17:11: Alex wants one new unit per campaign stage. The spec is section 2 of notes/campaign-features-brainstorm.md. B cells (Play level 2) and Eosinophils (level 3) come first, in the Play release after the drip one. Each gets a short intro clip, the way the TB clip introduces NK, filed under the level's new kind (forLevel). Numbers in [brackets] must be matched to the published release before building.

Art already in prototype/assets for all seven: b-cell, b-cell-puff, antibody(-cloud), bacterium-opsonized, eosinophil(-latched, -pop), platelet(-stuck), dendritic-cell(-carrying), treg, interferon-cell, interferon-haze, mast-cell, mucus; germs biofilm-dome, staph-toxic, herpes, tapeworm-head/segment.

## bcell: "B cells" (~13 s, hud side 'ctl', Tissue, bg tile 1.2 like mrsa)
1. 0.0 A B cell comes in slowly and settles back from the fight. Caption: "B cells kill nothing themselves. Every [few] seconds they puff a cloud of antibodies."
2. 2.5 The cloud (antibody-cloud) drifts with the flow over the germs, which swap to bacterium-opsonized. A "tagged" tag appears. Caption: "Germs the cloud touches get tagged."
3. 5.0 Tagged germs stick together and roll as a slow, heavy clump (pairs merge, then lerp to a shared centre). Caption: "Tagged germs stick to each other into heavy clumps that roll slowly."
4. 7.5 An offense macrophage swallows tagged germs twice as fast, then gulps the MRSA it used to spit out. Caption: "Macrophages swallow tagged germs [twice] as fast, and they can swallow tagged MRSA."
5. 10.5 Closing caption: "B cells pay off next to macrophages and Nets. Make them from the zone's Response."
Check against the release: puff interval, cloud size and drift, tag duration, swallow multiplier, whether MRSA becomes swallowable, clump rules, and the production-card name.

## eosino: "Eosinophils" (~12 s, Tissue, reuse the pseudo clip's dome helpers)
1. 0.0 Eosinophils swim past small bacteria and ignore them. Caption: "Eosinophils ignore small germs."
2. 2.2 One latches onto a slime dome and swaps to eosinophil-latched, pulsing with a growing ring. This is a steady pulse, never a strobe. Caption: "They latch onto anything big, like a slime dome, and pulse for [a few] seconds..."
3. 5.0 It pops (eosinophil-pop): the dome breaks and the eosinophil is used up. Caption: "...then burst for heavy damage. The eosinophil is spent."
4. 7.5 A second eosinophil latches onto a Candida thread or the Tapeworm, shown as a silhouette preview. Caption: "Later they're your answer to fungus threads and the Tapeworm."
5. 10.0 Closing caption: "Against a swarm they're wasted, so make them where big germs are."
Check against the release: what counts as big, latch time, pop damage and radius, whether it dies on popping, and whether shots hit a dome while it is latched.

## Wiring
- In player.js, forLevel(levelKey, newKinds) only maps germ kinds (BY_KIND), so unit clips need a new hook, e.g. a BY_UNIT map plus a third argument newUnits (or the game passes unit keys in newKinds). Agree on the name with the build thread so each clip plays on the level that adds its unit. Add preview INFO entries with the unit's own icon (b-cell, eosinophil). Add a README line.
- The release chain stays the same: build from the clips-inlined release, publish, then send the version and id to the coordinator.

# The other five (coordinator 17:35: all seven units are coming in one or two Play releases after the drip)

## platelets: "Platelets" (~13 s, level 5 Knee, Wound, side 'ctl')
1. 0.0 Platelets drift to the downstream edge of the zone and stick together into a wall across the flow. Caption: "Platelets drift to the far edge of their zone and stick together into a wall."
2. 3.0 The Clostridium hatch rush piles up against the wall, and the front platelets lose health and crack. Caption: "Germs pile up against it and have to chew through."
3. 6.0 Neutrophils shoot over the wall into the packed crowd. Caption: "Your neutrophils shoot right over it."
4. 8.5 With the wall full across the Wound, the trickle halves (a "trickle ½" tag at the wound). Caption: "A full wall across the Wound seals it: half as many germs get in while it holds."
5. 11.0 Your own cell squeezes slowly through the wall. Caption: "It slows your own cells crossing it too, and platelets kill nothing."
Check against the release: wall position, platelet health, trickle factor, how much it slows your cells, and the iPhone cap on body count.

## dendritic: "Dendritic couriers" (~13 s, level 6 Foot, map view so the walk to the Lymph node shows)
1. 0.0 A dendritic cell grabs a sample from the nearest Candida and swaps to dendritic-carrying. Caption: "A dendritic cell grabs a sample from the nearest germ..."
2. 2.5 It walks down through Tissue and Deep tissue on its own. Caption: "...and carries it to the Lymph node by itself. You can't steer it, only keep its path safe."
3. 6.5 It arrives, and a gold ring pulses at the node. Caption: "If it arrives, every cell of yours hits that germ harder for the rest of the stage."
4. 9.0 Shots on Candida show a bigger hit tag. A second courier dies on the way in a crowd. Caption: "If germs catch it on the way, the sample is lost."
Check against the release: the damage bonus, whether it stacks, its speed and health, and how it picks a germ kind.

## treg: "Regulatory T cells" (~11 s, level 8 Neck, bottom HUD so fatigue shows)
1. 0.0 A few Tregs sit in a zone. Caption: "Regulatory T cells kill nothing. They calm your body down."
2. 2.5 The fatigue bar climbs at half its usual slope, shown beside a faint ghost of the old slope. Caption: "While some are alive, fatigue builds more slowly and overload hurts organs less."
3. 6.0 The neutrophils' fire rate visibly slows, with a "slower" tag. Caption: "The cost: your other cells fire and swallow a little slower."
4. 8.5 Toxic-shock Staph appears. Caption: "They shine against Toxic-shock Staph, which doubles fatigue."
Check against the release: the fatigue and organ multipliers, the slowdown, and how it scales with count.

## interferon: "Interferon cells" (~11 s, level 9 Lip, Tissue)
1. 0.0 An interferon cell sits with its interferon-haze around it. Caption: "Interferon cells kill nothing. They give off an antiviral haze."
2. 2.5 Herpes hits a cell inside the haze and bounces off with a "protected" tag, while it hijacks a cell outside. Caption: "Your cells inside the haze can't be hijacked by Herpes."
3. 6.0 Flu in the haze blinks more slowly when it splits. Caption: "Viruses in it split more slowly."
4. 8.5 An NK cell kills the hijacked cell outside the haze. Caption: "The haze prevents infection, and NK cells clean it up after. They stack."
Check against the release: haze radius, the split-rate factor, and whether it covers TB.

## mast: "Mast cells" (~12 s, level 10 Belly, Deep tissue)
1. 0.0 Mast cells sit where they were made. Caption: "Mast cells stay where they're made."
2. 2.5 A Tapeworm segment comes near and they release mucus: a translucent wash slows the flow in the zone. Caption: "When a big germ comes near, they release histamine and mucus."
3. 5.0 The worm crawls at half speed, with a "½ speed" tag. Your cells there slow too. Caption: "The flow in that zone slows for a few seconds. The Tapeworm crawls at half speed, and so do your cells there."
4. 9.0 The mucus clears. Caption: "Weep and sweep: it's how your gut fights worms."
Check against the release: trigger range, duration, slow factor, cooldown, and what counts as big.

Order: build each clip on the release that adds its unit (B cells + Eosinophils first, then the rest in one or two releases). Basics stay unchanged. Each unit clip plays on its level via forLevel, and the Campaign picks it up through the inlined clips.

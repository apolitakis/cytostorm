# Campaign brainstorm: treatments, upgrades and loadouts that carry across maps

Written 2026-10-07, following Alex's reply to the mechanics brainstorm (notes/mechanics-brainstorm.md):

- The best ideas work better as **buffs that persist across maps** than as things that happen inside one map. Example: run antibiotics or antifungals on a map you're struggling with, and it shapes the rest of the campaign. Steroids fight systemic inflammation but make your troops weaker or fewer.
- **Less into immunity developing during a single map** (so "Antibodies kick in" moves out of the map and into the campaign, below).
- **Likes a loadout before each map**, and **persistent upgrades bought with currency from destroying antigens**.
- A meta system across campaigns is optional. Alex generally hates them, so it's sketched last and kept small.

**Update (Alex, 2026-10-08):** no stars for now (more complexity than they're worth). Treatment costs that carry across the campaign are out, because they'd make campaigns snowball. Treatments now cost you only on the map you use them. Toxin drain is no longer part of the game, so nothing here uses it. The campaign-long version is pinned at the end as an idea for later. That also removes the win-only cost rule and the chart.

## Short answer

A campaign is one patient's illness, about 10 maps on a body map. Between maps you're in the **Clinic**, where two things happen:

1. **Spend Samples** (the currency antigens drop when you kill them) on permanent upgrades for this campaign.
2. **Pick your loadout** for the next map: which cells you bring, plus at most one **treatment**.

The core rule for treatments: **every treatment is a big help on one map with a real tradeoff on that same map**. Nothing carries over, so a rough map never makes the rest of the campaign harder. What carries over is only what you buy: upgrades and vaccines.

## How a campaign flows

1. **Body map.** Levels are pinned to a body silhouette: fingertip papercut, throat, lungs, gut, and so on. Each one introduces one new antigen, as the roster does today.
2. **Before a map: the Clinic.** Shop, loadout, treatment, then Start.
3. **The map** plays as v3 does now. Kills drop Samples.
4. **After a map:** Samples counted.

## Currency: Samples

**Riffing on:** your immune system literally learns from the pieces of germs it destroys.

- Every antigen drops Samples when it dies, scaled by toughness: Staph 1, MRSA 3, a Strep chain 1 per link, the Tapeworm 50. They float to the lymph node in a little gold stream (nice juice, no meter).
- Maps are finite (scripted waves, a trickle that ends), so you can't farm a map by stalling.
- **First clear pays a bonus**; replaying a cleared map pays a quarter. That stops replay-farming from becoming the best strategy, which would be the grind Alex dislikes.
- Storm kills pay nothing ("nothing to learn from a massacre"). It keeps the storm a desperation move, not a farming tool. **Alex likes this (2026-10-08).**

Rough scale for tuning later: a map pays 100 to 250, a full campaign about 1,500, and the whole shop costs about 4,000. **You can afford roughly a third of it**, so every campaign ends up with a different build.

## Treatments (the Pharmacy)

At most one treatment per map, chosen in the loadout. Each has a clear upside and a clear cost, both on this map only. **Treatments are passive** (Alex, 2026-10-08): no new buttons during a map, since there's already plenty to manage and the Cytokine storm is the one active.

### Antibiotics
- **This map:** bacteria take double damage from plain shots, Nets and swallows.
- **Cost this map: resistance.** A share of bacteria (say 1 in 5) arrive resistant: armored, MRSA-style, so only Support rings kill them.
- **Why it's fun:** it changes your plan rather than just making you stronger. Your gunners shred normal bacteria, but you need more Support than usual for the tanks.

### Antifungals
- **This map:** fungus can't spread, and hyphae and spores die fast.
- **Cost this map: hard on the liver.** Fatigue recovers 1% slower (Alex, 2026-10-08: start gentle). True to life, antifungals are hard on the liver.
- **Why it's fun:** the cost lands on your body rather than on the germs, so it doesn't feel like the same card as antibiotics.

### Antivirals
- **This map:** viruses can't hijack your cells (Herpes, Measles) and Flu can't split.
- **Cost this map:** bacteria divide a bit faster (say 20%), since you're not fighting them with it.
- **Why it's fun:** the Herpes and Measles maps are the most frustrating ones, and this lets a struggling player get past one by trading a virus problem for a bacteria problem.

### Steroids (Alex's idea; Alex loves this version, 2026-10-08)
- **This map:** fatigue builds half as fast and the storm costs 30 instead of 50. It calms the systemic inflammation.
- **Cost this map:** production is 30% lower, so you have fewer troops.
- **Why it's fun:** it changes how you play rather than just making you stronger. You get a smaller, calmer army that can storm almost safely. Good for maps you keep losing to organ failure.

### Fever reducer (ibuprofen)
- **This map:** every fatigue tier starts 10 points later (Alex, 2026-10-08), so a tier that kicked in at 40 now kicks in at 50. You stay sharp longer before shots spray and cells slow.
- **Cost this map:** if fever slowing bacterial division goes into the game, that's off too, so bacteria multiply at full speed.
- It's the small, safe option, so there's always something reasonable to pick.

### Vaccine (bought, not a treatment slot)
- Bought in the shop for one antigen kind you've already met. From then on that kind arrives **tagged**: macrophages swallow it faster and shots do more. It's permanent for the campaign.
- This is where "antibodies kick in" ended up. Instead of building immunity during one map, you build it over the campaign by buying it.

## The upgrade shop

Bought with Samples, kept for the whole campaign. Most have 3 ranks. The groups are deliberately side by side so builds differ.

**Marrow (production)**
- Faster production (+8% per rank)
- One extra loadout slot (one rank, expensive)
- Body output top end raised

**Neutrophils (the gunners)**
- Damage, fire rate, lifespan
- Net neutrophils: bigger nets

**Macrophages (the eaters)**
- Gulp speed (the workshop showed this is what makes kill-clean play work), cap, and Support ring radius

**Specialists**
- NK cells: speed, and they can pop two infected cells before tiring
- Platelets (if clot walls go in): tougher walls
- Eosinophils (if added): bigger sticky bombs

**Body**
- Fatigue recovers faster
- Storm afterburn shorter

**Memory**
- Vaccines, one per antigen kind you've met (above). These are the strongest single buys and the most targeted: worth it only if you expect that kind again.

**Rules that keep it fun**
- **Upgrades are specializations.** A gunner build, an eater build and a balanced build should all clear the campaign. Bots check this: one bot per build, and each should finish.
- **No respec**, but ranks are cheap enough early that a bad buy doesn't sink you.
- **Maps are balanced for an average build** (about a third of the shop by that point). An unupgraded player should find late maps hard but not impossible, and a random-button player still loses.

## Loadout (seed packets)

- The Clinic shows the next map's antigens, with their icons, before you pick.
- **Neutrophils and macrophages always come.** You get **2 extra slots** (3 with the upgrade) for specialists: Net, NK, platelets, eosinophils, dendritic couriers, and anything later.
- **New specialists unlock free with progress**, the way PvZ hands you a new plant: beat Flu season, get the Net. That way nobody is locked out of a counter by spending poorly. The shop only makes them better.
- The production card on each zone then only shows what you brought, so it stays short on a phone.

## What moves out of the map

From the mechanics brainstorm:

| Idea | Where it goes now |
|---|---|
| Antibodies kick in (in-map learning) | Becomes Vaccines in the shop |
| Antibody power pick | Could become vaccine flavors (Opsonize, Agglutinate...) chosen when you buy one |
| Antibiotics pill | A passive treatment: bacteria take double damage, but some arrive resistant. No pill button |
| Immune memory | Same as Vaccines |
| Loadout | Kept, in the Clinic |
| Evolution (in-map) | Alex hasn't said. Recommended: keep it in-map |
| Clot walls, Tier 2 antigens and units | Unchanged; they become loadout picks and new maps |

## Pinned for later: treatment costs that carry across the campaign

Cut on 2026-10-08 because it makes campaigns snowball: a map you struggle with makes every later map harder, so a struggling player falls further behind. Kept here in case a harder mode wants it (for example as an Ascension-style modifier).

- **Resistance** (the germs get stronger): antibiotics add a point, and each point turns a slice of every later bacterial wave armored. Antivirals did the same for viral waves.
- **Scars** (your body gets weaker): antifungals scar the liver (fatigue recovers slower for the rest of the campaign), and steroids used twice scar the marrow (Body output tops out lower).
- **The chart:** a body silhouette between maps with resistance pips, cracked organs and vaccine rings.
- **Rest day:** skip to the next map to heal one scar or remove a Resistance point, at the price of a bigger trickle.
- **Win-only rule:** costs landed only when you won with the treatment, so retries weren't punished twice.

## Pinned for later: meta progression across campaigns

Alex (2026-10-08): pin as an idea for later, don't build now.

Alex generally hates these, so here are the versions that are least like a grind, best first. My recommendation is to do none at first, and if friends ask for one, do only A and B.

**A. Unlocks that add options, not power.** Finishing a campaign unlocks a new patient (a new campaign with different maps), a new starting specialist, or new cell skins. Like Slay the Spire's unlocks: more to choose from, never stronger. You never have to replay to get good enough.

**B. Harder patients (like Slay the Spire's Ascension).** Beat a campaign and you can start the next one with a modifier: "Immunocompromised" (smaller marrow), "Superbug era" (a share of every bacterial wave arrives armored), "Elderly" (fatigue recovers slower). Stack them. The progression is getting better at the game, not your numbers going up. This is the one most likely to please people who like meta without the grind.

**C. Family history (light power).** Finishing a campaign gives a choice of one inherited trait for the next campaign only ("Strong marrow", "Iron gut"). Swap freely. Small, and it doesn't stack forever.

**D. Classic permanent power (Rogue Legacy style).** Currency carries over and buys permanent stat boosts. This is what Alex hates, for good reason: it makes losing a strategy and turns difficulty into time spent. Skip it.

## Locked for building (Alex, 2026-10-08)

Alex: "anything I didn't give feedback on, let's build / follow your recommendations", except meta progression (pinned above).

- **Clinic between maps:** upgrade shop, loadout, one passive treatment, then Start.
- **Samples:** dropped by kills, scaled by toughness; first-clear bonus, replays pay a quarter, storm kills pay 0. No stars.
- **Treatments (passive, this map only):** Antibiotics, Antifungals, Antivirals, Steroids, Fever reducer, as written above.
- **Shop:** Marrow, Neutrophils, Macrophages, Specialists (NK, Net), Body, Memory (Vaccines). About 3 ranks each; a campaign affords roughly a third. No respec.
- **Vaccines:** one kind per antigen you've met; that kind arrives tagged (swallowed faster, shots do more) for the rest of the campaign. One flavor for now.
- **Loadout:** neutrophils and macrophages always; 2 specialist slots (3 with the upgrade). Specialists unlock free as you progress (recommended answer taken).
- **Body map** level select; losing a map means replaying it.
- **Evolution stays in-map** (recommended answer taken). It's an in-map mechanic, so it belongs with the main game's builder.
- Not now: clot walls and other Tier 2 units (they'd join the loadout later), meta progression, campaign-long treatment costs.

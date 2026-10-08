# Campaign brainstorm: treatments, upgrades and loadouts that carry across maps

Written 2026-10-07, following Alex's reply to the mechanics brainstorm (notes/mechanics-brainstorm.md):

- The best ideas work better as **buffs that persist across maps** than as things that happen inside one map. Example: run antibiotics or antifungals on a map you're struggling with, and it shapes the rest of the campaign. Steroids fight systemic inflammation but make your troops weaker or fewer.
- **Less into immunity developing during a single map** (so "Antibodies kick in" moves out of the map and into the campaign, below).
- **Likes a loadout before each map**, and **persistent upgrades bought with currency from destroying antigens**.
- A meta system across campaigns is optional. Alex generally hates them, so it's sketched last and kept small.

## Short answer

A campaign is one patient's illness, about 10 maps on a body map. Between maps you're in the **Clinic**, where three things happen:

1. **Spend Samples** (the currency antigens drop when you kill them) on permanent upgrades for this campaign.
2. **Pick your loadout** for the next map: which cells you bring, plus at most one **treatment**.
3. **Read your chart**: what your past treatments cost you.

The core rule for treatments: **every treatment is a big help on one map, paid for over the rest of the campaign**, in one of two ways:

- **Resistance**: the germs get stronger (antibiotics breed tougher bacteria).
- **Scars**: your body gets weaker (antifungals hurt the liver, steroids thin your marrow).

That gives you a "do I spend it here or save it?" question on every hard map, and it gives each campaign a story you made yourself.

## How a campaign flows

1. **Body map.** Levels are pinned to a body silhouette: fingertip papercut, throat, lungs, gut, and so on. Each one introduces one new antigen, as the roster does today.
2. **Before a map: the Clinic.** Shop, loadout, treatment, then Start.
3. **The map** plays as v3 does now. Kills drop Samples.
4. **After a map:** Samples counted, stars for a clean win, any treatment cost written onto your chart.
5. **Lose a map?** Retry it with everything you've bought. Treatment costs only land when you **win** with the treatment, so a failed attempt isn't punished twice.

## Currency: Samples

**Riffing on:** your immune system literally learns from the pieces of germs it destroys.

- Every antigen drops Samples when it dies, scaled by toughness: Staph 1, MRSA 3, a Strep chain 1 per link, the Tapeworm 50. They float to the lymph node in a little gold stream (nice juice, no meter).
- Maps are finite (scripted waves, a trickle that ends), so you can't farm a map by stalling.
- **First clear pays a bonus**; replaying a cleared map pays a quarter. That stops replay-farming from becoming the best strategy, which would be the grind Alex dislikes.
- **Stars pay a bonus**: a clean win (no storm, low fatigue, low toxin) pays more. That makes a clean win worth something without forcing it.
- Storm kills pay nothing ("nothing to learn from a massacre"). It keeps the storm a desperation move, not a farming tool.

Rough scale for tuning later: a map pays 100 to 250, a full campaign about 1,500, and the whole shop costs about 4,000. **You can afford roughly a third of it**, so every campaign ends up with a different build.

## Treatments (the Pharmacy)

At most one treatment per map, chosen in the loadout. Each has a clear upside this map and a clear cost on your chart for the rest of the campaign.

### Antibiotics
- **This map:** bacteria take double damage from everything, and you get one pill (a cloud that flushes bacteria down the flow).
- **Campaign cost: Resistance +1.** Each point turns a slice of every later bacterial wave into armored, MRSA-style bacteria (say +10% per point). Use it twice and later maps have noticeably more tanks.
- **Why it's fun:** it's the most tempting button in the game and it's honest about the price. Using it early to clear a wall you're stuck on makes the Gut map nastier later.

### Antifungals
- **This map:** fungus can't spread, and hyphae and spores die fast.
- **Campaign cost: Liver scar.** Toxin drains 15% slower for the rest of the campaign. (True to life: antifungals are hard on the liver.)
- **Why it's fun:** the cost lands on a different system from antibiotics, so the two don't feel like the same card. It makes Toxin load matter more as the campaign goes on.

### Antivirals
- **This map:** viruses can't hijack your cells (Herpes, Measles) and Flu can't split.
- **Campaign cost: Viral resistance +1.** Later viral waves are bigger (+20% per point).
- **Why it's fun:** the Herpes and Measles maps are the most frustrating ones, and this lets a struggling player buy their way past one, at a price.

### Steroids (Alex's idea)
- **This map:** fatigue builds half as fast, toxin spills over less, and the storm costs 30 instead of 50. It calms the systemic inflammation.
- **Cost this map:** production is 30% lower, so you have fewer troops.
- **Campaign cost: Marrow scar** if you use them twice or more: the Body output slider tops out lower for the rest of the campaign.
- **Why it's fun:** it changes how you play rather than just making you stronger. You get a smaller, calmer army that can storm almost safely. Good for maps you keep losing to organ failure.

### Fever reducer (ibuprofen)
- **This map:** the fatigue tiers' downsides (sprayed shots, slow cells) are switched off.
- **Cost this map:** if fever slowing bacterial division goes into the game, that's off too, so bacteria multiply at full speed.
- **No campaign cost.** It's the free, small option, so there's always something to pick that doesn't scar you.

### Vaccine (bought, not a treatment slot)
- Bought in the shop for one antigen kind you've already met. From then on that kind arrives **tagged**: macrophages swallow it faster and shots do more. It's permanent for the campaign.
- This is where "antibodies kick in" ended up. Instead of building immunity during one map, you build it over the campaign by buying it.

### Rest day (a skip)
- Skip straight to the next map to heal one scar or remove one Resistance point, but the next map's trickle starts bigger ("the infection grew while you rested").
- Gives a way out of a campaign you've treated yourself into a corner on, without a reset.

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
- Toxin drains faster (also offsets a Liver scar)
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

## Your chart (what you've done to yourself)

Between maps, a small body silhouette shows:
- **Resistance pips** on a germ icon (bacteria and viruses separately)
- **Scars** as cracks on the organ (liver, marrow, and others if more treatments come)
- **Vaccines** as gold rings on antigen icons

During a map you see nothing new; the costs just show up as tougher waves or a weaker stat. That keeps the in-map rule of two things to watch, fatigue and toxin. This is also where option C from the organ brainstorm (scars between levels) finally lands.

## What moves out of the map

From the mechanics brainstorm:

| Idea | Where it goes now |
|---|---|
| Antibodies kick in (in-map learning) | Becomes Vaccines in the shop |
| Antibody power pick | Could become vaccine flavors (Opsonize, Agglutinate...) chosen when you buy one |
| Antibiotics pill | A treatment, with resistance across the campaign |
| Immune memory | Same as Vaccines |
| Loadout | Kept, in the Clinic |
| Evolution (in-map) | Alex hasn't said. Could stay in-map, or become campaign Resistance, which already does a similar job |
| Clot walls, Tier 2 antigens and units | Unchanged; they become loadout picks and new maps |

## Optional: meta across campaigns

Alex generally hates these, so here are the versions that are least like a grind, best first. My recommendation is to do none at first, and if friends ask for one, do only A and B.

**A. Unlocks that add options, not power.** Finishing a campaign unlocks a new patient (a new campaign with different maps), a new starting specialist, or new cell skins. Like Slay the Spire's unlocks: more to choose from, never stronger. You never have to replay to get good enough.

**B. Harder patients (like Slay the Spire's Ascension).** Beat a campaign and you can start the next one with a modifier: "Immunocompromised" (smaller marrow), "Superbug era" (start with Resistance 2), "Elderly" (fatigue recovers slower). Stack them. The progression is getting better at the game, not your numbers going up. This is the one most likely to please people who like meta without the grind.

**C. Family history (light power).** Finishing a campaign gives a choice of one inherited trait for the next campaign only ("Strong marrow", "Iron gut"). Swap freely. Small, and it doesn't stack forever.

**D. Classic permanent power (Rogue Legacy style).** Currency carries over and buys permanent stat boosts. This is what Alex hates, for good reason: it makes losing a strategy and turns difficulty into time spent. Skip it.

## Questions for Alex

1. Treatment costs only land if you **win the map** with them (recommended), or as soon as you use them?
2. New specialists **unlock free with progress** (recommended), or are they bought in the shop?
3. Evolution: **keep in-map** (recommended, since it's what keeps late waves hard after you've upgraded) or drop it now that Resistance exists?

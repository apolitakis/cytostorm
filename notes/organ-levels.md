# Organ health: 4 bars per organ (main game)

Status: approved by Alex 22:48 ("build those 5 organ systems"). At 22:49 Alex changed the lungs to slow every cell, not only neutrophils, so damage can't be dodged by making a different unit. The spleen was changed to match (total cell limit instead of the macrophage limit); Alex approved at 22:51.

## Rules for every organ
- Each organ has **4 bars**. Its penalty steps up as each **whole** bar is lost (a scratch on bar 4 does nothing yet).
- **0 bars = Host failure.** Any one organ failing ends the match (Alex, 22:44).
- **Overload:** fatigue can now go past 100 (up to 150). While it's over 100, every organ loses health each second, and the rate grows the further past 100 you are. Some organs take it harder (the weight column below).
- While you're over 100, your body sheds fatigue 4× faster than normal recovery, so you can push into overload and climb back out.
- **Healing:** the liver and lungs regain a bar every 60 s while you're Fine (under 35 fatigue). The heart, kidneys, spleen and brain don't heal during a match. Campaign scars come later.
- **Exhausted** (85+) now only shrinks Support rings. It no longer slows production.

## The table

| Organ | Job | Overload weight | 3 bars | 2 bars | 1 bar |
|---|---|---|---|---|---|
| **Heart** | pumps new cells out | 1.0 (hit hardest) | Body output tops out at 1.75× | tops out at 1.5× | tops out at 1.25× |
| **Kidneys** | clear waste, so you recover | 0.8 | recovery 25% slower | 50% slower | 75% slower |
| **Lungs** | oxygen for every cell | 0.6 | all your cells move 10% slower (on top of Tired) | 20% slower | 30% slower |
| **Liver** | building blocks for new cells | 0.6 | cells made 15% slower | 30% slower | 45% slower |
| **Spleen** | immune cell reserve, filters blood | 0.4 | total cell limit 150 (from 180) | 120 | 90 |
| **Brain** | coordination: finding and chasing targets | 0.5 | every cell wanders 20% more | 40% more, and production mix changes take 3 s to kick in | 60% more, and delirium (the view's edges swim) |

## Breaches hurt organs (Alex, 22:59 and 23:03; built in v3 after Version 14)
- The old 20 s Lymph node timer no longer ends the match. Each organ has its own **breach clock** instead.
- **Filling:** a clock fills while any germ mapped to that organ sits in the Lymph node. It takes 20 s (`lymph.fill`), and a bigger crowd fills it faster: +10% per extra germ, capped at 2×.
- **Full clock:** the organ loses 1 bar and the clock resets.
- **Draining:** once that organ's germs are gone, its clock drains over 60 s (`lymph.drain`).
- **Clocks run side by side:** Staph and Herpes in the node fill the spleen's clock and the brain's clock at the same time.
- **Leaks:** each blood vessel leak (Sandbox Hepatitis and E. coli) adds 25% to its organ's clock (`lymph.leak`). The API is `game.breach(organ, amount)`.
- **The last bar:** breaches and overload can both take an organ's last bar, which is Host failure. Other direct hits (`hurtOrgan` with any other cause) stop at `organs.otherFloor`, which is 1.
- **On screen:** the Lymph node ring shows one ring per active organ, with that organ's icon inside.

| Organ | Germs that hurt it in the node |
|---|---|
| Brain | Herpes, Clostridium, Measles (Sandbox), Rabies (later) |
| Lungs | Influenza, Tuberculosis, Pseudomonas |
| Heart | MRSA, Toxic-shock Staph, Strep chains |
| Liver | Tapeworm, Hepatitis (Sandbox) |
| Kidneys | E. coli (Sandbox) |
| Spleen | Staph, Candida (and its threads) |

## Why these organs
- **Heart, kidneys, liver, lungs:** Alex's list. The heart is also the fatigue meter, so its bars show as cracks.
- **Spleen:** the most immune-specific organ. It stores immune cells and filters the blood.
- **Rule (Alex):** an organ's penalty must hit every unit, so you can't dodge it by making a different cell type.
- **Bone marrow (optional 6th):** where every immune cell is born. It overlaps with the liver's "cells made slower" penalty, so it's left out for now. If it's added, the liver should switch to toxin clearing (as in the Sandbox).

## Other damage sources
- Toxin over 40 hurts the kidneys (Sandbox, via `hurtOrgan`, which stops at 1 bar).

## Art
The liver and kidneys have 4-state sprites in the art kit (v7). Art kit v8 adds the heart, lungs and spleen in 5 states, and art kit v9 adds the brain (used from v3 Version 15 on).

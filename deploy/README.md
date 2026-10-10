# Cytostorm on Cloudflare Pages

Live: https://cytostorm.pages.dev (Pages project `cytostorm`, Alex's Cloudflare account; never touch `sonterra-tactics`).
**Production changes only when Alex says "ship it".** Everything else goes to a preview deployment first.

## Layout (since 2026-10-07: a hub, like Sonterra Tactics)

| URL | What | Source (read-only, owned by other threads) |
|---|---|---|
| `/` | hub page with a card per mode | `hub/index.html` (placeholders filled by make.py) |
| `/play/` | the game | `prototype/v3/index.html` (later: the campaign) |
| `/sandbox/` | mechanics workshop | `workshop/index.html` |
| `/v2/` | earlier build | `prototype/v2/index.html` |
| `/ost/` | soundtrack (music synthesized live, no audio files; back button sits above the page, not in a HUD) | `audio/ost/index.html` (Artifact 3iTN41i6ZkdAHyiGmDS4R5) |
| `/campaign/` | campaign (built on v3's sim; republished whenever v3 moves) | `campaign/index.html` (Artifact So5dsH9Ess5Q3EgKJG2Zdn) |
| `/workshop`, `/v3` | short links | `_redirects` |

`make.py` wraps each build with the iPhone head tags (viewport, Home Screen app tags, icon, manifest) and adds a ‹ button to
the start of the game's HUD row that goes back to the hub (a Home Screen app has no back button). The game files are not changed.

## Build

    python3 make.py "play=v3.4" sandbox=v12 v2=v2    # chips on the hub cards; omitted ones say "updated <date>"

Writes `site/` and `cytostorm-site.zip`. When a working folder has already moved past the published version, build that entry from
the published body instead: `python3 make.py play:<file> sandbox:<file>` (Artifact read of index.html, then strip the host's
`<!doctype html>...<body>\n` prefix and trailing `\n</body></html>`). Before deploying, check each source matches its **published Artifact** (working
folders can be mid-work): the workshop file is byte-identical to the body of https://claude.ai/artifact/FGcYg92WZeWxYipXeYoR4L.

## Deploy

    cp -r site $SCRATCH/deploy-site
    npx -y wrangler@4 pages deploy $SCRATCH/deploy-site --project-name cytostorm --branch preview --commit-dirty=true   # preview.cytostorm.pages.dev
    npx -y wrangler@4 pages deploy $SCRATCH/deploy-site --project-name cytostorm --branch main --commit-dirty=true      # production, on "ship it"

The cloud environment reaches api.cloudflare.com and cytostorm.pages.dev, but not preview.cytostorm.pages.dev, so check a
preview through the API (`/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/cytostorm/deployments`) and test the same bytes on a
local server in Playwright's Chromium (iPhone 13 profile).

## Deploy log
- 2026-10-07 13:34: production, v2 as a single page (before the hub).
- 2026-10-07 14:24: preview (branch `preview`), first hub: v3 draft (working file, not yet published), workshop on v3, v2.
- 2026-10-07 14:30: preview refreshed with published Cytostorm v3 (https://claude.ai/artifact/5ia5PRfq2KuoAvYLXXCfJW, version 1791383294-20d1, byte-identical to prototype/v3/index.html at 14:27). Pool water, Flu season and Lungs are tagged "not balanced yet" (Alex is fine with it).
- 2026-10-07 14:36: production (Alex: "Ship if!", 14:34). Same bytes as the 14:30 preview. Every file checked live by sha256, /workshop redirects, all pages and ‹ back buttons tested live in an iPhone 13 profile with no errors.
- 2026-10-07 14:46: preview refreshed with v3 version 3 (id 1791384139-9602, fight log + Send feedback with Share/Copy/Download). Byte-identical to prototype/v3/index.html at 14:42. Feedback flow checked locally at iPhone size. Production unchanged.
- 2026-10-07 14:50: preview refreshed with v3 version 4 (id 1791384358-d3dc, 1×/2×/3× speed button in the HUD; the ‹ button still fits at iPhone width). Production unchanged.
- 2026-10-07 14:52: preview refreshed with workshop version 4 (id 1791384466-4724, speed button) + v3 version 4. Both byte-identical to their published Artifacts. Ready to ship.
- 2026-10-07 14:54: production (Alex: "Ship It!", 14:52). Same bytes as the 14:52 preview: v3 version 4 (fight log, Send feedback, speed button), workshop version 4, v2. All files checked live by sha256 (sandbox was stale for under a minute, then matched); pages, back buttons and the feedback form tested live at iPhone size.
- 2026-10-07 16:58: preview: Sandbox = workshop version 5 (id 1791392151-ffe2, Fever slows division toggle + Measles), byte-identical to its published Artifact. Play/hub/v2 unchanged from production. Production still workshop v4.
- 2026-10-07 17:40: preview: Play = v3 version 5 (id 1791394632-f5de: Fungus/Candida, Athlete's foot level, heart meter) + Sandbox workshop version 5. Both byte-identical to their published Artifacts; pages, back buttons and feedback form tested locally at iPhone size. Production still v3 v4 + workshop v4.
- 2026-10-07 17:47: preview: Sandbox = workshop version 6 (id 1791395069-f076, on v3 v5: Candida, heart meter, Athlete's foot; keeps Fever gamble, Measles, Toxin load). Play still v3 v5. Both byte-identical to published. Production still v3 v4 + workshop v4.
- 2026-10-07 18:15: preview: Play = v3 version 6 (id 1791396807-39d7, antigens blink when they reproduce), byte-identical to published. Sandbox still workshop v6. Production still v3 v4 + workshop v4.
- 2026-10-07 18:20: preview: Sandbox = workshop version 7 (id 1791397068-5792, divide blink incl. Measles), byte-identical to published. Play still v3 v6. Production still v3 v4 + workshop v4.
- 2026-10-07 19:24: preview: Play = v3 version 7 (id 1791400904-0a1e, tutorial clips before each level + How to play tab; still one self-contained file), byte-identical to published. Sandbox still workshop v7. Pages, back buttons and feedback form tested locally. Production still v3 v4 + workshop v4.
- 2026-10-07 19:26: preview: Sandbox = workshop version 8 (id 1791401037-3331, matches v3 v7 + How to play tab), byte-identical to published. Play still v3 v7. Production still v3 v4 + workshop v4.
- 2026-10-07 21:21: preview: Play = v3 version 8 (id 1791407947-be20: no bpm on heart, "your body recovers", storm loss renamed Host failure, updated tutorial clips), byte-identical to published. Sandbox kept at published workshop v8 (the workshop folder already holds an unpublished rebuild, so site/sandbox was restored from the staged copy). Production still v3 v4 + workshop v4.
- 2026-10-07 21:26: preview: Sandbox = workshop version 9 (id 1791408060-3b8f: vertical phone layout, toxin puddles off by default) built from the published Artifact body (folder already had a newer Host-failure wording change). Play = published v3 v8 body (same bytes as before). Production still v3 v4 + workshop v4.
- 2026-10-07 21:32: preview: Sandbox = workshop version 10 (id 1791408606-86f9: on v3 v8, Host failure wording, fixes freeze on loss), from the published body. Play still published v3 v8. Production still v3 v4 + workshop v4.
- 2026-10-07 21:44: preview: Play = v3 version 9 (id 1791409261-91f6: vertical everywhere, storm charge, zone Off, 0/100% buttons, apply to all zones, loadouts, NK-only TB, Dev spawn sliders, new clips), published body. Tested at iPhone size and 1280x800 (map on the left, HUD and ‹ button on the right). Sandbox still workshop v10. Production still v3 v4 + workshop v4.
- 2026-10-07 21:47: preview: Play = v3 version 10 (id 1791409514-bffe, v9 + clips for loadouts and Apply to all zones), published body. Sandbox still workshop v10 (v11 held back by coordinator). Production still v3 v4 + workshop v4.
- 2026-10-07 22:00: preview: Play = v3 version 11 (id 1791410296-9a32, v10 + new Net: gold ring that pens germs in), published body. Sandbox still workshop v10 (waits for toxin rework). Production still v3 v4 + workshop v4.
- 2026-10-07 22:02: preview: Sandbox = workshop version 13 (id 1791410324-bd89, toxin rework: clears fast when rested, builds only when tired), published body. Play still v3 v11. Production still v3 v4 + workshop v4.
- 2026-10-07 22:05: preview: Sandbox = workshop version 14 (id 1791410537-08a4: always vertical, Reset in top bar, toxin rework), published body. On iPhone width the HUD row is full, so the 'Sandbox' label beside the ‹ button truncates to 'San' (cosmetic). Play still v3 v11. Production still v3 v4 + workshop v4.
- 2026-10-07 22:07: preview: Play = v3 version 12 (id 1791410602-520f, v11 + 'Body output 1.0×' label + Net tutorial clips), published body. Sandbox still workshop v14. Production still v3 v4 + workshop v4.
- 2026-10-07 22:10: production (Alex: "go ahead and ship", 22:06). Same bytes as the 22:07 preview: Play = v3 version 12, Sandbox = workshop version 14, v2. Hashes checked live; pages, ‹ buttons and feedback form tested live at iPhone size; forced a Host failure in the live Sandbox (fatigue 90 + Storm now): end screen shows and the page keeps running at ~60 fps (no freeze).
- 2026-10-07 22:21: preview: Sandbox = workshop version 15 (id 1791411504-954d: organ health, liver + kidneys in the vessel, Hepatitis and E. coli leakers, Jaundice / Bad water / Running on empty combos), published body. Play still v3 v12. Production unchanged (v3 v12 + workshop v14).
- 2026-10-07 22:38: preview: Sandbox = workshop version 16 (id 1791412541-fa94: on v3 v12, real organ art, Organ status button/window that pauses, Fatigue and toxins clip), published body. Play still v3 v12. Production unchanged (v3 v12 + workshop v14).
- 2026-10-07 22:41: preview: Play = v3 version 13 (id 1791412762-72ea, clips say Body output instead of marrow), published body. Sandbox still workshop v16. Production unchanged (v3 v12 + workshop v14).
- 2026-10-07 22:43: preview: Sandbox = workshop version 17 (id 1791412766-c09b, v16 + Body output clip label, toxin bar hidden while organ health is on), published body. Play = v3 v13. Production unchanged (v3 v12 + workshop v14).
- 2026-10-07 23:02 preview: Play = v3 Version 14 (id 1791413907-2c4a, five organs, overload to 150, Organ status window); Sandbox unchanged (workshop v17). https://401eb5f3.cytostorm.pages.dev
- 2026-10-07 23:30 preview: Play = v3 Version 15 (id 1791415590-6a8d, Lymph node breach clocks, brain as 6th organ, one-row organ meters); Sandbox unchanged (workshop v17). https://d12f63ed.cytostorm.pages.dev
- 2026-10-07 23:35 preview: Play = v3 Version 16 (id 1791415934-158e, v15 + tutorial clips v14); Sandbox unchanged (workshop v17). https://91d5057e.cytostorm.pages.dev
- 2026-10-07 23:41 preview (SHIP SET): Play = v3 Version 16 (id 1791415934-158e); Sandbox = workshop Version 18 (id 1791416297-7fb6, toxin is an Experiment toggle, off by default).
- 2026-10-08 00:12 preview (SHIP SET): Play = v3 Version 19 (id 1791417911-c155, double-tap zoom, power buttons per sector, number-only zone counters); Sandbox = workshop Version 19 (id 1791418049-a9c4, same UI). Double-tap zoom tested on both wrapped pages. https://cf508d40.cytostorm.pages.dev
- 2026-10-08 00:14 PRODUCTION (Alex: "ship it!" 00:10): promoted the preview bytes. Play = v3 Version 19 (id 1791417911-c155), Sandbox = workshop Version 19 (id 1791418049-a9c4). https://3fe100c4.cytostorm.pages.dev. Live verified: hashes, pages, back buttons, feedback form, double-tap zoom.
- 2026-10-08 00:30 preview: added /ost/ (OST Artifact V1 id 1791419267-1ea4), Soundtrack card on the hub, /ost short link. Play v3 V19, Sandbox workshop V19 unchanged. https://568aa1d0.cytostorm.pages.dev
- 2026-10-08 00:34 preview: Play = v3 Version 20 (id 1791419409-be9a, Bloodstream music, effects, mute button/M) + /ost/ V1; Sandbox workshop V19 unchanged. https://6bed631d.cytostorm.pages.dev
- 2026-10-08 00:40 preview (SHIP SET): Play = v3 Version 20 (id 1791419409-be9a), Sandbox = workshop Version 20 (id 1791419546-e57b, sound + mute), /ost/ V1. HUD back button narrowed to 26px: with the new mute button the Sandbox HUD row overflowed a 375px iPhone by 5px; now fits at 375 and 390.
- 2026-10-08 00:43 PRODUCTION (Alex: "ship" 00:40): promoted the preview bytes. Play = v3 Version 20 (id 1791419409-be9a), Sandbox = workshop Version 20 (id 1791419546-e57b), /ost/ OST V1 (id 1791419267-1ea4) + Soundtrack hub card. https://2a010113.cytostorm.pages.dev. Live verified: hashes, /ost redirect, pages, back buttons, feedback form, zoom, OST playback.
- 2026-10-08 01:06 preview: Play = v3 Version 21 (id 1791421256-d35b, phone layout: wider map, side progress rail, no legend), /ost/ = OST V2 (id 1791420864-997e); Sandbox workshop V20 unchanged. Play checked at 375x667, 375x812, 402x874, 430x932: no horizontal overflow, HUD row on one line. https://3a4052f4.cytostorm.pages.dev
- 2026-10-08 01:10 preview (SHIP SET): Play = v3 V21 (id 1791421256-d35b), Sandbox = workshop V21 (id 1791421500-fac3, phone layout + census rail), /ost/ = OST V2 (id 1791420864-997e). Sandbox checked at 375x667, 375x812, 402x874, 430x932: no overflow, HUD on one line. https://7a07a747.cytostorm.pages.dev
- 2026-10-08 01:33 preview: Play = v3 Version 22 (id 1791422970-e8e1, second vessel on the right edge, rail outside it); Sandbox workshop V21 and /ost/ V2 unchanged. Checked 375x667, 375x812, 402x874, 430x932: vessel and rail side by side, no overflow.
- 2026-10-08 01:39 preview (SHIP SET): Play = v3 Version 23 (id 1791423270-9c94, clips V17), Sandbox = workshop Version 22 (id 1791423316-1cb6, second vessel), /ost/ V2 unchanged. Both checked at 375x667, 375x812, 402x874, 430x932: no overflow. https://1226ff0f.cytostorm.pages.dev
- 2026-10-08 01:45 PRODUCTION (Alex: "ship" 01:43 in this thread): promoted the preview bytes. Play = v3 Version 23 (id 1791423270-9c94), Sandbox = workshop Version 22 (id 1791423316-1cb6), /ost/ = OST V2 (id 1791420864-997e). https://8a3ba1b1.cytostorm.pages.dev. Live verified: hashes, pages, back buttons, feedback form, zoom, OST playback, Play at 375/402/430 px.
- 2026-10-08 11:12 preview: Play = v3 Version 25 (id 1791457381-bbcd), Sandbox = workshop Version 24 (id 1791457564-5bfb): Deep tissue 4th sector, 10% Lymph node strip, MRSA slow death, clips V18. /ost/ V2 unchanged. Checked 375x667, 375x812, 390x844, 402x874, 430x932: no overflow; lymph strip is one row (label, count, stance, breach clock, power), stance pill shrinks to its icon at 375. https://da6dcd63.cytostorm.pages.dev
- 2026-10-08 12:30 preview: Play = v3 Version 26 (id 1791462154-7f24, clips V20, quorum bursts, sector output labels), NEW /campaign/ = Campaign V1 (id 1791461920-1de9) with the hub's Campaign card un-dimmed (make.py entry 'campaign', /campaign short link); Sandbox workshop V24 and OST V2 unchanged. Play checked at 375/390/402/430; Campaign map, Clinic, Papercut battle checked at 375/390/430, no overflow.
- 2026-10-08 12:33 preview: /campaign/ = Campaign V2 (id 1791462466-e2e4, built on Play V26, shop section renamed Production; no visible "marrow" text left). Play V26, Sandbox V24, OST V2 unchanged.
- 2026-10-08 12:36 preview (SHIP SET): Play = v3 V26 (id 1791462154-7f24), Sandbox = workshop V25 (id 1791462645-a2d6, on Play V26 + clips V20), Campaign V2 (id 1791462466-e2e4), OST V2. Sandbox checked at 375/390/402/430, no overflow.
- 2026-10-08 13:04 preview (CLEAN SHIP SET): Play v3 V26 (1791462154-7f24) + Sandbox V26 (1791464376-41fd) + Campaign V4 (1791464415-2768) + OST V2 (1791420864-997e); no evolve in any page; deploy https://96536051.cytostorm.pages.dev. Production unchanged (01:45).
- 2026-10-08 13:06 PRODUCTION (Alex "Ship!" 13:05 in thread): promoted the 13:04 preview bytes unchanged = Play v3 V26 + Sandbox V26 + Campaign V4 (card live) + OST V2; deploy https://adc463bb.cytostorm.pages.dev; live hashes match, phone tests pass.
- 2026-10-08 13:3x preview: Play v3 V27 (1791466115-dad1, clips V22, Evolution) + Sandbox V26 + Campaign V4 + OST V2 (others byte-identical); Sandbox/Campaign rebuilds on V27 to follow. Production unchanged (13:06).
- 2026-10-08 13:38 preview (V27 SHIP SET): Play v3 V27 (1791466115-dad1) + Sandbox V27 (1791466547-b87f) + Campaign V5 (1791466540-24fd, Stress wording) + OST V2; deploy https://1b830f5f.cytostorm.pages.dev. Production unchanged (13:06).
- 2026-10-08 14:3x preview: Play v3 V29 (1791469230-7229, 3x units, clips V23) + Sandbox V28 (1791469435-32ad) + Campaign V5 (still V27-based) + OST V2. Flu season local run peaked 2109 germs, headless fps 6-7 at peaks (software rendering). Production unchanged (13:06).
- 2026-10-08 14:3x preview (3x SHIP SET): Play v3 V29 (1791469230-7229) + Sandbox V28 (1791469435-32ad) + Campaign V6 (1791469731-704b, on V28 sources) + OST V2. Production unchanged (13:06).
- 2026-10-09 01:28 PRODUCTION (Alex "Ship and publish" 01:27 via coordinator): Play v3 V29 + Sandbox V28 + Campaign V6 + OST V2, game pages byte-identical to preview 2bb39015 (hub date only changed); deploy https://6f05f3ca.cytostorm.pages.dev; live hashes match.
- 2026-10-09 12:5x preview: Play v3 V30 (1791550509-e3d7, difficulty, new side layout) + Sandbox V28 + Campaign V6 + OST V2 (others byte-identical). Sandbox/Campaign on V30 to follow. Production unchanged (2026-10-09 01:28).
- 2026-10-09 13:0x preview: + Campaign V7 (1791550672-50ac, on V30, always Normal; checked a Hard pick in /play/ does not carry over). Set = Play V30 + Sandbox V28 + Campaign V7 + OST V2. Production unchanged.
- 2026-10-09 13:0x preview (V30 SHIP SET): Play v3 V30 (1791550509-e3d7) + Sandbox V29 (1791550976-5cdf) + Campaign V7 (1791550672-50ac) + OST V2. deploy https://5587277a.cytostorm.pages.dev (first try hit a transient wrangler error). Production unchanged (01:28).
- 2026-10-09 13:14 preview (V31 SHIP SET, clips V24): Play v3 V31 (1791551319-3a9a) + Sandbox V30 (1791551487-a9af) + Campaign V8 (1791551388-c143) + OST V2; deploy https://1d7f8f59.cytostorm.pages.dev. Production unchanged (01:28).

## Friends
Open the link in Safari, Share > Add to Home Screen. It launches full screen with the neutrophil icon, like an app.

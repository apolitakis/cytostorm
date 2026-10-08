# Cytostorm

An immune-system tower defense game: Plants vs Zombies, but the immune system, with more physics, a dynamic counter
system and increasingly hostile waves. It runs in the browser today (https://cytostorm.pages.dev); a native iPhone
build is planned.

## Play it locally

Each build is one self-contained HTML page, so open it in a browser:

- `prototype/v3/index.html`: the main game (Play on the site)
- `workshop/index.html`: the Sandbox
- `audio/ost/index.html`: the soundtrack

## Where things are

| Folder | What it is |
|---|---|
| `prototype/` | The game. `v3/` is current (`python3 build.py` rebuilds `index.html`); `v2/` and the top-level v1 are earlier builds. `assets/` is the art kit. |
| `workshop/` | The Sandbox, a fork of the game for trying antigens and mechanics (`python3 fork_ui.py && python3 build.py`). |
| `tutorial/` | Tutorial animation clips, inlined into the game and the Sandbox. |
| `audio/` | Every sound and music track, synthesized in code (`cytosound.js`, the OST page, the Sound Lab). |
| `deploy/` | Cloudflare Pages site: hub page, icons, `make.py`, and the built `site/`. See `deploy/README.md`. |
| `notes/` | Design docs: antigen roster, organ levels, campaign and mechanics brainstorms, names. |
| `tools/` | Repo tooling, including the nightly snapshot script that keeps this repo up to date. |

Left out on purpose: zip bundles, rendered audio files (`node audio/render.js` remakes them), and chat uploads.

Many scripts and notes were written in a Claude project where this folder lived at `/mnt/project-files/`, so some
default paths still point there.

## Working together

The main copy lives in Alex's Claude project, and this repo mirrors it with a nightly snapshot. To contribute, work on a
branch and open a pull request against `main`; don't push to `main` directly.

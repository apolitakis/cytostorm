# Cytostorm audio (draft 1)

Owned by the Sound effects and music thread. cytosound.js (set from Alex's stars, 2026-10-08) is handed to the game build thread to wire in.

- OST page for the site (/ost/): src/ost.html -> ost/index.html, https://claude.ai/artifact/3iTN41i6ZkdAHyiGmDS4R5
- Sound lab page: https://claude.ai/artifact/XURhUMJc6YddtGzfGLE4eZ (built from this folder).
  Alex's stars are saved in the page's database: collection `picks`, doc `favorites` (`ids`, `names`).
- `src/engine.js`: every sound and music track, synthesized with Web Audio (no samples, no licensing).
  One global `CytoSound` { makeBus, SFX, TRACKS, HEART, Player, scheduleLoop, loopLength, seed }.
  Works on any BaseAudioContext, so the game can include it directly (like tutorial.js) or use the rendered files.
- `src/page.html` + `build.py` -> `index.html` (inlines engine.js and a few art-kit icons, read-only from prototype/assets/).
- `render.js`: renders every sound to `renders/*.wav` and one loop of each track to `renders/music-*.m4a`,
  offline in headless Chromium, and prints peak/RMS levels. `node render.js` (needs playwright).
  The .m4a/.wav files are what a native SpriteKit build would load.

Notes: iPhone speakers barely play below ~150 Hz, so low sounds (heartbeat, kicks) carry an overtone layer.
The page sets `navigator.audioSession.type = 'playback'` so Safari 17+ plays even with the silent switch on.

## Game module: cytosound.js
Built by `python3 build.py` from src/game-api.js + src/engine.js. One function scope, only global `window.CytoAudio`
(inline it like tutorial.js). 44 KB, no files to load. API:
- `unlock()` call inside the first tap/click handler (iPhone needs it).
- `play(moment, {x 0..1 | pan, pitch, vol})` moments: shot, swallow, kill, burst, net, nk, divide, organHit,
  stormBlast, hostFailure, waveStart, victory. No sound on purpose for breach clocks, button taps or the organ window. Busy moments go through CytoSound.Gate (engine.js): per-moment cooldowns (shot 100 ms), skipped hits make the next one slightly louder, and at most 6 fight sounds per 250 ms.
  Breach clocks deliberately have no sound (Alex); a full clock is heard as organHit.
- `storm()` on press -> `.fire()` on release after 5 s, `.cancel()` if released early.
- `heartbeat('fine'|'tired'|'feverish'|'exhausted'|'overload'|null)`.
- `danger({germs, cells, fatigue, breach 0..1, organMin, progress 0..1})` a few times a second drives Bloodstream's intensity.
  v2 (2026-10-08): continuous heat score, rises over ~2.5 s and falls over ~6 s, hysteresis, holds each level >= 4 bars
  (except a jump to Crisis), Calm only after 6 s with no germs. Optional `progress` (game.t / game.duration) only nudges upward late.
- Wave swell (Alex wants it): `play('waveStart', {final})` (already called by the game on each wave) also runs `swell()`:
  a riser into the next bar line, crash + low hit on the downbeat, one level up (two for a final wave; a swell alone caps at
  Fever), held ~8 bars, then eases down a level at a time. Waves back to back extend the swell and get a crash, without stacking.
  `swell(final)` is also exposed. Engine side: `Player.prototype.swell(level, big)` queues the level change for that exact bar.
- `music('petri'|'blood'|'fever'|'parade'|null, intensity)`, `intensity(0..4)` for Bloodstream layers (Calm, Fight, Hot, Fever, Crisis).
- `mute(on?)`, `muted`, `volume({sfx, music})`, `pick(moment, variant)`.
Which variant each moment uses is the PICKS table in src/game-api.js (set from Alex's stars 2026-10-08; arrays = random between starred variants), then rebuild.

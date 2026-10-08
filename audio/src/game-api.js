// CytoAudio: Cytostorm's music and sound effects as one drop-in script for the game.
// Built by audio/build.py into audio/cytosound.js. Everything is synthesized (no files to load).
// Only global: window.CytoAudio. Call CytoAudio.unlock() inside the first tap/click handler (iPhone rule).
(function () {
'use strict';
const LIB = {};
/*ENGINE*/

const C = LIB.CytoSound, S = C.SFX;

// Which variant plays for each game moment, from Alex's stars in the Sound Lab (2026-10-08).
// An array means Alex starred both: each play picks one at random, for variety.
// No sound on purpose (Alex): breach clocks (a full clock is heard as organHit), button taps, the organ window.
// play() on a moment not listed here is a silent no-op that returns false.
const PICKS = {
  shot: 'shotPew',            // a neutrophil fires
  swallow: ['gulp', 'slurp'], // a macrophage eats a germ
  kill: ['pop', 'crunch'],    // a germ dies
  burst: 'burstTight',        // spores hatch, a Strep chain breaks, many kills at once
  net: 'netCinch',            // a Net cell pens germs
  nk: 'zap',                  // an NK cell kills an infected cell
  divide: 'blink',            // with the blink before a germ divides
  organHit: 'flatShort',      // an organ loses a bar
  stormBlast: 'stormBlast',   // storm released (storm().fire() plays this)
  hostFailure: 'flatline',    // the match is lost
  waveStart: 'waveDrums',     // a wave enters at the wound
  victory: 'victoryArp'       // last wave cleared
};
// Cooldowns, bunching and a fight-sound budget so a crowded fight can't stack voices (CytoSound.Gate in engine.js).
const gate = new C.Gate();

let ctx = null, bus = null, player = null, muted = false, vol = { sfx: 0.75, music: 0.62 };
let heart = { timer: null, state: null, next: 0, n: 0 };

function unlock() {
  if (!ctx) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'interactive' });
    bus = C.makeBus(ctx);
    bus.sfx.gain.value = vol.sfx; bus.music.gain.value = vol.music; bus.master.gain.value = muted ? 0 : 0.9;
    player = new C.Player(bus); player.quantize = true; player.level = level;
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }
  if (ctx.state !== 'running') ctx.resume();
  return true;
}
const ready = () => ctx && ctx.state === 'running' && !muted;


// play('shot', {x: 0..1 across the map, or pan: -1..1, pitch: 1, vol: 1}); play('waveStart', {final}) also swells the music
function play(moment, o) {
  if (!ready()) return false;
  const boost = gate.ask(moment, performance.now());
  if (!boost) return false;
  let pick = PICKS[moment] || moment;
  if (Array.isArray(pick)) pick = pick[Math.floor(Math.random() * pick.length)];
  const fn = S[pick]; if (!fn) return false;
  o = o || {};
  const opts = {
    pan: o.pan != null ? o.pan : o.x != null ? (o.x * 2 - 1) * 0.7 : 0,
    p: o.pitch || (C.GATE.fight[moment] ? 0.9 + Math.random() * 0.2 : 1),
    v: (o.vol == null ? 1 : o.vol) * boost, k: o.k || 0
  };
  fn(bus, ctx.currentTime + 0.01, opts);
  if (moment === 'waveStart') swell(o.final);
  return true;
}

// Cytokine storm: storm() on press, then .fire() on release after 5 s, or .cancel() if released early.
function storm() {
  if (!ready()) return { fire() {}, cancel() {} };
  const h = S.stormCharge(bus, ctx.currentTime + 0.01);
  return { fire: () => h.fire(ctx.currentTime + 0.01), cancel: () => h.cancel(ctx.currentTime + 0.01) };
}

// heartbeat('fine' | 'tired' | 'feverish' | 'exhausted' | 'overload' | null to stop)
function heartbeat(state) {
  if (heart.state === state) return;
  if (heart.timer) clearInterval(heart.timer);
  heart = { timer: null, state, next: 0, n: 0 };
  if (!state || !ctx || !C.HEART[state]) return;
  const keys = Object.keys(C.HEART), hs = C.HEART[state], hard = keys.indexOf(state) / (keys.length - 1);
  heart.next = ctx.currentTime + 0.05;
  heart.timer = setInterval(() => {
    while (heart.next < ctx.currentTime + 0.3) {
      if (!muted) S.heartbeat(bus, heart.next, { hard, v: 0.7 });
      heart.n++;
      heart.next += hs.gap * (hs.skip && heart.n % 3 === 0 ? 1.6 : 1) * (1 + (Math.random() - 0.5) * 0.04);
    }
  }, 50);
}

// music('petri' | 'blood' | 'fever' | 'parade' | null, intensity 0..4 for 'blood': Calm, Fight, Hot, Fever, Crisis)
function music(track, intensity) {
  if (!player) return;
  if (intensity != null) setIntensity(intensity);
  if (!track) return player.stop();
  if (player.track !== track) { heat = level; lastChange = -1e9; noGermsFor = 0; lastCall = 0; swellUntil = -1e9; player.play(track); }
}
let level = 1;
function setIntensity(lvl) { level = lvl; if (player) player.level = lvl; }

// Danger-driven Bloodstream (Alex's pick). Call a few times a second with the match state:
// danger({germs, cells, fatigue 0..150, breach 0..1 fullest clock, organMin fewest bars left on any organ,
//         progress 0..1 how far into the level (optional)})
// v2 (Alex 2026-10-08: "jumps around a lot as new waves come in; cheat a little on how far into the fight"):
// - The inputs make a continuous heat score (0 Calm .. 4 Crisis) instead of hard thresholds.
// - Heat rises over a few seconds and falls more slowly, so a wave spawning (germs briefly outnumbering cells)
//   or a short lull between waves no longer flips the music.
// - Levels need clear headroom to change (hysteresis) and hold for at least 4 bars, except a jump to Crisis.
// - progress lifts the floor late in the level (Hot in roughly the last fifth while germs are out) and nudges
//   real danger upward near the end; lulls in the second half stay at Fight instead of Calm.
// - Changes still land on the next bar. Wave arrivals swell the music on purpose (see swell above).
const D = { rise: 2.5, fall: 6, up: 0.15, down: 0.35, hold: 7.7, calmAfter: 6, swell: 15.5 };
let lastAccent = -1e9, lastScore = 1, heat = 1, lastChange = -1e9, noGermsFor = 0, lastCall = 0, swellUntil = -1e9, swellLevel = 0;

// Wave swell (Alex: "the music swelling when a new wave gets introduced is great"): every play('waveStart')
// runs a riser into the next bar line and steps the music up one level there (two for a final wave), holds it
// for about 8 bars, then lets the heat ease down one level at a time. No extra wiring needed.
function swell(final) {
  const now = performance.now() / 1000;
  if (now < swellUntil && !final) {                                              // waves back to back: extend, don't stack,
    swellUntil = now + D.swell;                                                    // but still mark the new wave with a crash
    if (player && player.track === 'blood' && now - lastAccent > 6) { player.swell(level, false); lastAccent = now; }
    return;
  }
  // every wave is heard: a riser and crash, and one level up from where the music is (two for a final wave).
  // A swell alone tops out at Fever, so Crisis still means real trouble underneath.
  const cap = Math.floor(lastScore) >= 3 ? 4 : 3;
  swellLevel = Math.max(level, Math.min(cap, level + (final ? 2 : 1))); swellUntil = now + D.swell;
  if (player && player.track === 'blood') player.swell(swellLevel, !!final); else setIntensity(swellLevel);
  level = swellLevel; heat = Math.max(heat, swellLevel + 0.2); lastChange = now; lastAccent = now;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
function dangerScore(d, quiet) {
  const prog = clamp(d.progress || 0, 0, 1), f = d.fatigue || 0, br = d.breach || 0;
  let s = 0;
  if (d.germs) s = 1 + clamp((d.germs / ((d.cells || 0) + 1) - 0.5) / 1.5, 0, 0.9);  // outnumbered pushes toward Hot, slowly
  else if (!quiet) s = 1;                                                               // short lull: still Fight
  if (br > 0) s = Math.max(s, 1.9 + br * 1.6);                                          // a clock filling: Hot, past half: Fever
  if (f >= 35) s = Math.max(s, f < 60 ? lerp(1.4, 2.4, (f - 35) / 25) : f <= 100 ? lerp(2.6, 3.6, (f - 60) / 40) : 4.2);
  if (d.organMin != null) s = Math.max(s, d.organMin <= 1 ? 4.2 : d.organMin <= 2 ? 3 : 0);
  // the cheat: how far into the level
  if (d.germs || !quiet) s = Math.max(s, 1 + 1.3 * Math.pow(prog, 1.5)) + 0.6 * prog * prog; // floor reaches Hot in the last stretch, plus a nudge
  else s = Math.max(s, prog > 0.5 ? 1 : 0);                                              // long lulls late in a level stay at Fight
  return clamp(s, 0, 4.5);
}
function danger(d, nowMs) {
  d = d || {};
  const now = (nowMs != null ? nowMs : performance.now()) / 1000;
  const dt = lastCall ? clamp(now - lastCall, 0, 1) : 0.25; lastCall = now;
  noGermsFor = d.germs ? 0 : noGermsFor + dt;
  let score = dangerScore(d, noGermsFor >= D.calmAfter);
  lastScore = score;
  if (now < swellUntil) score = Math.max(score, swellLevel + 0.2);                      // hold the swell
  const tau = score > heat ? D.rise : D.fall;
  heat += (score - heat) * (1 - Math.exp(-dt / tau));
  let target = level;
  if (heat >= level + 1 + D.up) target = Math.min(4, Math.floor(heat - D.up));
  else if (heat < level - D.down) target = Math.max(0, Math.ceil(heat + D.down) - 1);
  const urgent = target === 4 && score >= 4;
  if (target !== level && (urgent || now - lastChange >= D.hold)) { setIntensity(target); lastChange = now; }
  return level;
}

function mute(on) {
  muted = on == null ? !muted : !!on;
  if (bus) bus.master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
  return muted;
}
function volume(v) {
  Object.assign(vol, v || {});
  if (bus) { bus.sfx.gain.value = vol.sfx; bus.music.gain.value = vol.music; }
}

window.CytoAudio = {
  unlock, play, storm, heartbeat, music, intensity: setIntensity, danger, swell, mute, volume,
  get muted() { return muted; },
  moments: Object.keys(PICKS),
  pick(moment, variant) { if (S[variant]) PICKS[moment] = variant; },
  variants: Object.keys(S)
};
})();

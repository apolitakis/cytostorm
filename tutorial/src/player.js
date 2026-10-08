'use strict';
// ---------------------------------------------------------------------------
// Cytostorm tutorial player: plays a list of clips in a box, with a caption,
// Back / Replay / Next and a Skip. This is the piece the game embeds.
//
//   await CytoTutorial.ready();                       // loads the art kit images
//   const ids = CytoTutorial.forLevel('papercut', newAntigenKinds);
//   CytoTutorial.play(hostElement, ids, { onDone() { ... } });
//
// Depends on the global ART (prototype/assets/assets.js). Styles are injected once.
// ---------------------------------------------------------------------------
const CytoTutorial = (function () {
  const BASICS = ['goal', 'divide', 'cards', 'shutoff', 'modes', 'output', 'organs', 'toxin', 'storm', 'stormRisk'];
  // Antigen kind (sim.js KINDS) -> its intro clip
  const BY_KIND = { mrsa: 'mrsa', pseudo: 'pseudo', flu: 'flu', spore: 'spore', clos: 'spore', yeast: 'yeast', tb: 'tb', toxic: 'toxic', strep: 'strep', virus: 'herpes', worm: 'worm' };
  // Sandbox-only systems (toxin load stays out of the main game); not part of BASICS
  const SYSTEMS = ['toxload'];
  const ANTIGENS = ['mrsa', 'pseudo', 'flu', 'spore', 'yeast', 'tb', 'strep', 'toxic', 'herpes', 'worm'];
  // Clips to play before a level: the basics before the first level, then one per new antigen
  function forLevel(levelKey, newKinds) {
    if (levelKey === 'papercut') return BASICS.slice();
    return [...new Set((newKinds || []).map(k => BY_KIND[k]).filter(Boolean))];
  }
  let readyP = null;
  const ready = () => readyP || (readyP = ART.loadAll());

  const CSS = `
.cyt { --cyt-ink: #DDE6F5; --cyt-dim: #7A86A0; --cyt-line: #1E2540; --cyt-panel: #0A0D18; --cyt-panel2: #10152A; --cyt-cell: #3FE6FF; --cyt-void: #04050A;
  --cyt-display: "Instrument Sans", "Helvetica Neue", Arial, sans-serif; --cyt-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; color: var(--cyt-ink); font: 14px/1.4 var(--cyt-display); box-sizing: border-box; }
.cyt * { box-sizing: border-box; }
.cyt [hidden] { display: none !important; }
.cyt-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cyt-eye { font: 500 11px/1 var(--cyt-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--cyt-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cyt-skip { margin-left: auto; background: none; border: 0; color: var(--cyt-dim); font: 500 12.5px var(--cyt-display); padding: 4px 2px; cursor: pointer; }
.cyt-stage { position: relative; flex: 1 1 auto; min-height: 200px; border-radius: 14px; overflow: hidden; background: var(--cyt-void); border: 1px solid var(--cyt-line); }
.cyt-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; cursor: pointer; }
.cyt-paused { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(4,5,10,.45); font: 600 13px var(--cyt-mono); letter-spacing: .1em; color: var(--cyt-ink); pointer-events: none; }
.cyt-prog { height: 3px; border-radius: 2px; background: var(--cyt-panel2); overflow: hidden; }
.cyt-prog i { display: block; height: 100%; width: 0; background: var(--cyt-cell); box-shadow: 0 0 6px var(--cyt-cell); }
.cyt-text { display: grid; gap: 4px; min-height: 5.6em; align-content: start; }
.cyt-title { margin: 0; font: 650 20px/1.1 var(--cyt-display); font-stretch: 85%; text-wrap: balance; }
.cyt-cap { margin: 0; color: var(--cyt-ink); opacity: .82; font-size: 14.5px; text-wrap: pretty; min-height: 2.8em; }
.cyt-btns { display: flex; gap: 8px; }
.cyt-btns button { flex: 1 1 0; background: var(--cyt-panel); border: 1px solid var(--cyt-line); border-radius: 10px; padding: 10px 8px; font: 600 14px var(--cyt-display); color: var(--cyt-ink); cursor: pointer; }
.cyt-btns button:disabled { opacity: .35; cursor: default; }
.cyt-btns .cyt-next { flex: 1.6 1 0; background: var(--cyt-cell); border-color: var(--cyt-cell); color: var(--cyt-void); }
.cyt-btns .cyt-next.ready { box-shadow: 0 0 0 0 rgba(63,230,255,.6); animation: cyt-pulse 1.4s ease-out infinite; }
.cyt button:focus-visible { outline: 2px solid #FFD23F; outline-offset: 2px; }
.cyt-dots { display: flex; gap: 5px; justify-content: center; }
.cyt-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--cyt-line); }
.cyt-dots i.on { background: var(--cyt-cell); }
.cyt-dots i.seen { background: var(--cyt-dim); }
@keyframes cyt-pulse { to { box-shadow: 0 0 0 10px rgba(63,230,255,0); } }
@media (prefers-reduced-motion: reduce) { .cyt-btns .cyt-next.ready { animation: none; } }`;
  function injectCss() {
    if (document.getElementById('cyt-css')) return;
    const s = document.createElement('style'); s.id = 'cyt-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // Play clips in host. opts: { eyebrow, onDone(skipped), loop (default true), start (index), doneLabel }
  // Playback speed: clips play at half speed so each caption stays up twice as long (Alex, 2026-10-08),
  // except a clip's realtime spans (clip seconds, e.g. the storm's 5 s hold), which tick in real seconds.
  const SPEED = 0.5;
  function warp(clip) {
    if (clip._warp) return clip._warp;
    const segs = []; let c = 0;
    for (const [a, b] of (clip.realtime || []).slice().sort((x, y) => x[0] - y[0])) {
      if (a > c) segs.push([c, a, SPEED]);
      segs.push([Math.max(a, c), b, 1]); c = Math.max(c, b);
    }
    if (c < clip.dur) segs.push([c, clip.dur, SPEED]);
    let r = 0; for (const sg of segs) { sg.push(r); r += (sg[1] - sg[0]) / sg[2]; }
    return (clip._warp = { segs, real: r });
  }
  const realDur = clip => warp(clip).real;
  // real seconds since the clip started -> clip seconds
  function clipTime(clip, rt) {
    for (const [a, b, k, r0] of warp(clip).segs) if (rt <= r0 + (b - a) / k) return a + Math.max(0, rt - r0) * k;
    return clip.dur;
  }
  function play(host, ids, opts = {}) {
    injectCss();
    ids = ids.filter(id => CYT_CLIPS[id]);
    host.innerHTML = `<div class="cyt">
      <div class="cyt-head"><span class="cyt-eye"></span><button type="button" class="cyt-skip">Skip</button></div>
      <div class="cyt-stage"><canvas aria-hidden="true"></canvas><div class="cyt-paused" hidden>PAUSED</div></div>
      <div class="cyt-prog"><i></i></div>
      <div class="cyt-text"><h3 class="cyt-title"></h3><p class="cyt-cap" aria-live="polite"></p></div>
      <div class="cyt-btns"><button type="button" class="cyt-back">Back</button><button type="button" class="cyt-replay">Replay</button><button type="button" class="cyt-next">Next</button></div>
      <div class="cyt-dots"></div>
    </div>`;
    const $ = s => host.querySelector(s), cv = $('canvas'), c2d = cv.getContext('2d');
    let i = Math.max(0, Math.min(ids.length - 1, opts.start || 0)), t = 0, last = 0, paused = false, raf = 0, played = false, closed = false;
    const seen = new Set();
    const dots = $('.cyt-dots');
    dots.innerHTML = ids.length > 1 ? ids.map(() => '<i></i>').join('') : '';
    function show(n) {
      i = n; t = 0; played = false;
      const clip = CYT_CLIPS[ids[i]];
      $('.cyt-eye').textContent = `${opts.eyebrow || 'How to play'}${ids.length > 1 ? ` · ${i + 1} of ${ids.length}` : ''}`;
      $('.cyt-title').textContent = clip.title;
      $('.cyt-back').disabled = i === 0;
      $('.cyt-next').textContent = i === ids.length - 1 ? (opts.doneLabel || 'Got it') : 'Next';
      $('.cyt-next').classList.remove('ready');
      $('.cyt-skip').hidden = i === ids.length - 1 && ids.length > 1;
      [...dots.children].forEach((d, k) => { d.className = k === i ? 'on' : seen.has(k) ? 'seen' : ''; });
      caption();
    }
    let capText = '';
    function caption() {
      const clip = CYT_CLIPS[ids[i]], tt = clipTime(clip, t);
      let txt = clip.cap[0][1];
      for (const [at, s] of clip.cap) if (tt >= at) txt = s;
      if (txt !== capText) { capText = txt; $('.cyt-cap').textContent = txt; }
    }
    function frame(now) {
      if (closed) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      const clip = CYT_CLIPS[ids[i]], hold = 1.6;
      const len = realDur(clip), ct0 = clipTime(clip, t);
      if (!paused) t += dt;
      if (t > len + hold) {
        if (!played) { played = true; seen.add(i); $('.cyt-next').classList.add('ready'); }
        if (opts.loop === false) t = len + hold; else t = 0;
      }
      const ct = clipTime(clip, t);
      const r = cv.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      if (!r.width || !r.height) return;
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      CYT.render(c2d, clip, ct, r.width, r.height, dpr, paused || t > len ? 0 : Math.max(0, ct - ct0));
      $('.cyt-prog i').style.width = `${Math.min(100, t / len * 100)}%`;
      caption();
    }
    function done(skipped) { close(); if (opts.onDone) opts.onDone(skipped); }
    function close() { closed = true; cancelAnimationFrame(raf); }
    $('.cyt-next').addEventListener('click', () => { seen.add(i); if (i < ids.length - 1) show(i + 1); else done(false); });
    $('.cyt-back').addEventListener('click', () => { if (i > 0) show(i - 1); });
    $('.cyt-replay').addEventListener('click', () => { t = 0; paused = false; $('.cyt-paused').hidden = true; });
    $('.cyt-skip').addEventListener('click', () => done(true));
    cv.addEventListener('click', () => { paused = !paused; $('.cyt-paused').hidden = !paused; });
    show(i);
    ready().then(() => { if (!closed) raf = requestAnimationFrame(frame); });
    return { show: n => show(Math.max(0, Math.min(ids.length - 1, n))), close, get index() { return i; } };
  }
  // Render one frame of a clip into any canvas (for thumbnails or a custom host)
  function drawFrame(canvas, id, t) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    CYT.render(canvas.getContext('2d'), CYT_CLIPS[id], t, r.width, r.height, dpr, 0);
  }
  return { BASICS, ANTIGENS, SYSTEMS, BY_KIND, CLIPS: CYT_CLIPS, SPEED, forLevel, ready, play, drawFrame, clipTime, length: id => realDur(CYT_CLIPS[id]), engine: CYT };
})();
if (typeof window !== 'undefined') window.CytoTutorial = CytoTutorial;

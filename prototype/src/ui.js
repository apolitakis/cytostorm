'use strict';
// ---------------------------------------------------------------------------
// Immune RTS fun-test prototype: rendering, input, HUD, dev tools.
// ---------------------------------------------------------------------------
(function () {
  const $ = s => document.querySelector(s);
  const STEP = 1 / 60;
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
  const PAL = ART.palette;
  const ALERT_COL = [ART.alert.quiet, ART.alert.watch, ART.alert.inflamed, ART.alert.max];
  const ALERT_ART = ['alert-quiet', 'alert-watch', 'alert-inflamed', 'alert-max'];
  const LEVEL_HINTS = [
    'Few cells come here, and the alert adds no inflammation.',
    'The default. A normal share of cells and very light inflammation.',
    'Pulls about 3× the cells and they move faster. Inflames this sector.',
    'Pulls about 6× the cells, fastest of all. Heavy inflammation that burns the host quickly.',
  ];
  const STANCE_HINTS = {
    eat: 'Swallow a couple of bacteria, then die.',
    trap: 'Die casting nets that pin bacteria. Nets hurt tissue.',
    kill: 'Eat bacteria, gather samples. Inflames.',
    repair: 'Heal tissue and calm it. No samples.',
  };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };

  mergeConfig(store.get('immuneRts.tuning'));
  let seed = store.get('immuneRts.seed') || 1;
  let game = null, scenarioKey = 'papercut';
  let paused = false, speedIdx = 2, acc = 0, last = 0;
  let modal = null; // 'start' | 'choice' | 'end' | null
  let selSector = null, endShown = false;
  const overlay = { alarm: false, stats: false };

  // ---- canvas and sprites ----
  const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage');
  let dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
  const img = {};
  const spr = {};
  let bg = null, bgDmg = null;
  // Fixed random offsets, drift speeds and phases for the antibody particles
  const AB_PER_TILE = 5, abSeed = new Float32Array(N * AB_PER_TILE * 4);
  for (let i = 0; i < abSeed.length; i += 4) { abSeed[i] = Math.random(); abSeed[i + 1] = Math.random(); abSeed[i + 2] = 0.3 + Math.random() * 0.9; abSeed[i + 3] = Math.random() * 6.28; }
  const fieldCv = document.createElement('canvas'); fieldCv.width = GW; fieldCv.height = GH;
  const fctx = fieldCv.getContext('2d'), fimg = fctx.createImageData(GW, GH);
  // World size of each sprite's 64-unit box, chosen so the body radius reads at phone size.
  const SPRITE_WORLD = {
    neutrophil: 64 * 7.5 / 13, 'neutrophil-trap': 64 * 7.5 / 13,
    'macrophage-kill': 64 * 13 / 22, 'macrophage-repair': 64 * 13 / 22,
    bacterium: 64 * 5 / 9, 'bacterium-dividing': 64 * 6.2 / 12, 'bacterium-opsonized': 64 * 5 / 9, 'bacterium-complement': 64 * 5 / 9,
    pollen: 64 * 8 / 18, antibody: 7,
  };

  function makeSprite(name, worldSize) {
    const px = Math.max(4, Math.ceil(worldSize * scale * dpr));
    const c = document.createElement('canvas'); c.width = c.height = px;
    c.getContext('2d').drawImage(img[name], 0, 0, px, px);
    spr[name] = { c, w: worldSize };
  }
  function glowDot(name, color, worldR) {
    const px = Math.max(4, Math.ceil(worldR * 4 * scale * dpr)), c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d'), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, px, px);
    spr[name] = { c, w: worldR * 4 };
  }
  function tileWorld(name, tileW) {
    const k = scale * dpr, c = document.createElement('canvas');
    c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
    const g = c.getContext('2d'), im = img[name], th = tileW * im.naturalHeight / im.naturalWidth;
    for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tileW) g.drawImage(im, x * k, y * k, tileW * k + 1, th * k + 1);
    return c;
  }
  function buildGraphics() {
    if (!img.tissue) return;
    for (const n in SPRITE_WORLD) makeSprite(n, SPRITE_WORLD[n]);
    makeSprite('net', 64 * CONFIG.trap.netRadius / 28);
    makeSprite('toxin-burst', 64 * CONFIG.toxin.radius / 30);
    glowDot('pop', PAL.germHi, 2.5);
    glowDot('popPollen', PAL.pollenHi, 2.5);
    glowDot('debris', 'rgba(110,123,150,0.55)', 2);
    bg = tileWorld('tissue', 128);
    bgDmg = tileWorld('tissue-damaged', 128);
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / W, cssH / H);
    ox = (cssW - W * scale) / 2; oy = (cssH - H * scale) / 2;
    buildGraphics();
  }

  function draw(name, x, y, rot, alpha, sizeMul) {
    const s = spr[name]; if (!s) return;
    const w = s.w * (sizeMul || 1);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(s.c, -w / 2, -w / 2, w, w);
      ctx.restore();
    } else ctx.drawImage(s.c, x - w / 2, y - w / 2, w, w);
  }

  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, cv.width, cv.height);
    const g = game;
    if (!g || !bg) return;
    const k = scale * dpr, t = g.t, ad = g.ad;
    ctx.setTransform(k, 0, 0, k, ox * dpr, oy * dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // Tissue, cross-faded toward damaged by each sector's share of Host Damage
    ctx.globalAlpha = 0.5; ctx.drawImage(bg, 0, 0, W, H);
    for (let s = 0; s < 3; s++) {
      const a = Math.min(0.9, g.sectors[s].dmg / 25);
      if (a > 0.01) { ctx.globalAlpha = a; ctx.drawImage(bgDmg, 0, s * SECTOR_H * k, W * k, SECTOR_H * k, 0, s * SECTOR_H, W, SECTOR_H); }
    }
    ctx.globalAlpha = 1;

    // Vessels and the cut
    const vb = img['vessel-blood'], vl = img['vessel-lymph'], tw = 96, th = 48;
    const flow = (now / 1000 * 14) % tw;
    for (let x = -tw + flow; x < W; x += tw) ctx.drawImage(vb, x, -10, tw, th);
    for (let x = -flow; x < W + tw; x += tw) ctx.drawImage(vl, x, H - th + 10, tw, th);
    if (!g.sc.pollen) {
      const open = Math.max(0.25, 1 - t / CONFIG.bacteria.closeTime);
      ctx.globalAlpha = 0.35 + 0.65 * open;
      for (let i = 0; i < 3; i++) ctx.drawImage(img.wound, 135 + i * 110, 450 - 27, 110, 55);
      ctx.globalAlpha = 1;
    }

    // Fields: inflammation haze, damage tint, optional alarm (dev)
    const d = fimg.data;
    for (let i = 0; i < N; i++) {
      const inf = g.inf[i], vis = g.vis[i], al = overlay.alarm ? Math.min(1, g.alarm[i]) : 0;
      const ab = g.ab[i] * 0.22;
      d[i * 4] = Math.min(255, 255 * inf * 0.95 + 120 * vis * 0.4 + 180 * al + 255 * ab);
      d[i * 4 + 1] = Math.min(255, 122 * inf * 0.95 + 20 * vis * 0.4 + 92 * al + 210 * ab);
      d[i * 4 + 2] = Math.min(255, 61 * inf * 0.95 + 30 * vis * 0.4 + 255 * al + 63 * ab);
      d[i * 4 + 3] = 255;
    }
    fctx.putImageData(fimg, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.6; ctx.drawImage(fieldCv, 0, 0, W, H);

    // Antibodies: a drifting dust of tiny particles, count per tile = local density.
    // Most are gold specks; every few is a tiny Y glyph so the shape still reads.
    if (ad.state === 'active' || ad.level > 0) {
      const ts = now / 1000;
      ctx.fillStyle = PAL.antibody;
      for (let i = 0; i < N; i++) {
        const n = g.ab[i] * AB_PER_TILE;
        if (n < 0.5) continue;
        const bx = (i % GW) * CELL, by = ((i / GW) | 0) * CELL;
        for (let j = 0; j < n; j++) {
          const q = (i * AB_PER_TILE + j) * 4;
          const x = bx + abSeed[q] * CELL + Math.sin(ts * abSeed[q + 2] + abSeed[q + 3]) * 7;
          const y = by + abSeed[q + 1] * CELL + Math.cos(ts * abSeed[q + 2] * 0.8 + abSeed[q + 3] * 1.3) * 7;
          if (j % 5 === 4) draw('antibody', x, y, ts * 0.6 + abSeed[q + 3], 0.9);
          else { ctx.globalAlpha = 0.55 + 0.45 * Math.sin(ts * 3 + abSeed[q + 3]) ** 2; ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
        }
      }
    }

    // Debris and nets
    for (const db of g.debris) draw('debris', db.x, db.y, 0, Math.min(1, db.life / 10));
    for (const n of g.nets) draw('net', n.x, n.y, n.rot, Math.min(1, n.life / 4) * 0.9);

    // Pathogens
    const opso = ad.state === 'active' && ad.choice === 'opsonize', comp = ad.state === 'active' && ad.choice === 'complement';
    for (const p of g.path) {
      if (p.kind === 'p') { draw('pollen', p.x, p.y, p.rot + t * 0.2, Math.min(1, p.life / 6)); continue; }
      let name = 'bacterium';
      const a = (opso || comp) ? g.ab[cellIdx(p.x, p.y)] : 0;
      if (p.div < 1.2 && p.pin <= t) name = 'bacterium-dividing';
      else if (a > 0.2) name = opso ? 'bacterium-opsonized' : 'bacterium-complement';
      draw(name, p.x, p.y, p.rot, p.pin > t ? 0.5 : 0.8);
    }

    // Friendly cells
    for (const c of g.neut) draw(c.stance === 'trap' ? 'neutrophil-trap' : 'neutrophil', c.x, c.y, c.ph + t * 0.5, Math.min(1, c.life / 3));
    for (const c of g.mac) draw(c.stance === 'repair' ? 'macrophage-repair' : 'macrophage-kill', c.x, c.y, c.ph + t * 0.15, Math.min(1, c.life / 4));

    // Effects
    for (const f of g.fx) {
      const age = (t - f.born) / f.dur;
      if (f.type === 'pop') draw(f.kind === 'p' ? 'popPollen' : 'pop', f.x, f.y, 0, 0.5 * (1 - age), 1 + age);
      else if (f.type === 'toxin') draw('toxin-burst', f.x, f.y, 0, 1 - age, 0.4 + 0.6 * Math.min(1, age * 1.6));
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    // Fever: warm vignette
    if (g.fever.active) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      gr.addColorStop(0, 'rgba(255,122,61,0)'); gr.addColorStop(1, `rgba(255,122,61,${0.18 + 0.06 * Math.sin(now / 300)})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // Sector boundaries and labels, in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = 'rgba(221,230,245,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
    for (let s = 1; s < 3; s++) { const y = oy + s * SECTOR_H * scale; ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + W * scale, y); ctx.stroke(); }
    ctx.setLineDash([]);
    if (selSector != null) {
      ctx.strokeStyle = ALERT_COL[g.sectors[selSector].alert]; ctx.lineWidth = 2;
      ctx.strokeRect(ox + 1, oy + selSector * SECTOR_H * scale + 1, W * scale - 2, SECTOR_H * scale - 2);
    }
    const cnt = [0, 0, 0];
    for (const p of g.path) cnt[secOf(p.y)]++;
    ctx.font = '600 12px "Instrument Sans", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (let s = 0; s < 3; s++) {
      const sec = g.sectors[s], x = ox + 6, y = oy + s * SECTOR_H * scale + (s === 0 ? 26 : 8);
      const label = `${sec.key} · ${sec.name}`, lvl = LEVELS[sec.alert];
      const w1 = ctx.measureText(label).width, w2 = ctx.measureText(lvl).width;
      const boxW = 18 + 4 + w1 + 10 + 16 + 4 + w2 + 10;
      ctx.fillStyle = 'rgba(4,5,10,0.72)'; roundRect(x, y, boxW, 22, 11); ctx.fill();
      ctx.drawImage(img[sec.icon], x + 4, y + 2, 18, 18);
      ctx.fillStyle = PAL.ui; ctx.fillText(label, x + 24, y + 11.5);
      ctx.drawImage(img[ALERT_ART[sec.alert]], x + 24 + w1 + 8, y + 3, 16, 16);
      ctx.fillStyle = ALERT_COL[sec.alert]; ctx.fillText(lvl, x + 24 + w1 + 26, y + 11.5);
      // Right side: pathogens here and this sector's share of Host Damage
      const rx = ox + W * scale - 6;
      const txt = `${cnt[s]}`, dm = `${sec.dmg.toFixed(0)}% dmg`;
      const wt = ctx.measureText(txt).width, wd = ctx.measureText(dm).width;
      const bw = 10 + 8 + wt + 10 + wd + 8;
      ctx.fillStyle = 'rgba(4,5,10,0.72)'; roundRect(rx - bw, y, bw, 22, 11); ctx.fill();
      ctx.fillStyle = g.sc.pollen ? PAL.pollen : PAL.germ;
      ctx.beginPath(); ctx.arc(rx - bw + 10, y + 11, 3.5, 0, 6.29); ctx.fill();
      ctx.fillStyle = PAL.ui; ctx.fillText(txt, rx - bw + 18, y + 11.5);
      ctx.fillStyle = sec.dmg > 10 ? PAL.damage : PAL.uiDim; ctx.fillText(dm, rx - wd - 8, y + 11.5);
      if (overlay.stats) {
        let nn = 0, mm = 0;
        for (const c of g.neut) if (secOf(c.y) === s) nn++;
        for (const c of g.mac) if (secOf(c.y) === s) mm++;
        ctx.fillStyle = PAL.uiDim;
        ctx.fillText(`neut ${nn} · mac ${mm} · infl ${(sec.inf * 100).toFixed(0)}% · alarm ${g.secAlarm[s].toFixed(1)}`, x + 4, y + 34);
      }
    }
    if (paused && !modal) {
      ctx.fillStyle = 'rgba(4,5,10,0.55)'; ctx.fillRect(ox, oy, W * scale, H * scale);
      ctx.fillStyle = PAL.ui; ctx.font = '600 20px "Instrument Sans", Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Paused', ox + W * scale / 2, oy + H * scale / 2); ctx.textAlign = 'left';
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- HUD ----
  const fmt = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function hud() {
    const g = game; if (!g) return;
    const load = g.load(), host = g.hostDamage();
    $('#vLoad').textContent = `${load.toFixed(0)}%`;
    $('#fLoad').style.width = `${Math.min(100, load)}%`;
    $('#mLoad').classList.toggle('pollen', g.sc.pollen);
    $('#mLoad').classList.toggle('warn', load > 75);
    $('#vHost').textContent = `${host.toFixed(0)}%`;
    $('#fHost').style.width = `${Math.min(100, host)}%`;
    $('#fScar').style.width = `${Math.min(100, g.scar)}%`;
    $('#mHost').classList.toggle('warn', host > 75);
    $('#clock').textContent = fmt(g.t);

    const ad = g.ad, A = CONFIG.adaptive, sb = $('#sampleBtn');
    let sl = '', sf = 0;
    if (ad.state === 'none') { sl = `Lymph node: sample ${Math.floor(g.sample / A.sampleNeeded * 100)}%`; sf = g.sample / A.sampleNeeded; }
    else if (ad.state === 'ready') { sl = 'Sample ready: choose antibodies'; sf = 1; }
    else if (ad.state === 'ramping') { sl = `${cap(ad.choice)} antibodies in ${Math.ceil(A.delay - (g.t - ad.t0))}s`; sf = 1; }
    else { sl = `${cap(ad.choice)} antibodies: output ${Math.round(ad.level * 100)}%`; sf = ad.level; }
    $('#sampleLabel').textContent = sl;
    $('#fSample').style.width = `${Math.min(100, sf * 100)}%`;
    sb.classList.toggle('ready', ad.state === 'ready');

    $('#nCount').textContent = g.neut.length;
    $('#mCount').textContent = g.mac.length;
    for (const type of ['neut', 'mac']) {
      const st = g.stance[type];
      document.querySelectorAll(`.seg[data-type="${type}"] button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.st === st)));
      const p = g.switchProgress(type), h = $(type === 'neut' ? '#nHint' : '#mHint');
      if (p < 1) { h.textContent = `Switching to ${cap(st)}: ${Math.round(p * 100)}%`; h.classList.add('switching'); }
      else { h.textContent = STANCE_HINTS[st]; h.classList.remove('switching'); }
    }
    let boost = 0;
    for (const s of g.sectors) boost += Math.max(0, s.alert - 1);
    $('#rate').textContent = boost ? `+${Math.round(CONFIG.production.alertBoost * boost * 100)}%` : '';
    const mix = Math.round(g.mix * 100);
    if (document.activeElement !== $('#mix')) $('#mix').value = mix;
    $('#mixN').textContent = `${mix}% neut.`; $('#mixM').textContent = `${100 - mix}% macro.`;
    const F = g.fever, fb = $('#feverBtn');
    fb.classList.toggle('active', F.active);
    fb.disabled = !F.active && F.cd > 0;
    $('#feverState').textContent = F.active ? `On ${Math.ceil(F.left)}s` : F.cd > 0 ? `Cooldown ${Math.ceil(F.cd)}s` : 'Ready';

    $('#banner').innerHTML = hintText(g);
    if (selSector != null) sheetStats();
    $('#speedTag').hidden = SPEEDS[speedIdx] === 1;
    $('#speedTag').textContent = `${SPEEDS[speedIdx]}×`;
    $('#pauseBtn').textContent = paused ? '▶' : 'II';
    $('#pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  function hintText(g) {
    const ad = g.ad, I = CONFIG.inflammation;
    if (g.result) return '';
    if (g.sc.pollen) {
      if (g.t < CONFIG.pollen.season) return `Pollen season: <b>${fmt(CONFIG.pollen.season - g.t)}</b> left. Get the host through it.`;
      return 'Season over. The last grains are clearing.';
    }
    if (g.phase === 'standdown') {
      return `Infection cleared. <b>Stand down</b>: lower alerts, switch macrophages to Repair. Inflammation ${(g.meanInf * 100).toFixed(1)}%, ends below ${(I.calm * 100).toFixed(1)}%.`;
    }
    const close = CONFIG.bacteria.closeTime - g.t;
    const cut = close > 0 ? `Cut closes in <b>${fmt(close)}</b>.` : 'The cut has closed. Clear the rest.';
    if (g.t < 20 && g.inputs === 0) return `Bacteria are pouring in through the cut. <b>Tap a sector</b> to set its alert.`;
    if (ad.state === 'ready') return `${cut} The lymph node has a sample: <b>tap it</b> to make antibodies.`;
    return cut;
  }

  // ---- sector sheet ----
  function buildLevels() {
    const box = $('#levels'); box.innerHTML = '';
    LEVELS.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.lvl = i; b.style.setProperty('--lv', ALERT_COL[i]);
      b.innerHTML = `<img src="${artUrl(ALERT_ART[i])}" alt="">${name}`;
      b.addEventListener('click', () => { if (game && selSector != null) { game.setAlert(selSector, i); sheetUpdate(); } });
      box.appendChild(b);
    });
  }
  function openSheet(s) {
    selSector = s; $('#sheet').hidden = false; sheetUpdate();
  }
  function closeSheet() { selSector = null; $('#sheet').hidden = true; }
  function sheetUpdate() {
    if (selSector == null || !game) return;
    const sec = game.sectors[selSector];
    $('#sheetTitle').textContent = `${sec.key} · ${sec.name}`;
    $('#sheetIcon').src = artUrl(sec.icon);
    document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.lvl === sec.alert)));
    $('#sheetHint').textContent = LEVEL_HINTS[sec.alert];
    sheetStats();
  }
  function sheetStats() {
    const s = selSector, g = game; let p = 0, c = 0;
    for (const q of g.path) if (secOf(q.y) === s) p++;
    for (const q of g.neut) if (secOf(q.y) === s) c++;
    for (const q of g.mac) if (secOf(q.y) === s) c++;
    $('#sheetStats').textContent = `${p} ${g.sc.pollen ? 'grains' : 'bacteria'} · ${c} cells · inflamed ${(g.sectors[s].inf * 100).toFixed(0)}%`;
  }

  // ---- modals ----
  function artUrl(n) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.svg[n]); }
  function openModal(kind, html) {
    modal = kind; $('#mbox').innerHTML = html; $('#modal').hidden = false;
    const f = $('#mbox').querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  function closeModal() { modal = null; $('#modal').hidden = true; }


  // ---- guide: what each unit is for, and what every control does ----
  let guideTab = 'goal', guideFrom = null;
  function guideHtml(tab) {
    const C = CONFIG, A = C.adaptive, F = C.fever, img = n => `<img src="${artUrl(n)}" alt="">`;
    const unit = (icon, name, tag, why, items) => `<div class="unit">${img(icon)}<h4>${name}<small>${tag}</small></h4><p class="why">${why}</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    const S = {
      goal: `
        <p>You run the immune response but never steer a cell. You change settings, the cells act on them, and you read what happens. Every setting is a tradeoff, and your own response counts toward Host Damage, so overreacting can lose as surely as underreacting.</p>
        ${unit('meter-pathogen', 'Pathogen Load', 'lose at 100%', 'How much infection is in the tissue.', [
          'Bacteria in <b>Blood entry</b> or <b>Lymph exit</b> count 1.5× because they are escaping into the body.',
          'In Pollen it fills with harmless grains. Read it with that in mind.'])}
        ${unit('meter-host', 'Host Damage', 'lose at 100%', 'Everything that hurts the host: bacteria, toxin bursts, and also your inflammation, nets and fever.', [
          `The dark part of the bar is <b>scarring</b>, the permanent ${Math.round(C.host.scarFrac * 100)}% share. Repair macrophages can heal only the bright part.`,
          'The end screen shows where the damage came from.'])}
        <div class="sub">How a Papercut match goes</div>
        <ol class="phases">
          <li><b>Breach.</b> Bacteria pour in through the cut and double. Raise the wound's alert so innate cells hold the line.</li>
          <li><b>Sample.</b> Kill-stance macrophages carry samples to the lymph node. When the bar fills you choose antibodies.</li>
          <li><b>Ramp-up.</b> Antibodies start slowly, then double every ${A.doubling} s. This is where the match turns.</li>
          <li><b>Stand down.</b> Once the cut has closed and the bacteria are gone, lower alerts and switch macrophages to Repair. The match ends when inflammation settles.</li>
        </ol>
        <p>In <b>Pollen</b> the invader is harmless. The match ends when the season does, and the stars reward holding back.</p>`,
      cells: `
        <p>Innate cells are fast and generic. They hold the line but usually can't finish the job alone, and every one of them costs the host something.</p>
        ${unit('neutrophil', 'Neutrophil', 'the swarm', 'Fast, cheap and short-lived. Numbers over quality: your answer to fast-growing bacteria.', [
          `<b>Eat</b> (default): each swallows ${C.neutrophil.maxEats} bacteria, then dies and leaves debris that inflames tissue until a macrophage cleans it.`,
          '<b>Trap</b> (one-way for each cell): the cell dies casting a net that pins and slowly kills every bacterium inside. Strong on dense clumps, but nets hurt the tissue under them.',
          'Too small to eat pollen grains.'])}
        ${unit('macrophage-kill', 'Macrophage', 'tank and cleanup', `Slow, costs ${C.macrophage.cost}× a neutrophil and lives about ${Math.round(C.macrophage.life / 60)} minutes. Its stance switch is the stand-down decision.`, [
          '<b>Kill</b> (default): eats bacteria steadily and is the only way to collect samples for the lymph node. Amplifies damage alarms and inflames the tissue around it.',
          '<b>Repair</b>: stops sampling, cleans debris, heals Host Damage where tissue is hurt, and calms inflammation nearby. It still eats bacteria it bumps into.',
          'The orange core means Kill, the green core means Repair.'])}
        ${unit('antibody', 'Antibodies', 'slow and precise', 'The payoff of the match. Not units but a gold dust that spreads through tissue. Innate cells hold; antibodies win.', [
          `Available only after a full sample. They take ${A.delay} s to start, then output doubles every ${A.doubling} s.`,
          '<b>Opsonize</b>: tags invaders so your cells eat them several times faster. No extra inflammation.',
          '<b>Complement</b>: kills invaders directly, but every kill inflames the tissue.',
          'They seep in faster where tissue is inflamed, so some inflammation helps them reach the fight.'])}`,
      enemies: `
        ${unit('bacterium', 'Bacteria', 'Papercut', 'Exponential growth is the clock. Small numbers get big fast, so a late response costs far more than an early one.', [
          `Each one doubles about every ${C.bacteria.doublingTime} s, slower when crowded. Fever halves that rate.`,
          `More pour in through the cut until it closes at ${fmt(C.bacteria.closeTime)}. The banner counts down.`,
          `<b>Toxin bursts</b>: a clump of ${C.toxin.quorum} or more can burst, damaging the host and killing nearby cells. Break clumps up early.`,
          'Bacteria about to divide switch to a two-part shape, so you can see growth happening.'])}
        ${unit('pollen', 'Pollen', 'Pollen', 'The restraint test. It looks like an invasion but does no harm on its own.', [
          'It doesn\'t multiply and deals no damage. Grains dissolve on their own over time.',
          'Neutrophils can\'t eat it and macrophages engulf it slowly, so Pathogen Load stays high.',
          'Escalating, fever or antibodies only hurt the host. Antibodies against pollen even inflame the tissue, like an allergy.'])}`,
      controls: `
        ${unit('alert-inflamed', 'Sector alert', 'tap a sector', 'The main dial and the main source of self-inflicted damage. It sets where cells go and how inflamed each area gets.', [
          '<b>Quiet</b>: few cells come and no inflammation from the alert.',
          '<b>Watch</b> (default): a normal share of cells and very light inflammation.',
          '<b>Inflamed</b>: about 3× the cells, which move and eat faster. Inflames the sector.',
          '<b>Max</b>: about 6× the cells, fastest of all. Heavy inflammation that burns the host quickly.',
          `Each step above Watch, in any sector, also speeds up the bone marrow by ${Math.round(C.production.alertBoost * 100)}%.`,
          'Inflammation lingers after you lower an alert, so plan the stand-down early.'])}
        ${unit('stance-eat', 'Stance cards', 'Neutrophils, Macrophages', 'Body-wide orders for each cell type. Every switch is a commitment, not a toggle.', [
          `A new stance spreads through the population over about ${C.world.stanceDelay} s. The card shows progress.`,
          'New cells arrive in whatever stance is set.'])}
        ${unit('marrow', 'Bone marrow', 'slider', 'A continuous flow of new cells, not a build queue. You choose the mix.', [
          `Left means more neutrophils, right more macrophages. A macrophage costs ${C.macrophage.cost} neutrophils' worth of output.`,
          'New cells enter from the blood vessel at the top and head for the sectors that call them.'])}
        ${unit('fever', 'Fever', 'body-wide ability', 'A big, costly lever with a cooldown.', [
          `Lasts ${F.duration} s and halves bacterial growth everywhere. Hurts the host the whole time it runs.`,
          `Then it needs ${F.cooldown} s to recover. It does nothing against pollen.`])}
        ${unit('lymph-node', 'Lymph node', 'button under the meters', 'Shows the sample filling up, then the antibody status.', [
          'When it is full the game pauses for your antibody choice. "Not now" lets you decide later by tapping the button.'])}
        <p><b>II</b> pauses, and so does the space bar on a keyboard. <b>Dev</b> holds the speed slider, the seed, cheats and live tuning for every number.</p>`,
    };
    const tabs = [['goal', 'Goal'], ['cells', 'Your cells'], ['enemies', 'Enemies'], ['controls', 'Controls']];
    return `
      <div class="eyebrow">Guide</div>
      <h2>How the immune response works</h2>
      <div class="tabs" role="group" aria-label="Guide sections">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>
      <div class="gsec">${S[tab]}</div>
      <button type="button" class="btn primary" id="guideClose">${guideFrom === 'start' ? 'Back' : 'Back to the match'}</button>`;
  }
  function showGuide(from, tab) {
    if (from !== undefined) guideFrom = from;
    if (tab) guideTab = tab;
    openModal('guide', guideHtml(guideTab));
    $('#mbox').scrollTop = 0;
    $('#mbox').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showGuide(undefined, b.dataset.tab)));
    $('#guideClose').addEventListener('click', () => { if (guideFrom === 'start') showStart(); else closeModal(); });
  }
  function showStart() {
    const sc = k => `<button type="button" class="opt" data-sc="${k}"><img src="${artUrl(SCENARIOS[k].icon)}" alt=""><b>${SCENARIOS[k].name}</b><span>${SCENARIOS[k].goal}</span></button>`;
    openModal('start', `
      <div class="eyebrow">Fun-test prototype · seed ${seed}</div>
      <h2>Immune <span class="glow">RTS</span></h2>
      <p>You run the immune response. You never steer a cell: you set the strategy and the cells carry it out.</p>
      <ul class="howto">
        <li>Tap a sector to set its alert. Higher alerts pull in more cells but inflame the tissue.</li>
        <li>The cards below set what neutrophils and macrophages do, what the bone marrow makes, and fever.</li>
        <li>Macrophages carry samples to the lymph node. When it fills, you choose the antibodies.</li>
        <li>You lose if Pathogen Load or Host Damage reaches 100%. Your own response counts toward Host Damage.</li>
      </ul>
      <button type="button" class="linkbtn" id="openGuide">Read the guide: each unit's role and every control</button>
      <div class="opts">${sc('papercut')}${sc('pollen')}</div>`);
    $('#openGuide').addEventListener('click', () => showGuide('start', 'goal'));
    $('#mbox').querySelectorAll('[data-sc]').forEach(b => b.addEventListener('click', () => newGame(b.dataset.sc, seed)));
  }

  function showChoice() {
    const g = game, what = g.sc.pollen ? 'it' : 'the bacteria';
    paused = true;
    openModal('choice', `
      <div class="eyebrow">Lymph node</div>
      <h2>Make antibodies?</h2>
      <p>Macrophages delivered a sample. B cells can make antibodies against ${g.sc.pollen ? 'what they found' : 'these bacteria'}. They take ${CONFIG.adaptive.delay} seconds to start, then output doubles every ${CONFIG.adaptive.doubling} seconds.</p>
      <div class="opts">
        <button type="button" class="opt" data-ch="opsonize"><img src="${artUrl('choice-opsonize')}" alt=""><b>Opsonize</b><span>Tags ${what} so your cells eat much faster. No extra inflammation.</span></button>
        <button type="button" class="opt" data-ch="complement"><img src="${artUrl('choice-complement')}" alt=""><b>Complement</b><span>Punches holes in ${what} directly. Kills on its own, but inflames tissue.</span></button>
      </div>
      <button type="button" class="ghost" data-ch="hold">Not now (decide later from the lymph node button)</button>`);
    $('#mbox').querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => {
      game.chooseAntibody(b.dataset.ch); closeModal(); paused = false;
    }));
  }

  function showEnd() {
    const g = game, r = g.result;
    endShown = true;
    const title = r.win ? (g.sc.pollen ? 'Season survived' : 'Infection cleared')
      : r.reason === 'host' ? 'The host took too much damage' : 'The infection overwhelmed the host';
    const why = r.win ? '' : r.reason === 'host'
      ? 'Host Damage reached 100%. See below for how much came from your own response.'
      : 'Pathogen Load reached 100%. Bacteria in Blood entry and Lymph exit count 1.5× because they are escaping.';
    const stars = [0, 1, 2].map(i => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('');
    const src = g.bySource, tot = Math.max(10, g.taken);
    const SRC = [['bacteria', 'Bacteria'], ['toxin', 'Toxin bursts'], ['inflammation', 'Inflammation'], ['nets', 'Neutrophil nets'], ['fever', 'Fever']];
    const bar = (label, v, max) => `<div class="row"><span>${label}</span><span class="bar"><i style="width:${Math.min(100, v / max * 100)}%"></i></span><span>${v < 1 ? v.toFixed(1) : v.toFixed(0)}%</span></div>`;
    const inputsEvery = r.inputs ? `one every ${Math.round(r.t / r.inputs)} s` : 'none';
    openModal('end', `
      <div class="eyebrow">${g.sc.name} · seed ${g.seed} · ${fmt(r.t)}</div>
      <h2>${title}</h2>
      ${why ? `<p>${why}</p>` : ''}
      <div class="stars" aria-label="${r.stars} of 3 stars">${stars}</div>
      <ul class="goals">${r.goals.map(([l, ok]) => `<li class="${ok ? 'hit' : ''}">${l}</li>`).join('')}</ul>
      <div class="stats">
        <div><b>${r.host.toFixed(0)}%</b><span>Host Damage</span></div>
        <div><b>${r.scar.toFixed(0)}%</b><span>Scarring</span></div>
        <div><b>${r.peakLoad.toFixed(0)}%</b><span>Peak load</span></div>
        <div><b>${r.healed.toFixed(0)}%</b><span>Healed by Repair</span></div>
        <div><b>${r.inputs}</b><span>Settings changed (${inputsEvery})</span></div>
        <div><b>${r.choice ? cap(r.choice) : 'None'}</b><span>Antibodies</span></div>
      </div>
      <div class="sub">Meters over time</div>
      <canvas id="graph"></canvas>
      <div class="legend"><span style="--c:${g.sc.pollen ? PAL.pollen : PAL.germ}">Pathogen Load</span><span style="--c:${PAL.damage}">Host Damage</span><span style="--c:${PAL.antibody}">Antibody output</span><span style="--c:${PAL.cell}">Your changes</span></div>
      <div class="sub">Where the damage came from</div>
      <div class="bars">${SRC.filter(([k]) => src[k] > 0.05).map(([k, l]) => bar(l, src[k], tot)).join('')}</div>
      <div class="sub">Damage by sector</div>
      <div class="bars">${g.sectors.map(s => bar(s.name, s.dmg, tot)).join('')}</div>
      <div class="btnrow">
        <button type="button" class="btn primary" id="again">Play again</button>
        <button type="button" class="btn" id="newSeed">New seed</button>
        <button type="button" class="btn" id="menu">Scenarios</button>
      </div>`);
    drawGraph($('#graph'), g);
    $('#again').addEventListener('click', () => newGame(scenarioKey, seed));
    $('#newSeed').addEventListener('click', () => { setSeed(1 + Math.floor(Math.random() * 99999)); newGame(scenarioKey, seed); });
    $('#menu').addEventListener('click', showStart);
  }

  function drawGraph(c, g) {
    const r = c.getBoundingClientRect(), k = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
    const x = c.getContext('2d'); x.scale(k, k);
    const w = r.width, h = r.height, L = 30, R = 8, T = 16, B = 20, pw = w - L - R, ph = h - T - B;
    const hist = g.history, tEnd = Math.max(60, g.t);
    const X = t => L + t / tEnd * pw, Y = v => T + ph - Math.min(100, v) / 100 * ph;
    x.font = '10px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
    // grid
    for (const v of [0, 25, 50, 75, 100]) {
      x.strokeStyle = v === 0 ? 'rgba(221,230,245,0.25)' : 'rgba(221,230,245,0.08)';
      x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(w - R, Y(v)); x.stroke();
      x.fillStyle = PAL.uiDim; x.textAlign = 'right'; x.fillText(`${v}`, L - 5, Y(v));
    }
    x.textAlign = 'center';
    const stepT = tEnd > 600 ? 120 : 60;
    for (let t = 0; t <= tEnd; t += stepT) x.fillText(fmt(t), X(t), h - 8);
    // fever spans
    let fs = null;
    for (const e of g.events) {
      if (e.type === 'fever') fs = e.t;
      if (e.type === 'feverEnd' && fs != null) { x.fillStyle = 'rgba(255,122,61,0.13)'; x.fillRect(X(fs), T, X(e.t) - X(fs), ph); fs = null; }
    }
    if (fs != null) { x.fillStyle = 'rgba(255,122,61,0.13)'; x.fillRect(X(fs), T, X(g.t) - X(fs), ph); }
    // markers
    const mark = (t, col, label) => {
      x.strokeStyle = col; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(X(t), T); x.lineTo(X(t), T + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = col; x.textAlign = X(t) > w - 70 ? 'right' : 'left'; x.fillText(label, X(t) + (x.textAlign === 'left' ? 3 : -3), T - 7);
    };
    for (const e of g.events) {
      if (e.type === 'antibody') mark(e.t, PAL.antibody, e.label);
      if (e.type === 'standdown') mark(e.t, PAL.cell, 'Stand down');
      if (e.type === 'alert' || e.type === 'stance' || e.type === 'mix') { x.fillStyle = PAL.cell; x.fillRect(X(e.t) - 0.5, T + ph - 5, 1.5, 5); }
    }
    const line = (key, col, wdt) => {
      x.strokeStyle = col; x.lineWidth = wdt; x.beginPath();
      hist.forEach((p, i) => { const v = key === 'ab' ? p.ab * 100 : key === 'inf' ? p.inf * 100 : p[key]; i ? x.lineTo(X(p.t), Y(v)) : x.moveTo(X(p.t), Y(v)); });
      x.stroke(); x.lineWidth = 1;
    };
    line('ab', 'rgba(255,210,63,0.7)', 1);
    line('load', g.sc.pollen ? PAL.pollen : PAL.germ, 2);
    line('host', PAL.damage, 2);
  }

  // ---- game lifecycle ----
  function newGame(key, s) {
    scenarioKey = key; setSeed(s);
    game = new Game(key, seed);
    endShown = false; paused = false; acc = 0;
    closeModal(); closeSheet();
    $('#toasts').innerHTML = '';
    hud();
  }
  function setSeed(s) { seed = Math.max(1, Math.floor(+s || 1)); store.set('immuneRts.seed', seed); $('#seed').value = seed; }
  function toast(text, kind) {
    const el = document.createElement('div'); el.className = `toast ${kind || ''}`; el.textContent = text;
    $('#toasts').appendChild(el);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
    setTimeout(() => el.remove(), 2900);
  }

  let hudT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (game && !paused && !modal && !game.result) {
      acc += dt * SPEEDS[speedIdx];
      let n = 0;
      while (acc >= STEP && n < 16) { game.step(STEP); acc -= STEP; n++; }
      if (n === 16) acc = 0;
    }
    if (game) {
      for (const m of game.notices.splice(0)) toast(m.text, m.kind);
      if (game.ad.state === 'ready' && !game.ad.prompted && !modal) { game.ad.prompted = true; showChoice(); }
      if (game.result && !endShown) { hud(); showEnd(); }
    }
    render(now);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; hud(); }
    requestAnimationFrame(frame);
  }

  // ---- input wiring ----
  cv.addEventListener('pointerdown', e => {
    if (!game || modal) return;
    const r = cv.getBoundingClientRect(), y = (e.clientY - r.top - oy) / scale, x = (e.clientX - r.left - ox) / scale;
    if (x < 0 || x > W || y < 0 || y > H) { closeSheet(); return; }
    const s = secOf(y);
    if (selSector === s) closeSheet(); else openSheet(s);
  });
  $('#sheetClose').addEventListener('click', closeSheet);
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    if (game) game.setStance(b.parentElement.dataset.type, b.dataset.st); hud();
  }));
  $('#mix').addEventListener('input', e => { $('#mixN').textContent = `${e.target.value}% neut.`; $('#mixM').textContent = `${100 - e.target.value}% macro.`; });
  $('#mix').addEventListener('change', e => { if (game) game.setMix(e.target.value / 100); });
  $('#feverBtn').addEventListener('click', () => { if (game && game.startFever()) toast('Fever is up: bacteria grow at half speed', 'bad'); hud(); });
  $('#sampleBtn').addEventListener('click', () => { if (game && game.ad.state === 'ready' && !modal) showChoice(); });
  $('#pauseBtn').addEventListener('click', () => { paused = !paused; hud(); });
  $('#devBtn').addEventListener('click', () => { $('#dev').hidden = !$('#dev').hidden; });
  $('#helpBtn').addEventListener('click', () => { if (!modal) showGuide('game', 'cells'); });
  $('#devClose').addEventListener('click', () => { $('#dev').hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ' && !modal) { paused = !paused; e.preventDefault(); hud(); }
    if (e.key === 'Escape') { if (selSector != null) closeSheet(); else $('#dev').hidden = true; }
  });

  // ---- dev tools ----
  $('#speed').addEventListener('input', e => { speedIdx = +e.target.value; $('#speedVal').textContent = `${SPEEDS[speedIdx]}×`; hud(); });
  $('#devPause').addEventListener('click', () => { paused = !paused; hud(); });
  $('#devStep').addEventListener('click', () => { if (game && !game.result) { for (let i = 0; i < 60; i++) game.step(STEP); hud(); } });
  $('#devRestart').addEventListener('click', () => newGame(scenarioKey, $('#seed').value));
  $('#devNewSeed').addEventListener('click', () => newGame(scenarioKey, 1 + Math.floor(Math.random() * 99999)));
  $('#devMenu').addEventListener('click', () => { $('#dev').hidden = true; showStart(); });
  $('#cheatBact').addEventListener('click', () => { if (game) for (let i = 0; i < 50; i++) game.spawnBact(300 + (Math.random() * 2 - 1) * 200, 450 + (Math.random() * 2 - 1) * 60); });
  $('#cheatSample').addEventListener('click', () => { if (game && game.ad.state === 'none') game.sample = CONFIG.adaptive.sampleNeeded; });
  $('#cheatClear').addEventListener('click', () => { if (game) for (const p of game.path) p.dead = true; });
  $('#ovAlarm').addEventListener('change', e => { overlay.alarm = e.target.checked; });
  $('#ovStats').addEventListener('change', e => { overlay.stats = e.target.checked; });

  const human = k => k.replace(/([A-Z])/g, ' $1').toLowerCase();
  function stepFor(v) { const a = Math.abs(v); return a === 0 ? 0.001 : Math.pow(10, Math.floor(Math.log10(a)) - 1); }
  function buildTuning() {
    const host = $('#tuning'); host.innerHTML = '';
    for (const grp in DEFAULTS) {
      const det = document.createElement('details');
      det.innerHTML = `<summary>${human(grp)}</summary>`;
      for (const key in DEFAULTS[grp]) {
        const def = DEFAULTS[grp][key], id = `t-${grp}-${key}`;
        const f = document.createElement('div'); f.className = 'field';
        const hint = HINTS[`${grp}.${key}`];
        if (Array.isArray(def)) {
          f.innerHTML = `<label class="row"><span>${human(key)}</span><span class="arr">${def.map((_, i) => `<input type="number" id="${id}-${i}" step="${stepFor(def[i] || def[def.length - 1])}" aria-label="${human(key)} ${LEVELS[i] || i}">`).join('')}</span></label>`;
        } else {
          f.innerHTML = `<label class="row" for="${id}"><span>${human(key)}</span><input type="number" id="${id}" step="${stepFor(def)}"></label>`;
        }
        if (hint) f.insertAdjacentHTML('beforeend', `<small>${hint}</small>`);
        det.appendChild(f);
        f.querySelectorAll('input').forEach((inp, i) => {
          const isArr = Array.isArray(def);
          inp.value = isArr ? CONFIG[grp][key][i] : CONFIG[grp][key];
          const mark = () => inp.classList.toggle('changed', +inp.value !== (isArr ? def[i] : def));
          mark();
          inp.addEventListener('input', () => {
            const v = parseFloat(inp.value); if (!isFinite(v)) return;
            if (isArr) CONFIG[grp][key][i] = v; else CONFIG[grp][key] = v;
            mark(); saveTuning();
            if (grp === 'trap' || grp === 'toxin') buildGraphics();
          });
        });
      }
      host.appendChild(det);
    }
  }
  function tuningDiff() {
    const out = {};
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) {
      if (JSON.stringify(DEFAULTS[g][k]) !== JSON.stringify(CONFIG[g][k])) (out[g] = out[g] || {})[k] = CONFIG[g][k];
    }
    return out;
  }
  function saveTuning() { store.set('immuneRts.tuning', tuningDiff()); }
  $('#tuneReset').addEventListener('click', () => {
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) CONFIG[g][k] = clone(DEFAULTS[g][k]);
    saveTuning(); buildTuning(); buildGraphics();
  });
  $('#tuneCopy').addEventListener('click', () => {
    const txt = JSON.stringify(tuningDiff(), null, 1), ta = $('#devJson');
    ta.value = txt; ta.hidden = false;
    const fallback = () => { ta.focus(); ta.select(); };
    try { navigator.clipboard.writeText(txt).then(() => toast('Tuning copied'), fallback); } catch (e) { fallback(); }
  });

  // ---- boot ----
  document.querySelectorAll('img[data-art]').forEach(i => { i.src = artUrl(i.dataset.art); });
  buildLevels();
  buildTuning();
  $('#seed').value = seed;
  const names = Object.keys(ART.svg);
  Promise.all(names.map(n => ART.load(n).then(im => { img[n] = im; }))).then(() => {
    resize();
    new ResizeObserver(resize).observe(stage);
  });
  showStart();
  requestAnimationFrame(frame);
})();

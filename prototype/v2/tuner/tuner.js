// Difficulty tuner: edit the level's pressure, run bot matches in Web Workers, show who wins and how.
// Uses the game's own sim.js and src/bots.js (inlined above by tuner/build.py).
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = x => `${Math.round(x * 100)}%`;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const COLORS = { idle: '#5A6480', random: '#FF7A3D', beginner: '#B45CFF', casual: '#5CFFA1', smart: '#3FE6FF' };

  // ---- settings: {tune: {group: {key: n}}, waves: [{t, b, a, final}], toxins: [seconds]} ----
  const LIVE = {
    tune: {},
    waves: BOT_LEVEL0.waves.map(w => ({ t: w.t, b: w.b || 0, a: w.a || 0, final: !!w.final })),
    toxins: BOT_LEVEL0.toxins.map(f => Math.round(f * DEFAULTS.level.duration)),
  };
  const copy = o => JSON.parse(JSON.stringify(o));
  function normalize(s) {
    const tune = {};
    for (const g in DEFAULTS) for (const k in DEFAULTS[g]) {
      const v = s.tune && s.tune[g] && s.tune[g][k];
      if (typeof v === 'number' && isFinite(v) && v !== DEFAULTS[g][k]) (tune[g] = tune[g] || {})[k] = v;
    }
    const waves = (s.waves || LIVE.waves).filter(w => isFinite(w.t)).map(w => {
      const o = { t: Math.max(0, +w.t) };
      if (+w.b > 0) o.b = Math.round(+w.b);
      if (+w.a > 0) o.a = Math.round(+w.a);
      if (w.final) o.final = true;
      return o;
    }).sort((a, b) => a.t - b.t);
    const toxins = (s.toxins || LIVE.toxins).filter(t => isFinite(t) && t >= 0).map(Number).sort((a, b) => a - b);
    return { tune, waves, toxins };
  }
  const sig = s => JSON.stringify(normalize(s));
  const val = (s, g, k) => (s.tune[g] && typeof s.tune[g][k] === 'number' ? s.tune[g][k] : DEFAULTS[g][k]);
  const LIVE_SIG = sig(LIVE);
  for (const k of ['ladder', 'strat']) if (BASELINE[k].sig === 'live') BASELINE[k].sig = LIVE_SIG;

  const saved = store.get('immuneTuner.state') || {};
  let settings = saved.settings ? normalize(saved.settings) : normalize(LIVE);
  // Results: {sig, ...}. The live game's results ship with the page (computed when it was built).
  let ladder = saved.ladder || BASELINE.ladder;
  let strat = saved.strat || BASELINE.strat;
  let slots = store.get('immuneTuner.slots') || [];
  for (const r of [ladder, strat]) if (r.partial === true) r.partial = 'stopped';
  let tab = saved.tab === 'strat' ? 'strat' : 'ladder';
  const persist = () => store.set('immuneTuner.state', { settings, ladder, strat, tab });

  // ---- knobs ----
  const GROUP_NAMES = {
    stream: 'Bacteria stream', bacteria: 'Bacteria', toxin: 'Toxin bursts', lymph: 'Lymph node', level: 'Level',
    marrow: 'Marrow', output: 'Body output', fatigue: 'Fatigue', neutrophil: 'Neutrophils', macrophage: 'Macrophages', support: 'Support rings',
  };
  const PRESSURE = ['stream', 'bacteria', 'toxin', 'lymph'];
  const PLAYER = ['level', 'marrow', 'output', 'fatigue', 'neutrophil', 'macrophage', 'support'];
  const human = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace('Neut', 'Neutrophils').replace('Mac', 'Macrophages');
  const stepFor = v => (Number.isInteger(v) && Math.abs(v) >= 2 ? 1 : 0.05);
  const changes = () => {
    let n = 0;
    for (const g in settings.tune) n += Object.keys(settings.tune[g]).length;
    if (JSON.stringify(settings.waves) !== JSON.stringify(normalize(LIVE).waves)) n++;
    if (JSON.stringify(settings.toxins) !== JSON.stringify(LIVE.toxins)) n++;
    return n;
  };
  const openState = store.get('immuneTuner.open') || { script: true, stream: true };

  function setVal(g, k, v) {
    if (!settings.tune[g]) settings.tune[g] = {};
    settings.tune[g][k] = v;
    settings = normalize(settings);
    edited();
  }
  function edited() { persist(); renderCounts(); drawArrivals(); renderResults(); }

  function fieldHTML(g, k) {
    const id = `k-${g}-${k}`, v = val(settings, g, k), changed = v !== DEFAULTS[g][k];
    const hint = HINTS[`${g}.${k}`];
    return `<div class="field${changed ? ' changed' : ''}" data-g="${g}" data-k="${k}"><label for="${id}">${esc(human(k))}</label>` +
      `<input type="number" id="${id}" inputmode="decimal" step="${stepFor(DEFAULTS[g][k])}" value="${v}">` +
      (hint ? `<small>${esc(hint)}${changed ? ` Live game: ${DEFAULTS[g][k]}.` : ''}</small>` : '') + '</div>';
  }
  function groupHTML(g, keys) {
    const n = keys.filter(k => val(settings, g, k) !== DEFAULTS[g][k]).length;
    return `<details data-sec="${g}"${openState[g] ? ' open' : ''}><summary>${GROUP_NAMES[g]}<span class="cnt" data-cnt="${g}">${n ? n + ' changed' : ''}</span></summary><div class="sect">${keys.map(k => fieldHTML(g, k)).join('')}</div></details>`;
  }
  function buildKnobs() {
    const host = $('#knobs');
    let h = `<details data-sec="script"${openState.script ? ' open' : ''}><summary>Level script<span class="cnt" data-cnt="script"></span></summary><div class="sect">
      <p class="small muted" style="margin:0">Big waves pour in at the Wound at set times. The chart shows everything the script sends in, per 15 seconds, before any bacteria divide.</p>
      <svg class="chart" id="arrivals" viewBox="0 0 600 150" role="img" aria-label="Scripted arrivals over the level"></svg>
      <div class="legend"><span><b style="background:var(--germ)"></b>Wave</span><span><b style="background:#7a2a64"></b>Stream</span><span><b style="background:var(--gold)"></b>Armored</span><span><b style="background:var(--damage)"></b>Toxin burst</span></div>
      ${fieldHTML('level', 'duration')}
      <div class="wrap-x"><table class="waves"><thead><tr><th>Time (s)</th><th>Bacteria</th><th>Armored</th><th>Final</th><th></th></tr></thead><tbody id="waveRows"></tbody></table></div>
      <div class="row"><button class="btn" id="addWave" type="button">Add wave</button></div>
      <div><div class="small" style="font-weight:600;margin-bottom:6px">Toxin bursts (seconds)</div><div class="toxlist" id="toxRows"></div></div>
      <div class="row"><button class="btn" id="addTox" type="button">Add toxin burst</button></div>
    </div></details>`;
    h += PRESSURE.map(g => groupHTML(g, Object.keys(DEFAULTS[g]))).join('');
    h += `<div class="kh" style="padding-top:14px;border-top:1px solid var(--line)"><h2>Your side</h2><p class="small muted">These change the player's power, not the pressure.</p></div>`;
    h += PLAYER.map(g => groupHTML(g, Object.keys(DEFAULTS[g]).filter(k => !(g === 'level' && k === 'duration')))).join('');
    host.innerHTML = h;
    renderWaves(); renderToxins(); drawArrivals(); renderCounts();
  }
  $('#knobs').addEventListener('input', e => {
    const f = e.target.closest('.field');
    if (!f) return;
    const v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    setVal(f.dataset.g, f.dataset.k, v);
    const changed = v !== DEFAULTS[f.dataset.g][f.dataset.k];
    f.classList.toggle('changed', changed);
  });
  $('#knobs').addEventListener('toggle', e => {
    const d = e.target; if (!d.dataset || !d.dataset.sec) return;
    openState[d.dataset.sec] = d.open; store.set('immuneTuner.open', openState);
  }, true);

  function renderWaves() {
    $('#waveRows').innerHTML = settings.waves.map((w, i) => `<tr data-i="${i}">
      <td><input type="number" aria-label="Wave ${i + 1} time in seconds" data-f="t" min="0" step="5" value="${w.t}"><div class="clock">${fmtT(w.t)}</div></td>
      <td><input type="number" aria-label="Wave ${i + 1} bacteria" data-f="b" min="0" step="5" value="${w.b || 0}"></td>
      <td><input type="number" aria-label="Wave ${i + 1} armored bacteria" data-f="a" min="0" step="2" value="${w.a || 0}"></td>
      <td><input type="checkbox" aria-label="Wave ${i + 1} is the final wave" data-f="final"${w.final ? ' checked' : ''}></td>
      <td><button class="x" type="button" aria-label="Remove wave ${i + 1}" data-del="${i}">×</button></td></tr>`).join('');
  }
  // Waves keep their row while typing; they are re-sorted when a field is left
  $('#knobs').addEventListener('input', e => {
    const tr = e.target.closest('#waveRows tr'); if (!tr) return;
    const w = settings.waves[+tr.dataset.i], f = e.target.dataset.f;
    if (f === 'final') w.final = e.target.checked;
    else { const v = parseFloat(e.target.value); if (!isFinite(v)) return; w[f] = Math.max(0, v); }
    if (f === 't') tr.querySelector('.clock').textContent = fmtT(w.t);
    persist(); renderCounts(); drawArrivals(); renderResults();
  });
  $('#knobs').addEventListener('change', e => {
    if (e.target.closest('#waveRows')) { settings = normalize(settings); persist(); renderWaves(); }
    if (e.target.closest('#toxRows')) { settings = normalize(settings); persist(); renderToxins(); }
  });
  $('#knobs').addEventListener('click', e => {
    if (e.target.dataset.del != null) { settings.waves.splice(+e.target.dataset.del, 1); settings = normalize(settings); renderWaves(); edited(); }
    else if (e.target.dataset.deltox != null) { settings.toxins.splice(+e.target.dataset.deltox, 1); renderToxins(); edited(); }
    else if (e.target.id === 'addWave') {
      const last = settings.waves[settings.waves.length - 1];
      settings.waves.push({ t: Math.min(val(settings, 'level', 'duration'), (last ? last.t : 0) + 30), b: 30 });
      settings = normalize(settings); renderWaves(); edited();
    } else if (e.target.id === 'addTox') {
      settings.toxins.push(Math.round(val(settings, 'level', 'duration') / 2)); settings = normalize(settings); renderToxins(); edited();
    }
  });
  function renderToxins() {
    $('#toxRows').innerHTML = settings.toxins.map((t, i) => `<label><input type="number" aria-label="Toxin burst ${i + 1} time in seconds" min="0" step="5" value="${t}" data-tox="${i}"><span class="clock mono small muted">${fmtT(t)}</span><button class="x btn quiet" style="padding:2px 8px" type="button" aria-label="Remove toxin burst ${i + 1}" data-deltox="${i}">×</button></label>`).join('') || '<span class="small muted">None</span>';
  }
  $('#knobs').addEventListener('input', e => {
    if (e.target.dataset.tox == null) return;
    const v = parseFloat(e.target.value); if (!isFinite(v)) return;
    settings.toxins[+e.target.dataset.tox] = Math.max(0, v);
    e.target.nextElementSibling.textContent = fmtT(v);
    persist(); renderCounts(); drawArrivals(); renderResults();
  });

  function renderCounts() {
    const n = changes();
    $('#changeCount').textContent = n ? `${n} change${n > 1 ? 's' : ''} from the live game` : 'Same as the live game';
    document.querySelectorAll('[data-cnt]').forEach(el => {
      const g = el.dataset.cnt;
      if (g === 'script') {
        const c = (JSON.stringify(settings.waves) !== JSON.stringify(normalize(LIVE).waves)) + (JSON.stringify(settings.toxins) !== JSON.stringify(LIVE.toxins)) + (val(settings, 'level', 'duration') !== DEFAULTS.level.duration);
        el.textContent = c ? 'changed' : '';
      } else {
        const c = Object.keys(DEFAULTS[g]).filter(k => !(g === 'level' && k === 'duration') && val(settings, g, k) !== DEFAULTS[g][k]).length;
        el.textContent = c ? `${c} changed` : '';
      }
    });
  }

  // Scripted arrivals per 15 s: stream (expected), waves, armored share; toxin bursts as red lines
  function drawArrivals() {
    const svg = $('#arrivals'); if (!svg) return;
    const dur = val(settings, 'level', 'duration'), S = { start: val(settings, 'stream', 'start'), end: val(settings, 'stream', 'end'), from: val(settings, 'stream', 'armoredFrom'), share: val(settings, 'stream', 'armoredShare') };
    const B = 15, nb = Math.ceil(Math.max(dur, ...settings.waves.map(w => w.t + 1)) / B);
    const bins = Array.from({ length: nb }, () => ({ s: 0, sa: 0, w: 0, wa: 0 }));
    for (let i = 0; i < nb; i++) for (let t = i * B; t < (i + 1) * B; t += 0.5) {
      if (t >= dur) break;
      const rate = (S.start + (S.end - S.start) * t / dur) * 0.5;
      if (t >= S.from) { bins[i].sa += rate * S.share; bins[i].s += rate * (1 - S.share); } else bins[i].s += rate;
    }
    for (const w of settings.waves) { const i = Math.min(nb - 1, Math.floor(w.t / B)); bins[i].w += w.b || 0; bins[i].wa += w.a || 0; }
    const max = Math.max(10, ...bins.map(b => b.s + b.sa + b.w + b.wa));
    const W = 600, H = 150, l = 30, r = 6, top = 8, bot = 22, pw = (W - l - r) / nb, sy = v => top + (H - top - bot) * (1 - v / max);
    let h = '';
    const tick = max > 100 ? 50 : max > 40 ? 20 : 10;
    for (let v = 0; v <= max; v += tick) h += `<line class="grid" x1="${l}" x2="${W - r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${l - 4}" y="${sy(v) + 3}" text-anchor="end">${v}</text>`;
    bins.forEach((b, i) => {
      const x = l + i * pw + 1, w = pw - 2;
      let acc = 0;
      for (const [v, c] of [[b.s, '#7a2a64'], [b.sa, '#b3922a'], [b.w, '#FF3DCB'], [b.wa, '#FFD23F']]) {
        if (v <= 0) continue;
        h += `<rect x="${x}" y="${sy(acc + v)}" width="${w}" height="${sy(acc) - sy(acc + v)}" fill="${c}"/>`;
        acc += v;
      }
    });
    for (const t of settings.toxins) { const x = l + t / B * pw; h += `<line x1="${x}" x2="${x}" y1="${top}" y2="${H - bot}" stroke="#FF3B4E" stroke-width="2" stroke-dasharray="4 3"/>`; }
    for (let t = 0; t <= nb * B; t += 60) h += `<text x="${l + t / B * pw}" y="${H - 6}" text-anchor="middle">${fmtT(t)}</text>`;
    svg.innerHTML = h;
  }

  // ---- running bots ----
  const Runner = {
    workers: [], queue: [], onResult: null, onDone: null, mainThread: false, timer: 0, set: null,
    size() { return Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)); },
    busy() { return this.mainThread ? !!this.slicing : this.workers.some(w => w.job); },
    makeWorkers() {
      if (this.workers.length || this.mainThread) return;
      try {
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
        for (let i = 0; i < this.size(); i++) {
          const w = new Worker(url);
          w.onmessage = e => { w.job = null; this.onResult && this.onResult(e.data); this.pump(); };
          w.onerror = e => { e.preventDefault && e.preventDefault(); this.fallback(); };
          this.workers.push(w);
        }
      } catch (e) { this.mainThread = true; }
    },
    fallback() { // workers refused: run on the page in small slices
      if (this.mainThread) return;
      this.mainThread = true;
      for (const w of this.workers) { if (w.job) this.queue.unshift(w.job); w.terminate(); }
      this.workers = [];
      this.pump();
    },
    run(set, jobs, onResult, onDone) {
      this.set = normalize(set); this.queue = jobs.slice(); this.onResult = onResult; this.onDone = onDone;
      this.makeWorkers();
      this.pump();
    },
    pump() {
      if (!this.onDone) return;
      if (!this.queue.length && !this.busy()) { const d = this.onDone; this.onDone = this.onResult = null; d(); return; }
      if (this.mainThread) {
        if (this.slicing || !this.queue.length) return;
        const job = this.queue.shift();
        applySettings(this.set);
        const m = startMatch(job.policy, job.seed, job.params);
        this.slicing = true;
        const slice = () => {
          applySettings(this.set);
          const r = m.advance(900);
          if (r) { this.slicing = false; this.onResult && this.onResult({ job, r: slim(r) }); this.pump(); } else this.timer = setTimeout(slice, 0);
        };
        this.timer = setTimeout(slice, 0);
        return;
      }
      for (const w of this.workers) {
        if (w.job || !this.queue.length) continue;
        w.job = this.queue.shift();
        w.postMessage({ job: w.job, settings: this.set });
      }
    },
    stop() {
      clearTimeout(this.timer); this.slicing = false;
      if (this.workers.some(w => w.job)) { this.workers.forEach(w => w.terminate()); this.workers = []; }
      this.queue = []; this.onResult = this.onDone = null;
    },
  };
  // Keep only what the page shows; bacteria counts every 10 s
  function slim(r) { return { win: r.win, stars: r.stars, t: Math.round(r.t), peakTimer: +r.peakTimer.toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), curve: r.curve.filter((_, i) => i % 5 === 0) }; }

  let running = null; // 'ladder' | 'strat'
  function setProgress(done, total) {
    $('#prog').hidden = !running; $('#stop').hidden = !running;
    $('#runLadder').disabled = $('#runStrat').disabled = !!running;
    if (!running) return;
    $('#progBar').style.width = pct(done / total);
    $('#progTxt').textContent = `${done} of ${total} games played · ${Runner.mainThread ? 'one' : Runner.workers.length || Runner.size()} at a time`;
  }
  function runLadder() {
    const n = +$('#ladderN').value, jobs = [];
    for (let s = 1; s <= n; s++) for (const sk of SKILLS) jobs.push({ kind: 'ladder', policy: sk.key, seed: s });
    ladder = { sig: sig(settings), n, runs: [], partial: true };
    running = 'ladder'; selectTab('ladder'); setProgress(0, jobs.length);
    Runner.run(settings, jobs, ({ job, r }) => {
      ladder.runs.push({ policy: job.policy, seed: job.seed, ...r });
      setProgress(ladder.runs.length, jobs.length); renderLadder();
    }, () => { ladder.partial = false; running = null; setProgress(); persist(); renderLadder(); toast('Skill ladder done'); });
  }
  function runStrat() {
    const n = +$('#stratN').value, S = sampleStrategies(n);
    const jobs = S.map((p, i) => ({ kind: 'strat', policy: 'strategy', seed: 1000 + i, params: p, i }));
    strat = { sig: sig(settings), n, runs: [], partial: true };
    running = 'strat'; selectTab('strat'); setProgress(0, jobs.length);
    Runner.run(settings, jobs, ({ job, r }) => {
      strat.runs.push({ i: job.i, win: r.win, stars: r.stars, t: r.t });
      setProgress(strat.runs.length, jobs.length);
      if (strat.runs.length % 4 === 0 || strat.runs.length === jobs.length) renderStrat();
    }, () => { strat.partial = false; running = null; setProgress(); persist(); renderStrat(); toast('Strategy search done'); });
  }
  $('#runLadder').addEventListener('click', runLadder);
  $('#runStrat').addEventListener('click', runStrat);
  $('#stop').addEventListener('click', () => {
    Runner.stop(); running = null; setProgress();
    if (ladder.partial) ladder.partial = 'stopped';
    if (strat.partial) strat.partial = 'stopped';
    persist(); renderResults(); toast('Stopped');
  });

  // ---- results ----
  function selectTab(t) {
    tab = t; persist();
    $('#tabLadder').setAttribute('aria-selected', t === 'ladder'); $('#tabStrat').setAttribute('aria-selected', t === 'strat');
    $('#paneLadder').hidden = t !== 'ladder'; $('#paneStrat').hidden = t !== 'strat';
  }
  $('#tabLadder').addEventListener('click', () => selectTab('ladder'));
  $('#tabStrat').addEventListener('click', () => selectTab('strat'));

  function staleNote(res) {
    if (running) return '';
    const label = res.sig === LIVE_SIG ? 'the live game' : 'other settings';
    if (res.sig === sig(settings)) return res.partial === 'stopped' ? `<div class="stale">Stopped early: ${res.runs.length} games played.</div>` : '';
    return `<div class="stale">These results are for ${label}, not the settings you have now. Run again to update them.</div>`;
  }
  const ladderStats = res => SKILLS.map(sk => {
    const rs = res.runs.filter(r => r.policy === sk.key).sort((a, b) => a.seed - b.seed);
    const wins = rs.filter(r => r.win), losses = rs.filter(r => !r.win).map(r => r.t).sort((a, b) => a - b);
    return { sk, rs, n: rs.length, wins: wins.length, rate: rs.length ? wins.length / rs.length : 0, stars: wins.length ? wins.reduce((a, r) => a + r.stars, 0) / wins.length : 0, lossT: losses.length ? losses[Math.floor(losses.length / 2)] : null, fat: rs.length ? rs.reduce((a, r) => a + r.fatiguePeak, 0) / rs.length : 0 };
  });

  function renderLadder() {
    const stats = ladderStats(ladder), base = ladder.sig !== LIVE_SIG ? ladderStats(BASELINE.ladder) : null;
    let h = `<div class="stack" style="gap:4px"><h3>Who wins at this difficulty</h3><p class="small muted" style="margin:0">${ladder.sig === LIVE_SIG ? 'The live game\'s numbers' : 'Your settings'}, ${ladder.n} games per player${base ? '. The white tick is the live game.' : '.'}</p></div>${staleNote(ladder)}<div class="ladder">`;
    stats.forEach((s, i) => {
      const b = base && base[i];
      const detail = !s.n ? 'Not played yet' : [
        s.wins ? `wins average ${s.stars.toFixed(1)}★` : '',
        s.lossT != null ? `usually loses around ${fmtT(s.lossT)}` : '',
        `fatigue peak ${Math.round(s.fat)}`,
      ].filter(Boolean).join(' · ');
      h += `<div class="skill">
        <div class="name"><i style="background:${COLORS[s.sk.key]};box-shadow:0 0 6px ${COLORS[s.sk.key]}"></i><span>${s.sk.name}</span></div>
        <div class="pct">${s.n ? pct(s.rate) : '–'}</div>
        <div class="bar"><span style="width:${pct(s.rate)};background:${COLORS[s.sk.key]}"></span>${b && b.n ? `<em style="left:calc(${pct(b.rate)} - 1px)" title="Live game ${pct(b.rate)}"></em>` : ''}</div>
        <div class="dots" aria-label="${s.wins} wins of ${s.n}">${s.rs.map(r => `<b class="${r.win ? 'w' + r.stars : ''}" title="Seed ${r.seed}: ${r.win ? 'won, ' + r.stars + ' stars' : 'lost at ' + fmtT(r.t)}"></b>`).join('')}</div>
        <div class="about">${s.sk.about}<br><span class="mono">${detail.charAt(0).toUpperCase() + detail.slice(1)}</span></div></div>`;
    });
    h += `</div><div class="legend"><span><b style="background:var(--gold)"></b>Won, 3 stars</span><span><b style="background:#b3922a"></b>2 stars</span><span><b style="background:#6b5a1e"></b>1 star</span><span><b style="background:var(--panel2);border:1px solid var(--line)"></b>Lost</span></div>`;
    h += `<div class="stack" style="gap:6px"><h3>Bacteria on the map</h3><p class="small muted" style="margin:0">Average over each player's games, while at least a quarter of them are still going.</p>${curveChart(ladder, stats)}<div class="legend">${SKILLS.map(sk => `<span><b class="line" style="background:${COLORS[sk.key]}"></b>${sk.name}</span>`).join('')}<span><b class="line" style="background:var(--damage)"></b>Toxin burst</span><span><b class="line" style="background:var(--germ)"></b>Wave</span></div></div>`;
    $('#paneLadder').innerHTML = h;
  }
  function curveChart(res, stats) {
    const set = res.sig === sig(settings) ? settings : res.sig === LIVE_SIG ? normalize(LIVE) : settings;
    const W = 600, H = 190, l = 32, r = 8, top = 14, bot = 22;
    const lines = stats.map(s => {
      const pts = [], n = s.rs.length;
      for (let k = 0; ; k++) {
        const alive = s.rs.filter(r => r.curve.length > k);
        if (!n || alive.length < Math.max(1, n / 4)) break;
        pts.push([k * 10, alive.reduce((a, r) => a + r.curve[k], 0) / alive.length]);
      }
      return { key: s.sk.key, pts };
    });
    const tmax = Math.max(val(set, 'level', 'duration') + 20, ...lines.map(L => L.pts.length ? L.pts[L.pts.length - 1][0] : 0));
    const vmax = Math.max(20, ...lines.flatMap(L => L.pts.map(p => p[1])));
    const sx = t => l + (W - l - r) * t / tmax, sy = v => top + (H - top - bot) * (1 - v / vmax);
    let h = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average bacteria on the map over time for each player">`;
    const tick = vmax > 200 ? 100 : vmax > 80 ? 50 : 20;
    for (let v = 0; v <= vmax; v += tick) h += `<line class="grid" x1="${l}" x2="${W - r}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${l - 4}" y="${sy(v) + 3}" text-anchor="end">${v}</text>`;
    for (let t = 0; t <= tmax; t += 60) h += `<text x="${sx(t)}" y="${H - 6}" text-anchor="middle">${fmtT(t)}</text>`;
    for (const t of set.toxins) h += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${top}" y2="${H - bot}" stroke="#FF3B4E" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    for (const w of set.waves) h += `<path d="M${sx(w.t) - 4},${top - 10} h8 l-4,7 z" fill="#FF3DCB"/>`;
    for (const L of lines) if (L.pts.length > 1) {
      h += `<polyline fill="none" stroke="${COLORS[L.key]}" stroke-width="2" stroke-linejoin="round" points="${L.pts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')}"/>`;
      const e = L.pts[L.pts.length - 1]; h += `<circle cx="${sx(e[0])}" cy="${sy(e[1])}" r="3" fill="${COLORS[L.key]}"/>`;
    }
    return h + '</svg>';
  }

  // Winning strategies: which ranges of each input win
  function stratAnalysis(res) {
    const S = sampleStrategies(res.n), runs = res.runs.map(r => ({ ...r, p: S[r.i] }));
    const wins = runs.filter(r => r.win), share = runs.length ? wins.length / runs.length : 0;
    const inputs = STRATEGY.map(d => {
      let bins;
      if (d.bool) bins = [true, false].map(v => ({ label: v ? 'Yes' : 'No', test: x => x === v }));
      else if (d.steps) bins = d.steps.map(v => ({ label: `${v}`, test: x => x === v }));
      else { const nb = 6, w = (d.max - d.min) / nb; bins = Array.from({ length: nb }, (_, i) => ({ lo: d.min + i * w, hi: d.min + (i + 1) * w, test: x => x >= d.min + i * w && (x < d.min + (i + 1) * w || (i === nb - 1 && x <= d.max)) })); }
      bins.forEach(b => { const rs = runs.filter(r => b.test(r.p[d.key])); b.n = rs.length; b.w = rs.filter(r => r.win).length; b.rate = b.n ? b.w / b.n : 0; });
      const solid = bins.filter(b => b.n >= 3);
      const spread = solid.length ? Math.max(...solid.map(b => b.rate)) - Math.min(...solid.map(b => b.rate)) : 0;
      // One game per strategy and a chaotic game: only call a habit important when the gap beats sampling noise
      const binN = solid.length ? solid.reduce((a, b) => a + b.n, 0) / solid.length : 1, se = Math.sqrt(share * (1 - share) / binN);
      const tier = !wins.length ? 0 : spread >= Math.max(0.2, 1.5 * share, 5 * se) ? 2 : spread >= Math.max(0.08, 0.6 * share, 3 * se) ? 1 : 0;
      let band = null;
      if (wins.length && !d.bool) {
        const xs = wins.map(r => r.p[d.key]).sort((a, b) => a - b);
        const q = f => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))];
        band = xs.length >= 5 ? [q(0.1), q(0.9)] : [xs[0], xs[xs.length - 1]];
      }
      const yes = d.bool && wins.length ? wins.filter(r => r.p[d.key]).length / wins.length : null;
      return { d, bins, spread, tier, band, yes };
    });
    return { runs, wins, share, inputs };
  }
  const outMul = (x, set) => { const mn = val(set, 'output', 'min'), mx = val(set, 'output', 'max'); return mn * Math.pow(mx / mn, x); };
  function fmtIn(d, x, set) {
    if (d.bool) return x ? 'Yes' : 'No';
    if (d.slider) return `${outMul(x, set).toFixed(1)}×`;
    if (d.unit) return `${+x.toFixed(1)} ${d.unit}`;
    return `${Math.round(x)}`;
  }
  const range = (d, a, b, set) => (fmtIn(d, a, set) === fmtIn(d, b, set) ? fmtIn(d, a, set) : `${fmtIn(d, a, set).replace(/ s$/, '')}–${fmtIn(d, b, set)}`);
  function verdict(share) {
    if (share === 0) return ['none', 'Nothing tried wins'];
    if (share < 0.1) return ['narrow', 'Narrow path to victory'];
    if (share < 0.3) return ['some', 'A few ways to win'];
    return ['wide', 'Many ways to win'];
  }
  function renderStrat() {
    const set = strat.sig === sig(settings) ? settings : strat.sig === LIVE_SIG ? normalize(LIVE) : settings;
    const A = stratAnalysis(strat), [vk, vt] = verdict(A.share);
    const base = strat.sig !== LIVE_SIG ? stratAnalysis(BASELINE.strat) : null;
    let h = `<div class="stack" style="gap:4px"><h3>How many ways to win</h3><p class="small muted" style="margin:0">Each strategy is a fixed set of habits below, picked to cover every range evenly, and plays one game. ${strat.sig === LIVE_SIG ? 'These are the live game\'s numbers.' : 'These are your settings.'}</p></div>${staleNote(strat)}`;
    h += `<div class="headline"><span class="big">${A.runs.length ? pct(A.share) : '–'}</span><span>of ${A.runs.length} strategies won${strat.partial === true ? ' so far' : ''}</span>${A.runs.length ? `<span class="pill ${vk}">${vt}</span>` : ''}${base ? `<span class="small muted">Live game: ${pct(base.share)}</span>` : ''}</div>`;
    if (A.wins.length) {
      const key = A.inputs.filter(x => x.tier > 0).sort((a, b) => b.spread - a.spread);
      const flat = A.inputs.filter(x => x.tier === 0);
      h += `<div class="stack" style="gap:6px"><div class="small" style="font-weight:600">What winning looks like here</div><ul class="recipe">`;
      for (const x of key) h += `<li>${x.d.bool ? (x.yes >= 0.5 ? `${x.d.name}: yes in ${pct(x.yes)} of wins` : `${x.d.name}: no in ${pct(1 - x.yes)} of wins`) : `${x.d.name} <b class="mono">${range(x.d, x.band[0], x.band[1], set)}</b>`} <span class="tag t${x.tier}">${x.tier === 2 ? 'decides it' : 'matters'}</span></li>`;
      if (!key.length) h += '<li>No single habit stands out. Most of the choices below work.</li>';
      h += `</ul>${flat.length ? `<p class="small muted" style="margin:0">Barely matters: ${flat.map(x => x.d.name.toLowerCase()).join('; ')}.</p>` : ''}<p class="small muted" style="margin:0">Ranges are where the middle 80% of winning strategies sat. A narrow range on something that decides it means a narrow path.</p></div>`;
    } else if (A.runs.length) h += `<p class="small muted" style="margin:0">No strategy won, so there is no range to show. Try more strategies, or ease off the pressure.</p>`;
    h += `<div class="inputs">`;
    for (const x of A.inputs) {
      const W = 260, H = 84, l = 2, r = 2, top = 14, bot = 16, n = x.bins.length, bw = (W - l - r) / n;
      const maxR = Math.max(0.1, 3 * A.share, ...x.bins.map(b => b.rate));
      let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Win rate by ${esc(x.d.name)}">`;
      s += `<line class="grid" x1="${l}" x2="${W - r}" y1="${H - bot}" y2="${H - bot}"/>`;
      x.bins.forEach((b, i) => {
        const bh = (H - top - bot) * b.rate / maxR, inBand = x.band && b.lo != null ? b.hi > x.band[0] && b.lo <= x.band[1] : x.band && b.label ? +b.label >= x.band[0] && +b.label <= x.band[1] : false;
        s += `<rect x="${l + i * bw + 2}" y="${H - bot - bh}" width="${bw - 4}" height="${Math.max(bh, b.n ? 1 : 0)}" fill="${b.rate > 0 ? (inBand || x.d.bool ? '#FFD23F' : '#8a7426') : '#2a3150'}"><title>${b.w} of ${b.n} won</title></rect>`;
        if (b.n && b.rate > 0) s += `<text x="${l + i * bw + bw / 2}" y="${H - bot - bh - 2}" text-anchor="middle">${Math.round(b.rate * 100)}</text>`;
        if (b.label != null) s += `<text x="${l + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${b.label}</text>`;
      });
      if (!x.d.bool && !x.d.steps) s += `<text x="${l}" y="${H - 4}">${fmtIn(x.d, x.d.min, set)}</text><text x="${W - r}" y="${H - 4}" text-anchor="end">${fmtIn(x.d, x.d.max, set)}</text>`;
      s += '</svg>';
      const bandTxt = x.d.bool ? (x.yes != null ? `Winners: <b>yes ${pct(x.yes)}</b>` : 'No winners') : x.band ? `Winners: <b>${range(x.d, x.band[0], x.band[1], set)}</b> · tried ${range(x.d, x.d.min, x.d.max, set)}` : `No winners · tried ${range(x.d, x.d.min, x.d.max, set)}`;
      h += `<div class="inp"><div class="hd"><span>${esc(x.d.name)}${x.d.steps ? ' (s)' : ''}</span>${A.wins.length ? `<span class="tag t${x.tier}">${['barely matters', 'matters', 'decides it'][x.tier]}</span>` : ''}</div>${s}<div class="band">${bandTxt}</div></div>`;
    }
    h += `</div><p class="small muted" style="margin:0">Bars are the win rate (%) for strategies in that range of one habit, with every other habit varied. Gold bars sit inside the winners' range. Each strategy plays one game and small timing differences snowball, so a gap of a few points between bars is noise. More strategies give a clearer picture.</p>`;
    $('#paneStrat').innerHTML = h;
  }
  function renderResults() { renderLadder(); renderStrat(); }

  // ---- saved difficulties ----
  function summaryOf(s) {
    const g = sig(s), parts = [];
    const L = ladder.sig === g && !ladder.partial ? ladder : g === LIVE_SIG ? BASELINE.ladder : null;
    if (L) parts.push(ladderStats(L).map(x => `${x.sk.name.split(' ')[0]} ${pct(x.rate)}`).join(' · '));
    const T = strat.sig === g && !strat.partial ? strat : g === LIVE_SIG ? BASELINE.strat : null;
    if (T) { const A = stratAnalysis(T); parts.push(`Strategies that win: ${pct(A.share)} (${verdict(A.share)[1].toLowerCase()})`); }
    return parts;
  }
  function renderSlots() {
    const host = $('#saved');
    if (!slots.length) { host.innerHTML = '<p class="small muted" style="margin:0">Nothing saved yet.</p>'; return; }
    host.innerHTML = slots.map((s, i) => {
      const sum = s.summary && s.summary.length ? s.summary : ['Run the ladder or strategies with these settings, then save again to keep the results here.'];
      return `<div class="slot"><strong>${esc(s.name)}</strong><div class="row"><button class="btn" type="button" data-load="${i}">Load</button><button class="btn quiet" type="button" data-rm="${i}">${s.confirm ? 'Tap again to delete' : 'Delete'}</button></div><div class="sum">${sum.map(esc).join('<br>')}</div></div>`;
    }).join('');
  }
  $('#slotSave').addEventListener('click', () => {
    const name = $('#slotName').value.trim() || `Difficulty ${slots.length + 1}`;
    const entry = { name, settings: normalize(settings), summary: summaryOf(settings) };
    const i = slots.findIndex(s => s.name === name);
    if (i >= 0) slots[i] = entry; else slots.push(entry);
    store.set('immuneTuner.slots', slots.map(({ confirm, ...s }) => s)); renderSlots(); toast(`Saved ${name}`);
  });
  $('#saved').addEventListener('click', e => {
    const ld = e.target.dataset.load, rm = e.target.dataset.rm;
    if (ld != null) { settings = normalize(slots[+ld].settings); persist(); buildKnobs(); renderResults(); toast(`Loaded ${slots[+ld].name}`); }
    if (rm != null) {
      const s = slots[+rm];
      if (s.confirm) { slots.splice(+rm, 1); store.set('immuneTuner.slots', slots); } else { slots.forEach(x => { x.confirm = false; }); s.confirm = true; }
      renderSlots();
    }
  });
  $('#resetAll').addEventListener('click', () => { settings = normalize(LIVE); persist(); buildKnobs(); renderResults(); toast('Back to the live game\'s numbers'); });

  // ---- export, import, play ----
  const exportText = () => JSON.stringify(normalize(settings));
  $('#copy').addEventListener('click', () => {
    const txt = exportText(), ta = $('#paste');
    const fallback = () => { ta.value = txt; ta.focus(); ta.select(); toast('Select and copy the text in the box'); };
    try { navigator.clipboard.writeText(txt).then(() => toast('Settings copied'), fallback); } catch (e) { fallback(); }
  });
  $('#load').addEventListener('click', () => {
    let s;
    try { s = JSON.parse($('#paste').value); } catch (e) { toast('That text is not settings JSON. Copy it again with Copy settings.'); return; }
    if (!s || typeof s !== 'object') { toast('That text is not settings JSON.'); return; }
    settings = normalize({ tune: s.tune || {}, waves: Array.isArray(s.waves) ? s.waves : LIVE.waves, toxins: Array.isArray(s.toxins) ? s.toxins : LIVE.toxins });
    persist(); buildKnobs(); renderResults(); toast('Settings loaded');
  });
  $('#play').addEventListener('click', () => {
    const s = normalize(settings), dur = val(s, 'level', 'duration');
    store.set('immuneRtsV2.tuning', s.tune);
    store.set('immuneRtsV2.level', { waves: s.waves, toxins: s.toxins.map(t => t / dur) });
    location.href = 'play.html';
  });

  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

  // ---- boot ----
  buildKnobs();
  selectTab(tab);
  renderResults();
  renderSlots();
  setProgress();
})();

// node shots.js clipId [w h] -> sheet-<clip>-<w>.png : frames at several times
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
(async () => {
  const ids = process.argv[2].split(','), W = +(process.argv[3] || 520), H = +(process.argv[4] || 420);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  const art = fs.readFileSync('/mnt/project-files/prototype/assets/assets.js', 'utf8'), tut = fs.readFileSync('/mnt/project-files/tutorial/tutorial.js', 'utf8');
  await p.setContent(`<body style="margin:0;background:#222"><div id=g style="display:flex;flex-wrap:wrap;gap:4px"></div><script>${art}</script><script>${tut}</script><script>window.CYT_CLIPS=CytoTutorial.CLIPS;window.CYT=CytoTutorial.engine;</script></body>`);
  for (const id of ids) {
    const res = await p.evaluate(async ([id, W, H, process_T]) => {
      await ART.loadAll();
      const clip = CYT_CLIPS[id]; if (!clip) return 'no clip ' + id;
      const g = document.getElementById('g'); g.innerHTML = '';
      const n = process_T.length, out = [];
      for (let k = 0; k < n; k++) {
        const t = (process_T)[k];
        const wrap = document.createElement('div'); wrap.style.cssText = `position:relative;width:${W}px;height:${H}px`;
        const c = document.createElement('canvas'); c.style.cssText = `width:${W}px;height:${H}px`; c.width = W; c.height = H;
        wrap.appendChild(c); g.appendChild(wrap);
        // simulate dt stepping to t so heart beats
        CYT.render(c.getContext('2d'), clip, 0, W, H, 1, 0);
        for (let s = 0; s <= t; s += 0.1) {}
        CYT.render(c.getContext('2d'), clip, t, W, H, 1, 0.016);
        let cap = clip.cap[0][1]; for (const [a, s] of clip.cap) if (t >= a) cap = s;
        const l = document.createElement('div'); l.textContent = t.toFixed(1) + 's ' + cap; l.style.cssText = 'position:absolute;left:0;top:0;right:0;background:#000a;color:#fff;font:11px sans-serif;padding:2px';
        wrap.appendChild(l);
      }
      return 'ok';
    }, [id, W, H, (process.env.T || '1,2,3,4,5,6,7,8').split(',').map(Number)]);
    console.log(id, res);
    const el = await p.$('#g');
    await el.screenshot({ path: `sheet-${id}-${W}.png` });
  }
  console.log('errors:', errs.slice(0, 10));
  await b.close();
})();

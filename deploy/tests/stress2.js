const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = process.argv[3] || 'http://localhost:8766'; const path = process.argv[4] || '/play/';
  for (const [w, h] of [[375, 667], [390, 844], [402, 874], [430, 932]]) {
    const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + path); await p.waitForTimeout(900);
    if (path === '/campaign/') { await p.locator('[data-map=papercut]').last().click(); } else if (path === '/sandbox/') { await p.getByText('Staph stream').first().click({ timeout: 4000 }).catch(() => {}); }
    else { const st = p.getByRole('button', { name: /^Start/ }).first(); if (await st.isVisible().catch(() => false)) await st.click(); }
    for (let i = 0; i < 12; i++) { await p.waitForTimeout(400); const sk = p.getByText('Skip', { exact: true }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); }
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const bs = [...document.querySelectorAll('[data-stress]')].filter(e => e.offsetParent);
      const rects = bs.map(e => { const x = e.getBoundingClientRect(); return { t: e.textContent.trim(), l: Math.round(x.left), r: Math.round(x.right), top: Math.round(x.top), w: Math.round(x.width), clip: e.scrollWidth > e.clientWidth + 1 }; });
      let overlap = false; for (let i = 1; i < rects.length; i++) if (rects[i].l < rects[i - 1].r - 1 && rects[i].top === rects[i - 1].top) overlap = true;
      const par = bs[0] && bs[0].parentElement.getBoundingClientRect();
      const sb = document.getElementById('surgeBtn'); const sr = sb && sb.getBoundingClientRect(); const top = sr && document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2); const surge = sb ? { vis: !!sb.offsetParent && sr.width > 0, box: [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)], inView: sr.left >= 0 && sr.right <= innerWidth && sr.top >= 0 && sr.bottom <= innerHeight, onTop: !!top && (top === sb || sb.contains(top)), disabled: sb.disabled } : 'missing';
      return { surge, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, vh: innerHeight, clock: document.querySelector('#clock')?.textContent,
        stress: rects.map(x => `${x.t}@${x.l}-${x.r}${x.clip ? ' CLIP' : ''}`).join(' '), rows: [...new Set(rects.map(x => x.top))].length, overlap, inParent: par ? rects.every(x => x.l >= par.left - 1 && x.r <= par.right + 1) : null,
        over: [...document.querySelectorAll('body *')].filter(e => { const x = e.getBoundingClientRect(); return x.width && (x.right > innerWidth + 1 || x.left < -1) && getComputedStyle(e).position !== 'fixed'; }).map(e => e.id || e.className).slice(0, 5) };
    });
    await p.screenshot({ path: `stress${path.replace(/\//g, '')}-${w}.png` });
    console.log(path, w + 'x' + h, JSON.stringify(r), 'errors', errs); await c.close();
  }
  await b.close();
})();

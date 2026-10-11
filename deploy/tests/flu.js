const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = process.argv[3] || 'http://localhost:8766';
  const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/play/'); await p.waitForTimeout(1000);
  await p.locator('[data-lv=flu]').first().click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /^Start/ }).first().click();
  for (let i = 0; i < 15; i++) { await p.waitForTimeout(400); const sk = p.getByText('Skip', { exact: true }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); }
  console.log('keys', await p.evaluate(() => Object.keys(window.__cyto.game || {}).join(',').slice(0, 600)));
  for (let i = 0; i < 2; i++) { const sp = p.locator('button', { hasText: /^[123]×$/ }).first(); if (await sp.isVisible().catch(()=>false)) await sp.click(); }
  let maxG = 0, minFps = 999;
  for (let s = 0; s < 26; s++) {
    await p.waitForTimeout(5000);
    const r = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else { const g = window.__cyto.game; const arr = g && g.ag; res({ fps: n, t: g && Math.round(g.t || g.time || 0), germs: arr ? arr.length : null, docW: document.documentElement.scrollWidth, clock: document.querySelector('#clock')?.textContent }); } }; requestAnimationFrame(f); }));
    maxG = Math.max(maxG, r.germs || 0); minFps = Math.min(minFps, r.fps); console.log(JSON.stringify(r));
  }
  await p.screenshot({ path: 'flu-390.png' });
  console.log('maxGerms', maxG, 'minFps(headless)', minFps, 'errors', errs); await b.close();
})();

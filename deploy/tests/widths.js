const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = process.argv[3] || 'play';
  for (const [w, h] of [[375, 667], [375, 812], [390, 844], [402, 874], [430, 932]]) {
    const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/' + pg + '/'); await p.waitForTimeout(1000);
    if (pg === 'play') await p.getByRole('button', { name: /^Start/ }).first().click();
    else await p.getByText('Staph stream').first().click({ timeout: 4000 }).catch(() => {});
    for (let i = 0; i < 25; i++) {
      await p.waitForTimeout(400);
      const sk = p.getByText('Skip', { exact: true }).first();
      if (await sk.isVisible().catch(() => false)) { await sk.click().catch(() => {}); continue; }
      if (await p.evaluate(() => !document.querySelector('#modal') || getComputedStyle(document.querySelector('#modal')).display === 'none' || !document.querySelector('#modal').offsetParent)) break;
    }
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const row = document.querySelector('#hud .hudrow'), rr = [...row.children].map(e => e.getBoundingClientRect()).filter(x => x.width);
      const over = [...document.querySelectorAll('body *')].filter(e => { const x = e.getBoundingClientRect(); return x.width && (x.right > innerWidth + 1 || x.left < -1) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().left) + '-' + Math.round(e.getBoundingClientRect().right));
      return { docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, vh: innerHeight, rowRight: Math.round(Math.max(...rr.map(x => x.right))), rowTops: [...new Set(rr.map(x => Math.round(x.top)))], over };
    });
    const hb = await p.locator('#hubBack').boundingBox();
    await p.screenshot({ path: `${process.argv[2]}/w-${pg}-${w}x${h}.png` });
    console.log(pg, w + 'x' + h, JSON.stringify(r), 'back', JSON.stringify(hb), 'errors', errs); await c.close();
  }
  await b.close();
})();

const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[375, 667], [430, 932]]) {
    const c = await b.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/'); await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('a.card')].map(a => a.getAttribute('href') + '@' + Math.round(a.getBoundingClientRect().top)) }));
    await p.screenshot({ path: `hub-${w}.png`, fullPage: true }); console.log(w, JSON.stringify(r), errs); await c.close();
  }
  await b.close();
})();

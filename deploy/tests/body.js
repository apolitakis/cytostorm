const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = process.argv[2] || 'https://cytostorm.pages.dev';
  for (const [w, h] of [[375, 667], [390, 844], [430, 932], [1280, 800]]) {
    const c = await b.newContext(w > 500 ? { viewport: { width: w, height: h } } : { ...devices['iPhone 13'], viewport: { width: w, height: h } });
    const p = await c.newPage(); const errs = [], fails = []; p.on('pageerror', e => errs.push(e.message)); p.on('requestfailed', r => fails.push(r.url().slice(0, 80))); p.on('response', r => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url().slice(0, 80)); });
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
    await p.goto(base + '/campaign/'); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => {
      const pins = [...document.querySelectorAll('[data-map]')].filter(e => e.offsetParent);
      const svgs = [...document.querySelectorAll('svg')].filter(s => s.offsetParent).map(s => { const x = s.getBoundingClientRect(); return { cls: (s.getAttribute('class') || s.parentElement.className || '').toString().slice(0, 30), w: Math.round(x.width), h: Math.round(x.height), paths: s.querySelectorAll('path').length }; }).filter(s => s.w > 60);
      const imgs = [...document.querySelectorAll('img')].filter(i => i.offsetParent && i.getBoundingClientRect().width > 60).map(i => ({ src: i.src.slice(0, 60), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width) }));
      const bodyEl = document.querySelector('[class*=body], #body, .bodymap, [class*=Body]');
      return { title: document.querySelector('h1,h2')?.textContent, pins: pins.length, svgs, imgs, bodyEl: bodyEl ? bodyEl.className + ' ' + Math.round(bodyEl.getBoundingClientRect().width) + 'x' + Math.round(bodyEl.getBoundingClientRect().height) : null };
    });
    await p.screenshot({ path: `body-${w}.png` });
    console.log(w + 'x' + h, JSON.stringify(r), 'errors', errs, 'fails', fails); await c.close();
  }
  await b.close();
})();

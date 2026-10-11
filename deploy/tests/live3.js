const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ ...devices['iPhone 13'] });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('requestfailed', r => { if (!/fonts\.g/.test(r.url())) errs.push('fail ' + r.url()); });
  await p.goto('https://cytostorm.pages.dev/'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/hub.png', fullPage: true });
  for (const slug of ['play', 'sandbox', 'v2']) {
    await p.goto('https://cytostorm.pages.dev/'); await p.click(`a[href="${slug}/"]`); await p.waitForLoadState('load'); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${slug}-intro.png` }); const start = p.getByRole('button', {name: /^Start/}).first(); if (await start.count()) await start.click({timeout: 3000}).catch(()=>{});
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${slug}.png`, fullPage:false });
    const box = await p.locator('#hubBack').boundingBox();
    console.log(slug, await p.title(), p.url(), 'back', JSON.stringify(box));
    await p.click('#hubBack'); await p.waitForLoadState('load'); console.log(' back ->', p.url(), await p.title());
  }
  console.log('errors', errs); await b.close();
})();

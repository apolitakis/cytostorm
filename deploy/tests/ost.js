const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  const base = process.argv[3] || 'http://localhost:8766';
  await p.goto(base + '/'); await p.waitForTimeout(800); await p.screenshot({ path: process.argv[2] + '/ost-hub.png', fullPage: true });
  await p.click('a[href="ost/"]'); await p.waitForTimeout(1500);
  console.log('ost', await p.title(), p.url(), JSON.stringify(await p.locator('#hubBack').boundingBox()));
  console.log((await p.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n+/g, ' | '));
  await p.screenshot({ path: process.argv[2] + '/ost-page.png' });
  const btn = p.getByRole('button').first(); console.log('first button', await btn.innerText().catch(()=>'-'));
  await btn.click().catch(e => console.log('click fail')); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[2] + '/ost-playing.png' });
  await p.click('#hubBack'); await p.waitForTimeout(800); console.log('back ->', p.url(), 'errors', errs);
  await b.close();
})();

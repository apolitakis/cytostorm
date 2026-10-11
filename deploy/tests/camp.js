const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = process.argv[3] || 'http://localhost:8766';
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/'); await p.waitForTimeout(600);
  await p.click('a[href="campaign/"]'); await p.waitForTimeout(1500);
  console.log('campaign', await p.title(), p.url(), 'back', JSON.stringify(await p.locator('#hubBack').boundingBox()));
  console.log((await p.evaluate(() => document.body.innerText)).slice(0, 500).replace(/\n+/g, ' | '));
  await p.screenshot({ path: process.argv[2] + '/camp-0.png' });
  const btns = await p.getByRole('button').allInnerTexts(); console.log('buttons', JSON.stringify(btns.slice(0, 15)));
  await p.click('#hubBack'); await p.waitForTimeout(600); console.log('back ->', p.url(), 'errors', errs);
  await b.close();
})();

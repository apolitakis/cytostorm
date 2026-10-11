const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8766/sandbox/'); await p.waitForTimeout(1500);
  await p.getByText('Staph stream').first().click({ timeout: 4000 }).catch(() => console.log('no combo'));
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(400);
    const sk = p.getByText('Skip', { exact: true }).first();
    if (await sk.isVisible().catch(() => false)) { await sk.click().catch(() => {}); continue; }
    if (await p.evaluate(() => document.elementFromPoint(190, 200).tagName) === 'CANVAS') break;
  }
  await p.waitForTimeout(2200);
  await p.touchscreen.tap(190, 200); await p.waitForTimeout(100); await p.touchscreen.tap(190, 200);
  await p.waitForTimeout(1200); await p.screenshot({ path: process.argv[2] + '/sz-sandbox.png' });
  console.log('sandbox errors', errs, await p.evaluate(() => document.body.innerText.match(/Watching \w+/)));
  await b.close();
})();

const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ ...devices['iPhone 13'] });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8766/play/'); await p.waitForTimeout(1500);
  await p.getByRole('button', {name: /^Start/}).first().click({timeout: 5000}).catch(()=>console.log('no start'));
  await p.waitForTimeout(1000);
  await p.evaluate(() => { for (let i = 0; i < 60; i++) document.querySelector('#devSkip').click(); });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: out + '/end.png' });
  const fb = p.getByRole('button', {name: /Send feedback/}).first();
  console.log('feedback buttons', await fb.count());
  if (await fb.count()) { await fb.click(); await p.waitForTimeout(800); await p.screenshot({ path: out + '/feedback.png' }); }
  const dl = p.getByText(/Download/).first(); console.log('download visible', await dl.isVisible().catch(()=>false));
  console.log('back button', !!(await p.$('#hubBack')), 'errors', errs);
  await b.close();
})();

const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = process.argv[2] || 'http://localhost:8766';
  const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/play/'); await p.evaluate(() => localStorage.setItem('cytostormV3.difficulty', JSON.stringify('hard')));
  await p.reload(); await p.waitForTimeout(800);
  const st = p.getByRole('button', { name: /^Start/ }).first(); await st.click();
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(300); const sk = p.getByText('Skip', { exact: true }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); }
  console.log('play game difficulty', await p.evaluate(() => window.__cyto?.game?.difficulty));
  await p.goto(base + '/campaign/'); await p.waitForTimeout(1000);
  await p.locator('[data-map=papercut]').last().click(); await p.waitForTimeout(800);
  for (let i = 0; i < 8; i++) { const sk = p.getByText('Skip', { exact: true }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(1200); console.log('campaign game difficulty', await p.evaluate(() => window.__cyto?.game?.difficulty));
  await p.goto(base + '/sandbox/'); await p.waitForTimeout(1500);
  await p.getByText('Staph stream').first().click({ timeout: 4000 }).catch(() => console.log('no combo'));
  for (let i = 0; i < 8; i++) { const sk = p.getByText('Skip', { exact: true }).first(); if (await sk.isVisible().catch(() => false)) await sk.click().catch(() => {}); await p.waitForTimeout(300); }
  await p.waitForTimeout(1200);
  console.log('sandbox game difficulty', await p.evaluate(() => (window.__cyto?.game?.difficulty) ?? (typeof DIFFICULTY !== 'undefined' ? 'global:' + DIFFICULTY : 'n/a')));
  console.log('play key still', await p.evaluate(() => localStorage.getItem('cytostormV3.difficulty')), 'errors', errs);
  await b.close();
})();

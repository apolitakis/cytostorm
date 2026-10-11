const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/t.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + __dirname + '/t.html'); await p.waitForTimeout(700);
  await p.click('#go'); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
  // all Support so rings tile, then check the paused label
  await p.evaluate(() => { const g = window.__cyto.game; for (let z = 0; z < 3; z++) g.setZone(z, 'support'); g.zones.forEach(z => { z.mix = { neut: 0.4, net: 0, nk: 0, mac: 0.6 }; }); });
  for (const f of [40, 70, 95, 130]) {
    await p.evaluate(f => { const g = window.__cyto.game; g.fatigue = f; }, f);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${__dirname}/strain-${f}.png` });
    console.log(f, await p.evaluate(() => getComputedStyle(document.querySelector('#strain')).opacity));
  }
  await p.evaluate(() => { const g = window.__cyto.game; g.fatigue = 0; for (let i = 0; i < 20 * 150; i++) g.step(0.05); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${__dirname}/cover.png` });
  console.log(JSON.stringify(await p.evaluate(() => { const g = window.__cyto.game; return { cover: g.zones.map(z => z.cover.toFixed(2) + (z.macPaused ? 'P' : '')), labels: [...document.querySelectorAll('.sresp')].map(r => r.className + ':' + (r.querySelector('.rl') || {}).textContent) }; })));
  await p.click('.sresp[data-rz="1"]'); await p.waitForTimeout(400);
  console.log(await p.evaluate(() => document.querySelector('#coverHint').textContent));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();

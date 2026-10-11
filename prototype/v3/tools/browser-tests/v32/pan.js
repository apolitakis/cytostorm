const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/t.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: false });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + __dirname + '/t.html'); await p.waitForTimeout(700);
  await p.click('#go'); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
  const modes = () => p.evaluate(() => window.__cyto.game.zones.map(z => z.mode).join(','));
  await p.mouse.click(200, 350); await p.waitForTimeout(600);
  console.log('after single tap', await modes());
  await p.mouse.click(200, 350); await p.waitForTimeout(80); await p.mouse.click(200, 350); await p.waitForTimeout(900);
  console.log('zoom chip', await p.evaluate(() => !document.querySelector('#zoomOut').hidden && document.querySelector('#zoomOut b').textContent));
  await p.screenshot({ path: __dirname + '/pan0.png' });
  await p.mouse.move(200, 600); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(200, 600 - i * 40); await p.waitForTimeout(20); } await p.mouse.up();
  await p.waitForTimeout(400);
  console.log('after drag up', await p.evaluate(() => document.querySelector('#zoomOut b').textContent), await modes());
  await p.screenshot({ path: __dirname + '/pan1.png' });
  await p.click('.sstance[data-sm="0"]'); await p.waitForTimeout(300);
  console.log('stance button while zoomed', await modes());
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();

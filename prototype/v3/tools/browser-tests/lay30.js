const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/test30.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 800], [375, 667], [430, 932], [1280, 800]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/test30.html'); await p.waitForTimeout(700);
    if (w === 390) await p.screenshot({ path: `l30-start-${w}.png` });
    await p.click('#go'); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `l30-play-${w}x${h}.png` });
    if (w === 390) {
      await p.click('.zpwr[data-pz="2"]'); await p.waitForTimeout(300);
      await p.click('.sstance[data-sm="1"]'); await p.waitForTimeout(300);
      await p.click('[data-stress="1.5"]'); await p.waitForTimeout(300);
      await p.screenshot({ path: `l30-ctl-${w}.png` });
      await p.click('.sresp[data-rz="0"]'); await p.waitForTimeout(400);
      await p.screenshot({ path: `l30-sheet-${w}.png` });
      console.log(JSON.stringify(await p.evaluate(() => { const g = window.__cyto.game; return { on: g.zones.map(z => z.on), modes: g.zones.map(z => z.mode), out: g.outputMul().toFixed(2), sheet: !document.querySelector('#sheet').hidden }; })));
    }
    console.log(w, h, errs.length ? errs.join('\n') : 'no page errors');
    await ctx.close();
  }
  await b.close();
})();

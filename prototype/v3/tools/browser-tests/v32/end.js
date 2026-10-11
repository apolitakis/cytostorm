const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/e.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[375, 667], [1280, 800]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/e.html'); await p.waitForTimeout(600);
    await p.click('#go'); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
    // play it out fast: a storm mid-fight, then run to the end
    await p.evaluate(() => { const g = window.__cyto.game; g.setOutput(0.85); for (let i = 0; i < 20 * 120 && !g.result; i++) g.step(0.05); g.useStorm(); for (let i = 0; i < 20 * 400 && !g.result; i++) g.step(0.05); });
    await p.waitForTimeout(2500);
    const box = await p.$('#graph'); await box.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${__dirname}/end-main-${w}.png` });
    const bb = await box.boundingBox();
    await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(80); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(300);
    await p.screenshot({ path: `${__dirname}/end-sector-${w}.png` });
    const sel1 = await p.evaluate(() => document.querySelector('[aria-selected="true"]').textContent);
    await p.click('[data-gv="fatigue"]'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${__dirname}/end-fat-${w}.png` });
    console.log(w, sel1, await p.evaluate(() => document.querySelector('#graph').getAttribute('aria-label')), errs.join(' ') || 'no page errors');
  }
  await b.close();
})();

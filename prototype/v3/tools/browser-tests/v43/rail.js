// V43: rail shows waves left in order (no timeline), banner says "N waves left. Next: ...", no times. SRC=<built index.html>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/s.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const lv of ['papercut', 'gut']) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(400);
    await p.evaluate(() => { localStorage.setItem('cytostormV3.tutorialSeen', JSON.stringify(Object.fromEntries(LEVEL_ORDER.map(k => [k, 1])))); });
    await p.reload(); await p.waitForTimeout(400);
    const lb = await p.$(`[data-lv="${lv}"]`); if (lb) { await lb.click(); await p.waitForTimeout(200); }
    await p.click('#go'); await p.waitForTimeout(500);
    const times = await p.evaluate(() => window.__cyto.game.lv.waves.map(w => w.t));
    await p.evaluate(() => { const g = window.__cyto.game; for (let i = 0; i < 60 * 70; i++) g.step(1 / 60); });
    await p.waitForTimeout(700);
    const banner = await p.evaluate(() => document.querySelector('#banner').innerText);
    await p.screenshot({ path: `${__dirname}/v43-${lv}.png` });
    out.push({ lv, times, banner, errs });
  }
  // a second attempt rolls different times
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(400);
  const t2 = await p.evaluate(() => { const r = []; for (let k = 0; k < 2; k++) { const g = new Game('papercut', 1); g.rollWaves(1 + Math.floor(Math.random() * 1e9)); r.push(g.lv.waves.map(w => w.t).join(' ')); } return r; });
  console.log(JSON.stringify(out, null, 1), '\nrerolls:', t2.join(' | ')); await b.close();
})();

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/s.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[375, 667], [390, 800], [1280, 800]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(600);
    await p.click('#go'); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
    const T = () => p.evaluate(() => window.__cyto.game.t);
    let t0 = await T(); await p.waitForTimeout(2000); const normal = (await T()) - t0;
    await p.click('#surgeBtn'); await p.waitForTimeout(100);
    t0 = await T(); await p.waitForTimeout(2000); const slow = (await T()) - t0;
    if (w === 375) await p.screenshot({ path: __dirname + '/surge-375.png' });
    const n1 = await p.textContent('#surgeN');
    await p.click('#surgeBtn'); await p.waitForTimeout(100);
    t0 = await T(); await p.waitForTimeout(1000); const after = (await T()) - t0;
    await p.click('#bodyBtn'); await p.waitForTimeout(200);
    t0 = await T(); await p.waitForTimeout(1000); const inMenu = (await T()) - t0;
    const mod = await p.evaluate(() => !document.querySelector('#modal').hidden);
    await p.click('#bodyClose'); await p.waitForTimeout(100);
    await p.click('#pauseBtn'); t0 = await T(); await p.waitForTimeout(800); const paused = (await T()) - t0; await p.click('#resumeBtn');
    const r = await p.evaluate(() => { const q = id => document.querySelector(id).getBoundingClientRect(); const a = q('#surgeBtn'), c = q('#pauseBtn'); return { surge: [a.width, a.height].map(Math.round), pause: [c.width, c.height].map(Math.round), docW: document.documentElement.scrollWidth }; });
    console.log(w, JSON.stringify({ normal: normal.toFixed(2), slow: slow.toFixed(2), left: n1, after: after.toFixed(2), menuOpen: mod, inMenu: inMenu.toFixed(2), paused: paused.toFixed(2), ...r }), errs.join(' ') || 'no page errors');
    if (w === 1280) await p.screenshot({ path: __dirname + '/surge-1280.png' });
  }
  await b.close();
})();

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/s.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
const LV = { hospital: 'bcell', pool: 'eos', soil: 'plt', foot: 'dc', throat: 'treg', coldsore: 'ifn', gut: 'mast' };
(async () => {
  const b = await chromium.launch();
  for (const [lv, u] of Object.entries(LV)) {
    const w = 390, h = 800;
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(500);
    const lb = await p.$(`[data-lv="${lv}"]`); if (lb) { await lb.click(); await p.waitForTimeout(200); }
    await p.click('#go'); await p.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } }
    const info = await p.evaluate(([u]) => { const g = window.__cyto.game; for (let z = 0; z < g.zones.length; z++) g.setShare(z, u, 0.35);
      const T = { pool: 150, gut: 200, coldsore: 170 }[g.level] || 120;
      for (let i = 0; i < T * 60 && !g.result; i++) { g.step(1 / 60); if (i % 30 === 0) g.fx.length = Math.min(g.fx.length, 50); }
      const c = {}; for (const x of g.cells) if (!x.dead) c[x.type] = (c[x.type] || 0) + 1;
      return { level: g.level, t: Math.round(g.t), units: g.units, cells: c, clouds: g.clouds.length, mucus: g.mucus.map(x => +x.toFixed(1)), primed: Object.keys(g.primed), result: g.result && g.result.win };
    }, [u]);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${__dirname}/u-${lv}.png` });
    await p.click('.sresp'); await p.waitForTimeout(300);
    const sheet = await p.evaluate(() => { const r = document.querySelector('#sheet').getBoundingClientRect(); return { sheetH: Math.round(r.height), vh: innerHeight, scroll: document.querySelector('#sheet').scrollHeight, docW: document.documentElement.scrollWidth }; });
    if (lv === 'throat') await p.screenshot({ path: `${__dirname}/sheet-${lv}.png` });
    console.log(JSON.stringify({ ...info, ...sheet }), errs.join(' ') || 'ok');
  }
  await b.close();
})();

// V40: each unit level plays its antigen clip(s) then its unit intro clip; the guide's How to play tab lists a Cells row. SRC=<built index.html>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/s.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
const LV = ['papercut', 'hospital', 'pool', 'soil', 'foot', 'throat', 'coldsore', 'gut'];
(async () => {
  const b = await chromium.launch();
  for (const lv of LV) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(500);
    const lb = await p.$(`[data-lv="${lv}"]`); if (lb) { await lb.click(); await p.waitForTimeout(200); }
    const [ids, units] = await p.evaluate(k => [CytoTutorial.forLevel(k, []).filter(id => CytoTutorial.CLIPS[id]), CytoTutorial.UNITS], lv);
    await p.click('#go'); await p.waitForTimeout(1500);
    const tut = await p.evaluate(() => !!document.querySelector('#tutHost'));
    let second = '';
    if (ids.length) { const nx = await p.$('text=Next'); if (nx && lv !== 'papercut') { await nx.click(); await p.waitForTimeout(1200); second = await p.evaluate(() => document.querySelector('#tutHost').innerText.split('\n').slice(0, 1).join(' ')); if (lv === 'hospital') await p.screenshot({ path: `${__dirname}/clip-${lv}.png` }); } }
    for (let i = 0; i < 12; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } else break; }
    { const st = await p.$('#tutHost button >> text=/^Start /'); if (st && await st.isVisible()) { await st.click(); await p.waitForTimeout(400); } }
    const started = await p.evaluate(() => { const h = document.querySelector('#tutHost'); return !h || !h.offsetParent; }); if (lv === 'gut') await p.screenshot({ path: `${__dirname}/after-skip.png` });
    console.log(lv, JSON.stringify({ unitClips: ids.filter(id => units.includes(id)), nClips: ids.length, tut, second, started }), errs.join(' ') || 'ok');
    await p.close();
  }
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(500);
  await p.click('#openGuide'); await p.waitForTimeout(200); await p.click('[data-tab="howto"]'); await p.waitForTimeout(400);
  const g = await p.evaluate(() => ({ heads: [...document.querySelectorAll('.clips h4')].map(h => h.textContent), cells: [...document.querySelectorAll('.clips h4')].filter(h => h.textContent === 'Cells').length ? [...document.querySelectorAll('.clips [data-clip]')].filter(x => CytoTutorial.UNITS.includes(x.dataset.clip)).map(x => x.textContent) : [], docW: document.documentElement.scrollWidth }));
  await p.evaluate(() => { const h = [...document.querySelectorAll('.clips h4')].find(x => x.textContent === 'Cells'); if (h) h.scrollIntoView(); });
  await p.screenshot({ path: `${__dirname}/guide-cells.png` });
  const c = await p.$('[data-clip="' + (await p.evaluate(() => CytoTutorial.UNITS[0])) + '"]'); await c.click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${__dirname}/guide-play.png` });
  console.log('guide', JSON.stringify(g), errs.join(' ') || 'ok');
  await b.close();
})();

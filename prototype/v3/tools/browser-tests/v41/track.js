// V41: the Stress track's sustainable mark follows game.restLevel() (Support upkeep). SRC=<built index.html>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
fs.writeFileSync(__dirname + '/s.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(process.env.SRC, 'utf8') + '</body></html>');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + __dirname + '/s.html'); await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.setItem('cytostormV3.tutorialSeen', JSON.stringify({ papercut: 1 })));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('#go'); await p.waitForTimeout(800);
  for (let i = 0; i < 12; i++) { const s = await p.$('.cyt-skip'); if (s && await s.isVisible()) { await s.click(); await p.waitForTimeout(200); } else break; }
  { const st = await p.$('#tutHost button >> text=/^Start /'); if (st && await st.isVisible()) { await st.click(); await p.waitForTimeout(400); } }
  const track = () => p.evaluate(() => { const t = getComputedStyle(document.querySelector('#output')).getPropertyValue('--track'); return (t.match(/(\d+)%, #FFD23F/) || [])[1]; });
  const out = {}; out.start = [await p.evaluate(() => window.__cyto && window.__cyto.game ? window.__cyto.game.restLevel() : null), await track()];
  await p.evaluate(() => { const g = window.__cyto.game; for (let z = 0; z < g.zones.length; z++) g.setZone(z, 'support'); });
  await p.waitForTimeout(600); out.allSupport = [await p.evaluate(() => window.__cyto.game.restLevel()), await track()];
  await p.screenshot({ path: __dirname + '/track-support.png', clip: { x: 0, y: 650, width: 390, height: 150 } });
  await p.evaluate(() => { const g = window.__cyto.game; for (let z = 0; z < g.zones.length; z++) g.setZone(z, 'offense'); });
  await p.waitForTimeout(600); out.allOffense = [await p.evaluate(() => window.__cyto.game.restLevel()), await track()];
  await p.screenshot({ path: __dirname + '/track-offense.png', clip: { x: 0, y: 650, width: 390, height: 150 } });
  console.log(JSON.stringify(out), errs.join(' ') || 'ok'); await b.close();
})();

// Browser test. Copy ../index.html to <dir>/camp.html, then: NODE_PATH=$(npm root -g) node tests/THIS.js <dir>  (needs <dir>/shots/)
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2]; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + S + '/camp.html'); await p.waitForTimeout(800);
  const seen = { goal: true, shop: true, treat: true, vax: true, loadout: true };
  const LS = () => p.evaluate(() => JSON.parse(localStorage.getItem('cytostormCampaign.slots'))[0]);
  const txt = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(x => x.innerText.replace(/\n+/g, ' / ')).join('\n'), sel);
  for (const n of [8, 3, 5]) {
    await p.evaluate(([n, seen]) => { const c = {}; LEVEL_ORDER.slice(0, n).forEach(k => c[k] = true);
      localStorage.setItem('cytostormCampaign.slots', JSON.stringify([{ v: 1, samples: 900, cleared: c, plays: {}, upgrades: {}, vaccines: {}, loadout: ['net'], dropped: ['nk'], treat: {}, earned: 900, seen, diff: 'normal' }, null, null])); }, [n, seen]);
    await p.reload(); await p.waitForTimeout(900); await p.click('[data-go="0"]'); await p.waitForTimeout(300);
    await p.click('.mrow.open'); await p.waitForTimeout(400);
    console.log(`\n== ${await p.evaluate(() => document.querySelector('#mbox h2').innerText)}`);
    if (await p.$('[data-tab="loadout"]')) { await p.click('[data-tab="loadout"]'); await p.waitForTimeout(200); } else console.log('(no Loadout tab yet)');
    console.log('loadout warn:', await txt('.cwarn') || '(none)');
    if (n === 8) await p.screenshot({ path: S + '/shots/q-loadout.png' });
    await p.click('[data-tab="treat"]'); await p.waitForTimeout(200);
    console.log(await p.evaluate(() => [...document.querySelectorAll('.tcard')].map(t => t.querySelector('b').textContent + ' -> ' + ((t.querySelector('.here') || {}).textContent || '-')).join('\n')));
    if (n === 8) await p.screenshot({ path: S + '/shots/q-treat.png' });
  }
  // undo: buy 2 upgrades + 1 vaccine, undo all three
  await p.click('[data-tab="shop"]'); await p.waitForTimeout(200);
  const ids = await p.evaluate(() => [...document.querySelectorAll('[data-buy]:not([disabled])')].slice(0, 2).map(x => x.dataset.buy));
  for (const id of ids) { await p.click(`[data-buy="${id}"]`); await p.waitForTimeout(150); }
  await p.click('[data-tab="vax"]'); await p.waitForTimeout(150);
  await p.click('[data-vax]'); await p.waitForTimeout(150);
  let s = await LS(); console.log('\nafter buys:', s.samples, JSON.stringify(s.upgrades), JSON.stringify(s.vaccines), '| undo btn:', await txt('#campUndo'));
  await p.screenshot({ path: S + '/shots/q-undo.png' });
  for (let i = 0; i < 3; i++) { await p.click('#campUndo'); await p.waitForTimeout(150); }
  s = await LS(); console.log('after 3 undos:', s.samples, JSON.stringify(s.upgrades), JSON.stringify(s.vaccines), '| undo btn left:', !!(await p.$('#campUndo')));
  // undo cleared by Start
  await p.click('[data-tab="shop"]'); await p.click(`[data-buy="${ids[0]}"]`); await p.waitForTimeout(150);
  await p.click('#campGo'); await p.waitForTimeout(600);
  await p.evaluate(() => { const b = document.querySelector('#campBack, #guideClose'); });
  console.log('started; bought cleared:', await p.evaluate(() => !document.querySelector('#campUndo')), '| errors:', errs.length ? errs : 'none');
  await b.close();
})();

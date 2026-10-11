// Browser test. Copy ../index.html to <dir>/camp.html, then: NODE_PATH=$(npm root -g) node tests/THIS.js <dir>  (needs <dir>/shots/)
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2]; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + S + '/camp.html'); await p.waitForTimeout(800);
  const seen = { goal: true, shop: true, treat: true, vax: true, loadout: true };
  for (const [n, vax, loadout] of [[1, {}, null], [3, { staph: 1 }, null], [6, { staph: 1, mrsa: 1 }, ['net']], [7, {}, null], [9, { virus: 1 }, null]]) {
    await p.evaluate(([n, vax, loadout, seen]) => { const c = {}; LEVEL_ORDER.slice(0, n).forEach(k => c[k] = true);
      localStorage.setItem('cytostormCampaign.slots', JSON.stringify([{ v: 1, samples: 900, cleared: c, plays: {}, upgrades: {}, vaccines: vax, loadout, dropped: loadout ? ['nk'] : [], treat: {}, earned: 900, seen, diff: 'normal' }, null, null])); }, [n, vax, loadout, seen]);
    await p.reload(); await p.waitForTimeout(900); await p.click('[data-go="0"]'); await p.waitForTimeout(300);
    if (n === 9) { console.log('map rows:', await p.evaluate(() => [...document.querySelectorAll('.mrow')].map(r => r.querySelector('.nm').textContent + ':' + [...r.querySelectorAll('.gi')].map(g => g.querySelector('img').alt).join('/')).join(' | '))); await p.screenshot({ path: S + '/shots/g-map.png' }); }
    await p.click('.mrow.open'); await p.waitForTimeout(400);
    console.log(`\n== stage ${n + 1}:`, await p.evaluate(() => document.querySelector('#mbox h2').innerText));
    console.log(await p.evaluate(() => [...document.querySelectorAll('.germ')].map(g => g.innerText.replace(/\n+/g, ' / ') + (g.querySelector('.miss') ? '  [AMBER]' : '')).join('\n')));
    await p.screenshot({ path: S + `/shots/g-${n + 1}.png` });
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('#mbox').scrollWidth, document.querySelector('#mbox').clientWidth]);
    if (w[1] > w[2]) console.log('OVERFLOW', w);
  }
  await p.click('.germ:last-child'); await p.waitForTimeout(400);
  console.log('\nguide open:', await p.evaluate(() => [document.querySelector('#mbox [aria-selected="true"], #mbox .tab.on') && 1, (document.querySelector('.unit.flash h4') || {}).textContent]));
  await p.screenshot({ path: S + '/shots/g-guide.png' });
  await p.click('#guideClose'); await p.waitForTimeout(300);
  console.log('back to:', await p.evaluate(() => document.querySelector('#mbox h2').innerText), '| errors:', errs.length ? errs : 'none');
  await b.close();
})();

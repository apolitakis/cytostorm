// Browser test. Copy ../index.html to <dir>/camp.html, then: NODE_PATH=$(npm root -g) node tests/THIS.js <dir>  (needs <dir>/shots/)
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2]; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + S + '/camp.html';
  const h2 = () => p.evaluate(() => document.querySelector('#mbox h2').innerText);
  const slotsLS = () => p.evaluate(() => JSON.parse(localStorage.getItem('cytostormCampaign.slots')));
  await p.goto(url); await p.waitForTimeout(800);
  // 1. legacy single save moves into slot 1
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('cytostormCampaign.state', JSON.stringify({ v: 1, samples: 140, cleared: { papercut: true }, plays: { papercut: 1 }, upgrades: {}, vaccines: {}, loadout: null, treat: {}, earned: 140 })); });
  await p.reload(); await p.waitForTimeout(1000);
  console.log('1 boot screen:', await h2(), '| rows:', await p.evaluate(() => [...document.querySelectorAll('.slotrow')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' || ')), '| old key gone:', await p.evaluate(() => localStorage.getItem('cytostormCampaign.state') === null));
  await p.screenshot({ path: S + '/shots/s1-slots.png' });
  // 2. continue slot 1
  await p.click('[data-go="0"]'); await p.waitForTimeout(400);
  console.log('2 continue ->', await h2(), '| top:', await p.evaluate(() => document.querySelector('.camptop').innerText.replace(/\n/g, ' ')));
  // 3. refresh does not resume
  await p.reload(); await p.waitForTimeout(1000);
  console.log('3 after refresh:', await h2());
  // 4. new campaign in slot 2 on Hard
  await p.click('[data-new="1"]'); await p.waitForTimeout(300);
  console.log('4 new ->', await h2(), '| slot 2 before pick:', JSON.stringify((await slotsLS())[1]));
  await p.click('[data-pick="hard"]'); await p.click('#campDiffOk'); await p.waitForTimeout(200);
  console.log('  ->', await h2()); await p.click('#campGoalOk'); await p.waitForTimeout(200);
  console.log('  ->', await h2(), '| slot 2 diff:', (await slotsLS())[1].diff);
  await p.click('#toSlots'); await p.waitForTimeout(300);
  // 5. delete slot 1 (two taps)
  await p.click('[data-del="0"]'); await p.waitForTimeout(150);
  console.log('5 first tap label:', await p.evaluate(() => document.querySelector('[data-del="0"]').innerText), '| slot 1 still there:', !!(await slotsLS())[0]);
  await p.click('[data-del="0"]'); await p.waitForTimeout(150);
  console.log('  after confirm, slot 1:', JSON.stringify((await slotsLS())[0]));
  // 6. Clinic by stage, then a fight pays into its own slot
  for (const [n, seen, tag] of [[1, { goal: true }, 'b'], [3, { goal: true, shop: true, treat: true }, 'd'], [4, { goal: true, shop: true, treat: true, vax: true, loadout: true }, 'e']]) {
    await p.evaluate(([n, seen]) => { const c = {}; LEVEL_ORDER.slice(0, n).forEach(k => c[k] = true);
      localStorage.setItem('cytostormCampaign.slots', JSON.stringify([{ v: 1, samples: 900, cleared: c, plays: {}, upgrades: {}, vaccines: {}, loadout: null, treat: {}, earned: 900, seen, diff: 'normal' }, null, null])); }, [n, seen]);
    await p.reload(); await p.waitForTimeout(900); await p.click('[data-go="0"]'); await p.waitForTimeout(300);
    await p.click('.mrow.open'); await p.waitForTimeout(400);
    console.log('6', tag, 'tabs:', await p.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(x => x.textContent).join(',')), 'coach:', await p.evaluate(() => (document.querySelector('.coach b') || {}).textContent || '-'));
  }
  await p.click('#campGo'); await p.waitForTimeout(800);
  for (let i = 0; i < 4; i++) { const has = await p.evaluate(() => !document.querySelector('#modal').hidden && [...document.querySelectorAll('#mbox button')].some(b => /Skip|Start/.test(b.textContent))); if (!has) break; await p.evaluate(() => [...document.querySelectorAll('#mbox button')].find(b => /Skip|Start/.test(b.textContent)).click()); await p.waitForTimeout(600); }
  await p.evaluate(() => { const g = window.__cyto.game; let n = 0; while (!g.result && n < 60 * 600) { g.step(1 / 60); n++; } });
  await p.waitForTimeout(2500);
  console.log('7 end: samples in slot 1 now', (await slotsLS())[0].samples, '(was 900) | panel:', await p.evaluate(() => (document.querySelector('.camppay') || {}).innerText || 'none').then(t => t.replace(/\n/g, ' ')));
  console.log(errs.join(' | ') || 'no errors'); await b.close();
})();

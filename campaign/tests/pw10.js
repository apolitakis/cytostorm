// Browser test (V13, Play V39's units). Copy ../index.html to <dir>/camp.html, then: NODE_PATH=$(npm root -g) node tests/THIS.js <dir>  (needs <dir>/shots/)
// Per stage with a default loadout: the Clinic tabs, the default specialists, the "New here" tag; then a loadout missing
// a counter warns; the shop's new-unit lines are locked until their unit joins; a fight starts with the loadout's units.
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2]; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + S + '/camp.html'); await p.waitForTimeout(800);
  const seen = { goal: true, shop: true, treat: true, vax: true, loadout: true };
  const txt = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(x => x.innerText.replace(/\n+/g, ' / ')).join('\n'), sel);
  async function open(n, extra) {
    await p.evaluate(([n, seen, extra]) => { const c = {}; LEVEL_ORDER.slice(0, n).forEach(k => c[k] = true);
      localStorage.setItem('cytostormCampaign.slots', JSON.stringify([Object.assign({ v: 1, samples: 900, cleared: c, plays: {}, upgrades: {}, vaccines: {}, loadout: null, treat: {}, earned: 900, seen, diff: 'normal' }, extra), null, null])); }, [n, seen, extra || {}]);
    await p.reload(); await p.waitForTimeout(900); await p.click('[data-go="0"]'); await p.waitForTimeout(300);
    await p.click('.mrow.open'); await p.waitForTimeout(400);
  }
  for (let n = 1; n < 10; n++) {
    await open(n);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(x => x.dataset.tab).join(','));
    let line = `${await p.evaluate(() => document.querySelector('#mbox h2').innerText)} | tabs ${tabs}`;
    if (tabs.includes('loadout')) {
      await p.click('[data-tab="loadout"]'); await p.waitForTimeout(200);
      line += ` | bringing ${await p.evaluate(() => [...document.querySelectorAll('.ctog[aria-pressed="true"]')].map(x => x.closest('.crow').querySelector('b').innerText.replace(/\n/g, ' ')).join(' + '))}`;
      line += ` | warn ${await txt('.cwarn') || '-'}`;
      if (n === 4 || n === 9) await p.screenshot({ path: S + `/shots/l${n + 1}-loadout.png`, fullPage: true });
    }
    console.log(line);
  }
  // Belly with B cells + Tregs packed: Tapeworm and Influenza have no counter -> warnings, orange card lines
  await open(9, { loadout: ['bcell', 'treg'] });
  await p.click('[data-tab="loadout"]'); await p.waitForTimeout(200);
  console.log('\nBelly, B cells + Tregs: warn', await txt('.cwarn'));
  console.log('missing on cards:', await txt('.gbeat.miss'));
  // shop at stage 5: unlocked unit lines buyable, later ones locked
  await open(4);
  await p.click('[data-tab="shop"]'); await p.waitForTimeout(200);
  console.log('\nshop (Knee):', await p.evaluate(() => [...document.querySelectorAll('h4')].pop().innerText + ': ' + [...document.querySelectorAll('.crow')].slice(-8).map(r => r.querySelector('b').innerText.replace(/\s+/g, ' ').trim() + (r.classList.contains('locked') ? ' [locked: ' + r.querySelector('small').innerText + ']' : '')).join(' | ')));
  await p.screenshot({ path: S + '/shots/shop-units.png', fullPage: true });
  // the fight uses the loadout
  await p.click('#campGo'); await p.waitForTimeout(900);
  const skip = await p.$('text=Skip'); if (skip) { await skip.click(); await p.waitForTimeout(600); }
  const rb = p.locator('text=Response >> visible=true').first(); if (await rb.count()) { await rb.click(); await p.waitForTimeout(400); }
  const body = await p.evaluate(() => document.body.innerText);
  console.log('\nKnee fight shows:', ['Neutrophils', 'Macrophages', 'Net neutrophils', 'Platelets', 'B cells', 'NK cells'].filter(u => body.includes(u)).join(', '));
  await p.screenshot({ path: S + '/shots/knee-fight.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();

const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, name] of [[390, 844, 'phone'], [1280, 820, 'desk']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file:///mnt/project-files/tutorial/index.html');
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `page-${name}.png` });
    if (name === 'phone') { await p.click('.cyt-next'); await p.click('.cyt-next'); await p.click('.cyt-next'); await p.waitForTimeout(4600); await p.screenshot({ path: 'page-phone2.png' }); }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(name, 'scrollWidth', sw, 'errors', errs);
  }
  await b.close();
})();

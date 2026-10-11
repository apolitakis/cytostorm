const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h] of [[390, 700], [520, 400], [320, 560]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errs.push(w + ' ' + e));
    await p.goto('file:///mnt/project-files/tutorial/index.html'); await p.waitForTimeout(800);
    const r = await p.evaluate(([w, h]) => { const out = []; const c = document.createElement('canvas'); c.width = w; c.height = h; document.body.appendChild(c);
      for (const id of Object.keys(CytoTutorial.CLIPS)) { const L = CytoTutorial.CLIPS[id].dur; for (let t = 0; t <= L; t += L / 9) { try { CytoTutorial.drawFrame(c, id, t); } catch (e) { out.push(id + '@' + t.toFixed(1) + ' ' + e.message); break; } } }
      return { n: Object.keys(CytoTutorial.CLIPS).length, out, len: CytoTutorial.length('surge') }; }, [w, h]);
    console.log(w, h, JSON.stringify(r));
  }
  console.log('pageerrors', errs); await b.close();
})();

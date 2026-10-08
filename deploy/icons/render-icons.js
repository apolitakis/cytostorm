const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const svg = fs.readFileSync('/mnt/project-files/prototype/assets/neutrophil.svg', 'utf8');
  for (const [name, px] of [['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<body style="margin:0;background:#04050A;position:relative;width:${px}px;height:${px}px;overflow:hidden">
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${px*1.9}px;height:${px*1.9}px">${svg.replace('width="64" height="64"', 'width="100%" height="100%"')}</div></body>`);
    await p.screenshot({ path: '/mnt/project-files/deploy/icons/' + name });
  }
  await b.close();
})();

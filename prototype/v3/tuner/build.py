#!/usr/bin/env python3
"""Build the v3 difficulty tuner: python3 tuner/build.py -> tuner/index.html (the tuner) and tuner/play.html
(a copy of the game that reads the tuner's settings). Run `node tuner/baseline.js` first when the
live game's numbers change, so the page opens with up-to-date results (the page flags results made
with older sim.js/bots.js code)."""
import hashlib, json, pathlib, re
here = pathlib.Path(__file__).resolve().parent
v3 = here.parent
NODE_EXPORT = "if (typeof module !== 'undefined') module.exports"
def code(p):
    c = p.read_text().replace(NODE_EXPORT, '// (node export removed)')
    assert '</script' not in c.lower(), f'{p} contains a closing script tag'
    return c
sim, bots = code(v3 / 'src/sim.js'), code(v3 / 'src/bots.js')
src_hash = hashlib.sha1((v3 / 'src/sim.js').read_bytes() + (v3 / 'src/bots.js').read_bytes()).hexdigest()[:12]
worker = sim + '\n' + bots + '''
const slim = r => ({ win: r.win, stars: r.stars, t: Math.round(r.t), cause: r.cause, peakTimer: +(r.peakTimer || 0).toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), maxAg: r.maxAg, curve: r.curve.filter((_, i) => i % 5 === 0) });
self.onmessage = e => { const { job, settings } = e.data; applySettings(settings); self.postMessage({ job, r: slim(runMatch(job.level, job.policy, job.seed, job.params)) }); };
'''
bl = here / 'baseline.json'
baseline = bl.read_text() if bl.exists() else '{"levels": {}}'
base_src = json.loads(baseline).get('src')
page = (here / 'template.html').read_text()
for marker, text in {'/*SIM*/': sim, '/*BOTS*/': bots, '/*BASELINE*/': baseline, '/*SRCHASH*/': json.dumps(src_hash),
                     '/*WORKERSRC*/': json.dumps(worker).replace('</', '<\\/'), '/*TUNER*/': code(here / 'tuner.js')}.items():
    assert marker in page, marker
    page = page.replace(marker, text, 1)
(here / 'index.html').write_text(page)
print(f'tuner/index.html: {len(page) / 1024:.0f} KB')
if base_src != src_hash:
    print(f'  note: baseline.json was made with other sim.js/bots.js code ({base_src} vs {src_hash}); the page will say so. Rerun baseline.js.')

# The game, built from the same source the way v3/build.py does it (kept in memory so v3/index.html is untouched),
# with a button back to the tuner
game = (v3 / 'src/template.html').read_text()
for marker, path in {'/*ART*/': v3.parent / 'assets/assets.js', '/*SIM*/': v3 / 'src/sim.js', '/*UI*/': v3 / 'src/ui.js'}.items():
    assert marker in game, marker
    game = game.replace(marker, code(path))
btn = '<button id="helpBtn"'
assert btn in game
game = game.replace(btn, '<button id="tunerBack" class="hbtn" type="button" onclick="history.length > 1 ? history.back() : (location.href = \'index.html\')">Tuner</button>\n      ' + btn, 1)
game = game.replace('</style>', '#tunerBack { position: relative; z-index: 21; border-color: var(--gold); color: var(--gold); }\n</style>', 1)
game, n = re.subn(r'<title>(.*?)</title>', lambda m: f'<title>{m.group(1)} (tuner settings)</title>', game, count=1)
assert n == 1, 'game template has no <title>'
# Supporting pages are served as written, so this one carries its own document head
game = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + game + '\n</html>\n')
(here / 'play.html').write_text(game)
print(f'tuner/play.html: {len(game) / 1024:.0f} KB')

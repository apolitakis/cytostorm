#!/usr/bin/env python3
"""Build the difficulty tuner: python3 tuner/build.py -> tuner/index.html (the tuner) and tuner/play.html
(a copy of the game that reads the tuner's settings). Run `node tuner/baseline.js` first when the
live game's numbers change, so the page opens with up-to-date results."""
import json, pathlib, subprocess
here = pathlib.Path(__file__).parent
v2 = here.parent
NODE_EXPORT = "if (typeof module !== 'undefined') module.exports"
def code(p):
    c = p.read_text().replace(NODE_EXPORT, '// (node export removed)')
    assert '</script' not in c.lower(), f'{p} contains a closing script tag'
    return c
sim, bots = code(v2 / 'src/sim.js'), code(v2 / 'src/bots.js')
worker = sim + '\n' + bots + '''
const slim = r => ({ win: r.win, stars: r.stars, t: Math.round(r.t), peakTimer: +r.peakTimer.toFixed(2), fatiguePeak: Math.round(r.fatiguePeak), curve: r.curve.filter((_, i) => i % 5 === 0) });
self.onmessage = e => { const { job, settings } = e.data; applySettings(settings); self.postMessage({ job, r: slim(runMatch(job.policy, job.seed, job.params)) }); };
'''
baseline = (here / 'baseline.json').read_text()
page = (here / 'template.html').read_text()
for marker, text in {'/*SIM*/': sim, '/*BOTS*/': bots, '/*BASELINE*/': baseline,
                     '/*WORKERSRC*/': json.dumps(worker).replace('</', '<\\/'), '/*TUNER*/': code(here / 'tuner.js')}.items():
    assert marker in page, marker
    page = page.replace(marker, text, 1)
(here / 'index.html').write_text(page)
print(f'tuner/index.html: {len(page) / 1024:.0f} KB')

# The game, built from the same source, with a button back to the tuner
subprocess.run(['python3', str(v2 / 'build.py')], check=True)
game = (v2 / 'index.html').read_text()
btn = '<button id="helpBtn"'
assert btn in game
game = game.replace(btn, '<button id="tunerBack" class="hbtn" type="button" onclick="history.length > 1 ? history.back() : (location.href = \'index.html\')">Tuner</button>\n      ' + btn, 1)
game = game.replace('</style>', '#tunerBack { position: relative; z-index: 21; border-color: var(--gold); color: var(--gold); }\n</style>', 1)
game = game.replace('<title>Immune RTS v2</title>', '<title>Immune RTS v2 (tuner settings)</title>', 1)
# Supporting pages are served as written, so this one carries its own document head
game = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + game + '\n</html>\n')
(here / 'play.html').write_text(game)
print(f'tuner/play.html: {len(game) / 1024:.0f} KB')

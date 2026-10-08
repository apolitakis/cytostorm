#!/usr/bin/env python3
"""Inline the art kit, the tutorial clips (read-only, owned by Tutorial animations), the sound (audio/cytosound.js, read-only, owned by Music and sound samples), v3's sim (read-only, owned by the build thread) and the workshop into one page:
python3 build.py -> index.html. Rebuild after v3's sim.js changes to pick them up."""
import pathlib
here = pathlib.Path(__file__).parent
proto = here.parent / 'prototype'
page = (here / 'src/template.html').read_text()
parts = {'/*ART*/': proto / 'assets/assets.js', '/*TUT*/': here.parent / 'tutorial/tutorial.js', '/*AUDIO*/': here.parent / 'audio/cytosound.js', '/*SIM*/': proto / 'v3/src/sim.js', '/*LAYER*/': here / 'src/layer.js',
         '/*COMBOS*/': here / 'src/combos.js', '/*UI*/': here / 'src/ui.js'}
for marker, path in parts.items():
    if marker not in page: continue  # e.g. /*TUT*/ only exists once v3's template has the tutorial
    code = path.read_text().replace('if (typeof module !== \'undefined\') module.exports', '// (node export removed)')
    assert '</script' not in code.lower(), f'{path} contains a closing script tag'
    page = page.replace(marker, code)
(here / 'index.html').write_text(page)
print(f'index.html: {len(page) / 1024:.0f} KB')

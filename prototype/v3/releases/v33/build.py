#!/usr/bin/env python3
"""Inline the art kit, tutorial clips, sound (audio/cytosound.js, read-only), sim and UI into one self-contained page: python3 build.py -> index.html"""
import pathlib
here = pathlib.Path(__file__).parent
page = (here / 'src/template.html').read_text()
parts = {'/*ART*/': here.parent / 'assets/assets.js', '/*TUT*/': here.parent.parent / 'tutorial/tutorial.js', '/*AUDIO*/': here.parent.parent / 'audio/cytosound.js', '/*SIM*/': here / 'src/sim.js', '/*UI*/': here / 'src/ui.js'}
for marker, path in parts.items():
    code = path.read_text().replace('if (typeof module !== \'undefined\') module.exports', '// (node export removed)')
    assert '</script' not in code.lower(), f'{path} contains a closing script tag'
    page = page.replace(marker, code)
(here / 'index.html').write_text(page)
print(f'index.html: {len(page) / 1024:.0f} KB')

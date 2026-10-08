#!/usr/bin/env python3
"""Inline the art kit, sim, combos and UI into one self-contained page: python3 build.py -> index.html"""
import pathlib
here = pathlib.Path(__file__).parent
page = (here / 'src/template.html').read_text()
parts = {'/*ART*/': here.parent / 'prototype/assets/assets.js', '/*SIM*/': here / 'src/sim.js', '/*COMBOS*/': here / 'src/combos.js', '/*UI*/': here / 'src/ui.js'}
for marker, path in parts.items():
    code = path.read_text().replace('if (typeof module !== \'undefined\') module.exports', '// (node export removed)')
    assert '</script' not in code.lower(), f'{path} contains a closing script tag'
    page = page.replace(marker, code)
(here / 'index.html').write_text(page)
print(f'index.html: {len(page) / 1024:.0f} KB')

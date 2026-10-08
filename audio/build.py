"""Builds index.html (the Sound lab page) from src/page.html + src/engine.js + art-kit icons.
Reads prototype/assets/ read-only. Run: python3 build.py"""
import base64, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'prototype', 'assets')
ICONS = ['neutrophil', 'macrophage-kill', 'kill-shard', 'spore-hatch', 'neutrophil-net', 'nk-cell',
         'bacterium-dividing', 'kidneys-damaged', 'lymph-node', 'organ-failure', 'marker-wave', 'star',
         'body-output', 'pause', 'storm', 'heart-healthy', 'tissue', 'vessel-blood', 'fatigue-feverish', 'bacterium']

icons = {}
for name in ICONS:
    svg = open(os.path.join(ASSETS, name + '.svg'), encoding='utf8').read()
    svg = re.sub(r'<metadata>.*?</metadata>', '', svg, flags=re.S)
    svg = svg.replace(' xmlns:c2pa="http://c2pa.org/manifest"', '')
    icons[name] = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()

page = open(os.path.join(HERE, 'src', 'page.html'), encoding='utf8').read()
engine = open(os.path.join(HERE, 'src', 'engine.js'), encoding='utf8').read()
page = page.replace('/*ENGINE*/', engine).replace('/*ICONS*/{}', json.dumps(icons))
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf8').write(page)
print('index.html', len(page) // 1024, 'KB')

# The game module: engine wrapped in one function scope, only window.CytoAudio escapes.
api = open(os.path.join(HERE, 'src', 'game-api.js'), encoding='utf8').read()
tail = "})(typeof window !== 'undefined' ? window : globalThis);"
assert engine.rstrip().endswith(tail)
inner = engine.rstrip()[:-len(tail)] + '})(LIB);\n'
open(os.path.join(HERE, 'cytosound.js'), 'w', encoding='utf8').write(api.replace('/*ENGINE*/', inner))
print('cytosound.js', os.path.getsize(os.path.join(HERE, 'cytosound.js')) // 1024, 'KB')

# The OST page for the site (/ost/): one self-contained file, music synthesized live.
os.makedirs(os.path.join(HERE, 'ost'), exist_ok=True)
ost = open(os.path.join(HERE, 'src', 'ost.html'), encoding='utf8').read().replace('/*ENGINE*/', engine)
open(os.path.join(HERE, 'ost', 'index.html'), 'w', encoding='utf8').write(ost)
print('ost/index.html', len(ost) // 1024, 'KB')

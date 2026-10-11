#!/usr/bin/env python3
"""Strip the Artifact host wrapper from an `Artifact read path=index.html` download.

usage: python3 extract.py <downloaded index.html> <out.html> <play|sandbox|campaign|ost>
"""
import sys, pathlib
src, out, kind = sys.argv[1:4]
title = {'play': '<title>Cytostorm', 'sandbox': '<title>Mechanics Workshop',
         'campaign': '<title>Cytostorm Campaign', 'ost': '<title>Cytostorm OST'}[kind]
s = pathlib.Path(src).read_text()
i = s.index('<body>\n') + 7
assert s.endswith('\n</body></html>'), 'unexpected wrapper tail'
b = s[i:-len('\n</body></html>')]
assert b.startswith(title), b[:80]
if kind != 'ost':
    assert 'id="hud"' in b and 'hudrow' in b, 'game HUD missing'
pathlib.Path(out).write_text(b)
print(out, len(b), 'bytes')

#!/usr/bin/env python3
"""Package Cytostorm as a static website for phones: a hub page that links to each mode.

    python3 make.py                                  # chips say "updated <date>"
    python3 make.py play=v3.4 sandbox=v12 v2=v2.4    # version chips from the published Artifacts
    python3 make.py sandbox:/path/published.html     # build an entry from another file

Writes site/ and cytostorm-site.zip next to this file:
    /            hub (hub/index.html, cards filled in here)
    /play/       the game     <- prototype/v3/index.html
    /sandbox/    the workshop <- workshop/index.html
    /v2/         prototype v2 <- prototype/v2/index.html
    /ost/        soundtrack   <- audio/ost/index.html (music synthesized live, no audio files)
The game builds are not changed: each is wrapped with the <head> tags a standalone page needs on
iPhone (the Artifact viewer adds its own, so the builds leave them out) and a ‹ button in its HUD
that goes back to the hub, since a Home Screen app has no browser back button.
"""
import datetime, json, pathlib, re, shutil, sys, zipfile

here = pathlib.Path(__file__).parent
root = here.parent
site = here / 'site'

ENTRIES = {  # key: (folder, source build, page title)
    'play': ('play', root / 'prototype/v3/index.html', 'Cytostorm'),
    'sandbox': ('sandbox', root / 'workshop/index.html', 'Cytostorm Sandbox'),
    'v2': ('v2', root / 'prototype/v2/index.html', 'Cytostorm v2'),
    'ost': ('ost', root / 'audio/ost/index.html', 'Cytostorm Soundtrack'),
}
GAMES = {'play', 'sandbox', 'v2'}  # pages with the game HUD; other pages get the back button above their content
ART = ['neutrophil.svg', 'storm.svg', 'lymph-node.svg', 'bacterium.svg', 'heart-healthy.svg']

# key=chip sets a hub card's version chip; key:path builds that entry from another file, e.g. the
# body of its published Artifact when the working folder already holds newer, unpublished work.
versions = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
for a in sys.argv[1:]:
    if ':' in a and '=' not in a:
        k, path = a.split(':', 1)
        ENTRIES[k] = (ENTRIES[k][0], pathlib.Path(path), ENTRIES[k][2])
unknown = set(versions) - set(ENTRIES)
assert not unknown, f'unknown entries: {unknown}'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#04050A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cytostorm">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="icon" type="image/png" href="../icon-512.png">
<link rel="manifest" href="../manifest.webmanifest">
"""

# A ‹ button at the start of the HUD row, styled like the game's own buttons, linking to the hub.
# It sits above the game's dialogs (z-index 20) so it works from the intro screen too.
# Falls back to a small fixed button if a build ever drops the #hud .hudrow row.
BACK = """
<style>#hubBack{position:relative;z-index:30;text-decoration:none;color:inherit;font:600 18px/1 system-ui,sans-serif}
#hubBack.hbtn{flex:none;width:26px;min-width:0;padding-left:0;padding-right:0;text-align:center}  /* narrow so the Sandbox HUD row fits a 375px iPhone */
#hubBack.top{position:relative;z-index:30;display:grid;place-items:center;width:34px;height:30px;margin:max(8px,env(safe-area-inset-top)) 0 0 max(8px,env(safe-area-inset-left));background:#0A0D18;border:1px solid #1E2540;border-radius:8px;color:#E8ECF8}
#hubBack.float{position:fixed;z-index:99;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));background:#0A0D18;border:1px solid #1E2540;border-radius:8px;width:34px;height:30px;display:grid;place-items:center}</style>
<script>(function(){var a=document.createElement('a');a.id='hubBack';a.href='../';a.textContent='\\u2039';
a.setAttribute('aria-label','All modes');a.title='All modes';var row=document.querySelector('#hud .hudrow');
if(row){a.className='hbtn';row.insertBefore(a,row.firstChild);}else if(__TOP__){a.className='top';document.body.insertBefore(a,document.body.firstChild);}
else{a.className='float';document.body.appendChild(a);}})();</script>
"""

if site.exists():
    shutil.rmtree(site)
site.mkdir()
today = datetime.date.today()
chips = {}
for key, (folder, build, title) in ENTRIES.items():
    page = build.read_text()
    assert '<meta name="viewport"' not in page, f'{build} already has its own head tags; update make.py'
    assert key not in GAMES or 'id="hud"' in page, f'{build} has no #hud; check the back button still fits'
    page = re.sub(r'<title>[^<]*</title>\s*', '', page, count=1)  # ours replaces the build's
    (site / folder).mkdir()
    (site / folder / 'index.html').write_text(HEAD.format(title=title) + page + BACK.replace('__TOP__', 'false' if key in GAMES else 'true') + '</html>\n')
    when = datetime.date.fromtimestamp(build.stat().st_mtime)
    chips[key] = versions.get(key) or f'updated {when:%b} {when.day}'

hub = (here / 'hub/index.html').read_text()
for key, chip in chips.items():
    hub = hub.replace(f'__{key.upper()}_V__', chip)
hub = hub.replace('__SHIP_DATE__', f'{today:%b} {today.day}, {today.year}')
left = re.findall(r'__[A-Z0-9_]+__', hub)
assert not left, f'hub has unfilled placeholders: {left}'
(site / 'index.html').write_text(hub)

(site / 'art').mkdir()
for name in ART:
    shutil.copy(root / 'prototype/assets' / name, site / 'art' / name)
for name in ('apple-touch-icon.png', 'icon-512.png'):
    shutil.copy(here / 'icons' / name, site / name)
(site / 'manifest.webmanifest').write_text(json.dumps({
    'name': 'Cytostorm', 'short_name': 'Cytostorm', 'start_url': '/', 'scope': '/', 'display': 'standalone',
    'orientation': 'portrait', 'background_color': '#04050A', 'theme_color': '#04050A',
    'icons': [{'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'}],
}, indent=2))
# Short links, like Sonterra's: /workshop and /v3 land on the right page.
(site / '_redirects').write_text('/workshop  /sandbox/  302\n/v3  /play/  302\n/ost  /ost/  302\n')

with zipfile.ZipFile(here / 'cytostorm-site.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(site.rglob('*')):
        if f.is_file():
            z.write(f, f.relative_to(site))
print('site/ built:', ', '.join(f'/{ENTRIES[k][0]}/ {v}' for k, v in chips.items()))

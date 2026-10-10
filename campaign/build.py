#!/usr/bin/env python3
"""Build the Cytostorm campaign into one page: python3 build.py -> index.html

Reads the main game read-only at build time (prototype/v3/src, owned by "Build the web prototype"; the art kit,
tutorial clips and sound, each owned by their threads) and adds the campaign layer (src/). v3's ui.js gets a few
small hook calls, every anchor asserted, so a v3 change that moves one stops the build and names it.
Rebuild whenever the main game changes."""
import pathlib
here = pathlib.Path(__file__).parent
root = here.parent
import os
# Build from a frozen release (prototype/v3/releases/<v>/), named in each handoff, never from live src: V3=releases/v26 python3 build.py
v3 = root / 'prototype/v3' / os.environ.get('V3', 'src')

def rep(text, a, b, count=1):
    n = text.count(a)
    assert n == count, f'anchor found {n} times (want {count}): {a[:90]!r}'
    return text.replace(a, b)

# ---- v3's ui.js with the campaign hooks ----
ui = (v3 / 'ui.js').read_text()
ui = ui.replace("'immuneRtsV3.", "'cytostormCampaign.")  # own saved settings, so the campaign never changes the main game's
ui = ui.replace("'cytostormV3.difficulty'", "'cytostormCampaign.difficulty'")  # the campaign plays at Normal even if Play is set to Hard on the same site
ui = rep(ui, "  function showStart() {\n", "  function showStart() {\n    if (window.CampaignHooks) return CampaignHooks.showMap(); // campaign: body map and Clinic\n")
ui = rep(ui, "    game = new Game(levelKey, seed);\n",
         "    if (window.CampaignHooks) CampaignHooks.beforeGame(levelKey); // campaign: upgrades, treatment, loadout\n"
         "    game = new Game(levelKey, seed);\n"
         "    if (window.CampaignHooks) CampaignHooks.afterGame(game); // campaign: Samples, antibiotics, vaccines\n")
ui = rep(ui, "    $('#fbEnd').addEventListener('click', () => showFeedback('end'));\n  }\n",
         "    $('#fbEnd').addEventListener('click', () => showFeedback('end'));\n    if (window.CampaignHooks) CampaignHooks.afterEnd(r); // campaign: Samples and where to go next\n  }\n")
ui = rep(ui, "  newGame();\n  showStart();\n  requestAnimationFrame(frame);\n})();",
         "  if (window.CampaignHooks) CampaignHooks.init({ openModal, closeModal, newGame, startWithTutorial, showGuide, toast, esc, kindName, UNIT, ANTIGEN,\n"
         "    setLevel: k => { levelKey = k; }, modal: () => modal, get game() { return game; } });\n"
         "  newGame();\n  showStart();\n  requestAnimationFrame(frame);\n})();")

# ---- page ----
page = (v3 / 'template.html').read_text()
page = rep(page, '<title>Cytostorm v3</title>', '<title>Cytostorm Campaign</title>')
page = rep(page, '</style>', (here / 'src/campaign.css').read_text() + '</style>')
page = rep(page, '<script>\n/*UI*/', '<script>\n/*CAMP*/\n</script>\n<script>\n/*UI*/')
parts = {'/*ART*/': root / 'prototype/assets/assets.js', '/*TUT*/': root / 'tutorial/tutorial.js', '/*AUDIO*/': root / 'audio/cytosound.js',
         '/*SIM*/': v3 / 'sim.js', '/*CAMP*/': None, '/*UI*/': None}
for marker, path in parts.items():
    if marker not in page: continue
    if marker == '/*CAMP*/': code = '\n'.join((here / 'src' / f).read_text() for f in ('body-art.js', 'campaign.js', 'camp-ui.js'))
    elif marker == '/*UI*/': code = ui
    else: code = path.read_text()
    code = code.replace("if (typeof module !== 'undefined') module.exports", '// (node export removed)')
    assert '</script' not in code.lower(), f'{marker} contains a closing script tag'
    page = page.replace(marker, code)
(here / 'index.html').write_text(page)
print(f'index.html: {len(page) / 1024:.0f} KB')

#!/usr/bin/env python3
"""Build the Campaign Planner page: page.html + campaign rules (read-only copy of campaign/src/campaign.js) + model.json -> index.html.
   CAMP=<campaign/src> MODEL=<model.json> python3 build.py"""
import os, pathlib
here = pathlib.Path(__file__).parent
camp = pathlib.Path(os.environ.get('CAMP', here / '../../campaign/src')) / 'campaign.js'
model = pathlib.Path(os.environ.get('MODEL', here / 'model.json'))
page = (here / 'page.html').read_text()
assert '/*CAMPAIGN*/' in page and '/*MODEL*/null' in page
page = page.replace('/*CAMPAIGN*/', camp.read_text().replace('</script', '<\\/script')).replace('/*MODEL*/null', model.read_text().strip())
(here / 'index.html').write_text(page)
print(f'index.html {len(page) // 1024} KB')

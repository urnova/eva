import json
import re

# package.json
pkg_path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/package.json'
with open(pkg_path, 'r', encoding='utf-8') as f:
    pkg = json.load(f)

pkg['version'] = '5.4.25'

with open(pkg_path, 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2)

# index.html
html_path = 'f:/code/eva/evaprojectmultiplatforme/EVA_V4_fixed_v4/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'<span id="appVersionText">v[0-9\.]+</span>', '<span id="appVersionText">v5.4.25</span>', html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

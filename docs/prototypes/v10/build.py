# Builds next-year-no-fish.html from the parts in this folder (and portraits.js).
import os
here = os.path.dirname(os.path.abspath(__file__))
parts = ['head.html', 'core.js', 'portraits.js', 'world.js', 'fish.js', 'music.js', 'ui.js', 'village.js', 'rush.js', 'poach.js', 'hold.js', 'party.js', 'main.js']
html = ''.join(open(os.path.join(here, p), encoding='utf-8').read() if p.endswith('.html') else '\n' + open(os.path.join(here, p), encoding='utf-8').read() for p in parts)
open(os.path.join(here, 'next-year-no-fish.html'), 'w', encoding='utf-8').write(html)
print(len(html))

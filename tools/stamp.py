"""Cache-bust local assets: rewrite every static/css|js reference in index.html to ?v=<content hash>.

Run after editing CSS/JS (python tools/stamp.py) so browsers never keep running a stale copy.
"""
import hashlib, os, re

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
page = os.path.join(ROOT, 'index.html')
html = open(page, encoding='utf-8').read()


def stamp(m):
    path = m.group(2)
    digest = hashlib.sha1(open(os.path.join(ROOT, path), 'rb').read()).hexdigest()[:10]
    return f'{m.group(1)}{path}?v={digest}{m.group(3)}'


new = re.sub(r'((?:src|href)=")(static/(?:css|js)/[^"?]+)(?:\?v=[0-9a-f]+)?(")', stamp, html)
open(page, 'w', encoding='utf-8').write(new)
print('\n'.join(re.findall(r'static/(?:css|js)/[^"]+', new)))

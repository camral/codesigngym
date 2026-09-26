"""Download Pokemon Showdown battle replays (poke-env HTML) for each method's best seed per Pokenv preset, and summarise them.

Usage (from this repo root, with wandb logged in): python tools/fetch_replays.py [path/to/codesign-gym]
Writes static/replays/<preset>/<method>-{best,worst}.html and static/data/replays.json (teams, winner, turns).
The replay pages carry only the text battle log; the Showdown client (replay-embed.js) and its artwork load from
play.pokemonshowdown.com at view time, exactly as Showdown's own shared replays do.
"""
import json, math, os, pickle, re, sys, tempfile
import concurrent.futures as cf

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GYM = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'codesign-gym'))
cache = pickle.load(open(os.path.join(GYM, 'baseline_figures', '_wandb_cache.pkl'), 'rb'))
METHODS = ['cmaes', 'fasttd3', 'ppo_ngopt', 'loki']
# replay-embed.js resolves a few effect sprites relative to the host page; point relative URLs at the Showdown client instead
BASE = '<base href="https://play.pokemonshowdown.com/" target="_blank">\n<style>html, body { overflow: hidden; background: #3b3b3b; } body { padding: 0 !important; }</style>'


def score(r):
    v = r['summ'].get('eval/reward')
    return v if isinstance(v, (int, float)) and math.isfinite(v) else -math.inf


best = {}
for r in cache.values():
    if not str(r['env']).startswith('Pokenv') or r['method'] not in METHODS or not isinstance(r['summ'].get('eval/best_replay'), dict): continue
    k = (r['env'], r['method'])
    if k not in best or score(r) > score(best[k]): best[k] = r


def summarise(html):
    log = re.search(r'class="battle-log-data">(.*?)</script>', html, re.S).group(1)
    lines = [l.strip() for l in log.splitlines()]
    names = {m.group(1): m.group(2) for m in (re.match(r'\|player\|(p[12])\|([^|]*)', l) for l in lines) if m}
    def team(p):  # team preview when the format has one, else every species that switched in (random formats have no preview)
        t = [l.split('|')[3] for l in lines if l.startswith(f'|poke|{p}|')] or [l.split('|')[3] for l in lines if re.match(rf'\|(switch|drag)\|{p}a:', l)]
        return list(dict.fromkeys(re.sub(r'-\*$', '', re.sub(r',.*', '', x)) for x in t))
    turns = max([int(l.split('|')[2]) for l in lines if re.match(r'\|turn\|\d+$', l)] or [0])
    win = next((l.split('|')[2] for l in lines if l.startswith('|win|')), None)
    fainted = {p: sum(1 for l in lines if l.startswith(f'|faint|{p}')) for p in ('p1', 'p2')}
    tier = next((l.split('|')[2] for l in lines if l.startswith('|tier|')), '')
    preview = any(l.startswith('|poke|p1|') for l in lines)
    return dict(agent=team('p1'), opponent=team('p2'), team_preview=preview, turns=turns, won=(win == names.get('p1')) if win else None, agent_fainted=fainted['p1'],
                opponent_fainted=fainted['p2'], format=tier)


import wandb  # noqa: E402
api = wandb.Api(timeout=180)


def job(item):
    (env, m), r = item
    d = os.path.join(ROOT, 'static', 'replays', env); os.makedirs(d, exist_ok=True)
    out = {}
    for kind in ('best', 'worst'):
        meta = r['summ'].get(f'eval/{kind}_replay')
        if not isinstance(meta, dict): continue
        dst = os.path.join(d, f'{m}-{kind}.html')
        if not os.path.exists(dst):
            f = api.run(r['path']).file(meta['path']).download(root=tempfile.mkdtemp(), replace=True)
            html = open(f.name, encoding='utf-8').read()
            html = html.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n' + BASE, 1)
            open(dst, 'w', encoding='utf-8').write(html)
        out[kind] = dict(src=f'static/replays/{env}/{m}-{kind}.html', **summarise(open(dst, encoding='utf-8').read()))
    return env, m, dict(seed=r['seed'], ret=float(f'{score(r):.4g}'), **out)


man = {}
with cf.ThreadPoolExecutor(6) as ex:
    for env, m, info in ex.map(job, sorted(best.items())):
        man.setdefault(env, {})[m] = info
        b = info.get('best', {})
        print('ok', env, m, 'won' if b.get('won') else 'lost', b.get('turns'), 'turns |', ', '.join(b.get('agent', [])), flush=True)
json.dump(man, open(os.path.join(ROOT, 'static', 'data', 'replays.json'), 'w'), indent=1, sort_keys=True)
print('wrote static/data/replays.json', sum(len(v) for v in man.values()), 'method entries')

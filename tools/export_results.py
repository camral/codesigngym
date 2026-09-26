"""Export the paper baseline results (codesign-gym/make_figures.py aggregation) to static/data/results.json for the interactive explorer.

Usage (from this repo root): python tools/export_results.py [path/to/codesign-gym]
Curves: seed mean +- std of the step-held eval return on a 4 h wall-clock grid (fully rejected evals are NaN, as in the paper figures).
Finals: summary eval/reward mean +- std over seeds (the paper tables' numbers).
Extra presets not in the paper tables (EXTRA below, e.g. SoftWalker) are fetched straight from wandb into tools/.cache/extra_runs.pkl
(pass --refresh to re-fetch); codesign-gym's own _wandb_cache.pkl is never modified.
"""
import json, math, os, pickle, sys
import numpy as np

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
GYM = os.path.abspath(ARGS[0] if ARGS else os.path.join(os.path.dirname(__file__), '..', '..', 'codesign-gym'))
sys.path.insert(0, GYM)
os.chdir(GYM)
import make_figures as mf  # noqa: E402  (imports make_table for METHODS / MAIN / NO_LOKI)

GRID = np.linspace(0, mf.T_END, 81)
HERE = os.path.dirname(os.path.abspath(__file__))
# (wandb project, env_id, page group) for presets run after the paper tables were frozen
EXTRA = [('cdgym-environment-suite', 'SoftWalkerBeam3D', 'Native')]


def fetch_extra():
    """Same record format as make_figures.fetch, restricted to the EXTRA presets."""
    import wandb
    api, out = wandb.Api(timeout=180), {}
    for proj, env, _ in EXTRA:
        for r in api.runs(f'projectavi/{proj}', per_page=500):
            m = mf.ALIAS.get(r.config.get('method'), r.config.get('method'))
            if r.config.get('env_id') != env or m not in mf.NAME or (proj, m) in mf.SKIP: continue
            rows = [{k: v for k, v in h.items() if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)} for h in r.scan_history(page_size=1000)]
            out[r.id] = dict(project=proj, path=f'projectavi/{proj}/{r.id}', method=m, env=env, seed=r.config.get('seed'), state=r.state, summ=dict(r.summary._json_dict), hist=rows)
    return out


runs = pickle.load(open(mf.CACHE, 'rb'))
xcache = os.path.join(HERE, '.cache', 'extra_runs.pkl')
if '--refresh' in sys.argv or not os.path.exists(xcache):
    os.makedirs(os.path.dirname(xcache), exist_ok=True); pickle.dump(fetch_extra(), open(xcache, 'wb'))
extra = pickle.load(open(xcache, 'rb'))
runs = {k: v for k, v in runs.items() if v['env'] not in {e for _, e, _ in EXTRA}}   # the extra fetch is the source of truth for these presets
runs.update(extra)
g = mf.by(runs)


def r3(x): return None if x is None or not math.isfinite(x) else float(f'{x:.4g}')


def curve(rs):
    ys = np.array([mf.hold(*mf.eval_series(r), GRID) for r in rs if len(mf.eval_series(r)[0])])
    if not len(ys): return None
    ok = np.sum(~np.isnan(ys), 0) > 0
    with np.errstate(all='ignore'):
        mu, sd = np.nanmean(ys, 0), np.nanstd(ys, 0)
    return dict(mean=[r3(v) if o else None for v, o in zip(mu, ok)], std=[r3(v) if o else None for v, o in zip(sd, ok)])


def final(rs):
    v = [float(r['summ']['eval/reward']) for r in rs if isinstance(r['summ'].get('eval/reward'), (int, float)) and math.isfinite(r['summ']['eval/reward'])]
    if not v: return None
    rej = [r['summ'].get('eval/embodiment_rejection_rate') for r in rs]
    rej = [x for x in rej if isinstance(x, (int, float))]
    return dict(mean=r3(np.mean(v)), std=r3(np.std(v)), n=len(v), rejection=r3(np.mean(rej)) if rej else None)


presets = []
for groups, with_loki in ((mf.MAIN, True), (mf.NO_LOKI, False)):
    for grp, envs in groups:
        for e in envs:
            ms = {}
            for m, _ in mf.METHODS:
                rs = g[e][m]
                if not rs: continue
                ms[m] = dict(curve=curve(rs), final=final(rs), rejected_evals=mf.n_rejected_evals(rs))
            presets.append(dict(id=e, name=mf.short(e), group=grp, loki=with_loki, methods=ms))
for _, e, grp in EXTRA:
    ms = {m: dict(curve=curve(g[e][m]), final=final(g[e][m]), rejected_evals=mf.n_rejected_evals(g[e][m])) for m, _ in mf.METHODS if g[e][m]}
    presets.append(dict(id=e, name=mf.short(e), group=grp, loki=bool(g[e]['loki']), methods=ms, extra=True))
    print('extra', e, {m: (len(g[e][m]), v['final']) for m, v in ms.items()})

out = dict(t=[float(f'{x:.3f}') for x in GRID], methods=[dict(id=m, name=n, color=mf.COLOR[m]) for m, n in mf.METHODS], loki_prep_h=mf.LOKI_PREP_H,
           budget_h=mf.T_END, presets=presets)
dst = os.path.join(HERE, '..', 'static', 'data', 'results.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', os.path.normpath(dst), f'{os.path.getsize(dst) / 1024:.0f} KB', len(presets), 'presets')

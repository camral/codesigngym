"""Export the paper baseline results (codesign-gym/make_figures.py aggregation) to static/data/results.json for the interactive explorer.

Usage (from this repo root): python tools/export_results.py [path/to/codesign-gym]
Curves: seed mean +- std of the step-held eval return on a 4 h wall-clock grid (fully rejected evals are NaN, as in the paper figures).
Finals: summary eval/reward mean +- std over seeds (the paper tables' numbers).
"""
import json, math, os, pickle, sys
import numpy as np

GYM = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'codesign-gym'))
sys.path.insert(0, GYM)
os.chdir(GYM)
import make_figures as mf  # noqa: E402  (imports make_table for METHODS / MAIN / NO_LOKI)

GRID = np.linspace(0, mf.T_END, 81)
g = mf.by(pickle.load(open(mf.CACHE, 'rb')))


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

out = dict(t=[float(f'{x:.3f}') for x in GRID], methods=[dict(id=m, name=n, color=mf.COLOR[m]) for m, n in mf.METHODS], loki_prep_h=mf.LOKI_PREP_H,
           budget_h=mf.T_END, presets=presets)
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'data', 'results.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', os.path.normpath(dst), f'{os.path.getsize(dst) / 1024:.0f} KB', len(presets), 'presets')

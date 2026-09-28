"""ES tuning of one trot gait mode for solar_physics.py: python tune_gait.py fwd|back|left|right [init.json] [gens]"""
import sys, multiprocessing as mp, json, numpy as np
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from solar_physics import *
A1 = along_axis(1.0); G.deform(m, d, seg, A1, kw['max_offset'])
mode = sys.argv[1]; VX, VY = {'fwd': (1.0, 0.0), 'left': (0.0, 1.0), 'right': (0.0, -1.0), 'back': (-1.0, 0.0)}[mode]
def ev(th): return walk_eval(th, VX, VY)
if __name__ == '__main__':
    rng = np.random.default_rng(0); th = np.zeros(12); th[1] = 0.0; th[2] = 0.0; th[5] = 0.0
    if len(sys.argv) > 2 and sys.argv[2]: th = np.array(json.load(open(sys.argv[2]))['th'])
    mo = np.zeros(12); ve = np.zeros(12); best = (-1e9, th); pop, sig, lr = 32, 0.3, 0.08
    with mp.get_context('fork').Pool(10) as pool:
        for g in range(int(sys.argv[3]) if len(sys.argv) > 3 else 60):
            eps = rng.normal(0, 1, (pop // 2, 12)); cand = np.concatenate([th + sig * eps, th - sig * eps]); R = np.array(pool.map(ev, list(cand)))
            rk = np.empty(pop); rk[np.argsort(R)] = np.linspace(-.5, .5, pop); gr = (rk[:pop // 2] - rk[pop // 2:]) @ eps / (pop * sig)
            mo = .9 * mo + .1 * gr; ve = .999 * ve + .001 * gr ** 2; th = th + lr * (mo / (1 - .9 ** (g + 1))) / (np.sqrt(ve / (1 - .999 ** (g + 1))) + 1e-8)
            c = ev(th); best = max(best, (c, th.copy()), key=lambda z: z[0])
            if g % 5 == 4: print(mode, g + 1, 'pop', R.mean().round(2), 'max', R.max().round(2), 'centre', round(c, 2), flush=True)
    json.dump({'th': best[1].tolist(), 'score': best[0]}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gaits', f'gait_{mode}.json'), 'w')); print(mode, 'best', best[0], unpack(best[1]))

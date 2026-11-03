"""Redraw the "Who is ahead, hour by hour" grid from static/data/results.json (the paper figure's rule, extended to new presets).

Usage (from this repo root): python tools/make_leader.py
Rule (reproduces the paper's static/images/paper/leader.jpg cell for cell): for each 15-minute window, the leader is the method
with the highest seed-mean step-held eval return at the window's end; equal values are a tie; a method with no eval yet
(LOKI during its prep) does not compete. Rows: every preset run with all four methods.
Writes static/images/leader.png.
"""
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
D = json.load(open(os.path.join(ROOT, 'static', 'data', 'results.json')))
P = {p['id']: p for p in D['presets']}
GROUPS = [('Native', '#4b90dd', [('BallCatcher-Pitch', 'BallCatcher Pitch'), ('BallCatcher-Arc', 'BallCatcher Arc'), ('BallCatcher-Fielding', 'BallCatcher Fielding'),
                                 ('SolarCleanerReach', 'SolarCleanerReach'), ('RotateInHand-Cube', 'RotateInHand Cube'), ('HandPickUp-Cube', 'HandPickUp Cube'),
                                 ('HandPickUp-Hammer', 'HandPickUp Hammer')]),
          ('Reframed', '#7bd26a', [('RacingSpielberg', 'RacingSpielberg'), ('WarehouseSmall', 'WarehouseSmall'), ('NetworkUrban', 'Network Urban'),
                                   ('MicrogridRandom', 'Microgrid Random'), ('PokenvRandom', 'PokenvRandom')]),
          ('Extended', '#d2697a', [('HalfCheetah-v4', 'HalfCheetah'), ('Hopper-v4', 'Hopper'), ('Walker2d-v4', 'Walker2d'), ('Swimmer-v4', 'Swimmer'),
                                   ('Ant-v4', 'Ant'), ('Humanoid-v4', 'Humanoid'), ('HumanoidStandup-v4', 'HumanoidStandup')])]
METHODS = [('cmaes', 'C', 'CMA-ES', '#20868a'), ('fasttd3', 'F', 'FastTD3', '#b7741d'), ('ppo_ngopt', 'P', 'PPO+NGOpt', '#a94986'), ('loki', 'L', 'LOKI', '#7c60d1')]
TIE = ('=', 'Tie', '#bbbfcb')
NBIN = 16
step = round(0.25 / (D['t'][1] - D['t'][0]))


def leaders(p):
    out = []
    for k in range(NBIN):
        i = step * (k + 1)
        v = {m: x['curve']['mean'][i] for m, x in p['methods'].items() if x['curve'] and x['curve']['mean'][i] is not None}
        top = max(v.values()); w = [m for m in v if v[m] == top]
        out.append(w[0] if len(w) == 1 else None)
    return out


plt.rcParams['font.family'] = 'Liberation Sans'
nrows = sum(len(r) for _, _, r in GROUPS)
cw, ch, gap, bgap, ggap = 1.0, 0.62, 0.06, 0.18, 0.45      # cell w/h, cell gap, hour-block gap, group gap
x0 = 0.0
W = NBIN * (cw + gap) + 3 * bgap
H = nrows * (ch + gap) + (len(GROUPS) - 1) * ggap
fig, ax = plt.subplots(figsize=(13.4, 0.3 * H + 1.6), dpi=200)
ax.set_xlim(-5.6, W + 0.1); ax.set_ylim(H + 1.6, -0.9); ax.axis('off')
color = {m: c for m, _, _, c in METHODS}; letter = {m: l for m, l, _, _ in METHODS}
ax.text(-5.5, -0.35, 'Time into 4 h budget →', fontsize=11, color='#444', va='center')
for h in range(1, 5):
    ax.text(h * 4 * (cw + gap) + (h - 1) * bgap - gap, -0.35, f'{h} h', fontsize=11, color='#444', va='center', ha='right')
y = 0.0
for gname, gcol, rows in GROUPS:
    gy = y
    for pid, label in rows:
        ax.text(-0.15, y + ch / 2, label, fontsize=11.5, ha='right', va='center', color='#222')
        for k, m in enumerate(leaders(P[pid])):
            x = k * (cw + gap) + (k // 4) * bgap
            c, l = (color[m], letter[m]) if m else (TIE[2], TIE[0])
            ax.add_patch(FancyBboxPatch((x, y), cw, ch, boxstyle='round,pad=0,rounding_size=0.08', fc=c, ec='none'))
            ax.text(x + cw / 2, y + ch / 2 + 0.01, l, fontsize=8.5, ha='center', va='center', color='white', fontweight='bold')
        y += ch + gap
    gh = y - gap - gy
    ax.add_patch(FancyBboxPatch((-5.45, gy), 0.75, gh, boxstyle='round,pad=0,rounding_size=0.12', fc=gcol, ec='none'))
    ax.text(-5.075, gy + gh / 2, gname, rotation=90, fontsize=11, ha='center', va='center', color='white', fontweight='bold')
    y += ggap - gap + gap
# legend
items = [(l, n, c) for _, l, n, c in METHODS] + [TIE]
lx = W / 2 - 6.6; ly = H + 0.9
for l, n, c in items:
    ax.add_patch(FancyBboxPatch((lx, ly - 0.3), 0.55, 0.6, boxstyle='round,pad=0,rounding_size=0.08', fc=c, ec='none'))
    ax.text(lx + 0.275, ly, l, fontsize=8.5, ha='center', va='center', color='white', fontweight='bold')
    ax.text(lx + 0.8, ly, n, fontsize=12, va='center', color='#222')
    lx += 0.8 + 0.2 * len(n) + 1.4
dst = os.path.join(ROOT, 'static', 'images', 'leader.png')
fig.savefig(dst, bbox_inches='tight', pad_inches=0.08, facecolor='white')
print('wrote', dst)
for gname, _, rows in GROUPS:
    for pid, label in rows:
        print(f'{label:22}', ''.join(letter[m] if m else '=' for m in leaders(P[pid])))

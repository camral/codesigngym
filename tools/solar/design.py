import re, numpy as np, mujoco
NAME = re.compile(r'_offsettable_([xyz]*)')
def links(m):
    out = []
    for b in range(m.nbody):
        mt = NAME.search(mujoco.mj_id2name(m, 1, b) or '')
        if not mt: continue
        g = [i for i in range(m.ngeom) if m.geom_bodyid[i] == b]
        if not g: continue
        kids = [c for c in range(m.nbody) if m.body_parentid[c] == b and c != b]; sites = [s for s in range(m.nsite) if m.site_bodyid[s] == b]
        out.append(dict(b=b, name=mujoco.mj_id2name(m, 1, b), g0=g[0], geoms=g, end=2 * m.geom_pos[g[0]].copy(), axes=mt.group(1), kids=kids, kpos=[m.body_pos[c].copy() for c in kids], sites=sites, spos=[m.site_pos[s].copy() for s in sites]))
        m.geom_sameframe[g[0]] = 0
    return out
def set_end(m, l, e):
    e0 = l['end']; g = l['g0']; m.geom_pos[g] = e / 2; m.geom_size[g][1] = np.linalg.norm(e) / 2
    q = np.zeros(4); mujoco.mju_quatZ2Vec(q, e / np.linalg.norm(e)); m.geom_quat[g] = q
    for c, p in zip(l['kids'], l['kpos']): m.body_pos[c] = p + (e - e0)
    for s, p in zip(l['sites'], l['spos']): m.site_pos[s] = p + (e - e0)
def lengthen_arm(m, L, amt):
    for l in L:
        if 'arm' in l['name'] or l['name'].startswith('link'):
            e0 = l['end']; set_end(m, l, e0 + amt * np.sign(np.round(e0, 3)))

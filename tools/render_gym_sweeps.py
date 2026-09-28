"""Design-sweep clips for the 7 Gym ports: designable ('offsettable') links in blue, fixed parts grey, far ends stretched over time.

Usage: python tools/render_gym_sweeps.py [path/to/codesign-gym]   -> static/video/showcase/<id>_design.mp4 + .jpg
An illustration of the design space (plain MuJoCo, rest pose, no policy); it mirrors the env's far-end stretch in body-frame axes.
"""
import os, re, subprocess, sys
import mujoco, numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GYM = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'codesign-gym'))
ENVS = {'halfcheetah': 'half_cheetah', 'hopper': 'hopper', 'walker2d': 'walker2d', 'swimmer': 'swimmer', 'ant': 'ant', 'humanoid': 'humanoid', 'humanoidstandup': 'humanoid_standup'}
NAME = re.compile(r'_offsettable_([xyz]*)')
BLUE, GREY, W, H, F = [0.15, 0.39, 0.92, 1], [0.62, 0.66, 0.72, 1], 640, 480, 240


def links(m):
    out = []
    for b in range(m.nbody):
        mt = NAME.search(mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_BODY, b) or '')
        if not mt: continue
        g = [i for i in range(m.ngeom) if m.geom_bodyid[i] == b]
        if not g: continue
        g0 = g[0]; end = 2 * m.geom_pos[g0].copy()
        kids = [c for c in range(m.nbody) if m.body_parentid[c] == b and c != b]
        sites = [s for s in range(m.nsite) if m.site_bodyid[s] == b]
        out.append(dict(b=b, g0=g0, geoms=g, end=end, axes=mt.group(1) or 'l', kids=kids, kpos=[m.body_pos[c].copy() for c in kids], sites=sites, spos=[m.site_pos[s].copy() for s in sites]))
    return out


def apply(m, L, phase):
    for i, l in enumerate(L):
        e0, ln = l['end'], np.linalg.norm(l['end']) or 1e-6
        d = np.zeros(3)
        for k, ax in enumerate(l['axes']):
            a = 0.38 * ln * np.sin(phase + 1.7 * i + 2.3 * k)
            d += a * (e0 / ln if ax == 'l' else np.eye(3)['xyz'.index(ax)])
        e = e0 + d
        if np.linalg.norm(e) < 0.35 * ln: e = e0 * 0.35
        g = l['g0']; m.geom_pos[g] = e / 2; m.geom_size[g][1] = np.linalg.norm(e) / 2
        z = e / np.linalg.norm(e); q = np.zeros(4); mujoco.mju_quatZ2Vec(q, z); m.geom_quat[g] = q
        for c, p in zip(l['kids'], l['kpos']): m.body_pos[c] = p + (e - e0)
        for s, p in zip(l['sites'], l['spos']): m.site_pos[s] = p + (e - e0)


def lowest(m, d):
    z = np.inf
    for g in range(m.ngeom):
        if m.geom_bodyid[g] == 0: continue
        t, s, p, R = m.geom_type[g], m.geom_size[g], d.geom_xpos[g], d.geom_xmat[g].reshape(3, 3)
        if t in (mujoco.mjtGeom.mjGEOM_CAPSULE, mujoco.mjtGeom.mjGEOM_CYLINDER): z = min(z, p[2] - abs(R[2, 2]) * s[1] - s[0])
        elif t == mujoco.mjtGeom.mjGEOM_SPHERE: z = min(z, p[2] - s[0])
        else: z = min(z, p[2] - d.geom_rbound[g] if hasattr(d, 'geom_rbound') else p[2] - m.geom_rbound[g])
    return z


for vid, pkg in ENVS.items():
    xml = os.path.join(GYM, 'src', 'envs', pkg, 'assets', {'humanoid_standup': 'humanoidstandup.xml'}.get(pkg, f'{pkg}.xml'))
    m = mujoco.MjModel.from_xml_path(xml); m.vis.global_.offwidth, m.vis.global_.offheight = 1600, 1200
    L = links(m); ids = {g for l in L for g in l['geoms']}
    for l in L: m.geom_sameframe[l['g0']] = 0   # compiled capsules share the inertial frame, which would ignore geom_pos/quat edits
    for g in range(m.ngeom):
        if m.geom_bodyid[g] != 0: m.geom_rgba[g] = BLUE if g in ids else GREY; m.geom_matid[g] = -1
        else: m.geom_rgba[g] = [0.93, 0.95, 0.98, 1]; m.geom_matid[g] = -1   # plain light floor, no checker
    m.vis.rgba.haze[:] = [0.97, 0.98, 1, 1]; m.vis.headlight.ambient[:] = [0.45, 0.45, 0.48]; m.vis.headlight.diffuse[:] = [0.6, 0.6, 0.62]
    d = mujoco.MjData(m); r = mujoco.Renderer(m, H, W)
    zj = next((j for j in range(m.njnt) if m.jnt_type[j] == mujoco.mjtJoint.mjJNT_FREE), None)
    zq = m.jnt_qposadr[zj] + 2 if zj is not None else next((m.jnt_qposadr[j] for j in range(m.njnt) if (mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_JOINT, j) or '') == 'rootz'), None)
    dst = os.path.join(ROOT, 'static', 'video', 'showcase', f'{vid}_design.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    mujoco.mj_forward(m, d); SPAN = np.ptp(d.xpos[1:], axis=0).max() + 0.4
    for f in range(F):
        apply(m, L, 2 * np.pi * f / F)
        mujoco.mj_resetData(m, d)
        if zq is not None and pkg != 'swimmer':
            mujoco.mj_forward(m, d); d.qpos[zq] += 0.002 - lowest(m, d)
        mujoco.mj_forward(m, d)
        cam = mujoco.MjvCamera(); cam.lookat[:] = d.subtree_com[1]; cam.distance = {'swimmer': 3.4, 'humanoid': 1.45, 'humanoidstandup': 1.35, 'hopper': 1.6, 'walker2d': 1.6, 'ant': 2.3, 'halfcheetah': 1.6}.get(vid, 2.0) * SPAN; cam.azimuth = 120 + 25 * np.sin(2 * np.pi * f / F); cam.elevation = -30
        if pkg == 'swimmer': cam.elevation = -55
        r.update_scene(d, cam); p.stdin.write(r.render().tobytes())
    p.stdin.close(); p.wait(); r.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '2', '-i', dst, '-frames:v', '1', '-q:v', '3', dst.replace('.mp4', '.jpg')], check=True)
    print(vid, len(L), 'designable links', f'{os.path.getsize(dst) // 1024} KB')

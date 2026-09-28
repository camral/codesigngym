"""Shared plumbing for the Gym-port clips: load a port's own XML + config, deform it with a design vector exactly as the env's reset
kernel does (a NumPy twin of offsettable_logic.deform: far end moved in body-frame axes, folded-back end clamped, half-length floored,
mass/inertia rebuilt at the link's density, children and sites riding the far end), colour each co-designed slot, lift the spawn height.
"""
import dataclasses, importlib, os, sys
import mujoco, numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GYM = os.path.abspath(os.environ.get('CODESIGN_GYM', os.path.join(ROOT, '..', 'codesign-gym')))
sys.path.insert(0, os.path.join(GYM, 'src'))
os.environ.setdefault('WARP_LOG_LEVEL', 'error')
ENVS = {'halfcheetah': 'half_cheetah', 'hopper': 'hopper', 'walker2d': 'walker2d', 'swimmer': 'swimmer', 'ant': 'ant', 'humanoid': 'humanoid', 'humanoidstandup': 'humanoid_standup'}
GOAL = {'halfcheetah': 'run forward as fast as possible', 'hopper': 'hop forward without falling', 'walker2d': 'walk forward without falling', 'swimmer': 'swim forward through the fluid',
        'ant': 'walk forward as fast as possible', 'humanoid': 'run forward without falling', 'humanoidstandup': 'stand up from the floor'}
PAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#7c3aed', '#e34948', '#0ea5e9', '#a16207', '#65a30d', '#008300', '#4a3aa7']
RGBA = [[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1] for h in PAL]


def config(vid):
    mod = importlib.import_module(f'envs.{ENVS[vid]}.config')
    cls = next(v for v in vars(mod).values() if dataclasses.is_dataclass(v) and isinstance(v, type) and 'max_offset' in {f.name for f in dataclasses.fields(v)})
    return cls()


def deform(m, d, s, a, mo):
    """NumPy twin of offsettable_logic.apply_offsets + deform on a CPU model, then the env's constant refresh."""
    for i in range(len(s['body'])):
        delta = np.zeros(3)
        for j in range(int(s['axis_adr'][i]), int(s['axis_adr'][i]) + int(s['axis_num'][i])):
            delta += s['axis_dir'][j] * (np.clip(a[int(s['axis_act'][j])], s['axis_lo'][j], s['axis_hi'][j]) * mo)
        g, b, r, aim = int(s['geom'][i]), int(s['body'][i]), float(s['radius'][i]), s['dir'][i]
        tip = s['tip0'][i] + delta; along = tip @ aim; tip = tip + aim * (max(along, 0.0) - along); ln = np.linalg.norm(tip)
        u = tip / ln if ln > 1e-9 else aim; half = max(0.5 * ln, float(s['min_half'][i]))
        q = np.zeros(4); mujoco.mju_quatZ2Vec(q, u)
        m.geom_pos[g], m.geom_quat[g], m.geom_size[g] = u * half, q, (r, half, 0)
        m.geom_rbound[g] = np.hypot(r, half) if s['is_cyl'][i] else half + r
        L, rho = 2 * half, float(s['density'][i]); mc = rho * np.pi * r * r * L; tr = mc * (3 * r * r + L * L) / 12
        if s['is_cyl'][i]: mass, ax = mc, 0.5 * mc * r * r
        else: mcap = rho * 2 / 3 * np.pi * r ** 3; tr += 2 * mcap * (0.4 * r * r + L * L / 4 + 0.375 * r * L); mass, ax = mc + 2 * mcap, 0.5 * mc * r * r + 0.8 * mcap * r * r
        m.body_mass[b], m.body_inertia[b], m.body_ipos[b], m.body_iquat[b] = mass, (tr, tr, ax), u * half, q
        moved = u * 2 * half - s['tip0'][i]
        for k in range(int(s['child_adr'][i]), int(s['child_adr'][i]) + int(s['child_num'][i])): m.body_pos[int(s['child_id'][k])] = s['child_pos'][k] + moved
        for k in range(int(s['site_adr'][i]), int(s['site_adr'][i]) + int(s['site_num'][i])): m.site_pos[int(s['site_id'][k])] = s['site_pos'][k] + moved
    ext, ctr = m.stat.extent, m.stat.center.copy()
    mujoco.mj_setConst(m, d)   # the env's _refresh_constants; it also recompiles geom_sameframe and the visual extent (near clip), so undo those
    m.stat.extent, m.stat.center[:] = ext, ctr
    m.geom_sameframe[s['geom']] = mujoco.mjtSameFrame.mjSAMEFRAME_NONE


class Port:
    def __init__(self, vid):
        self.vid, self.cfg = vid, config(vid)
        OL = importlib.import_module(f'envs.{ENVS[vid]}.offsettable_logic')
        self.m = m = mujoco.MjModel.from_xml_path(os.path.join(GYM, 'src', 'envs', ENVS[vid], 'assets', self.cfg.xml))
        self.seg = s = OL.find_segments(m, float(getattr(self.cfg, 'min_link_length', 0.0)))
        OL.release_geom_frames(m, s)
        self.n = OL.n_slots(s); self.lo, self.hi = OL.slot_bounds(s, self.n)
        m.vis.global_.offwidth, m.vis.global_.offheight = 1920, 1200
        # one colour per action slot group: an _equ group shares its slots (and colour), every other link gets its own
        first = {}
        for i in range(len(s['body'])):
            a = int(s['axis_act'][int(s['axis_adr'][i])]); first.setdefault(a, len(first))
            g = int(s['geom'][i]); m.geom_rgba[g] = RGBA[first[a] % len(RGBA)]; m.geom_matid[g] = -1
        self.groups = len(first)
        self.d = mujoco.MjData(m)
        self.zadr = OL.root_z_qadr(m); self.floor = OL.floor_contact_geoms(m)[0]
        self.qpos0 = m.qpos0.copy(); self.design(np.zeros(self.n)); self.z_target = self.lowest()

    def design(self, a):
        """Deform every link by the normalised design ``a`` (slots in [-1, 1], clipped to each link's pos/neg range)."""
        deform(self.m, self.d, self.seg, a, float(self.cfg.max_offset))

    def lowest(self):
        """Lowest point of the floor-touching geoms at qpos0 (host twin of offsettable_logic.geom_bottom)."""
        m, d = self.m, self.d; d.qpos[:] = self.qpos0; d.qvel[:] = 0; mujoco.mj_kinematics(m, d); z = np.inf
        for g in self.floor:
            t, s, p, a = int(m.geom_type[g]), m.geom_size[g], d.geom_xpos[g], d.geom_xmat[g].reshape(3, 3)[2]
            if t == 2: b = p[2] - s[0]
            elif t == 3: b = p[2] - abs(a[2]) * s[1] - s[0]
            elif t == 4: b = p[2] - np.sqrt(((a * s) ** 2).sum())
            elif t == 5: b = p[2] - abs(a[2]) * s[1] - s[0] * np.sqrt(max(0.0, 1 - a[2] ** 2))
            elif t == 6: b = p[2] - np.abs(a) @ s
            else: b = p[2] - m.geom_rbound[g]
            z = min(z, b)
        return z

    def reset(self, rng=None, noise=0.0):
        """qpos0 lifted so the lowest geom sits where the base design's does (the env's SpawnLift), plus v4-style uniform noise."""
        d = self.d; mujoco.mj_resetData(self.m, d)
        if self.zadr >= 0 and len(self.floor): d.qpos[self.zadr] += self.z_target - self.lowest()
        else: d.qpos[:] = self.qpos0
        if rng is not None and noise: d.qpos[:] += rng.uniform(-noise, noise, self.m.nq); d.qvel[:] = rng.uniform(-noise, noise, self.m.nv)
        mujoco.mj_forward(self.m, d)

"""Physical Solar Cleaner demo in plain MuJoCo on the real SolarCleaner-Reach model (the env's own spec builder), for the project page.

The body is co-designed: every arm link lengthened 0.15 m along its own axis through the env-exact deform (gym_look.deform, mass rebuilt).
Everything moves under physics through the env's own actuators, which are velocity servos (force = kv * (ctrl - qdot)):
- legs: trot gaits (forward / back / left / right) tuned by a quick ES (tune_gait.py -> gaits/*.json), with pitch/roll/yaw feedback;
- arm: a collision-aware IK plan per panel (roller flat on the face, clear of the panel mounts), tracked by an outer position loop with
  gravity feedforward, and an admittance loop that holds ~20 N of roller force;
- a cell counts as cleaned by the env's rule: roller centre inside the cell footprint, a roller radius off the face (+- goal_surface_tol),
  in the env's traversal order.
Not a policy: a scripted controller, for illustration.
"""
import sys, os, numpy as np, mujoco
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
from scene import build
import gym_look as G
from envs.panel_cleaner import offsettable_logic as OL
m, grid, kw = build('REACH'); d = mujoco.MjData(m)
seg = OL.find_segments(m, kw['min_link_length']); OL.release_geom_frames(m, seg); n = OL.n_slots(seg)
names = [mujoco.mj_id2name(m, 1, int(b)) for b in seg['body']]
arm_slots = sorted({int(seg['axis_act'][j]) for i, nm in enumerate(names) if 'arm' in nm or nm.startswith('link') for j in range(int(seg['axis_adr'][i]), int(seg['axis_adr'][i]) + int(seg['axis_num'][i]))})
A = np.zeros(n); A[arm_slots] = 1.0
G.deform(m, d, seg, A, kw['max_offset'])
keys = [mujoco.mj_id2name(m, 8, i) for i in range(m.nkey)]
q0 = m.qpos0.copy()
for i in range(m.nkey): q0 = q0 + (m.key_qpos[i] - m.qpos0)   # the env's _reset_pose: keyframe deviations compose
q0[0] -= kw['spawn_offset']
jq = lambda nm: m.jnt_qposadr[mujoco.mj_name2id(m, 3, nm)]
jd = lambda nm: m.jnt_dofadr[mujoco.mj_name2id(m, 3, nm)]
act_j = [int(m.actuator_trnid[a, 0]) for a in range(m.nu)]
act_q = np.array([m.jnt_qposadr[j] for j in act_j]); act_d = np.array([m.jnt_dofadr[j] for j in act_j])
act_names = [mujoco.mj_id2name(m, 3, j) for j in act_j]
kp = m.actuator_gainprm[:, 0].copy()
def along_axis(scale=1.0, which=None):
    """Design with each arm link lengthened along its own dominant axis only."""
    a = np.zeros(n)
    for i, nm in enumerate(names):
        if not ('arm' in nm or nm.startswith('link')) or (which and nm.split('_')[0] not in which): continue
        adr = int(seg['axis_adr'][i]); t = np.abs(seg['tip0'][i]); a[int(seg['axis_act'][adr + int(np.argmax(t))])] = scale
    return a
def stand(A, T=600):
    G.deform(m, d, seg, A, kw['max_offset']); mujoco.mj_resetData(m, d); d.qpos[:] = q0; mujoco.mj_forward(m, d)
    for t in range(T):
        d.ctrl[:] = q0[act_q] + d.qfrc_bias[act_d] / kp; mujoco.mj_step(m, d)
    return d.qpos[2], np.abs(d.qpos[act_q] - q0[act_q]).max(), m.body_mass.sum()
kv = m.actuator_gainprm[:, 0].copy(); vmax = m.actuator_ctrlrange[:, 1].copy()
def servo(tgt_q, K=12.0, ff=True):
    """Velocity actuators (force = kv*(ctrl - qdot)): an outer position loop picks the commanded joint velocity; + gravity feedforward on the arm."""
    c = K * (tgt_q - d.qpos[act_q])
    if ff: c[12:] += d.qfrc_bias[act_d[12:]] / kv[12:]
    d.ctrl[:] = np.clip(c, -vmax, vmax)
LEGS = ('fl', 'fr', 'bl', 'br'); PH = {'fl': 0.0, 'br': 0.0, 'fr': np.pi, 'bl': np.pi}
STANCE = dict(hip=0.7, knee=-1.35)
def gait_targets(t, p, vx=1.0, vy=0.0, wz=0.0, arm=None):
    """Trot: diagonal pairs half a cycle apart; hip swings fore-aft (stride ~ vx), knee lifts in swing, hip2 steps sideways (~ vy); wz skews the stride left/right."""
    tgt = q0.copy()
    for L in LEGS:
        ph = 2 * np.pi * p['f'] * t + PH[L]; side = 1 if L[1] == 'l' else -1
        stride = p['Ah'] * (vx - side * wz)
        tgt[jq(L + '_hip')] = STANCE['hip'] + p['h0'] + stride * np.sin(ph)
        tgt[jq(L + '_knee')] = STANCE['knee'] - p['Ak'] * max(0.0, np.sin(ph + p['pk']))
        tgt[jq(L + '_hip2')] = p['Ay'] * vy * np.sin(ph)
    if arm is not None: tgt[act_q[12:]] = arm
    return tgt[act_q]
def settle(A=None, T=300):
    if A is not None: G.deform(m, d, seg, A, kw['max_offset'])
    tgt = q0.copy()
    for L in LEGS: tgt[jq(L + '_hip')] = STANCE['hip']; tgt[jq(L + '_knee')] = STANCE['knee']
    mujoco.mj_resetData(m, d); d.qpos[:] = tgt; mujoco.mj_forward(m, d)
    for _ in range(T): servo(tgt[act_q]); mujoco.mj_step(m, d)
def yaw(): w, x, y, z = d.qpos[3:7]; return np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
def euler():
    w, x, y, z = d.qpos[3:7]
    return np.arctan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)), np.arcsin(np.clip(2 * (w * y - z * x), -1, 1)), np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
def unpack(th):
    s = lambda v, lo, hi: lo + (hi - lo) / (1 + np.exp(-v))
    return dict(f=s(th[0], 0.8, 3.0), Ah=s(th[1], 0.0, 0.6), Ak=s(th[2], 0.0, 1.0), pk=th[3] * 3, h0=0.4 * np.tanh(th[4]), Ay=s(th[5], 0.0, 0.6),
                kp=th[6], kr=th[7], ky=th[8], kf=0.4 * np.tanh(th[9]), kb=0.4 * np.tanh(th[10]), hy=0.3 * np.tanh(th[11]))
def gait2(t, p, vx, vy, yaw_err, arm=None):
    roll, pitch, _ = euler(); wz = np.clip(p['ky'] * yaw_err, -1, 1)
    tgt = q0.copy()
    for L in LEGS:
        ph = 2 * np.pi * p['f'] * t + PH[L]; side = 1 if L[1] == 'l' else -1; front = L[0] == 'f'
        stride = p['Ah'] * (vx - side * wz)
        tgt[jq(L + '_hip')] = STANCE['hip'] + p['h0'] + stride * np.sin(ph) + p['kp'] * pitch * 0.3
        tgt[jq(L + '_knee')] = STANCE['knee'] + (p['kf'] if front else p['kb']) - p['Ak'] * max(0.0, np.sin(ph + p['pk']))
        tgt[jq(L + '_hip2')] = side * p['hy'] + p['Ay'] * vy * np.sin(ph) + p['kr'] * roll * 0.3
    if arm is not None: tgt[act_q[12:]] = arm
    return tgt[act_q]
def walk_eval(th, vx, vy, T=5.0, seed=0):
    p = unpack(th); settle(); x0, y0 = d.qpos[0], d.qpos[1]; t0 = d.time; dirn = np.array([vx, vy]) / np.hypot(vx, vy)
    for k in range(int(T / m.opt.timestep)):
        if k % 8 == 0: c = gait2(d.time - t0, p, vx, vy, -euler()[2])
        servo(c); mujoco.mj_step(m, d)
        if d.qpos[2] < 0.35 or not np.isfinite(d.qpos).all(): return -10 + (k / (T / m.opt.timestep)) * 5
    disp = np.array([d.qpos[0] - x0, d.qpos[1] - y0]); along = disp @ dirn; perp = abs(disp @ np.array([-dirn[1], dirn[0]]))
    r, pt, yw = euler()
    return min(along, 0.6 * T) - 1.5 * perp - 2 * abs(yw) - 2 * (abs(r) + abs(pt))
rg = mujoco.mj_name2id(m, 5, 'roller_geom'); R_ROLL = float(kw['roller_radius'])
TQ = np.array(grid.tilt_quat); TM = np.zeros(9); mujoco.mju_quat2Mat(TM, TQ); TM = TM.reshape(3, 3); NORMAL = TM[:, 2]
GOALS = [g for g in grid.goals(kw['panel_traversal']) if not g.is_midpoint]
def on_cell(g, p=None):
    """The env's cell test: roller centre inside the cell footprint in the tilted panel frame, a roller radius off the face (+- goal_surface_tol)."""
    p = d.geom_xpos[rg] if p is None else p; loc = TM.T @ (p - np.array(g.pos))
    return abs(loc[0]) <= grid.half[0] and abs(loc[1]) <= grid.half[1] and abs(loc[2] - R_ROLL) <= kw['goal_surface_tol']
dk = mujoco.MjData(m); ARM_LO, ARM_HI = m.jnt_range[act_j[12:], 0] + 0.05, m.jnt_range[act_j[12:], 1] - 0.05
def arm_ik(target, q_arm, iters=30):
    """IK for the arm joints on a kinematic copy of the live state (base where it actually is)."""
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q_arm
    for _ in range(iters):
        mujoco.mj_kinematics(m, dk); mujoco.mj_comPos(m, dk); err = target - dk.geom_xpos[rg]
        if np.linalg.norm(err) < 0.002: break
        J = np.zeros((3, m.nv)); mujoco.mj_jacGeom(m, dk, J, None, rg); Ja = J[:, act_d[12:]]
        dk.qpos[act_q[12:]] = np.clip(dk.qpos[act_q[12:]] + 0.6 * (Ja.T @ np.linalg.solve(Ja @ Ja.T + 2e-3 * np.eye(3), err)), ARM_LO, ARM_HI)
    return dk.qpos[act_q[12:]].copy()
def ik_err(target, q):
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q; mujoco.mj_kinematics(m, dk); return np.linalg.norm(target - dk.geom_xpos[rg])
def arm_ik_best(target, q_now, n_seeds=24, rng=np.random.default_rng(0)):
    seeds = [q_now] + [rng.uniform(ARM_LO, ARM_HI) for _ in range(n_seeds)]
    sols = [arm_ik(target, s, 150) for s in seeds]; errs = [ik_err(target, q) for q in sols]
    # among near-exact solutions prefer the one closest to the current pose
    ok = [i for i, e in enumerate(errs) if e < 0.01] or [int(np.argmin(errs))]
    return sols[min(ok, key=lambda i: np.linalg.norm(sols[i] - q_now))]
def stand_q():
    s = q0.copy()
    for L in LEGS: s[jq(L + '_hip')] = STANCE['hip']; s[jq(L + '_knee')] = STANCE['knee']
    return s[act_q]
def sweep_test(bx, press, dwell=0.6, key=(0, 1), Karm=12.0):
    settle(along_axis(1.0)); d.qpos[0] = bx; d.qpos[1] = grid.panel_pos[key][1]; mujoco.mj_forward(m, d); st = stand_q()
    for _ in range(200): servo(st); mujoco.mj_step(m, d)
    cells = [g for g in GOALS if g.key == key]
    qa = arm_ik_best(np.array(cells[0].pos) + NORMAL * R_ROLL, d.qpos[act_q[12:]].copy()); hit = 0
    for g in cells:
        tgt = np.array(g.pos) + NORMAL * (R_ROLL - press); got = False
        for k in range(int(dwell / m.opt.timestep)):
            if k % 8 == 0: qa = arm_ik(tgt, qa); c = st.copy(); c[12:] = qa
            cc = Karm * (c - d.qpos[act_q]); cc[:12] = 12.0 * (c[:12] - d.qpos[act_q[:12]]); cc[12:] += d.qfrc_bias[act_d[12:]] / kv[12:]
            d.ctrl[:] = np.clip(cc, -vmax, vmax); mujoco.mj_step(m, d)
            if on_cell(g): got = True
        hit += got
    return hit, len(cells), np.round(d.qpos[:3], 2), np.round(euler(), 2)
PX, PY_ = TM[:, 0], TM[:, 1]
W_HEAD = [1.0]
def arm_ik5(target, q_arm, iters=30, w_o=0.5):
    """Position + orientation IK: roller centre on target, roller axis flat on the face and across the sweep (along the panel's x)."""
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q_arm
    for _ in range(iters):
        mujoco.mj_kinematics(m, dk); mujoco.mj_comPos(m, dk)
        a = dk.geom_xmat[rg].reshape(3, 3)[:, 2]
        e = np.r_[target - dk.geom_xpos[rg], -w_o * (a @ NORMAL), -W_HEAD[0] * w_o * (a @ PY_)]
        if np.linalg.norm(e) < 0.002: break
        Jp = np.zeros((3, m.nv)); Jr = np.zeros((3, m.nv)); mujoco.mj_jacGeom(m, dk, Jp, Jr, rg)
        J = np.vstack([Jp[:, act_d[12:]], w_o * np.cross(a, NORMAL) @ Jr[:, act_d[12:]], W_HEAD[0] * w_o * np.cross(a, PY_) @ Jr[:, act_d[12:]]])
        dk.qpos[act_q[12:]] = np.clip(dk.qpos[act_q[12:]] + 0.6 * (J.T @ np.linalg.solve(J @ J.T + 2e-3 * np.eye(5), e)), ARM_LO, ARM_HI)
    return dk.qpos[act_q[12:]].copy()
def ik5_err(target, q):
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q; mujoco.mj_kinematics(m, dk); a = dk.geom_xmat[rg].reshape(3, 3)[:, 2]
    return np.linalg.norm(target - dk.geom_xpos[rg]), abs(a @ NORMAL), W_HEAD[0] * abs(a @ PY_)
def ik5_best(target, q_now, n_seeds=40, rng=np.random.default_rng(1)):
    seeds = [q_now] + [rng.uniform(ARM_LO, ARM_HI) for _ in range(n_seeds)]
    sols = [arm_ik5(target, s, 200) for s in seeds]; errs = [sum(ik5_err(target, q)) for q in sols]
    ok = [i for i, e in enumerate(errs) if e < 0.01] or [int(np.argmin(errs))]
    return sols[min(ok, key=lambda i: np.linalg.norm(sols[i] - q_now))]
MID = 0.5 * (ARM_LO + ARM_HI); SPAN_J = ARM_HI - ARM_LO
def arm_ik5n(target, q_arm, iters=20, w_o=0.5, k_null=0.05):
    """arm_ik5 plus a null-space pull toward mid-range, so a continued solution stays clear of the joint limits."""
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q_arm
    for _ in range(iters):
        mujoco.mj_kinematics(m, dk); mujoco.mj_comPos(m, dk)
        a = dk.geom_xmat[rg].reshape(3, 3)[:, 2]; q = dk.qpos[act_q[12:]]
        e = np.r_[target - dk.geom_xpos[rg], -w_o * (a @ NORMAL), -W_HEAD[0] * w_o * (a @ PY_)]
        Jp = np.zeros((3, m.nv)); Jr = np.zeros((3, m.nv)); mujoco.mj_jacGeom(m, dk, Jp, Jr, rg)
        J = np.vstack([Jp[:, act_d[12:]], w_o * np.cross(a, NORMAL) @ Jr[:, act_d[12:]], W_HEAD[0] * w_o * np.cross(a, PY_) @ Jr[:, act_d[12:]]])
        Jp_inv = J.T @ np.linalg.inv(J @ J.T + 2e-3 * np.eye(5))
        dq = 0.6 * Jp_inv @ e + (np.eye(6) - Jp_inv @ J) @ (k_null * (MID - q) / (0.25 * SPAN_J ** 2) * SPAN_J)
        dk.qpos[act_q[12:]] = np.clip(q + dq, ARM_LO, ARM_HI)
    return dk.qpos[act_q[12:]].copy()
APPROACH = 0.15
def panel_path(key, step=0.02, lift=0.06):
    """The panel's cells in the env's order as one continuous roller path (centre a roller radius off the face); a row change lifts off."""
    cells = [g for g in GOALS if g.key == key]; pts, owner = [], []
    for i, g in enumerate(cells):
        p = np.array(g.pos) + NORMAL * R_ROLL
        if not pts:
            # approach the first cell from above the plate, so the arm arrives over the face rather than under its edge
            top = p + NORMAL * APPROACH; n_ = int(APPROACH / step)
            for k in range(n_ + 1): pts.append(top + (p - top) * k / n_); owner.append(i)
            continue
        a = pts[-1]; row_change = abs(TM[:, 0] @ (p - a)) > 0.05
        mids = [a + NORMAL * lift, p + NORMAL * lift] if row_change else []
        for s, e in zip([a] + mids, mids + [p]):
            n_ = max(1, int(np.linalg.norm(e - s) / step))
            for k in range(1, n_ + 1): pts.append(s + (e - s) * k / n_); owner.append(i)
    return np.array(pts), owner, cells
def plan_panel(key):
    pts, owner, cells = panel_path(key); q = ik5_best(pts[0], d.qpos[act_q[12:]].copy(), 40); Q = [q]
    for p in pts[1:]: q = arm_ik5n(p, q); Q.append(q)
    E = np.array([ik5_err(p, q) for p, q in zip(pts, Q)]); jumps = np.abs(np.diff(np.array(Q), axis=0)).max(1)
    return pts, owner, cells, np.array(Q), E, jumps
def roller_force():
    f = np.zeros(6); fz = 0.0
    for j in range(d.ncon):
        cn = d.contact[j]
        if rg in (cn.geom1, cn.geom2): mujoco.mj_contactForce(m, d, j, f); fz += f[0]
    return fz
QMAX = 1.5
F_DES = 20.0
def run_panel(key, press=0.005, dt_pt=0.04, Karm=12.0, frame=None, cleaned=None, st=None):
    """Physically execute one panel: plan on the live state, then track it with the velocity servos, closing the loop with a short IK refine."""
    pts, owner, cells, Q, E, J, _ = plan_panel_c(key); st = stand_q() if st is None else st; cleaned = set() if cleaned is None else cleaned
    goal_i = 0; ctrl_every = kw['phys_substeps']; n_sub = int(round(dt_pt / m.opt.timestep))
    # ease the arm in from wherever it is to the plan's first pose (off the panel, lifted)
    q_start = Q[0]; q_from = d.qpos[act_q[12:]].copy(); T_in = max(1.0, 1.5 * np.abs(q_start - q_from).max() / QMAX)
    for k in range(int((T_in + 0.3) / m.opt.timestep)):
        if k % ctrl_every == 0: u = min(1.0, k * m.opt.timestep / T_in); u = u * u * (3 - 2 * u); c = st.copy(); c[12:] = q_from + (q_start - q_from) * u
        servo(c, K=Karm); mujoco.mj_step(m, d)
        if frame: frame()
    QD = [0.0] + list(np.abs(np.diff(Q, axis=0)).max(1))
    depth = 0.0
    for i, (p, q) in enumerate(zip(pts, Q)):
        lifted = (p - np.array(cells[owner[i]].pos)) @ NORMAL > R_ROLL + 0.01   # a row change's lift-off: no pressing in the air
        tgt = p - NORMAL * (0.0 if lifted else depth)
        # retime: no arm joint faster than QMAX (the servos top out at 3 rad/s)
        for k in range(max(n_sub, int(np.ceil(QD[i] / QMAX / m.opt.timestep)))):
            if k % ctrl_every == 0:
                # admittance on the face normal: press deeper while the roller carries less than F_DES, back off when it carries more
                if not lifted: depth = float(np.clip(depth + 2e-4 * (F_DES - roller_force()), -0.01, 0.04)); tgt = p - NORMAL * depth
                qa = arm_ik5c(tgt, q, iters=3); c = st.copy(); c[12:] = qa
            servo(c, K=Karm); mujoco.mj_step(m, d)
            # the env's rule: only the current goal can be cleaned, and the sweep then moves on to the next one
            while goal_i < len(cells) and on_cell(cells[goal_i]): cleaned.add(cells[goal_i].geom); goal_i += 1
            if frame: frame()
    return cleaned, goal_i, len(cells)
m.vis.global_.offwidth, m.vis.global_.offheight = 1920, 1200
def sheet(path, times, runner, W=480, H=300, az=20, el=-26, dist=4.6):
    r = mujoco.Renderer(m, H, W); cam = mujoco.MjvCamera(); shots = []; want = list(times)
    def frame():
        if want and d.time >= want[0]:
            want.pop(0); cam.lookat[:] = [0.5 * (d.qpos[0] + 2.4), 0.6 * d.qpos[1], 1.0]; cam.distance, cam.azimuth, cam.elevation = dist, az, el
            r.update_scene(d, cam); shots.append((round(d.time, 1), r.render().copy()))
    out = runner(frame)
    from PIL import Image, ImageDraw
    cols = 4; rows = (len(shots) + cols - 1) // cols; S = Image.new('RGB', (cols * W, rows * H))
    for i, (t, im) in enumerate(shots):
        I = Image.fromarray(im); ImageDraw.Draw(I).text((8, 8), f't={t}', fill='white'); S.paste(I, ((i % cols) * W, (i // cols) * H))
    S.save(path); return out
PANEL_G = {g for g in range(m.ngeom) if (mujoco.mj_id2name(m, 5, g) or '').startswith('panel_') and (m.geom_contype[g] or m.geom_conaffinity[g])}
PLATE_G = {g for g in PANEL_G if mujoco.mj_id2name(m, 5, g).endswith('_plate')}
ROBOT_B = set(range(1, m.nbody)) - {m.geom_bodyid[g] for g in PANEL_G}
def bad_contact(q, margin=0.02):
    """Would the arm at q touch the array anywhere but roller-on-plate? (kinematic copy; distance-based, so it also catches near misses)"""
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q; mujoco.mj_kinematics(m, dk); worst = np.inf
    for g, p in PAIRS:
        worst = min(worst, mujoco.mj_geomDistance(m, dk, g, p, margin, None))
    return worst < margin, worst
ARM_G = [g for g in range(m.ngeom) if any(k in (mujoco.mj_id2name(m, 1, m.geom_bodyid[g]) or '') for k in ('link', 'torso_arm', 'roller'))]
PAIRS = [(g, p) for g in ARM_G for p in PANEL_G if not (g == rg and p in PLATE_G) and ((m.geom_contype[g] & m.geom_conaffinity[p]) or (m.geom_contype[p] & m.geom_conaffinity[g]))]
def arm_ik5c(target, q_arm, iters=20, w_o=0.5, k_null=0.05, margin=0.04, w_c=1.0):
    """arm_ik5n plus collision rows: every arm/array pair nearer than ``margin`` is pushed apart along its separation direction."""
    dk.qpos[:] = d.qpos; dk.qpos[act_q[12:]] = q_arm; ft = np.zeros(6)
    for _ in range(iters):
        mujoco.mj_kinematics(m, dk); mujoco.mj_comPos(m, dk)
        a = dk.geom_xmat[rg].reshape(3, 3)[:, 2]; q = dk.qpos[act_q[12:]]
        Jp = np.zeros((3, m.nv)); Jr = np.zeros((3, m.nv)); mujoco.mj_jacGeom(m, dk, Jp, Jr, rg)
        rows = [Jp[:, act_d[12:]], w_o * np.cross(a, NORMAL) @ Jr[:, act_d[12:]], W_HEAD[0] * w_o * np.cross(a, PY_) @ Jr[:, act_d[12:]]]
        errs = [target - dk.geom_xpos[rg], [-w_o * (a @ NORMAL)], [-W_HEAD[0] * w_o * (a @ PY_)]]
        for g, p in PAIRS:
            dist = mujoco.mj_geomDistance(m, dk, g, p, margin, ft)
            if dist >= margin: continue
            pa, po = ft[:3], ft[3:]; nvec = pa - po; ln = np.linalg.norm(nvec)
            if ln < 1e-9: continue
            nvec = nvec / ln * (1 if dist >= 0 else -1)
            Jc = np.zeros((3, m.nv)); mujoco.mj_jac(m, dk, Jc, None, pa, m.geom_bodyid[g])
            rows.append(w_c * nvec @ Jc[:, act_d[12:]][None, :].reshape(3, -1) if False else (w_c * (nvec @ Jc[:, act_d[12:]]))[None, :]); errs.append([w_c * (margin - dist)])
        J = np.vstack(rows); e = np.concatenate([np.ravel(x) for x in errs])
        Jinv = J.T @ np.linalg.inv(J @ J.T + 2e-3 * np.eye(len(e)))
        dq = 0.6 * Jinv @ e + (np.eye(6) - Jinv @ J) @ (k_null * (MID - q) / (0.25 * SPAN_J ** 2) * SPAN_J)
        dk.qpos[act_q[12:]] = np.clip(q + np.clip(dq, -0.3, 0.3), ARM_LO, ARM_HI)
    return dk.qpos[act_q[12:]].copy()
def ik5c_best(target, q_now, n_seeds=60, rng=np.random.default_rng(2)):
    seeds = [q_now] + [rng.uniform(ARM_LO, ARM_HI) for _ in range(n_seeds)]; best, key = None, np.inf
    for s in seeds:
        q = arm_ik5c(target, s, 150); pe, fe, _ = ik5_err(target, q); col, dist = bad_contact(q, 0.01)
        score = pe + fe + (1.0 if col else 0.0) + 0.02 * np.linalg.norm(q - q_now)
        if score < key: best, key = q, score
    return best
def plan_panel_c(key):
    pts, owner, cells = panel_path(key); q = ik5c_best(pts[0], d.qpos[act_q[12:]].copy()); Q = [q]
    for p in pts[1:]: q = arm_ik5c(p, q); Q.append(q)
    E = np.array([ik5_err(p, q) for p, q in zip(pts, Q)]); jumps = np.abs(np.diff(np.array(Q), axis=0)).max(1)
    C = np.array([bad_contact(q, 0.005)[1] for q in Q])
    return pts, owner, cells, np.array(Q), E, jumps, C
import json as _json
GAITS = {k: unpack(np.array(_json.load(open(os.path.join(HERE, 'gaits', f'gait_{k}.json')))['th'])) for k in ('fwd', 'left', 'right', 'back')}
def walk_to(axis, goal, frame=None, tmax=20.0, arm=None):
    """Walk with a learned gait until the base reaches ``goal`` on ``axis`` (0: x forward, 1: y sideways), then settle into the stance."""
    i = axis; sgn = np.sign(goal - d.qpos[i])
    if sgn == 0: return
    mode, vx, vy = ('fwd', 1.0, 0.0) if i == 0 else (('left', 0.0, 1.0) if sgn > 0 else ('right', 0.0, -1.0))
    p = GAITS[mode]; t0 = d.time; arm = q0[act_q[12:]] if arm is None else arm
    while (goal - d.qpos[i]) * sgn > 0.02 and d.time - t0 < tmax:
        k = int(round((d.time - t0) / m.opt.timestep))
        if k % kw['phys_substeps'] == 0: c = gait2(d.time - t0, p, vx, vy, -euler()[2], arm=arm)
        servo(c); mujoco.mj_step(m, d)
        if frame: frame()
    st = stand_q().copy(); st[12:] = arm
    for _ in range(int(0.6 / m.opt.timestep)):
        servo(st); mujoco.mj_step(m, d)
        if frame: frame()

STOW = q0[act_q[12:]].copy()
def arm_move(q_to, frame=None, extra=0.3):
    """Ease the arm to q_to while standing (joint-space, speed-limited)."""
    st = stand_q().copy(); q_from = d.qpos[act_q[12:]].copy(); T = max(0.8, 1.5 * np.abs(q_to - q_from).max() / QMAX)
    for k in range(int((T + extra) / m.opt.timestep)):
        u = min(1.0, k * m.opt.timestep / T); u = u * u * (3 - 2 * u); st[12:] = q_from + (q_to - q_from) * u; servo(st); mujoco.mj_step(m, d)
        if frame: frame()
def back_to(goal, frame=None, tmax=8.0):
    p = GAITS['back']; t0 = d.time
    while d.qpos[0] > goal + 0.02 and d.time - t0 < tmax:
        k = int(round((d.time - t0) / m.opt.timestep))
        if k % kw['phys_substeps'] == 0: c = gait2(d.time - t0, p, -1.0, 0.0, -euler()[2], arm=STOW)
        servo(c); mujoco.mj_step(m, d)
        if frame: frame()
    st = stand_q().copy(); st[12:] = STOW
    for _ in range(int(0.6 / m.opt.timestep)):
        servo(st); mujoco.mj_step(m, d)
        if frame: frame()
X_LO, X_HI, X_GO = 1.45, 1.75, 1.58
LANE = 0.8
def fix_x(frame=None):
    if d.qpos[0] < X_LO: walk_to(0, X_GO, frame, arm=STOW)
    elif d.qpos[0] > X_HI: back_to(X_GO, frame)
PANELS = []
for _g in GOALS:
    if _g.key not in PANELS: PANELS.append(_g.key)
def episode(frame=None, log=print, cleaned=None):
    settle(along_axis(1.0)); d.qpos[0] = -kw['spawn_offset']; mujoco.mj_forward(m, d); cleaned = set() if cleaned is None else cleaned
    walk_to(0, LANE, frame, arm=STOW); log(('lane', round(d.time, 1), d.qpos[:3].round(2).tolist(), np.round(euler(), 2).tolist()))
    for key in PANELS:
        # sideways only in the lane, clear of the panel columns; then straight up to the panel
        if d.qpos[0] > LANE + 0.1: back_to(LANE, frame)
        walk_to(1, grid.panel_pos[key][1], frame, arm=STOW); walk_to(0, X_GO, frame, arm=STOW); fix_x(frame)
        log(('at', key, round(d.time, 1), d.qpos[:3].round(2).tolist(), np.round(euler(), 2).tolist()))
        cl, gi, nc = run_panel(key, cleaned=cleaned, frame=frame); arm_move(STOW, frame)
        log(('swept', key, gi, nc, round(d.time, 1), d.qpos[:3].round(2).tolist(), np.round(euler(), 2).tolist()))
    return cleaned
W_HEAD[0] = 0.0   # roller kept flat on the face; its heading within the face is left free (the fixed heading cannot reach the top row)

"""Colour-coded rollouts for the 7 Gym ports: a body design and a scripted rhythmic controller (a CPG per actuator, plus linear feedback on
torso pitch/roll) tuned jointly by a quick antithetic ES on each port's v4 reward and healthy termination, in plain MuJoCo on the port's own
XML (the design goes through gym_look's twin of the env's deform). Not a baseline policy: a few CPU minutes per env, for illustration.

Usage: python tools/gym_rollouts.py [ids...] [--gens N]   -> static/video/showcase/<id>_cd.mp4 + .jpg, tools/out/<id>_cd.json
"""
import argparse, json, multiprocessing as mp, os, subprocess, sys
import mujoco, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from goal_overlay import banner, chip  # noqa: E402
from gym_look import ENVS, GOAL, ROOT, Port  # noqa: E402

PLANAR = {'halfcheetah', 'hopper', 'walker2d', 'swimmer'}
T_TRAIN = {'halfcheetah': 200, 'hopper': 300, 'walker2d': 300, 'swimmer': 200, 'ant': 250, 'humanoid': 250, 'humanoidstandup': 200}
W, H, FPS, SECONDS = 640, 480, 30, 10
_P = None


def tilt(vid, d):
    """(pitch, pitch rate, roll, roll rate) of the root: the planar hinge, or the free joint's torso frame."""
    if vid in PLANAR: return d.qpos[2], d.qvel[2], 0.0, 0.0
    R = d.xmat[1].reshape(3, 3); return -np.arcsin(np.clip(R[2, 0], -1, 1)), d.qvel[4], np.arctan2(R[2, 1], R[2, 2]), d.qvel[3]


def forward_x(vid, m, d):
    if vid == 'humanoid': return float((m.body_mass[:, None] * d.xipos).sum(0)[0] / m.body_mass.sum())
    return float(d.qpos[0])


def healthy(vid, c, d):
    if vid == 'hopper': s = np.concatenate([d.qpos, d.qvel])[2:]; return np.all(np.abs(s) < c.healthy_state) and d.qpos[1] > c.healthy_z_min and abs(d.qpos[2]) < c.healthy_angle
    if vid == 'walker2d': return c.healthy_z_min < d.qpos[1] < c.healthy_z_max and abs(d.qpos[2]) < c.healthy_angle
    if vid in ('ant', 'humanoid'): return c.healthy_z_min <= d.qpos[2] <= c.healthy_z_max
    return True


def split(P, th):
    n, nu = P.n, P.m.nu; k = 5 if P.vid in PLANAR else 7
    design = np.clip(np.tanh(th[:n]), P.lo, P.hi); w = th[n:n + nu * k].reshape(nu, k); freq = 0.5 + 2.5 / (1 + np.exp(-th[-1]))
    return design, w, freq


def control(P, w, freq, t, d):
    p, pr, r, rr = tilt(P.vid, d)
    u = w[:, 0] * np.sin(2 * np.pi * freq * t + 3 * w[:, 1]) + w[:, 2] + w[:, 3] * p + w[:, 4] * pr
    if w.shape[1] > 5: u = u + w[:, 5] * r + w[:, 6] * rr
    lo, hi = P.m.actuator_ctrlrange[:, 0], P.m.actuator_ctrlrange[:, 1]
    return np.clip(lo + (np.tanh(u) + 1) * 0.5 * (hi - lo), lo, hi)


def episode(P, th, seed, T, frame=None):
    m, d, c, vid = P.m, P.d, P.cfg, P.vid
    design, w, freq = split(P, th); P.design(design); P.reset(np.random.default_rng(seed), c.reset_noise_scale)
    dt = c.frame_skip * m.opt.timestep; ret, steps = 0.0, 0
    for s in range(T):
        d.ctrl[:] = control(P, w, freq, s * dt, d); x0 = forward_x(vid, m, d)
        for k in range(c.frame_skip):
            mujoco.mj_step(m, d)
            if frame: frame(s * c.frame_skip + k)
        if not np.all(np.isfinite(d.qpos)): return ret - 100, steps
        cc = c.ctrl_cost_weight * float((d.ctrl ** 2).sum()); fw = getattr(c, 'forward_reward_weight', 1.0) * (forward_x(vid, m, d) - x0) / dt
        if vid == 'humanoidstandup': r = d.qpos[2] / m.opt.timestep - cc + 1
        else: r = fw - cc + getattr(c, 'healthy_reward', 0.0)
        ret += r; steps += 1
        if not healthy(vid, c, d): break
    return ret, steps


def _init(vid): global _P; _P = Port(vid)
def _eval(a): th, seed, T = a; return episode(_P, th, seed, T)[0]


def train(vid, gens, pop=48, sigma=0.12, lr=0.04, seed=0, init=None, T=None):
    P = Port(vid); k = 5 if vid in PLANAR else 7; rng = np.random.default_rng(seed); T = T or T_TRAIN[vid]
    th = init if init is not None else np.concatenate([np.zeros(P.n), (rng.normal(0, 0.1, (P.m.nu, k)) + np.array([0.6, 0, 0, 0, 0] + [0, 0] * (k > 5))).ravel(), [0.0]])
    mo, ve, best = np.zeros_like(th), np.zeros_like(th), (-np.inf, th)
    with mp.get_context('fork').Pool(min(10, os.cpu_count()), _init, (vid,)) as pool:
        for g in range(gens):
            eps = rng.normal(0, 1, (pop // 2, th.size)); cand = np.concatenate([th + sigma * eps, th - sigma * eps]); s = int(rng.integers(1 << 30))
            R = np.array(pool.map(_eval, [(x, s, T) for x in cand]))
            rk = np.empty(pop); rk[np.argsort(R)] = np.linspace(-0.5, 0.5, pop)
            grad = (rk[:pop // 2] - rk[pop // 2:]) @ eps / (pop * sigma)
            mo = 0.9 * mo + 0.1 * grad; ve = 0.999 * ve + 0.001 * grad ** 2; th = th + lr * (mo / (1 - 0.9 ** (g + 1))) / (np.sqrt(ve / (1 - 0.999 ** (g + 1))) + 1e-8)
            if g % 10 == 9 or g == gens - 1:
                cur = np.mean(pool.map(_eval, [(th, 1000 + j, T) for j in range(4)]))
                if cur > best[0]: best = (cur, th.copy())
                print(f'{vid} gen {g + 1:4d}  pop mean {R.mean():8.1f}  max {R.max():8.1f}  centre {cur:8.1f}', flush=True)
    return best


def render(vid, th):
    P = Port(vid); m, d, c = P.m, P.d, P.cfg; r = mujoco.Renderer(m, H, W); cam = mujoco.MjvCamera()
    dt = c.frame_skip * m.opt.timestep; T = int(SECONDS / dt); sub = 1 / (FPS * m.opt.timestep)
    dst = os.path.join(ROOT, 'static', 'video', 'showcase', f'{vid}_cd.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    state = {'next': 0.0, 'n': 0, 'look': None}
    span = {'swimmer': 3.4, 'ant': 3.6, 'halfcheetah': 3.6, 'hopper': 3.4, 'walker2d': 3.6, 'humanoid': 4.0, 'humanoidstandup': 3.6}[vid]

    def frame(k):
        if k < state['next']: return
        state['next'] += sub; state['n'] += 1
        tgt = d.subtree_com[1].copy(); state['look'] = tgt if state['look'] is None else np.r_[tgt[:2], 0.9 * state['look'][2] + 0.1 * tgt[2]]   # follow x/y exactly, damp the bounce
        cam.lookat[:] = state['look']; cam.distance = span; cam.azimuth = 90 if vid in PLANAR - {'swimmer'} else 120; cam.elevation = -55 if vid == 'swimmer' else -15
        r.update_scene(d, cam); img = Image.fromarray(r.render()).convert('RGBA'); ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
        banner(dr, 12, 12, 'GOAL', GOAL[vid], 0.95); chip(dr, 12, 50, 'scripted controller, not a baseline policy', 0.85, fill=(10, 14, 23, 190))
        chip(dr, 12, H - 36, f'{P.groups} co-designed links, one colour each', 0.95)
        state['img'] = Image.alpha_composite(img, ov).convert('RGB').tobytes(); p.stdin.write(state['img'])

    ret, steps = episode(P, th, 7, T, frame)
    last = state['img']
    for _ in range(FPS): p.stdin.write(last)   # hold the last frame (an early termination ends the clip there)
    p.stdin.close(); p.wait(); r.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(min(3, 0.5 * state['n'] / FPS)), '-i', dst, '-frames:v', '1', '-q:v', '3', dst.replace('.mp4', '.jpg')], check=True)
    return ret, steps, state['n'] / FPS


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('ids', nargs='*'); ap.add_argument('--gens', type=int, default=150); ap.add_argument('--render-only', action='store_true'); ap.add_argument('--resume', action='store_true'); ap.add_argument('--horizon', type=int); a = ap.parse_args()
    out = os.path.join(ROOT, 'tools', 'out'); os.makedirs(out, exist_ok=True)
    for vid in a.ids or ENVS:
        fn = os.path.join(out, f'{vid}_cd.json')
        if a.render_only: th = np.array(json.load(open(fn))['theta'])
        else: score, th = train(vid, a.gens, init=np.array(json.load(open(fn))['theta']) if a.resume else None, T=a.horizon, sigma=0.06 if a.resume else 0.12); json.dump({'theta': th.tolist(), 'score': score}, open(fn, 'w'))
        ret, steps, secs = render(vid, th); print(f'{vid}: rendered {secs:.1f}s, return {ret:.1f} over {steps} steps', flush=True)

"""Scripted (kinematic) Solar Cleaner demo in the real SolarCleaner-Reach scene, built with the env's own spec builder.

A co-designed body (every arm link stretched by the preset's max offset, 0.15 m/axis) trots to the array and sweeps each panel's
cells in the env's serpentine order; a cell turns the env's clean green once the roller has passed over it. Kinematic: joint angles
are scripted (trot) and solved (arm IK), there is no physics. Usage: python tools/solar/render_solar.py -> static/video/showcase/solar_goal.mp4
"""
import os, subprocess, sys
import mujoco, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'tools'))
from scene import build
from design import links, lengthen_arm
from goal_overlay import banner, chip

W, H, FPS = 960, 600, 30
CLEAN = (0.1, 0.8, 0.2, 1.0)
m, grid, kw = build('REACH'); L = links(m); lengthen_arm(m, L, 0.15); d = mujoco.MjData(m)
m.vis.global_.offwidth, m.vis.global_.offheight = 1920, 1200
q = lambda n: m.jnt_qposadr[mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, n)]
dv = lambda n: m.jnt_dofadr[mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, n)]
ARM, DARM = [q(f'joint_l{i}') for i in range(6)], [dv(f'joint_l{i}') for i in range(6)]
LEGS = {leg: (q(f'{leg}_hip'), q(f'{leg}_knee')) for leg in ('fl', 'fr', 'bl', 'br')}
PHASE = {'fl': 0, 'br': 0, 'fr': np.pi, 'bl': np.pi}
rg = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, 'roller_geom'); R = float(kw['roller_radius'])
tilt = np.deg2rad(kw['panel_tilt_degs']); normal = np.array([-np.sin(tilt), 0, np.cos(tilt)])
mujoco.mj_resetData(m, d); Z0 = float(d.qpos[2]); q0 = d.qpos.copy()

def ik(target, iters=40):
    for _ in range(iters):
        mujoco.mj_kinematics(m, d); mujoco.mj_comPos(m, d); err = target - d.geom_xpos[rg]
        if np.linalg.norm(err) < 0.004: break
        J = np.zeros((3, m.nv)); mujoco.mj_jacGeom(m, d, J, None, rg); Ja = J[:, DARM]
        d.qpos[ARM] += 0.6 * (Ja.T @ np.linalg.solve(Ja @ Ja.T + 2e-3 * np.eye(3), err))

def gait(t, moving):
    for leg, (h, k) in LEGS.items():
        ph = 2 * np.pi * 1.6 * t + PHASE[leg]; a = 1.0 if moving else 0.0
        d.qpos[h] = q0[h] + a * 0.35 * np.sin(ph); d.qpos[k] = q0[k] + a * 0.35 * max(0.0, np.sin(ph + np.pi / 2))
    d.qpos[2] = Z0 + (0.012 * abs(np.sin(2 * np.pi * 1.6 * t)) if moving else 0.0)

# the traversal: the env's own serpentine order ('goals' hands out cells panel by panel)
goals = [g for g in grid.goals(kw['panel_traversal']) if not g.is_midpoint]
panels = []
for g in goals:
    if not panels or panels[-1][0] != g.key: panels.append((g.key, []))
    panels[-1][1].append(g)
base_x = 1.3
plan = []   # (duration_s, kind, payload)
plan.append((3.2, 'walk', ((-kw['spawn_offset'], 0.0), (base_x, grid.panel_pos[panels[0][0]][1]))))
for i, (pk, cells) in enumerate(panels):
    y = grid.panel_pos[pk][1]
    if i: plan.append((1.6, 'walk', ((base_x, grid.panel_pos[panels[i - 1][0]][1]), (base_x, y))))
    plan.append((len(cells) * 0.2, 'sweep', (y, cells)))
cleaned = set(); total = len(goals)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                      os.path.join(ROOT, 'static/video/showcase/solar_goal.mp4')], stdin=subprocess.PIPE)
r = mujoco.Renderer(m, H, W); cam = mujoco.MjvCamera(); cam.distance, cam.azimuth, cam.elevation = 5.6, 20, -26
t, frames = 0.0, []
d.qpos[ARM] = q0[ARM]
for dur, kind, pay in plan:
    n = int(dur * FPS)
    for f in range(n):
        u = (f + 1) / n
        if kind == 'walk':
            (x0, y0), (x1, y1) = pay; e = u * u * (3 - 2 * u); d.qpos[0], d.qpos[1] = x0 + (x1 - x0) * e, y0 + (y1 - y0) * e; gait(t, True)
            ik(np.array([d.qpos[0] + 0.55, d.qpos[1], 1.25]), 8)   # carry the roller high while walking
        else:
            y, cells = pay; gait(t, False); d.qpos[0], d.qpos[1] = base_x, y
            s = u * len(cells); i0 = min(int(s), len(cells) - 1); i1 = min(i0 + 1, len(cells) - 1); w = s - int(s)
            a0, a1 = np.array(cells[i0].pos), np.array(cells[i1].pos); target = a0 + (a1 - a0) * min(1, w * 1.6) + normal * (R + 0.01)
            ik(target)
            rp = d.geom_xpos[rg] - normal * (R + 0.01)
            for c in cells:
                if c.geom not in cleaned and np.all(np.abs((rp - np.array(c.pos))[:2]) < np.array(grid.half[:2]) * 1.05) and abs(np.dot(rp - np.array(c.pos), normal)) < 0.05:
                    cleaned.add(c.geom); m.geom_rgba[mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, c.geom)] = CLEAN
        mujoco.mj_kinematics(m, d)
        cam.lookat[:] = [0.5 * (d.qpos[0] + 2.4), 0.6 * d.qpos[1], 1.0]
        r.update_scene(d, cam); img = Image.fromarray(r.render()).convert('RGBA'); ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
        banner(dr, 16, 16, 'GOAL', 'sweep every panel cell with the roller', 1.35)
        chip(dr, 16, 70, 'scripted demo · co-designed arm (every link +0.15 m)', 1.1, fill=(10, 14, 23, 190))
        bx, by, bw = 16, H - 56, W - 32; dr.rounded_rectangle([bx, by, bx + bw, by + 40], radius=8, fill=(10, 14, 23, 210))
        from goal_overlay import F
        ft = F('jetbrains-mono_latest_latin-600-normal.ttf', 16); dr.text((bx + 14, by + 20), f'cells cleaned {len(cleaned):2d} / {total}', font=ft, fill='white', anchor='lm')
        x0 = bx + 270; dr.rounded_rectangle([x0, by + 14, bx + bw - 14, by + 26], radius=4, fill=(40, 48, 66, 255))
        if cleaned: dr.rounded_rectangle([x0, by + 14, x0 + (bx + bw - 14 - x0) * len(cleaned) / total, by + 26], radius=4, fill=(34, 197, 94, 255))
        fr = Image.alpha_composite(img, ov).convert('RGB'); p.stdin.write(fr.tobytes()); frames.append(fr) if len(frames) < 2 or f == n - 1 else None
        t += 1 / FPS
for _ in range(int(1.2 * FPS)): p.stdin.write(fr.tobytes())
p.stdin.close(); p.wait(); fr.save(os.path.join(ROOT, 'static/video/showcase/solar_goal.jpg'), quality=86)
print('cleaned', len(cleaned), '/', total, f'{t:.1f}s')

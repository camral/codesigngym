"""Render the physical Solar Cleaner demo (solar_physics.episode) to static/video/showcase/solar_goal.mp4 + .jpg, at SPEED x real time.

Usage: python tools/solar/render_solar.py
"""
import os, subprocess, sys
import mujoco, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import solar_physics as S  # noqa: E402
from goal_overlay import F, banner, chip  # noqa: E402

W, H, FPS, SPEED = 960, 600, 30, 3
CLEAN = (0.1, 0.8, 0.2, 1.0)
m, d = S.m, S.d
r = mujoco.Renderer(m, H, W); cam = mujoco.MjvCamera(); cam.distance, cam.azimuth, cam.elevation = 5.6, 20, -26
dst = os.path.join(ROOT, 'static/video/showcase/solar_goal.mp4')
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
cleaned, painted, st = set(), set(), {'next': None, 'look': None, 'last': None, 'n': 0}
gid = {g.geom: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, g.geom) for g in S.GOALS}
ft = F('jetbrains-mono_latest_latin-600-normal.ttf', 16)


def frame():
    if st['next'] is None: st['next'] = d.time
    if d.time < st['next']: return
    st['next'] += SPEED / FPS; st['n'] += 1
    for g in cleaned - painted: m.geom_rgba[gid[g]] = CLEAN; painted.add(g)
    tgt = np.array([0.5 * (d.qpos[0] + 2.4), 0.6 * d.qpos[1], 1.0]); st['look'] = tgt if st['look'] is None else 0.92 * st['look'] + 0.08 * tgt
    cam.lookat[:] = st['look']; r.update_scene(d, cam)
    img = Image.fromarray(r.render()).convert('RGBA'); ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
    banner(dr, 16, 16, 'GOAL', 'sweep every panel cell with the roller', 1.35)
    chip(dr, 16, 70, 'MuJoCo physics · scripted controller, not a policy · co-designed arm', 1.1, fill=(10, 14, 23, 190))
    chip(dr, W - 16 - 96, 16, f'{SPEED}× speed', 1.2, fill=(10, 14, 23, 190))
    bx, by, bw = 16, H - 56, W - 32; dr.rounded_rectangle([bx, by, bx + bw, by + 40], radius=8, fill=(10, 14, 23, 210))
    dr.text((bx + 14, by + 20), f'cells cleaned {len(cleaned):2d} / {len(S.GOALS)}', font=ft, fill='white', anchor='lm')
    x0 = bx + 270; dr.rounded_rectangle([x0, by + 14, bx + bw - 14, by + 26], radius=4, fill=(40, 48, 66, 255))
    if cleaned: dr.rounded_rectangle([x0, by + 14, x0 + (bx + bw - 14 - x0) * len(cleaned) / len(S.GOALS), by + 26], radius=4, fill=(34, 197, 94, 255))
    st['last'] = Image.alpha_composite(img, ov).convert('RGB'); p.stdin.write(st['last'].tobytes())


S.episode(frame, cleaned=cleaned)
for _ in range(int(1.5 * FPS)): p.stdin.write(st['last'].tobytes())
p.stdin.close(); p.wait(); st['last'].save(dst.replace('.mp4', '.jpg'), quality=86)
print('cleaned', len(cleaned), '/', len(S.GOALS), f'sim {d.time:.1f}s, video {st["n"] / FPS:.1f}s', f'{os.path.getsize(dst) // 1024} KB')

"""Design-sweep clips for the 7 Gym ports, in the environment's own look: each separately co-designed link (action slot group) has its
own colour, fixed parts keep the env's materials, and the design vector sweeps each env's real bounds (max_offset, pos/neg clips, _equ
sharing, length floor) through gym_look's twin of the env's deform. Rest pose, no policy.

Usage: python tools/render_gym_sweeps.py   -> static/video/showcase/<id>_design.mp4 + .jpg   (CODESIGN_GYM=path/to/codesign-gym)
"""
import os, subprocess, sys
import mujoco, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from goal_overlay import banner, chip  # noqa: E402
from gym_look import ENVS, GOAL, ROOT, Port  # noqa: E402

W, H, F = 640, 480, 240
ZOOM = {'swimmer': 3.4, 'humanoid': 1.45, 'humanoidstandup': 1.35, 'hopper': 1.6, 'walker2d': 1.6, 'ant': 2.3, 'halfcheetah': 1.4}

for vid in (sys.argv[1:] or ENVS):
    P = Port(vid); m, d = P.m, P.d; r = mujoco.Renderer(m, H, W)
    P.reset(); SPAN = np.ptp(d.xpos[1:], axis=0).max() + 0.4
    ph = np.random.default_rng(3).uniform(0, 2 * np.pi, P.n)
    dst = os.path.join(ROOT, 'static', 'video', 'showcase', f'{vid}_design.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    for f in range(F):
        u = 2 * np.pi * f / F
        P.design(np.clip(np.sin(u + ph), P.lo, P.hi)); P.reset()
        cam = mujoco.MjvCamera(); cam.lookat[:] = d.subtree_com[1]; cam.distance = ZOOM[vid] * SPAN; cam.azimuth = 120 + 25 * np.sin(u); cam.elevation = -22
        if vid == 'swimmer': cam.elevation = -55
        if vid == 'halfcheetah': cam.azimuth, cam.elevation = 90 + 12 * np.sin(u), -10   # planar robot: a side view shows every link
        r.update_scene(d, cam); img = Image.fromarray(r.render()).convert('RGBA'); ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
        banner(dr, 12, 12, 'GOAL', GOAL[vid], 0.95); chip(dr, 12, H - 36, f'{P.groups} co-designed links, one colour each', 0.95)
        p.stdin.write(Image.alpha_composite(img, ov).convert('RGB').tobytes())
    p.stdin.close(); p.wait(); r.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '2', '-i', dst, '-frames:v', '1', '-q:v', '3', dst.replace('.mp4', '.jpg')], check=True)
    print(vid, P.n, 'slots,', P.groups, 'colours', f'{os.path.getsize(dst) // 1024} KB')

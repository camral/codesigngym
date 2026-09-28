"""Burn goal overlays into real environment footage (Solar Cleaner, Soft Walker).

Usage: python tools/goal_overlay.py  ->  static/video/showcase/{solar,softwalker}_goal.mp4 (+ .jpg)
Solar Cleaner: the rollout is a real final-eval video; cleaned cells render green, so the 'cells cleaned' meter is measured from
the green pixels on the panels in each frame (normalised to the clip's final state), and the roller callout tracks its red tip.
"""
import os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FD = os.path.join(ROOT, 'tools', 'fonts')
F = lambda n, s: ImageFont.truetype(os.path.join(FD, n), s)
INK, BLUE, OK = (10, 14, 23), (37, 99, 235), (34, 197, 94)


def frames(src):
    w, h = [int(x) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.split(',')]
    fps = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3), fps


def write(dst, imgs, fps):
    w, h = imgs[0].size
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', fps, '-i', '-', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    for im in imgs: p.stdin.write(im.convert('RGB').tobytes())
    p.stdin.close(); p.wait()
    imgs[int(len(imgs) * 0.8)].convert('RGB').save(dst.replace('.mp4', '.jpg'), quality=86)


def banner(d, x, y, head, text, s):
    fh, ft = F('inter_latest_latin-800-normal.ttf', int(13 * s)), F('inter_latest_latin-600-normal.ttf', int(15 * s))
    hw = d.textlength(head, font=fh); tw = d.textlength(text, font=ft); pad = int(10 * s); H = int(34 * s)
    d.rounded_rectangle([x, y, x + hw + tw + 4 * pad, y + H], radius=int(6 * s), fill=(10, 14, 23, 220))
    d.rounded_rectangle([x + pad * 0.6, y + pad * 0.6, x + hw + 2 * pad, y + H - pad * 0.6], radius=int(4 * s), fill=BLUE + (255,))
    d.text((x + pad * 1.3, y + H / 2), head, font=fh, fill='white', anchor='lm'); d.text((x + hw + 2.8 * pad, y + H / 2), text, font=ft, fill='white', anchor='lm')


def chip(d, x, y, text, s, fill=(10, 14, 23, 200)):
    ft = F('jetbrains-mono_latest_latin-600-normal.ttf', int(12 * s)); tw = d.textlength(text, font=ft)
    d.rounded_rectangle([x, y, x + tw + 16 * s, y + 24 * s], radius=int(4 * s), fill=fill); d.text((x + 8 * s, y + 12 * s), text, font=ft, fill='white', anchor='lm')


def solar():
    src = os.path.join(ROOT, 'static/video/SolarCleanerTraverse/cmaes.mp4'); fr, fps = frames(src)
    up = 2; out = []
    g = fr.astype(int); green = ((g[..., 1] > 150) & (g[..., 0] < 110) & (g[..., 2] < 140)).reshape(len(fr), -1).sum(1)
    base = green[:3].mean(); prog = np.clip((green - base) / max(1, green.max() - base), 0, 1); prog = np.maximum.accumulate(prog)
    for k, f in enumerate(fr):
        im = Image.fromarray(f).resize((f.shape[1] * up, f.shape[0] * up), Image.LANCZOS).convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); s = up * 0.9
        banner(d, 12 * up, 12 * up, 'GOAL', 'sweep every panel cell with the roller', s)
        # roller: the red arm tip
        a = f.astype(int); m = (a[..., 0] > 150) & (a[..., 1] < 70) & (a[..., 2] < 80); ys, xs = np.nonzero(m)
        if len(xs) > 4:
            cx, cy = xs.mean() * up, ys.mean() * up; tx, ty = cx - 150 * up / 2, cy - 60 * up / 2
            d.line([cx, cy, tx + 60 * s, ty + 24 * s], fill=(255, 255, 255, 230), width=int(2 * up)); d.ellipse([cx - 7 * up, cy - 7 * up, cx + 7 * up, cy + 7 * up], outline=(255, 255, 255, 240), width=int(2 * up))
            chip(d, tx, ty, 'roller', s)
        # cleaned cells render green: call them out where they appear (measured per frame)
        gm = (a[..., 1] > 150) & (a[..., 0] < 110) & (a[..., 2] < 140); gy, gx = np.nonzero(gm); W = im.size[0]
        if len(gx) > 120:
            cx, cy = gx.mean() * up, gy.mean() * up; tx, ty = cx + 40 * up, cy - 70 * up
            d.line([cx, cy, tx, ty + 12 * s], fill=(255, 255, 255, 230), width=int(2 * up)); chip(d, tx, ty, 'cleaned cells turn green', s, fill=(22, 163, 74, 230))
        chip(d, W - 270 * up, 12 * up + 40 * s, 'only the roller may touch a panel', s * 0.9, fill=(220, 38, 38, 210))
        out.append(Image.alpha_composite(im, ov))
    write(os.path.join(ROOT, 'static/video/showcase/solar_goal.mp4'), out, fps); print('solar', len(out), 'frames; final measured progress', round(float(prog[-1]), 2))


def softwalker():
    src = os.path.join(ROOT, 'static/video/extra/SoftWalkerHexFEM3D-Gaps.mp4'); fr, fps = frames(src); out = []
    for k, f in enumerate(fr):
        im = Image.fromarray(f).convert('RGBA'); ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov); s = 1.6
        banner(d, 22, 22, 'GOAL', 'travel as far forward as possible, across the gaps', s)
        W, H = im.size; px, py = 470, 430   # a pit between platforms (static camera)
        d.ellipse([px - 9, py - 9, px + 9, py + 9], outline=(255, 255, 255, 240), width=3); d.line([px, py, px + 70, py - 60], fill=(255, 255, 255, 230), width=3); chip(d, px + 60, py - 96, 'gap in the terrain', s * 0.85)
        chip(d, 22, H - 70, 'design: every cell (material, stiffness, actuation)  ·  policy: actuation over time', s * 0.8)
        out.append(Image.alpha_composite(im, ov))
    write(os.path.join(ROOT, 'static/video/showcase/softwalker_goal.mp4'), out, fps); print('softwalker', len(out), 'frames')


if __name__ == '__main__':
    solar(); softwalker()

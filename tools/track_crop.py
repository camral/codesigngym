"""Follow-crop a fixed-camera MuJoCo rollout around the (orange) robot so small bodies fill the tile.

Usage: python tools/track_crop.py IN.mp4 OUT.mp4 [crop_px=200] [out_px=320]
Per frame: centroid of robot pixels (R - B > 60), exponentially smoothed; frames where the robot is out of view hold the last centre.
"""
import subprocess, sys
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
C = int(sys.argv[3]) if len(sys.argv) > 3 else 200
S = int(sys.argv[4]) if len(sys.argv) > 4 else 320
w, h = [int(x) for x in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src],
                                        capture_output=True, text=True).stdout.strip().split(',')]
fps = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip()
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
cx, cy = w / 2, h / 2
out = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{C}x{C}', '-r', fps, '-i', '-', '-vf', f'scale={S}:{S}:flags=lanczos',
                        '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', dst], stdin=subprocess.PIPE)
for i, f in enumerate(fr):
    mask = (f[..., 0].astype(int) - f[..., 2].astype(int)) > 60
    ys, xs = np.nonzero(mask)
    if len(xs) > 30:
        tx, ty = xs.mean(), ys.mean()
        a = 1.0 if i == 0 else 0.25
        cx, cy = (1 - a) * cx + a * tx, (1 - a) * cy + a * ty
    x0 = int(np.clip(cx - C / 2, 0, w - C)); y0 = int(np.clip(cy - C / 2, 0, h - C))
    out.stdin.write(np.ascontiguousarray(f[y0:y0 + C, x0:x0 + C]).tobytes())
out.stdin.close(); out.wait()
print('wrote', dst, len(fr), 'frames')

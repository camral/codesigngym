"""Add presets run after the paper tables (hand co-design runs) to static/data/results.json and videos.json from local result directories.

Usage (from this repo root): python tools/add_local_presets.py [path/to/codesign-baselines/exp_results/hand-final]
Same conventions as export_results.py / fetch_videos.py: step-held eval return on the 4 h grid (LOKI shifted by its prep time),
final = latest completed eval/reward, mean +- population std over seeds; video = final-eval best rollout of the seed with the best final return.
Re-run safe: existing entries for these presets are replaced, existing videos are re-encoded.
"""
import json, math, os, re, shutil, subprocess, sys, warnings
import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'codesign-baselines', 'exp_results', 'hand-final'))
PRESETS = [('RotateInHand-Cube', 'Native'), ('HandPickUp-Cube', 'Native'), ('HandPickUp-Hammer', 'Native')]
METHODS = ['cmaes', 'fasttd3', 'ppo_ngopt', 'loki']
FFMPEG = shutil.which('ffmpeg')
if not FFMPEG:
    import imageio_ffmpeg; FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
warnings.filterwarnings('ignore', category=RuntimeWarning)  # all-NaN grid columns before the first eval


def duration(path):  # ffprobe may be missing; ffmpeg -i prints the container duration
    out = subprocess.run([FFMPEG, '-i', path], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def r3(x): return None if x is None or not math.isfinite(x) else float(f'{x:.4g}')


def evals(run):
    a = os.path.join(run['directory'], 'artifacts')
    rows = [json.loads(l) for l in open(os.path.join(a, 'metrics.jsonl')) if 'evaluation_boundary_seconds' in l]
    ev = sorted((r for r in rows if 'eval/reward' in r and r.get('eval/status', 'complete') == 'complete'), key=lambda r: r['evaluation_boundary_seconds'])
    videos = {r['evaluation_boundary_seconds']: r['eval/best_video_path'] for r in rows if r.get('eval/best_video_path')}
    return a, ev, videos


def held(ev, grid, offset):
    x = np.array([r['evaluation_boundary_seconds'] / 3600 + offset for r in ev]); y = np.array([r['eval/reward'] for r in ev])
    i = np.searchsorted(x, grid, side='right') - 1
    return np.where(i >= 0, y[np.clip(i, 0, None)], np.nan)


data_path = os.path.join(ROOT, 'static', 'data', 'results.json'); vid_path = os.path.join(ROOT, 'static', 'data', 'videos.json')
D = json.load(open(data_path)); V = json.load(open(vid_path))
grid = np.array(D['t'])
runs = json.load(open(os.path.join(SRC, 'manifest.json')))['runs']
assert all(r['status'] == 'complete' for r in runs), 'incomplete runs in manifest'
new = []
for env, group in PRESETS:
    ms = {}
    for m in METHODS:
        rs = [r for r in runs if r['env_id'] == env and r['method'] == m]
        if not rs: continue
        per = [(r, *evals(r)) for r in rs]
        offset = D['loki_prep_h'] if m == 'loki' else 0.0
        ys = np.array([held(ev, grid, offset) for _, _, ev, _ in per])
        ok = np.sum(~np.isnan(ys), 0) > 0
        with np.errstate(all='ignore'):
            mu, sd = np.nanmean(ys, 0), np.nanstd(ys, 0)
        finals = [ev[-1]['eval/reward'] for _, _, ev, _ in per]
        rej = [ev[-1].get('eval/embodiment_rejection_rate') for _, _, ev, _ in per]
        rej = [x for x in rej if isinstance(x, (int, float))]
        ms[m] = dict(curve=dict(mean=[r3(v) if o else None for v, o in zip(mu, ok)], std=[r3(v) if o else None for v, o in zip(sd, ok)]),
                     final=dict(mean=r3(np.mean(finals)), std=r3(np.std(finals)), n=len(finals), rejection=r3(np.mean(rej)) if rej else None),
                     rejected_evals=0)
        # video: best final return seed, its final-eval best rollout
        run, a, ev, videos = max(per, key=lambda p: p[2][-1]['eval/reward'])
        src = videos.get(ev[-1]['evaluation_boundary_seconds'])
        if not src: print('no final video', env, m); continue
        src = src if os.path.isabs(src) else os.path.join(a, src)
        d = os.path.join(ROOT, 'static', 'video', env); os.makedirs(d, exist_ok=True)
        mp4, jpg = os.path.join(d, f'{m}.mp4'), os.path.join(d, f'{m}.jpg')
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', src, '-vf', "scale='min(640,iw)':-2:flags=lanczos", '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], check=True)
        dur = duration(mp4)
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-ss', f'{dur * 0.5:.3f}', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg], check=True)
        V.setdefault(env, {})[m] = dict(src=f'static/video/{env}/{m}.mp4', poster=f'static/video/{env}/{m}.jpg', seed=run['seed'],
                                        ret=float(f"{ev[-1]['eval/reward']:.4g}"), duration=round(dur, 2), kb=round(os.path.getsize(mp4) / 1024))
        print(env, m, 'final', ms[m]['final'], 'video seed', run['seed'], V[env][m]['kb'], 'KB')
    new.append(dict(id=env, name=env, group=group, loki='loki' in ms, methods=ms, extra=True))

ids = {p['id'] for p in new}
D['presets'] = [p for p in D['presets'] if p['id'] not in ids] + new
json.dump(D, open(data_path, 'w'), separators=(',', ':'))
json.dump(V, open(vid_path, 'w'), indent=1, sort_keys=True)
print('wrote', data_path, len(D['presets']), 'presets;', vid_path)

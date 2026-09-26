"""Download each method's best-seed eval rollout video per preset from wandb and transcode it for the web.

Usage (from this repo root, with wandb logged in): python tools/fetch_videos.py [path/to/codesign-gym] [--only PRESET ...]
Writes static/video/<preset>/<method>.mp4 (+ .jpg poster) and static/data/videos.json. Picks, per (preset, method), the seed with the best final
eval return that logged an eval/best_video. Re-run safe: existing outputs are skipped.
"""
import json, math, os, pickle, subprocess, sys, tempfile
import concurrent.futures as cf

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
args = [a for a in sys.argv[1:]]
only = args[args.index('--only') + 1:] if '--only' in args else None
GYM = os.path.abspath(args[0] if args and not args[0].startswith('--') else os.path.join(ROOT, '..', 'codesign-gym'))
cache = pickle.load(open(os.path.join(GYM, 'baseline_figures', '_wandb_cache.pkl'), 'rb'))
SKIP = {('cdgym-openai-gym', 'ppo_ngopt')}
METHODS = ['cmaes', 'fasttd3', 'ppo_ngopt', 'loki']


def score(r):
    v = r['summ'].get('eval/reward')
    return v if isinstance(v, (int, float)) and math.isfinite(v) else -math.inf


best = {}
for r in cache.values():
    if (r['project'], r['method']) in SKIP or r['method'] not in METHODS: continue
    vid = r['summ'].get('eval/best_video')
    if not (isinstance(vid, dict) and vid.get('path')): continue
    if only and r['env'] not in only: continue
    k = (r['env'], r['method'])
    if k not in best or score(r) > score(best[k]): best[k] = r

import wandb  # noqa: E402
api = wandb.Api(timeout=180)


def job(item):
    (env, m), r = item
    d = os.path.join(ROOT, 'static', 'video', env); os.makedirs(d, exist_ok=True)
    mp4, jpg = os.path.join(d, f'{m}.mp4'), os.path.join(d, f'{m}.jpg')
    if not os.path.exists(mp4):
        tmp = tempfile.mkdtemp()
        f = api.run(r['path']).file(r['summ']['eval/best_video']['path']).download(root=tmp, replace=True)
        vf = "scale='min(640,iw)':-2:flags=lanczos"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f.name, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart', '-an', mp4], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout or 0)
    if not os.path.exists(jpg):  # poster = the mid-rollout frame (a seek past the end would silently write nothing)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{dur * 0.5:.3f}', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg], check=True)
    return env, m, dict(src=f'static/video/{env}/{m}.mp4', poster=f'static/video/{env}/{m}.jpg', seed=r['seed'], ret=float(f"{score(r):.4g}"),
                        duration=round(dur, 2), kb=round(os.path.getsize(mp4) / 1024))


man_path = os.path.join(ROOT, 'static', 'data', 'videos.json')
man = json.load(open(man_path)) if os.path.exists(man_path) else {}
with cf.ThreadPoolExecutor(6) as ex:
    for fut in cf.as_completed([ex.submit(job, it) for it in sorted(best.items())]):
        try:
            env, m, info = fut.result()
            man.setdefault(env, {})[m] = info
            print('ok', env, m, info['kb'], 'KB', info['duration'], 's', flush=True)
        except Exception as e:
            print('FAIL', e, flush=True)
json.dump(man, open(man_path, 'w'), indent=1, sort_keys=True)
print('wrote', man_path, sum(len(v) for v in man.values()), 'videos')

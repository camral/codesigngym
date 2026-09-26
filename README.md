# Co-Design Gym — Project Page

The public project page for [**Co-Design Gym**](https://github.com/camral/codesign-gym), a unified benchmark for
embodiment-policy co-optimization.

**Live:** https://camral.github.io/codesigngym/ (GitHub Pages from `main` / root of `camral/codesigngym`; every push to
`main` redeploys in about a minute). A static site: `index.html` + `static/`, no build step. Preview locally with `python -m http.server` (the results explorer
fetches JSON, so `file://` will not work).

## What's on the page

| Section | Built from |
|---|---|
| Hero video wall, environment explorer | `static/video/showcase/*.mp4` (one clip per family) |
| Playground: Build a catcher | `static/js/catcher-core.js` (2D arm + ballistics, deterministic searches) + `demo-catcher.js` |
| Playground: Give a walker new legs | `static/js/walker-core.js` (planck.js walker + GA) + `demo-walker.js` |
| Environment cards + modals | `static/js/envs.js`: the paper's 20 families (Native 7 / Extended 7 / Reframed 6), facts from the codesign-gym README; stills in `static/images/envs/fig3/` are cropped from the paper's Figure 3 |
| Results takeaway | headroom bars computed from `results.json` (best final return / documented max); leader counts and 16.6% from the paper |
| Baseline results explorer | `static/data/results.json`, `static/data/videos.json`, `static/video/<preset>/<method>.mp4` |
| Pokémon battle replays | `static/replays/<preset>/<method>-{best,worst}.html`, `static/data/replays.json` |
| Diagrams | `static/figures/*.svg` (+ editable `.drawio` sources) |

## Regenerating data and media

All scripts assume `../codesign-gym` is a checkout with `baseline_figures/_wandb_cache.pkl`.

```bash
python tools/export_results.py [--refresh]  # results.json via codesign-gym/make_figures.py (paper tables) + EXTRA presets (SoftWalkerBeam3D) fetched from wandb
python tools/fetch_videos.py                # best-seed final-eval video per (preset, method) from wandb; needs wandb login
PYTHON=python tools/make_showcase.sh        # per-family showcase clips (+ follow-cropped locomotion montage)
python tools/fetch_replays.py               # Pokémon: best/worst eval battle replays (poke-env HTML) + team/outcome summary
python tools/stamp.py                       # after editing CSS/JS: cache-busting ?v=<hash> on every local asset link
```

`tools/track_crop.py` follow-crops fixed-camera MuJoCo rollouts around the robot. The Shape-shifting Hand clip is a
design sweep rendered from the env's hand model in plain MuJoCo (pad heights blended between random valid designs), and the
SoftWalker clips (including the hero tile) are the env's own renders, since the SoftWalker baseline runs log only single-frame eval videos; the page labels them as such. Every other clip is a final-evaluation rollout
from the baseline runs.

The Pokémon environments have no video; their runs log poke-env battle replays instead. Each replay page holds only the
text battle log and loads Showdown's `replay-embed.js` client (and its artwork) from play.pokemonshowdown.com at view time,
the same way Showdown's own shared replays work. The page embeds them in an iframe rendered at the client's native ~800 px
width and scaled to fit.

## Credits

Page structure inspired by [Nerfies](https://github.com/nerfies/nerfies.github.io). The Pokémon illustration is original
artwork (no game sprites; see the licensing note in pokemon-codesign-env's `docs/figures/assets/CREDITS.md`).

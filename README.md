# Codesign Gym — Project Page

The public project page for [**Codesign Gym**](https://github.com/camral/codesign-gym), a
Gymnasium-like benchmark for co-design (doubly non-stationary optimization where an agent's
embodiment is optimized alongside its control policy).

**Live:** publish with GitHub Pages → Settings → Pages → *Deploy from branch* → `main` / `/ (root)`.
The site is a single static `index.html`; no build step.

## Layout

```
index.html                     # the page (Nerfies-style academic template)
static/
  css/index.css                # styling
  js/index.js                  # copy-to-clipboard helpers
  images/envs/                 # environment screenshots (+ drawn pokenv tile)
  figures/                     # diagrams — SVG + editable .drawio sources
    codesign-loop.svg/.drawio  # the two-loop co-design teaser
    architecture.svg/.drawio   # registry / lazy-import / native vectorization
    api.svg/.drawio            # Gymnasium vs. Codesign Gym signature diff
```

## Figures

All diagrams are hand-authored SVG (crisp at any zoom, themeable) with matching `.drawio` sources
that open directly in [diagrams.net](https://app.diagrams.net) for editing. To re-render an SVG to
PNG for a slide or the README:

```bash
rsvg-convert -w 1200 static/figures/codesign-loop.svg -o loop.png
```

## Credits

Layout adapted from the [Nerfies](https://github.com/nerfies/nerfies.github.io) academic project
template (CC-BY-SA-4.0). Environment screenshots are rendered from the Codesign Gym environments.

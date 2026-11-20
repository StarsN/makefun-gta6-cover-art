[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/StarsN/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/StarsN/makefun-gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

[make.fun bounty: Build the best GTA 6 cover art maker](https://make.fun/bounty/gta6-cover-art-01)

# Vice Cover Studio

An offline browser web app that turns your photos and a caption into
GTA 6-style cover art — the multi-panel poster and loading-screen look,
with a Vice City neon-sunset grade — exported as a PNG to share. It runs
entirely on your machine: open `app/index.html` from any static server
(`node serve.ts` puts it on http://localhost:8080), no network, no upload,
no account.

## What it does

- **Five layouts** — Hero + three, nine-panel grid with a title block,
  full bleed, tilted snapshots, and a five-panel film strip.
- **Five grades** — Sunset, Neon Night, Vice Pastel, Mono Heat, Gold Hour.
  Each grade recolors the sky, the striped retro sun, the skyline and the
  lettering. Panels with no photo draw procedural Vice City art (sky,
  sun, skyline, palms) so a cover looks finished before any photo is
  loaded.
- **Any photo, per panel** — load one or many photos, click a photo chip
  to put it in the selected panel, drag a panel to pan it, scroll to zoom
  it, or fine-tune zoom and pan with sliders. "Fill all panels" puts one
  photo everywhere; "Shuffle look" rolls a new layout and grade.
- **Lettering in the genre's style** — a condensed Anton title with a
  gradient fill and hard outline, a Pacifico script subtitle, an EST.
  badge ribbon and a five-star heat meter.
- **Export** — one click saves a PNG at 1080×1080, 1080×1350 or
  1920×1080, or all three at once. Undo/redo (Ctrl+Z / Ctrl+Y) covers
  every change.

## Layout

- `app/` — the app: `index.html`, `style.css`, `src/engine.js` (the
  cover renderer: layouts, grades, procedural art, lettering),
  `src/editor.js` (state, photos, history, controls, export),
  `src/shots.js` (fixed scenes for screenshots), `fonts/` (OFL
  Anton + Pacifico), `samples/` (two free-to-use sample photos).
- `screenshots/` — 3–4 screenshots: the first is an exported cover.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `dossier.json` (run it with
  `MAKEFUN_OUTPUT_DIR=out node main.ts`).
- `serve.ts` — a tiny static server for local tries.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.

## Fonts and photos

Anton and Pacifico are under the SIL Open Font License 1.1 (their OFL
texts sit beside them in `app/fonts/`). The sample photos were made with
an image model for make.fun and are free to use. No Rockstar Games logo,
artwork or font is used anywhere.

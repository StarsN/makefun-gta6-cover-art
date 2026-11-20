[![Make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/StarsN/makefun-gta6-cover-art/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/StarsN/makefun-gta6-cover-art/reward.svg)](https://make.fun/c/gta6-cover-art-01)

# Vice Cover Studio

A free, offline web app that turns your photo and a caption into GTA-style
poster cover art — the multi-panel poster look with bold caption lettering
and a Vice City sunset or neon colour grade — exported as a PNG to share.

Built for the [Make GTA 6 Cover Art](https://make.fun/c/gta6-cover-art-01)
bounty on [make.fun](https://make.fun).

## What it does

- **Any photo**: upload your own photos, or use the two built-in samples.
  Click a panel to select it, drag inside it to position the photo, scroll
  to zoom, or use the zoom/pan sliders. One photo can fill every panel, or
  each panel can hold a different one.
- **Four poster layouts**: Hero + three, a nine-panel grid with a centre
  title block, full bleed, and tilted snapshots.
- **Four colour grades**: Sunset, Neon Night, Vice Pastel, Mono Heat — each
  with its own sky, striped sun, skyline and title gradient.
- **Lettering**: a big condensed Anton title with a gradient fill and hard
  outline, a Pacifico script subtitle, a badge ribbon and a five-star heat
  meter. All editable.
- **Procedural art**: with no photo loaded, every panel is drawn in code —
  gradient sky, striped sun, skyline and palms — so the cover looks
  finished before you add anything.
- **One-click PNG export** in the common post sizes: 1080 × 1080,
  1080 × 1350 and 1920 × 1080. Plus undo/redo and a Shuffle look button.
- **Offline and private**: the app is static files under `app/` — no build
  step, no network request, no upload. Photos are read on your machine and
  never leave it.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a photo, type a caption, choose a layout and grade, hit **Export PNG**.

## Layout

- `app/` — the app itself (`index.html`, `style.css`, `src/cover.js` the
  cover engine, `src/main.js` the editor, `src/shots.js` the screenshot
  scenes, `samples/` two free-to-use sample photos, `fonts/` Anton and
  Pacifico under the SIL Open Font License).
- `screenshots/` — the entry's screenshots: the exported covers and the
  editor with a photo loaded.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun
  library (`vendor/makefun-app.ts`).
- `serve.ts` — a tiny static server for local testing.

Build the handover locally with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Originality

All artwork is drawn in code or comes from your own photos. No Rockstar
Games logo, wordmark, official artwork, character or font file is used or
shipped. The fonts are Anton and Pacifico, licensed under the SIL Open Font
License (texts in `app/fonts/`). The sample photos were made with an image
model for make.fun and are free to use.

## License

MIT — see [LICENSE](LICENSE).

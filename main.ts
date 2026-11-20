// Vice Cover Studio — the entry program (Node 22, standard library only).
//
// It hands the app in: copies app/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library (vendor/makefun-app.ts, the kit's own
// copy, unchanged). Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, so a local run is:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the app itself while building with `node serve.ts`, which puts
// app/ on http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The scorer's own caps (kit reference/gate.json): text_max_bytes shapes the
// dossier text; the other caps refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files in app/
// or 48 MiB of app files in all, or a path under app/ over 1000 bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

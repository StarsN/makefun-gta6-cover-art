// Vice Cover Studio — the entry program for gta6-cover-art-01 (Node 22,
// standard library only).
//
// It hands the app in: it copies this repository's app/ (the offline cover
// maker: index.html, its ES modules, the two sample photos and the OFL
// fonts) and screenshots/ into the output directory, then writes
// dossier.json there with the vendored make.fun library, the summary the
// judge reads. The grader runs this program twice in a fresh container with
// no network and a read-only copy of the repository, so it only reads files
// beside itself and writes under the output directory.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; inside it,
// the environment leaves that variable unset and /output is used.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Fails the run with a plain message when a required input is missing. */
function requirePath(path, what) {
  if (!existsSync(path)) throw new Error(`missing ${what}: ${path}`);
  return path;
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

const appDir = requirePath(join(here, 'app'), 'app/');
requirePath(join(appDir, 'index.html'), 'app/index.html');
const shotsDir = join(here, 'screenshots');
requirePath(shotsDir, 'screenshots/');

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The gate's own caps (reference/gate.json): the dossier text is capped at
// 160 KiB; the rest refuse an entry the scorer would refuse anyway (more
// than 4 screenshots or one over 256 KiB; app/ over 993 files or 48 MiB in
// all, or a path under app/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

const shots = readdirSync(join(out, 'screenshots'))
  .filter((name) => statSync(join(out, 'screenshots', name)).isFile())
  .sort();
console.log(
  `handed in ${countFiles(join(out, 'app'))} app files and ${shots.length} screenshots ` +
  `(${shots.join(', ')}) to ${out}`,
);

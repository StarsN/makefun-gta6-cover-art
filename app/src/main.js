// Vice Cover Studio — wires the editor: photos, panels, lettering, export.
//
// The preview canvas is the cover itself, drawn by src/cover.js at the
// export size and scaled by CSS. Click a panel to select it, drag inside it
// to pan its photo, scroll over it to zoom. Everything stays on this
// machine: photos are read with object URLs and never uploaded.
import { SIZES, GRADES, LAYOUTS, defaultState, drawCover, renderCoverToCanvas, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

const SAMPLES = [
  { id: 'sample:pier', label: 'Pier', src: './samples/pier.jpg' },
  { id: 'sample:boulevard', label: 'Boulevard', src: './samples/boulevard.jpg' },
];
const SHUFFLE_TITLES = [
  ['SUNSET HEIST', 'Vice Coast'],
  ['NEON SHORE', 'Palms & Chrome'],
  ['PIER PRESSURE', 'Golden Hour'],
  ['NIGHT SHIFT', 'Ocean Drive'],
  ['PALM COURT', 'Neon Nights'],
  ['MIDNIGHT RUN', 'Vice Coast'],
];

let state = defaultState();
let size = SIZES[0];
let selected = 0;
let uploadCount = 0;

/** id -> { img, label }: every photo a panel can show. */
const photoMap = new Map();

const undoStack = [];
const redoStack = [];
const statusEl = $('status');

function setStatus(text) { statusEl.textContent = text; }

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

async function ensurePhoto(id) {
  if (photoMap.has(id)) return photoMap.get(id);
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) return null;
  const img = await loadImage(sample.src);
  const entry = { img, label: sample.label };
  photoMap.set(id, entry);
  return entry;
}

/** The rectangles the current layout draws, in canvas pixels. */
function panelRects() {
  return layoutPanels(canvas.width, canvas.height, state.layout).panels;
}

function activePanelCount() {
  return panelRects().length;
}

function redraw() {
  drawCover(ctx, canvas.width, canvas.height, state, photoMap);
}

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

function commit() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

// For continuous edits (sliders, typing, dragging, scrolling) the snapshot
// has to be taken before the first change, not when the gesture ends: arm
// it at the gesture's start, push it on the first mutation.
let pendingSnapshot = null;
function armHistory() {
  if (!pendingSnapshot) pendingSnapshot = snapshot();
}
function pushArmed() {
  if (!pendingSnapshot) return;
  undoStack.push(pendingSnapshot);
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  pendingSnapshot = null;
  syncHistoryButtons();
}
function disarmHistory() { pendingSnapshot = null; }

function restore(next) {
  state = next;
  if (selected >= activePanelCount()) selected = 0;
  syncControls();
  redraw();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncHistoryButtons();
  setStatus('Undid the last change.');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncHistoryButtons();
  setStatus('Redid the change.');
}

function syncHistoryButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

/** Reflects the state in every control. */
function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('stars').value = String(state.stars);
  $('grain').checked = state.grain !== false;
  $('vignette').checked = state.vignette !== false;
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout));
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.grade === state.grade));
  });
  document.querySelectorAll('#sizeRow button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.size === size.id));
  });
  const pick = $('panelPick');
  pick.innerHTML = '';
  for (let i = 0; i < activePanelCount(); i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Panel ${i + 1}${i === 0 ? ' (main)' : ''}`;
    pick.appendChild(opt);
  }
  pick.value = String(selected);
  const panel = state.panels[selected] || { zoom: 1, ox: 0, oy: 0 };
  $('zoom').value = String(panel.zoom || 1);
  $('panX').value = String(panel.ox || 0);
  $('panY').value = String(panel.oy || 0);
}

/** Puts a photo id into a panel (loading a sample first when needed). */
async function setPanelPhoto(index, id) {
  commit();
  if (id) await ensurePhoto(id);
  state.panels[index] = { ...(state.panels[index] || {}), photo: id, zoom: 1, ox: 0, oy: 0 };
  redraw();
}

function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = (clientX - box.left) * (canvas.width / box.width);
  const y = (clientY - box.top) * (canvas.height / box.height);
  const rects = panelRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

async function addUploads(files, targetIndex) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) { setStatus('That file is not an image.'); return; }
  let index = targetIndex ?? selected;
  for (const file of list) {
    const id = `upload:${++uploadCount}`;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      photoMap.set(id, { img, label: file.name });
    } catch {
      setStatus('Could not read ' + file.name);
      continue;
    }
    commit();
    state.panels[index] = { photo: id, zoom: 1, ox: 0, oy: 0 };
    index = (index + 1) % activePanelCount();
  }
  selected = Math.min(index, activePanelCount() - 1);
  syncControls();
  redraw();
  setStatus(`Loaded ${list.length} photo${list.length > 1 ? 's' : ''}. Drag inside a panel to position it.`);
}

function applySize(next) {
  size = next;
  canvas.width = size.w;
  canvas.height = size.h;
  document.querySelectorAll('#sizeRow button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.size === size.id));
  });
  redraw();
}

function exportPNG() {
  const out = renderCoverToCanvas(size.w, size.h, state, photoMap);
  out.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — the canvas could not make a PNG.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-cover-${size.id}.png (${Math.round(blob.size / 1024)} KB).`);
  }, 'image/png');
}

function shuffleLook() {
  commit();
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  const [title, subtitle] = SHUFFLE_TITLES[Math.floor(Math.random() * SHUFFLE_TITLES.length)];
  state.title = title;
  state.subtitle = subtitle;
  selected = 0;
  syncControls();
  redraw();
  setStatus('Shuffled to a new look — export it or shuffle again.');
}

// --- Build the control rows -------------------------------------------------

Object.entries(LAYOUTS).forEach(([id, def]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = def.label;
  b.dataset.layout = id;
  b.setAttribute('aria-pressed', String(id === state.layout));
  b.addEventListener('click', () => {
    if (state.layout === id) return;
    commit();
    state.layout = id;
    selected = 0;
    syncControls();
    redraw();
  });
  $('layoutRow').appendChild(b);
});

Object.entries(GRADES).forEach(([id, def]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = def.label;
  b.dataset.grade = id;
  b.setAttribute('aria-pressed', String(id === state.grade));
  b.addEventListener('click', () => {
    if (state.grade === id) return;
    commit();
    state.grade = id;
    syncControls();
    redraw();
  });
  $('gradeRow').appendChild(b);
});

SIZES.forEach((s) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s.label;
  b.dataset.size = s.id;
  b.setAttribute('aria-pressed', String(s.id === size.id));
  b.addEventListener('click', () => applySize(s));
  $('sizeRow').appendChild(b);
});

SAMPLES.forEach((sample) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = 'Use the ' + sample.label + ' sample photo';
  b.setAttribute('aria-pressed', 'false');
  const img = document.createElement('img');
  img.src = sample.src;
  img.alt = sample.label + ' sample photo';
  b.appendChild(img);
  b.addEventListener('click', async () => {
    await setPanelPhoto(selected, sample.id);
    setStatus(`Panel ${selected + 1} is now the ${sample.label} sample. Upload your own photo to replace it.`);
  });
  $('thumbs').appendChild(b);
});

// --- Wire the inputs ---------------------------------------------------------

$('photos').addEventListener('change', (e) => {
  addUploads(e.target.files);
  e.target.value = '';
});
$('fillAll').addEventListener('click', async () => {
  const current = state.panels[selected] && state.panels[selected].photo;
  if (!current) { setStatus('Pick a photo for a panel first, then Fill all copies it everywhere.'); return; }
  commit();
  for (let i = 0; i < activePanelCount(); i++) {
    state.panels[i] = { photo: current, zoom: 1, ox: 0, oy: 0 };
  }
  redraw();
  setStatus('One photo now fills every panel.');
});
$('clearPhotos').addEventListener('click', () => {
  commit();
  state.panels = state.panels.map(() => ({ photo: null, zoom: 1, ox: 0, oy: 0 }));
  redraw();
  setStatus('Photos cleared — the cover falls back to procedural sunset art.');
});
$('panelPick').addEventListener('change', (e) => {
  selected = Number(e.target.value);
  syncControls();
});
function bindPanelSlider(id, key) {
  const el = $(id);
  el.addEventListener('pointerdown', armHistory);
  el.addEventListener('keydown', armHistory);
  el.addEventListener('input', () => {
    pushArmed();
    const panel = state.panels[selected] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    panel[key] = Number(el.value);
    state.panels[selected] = panel;
    redraw();
  });
  el.addEventListener('change', disarmHistory);
}
bindPanelSlider('zoom', 'zoom');
bindPanelSlider('panX', 'ox');
bindPanelSlider('panY', 'oy');

function bindText(id, key, transform) {
  const el = $(id);
  el.addEventListener('focus', armHistory);
  el.addEventListener('input', () => {
    pushArmed();
    state[key] = transform ? transform(el.value) : el.value;
    redraw();
  });
  el.addEventListener('change', disarmHistory);
}
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');
$('stars').addEventListener('change', (e) => {
  commit();
  state.stars = Number(e.target.value);
  redraw();
});
$('grain').addEventListener('change', (e) => {
  commit();
  state.grain = e.target.checked;
  redraw();
});
$('vignette').addEventListener('change', (e) => {
  commit();
  state.vignette = e.target.checked;
  redraw();
});
$('export').addEventListener('click', exportPNG);
$('shuffle').addEventListener('click', shuffleLook);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  }
});

// Drag to pan the photo inside its panel; scroll to zoom it.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit < 0) return;
  selected = hit;
  syncControls();
  canvas.setPointerCapture(e.pointerId);
  armHistory();
  drag = { index: hit, x: e.clientX, y: e.clientY, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const box = canvas.getBoundingClientRect();
  const rects = panelRects();
  const r = rects[drag.index];
  const dx = ((e.clientX - drag.x) / box.width) * (canvas.width / r.w);
  const dy = ((e.clientY - drag.y) / box.height) * (canvas.height / r.h);
  if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;
  if (!drag.moved) return;
  pushArmed();
  const panel = state.panels[drag.index] || { photo: null, zoom: 1, ox: 0, oy: 0 };
  panel.ox = Math.max(-0.5, Math.min(0.5, (panel.ox || 0) + dx));
  panel.oy = Math.max(-0.5, Math.min(0.5, (panel.oy || 0) + dy));
  state.panels[drag.index] = panel;
  drag.x = e.clientX;
  drag.y = e.clientY;
  redraw();
  syncControls();
});
canvas.addEventListener('pointerup', () => {
  disarmHistory();
  drag = null;
});
let wheelArmed = false;
canvas.addEventListener('wheel', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit < 0) return;
  e.preventDefault();
  if (!wheelArmed) {
    armHistory();
    wheelArmed = true;
    setTimeout(() => { wheelArmed = false; }, 700);
  }
  pushArmed();
  const panel = state.panels[hit] || { photo: null, zoom: 1, ox: 0, oy: 0 };
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) - Math.sign(e.deltaY) * 0.08));
  state.panels[hit] = panel;
  selected = hit;
  syncControls();
  redraw();
}, { passive: false });
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const hit = panelAt(e.clientX, e.clientY);
  addUploads(e.dataTransfer.files, hit >= 0 ? hit : undefined);
});

// --- Boot --------------------------------------------------------------------

const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  syncControls();
  // runShot changes the state (title, layout, grade, size); mirror those
  // changes back into the controls once the scene is set up.
  runShot(params.get('shot'), params, {
    state,
    applySize,
    setPanelPhoto,
    redraw,
    loadImage,
    photoMap,
    exportPNG,
    setStatus,
  }).then(() => { syncControls(); redraw(); });
} else {
  // Wait for the poster fonts, then draw once with them in place.
  Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('60px Pacifico'),
  ]).catch(() => {}).finally(() => {
    syncControls();
    redraw();
  });
  syncControls();
  redraw();
}

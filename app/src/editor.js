// Vice Cover Studio — the editor.
//
// Owns the cover state, the photo store, undo/redo history and every
// control on the page. It draws through engine.js and exports through the
// same renderCover(), so what the preview shows is what the PNG holds.

import { GRADES, LAYOUTS, renderCover, panelRects } from './engine.js';
import { runShot } from './shots.js';

export const EXPORT_SIZES = [
  { label: '1080 × 1080', w: 1080, h: 1080 },
  { label: '1080 × 1350', w: 1080, h: 1350 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
];

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'VICE CITY',
  subtitle: 'one last score',
  badge: 'EST. 2026',
  stars: 4,
  panels: [],
  selected: 0,
};
const photos = new Map(); // id -> { img, name, url }
let photoSeq = 0;

const past = [];
const future = [];

function panelCount(layout) {
  return LAYOUTS[layout].panels.length;
}

function resetPanels(layout, keepPhotos = true) {
  const old = state.panels;
  const n = panelCount(layout);
  state.panels = Array.from({ length: n }, (_, i) => {
    const prev = keepPhotos ? old[i] : undefined;
    return { photoId: prev?.photoId ?? null, view: { ...(prev?.view ?? { zoom: 1, ox: 0, oy: 0 }) } };
  });
  state.selected = 0;
}

function snapshot() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle,
    badge: state.badge, stars: state.stars,
    panels: state.panels, selected: state.selected,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  syncControls();
}

function commit() {
  past.push(snapshot());
  if (past.length > 60) past.shift();
  future.length = 0;
  updateHistoryButtons();
}

function undo() {
  if (!past.length) return;
  future.push(snapshot());
  restore(past.pop());
  updateHistoryButtons();
  draw();
}

function redo() {
  if (!future.length) return;
  past.push(snapshot());
  restore(future.pop());
  updateHistoryButtons();
  draw();
}

function updateHistoryButtons() {
  $('undo').disabled = past.length === 0;
  $('redo').disabled = future.length === 0;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function addPhoto(img, name) {
  const id = `p${++photoSeq}`;
  photos.set(id, { img, name, url: null });
  return id;
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const id = addPhoto(img, file.name);
    photos.get(id).url = url;
    return id;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  return addPhoto(img, `${name}.jpg`);
}

function draw() {
  renderCover(ctx, canvas.width, canvas.height, state, photos);
  // In cover-shot mode the canvas IS the exported cover: no editor chrome.
  if (!document.body.classList.contains('shot-cover')) highlightSelected();
}

function highlightSelected() {
  const rects = panelRects(canvas.width, canvas.height, state.layout);
  const r = rects[state.selected];
  if (!r) return;
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);
  ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  ctx.restore();
}

function syncControls() {
  $('layout').value = state.layout;
  $('grade').value = state.grade;
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('stars').value = String(state.stars);
  $('starOut').textContent = `${state.stars} / 5`;
  const panel = state.panels[state.selected] ?? { view: { zoom: 1, ox: 0, oy: 0 } };
  $('zoom').value = String(panel.view.zoom);
  $('zoomOut').textContent = `${Math.round(panel.view.zoom * 100)}%`;
  $('panX').value = String(panel.view.ox);
  $('panY').value = String(panel.view.oy);
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
}

function setStatus(text) {
  $('status').textContent = text;
}

function refreshPhotoList() {
  const list = $('photoList');
  list.innerHTML = '';
  for (const [id, p] of photos) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'photo-chip';
    b.textContent = p.name;
    b.title = `Use ${p.name} in the selected panel`;
    b.addEventListener('click', () => {
      commit();
      state.panels[state.selected].photoId = id;
      draw();
      setStatus(`${p.name} is in panel ${state.selected + 1}.`);
    });
    list.appendChild(b);
  }
}

async function exportSize(size, { download = true } = {}) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off.getContext('2d'), size.w, size.h, state, photos);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  if (download) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  return blob;
}

function applyLayout(layout) {
  commit();
  const old = state.panels;
  state.layout = layout;
  resetPanels(layout);
  // Keep photos in the same panel order where the new layout has room.
  state.panels.forEach((p, i) => { p.photoId = old[i]?.photoId ?? null; });
  syncControls();
  draw();
}

function applyGrade(grade) {
  commit();
  state.grade = grade;
  draw();
}

function shuffleLook() {
  commit();
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  resetPanels(state.layout);
  const ids = [...photos.keys()];
  if (ids.length) {
    state.panels.forEach((p, i) => { p.photoId = ids[i % ids.length]; });
  }
  syncControls();
  draw();
  setStatus(`Shuffled: ${LAYOUTS[state.layout].label} · ${GRADES[state.grade].label}.`);
}

// --- Pointer interaction: click a panel to select it, drag to pan, wheel to zoom.
let drag = null;

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function hitPanel(pt) {
  const rects = panelRects(canvas.width, canvas.height, state.layout);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const i = hitPanel(canvasPoint(e));
  if (i < 0) return;
  canvas.setPointerCapture(e.pointerId);
  state.selected = i;
  syncControls();
  draw();
  drag = { start: canvasPoint(e), view: { ...state.panels[i].view }, moved: false };
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const panel = state.panels[state.selected];
  const rects = panelRects(canvas.width, canvas.height, state.layout);
  const r = rects[state.selected];
  const dx = (pt.x - drag.start.x) / r.w;
  const dy = (pt.y - drag.start.y) / r.h;
  if (Math.abs(dx) + Math.abs(dy) > 0.005) drag.moved = true;
  panel.view.ox = Math.max(-0.5, Math.min(0.5, drag.view.ox + dx));
  panel.view.oy = Math.max(-0.5, Math.min(0.5, drag.view.oy + dy));
  draw();
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) commit();
  drag = null;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = hitPanel(canvasPoint(e));
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  const next = panel.view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
  panel.view.zoom = Math.max(1, Math.min(3, next));
  syncControls();
  draw();
}, { passive: false });

// --- Controls.
function buildSelects() {
  for (const [key, label] of Object.entries(LAYOUTS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = `${label.label} (${label.panels.length} panels)`;
    $('layout').appendChild(o);
  }
  for (const [key, g] of Object.entries(GRADES)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = g.label;
    $('grade').appendChild(o);
  }
  for (const s of EXPORT_SIZES) {
    const o = document.createElement('option');
    o.value = `${s.w}x${s.h}`;
    o.textContent = s.label;
    $('exportSize').appendChild(o);
  }
}

$('layout').addEventListener('change', (e) => applyLayout(e.target.value));
$('grade').addEventListener('change', (e) => applyGrade(e.target.value));
$('title').addEventListener('input', (e) => { state.title = e.target.value; draw(); });
$('title').addEventListener('change', () => commit());
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; draw(); });
$('subtitle').addEventListener('change', () => commit());
$('badge').addEventListener('input', (e) => { state.badge = e.target.value; draw(); });
$('badge').addEventListener('change', () => commit());
$('stars').addEventListener('input', (e) => {
  state.stars = Number(e.target.value);
  $('starOut').textContent = `${state.stars} / 5`;
  draw();
});
$('stars').addEventListener('change', () => commit());
$('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].view.zoom = Number(e.target.value);
  $('zoomOut').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  draw();
});
$('zoom').addEventListener('change', () => commit());
$('panX').addEventListener('input', (e) => {
  state.panels[state.selected].view.ox = Number(e.target.value);
  draw();
});
$('panX').addEventListener('change', () => commit());
$('panY').addEventListener('input', (e) => {
  state.panels[state.selected].view.oy = Number(e.target.value);
  draw();
});
$('panY').addEventListener('change', () => commit());

$('photos').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      await addPhotoFile(file);
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  e.target.value = '';
  refreshPhotoList();
  setStatus(`${photos.size} photo(s) loaded. Click one to put it in the selected panel.`);
});

$('fillAll').addEventListener('click', () => {
  const ids = [...photos.keys()];
  if (!ids.length) { setStatus('Load a photo first.'); return; }
  commit();
  const first = ids[0];
  state.panels.forEach((p) => { p.photoId = first; });
  draw();
  setStatus('One photo in every panel. Click a panel, then a photo chip, to vary it.');
});

$('samplePier').addEventListener('click', async () => {
  const id = await loadSample('pier');
  commit();
  state.panels.forEach((p, i) => { if (!p.photoId) p.photoId = id; });
  refreshPhotoList();
  draw();
  setStatus('Sample photo loaded: pier.');
});

$('sampleBoulevard').addEventListener('click', async () => {
  const id = await loadSample('boulevard');
  commit();
  state.panels.forEach((p, i) => { if (!p.photoId) p.photoId = id; });
  refreshPhotoList();
  draw();
  setStatus('Sample photo loaded: boulevard.');
});

$('shuffle').addEventListener('click', shuffleLook);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('export').addEventListener('click', async () => {
  const [w, h] = $('exportSize').value.split('x').map(Number);
  const blob = await exportSize({ w, h });
  setStatus(`Saved vice-cover-${w}x${h}.png (${(blob.size / 1024).toFixed(0)} KiB).`);
});
$('exportAll').addEventListener('click', async () => {
  for (const size of EXPORT_SIZES) await exportSize(size);
  setStatus('Saved all three post sizes.');
});

// --- Boot.
async function boot() {
  buildSelects();
  resetPanels(state.layout, false);
  syncControls();
  updateHistoryButtons();
  try {
    await document.fonts.load(`900 100px Anton`);
    await document.fonts.load(`100px Pacifico`);
  } catch { /* fall back to system fonts; the cover still draws */ }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      loadSample, draw, state, photos, syncControls, refreshPhotoList,
      exportSize, setStatus,
    });
  } else {
    draw();
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
});

boot();

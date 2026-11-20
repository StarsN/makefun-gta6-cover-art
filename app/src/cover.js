// Vice Cover Studio — the cover engine.
//
// Draws a GTA-poster-style cover onto any 2D canvas: a multi-panel grid of
// photos (or procedural sunset art where a panel has no photo yet), a bold
// condensed title in Anton, a neon script subtitle in Pacifico, a badge
// ribbon, a star heat meter, grain and a vignette. Everything is drawn in
// code — no image is fetched, no font leaves app/fonts/.
//
// A cover is described by a plain state object:
//
//   {
//     layout: 'hero' | 'grid9' | 'bleed' | 'tilt',
//     grade:  'sunset' | 'neon' | 'pastel' | 'mono',
//     title: 'SUNSET HEIST', subtitle: 'Vice Coast', badge: 'EST. 2026',
//     stars: 4, grain: true, vignette: true,
//     panels: [{ photo, zoom, ox, oy }, ...]   // photo: id in photoMap or null
//   }
//
// `photoMap` maps a panel's photo id to { img } (an HTMLImageElement that is
// already loaded) or is missing, in which case the panel gets procedural art.

export const SIZES = [
  { id: '1080x1080', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
];

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#ffd166', '#ff7b54', '#ff2e88', '#3b0f54'],
    sun: '#fff3b0',
    sunCore: '#ffdf6b',
    silhouette: '#1c0b2e',
    wash: 'rgba(255, 46, 136, 0.16)',
    washMode: 'overlay',
    titleTop: '#fff7d6',
    titleBottom: '#ffb03a',
    titleStroke: '#1c0b2e',
    accent: '#ff2e88',
    accent2: '#22d3ee',
    band: '#1c0b2e',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#0b1035', '#1b0f4b', '#3b0f54', '#12002e'],
    sun: '#ff5ce1',
    sunCore: '#ff9de2',
    silhouette: '#05010d',
    wash: 'rgba(34, 211, 238, 0.14)',
    washMode: 'overlay',
    titleTop: '#fdf4ff',
    titleBottom: '#ff5ce1',
    titleStroke: '#05010d',
    accent: '#22d3ee',
    accent2: '#ff5ce1',
    band: '#05010d',
  },
  pastel: {
    label: 'Vice Pastel',
    sky: ['#fef3c7', '#ffd6e8', '#a5f3fc', '#fbcfe8'],
    sun: '#fff7d6',
    sunCore: '#fde68a',
    silhouette: '#3b2d5c',
    wash: 'rgba(255, 214, 232, 0.18)',
    washMode: 'soft-light',
    titleTop: '#ffffff',
    titleBottom: '#f9a8d4',
    titleStroke: '#3b2d5c',
    accent: '#ec4899',
    accent2: '#0ea5e9',
    band: '#3b2d5c',
  },
  mono: {
    label: 'Mono Heat',
    sky: ['#e5e5e5', '#a3a3a3', '#525252', '#171717'],
    sun: '#fafafa',
    sunCore: '#ffffff',
    silhouette: '#0a0a0a',
    wash: 'rgba(255, 176, 58, 0.10)',
    washMode: 'overlay',
    titleTop: '#ffffff',
    titleBottom: '#d4d4d4',
    titleStroke: '#0a0a0a',
    accent: '#f59e0b',
    accent2: '#e5e5e5',
    band: '#0a0a0a',
  },
};

export const LAYOUTS = {
  hero: { label: 'Hero + three', panels: 4 },
  grid9: { label: 'Nine-panel grid', panels: 8 },
  bleed: { label: 'Full bleed', panels: 1 },
  tilt: { label: 'Tilted snapshots', panels: 3 },
};

/** Deterministic pseudo-random generator, so a skyline never flickers between redraws. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel rectangles (and the title band) for a layout at W x H. */
export function layoutPanels(w, h, layout) {
  const m = Math.round(w * 0.022); // outer margin
  const g = Math.round(w * 0.012); // gap between panels
  const titleH = Math.round(h * 0.2);
  const top = { x: 0, y: 0, w, h: h - titleH };
  if (layout === 'bleed') {
    return { panels: [{ x: 0, y: 0, w, h, rot: 0 }], title: { x: 0, y: h - titleH, w, h: titleH }, bleed: true };
  }
  if (layout === 'grid9') {
    const cw = (w - m * 2 - g * 2) / 3;
    const ch = (h - m * 2 - g * 2) / 3;
    const panels = [];
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue; // the middle cell is the title block
      const col = i % 3, row = Math.floor(i / 3);
      panels.push({ x: m + col * (cw + g), y: m + row * (ch + g), w: cw, h: ch, rot: 0 });
    }
    return { panels, title: { x: m + cw + g, y: m + ch + g, w: cw, h: ch }, center: true };
  }
  if (layout === 'tilt') {
    // Snapshots float over the sunset; keep their feet clear of the title
    // band (and its stars) below.
    const pw = w * 0.5, ph = (h - titleH) * 0.54;
    const cx = w / 2, cy = (h - titleH) / 2;
    return {
      panels: [
        { x: cx - pw * 0.78, y: cy - ph * 0.66, w: pw, h: ph, rot: -0.1 },
        { x: cx - pw * 0.2, y: cy - ph * 0.46, w: pw, h: ph, rot: 0.06 },
        { x: cx - pw * 0.55, y: cy - ph * 0.08, w: pw * 0.92, h: ph * 0.9, rot: -0.02 },
      ],
      title: { x: 0, y: h - titleH, w, h: titleH },
    };
  }
  // hero: one big panel left, three stacked right, title band below.
  const topH = top.h;
  const heroW = (w - m * 2 - g) * 0.62;
  const sideX = m + heroW + g;
  const sideW = w - m - sideX;
  const smallH = (topH - m * 2 - g * 2) / 3;
  return {
    panels: [
      { x: m, y: m, w: heroW, h: topH - m * 2, rot: 0 },
      { x: sideX, y: m, w: sideW, h: smallH, rot: 0 },
      { x: sideX, y: m + smallH + g, w: sideW, h: smallH, rot: 0 },
      { x: sideX, y: m + smallH * 2 + g * 2, w: sideW, h: smallH, rot: 0 },
    ],
    title: { x: 0, y: h - titleH, w, h: titleH },
  };
}

/** A retro striped sun, the poster's signature. `skyGrad` is the backdrop's
 * own sky gradient, so the stripes show sky through the sun, not holes. */
export function drawSun(ctx, cx, cy, r, grade, seed = 7, skyGrad = null) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  glow.addColorStop(0, grade.sunCore + 'cc');
  glow.addColorStop(1, grade.sunCore + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const body = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  body.addColorStop(0, grade.sun);
  body.addColorStop(1, grade.sunCore);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Cut the lower half into stripes, thicker toward the bottom.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const rnd = mulberry32(seed);
  let y = cy + r * 0.08;
  let thick = r * 0.03;
  ctx.fillStyle = skyGrad || grade.sky[1];
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, thick);
    y += thick + r * 0.11 + rnd() * r * 0.04;
    thick *= 1.5;
  }
  ctx.restore();
}

/** A palm tree silhouette: one curved trunk, six drooping fronds. */
export function drawPalm(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.55, x + s * 0.3, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.3, topY = y - s * 0.95;
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  for (let i = 0; i < 6; i++) {
    const a = (-Math.PI * 0.15) - (i / 5) * Math.PI * 0.75;
    const len = s * (0.42 + (i % 2) * 0.1);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + s * 0.16;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.5, topY - s * 0.12, ex, ey);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(topX, topY, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** A city skyline silhouette with lit windows, drawn along the bottom of a rect. */
export function drawSkyline(ctx, x, y, w, h, color, accent, seed = 11) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.08);
    const bh = h * (0.35 + rnd() * 0.65);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rnd() > 0.6) { // antenna
      ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.12, 2, h * 0.12);
    }
    // A few lit windows.
    ctx.fillStyle = accent;
    const wins = Math.floor(rnd() * 5);
    for (let i = 0; i < wins; i++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.6;
      ctx.fillRect(bx + 3 + rnd() * (bw - 8), y + h - bh + 4 + rnd() * (bh - 10), 3, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    bx += bw + w * 0.008;
  }
  // Palms in front of the towers.
  const palms = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < palms; i++) {
    drawPalm(ctx, x + w * (0.12 + rnd() * 0.76), y + h, h * (0.55 + rnd() * 0.4), color);
  }
}

/** The full procedural backdrop: sky, striped sun, skyline. Used behind the panels and inside empty ones. */
export function drawBackdrop(ctx, x, y, w, h, grade, seed = 3) {
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  drawSun(ctx, x + w * 0.68, y + h * 0.3, Math.min(w, h) * 0.16, grade, seed, sky);
  drawSkyline(ctx, x, y + h * 0.62, w, h * 0.38, grade.silhouette, grade.accent, seed + 5);
}

/** Draws one photo cover-fit into a rect, with the panel's zoom and pan. */
function drawPhotoInto(ctx, rect, img, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * (zoom || 1);
  const dw = iw * base, dh = ih * base;
  const dx = rect.x + (rect.w - dw) / 2 + (ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (oy || 0) * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** The colour grade washed over a finished panel. */
function gradeWash(ctx, rect, grade) {
  ctx.save();
  ctx.globalCompositeOperation = grade.washMode;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  const sheen = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = sheen;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** A panel: photo (or procedural art), grade wash, white poster frame. */
function drawPanel(ctx, rect, panel, photoMap, grade, frameW) {
  // A tilted panel is drawn in its own rotated space; `r` is the rect in
  // that space, `rect` stays in cover space for the frame that follows.
  const r = rect.rot ? { x: 0, y: 0, w: rect.w, h: rect.h } : rect;
  ctx.save();
  if (rect.rot) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(rect.rot);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  }
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const entry = panel && panel.photo ? photoMap.get(panel.photo) : null;
  if (entry && entry.img) {
    drawPhotoInto(ctx, r, entry.img, panel.zoom, panel.ox, panel.oy);
    if (grade === GRADES.mono) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  } else {
    drawBackdrop(ctx, r.x, r.y, r.w, r.h, grade, 3 + Math.round(rect.x));
  }
  gradeWash(ctx, r, grade);
  ctx.restore();
  // Poster frame: a white border with a soft drop shadow.
  ctx.save();
  if (rect.rot) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(rect.rot);
    ctx.translate(-rect.w / 2, -rect.h / 2);
  }
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = frameW * 3;
  ctx.shadowOffsetY = frameW;
  ctx.lineWidth = frameW;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(r.x + frameW / 2, r.y + frameW / 2, r.w - frameW, r.h - frameW);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) { ctx.fill(); } else { ctx.stroke(); }
}

/** The title block: big gradient Anton title, Pacifico subtitle, stars. */
function drawTitleBlock(ctx, rect, state, grade, center) {
  const { title, subtitle, stars } = state;
  const pad = rect.w * 0.04;
  ctx.save();
  if (!center) {
    const scrim = ctx.createLinearGradient(0, rect.y - rect.h * 0.5, 0, rect.y + rect.h);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, grade.band + 'f2');
    ctx.fillStyle = scrim;
    ctx.fillRect(rect.x, rect.y - rect.h * 0.5, rect.w, rect.h * 1.5);
  } else {
    ctx.fillStyle = grade.band;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  const words = (title || 'UNTITLED').trim().toUpperCase();
  const fontFor = (s) => `${s}px Anton, 'Arial Narrow', 'Impact', sans-serif`;
  const fitSize = (text, start) => {
    let s = start;
    ctx.font = fontFor(s);
    while (ctx.measureText(text).width > rect.w - pad * 2 && s > 14) {
      s -= 2;
      ctx.font = fontFor(s);
    }
    return s;
  };
  // One line, sized to the band. In a centre block (the grid's middle
  // cell) a long title would shrink to a whisper, so wrap it over two
  // balanced lines instead when that reads bigger.
  let lines = [words];
  let size = fitSize(words, center ? rect.h * 0.3 : rect.h * 0.5);
  if (center && size < rect.h * 0.22) {
    const parts = words.split(' ');
    if (parts.length > 1) {
      let best = null;
      for (let k = 1; k < parts.length; k++) {
        const a = parts.slice(0, k).join(' ');
        const b = parts.slice(k).join(' ');
        ctx.font = fontFor(100);
        const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (!best || w < best.w) best = { a, b, w };
      }
      if (best) {
        const two = Math.min(fitSize(best.a, rect.h * 0.26), fitSize(best.b, rect.h * 0.26));
        if (two > size) { lines = [best.a, best.b]; size = two; }
      }
    }
  }
  // Title sits in the middle of the band; the subtitle has its own row
  // below it and the stars their own row above it, so nothing overlaps.
  const titleY = center
    ? rect.y + rect.h * (lines.length > 1 ? 0.38 : 0.44)
    : rect.y + rect.h * 0.5;
  const lineH = size * 1.04;
  const firstY = titleY - ((lineH * lines.length) - lineH) / 2;
  lines.forEach((line, li) => {
    const ly = firstY + li * lineH;
    const grad = ctx.createLinearGradient(0, ly - size, 0, ly + size * 0.15);
    grad.addColorStop(0, grade.titleTop);
    grad.addColorStop(1, grade.titleBottom);
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, ly);
    ctx.rotate(-0.02);
    ctx.translate(-(rect.x + rect.w / 2), -ly);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = grade.titleStroke;
    ctx.strokeText(line, rect.x + rect.w / 2, ly);
    ctx.fillStyle = grad;
    ctx.fillText(line, rect.x + rect.w / 2, ly);
    ctx.restore();
  });
  // Script subtitle on its own row under the title.
  if (subtitle && subtitle.trim()) {
    const subSize = center ? rect.h * 0.15 : rect.h * 0.24;
    ctx.font = `${subSize}px Pacifico, 'Segoe Script', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent2;
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = subSize * 0.35;
    const subY = center
      ? rect.y + rect.h * (lines.length > 1 ? 0.74 : 0.72)
      : rect.y + rect.h * 0.88;
    ctx.fillText(subtitle.trim(), rect.x + rect.w / 2, subY);
    ctx.shadowBlur = 0;
  }
  // Heat meter: five stars, filled to `stars`, on their own row above.
  const starR = (center ? rect.h * 0.07 : rect.h * 0.08);
  const starY = center
    ? rect.y + rect.h * (lines.length > 1 ? 0.9 : 0.88)
    : rect.y + rect.h * 0.14;
  const starW = starR * 2.4;
  const startX = rect.x + rect.w / 2 - (starW * 5) / 2 + starR;
  for (let i = 0; i < 5; i++) {
    const cx = startX + i * starW;
    ctx.lineWidth = Math.max(1.5, starR * 0.14);
    ctx.strokeStyle = grade.accent;
    ctx.fillStyle = grade.accent;
    drawStar(ctx, cx, starY, starR, i < (stars || 0));
  }
  ctx.restore();
}

/** The badge ribbon, pinned to the cover's top-left corner. */
function drawBadge(ctx, x, y, text, grade, h) {
  const bH = Math.max(26, Math.round(h * 0.028));
  ctx.save();
  ctx.font = `bold ${Math.max(11, bH * 0.42)}px Anton, sans-serif`;
  const bW = ctx.measureText(text).width + bH * 1.4;
  ctx.translate(x, y);
  ctx.rotate(-0.03);
  ctx.fillStyle = grade.accent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(bW, 0);
  ctx.lineTo(bW - bH * 0.3, bH);
  ctx.lineTo(0, bH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = grade.band;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bW / 2, bH / 2 + 1);
  ctx.restore();
}

// A small seeded noise tile, reused for the grain pass.
let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const nctx = c.getContext('2d');
  const img = nctx.createImageData(128, 128);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 28;
  }
  nctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

/** Draws the whole cover. `photoMap` is a Map from photo id to { img }. */
export function drawCover(ctx, w, h, state, photoMap) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const geo = layoutPanels(w, h, state.layout || 'hero');
  const frameW = Math.max(3, Math.round(w * 0.006));
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, 0, 0, w, h, grade, 3);
  const panels = state.panels || [];
  geo.panels.forEach((rect, i) => {
    drawPanel(ctx, rect, panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0 }, photoMap, grade, frameW);
  });
  drawTitleBlock(ctx, geo.title, state, grade, !!geo.center);
  if (state.badge && state.badge.trim()) {
    drawBadge(ctx, Math.round(w * 0.03), Math.round(h * 0.03), state.badge.trim().toUpperCase(), grade, h);
  }
  if (state.vignette !== false) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // Thin outer frame, the poster's edge.
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** Renders a cover to a fresh offscreen canvas at W x H and returns it. */
export function renderCoverToCanvas(w, h, state, photoMap) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), w, h, state, photoMap);
  return canvas;
}

/** A fresh default state: a hero cover with procedural art everywhere. */
export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    title: 'SUNSET HEIST',
    subtitle: 'Vice Coast',
    badge: 'EST. 2026',
    stars: 4,
    grain: true,
    vignette: true,
    panels: Array.from({ length: 8 }, () => ({ photo: null, zoom: 1, ox: 0, oy: 0 })),
  };
}

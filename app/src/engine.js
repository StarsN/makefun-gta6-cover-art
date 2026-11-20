// Vice Cover Studio — the cover renderer.
//
// Everything here draws with the canvas 2D API and nothing else: no network,
// no library. A cover is a set of photo panels plus procedural Vice City art
// (a striped sunset, a skyline, palms) plus bold lettering, all painted by
// renderCover() at any size, so the editor preview and the PNG export share
// exactly one code path.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#2b1055', '#7597de', '#ff7e5f', '#feb47b'],
    sun: '#ffd319', sunCore: '#fff3b0',
    tint: 'rgba(255, 90, 60, 0.16)',
    title: ['#ffffff', '#ffd319'],
    accent: '#ff2e88',
    ink: '#1c0b2e',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#0f0c29', '#302b63', '#7b2ff7', '#ff2e88'],
    sun: '#00f0ff', sunCore: '#c8fff9',
    tint: 'rgba(120, 40, 255, 0.20)',
    title: ['#ffffff', '#00f0ff'],
    accent: '#ff2e88',
    ink: '#0d0620',
  },
  pastel: {
    label: 'Vice Pastel',
    sky: ['#ffd6e8', '#ffb3c6', '#f7cad9', '#a8e6cf'],
    sun: '#fff176', sunCore: '#fffde7',
    tint: 'rgba(255, 150, 200, 0.14)',
    title: ['#ffffff', '#ff8fab'],
    accent: '#06d6a0',
    ink: '#3d1c2e',
  },
  mono: {
    label: 'Mono Heat',
    sky: ['#0a0a0a', '#2b2b2b', '#5c5c5c', '#9a9a9a'],
    sun: '#f5f5f5', sunCore: '#ffffff',
    tint: 'rgba(0, 0, 0, 0.22)',
    title: ['#ffffff', '#e0e0e0'],
    accent: '#e10600',
    ink: '#000000',
  },
  gold: {
    label: 'Gold Hour',
    sky: ['#1a2a6c', '#b21f1f', '#fdbb2d', '#ffe259'],
    sun: '#ffe259', sunCore: '#fffbe6',
    tint: 'rgba(255, 170, 0, 0.16)',
    title: ['#ffffff', '#ffe259'],
    accent: '#e8890c',
    ink: '#241703',
  },
};

// Panel layouts. Each panel is a rectangle in cover fractions, with an
// optional rotation (tilt) and a title zone in the same fractions.
export const LAYOUTS = {
  hero: {
    label: 'Hero + three',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.60 },
      { x: 0, y: 0.62, w: 0.32, h: 0.38 },
      { x: 0.34, y: 0.62, w: 0.32, h: 0.38 },
      { x: 0.68, y: 0.62, w: 0.32, h: 0.38 },
    ],
    title: { x: 0.04, y: 0.44, w: 0.92, h: 0.16, align: 'left' },
  },
  grid9: {
    label: 'Nine-panel grid',
    panels: [
      { x: 0, y: 0, w: 0.32, h: 0.32 }, { x: 0.34, y: 0, w: 0.32, h: 0.32 }, { x: 0.68, y: 0, w: 0.32, h: 0.32 },
      { x: 0, y: 0.34, w: 0.32, h: 0.32 }, /* centre is the title block */ { x: 0.68, y: 0.34, w: 0.32, h: 0.32 },
      { x: 0, y: 0.68, w: 0.32, h: 0.32 }, { x: 0.34, y: 0.68, w: 0.32, h: 0.32 }, { x: 0.68, y: 0.68, w: 0.32, h: 0.32 },
    ],
    title: { x: 0.34, y: 0.34, w: 0.32, h: 0.32, align: 'center', block: true },
  },
  bleed: {
    label: 'Full bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
    title: { x: 0.05, y: 0.72, w: 0.9, h: 0.22, align: 'left' },
  },
  tilt: {
    label: 'Tilted snapshots',
    panels: [
      { x: 0.03, y: 0.18, w: 0.60, h: 0.56, rot: -8 },
      { x: 0.36, y: 0.30, w: 0.60, h: 0.56, rot: 3 },
      { x: 0.10, y: 0.50, w: 0.60, h: 0.48, rot: 7 },
    ],
    title: { x: 0.05, y: 0.02, w: 0.9, h: 0.14, align: 'left' },
  },
  strip: {
    label: 'Film strip',
    panels: [
      { x: 0, y: 0, w: 0.19, h: 0.78 }, { x: 0.2025, y: 0, w: 0.19, h: 0.78 },
      { x: 0.405, y: 0, w: 0.19, h: 0.78 }, { x: 0.6075, y: 0, w: 0.19, h: 0.78 },
      { x: 0.81, y: 0, w: 0.19, h: 0.78 },
    ],
    title: { x: 0.04, y: 0.80, w: 0.92, h: 0.18, align: 'center' },
  },
};

/** A small deterministic PRNG so the same panel always draws the same skyline. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** A retro sun: a disc with horizontal slits cut out of its lower half. */
function drawSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grade.sun;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.05;
  let gap = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap + r * 0.11;
    gap *= 1.35;
  }
  ctx.restore();
  const core = ctx.createRadialGradient(cx, cy - r * 0.25, r * 0.05, cx, cy, r * 0.9);
  core.addColorStop(0, grade.sunCore);
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A skyline silhouette with a few lit windows, drawn from a seeded RNG. */
function drawSkyline(ctx, x, y, w, h, grade, seed) {
  const rnd = seededRandom(seed);
  ctx.fillStyle = grade.ink;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.09);
    const bh = h * (0.25 + rnd() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rnd() > 0.6) { // rooftop antenna
      ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.12, 2, h * 0.12);
    }
    ctx.fillStyle = 'rgba(255, 220, 130, 0.85)';
    for (let wy = y + h - bh + 4; wy < y + h - 4; wy += 9) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 8) {
        if (rnd() > 0.72) ctx.fillRect(wx, wy, 3, 4);
      }
    }
    ctx.fillStyle = grade.ink;
    bx += bw + w * 0.008;
  }
}

/** A palm silhouette: a leaning trunk and six drooping fronds. */
function drawPalm(ctx, x, y, s, lean, grade) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = grade.ink;
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.08, -s * 0.55, s * 0.22, -s * 0.95);
  ctx.stroke();
  const tx = s * 0.22, ty = -s * 0.95;
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.08 + i * 0.16);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + Math.cos(a) * s * 0.42, ty - Math.sin(a) * s * 0.30,
      tx + Math.cos(a) * s * 0.62, ty + s * 0.16,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Procedural Vice City art for a panel with no photo: sky, sun, skyline, palms. */
export function drawScene(ctx, rect, grade, seed) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  skyGradient(ctx, x, y, w, h, grade.sky);
  // The sun drifts across the panel with the seed, so empty panels differ.
  drawSun(ctx, x + w * (0.30 + ((seed % 7) / 7) * 0.45), y + h * 0.42, Math.min(w, h) * 0.30, grade);
  drawSkyline(ctx, x, y + h * 0.62, w, h * 0.38, grade, seed);
  drawPalm(ctx, x + w * 0.10, y + h, Math.min(w, h) * 0.42, -0.10, grade);
  drawPalm(ctx, x + w * 0.92, y + h, Math.min(w, h) * 0.34, 0.14, grade);
  ctx.restore();
}

/** Draws a photo into a panel, cover-fit, with zoom and pan offsets. */
function drawPhoto(ctx, rect, photo, view) {
  const { x, y, w, h } = rect;
  const zoom = view?.zoom ?? 1;
  const ox = view?.ox ?? 0;
  const oy = view?.oy ?? 0;
  const base = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * zoom;
  const pw = photo.naturalWidth * base;
  const ph = photo.naturalHeight * base;
  ctx.drawImage(photo, x + (w - pw) / 2 + ox * w, y + (h - ph) / 2 + oy * h, pw, ph);
}

function drawPanel(ctx, rect, panel, photo, grade, seed) {
  const { x, y, w, h, rot = 0 } = rect;
  ctx.save();
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  } else {
    ctx.translate(x, y);
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const local = { x: 0, y: 0, w, h };
  if (photo) drawPhoto(ctx, local, photo, panel.view);
  else drawScene(ctx, local, grade, seed + 7);
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // A thin white frame makes the panels read as a poster grid.
  ctx.save();
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
  } else {
    ctx.translate(x, y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.008);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
}

function fitFont(ctx, text, font, maxWidth, startSize) {
  let size = startSize;
  ctx.font = font(size);
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function drawStar(ctx, cx, cy, r, filled, grade) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? grade.accent : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.restore();
}

/** The lettering: gradient Anton title with a hard outline, Pacifico subtitle,
 *  an EST. badge ribbon and a five-star heat meter. */
function drawLettering(ctx, zone, state, grade, w, h) {
  const zx = zone.x * w, zy = zone.y * h, zw = zone.w * w, zh = zone.h * h;
  const cx = zone.align === 'center' ? zx + zw / 2 : zx;
  ctx.textBaseline = 'alphabetic';
  if (zone.block) {
    ctx.fillStyle = 'rgba(12, 6, 24, 0.88)';
    ctx.fillRect(zx, zy, zw, zh);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(2, zh * 0.02);
    ctx.strokeRect(zx, zy, zw, zh);
  }
  const title = (state.title || '').trim().toUpperCase();
  // The badge sits at the zone's top right (left-aligned titles) or top
  // centre; measure it first so a long title stops short of it.
  const badge = (state.badge || '').trim();
  let badgeW = 0;
  if (badge) {
    const bs0 = Math.max(10, zh * 0.13);
    ctx.font = `bold ${bs0}px 'Arial Narrow', sans-serif`;
    badgeW = ctx.measureText(badge).width + bs0 * 1.6;
  }
  const titleMax = zone.align === 'center' || !badge
    ? zw * 0.96
    : Math.max(zw * 0.4, zw - badgeW - zw * 0.04);
  const titleSize = fitFont(
    ctx, title || 'VICE',
    (s) => `900 ${s}px Anton, 'Arial Narrow', sans-serif`,
    titleMax, zh * 0.52,
  );
  const titleY = zy + zh * 0.52;
  const grad = ctx.createLinearGradient(0, zy + zh * 0.08, 0, titleY + titleSize * 0.2);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(1, grade.title[1]);
  ctx.textAlign = zone.align === 'center' ? 'center' : 'left';
  ctx.font = `900 ${titleSize}px Anton, 'Arial Narrow', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = grade.ink;
  ctx.lineWidth = Math.max(2, titleSize * 0.09);
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleY);

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = fitFont(
      ctx, sub,
      (s) => `${s}px Pacifico, cursive`,
      zw * 0.9, zh * 0.22,
    );
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = subSize * 0.18;
    ctx.fillText(sub, cx, zy + zh * 0.86);
    ctx.shadowBlur = 0;
  }
  // Badge ribbon: at the top of the title zone, clear of the title glyphs —
  // right-aligned when the title is left-aligned, centred otherwise.
  if (badge) {
    const bs = Math.max(10, zh * 0.13);
    ctx.font = `bold ${bs}px 'Arial Narrow', sans-serif`;
    const bw = badgeW;
    const bx = zone.align === 'center' ? cx - bw / 2 : zx + zw - bw;
    const by = zy + zh * 0.02;
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bs * 1.7, bs * 0.85);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(badge, bx + bs * 0.8, by + bs * 1.22);
    ctx.textAlign = zone.align === 'center' ? 'center' : 'left';
  }
  if (state.stars > 0) {
    // Sized to fit the zone: the row must stay inside it, not spill over.
    const r = Math.max(4, Math.min(zh * 0.05, zw * 0.079));
    const gap = r * 2.4;
    const total = gap * 4 + r * 2;
    let sx = zone.align === 'center' ? cx - total / 2 + r : zx;
    const sy = zy + zh * 0.94;
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, sx + i * gap, sy, r, i < state.stars, grade);
    }
  }
}

function drawGrain(ctx, w, h, seed) {
  const rnd = seededRandom(seed);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < Math.floor((w * h) / 9000); i++) {
    ctx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
  }
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Paints a whole cover. `state` is the editor state (layout, grade, title,
 * subtitle, badge, stars, panels[{photoId, view}]) and `photos` maps photo
 * ids to records holding the loaded image (`.img`). The same function draws
 * the editor preview and the PNG export, at any pixel size.
 */
export function renderCover(ctx, w, h, state, photos) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((p, i) => {
    const panel = state.panels[i] ?? {};
    // The photo store maps ids to records; the renderer needs the image.
    const photo = panel.photoId ? photos.get(panel.photoId)?.img ?? null : null;
    drawPanel(
      ctx,
      { x: p.x * w, y: p.y * h, w: p.w * w, h: p.h * h, rot: p.rot ?? 0 },
      panel, photo, grade, 1000 + i * 131,
    );
  });
  drawLettering(ctx, layout.title, state, grade, w, h);
  drawGrain(ctx, w, h, 42);
  drawVignette(ctx, w, h);
  ctx.restore();
}

/** Panel rectangles in canvas pixels, for hit-testing pointer input. */
export function panelRects(w, h, layoutName) {
  const layout = LAYOUTS[layoutName] ?? LAYOUTS.hero;
  return layout.panels.map((p) => ({
    x: p.x * w, y: p.y * h, w: p.w * w, h: p.h * h, rot: p.rot ?? 0,
  }));
}

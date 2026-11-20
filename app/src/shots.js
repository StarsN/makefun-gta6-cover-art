// Fixed scenes for screenshots: ?shot=editor shows the app with a sample
// photo loaded; ?shot=cover shows the cover alone, full frame, at the size
// the query names. window.__shotReady is set once the cover is painted, and
// the cover scene also exercises the real PNG export path and reports its
// byte size in the document title, so a headless run can check it.
//
// Query parameters:
//   photo=pier|boulevard   the sample photo (default pier)
//   caption=...            the title (default Sunset Heist)
//   subtitle=...           the script subtitle
//   layout=hero|grid9|bleed|tilt
//   grade=sunset|neon|pastel|mono
//   size=1080x1080|1080x1350|1920x1080
import { SIZES, GRADES, LAYOUTS, renderCoverToCanvas } from './cover.js';

const SAMPLE_IDS = { pier: 'sample:pier', boulevard: 'sample:boulevard' };

function paintWhenReady(api) {
  return new Promise((resolve) => {
    Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('60px Pacifico'),
    ]).catch(() => {}).finally(() => {
      api.redraw();
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

export async function runShot(shot, query, api) {
  const { state } = api;
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = query.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const caption = query.get('caption');
  if (caption) state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle) state.subtitle = subtitle;
  const sizeId = query.get('size');
  const size = SIZES.find((s) => s.id === sizeId) || SIZES[0];
  api.applySize(size);

  const photoId = SAMPLE_IDS[query.get('photo')] || SAMPLE_IDS.pier;
  const otherId = photoId === SAMPLE_IDS.pier ? SAMPLE_IDS.boulevard : SAMPLE_IDS.pier;

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // Fill the panels with the two samples, alternating, so every panel
    // shows a photo and the cover reads as a finished poster.
    for (let i = 0; i < state.panels.length; i++) {
      state.panels[i] = { photo: i % 2 === 0 ? photoId : otherId, zoom: 1, ox: 0, oy: 0 };
    }
    await Promise.all([api.loadImage('./samples/pier.jpg'), api.loadImage('./samples/boulevard.jpg')])
      .then(([pier, boulevard]) => {
        api.photoMap.set(SAMPLE_IDS.pier, { img: pier, label: 'Pier' });
        api.photoMap.set(SAMPLE_IDS.boulevard, { img: boulevard, label: 'Boulevard' });
      })
      .catch(() => {});
    await paintWhenReady(api);
    // Exercise the real export path: render the cover offscreen at
    // 1080x1080 and turn it into a PNG blob, as the Export button does.
    const offscreen = renderCoverToCanvas(1080, 1080, state, api.photoMap);
    const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
    const anton = document.fonts.check('100px Anton');
    const pacifico = document.fonts.check('60px Pacifico');
    document.title = `shot-ok export=${blob ? blob.size : 0}B anton=${anton} pacifico=${pacifico}`;
    window.__shotReady = true;
    return;
  }

  // shot=editor (and anything else): the editor with one photo loaded.
  await api.setPanelPhoto(0, photoId);
  await paintWhenReady(api);
  window.__shotReady = true;
}

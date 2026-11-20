// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows the cover alone at the screenshot size.
// `photo` picks the sample, `layout`, `grade`, `title` and `subtitle` pick
// the look, `w`/`h` size the cover. window.__shotReady is set once painted.
// In cover mode the scene also runs the real export path (render + toBlob)
// and reports it in window.__shotInfo, so the screenshot proves the export.

export async function runShot(shot, query, api) {
  const photo = query.get('photo') ?? 'pier';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  const title = query.get('title') ?? 'VICE CITY';
  const subtitle = query.get('subtitle') ?? 'one last score';

  const id = await api.loadSample(photo);
  api.state.layout = layout;
  api.state.grade = grade;
  api.state.title = title;
  api.state.subtitle = subtitle;
  api.state.panels.forEach((p) => { p.photoId = id; });
  api.syncControls();
  api.refreshPhotoList();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const w = Number(query.get('w') ?? 1080);
    const h = Number(query.get('h') ?? 1080);
    const canvas = document.getElementById('stage');
    canvas.width = w;
    canvas.height = h;
    api.draw();
    // Exercise the real export path and report it.
    const blob = await api.exportSize({ w, h }, { download: false });
    window.__shotInfo = `shot-ok export=${(blob.size / 1024).toFixed(0)}KiB ${w}x${h}`;
  } else {
    api.draw();
  }
  api.setStatus('');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

import { App } from './App.js';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  document.getElementById('nogl').hidden = false;
  document.getElementById('loader')?.remove();
  document.body.classList.remove('is-loading');
} else {
  const app = new App(document.getElementById('stage'));
  app.init().catch((err) => {
    console.error('[specimen] failed to start', err);
    document.getElementById('nogl').hidden = false;
  });
  // Free GPU memory when the page is really going away (not on bfcache).
  addEventListener('pagehide', (e) => { if (!e.persisted) app.dispose(); });
  window.__specimen = app;
}

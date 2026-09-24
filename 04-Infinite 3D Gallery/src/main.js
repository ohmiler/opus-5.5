import { hasWebGL } from './utils/env.js';
import { projects } from './gallery/projects.js';

const $ = (s) => document.querySelector(s);

// No WebGL (or a module failed): present the archive as an editorial list.
function fallback(reason) {
  console.warn('[gallery] fallback:', reason);
  document.documentElement.classList.add('is-fallback');
  $('#loader')?.remove();
  const list = $('#fallback-list');
  list.innerHTML = projects
    .map(
      (p, i) => `
      <li>
        <span class="fb-swatch" style="--a:${p.palette[1]};--b:${p.palette[3]}"></span>
        <span class="fb-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="fb-title">${p.title}</span>
        <span class="fb-meta">${p.discipline} — ${p.year}</span>
        <p class="fb-desc">${p.description}</p>
      </li>`
    )
    .join('');
  $('#fallback').hidden = false;
}

async function boot() {
  if (!hasWebGL()) return fallback('webgl unavailable');
  try {
    const { App } = await import('./App.js');
    const app = new App({
      root: document.documentElement,
      stage: $('#stage'),
      loader: $('#loader'),
      cursor: $('#cursor'),
      hud: $('#hud'),
      detail: $('#detail'),
    });
    window.__gallery = app; // handy for debugging; harmless in production
    await app.start();
  } catch (err) {
    console.error(err);
    fallback(err.message);
  }
}

boot();

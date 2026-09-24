import { Loader } from './ui/Loader.js';
import { Hud } from './ui/Hud.js';
import { Narrative } from './ui/Narrative.js';
import { splitText } from './ui/splitText.js';
import { EventBus } from './core/EventBus.js';
import { SoundDesign } from './audio/SoundDesign.js';
import { detectDevice, supportsWebGL2 } from './utils/device.js';
import { CHAPTERS } from './config/chapters.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Yield so the loader can paint — but don't stall in a background tab, where rAF is paused.
const nextFrame = () => new Promise((r) => {
  requestAnimationFrame(() => r());
  setTimeout(r, 50);
});

const device = detectDevice();
const bus = new EventBus();
const sound = new SoundDesign(bus);
const loader = new Loader($('#loader'));
const hud = new Hud(CHAPTERS.length);

// Split headlines before anything measures the layout.
const lensGroups = [...document.querySelectorAll('[data-split]')].map((host) => ({
  host,
  chars: splitText(host),
  lens: host.hasAttribute('data-lens'),
})).filter((g) => g.lens);

const narrative = new Narrative({
  sections: [...document.querySelectorAll('[data-chapter]')],
  chapters: CHAPTERS,
  hud,
  bus,
  reducedMotion: device.reducedMotion,
});

const soundButton = $('[data-sound]');
soundButton.addEventListener('click', async () => {
  const on = await sound.setEnabled(!sound.enabled);
  soundButton.classList.toggle('is-on', on);
  soundButton.setAttribute('aria-pressed', String(on));
  soundButton.querySelector('[data-sound-label]').textContent = on ? 'Sound on' : 'Sound off';
});

async function fontsReady(timeout = 2500) {
  if (!document.fonts?.load) return;
  const faces = ['400 1em "Instrument Serif"', 'italic 400 1em "Instrument Serif"', '400 1em "JetBrains Mono"'];
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}), wait(timeout)]);
}

function enter() {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  narrative.measure();
  narrative.startReveals();
}

async function boot() {
  const started = performance.now();

  loader.set(0.06, 'Loading typography');
  await fontsReady();
  if (!supportsWebGL2()) throw new Error('WebGL 2 is unavailable');

  loader.set(0.28, 'Loading engine');
  const { App } = await import('./App.js');

  loader.set(0.5, 'Preparing simulation');
  await nextFrame();
  const app = new App({ canvas: $('#scene'), cursorEl: $('.cursor'), device, bus, hud, narrative, lensGroups });
  try {
    await app.init((p, label) => loader.set(0.5 + p * 0.48, label));
  } catch (err) {
    app.dispose();
    throw err;
  }

  if (new URLSearchParams(location.search).has('debug')) window.__singularity = app;

  const count = app.count.toLocaleString('en-US');
  document.querySelectorAll('[data-count-bodies]').forEach((el) => (el.textContent = count));

  // Hold the loader long enough to read, never so long it feels slow.
  await wait(Math.max(0, (device.reducedMotion ? 300 : 1400) - (performance.now() - started)));
  await loader.finish();
  app.start();
  document.body.classList.add('is-experience');
  enter();
}

boot().catch(async (err) => {
  console.warn('[singularity] Falling back to static layout:', err);
  document.body.classList.add('is-fallback');
  await loader.finish();
  enter();
});

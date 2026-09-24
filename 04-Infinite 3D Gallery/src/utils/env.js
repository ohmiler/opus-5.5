// Runtime capability / preference detection. Read once, re-read on change.

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = window.matchMedia('(pointer: coarse)');

export const env = {
  reducedMotion: mqReduced.matches,
  touch: mqCoarse.matches || navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches,
  get compact() {
    return window.innerWidth < 760;
  },
  // Keep fill-rate sane on high density screens; mobile gets a lower cap.
  get pixelRatio() {
    const cap = this.touch ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, cap);
  },
};

mqReduced.addEventListener('change', (e) => {
  env.reducedMotion = e.matches;
  document.documentElement.classList.toggle('reduced-motion', e.matches);
});
document.documentElement.classList.toggle('reduced-motion', env.reducedMotion);
document.documentElement.classList.toggle('is-touch', env.touch);

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// Input modality: lets us restore focus for keyboard users without
// surfacing focus UI for pointer users.
env.keyboard = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') env.keyboard = true;
}, true);
window.addEventListener('pointerdown', () => (env.keyboard = false), true);

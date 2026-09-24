import { damp } from '../utils/math.js';
import { env } from '../utils/env.js';

// Loading sequence: a counter that eases toward real progress (fonts,
// artwork generation, shader compilation), then an exit choreography.
export class Loader {
  constructor(root) {
    this.root = root;
    this.count = root.querySelector('[data-loader-count]');
    this.bar = root.querySelector('[data-loader-bar]');
    this.status = root.querySelector('[data-loader-status]');
    this.target = 0;
    this.value = 0;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
    root.classList.add('is-active');
  }

  set(progress, status) {
    this.target = Math.max(this.target, Math.min(1, progress));
    if (status && this.status.textContent !== status) this.status.textContent = status;
  }

  _tick = (now) => {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.value = damp(this.value, this.target, env.reducedMotion ? 30 : 5, dt);
    if (this.target >= 1 && this.value > 0.995) this.value = 1;
    const pct = Math.round(this.value * 100);
    this.count.textContent = String(pct).padStart(3, '0');
    this.bar.style.transform = `scaleX(${this.value})`;
    this.root.style.setProperty('--progress', this.value);
    if (this.value < 1 || !this._resolve) this._raf = requestAnimationFrame(this._tick);
    else this._resolve();
  };

  // Resolves once the counter lands on 100 and the curtain has lifted.
  finish() {
    this.set(1);
    return new Promise((resolve) => {
      this._resolve = () => {
        this.root.classList.add('is-done');
        const delay = env.reducedMotion ? 250 : 1100;
        setTimeout(() => {
          this.root.classList.add('is-hidden');
          this.root.setAttribute('aria-hidden', 'true');
          resolve();
        }, delay * 0.45);
        setTimeout(() => this.root.remove(), delay + 800);
      };
      // The tick loop calls _resolve once the counter visibly reaches 100.
    });
  }

  fail(message) {
    cancelAnimationFrame(this._raf);
    this.status.textContent = message;
    this.root.classList.add('is-error');
  }
}

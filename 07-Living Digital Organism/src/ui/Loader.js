import { damp } from '../utils/math.js';

/**
 * Progress is driven by real setup stages; the displayed number chases it
 * with inertia so it never jumps, and finish() waits for it to arrive.
 */
export class Loader {
  constructor() {
    this.el = document.getElementById('loader');
    this.num = document.getElementById('loader-num');
    this.bar = document.getElementById('loader-bar');
    this.stage = document.getElementById('loader-stage');
    this.target = 0;
    this.shown = 0;
    this.raf = 0;
    this.last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.shown = damp(this.shown, this.target, 5, dt);
      if (this.target - this.shown < 0.002) this.shown = this.target;
      this.num.textContent = String(Math.round(this.shown * 100)).padStart(3, '0');
      this.bar.style.transform = `scaleX(${this.shown})`;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  async step(progress, label) {
    this.target = Math.max(this.target, progress);
    if (label) this.stage.textContent = label;
    // Yield two frames so the DOM paints before heavy synchronous work.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  async finish() {
    this.target = 1;
    this.stage.textContent = 'specimen stable';
    await new Promise((resolve) => {
      const wait = () => (this.shown >= 1 ? resolve() : requestAnimationFrame(wait));
      wait();
    });
    await new Promise((r) => setTimeout(r, 250));
    cancelAnimationFrame(this.raf);
    this.el.classList.add('is-done');
    this.el.setAttribute('aria-busy', 'false');
    setTimeout(() => this.el.remove(), 1600);
  }
}

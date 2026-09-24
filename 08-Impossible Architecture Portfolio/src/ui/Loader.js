import { damp, nextFrame } from '../utils/math.js';

/** Staged loading sequence with an eased counter. Each step is real work, not a fake timer. */
export class Loader {
  constructor(el) {
    this.el = el;
    this.num = el.querySelector('#loader-num');
    this.bar = el.querySelector('#loader-bar');
    this.label = el.querySelector('#loader-step');
    this.shown = 0;
    this.target = 0;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  tick = (now) => {
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.shown = damp(this.shown, this.target, 5, dt);
    if (this.target - this.shown < 0.002) this.shown = this.target;
    const pct = Math.round(this.shown * 100);
    this.num.textContent = String(pct).padStart(3, '0');
    this.bar.style.transform = `scaleX(${this.shown})`;
    this.raf = requestAnimationFrame(this.tick);
  };

  async step(target, label, work) {
    this.label.textContent = label;
    await nextFrame();
    await work();
    this.target = target;
    const until = performance.now() + 700;
    while (this.target - this.shown > 0.04 && performance.now() < until) await nextFrame();
  }

  async finish() {
    const until = performance.now() + 900;
    while (this.shown < 1 && performance.now() < until) await nextFrame();
    this.label.textContent = 'Enter';
    await new Promise((r) => setTimeout(r, 260));
    this.el.classList.add('is-done');
    await new Promise((r) => setTimeout(r, 700));
    setTimeout(() => {
      cancelAnimationFrame(this.raf);
      this.el.remove();
    }, 900);
  }

  fail(message) {
    this.el.classList.add('is-error');
    this.label.textContent = message;
  }
}

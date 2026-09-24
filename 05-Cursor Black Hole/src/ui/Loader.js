const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Progress is driven by real work (fonts, engine, shader compile) and eased so the counter never
 * jumps or stalls. On finish, the curtain collapses to a point; `finish()` resolves mid-collapse
 * so the scene can bloom out of it.
 */
export class Loader {
  constructor(el) {
    this.el = el;
    this.countEl = el.querySelector('[data-count]');
    this.barEl = el.querySelector('.loader__bar');
    this.stepEl = el.querySelector('[data-step]');
    this.value = 0;
    this.target = 0;
    this._shown = -1;
    this._onComplete = null;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  _tick = (now) => {
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    const gap = this.target - this.value;
    if (gap > 0) {
      this.value = Math.min(this.target, this.value + Math.max(gap * (1 - Math.exp(-4.5 * dt)), 0.12 * dt));
    }
    const shown = Math.floor(this.value * 100 + 1e-6);
    if (shown !== this._shown) {
      this._shown = shown;
      this.countEl.textContent = String(shown).padStart(3, '0');
      this.el.setAttribute('aria-valuenow', shown);
    }
    this.barEl.style.transform = `scaleX(${this.value.toFixed(4)})`;

    if (this._onComplete && this.value >= 1) {
      this._onComplete();
      return;
    }
    this._raf = requestAnimationFrame(this._tick);
  };

  set(progress, label) {
    this.target = Math.max(this.target, Math.min(1, progress));
    if (label) this.stepEl.textContent = label;
  }

  async finish() {
    this.set(1, 'Ready');
    await new Promise((resolve) => (this._onComplete = resolve));
    this.el.classList.add('is-done');
    setTimeout(() => (this.el.hidden = true), 1300);
    await wait(420);
  }
}

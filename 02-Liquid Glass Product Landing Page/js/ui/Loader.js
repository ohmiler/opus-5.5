/** Progress counter with eased catch-up and a clip-path exit. */
export class Loader {
  constructor(el, { reduced = false } = {}) {
    this.el = el;
    this.count = el.querySelector('[data-count]');
    this.bar = el.querySelector('[data-bar]');
    this.reduced = reduced;
    this.target = 0;
    this.value = 0;
    this._resolveFull = null;
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  set(progress) {
    this.target = Math.max(this.target, Math.min(progress, 1));
  }

  _tick() {
    this.value += (this.target - this.value) * (this.reduced ? 0.5 : 0.06);
    if (this.target - this.value < 0.002) this.value = this.target;
    this.count.textContent = Math.round(this.value * 100);
    this.bar.style.transform = `scaleX(${this.value})`;
    if (this.value >= 1 && this._resolveFull) this._resolveFull();
    else this._raf = requestAnimationFrame(this._tick);
  }

  /** Runs to 100, then wipes away. `onExit` fires as the wipe begins. */
  async finish(onExit) {
    this.set(1);
    await new Promise((resolve) => { this._resolveFull = resolve; });
    await new Promise((r) => setTimeout(r, this.reduced ? 0 : 220));
    this.el.classList.add('is-done');
    onExit?.();
    await new Promise((r) => setTimeout(r, this.reduced ? 400 : 1200));
    this.el.remove();
  }
}

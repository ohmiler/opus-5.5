export class Loader {
  constructor() {
    this.el = document.querySelector('.loader');
    this.bar = this.el.querySelector('.loader__bar span');
    this.barWrap = this.el.querySelector('.loader__bar');
    this.status = this.el.querySelector('.loader__status');
    this.pct = this.el.querySelector('.loader__pct');
    this.target = 0;
    this.shown = 0;
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  step(value, label) {
    this.target = Math.max(this.target, value);
    if (label) this.status.textContent = label;
  }

  tick() {
    this.shown += (this.target - this.shown) * 0.08;
    const v = Math.round(this.shown * 100);
    this.bar.style.transform = `scaleX(${this.shown})`;
    this.pct.textContent = String(v).padStart(3, '0');
    this.barWrap.setAttribute('aria-valuenow', v);
    if (this.target >= 1 && this.shown > 0.997) {
      this.pct.textContent = '100';
      this.el.classList.add('is-ready');
      this.el.querySelector('.btn--primary')?.focus({ preventScroll: true });
      return;
    }
    requestAnimationFrame(this.tick);
  }

  fail(message) {
    this.status.textContent = message;
    this.el.querySelector('.loader__actions')?.remove();
    this.el.querySelector('.loader__bar').style.opacity = '0.3';
  }

  /** Resolves when the user chooses how to begin. */
  ready() {
    return new Promise((resolve) => {
      this.el.querySelectorAll('[data-start]').forEach((b) =>
        b.addEventListener('click', () => {
          this.el.classList.add('is-leaving');
          setTimeout(() => this.el.remove(), 1700);
          resolve({ sound: b.dataset.start === 'sound' });
        }, { once: true }),
      );
    });
  }
}

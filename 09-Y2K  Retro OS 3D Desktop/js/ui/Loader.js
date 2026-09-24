import { damp } from '../utils/helpers.js';

const SEGMENTS = 24;

/** Boot screen: eased segmented progress bar, status line and a start gate. */
export class Loader {
  constructor() {
    this.el = document.getElementById('loader');
    this.boot = this.el.querySelector('.boot');
    this.bar = this.el.querySelector('.boot__bar');
    this.msg = document.getElementById('bootMsg');
    this.pct = document.getElementById('bootPct');
    this.bar.innerHTML = '<i></i>'.repeat(SEGMENTS);
    this.cells = [...this.bar.children];
    this.target = 0;
    this.value = 0;
    this.raf = requestAnimationFrame(this.tick.bind(this, performance.now()));
  }

  tick(prev, now) {
    const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000));
    this.value = damp(this.value, this.target, 6, dt);
    const lit = Math.round(this.value * SEGMENTS);
    this.cells.forEach((c, i) => c.classList.toggle('on', i < lit));
    const p = Math.round(this.value * 100);
    this.pct.textContent = p + '%';
    this.bar.setAttribute('aria-valuenow', p);
    this.raf = requestAnimationFrame(this.tick.bind(this, now));
  }

  step(value, message) {
    this.target = Math.max(this.target, value);
    if (message) this.msg.textContent = message;
  }

  /** Resolves with 'sound' or 'silent'. */
  waitForStart() {
    return new Promise((resolve) => {
      const settle = setInterval(() => {
        if (this.value < 0.985) return;
        clearInterval(settle);
        this.msg.textContent = 'Ready.';
        this.boot.classList.add('is-ready');
        const first = this.el.querySelector('[data-boot]');
        first.focus({ preventScroll: true });
        const go = (mode) => { cleanup(); resolve(mode); };
        const onClick = (e) => { const b = e.target.closest('[data-boot]'); if (b) go(b.dataset.boot); };
        const onKey = (e) => { if (e.key === 'Enter' && !e.target.closest('[data-boot]')) go('sound'); };
        const cleanup = () => { this.el.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey); };
        this.el.addEventListener('click', onClick);
        window.addEventListener('keydown', onKey);
      }, 60);
    });
  }

  hide() {
    this.el.classList.add('is-done');
    setTimeout(() => { cancelAnimationFrame(this.raf); this.el.remove(); }, 1300);
  }

  fail(message) {
    this.msg.textContent = message;
  }
}

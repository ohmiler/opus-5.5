import { clamp, damp, lerp } from '../core/math.js';

/**
 * Native scroll in, continuous "story progress" out (0 … count-1),
 * smoothed with inertia. Everything narrative samples from this one value.
 */
export class ScrollDirector {
  constructor({ count, reduced = false, bus }) {
    this.count = count;
    this.bus = bus;
    this.reduced = reduced;
    this.lambda = reduced ? 40 : 4.5;
    this.target = 0;
    this.progress = 0;
    this.index = 0;
    this.max = 1;

    this._read = () => {
      this.target = clamp(window.scrollY / this.max, 0, 1) * (this.count - 1);
    };
    this._measure = () => {
      this.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      this._read();
    };
    window.addEventListener('scroll', this._read, { passive: true });
    window.addEventListener('resize', this._measure);
    this._measure();
  }

  /** How far the smoothed value still lags behind the scroll position. */
  get momentum() {
    return Math.abs(this.target - this.progress);
  }

  update(dt) {
    this.progress = damp(this.progress, this.target, this.lambda, dt);
    if (Math.abs(this.target - this.progress) < 1e-4) this.progress = this.target;
    const index = Math.round(this.progress);
    if (index !== this.index) {
      const direction = Math.sign(index - this.index);
      this.index = index;
      this.bus.emit('section', { index, direction });
    }
  }

  /** Interpolate keyframes with a smootherstep between neighbouring sections. */
  sample(keys) {
    const p = clamp(this.progress, 0, keys.length - 1);
    const i = Math.min(Math.floor(p), keys.length - 2);
    const f = p - i;
    const e = f * f * f * (f * (f * 6 - 15) + 10);
    const a = keys[i];
    const b = keys[i + 1];
    const out = {};
    for (const k in a) out[k] = lerp(a[k], b[k], e);
    return out;
  }

  goTo(index) {
    window.scrollTo({
      top: (index / (this.count - 1)) * this.max,
      behavior: this.reduced ? 'auto' : 'smooth',
    });
  }

  dispose() {
    window.removeEventListener('scroll', this._read);
    window.removeEventListener('resize', this._measure);
  }
}

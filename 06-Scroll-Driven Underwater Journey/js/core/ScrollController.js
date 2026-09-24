import { damp } from '../util.js';

/** Native scroll as input, inertial progress as output. */
export class ScrollController {
  constructor({ reduced }) {
    this.target = 0;
    this.p = 0;
    this.vel = 0;
    this.lambda = reduced ? 10 : 2.6;
    this.read = this.read.bind(this);
    window.addEventListener('scroll', this.read, { passive: true });
    window.addEventListener('resize', this.read);
    this.read();
  }

  read() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  update(dt) {
    const prev = this.p;
    this.p = damp(this.p, this.target, this.lambda, dt);
    this.vel = (this.p - prev) / Math.max(dt, 1e-4);
  }

  dispose() {
    window.removeEventListener('scroll', this.read);
    window.removeEventListener('resize', this.read);
  }
}

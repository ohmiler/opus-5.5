import { clamp, damp } from '../utils/math.js';

/**
 * Virtual scroll with mass: input moves a target, and the current value accelerates
 * toward it with capped speed. Long jumps (nav, "return") glide instead of snapping.
 */
export class ScrollController {
  constructor({ reduced = false } = {}) {
    this.target = 0;
    this.current = 0;
    this.velocity = 0;
    this.locked = false;
    this.setReduced(reduced);
  }

  setReduced(reduced) {
    this.stiffness = reduced ? 6 : 2.6;
    this.accel = reduced ? 14 : 5;
    this.maxSpeed = reduced ? 0.5 : 0.2;
  }

  add(delta) {
    if (this.locked) return;
    this.target = clamp(this.target + delta);
  }

  to(value) {
    this.target = clamp(value);
  }

  update(dt) {
    const desired = clamp((this.target - this.current) * this.stiffness, -this.maxSpeed, this.maxSpeed);
    this.velocity = damp(this.velocity, desired, this.accel, dt);
    this.current = clamp(this.current + this.velocity * dt);
    if (Math.abs(this.target - this.current) < 1e-5 && Math.abs(this.velocity) < 1e-4) {
      this.current = this.target;
      this.velocity = 0;
    }
  }
}

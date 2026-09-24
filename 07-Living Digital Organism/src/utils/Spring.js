/** Critically/under-damped scalar spring — gives motion real momentum and overshoot. */
export class Spring {
  constructor(value = 0, { stiffness = 120, damping = 14 } = {}) {
    this.x = value; this.v = 0; this.target = value;
    this.k = stiffness; this.c = damping;
  }
  impulse(v) { this.v += v; }
  update(dt) {
    // Sub-step for stability on long frames.
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

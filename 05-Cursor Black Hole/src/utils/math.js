export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing toward `b`. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

const SUBSTEP = 1 / 120;

/** Damped harmonic spring, sub-stepped so large frame gaps stay stable. */
export class Spring {
  constructor(value = 0, stiffness = 170, damping = 26) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(dt) {
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

export class SpringVec3 {
  constructor(value = [0, 0, 0], stiffness = 170, damping = 26) {
    this.axes = value.map((v) => new Spring(v, stiffness, damping));
    this.value = [...value];
  }

  setTarget(t) {
    for (let i = 0; i < 3; i++) this.axes[i].target = t[i];
  }

  update(dt) {
    for (let i = 0; i < 3; i++) this.value[i] = this.axes[i].update(dt);
    return this.value;
  }
}

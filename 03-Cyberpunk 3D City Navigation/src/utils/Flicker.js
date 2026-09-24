// Neon tube behaviour: steady hum, occasional dips, broken tubes, ignition stutter.
// Returns a multiplier in [0, 1]. Disabled entirely under reduced motion (flashing safety).
export class Flicker {
  constructor(mode = 'steady', seed = Math.random()) {
    this.mode = mode;
    this.seed = seed;
    this.value = 1;
    this.cooldown = 1 + seed * 4;
    this.dip = 0;
    this.ignition = 0;
  }

  ignite(duration = 0.42) {
    this.ignition = duration;
  }

  update(dt, t, reducedMotion) {
    if (reducedMotion) {
      this.ignition = 0;
      return (this.value = 1);
    }

    let v = 1;

    if (this.mode !== 'none') {
      // subtle mains hum
      v -= 0.035 * (0.5 + 0.5 * Math.sin(t * 50 + this.seed * 20));

      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        if (this.mode === 'broken') {
          this.dip = 0.05 + Math.random() * 0.5;
          this.cooldown = 0.4 + Math.random() * 2.5;
        } else if (this.mode === 'buzz') {
          this.dip = 0.04 + Math.random() * 0.12;
          this.cooldown = 3 + Math.random() * 7;
        } else {
          this.dip = Math.random() < 0.35 ? 0.05 : 0;
          this.cooldown = 6 + Math.random() * 12;
        }
      }
      if (this.dip > 0) {
        this.dip -= dt;
        // square-wave stutter while dipping
        const on = Math.sin(t * 90 + this.seed * 10) > (this.mode === 'broken' ? 0.1 : 0.6);
        v *= on ? 0.55 : 0.04;
      }
    }

    if (this.ignition > 0) {
      this.ignition -= dt;
      const on = Math.sin(t * 70) > -0.2 ? 1 : 0.12;
      v *= this.ignition > 0.12 ? on : 1;
    }

    return (this.value = v);
  }
}

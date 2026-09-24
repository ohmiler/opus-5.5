/**
 * Tiny 1D gradient noise for CPU-side drift (breath rate, genome wander…).
 * Each channel gets its own permutation so parameters never move in lockstep.
 */
export class Noise1D {
  constructor(rand) {
    this.g = new Float32Array(256).map(() => rand() * 2 - 1);
  }
  at(x) {
    const i = Math.floor(x), f = x - i;
    const g0 = this.g[i & 255], g1 = this.g[(i + 1) & 255];
    const u = f * f * (3 - 2 * f);
    return (g0 * f * (1 - u) + g1 * (f - 1) * u) * 2.2; // ≈ [-1, 1]
  }
}

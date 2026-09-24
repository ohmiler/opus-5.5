// Small, allocation-free math helpers shared across the experience.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const mod = (n, m) => ((n % m) + m) % m;

// Frame-rate independent exponential smoothing.
// `lambda` is roughly "how many times per second we close the gap".
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

// Easing curves tuned for camera work: slow departure, long confident arrival.
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Asymmetric in-out: short wind-up, long settle. Reads as a physical camera.
  cinematic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.3
      ? 0.3 * Math.pow(t / 0.3, 3)
      : 0.3 + 0.7 * (1 - Math.pow(1 - (t - 0.3) / 0.7, 4));
  },
};

// Deterministic PRNG so the composition is identical on every visit.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pad = (n, size = 2) => String(n).padStart(size, '0');

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (v - a) / (b - a)
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v), 0, 1))
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Frame-rate independent exponential smoothing.
 * `lambda` is roughly "how many times per second the gap closes by ~63%".
 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

export const dampVec3 = (v, target, lambda, dt) => {
  const t = 1 - Math.exp(-lambda * dt)
  v.x += (target.x - v.x) * t
  v.y += (target.y - v.y) * t
  v.z += (target.z - v.z) * t
  return v
}

/** Deterministic PRNG so the universe is identical on every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Approximate gaussian from a uniform generator. */
export const gaussian = (rand) => (rand() + rand() + rand() + rand() - 2) / 2

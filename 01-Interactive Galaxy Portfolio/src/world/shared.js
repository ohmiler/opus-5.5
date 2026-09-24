/**
 * Uniform objects shared by reference across many materials, so a single
 * write per frame updates every shader that uses them.
 */
export const shared = {
  uTime: { value: 0 },
  uPointScale: { value: 1 },
  uDpr: { value: 1 },
}

/** Galaxy geometry. Planets sit on arm 0 of the same spiral the dust follows. */
export const galaxy = {
  radius: 64,
  arms: 3,
  twist: 0.085,
  seed: 1977,
}

export const armAngle = (r, arm = 0) => r * galaxy.twist + (arm * Math.PI * 2) / galaxy.arms

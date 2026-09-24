export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const range = (v, a, b) => clamp((v - a) / (b - a));
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
/** Resolves after a paint, or after 60ms if frames are throttled (background tabs). */
export const nextFrame = () => new Promise((r) => {
  const t = setTimeout(r, 60);
  requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); }));
});

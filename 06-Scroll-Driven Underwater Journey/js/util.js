import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential smoothing. */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG so the ocean looks the same on every visit. */
export function rng(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Fog for additive materials: fade toward black instead of toward the fog colour. */
export const ADDITIVE_FOG = /* glsl */ `
#if defined(USE_FOG) && defined(FOG_EXP2)
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  gl_FragColor.rgb *= 1.0 - fogF;
#endif`;

/** Manual fog attenuation for sprites/lines that opt out of scene fog. */
export const fogFade = (dist, density) => Math.exp(-(dist * density) * (dist * density));

export function disposeObject(root) {
  const seen = new Set();
  const disposeTex = (v) => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } };
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      for (const k in m) disposeTex(m[k]);
      if (m.uniforms) for (const k in m.uniforms) disposeTex(m.uniforms[k].value);
      m.dispose();
    }
  });
}

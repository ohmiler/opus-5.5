import { simplex3 } from './noise.js';

export const RIPPLE_COUNT = 4;

/**
 * Surface model, evaluated per vertex on a unit sphere direction `n`:
 *   shape (scroll morph) + breathing noise + pointer bulge + travelling ripples.
 * Normals are rebuilt from the displaced surface by finite differences so
 * refraction and reflections follow every deformation.
 */
export const liquidChunk = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uNoiseAmp;
uniform float uNoiseFreq;
uniform vec3 uMouseDir;
uniform float uMouseStrength;
uniform vec3 uRippleDir[${RIPPLE_COUNT}];
uniform float uRippleAge[${RIPPLE_COUNT}];
uniform float uRippleAmp[${RIPPLE_COUNT}];

${simplex3}

vec3 shapeAt(vec3 n) {
  // 0 — sphere
  vec3 s0 = n;

  // 1 — flattened, gently twisted pebble
  float tw = n.y * 0.9;
  vec3 s1 = vec3(n.x * cos(tw) - n.z * sin(tw), n.y, n.x * sin(tw) + n.z * cos(tw));
  s1 *= vec3(1.22, 0.74, 1.08);

  // 2 — tri-lobed prism
  float a = atan(n.z, n.x);
  float lobes = 1.0 + 0.2 * sin(3.0 * a + n.y * 2.2) * (1.0 - n.y * n.y);
  vec3 s2 = n * lobes * vec3(1.0, 1.08, 1.0);

  // 3 — rising droplet
  vec3 s3 = n;
  float up = smoothstep(-0.3, 1.0, n.y);
  s3.xz *= 1.0 - 0.42 * up * up;
  s3.y = s3.y * 1.18 + 0.06;

  float m = uMorph;
  vec3 p = mix(s0, s1, smoothstep(0.0, 1.0, m));
  p = mix(p, s2, smoothstep(1.0, 2.0, m));
  p = mix(p, s3, smoothstep(2.0, 3.0, m));
  return p;
}

vec3 displace(vec3 n) {
  vec3 p = shapeAt(n);
  float t = uTime;

  // Breathing: two octaves of slow, drifting noise.
  float d = snoise(n * uNoiseFreq + vec3(0.0, t * 0.18, t * 0.11));
  d += 0.5 * snoise(n * uNoiseFreq * 2.1 - vec3(t * 0.12));
  d *= uNoiseAmp;

  // Pointer proximity: the surface reaches toward the hand.
  float md = distance(n, uMouseDir);
  d += uMouseStrength * exp(-md * md * 3.5) * 0.22;

  // Ripples travel along the surface (geodesic distance), losing energy.
  for (int i = 0; i < ${RIPPLE_COUNT}; i++) {
    float age = uRippleAge[i];
    float ang = acos(clamp(dot(n, uRippleDir[i]), -1.0, 1.0));
    float x = ang - age * 1.7;
    float envelope = exp(-x * x * 5.0) * exp(-age * 0.95) * smoothstep(0.0, 0.2, age);
    d += sin(x * 15.0) * envelope * uRippleAmp[i];
  }

  return p + n * d;
}
`;

export const beginNormalChunk = /* glsl */ `
  vec3 bn = normalize(position);
  vec3 dPos = displace(bn);
  vec3 tA = normalize(cross(bn, abs(bn.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tB = normalize(cross(bn, tA));
  const float EPS = 0.012;
  vec3 pA = displace(normalize(bn + tA * EPS));
  vec3 pB = displace(normalize(bn + tB * EPS));
  vec3 objectNormal = normalize(cross(pA - dPos, pB - dPos));
  if (dot(objectNormal, dPos) < 0.0) objectNormal = -objectNormal;
`;

export const beginVertexChunk = /* glsl */ `
  vec3 transformed = dPos;
`;

import { displaceChunk } from './body.glsl.js';

export const filamentVertex = /* glsl */ `
${displaceChunk}
attribute vec3 aRoot;
attribute float aT;
attribute float aRand;
varying float vT;
varying float vRand;
varying float vAlpha;
void main(){
  float f;
  vec3 base = displace(aRoot, f);
  float t = aT;
  float ph = aRand * 61.0;
  // Each filament rides its own current; t along the strand samples a smooth path.
  float s = t * 1.3 - uTime * (0.18 + aRand * 0.12);
  vec3 flow = vec3(
    snoise(vec3(s, ph, 0.0)),
    snoise(vec3(ph, s, 3.1)),
    snoise(vec3(7.3, ph, s)));
  float len = (0.45 + aRand * 1.15) * uReach * (1.0 - clamp(uDefense, 0.0, 1.0) * 0.8) * uBirth;
  len *= 1.0 + uBreath * 0.06;
  vec3 dir = normalize(aRoot + flow * 0.55 * t);
  vec3 p = base + dir * t * len + flow * t * t * 0.45 * len;
  // Curious tips lean toward the cursor.
  vec3 toP = uPointer - p;
  p += toP * t * t * uProx * (0.12 + aRand * 0.3);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vT = t;
  vRand = aRand;
  vAlpha = (1.0 - t) * smoothstep(0.0, 0.08, t) * uBirth;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const filamentFragment = /* glsl */ `
uniform float uTime;
uniform float uDefense;
uniform vec3 uAccent;
varying float vT;
varying float vRand;
varying float vAlpha;
void main(){
  // A pulse of light crawls from root to tip at a per-filament tempo.
  float pulse = smoothstep(0.86, 1.0, sin(vT * 16.0 - uTime * (1.4 + vRand * 1.8) + vRand * 40.0));
  vec3 bone = vec3(0.93, 0.89, 0.84);
  vec3 col = mix(bone * 0.8, uAccent, clamp(vT * 0.8 + pulse + max(uDefense, 0.0), 0.0, 1.0));
  float a = vAlpha * (0.55 + pulse * 0.9);
  gl_FragColor = vec4(col * a, a);
}
`;

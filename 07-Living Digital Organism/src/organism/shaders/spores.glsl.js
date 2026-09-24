import { simplex3 } from './noise.glsl.js';

export const sporeVertex = /* glsl */ `
${simplex3}
uniform float uTime;
uniform float uShock;
uniform float uBirth;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uPointer;
uniform float uProx;
attribute float aRand;
varying float vAlpha;
varying float vRand;
void main(){
  vec3 p = position;
  float t = uTime * 0.05;
  vec3 q = p * 0.35 + aRand * 3.0;
  p += vec3(snoise(q + t), snoise(q + t + 17.0), snoise(q + t + 31.0)) * 0.65;
  float r = max(length(p), 1e-3);
  // Exhalation: defense pushes spores outward, falling off with distance.
  p += (p / r) * uShock * 2.2 / (0.6 + r * 0.5);
  // Wake: spores near the cursor are nudged aside.
  vec3 d = p - uPointer;
  float dl = length(d);
  p += d / (dl + 1e-3) * uProx * 0.35 * exp(-dl * dl * 1.5);
  p *= mix(0.2, 1.0, uBirth);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aRand * 1.7) + aRand * 90.0);
  gl_PointSize = uSize * (0.5 + aRand) * uPixelRatio * (8.0 / -mv.z);
  vAlpha = twinkle * smoothstep(14.0, 3.0, -mv.z) * uBirth;
  vRand = aRand;
  gl_Position = projectionMatrix * mv;
}
`;

export const sporeFragment = /* glsl */ `
uniform vec3 uAccent;
varying float vAlpha;
varying float vRand;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a * vAlpha * 0.6;
  vec3 col = mix(vec3(0.93, 0.89, 0.84), uAccent, step(0.88, vRand));
  gl_FragColor = vec4(col * a, a);
}
`;

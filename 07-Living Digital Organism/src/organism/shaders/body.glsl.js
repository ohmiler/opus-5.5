import { simplex3 } from './noise.glsl.js';

/**
 * Shared morphology. Body, neural lattice and filament roots all call
 * displace() so every layer agrees on where the skin is.
 */
export const organismUniforms = /* glsl */ `
uniform float uTime;
uniform float uBreath;    // -1..1, irregular breathing signal
uniform float uDefense;   // spring value, bristling (can overshoot)
uniform float uBirth;     // 0..1 growth after load
uniform float uProx;      // 0..1 cursor closeness
uniform vec3  uPointer;   // cursor projected into organism space
uniform vec3  uSeed;      // genome: a point in noise space, drifts when idle
uniform float uLobes;     // morph targets (scroll-driven)
uniform float uLobeFreq;
uniform float uCoral;
uniform float uReach;
uniform vec3  uAccent;
`;

export const displaceChunk = /* glsl */ `
${simplex3}
${organismUniforms}

float field(vec3 n){
  float t = uTime;
  // Domain warp: noise bending its own coordinates keeps the form non-periodic.
  vec3 w = n + 0.38 * vec3(
    snoise(n * 0.9 + uSeed + vec3(0.0, t * 0.043, 0.0)),
    snoise(n * 0.9 + uSeed.yzx + vec3(t * 0.037, 0.0, 5.2)),
    snoise(n * 0.9 + uSeed.zxy + vec3(1.7, 0.0, t * 0.051)));
  float lobes  = snoise(w * uLobeFreq + uSeed * 1.3 + t * 0.06);
  float detail = snoise(w * 3.3 - t * 0.09 + uSeed.zxy) * 0.5
               + snoise(w * 7.1 + t * 0.13) * 0.18;
  float ridge  = 1.0 - abs(snoise(w * 3.8 + uSeed.yzx + t * 0.02));
  ridge = ridge * ridge * ridge;
  float spikes = pow(max(snoise(n * 6.5 + uSeed * 2.0), 0.0), 1.6);
  return lobes * uLobes + detail * 0.13 + ridge * uCoral + spikes * max(uDefense, 0.0) * 1.1;
}

vec3 displace(vec3 n, out float f){
  f = field(n);
  vec3 pd = normalize(uPointer + vec3(1e-4));
  float facing = dot(n, pd);
  float cone = pow(max(facing, 0.0), 5.0);
  // Shy skin: it dimples away from the cursor, with a ripple spreading outward.
  float ang = acos(clamp(facing, -1.0, 1.0));
  float recoil = -cone * uProx * 0.26
               + sin(ang * 13.0 - uTime * 4.0) * 0.022 * uProx * max(facing, 0.0);
  float r = 1.0 + f * 0.42 + recoil;
  r *= 1.0 + uBreath * 0.055;
  r *= 1.0 - max(uDefense, 0.0) * 0.16;
  return n * r * uBirth;
}
`;

export const bodyVertex = /* glsl */ `
${displaceChunk}
varying vec3 vWorld;
varying vec3 vDir;
varying float vField;
void main(){
  vec3 n = normalize(position);
  float f;
  vec3 p = displace(n, f);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vDir = n;
  vField = f;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const bodyFragment = /* glsl */ `
${simplex3}
${organismUniforms}
varying vec3 vWorld;
varying vec3 vDir;
varying float vField;
void main(){
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 2.6);

  // Veins: thin ridges of noise that slowly migrate across the membrane.
  float v = 1.0 - abs(snoise(vDir * 5.0 + uSeed + vec3(0.0, uTime * 0.04, 0.0)));
  float veins = pow(v, 14.0);
  float cells = snoise(vDir * 22.0 + uTime * 0.07) * 0.5 + 0.5;

  vec3 bone = vec3(0.925, 0.894, 0.84);
  vec3 deep = vec3(0.035, 0.022, 0.02);
  float inner = smoothstep(-0.35, 0.65, vField);
  vec3 col = mix(deep, uAccent * 0.28, inner);
  float glow = 0.55 + uBreath * 0.3 + max(uDefense, 0.0) * 2.0 + uProx * 0.4;
  col += veins * uAccent * glow;
  col += fres * bone * (0.85 + uProx * 0.25);
  col *= 0.82 + cells * 0.22;

  float alpha = clamp(0.62 + fres * 0.4, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export const latticeVertex = /* glsl */ `
${displaceChunk}
varying float vSignal;
varying float vFacing;
void main(){
  vec3 n = normalize(position);
  float f;
  vec3 p = displace(n, f) * 1.035;
  vec4 world = modelMatrix * vec4(p, 1.0);
  // Action potentials: bands of activity travelling across the net along a wandering axis.
  vec3 axis = normalize(vec3(sin(uTime * 0.11 + uSeed.x), cos(uTime * 0.07), sin(uTime * 0.05 + uSeed.z)));
  float wave = sin(dot(n, axis) * 9.0 - uTime * 2.2);
  vSignal = smoothstep(0.93, 1.0, wave) + max(uDefense, 0.0) * 0.8;
  vec3 V = normalize(cameraPosition - world.xyz);
  vFacing = abs(dot(normalize(mat3(modelMatrix) * n), V));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const latticeFragment = /* glsl */ `
uniform vec3 uAccent;
varying float vSignal;
varying float vFacing;
void main(){
  float rim = pow(1.0 - vFacing, 1.5);
  vec3 col = mix(vec3(0.93, 0.89, 0.84) * 0.35, uAccent, clamp(vSignal, 0.0, 1.0));
  float a = 0.05 + rim * 0.16 + vSignal * 0.5;
  gl_FragColor = vec4(col * a, a);
}
`;

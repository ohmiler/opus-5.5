/**
 * Point-sprite shaders. All motion lives on the GPU: the CPU only advances a
 * handful of time uniforms per frame, so particle count has no JS cost.
 *
 * uPointScale = drawingBufferHeight / (2 * tan(fov / 2)), i.e. world units → pixels at distance 1.
 */

const softDisc = /* glsl */ `
float softDisc(vec2 pc) {
  float d = length(pc - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  return a * a;
}
`

/* ---------------------------------------------------------------- Halo -- */
// Gravitational debris: each particle spirals from an outer orbit down to the
// surface, heating up as it falls, then respawns. Hover tightens and speeds
// the whole field (the planet "notices" you).
export const haloVertex = /* glsl */ `
uniform float uTime;
uniform float uOrbitTime;
uniform float uRadius;
uniform float uHover;
uniform float uPointScale;

attribute vec4 aOrbit;  // outer radius factor, base angle, angular speed, swirl over life
attribute vec4 aShape;  // fall rate, phase, size, inclination
attribute float aNode;

varying float vAlpha;
varying float vHeat;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

void main() {
  float life = fract(uTime * aShape.x + aShape.y);
  float fall = pow(life, 1.7);
  float r = uRadius * mix(aOrbit.x, 1.04, fall) * (1.0 - uHover * 0.07);
  float ang = aOrbit.y + uOrbitTime * aOrbit.z + fall * aOrbit.w;

  vec3 pos = vec3(cos(ang) * r, 0.0, sin(ang) * r);
  pos = rotY(aNode) * (rotX(aShape.w * (1.0 - fall * 0.6)) * pos);
  pos.y += sin(ang * 3.0 + aShape.y * 6.2831) * 0.04 * r;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float size = aShape.z * uPointScale / -mv.z;
  gl_PointSize = clamp(size, 1.0, 48.0);
  gl_Position = projectionMatrix * mv;

  vAlpha = smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.86, life) * clamp(size, 0.25, 1.0);
  vHeat = fall;
}
`

export const haloFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uHover;
varying float vAlpha;
varying float vHeat;
${softDisc}
void main() {
  float a = softDisc(gl_PointCoord) * vAlpha;
  vec3 col = mix(uColor * 0.55, uColor * 1.8 + 0.25, vHeat * vHeat);
  gl_FragColor = vec4(col * a * (0.55 + uHover * 0.6), 1.0);
}
`

/* ---------------------------------------------------------------- Dust -- */
// The galaxy disc. Each grain drifts on a tiny private orbit so the arms
// shimmer without the whole structure sliding away from the planets.
export const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uPointScale;
uniform float uMaxSize;
uniform float uNearFade;

attribute vec3 aColor;
attribute float aSize;
attribute vec4 aRand; // phase, drift radius, drift speed, twinkle rate

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 pos = position;
  float a = uTime * aRand.z + aRand.x * 6.2831;
  pos += vec3(cos(a), sin(a * 0.7) * 0.4, sin(a)) * aRand.y;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;
  float size = aSize * uPointScale / dist;
  gl_PointSize = clamp(size, 1.2, uMaxSize);
  gl_Position = projectionMatrix * mv;

  float twinkle = 0.78 + 0.22 * sin(uTime * aRand.w + aRand.x * 40.0);
  vAlpha = twinkle * clamp(size / 1.2, 0.08, 1.0) * smoothstep(uNearFade * 0.25, uNearFade, dist);
  vColor = aColor;
}
`

export const dustFragment = /* glsl */ `
uniform float uSoft;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float hard = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0);
  float soft = exp(-d * d * 4.0) * (1.0 - smoothstep(0.7, 1.0, d));
  float a = mix(hard, soft, uSoft) * vAlpha;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

/* --------------------------------------------------------------- Stars -- */
// Distant background stars: screen-space sized, never attenuated.
export const starsVertex = /* glsl */ `
uniform float uTime;
uniform float uDpr;
attribute vec3 aColor;
attribute vec2 aStar; // size px, twinkle phase
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aStar.x * uDpr;
  vAlpha = 0.65 + 0.35 * sin(uTime * (0.4 + fract(aStar.y * 7.3) * 1.6) + aStar.y * 50.0);
  vColor = aColor;
}
`

export const starsFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
${softDisc}
void main() {
  gl_FragColor = vec4(vColor * softDisc(gl_PointCoord) * vAlpha, 1.0);
}
`

/* ---------------------------------------------------------------- Core -- */
// Galactic core: a camera-facing quad with an HDR centre that feeds the bloom.
export const coreVertex = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`

export const coreFragment = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv) * 2.0;
  float breath = 1.0 + 0.04 * sin(uTime * 0.6);
  float heart = exp(-d * d * 260.0) * 2.6;
  float glow = exp(-d * d * 22.0) * 0.26 * breath;
  float halo = exp(-d * 4.2) * 0.09;
  float streak = exp(-abs(vUv.y) * 160.0) * exp(-abs(vUv.x) * 5.0) * 0.12;
  float i = (heart + glow + halo + streak) * uIntensity * smoothstep(1.0, 0.7, d);
  vec3 col = mix(uColor, vec3(1.0, 0.97, 0.92), clamp(heart, 0.0, 1.0));
  gl_FragColor = vec4(col * i, 1.0);
}
`

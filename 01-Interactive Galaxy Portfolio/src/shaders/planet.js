import { noise } from './noise.js'

/**
 * Procedural planet surface. One shader, five compiled variants selected with
 * a #define (TYPE_GAS, TYPE_MAGMA, TYPE_OCEAN, TYPE_PEARL, TYPE_ICE), so each
 * variant only pays for its own noise.
 *
 * All planets are lit by the galactic core (uLightPos), which keeps the whole
 * system coherent: every world shows its day side toward the centre.
 */
export const planetVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vObj = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const planetFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uHover;
uniform vec3 uLightPos;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uAccent;

varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorldPos;

${noise}

const vec3 SUN = vec3(1.0, 0.93, 0.84);

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 p = vObj;

  float NdL = dot(N, L);
  float diff = smoothstep(-0.12, 0.95, NdL);
  float fres = 1.0 - max(dot(N, V), 0.0);
  vec3 R = reflect(-L, N);

  vec3 albedo = uColorB;
  vec3 emissive = vec3(0.0);
  float spec = 0.0;

#ifdef TYPE_GAS
  float warp = fbm(p * vec3(1.6, 0.5, 1.6) + vec3(0.0, uTime * 0.012, uSeed));
  float turb = fbm(p * vec3(2.5, 12.0, 2.5) + vec3(uTime * 0.018, 0.0, uSeed));
  float lat = p.y + warp * 0.07 + turb * 0.025;
  float bands = sin(lat * 26.0) * 0.5 + 0.5;
  float broad = sin(lat * 7.0 + 1.3) * 0.5 + 0.5;
  float fine = sin(lat * 71.0) * 0.5 + 0.5;
  float t = broad * 0.6 + bands * 0.3 + fine * 0.1;
  vec3 c = mix(uColorA, uColorB, smoothstep(0.15, 0.6, t));
  c = mix(c, uColorC, smoothstep(0.5, 0.95, t) * 0.8);

  // A long-lived storm, swirling with the bands.
  vec3 stormCenter = normalize(vec3(0.62, -0.26, 0.74));
  float sd = distance(p, stormCenter) + turb * 0.05;
  c = mix(c, uColorC * vec3(1.05, 0.82, 0.66), smoothstep(0.22, 0.0, sd) * 0.75);
  c = mix(c, uColorA, smoothstep(0.035, 0.0, abs(sd - 0.2)) * 0.4);

  albedo = c * mix(0.5, 1.0, 1.0 - pow(abs(p.y), 5.0));
  spec = pow(max(dot(R, V), 0.0), 12.0) * 0.08;
#endif

#ifdef TYPE_MAGMA
  float n = fbm(p * 2.4 + uSeed);
  vec3 wp = p * 2.6 + vec3(n * 0.6, uSeed, 0.0);
  // Fissures only open in "active" regions; the rest is cold obsidian.
  float vent = smoothstep(0.05, 0.45, fbm(p * 1.3 + vec3(7.0, uSeed, 3.0)));
  float crack = pow(1.0 - abs(snoise(wp)), 48.0);
  crack += pow(1.0 - abs(snoise(wp * 2.3 + 4.0)), 64.0) * 0.5;
  crack *= vent;
  float heat = pow(1.0 - abs(snoise(wp)), 8.0) * vent;

  albedo = mix(uColorA, uColorB, smoothstep(-0.5, 0.5, n));
  albedo = mix(albedo, uColorC, smoothstep(0.35, 0.7, n) * 0.6);

  float pulse = 0.85 + 0.15 * sin(uTime * 0.9 + n * 9.0);
  emissive = uAccent * crack * 3.2 * pulse * (1.0 + uHover * 0.7);
  emissive += uAccent * vec3(0.8, 0.25, 0.1) * heat * 0.12;
  spec = pow(max(dot(R, V), 0.0), 36.0) * 0.22 * (1.0 - clamp(crack, 0.0, 1.0));
#endif

#ifdef TYPE_OCEAN
  float n = fbm(p * 1.7 + uSeed);
  float land = smoothstep(0.1, 0.15, n);
  vec3 ocean = mix(uColorA, uColorB, smoothstep(-0.55, 0.12, n));
  vec3 ground = mix(vec3(0.13, 0.17, 0.12), vec3(0.4, 0.36, 0.27), smoothstep(0.15, 0.5, n));
  albedo = mix(ocean, ground, land);

  float caps = smoothstep(0.8, 0.9, abs(p.y) + n * 0.12);
  albedo = mix(albedo, vec3(0.88, 0.94, 0.96), caps);

  float cloud = fbm(p * 2.4 + vec3(uTime * 0.01, 0.0, uSeed * 2.0));
  cloud = smoothstep(0.05, 0.55, cloud + snoise(p * 7.0 + uTime * 0.02) * 0.12);
  albedo = mix(albedo, vec3(0.93, 0.96, 0.98), cloud * 0.85);

  spec = pow(max(dot(R, V), 0.0), 46.0) * 1.8 * (1.0 - land) * (1.0 - cloud) * (1.0 - caps);
#endif

#ifdef TYPE_PEARL
  vec3 q = p * 1.35 + uSeed;
  vec3 w = vec3(fbm(q), fbm(q + vec3(5.2, 1.3, 2.8)), fbm(q + vec3(2.2, 7.1, 4.4)));
  float m = fbm(q + w * 1.7 + vec3(0.0, uTime * 0.01, 0.0));
  float ndv = max(dot(N, V), 0.0);
  // Nacre: soft marbling, with thin-film colour living mostly at grazing angles.
  float hue = m * 0.45 + ndv * 0.9 + uTime * 0.01;
  vec3 film = 0.55 + 0.45 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
  vec3 base = mix(uColorB, uColorC, smoothstep(-0.5, 0.5, m));
  albedo = mix(base, film * uColorC, 0.12 + 0.45 * pow(fres, 1.5));
  albedo = mix(albedo, uColorA, smoothstep(0.35, 0.7, abs(w.x)) * 0.2);
  albedo *= 0.82;
  spec = pow(max(dot(R, V), 0.0), 48.0) * 0.3;
#endif

#ifdef TYPE_ICE
  // Pressure plates: domain-warped cells over broad sheets of older, bluer ice.
  float sheet = fbm(p * 2.2 + uSeed);
  vec2 cell = cellular(p * 5.5 + vec3(sheet * 0.9) + uSeed);
  float seam = 1.0 - smoothstep(0.0, 0.045, cell.y - cell.x);
  vec3 base = mix(uColorA, uColorB, smoothstep(-0.55, 0.35, sheet));
  base = mix(base, uColorC, smoothstep(0.1, 0.6, sheet) * 0.55 + cell.x * 0.15);
  albedo = mix(base, uColorC, seam * 0.35) * 0.85;

  vec3 Np = normalize(N + 0.3 * vec3(snoise(p * 9.0), snoise(p * 9.0 + 3.1), snoise(p * 9.0 + 7.7)));
  spec = pow(max(dot(reflect(-L, Np), V), 0.0), 90.0) * 0.9;

  // Frozen seams glow faintly on the night side; light scatters under the crust.
  emissive = uAccent * seam * 0.2 * smoothstep(0.25, -0.5, NdL);
  emissive += uAccent * pow(1.0 - abs(NdL), 7.0) * 0.35;
#endif

  vec3 ambient = uAccent * 0.012 + 0.006;
  vec3 col = albedo * (SUN * diff * 1.12 + ambient) + emissive + SUN * spec * diff;

  // Atmospheric scattering: warm band at the terminator, accent rim on the day side.
  col += uAccent * 0.06 * exp(-pow(NdL * 5.0, 2.0));
  col += uAccent * pow(fres, 3.0) * (0.12 + 0.55 * smoothstep(-0.4, 0.7, NdL)) * (1.0 + uHover * 1.4);
  col *= 1.0 + uHover * 0.08;

  gl_FragColor = vec4(col, 1.0);
}
`

export const atmosphereVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/**
 * Rendered on the back faces of a slightly larger shell, additively.
 * Intensity peaks at the planet limb and fades to zero at the shell edge.
 */
export const atmosphereFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCenter;
uniform vec3 uLightPos;
uniform float uHover;
uniform float uStrength;

varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float limb = clamp(-dot(N, V), 0.0, 1.0);
  float glow = pow(smoothstep(0.0, 0.62, limb), 2.4);

  vec3 L = normalize(uLightPos - uCenter);
  float lit = smoothstep(-0.55, 0.75, dot(normalize(vWorldPos - uCenter), L));

  float intensity = glow * (0.18 + 0.82 * lit) * uStrength * (1.0 + uHover * 0.9);
  gl_FragColor = vec4(uColor * intensity, 1.0);
}
`

/** Planetary ring with radial banding and the planet's shadow cast across it. */
export const ringVertex = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vLocal;

void main() {
  vLocal = position.xy;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec3 uCenter;
uniform vec3 uLightPos;
uniform float uPlanetRadius;
uniform float uInner;
uniform float uOuter;
uniform float uHover;

varying vec3 vWorldPos;
varying vec2 vLocal;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;

  float bands = vnoise(t * 60.0) * 0.6 + vnoise(t * 180.0) * 0.4;
  float density = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.82, t);
  density *= mix(0.25, 1.0, bands);
  density *= 1.0 - smoothstep(0.018, 0.0, abs(t - 0.62)) * 0.9; // Cassini-like gap

  // Planet shadow: does the ray toward the light hit the sphere?
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 oc = vWorldPos - uCenter;
  float b = dot(oc, L);
  float c = dot(oc, oc) - uPlanetRadius * uPlanetRadius;
  float h = b * b - c;
  float shadow = (h > 0.0 && b < 0.0) ? smoothstep(0.0, 0.6, h / (uPlanetRadius * uPlanetRadius)) : 0.0;
  float light = 1.0 - shadow * 0.92;

  vec3 col = mix(uColor, uAccent, bands * 0.35) * (0.25 + 0.95 * light);
  col *= 1.0 + uHover * 0.25;
  float alpha = density * 0.7;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

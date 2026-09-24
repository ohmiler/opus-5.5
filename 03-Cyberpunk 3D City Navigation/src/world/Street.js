import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { LAYERS, STREET } from '../config.js';
import { NOISE, NEON_LIGHTS } from './shaders/chunks.js';

// Wet asphalt: planar reflection (layer-filtered, low-res) smeared & rippled by rain,
// plus neon light pools and street-lamp pools computed analytically.
export class Street {
  constructor({ quality, neonLights, reducedMotion }) {
    this.quality = quality;
    const size = new THREE.Vector2(200, 320);
    const geometry = new THREE.PlaneGeometry(size.x, size.y);

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        color: { value: new THREE.Color(0xffffff) },
        tDiffuse: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uReflect: { value: quality.reflections ? 1 : 0 },
        uRipple: { value: reducedMotion ? 0.3 : 1 },
        uCamPos: { value: new THREE.Vector3() },
        uLampFlicker: { value: 1 },
        uRoadHalf: { value: STREET.roadHalf },
        uCrossZ: { value: STREET.crossZ },
      },
    ]);
    // Shared (not cloned) so power changes propagate without per-frame copies.
    uniforms.uNeonPos = neonLights.uniforms.uNeonPos;
    uniforms.uNeonColor = neonLights.uniforms.uNeonColor;

    const shader = { uniforms, vertexShader: VERT, fragmentShader: FRAG };

    if (quality.reflections) {
      const w = Math.round(window.innerWidth * quality.reflectionScale);
      const h = Math.round(window.innerHeight * quality.reflectionScale);
      this.mesh = new Reflector(geometry, { shader, textureWidth: w, textureHeight: h, clipBias: 0.003, multisample: 0 });
      this.mesh.material.fog = true;
    } else {
      const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      black.needsUpdate = true;
      this.blackTex = black;
      uniforms.tDiffuse.value = black;
      this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ ...shader, fog: true }));
    }

    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, 0, -40);
    this.uniforms = this.mesh.material.uniforms;
    // Reflector clones uniforms; re-link the shared neon table.
    this.uniforms.uNeonPos = neonLights.uniforms.uNeonPos;
    this.uniforms.uNeonColor = neonLights.uniforms.uNeonColor;
  }

  // Must be called once the main camera exists: restricts the mirror pass to layer REFLECT.
  bindCamera(camera) {
    if (!this.mesh.isReflector) return;
    const rc = this.mesh.getReflectionCamera(camera);
    rc.layers.set(LAYERS.REFLECT);
  }

  setSize(w, h) {
    if (!this.mesh.isReflector) return;
    const s = this.quality.reflectionScale;
    this.mesh.getRenderTarget().setSize(Math.max(64, Math.round(w * s)), Math.max(64, Math.round(h * s)));
  }

  setReflections(on) {
    // Hard-disable the mirror pass when performance tanks.
    if (!this.mesh.isReflector) return;
    this.uniforms.uReflect.value = on ? 1 : 0;
    if (!on) this.mesh.onBeforeRender = () => {};
  }

  update(dt, t, camera) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCamPos.value.copy(camera.position);
  }

  dispose() {
    this.mesh.geometry.dispose();
    if (this.mesh.isReflector) this.mesh.dispose();
    else this.mesh.material.dispose();
    this.blackTex?.dispose();
  }
}

const VERT = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUvRefl;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vUvRefl = textureMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 color;
  uniform float uTime, uReflect, uRipple, uLampFlicker, uRoadHalf, uCrossZ;
  uniform vec3 uCamPos;
  varying vec4 vUvRefl;
  varying vec3 vWorld;
  ${NEON_LIGHTS}
  #include <fog_pars_fragment>
  ${NOISE}

  // Expanding rain rings; returns a 2D normal perturbation.
  vec2 ripples(vec2 p, float t) {
    vec2 acc = vec2(0.0);
    for (int i = 0; i < 3; i++) {
      vec2 cell = floor(p);
      vec2 f = fract(p) - 0.5;
      float h = hash12(cell + float(i) * 17.0);
      vec2 c = (hash22(cell + float(i) * 3.1) - 0.5) * 0.5;
      float ph = fract(t * (0.7 + h * 0.5) + h);
      vec2 d = f - c;
      float r = length(d);
      float rr = ph * 0.42;
      float ring = smoothstep(0.07, 0.0, abs(r - rr)) * (1.0 - ph) * (1.0 - ph);
      acc += (d / max(r, 1e-3)) * ring * sin((r - rr) * 90.0);
      p = p * 1.37 + vec2(5.3, 1.7);
    }
    return acc;
  }

  void main() {
    vec2 xz = vWorld.xz;
    float ax = abs(xz.x);
    float isRoad = step(ax, uRoadHalf);
    float inCross = smoothstep(7.5, 7.0, abs(xz.y - uCrossZ));
    isRoad = max(isRoad, inCross);

    // --- surface albedo -----------------------------------------------------
    float grit = fbm(xz * 1.7);
    float stain = fbm(xz * 0.11 + 4.0);
    vec3 asphalt = vec3(0.010, 0.011, 0.016) * (0.7 + 0.6 * grit);
    vec2 tile = abs(fract(xz * vec2(0.7, 0.7)) - 0.5);
    float tileLine = smoothstep(0.47, 0.5, max(tile.x, tile.y));
    vec3 walk = vec3(0.022, 0.022, 0.03) * (0.8 + 0.4 * grit) - tileLine * 0.01;
    vec3 albedo = mix(walk, asphalt, isRoad);

    // worn lane paint
    float wear = smoothstep(0.35, 0.6, vnoise(xz * 2.3));
    float dash = step(0.5, fract(xz.y / 7.0)) * smoothstep(0.1, 0.06, ax);
    float edge = smoothstep(0.09, 0.04, abs(ax - (uRoadHalf - 0.5)));
    float zebra = step(0.5, fract(xz.x * 0.9)) * step(abs(xz.y - (uCrossZ + 9.0)), 1.6) * step(ax, uRoadHalf);
    float paint = (dash + edge) * (1.0 - inCross) + zebra;
    albedo += paint * wear * vec3(0.05, 0.05, 0.055);
    // curb highlight
    float curb = smoothstep(0.08, 0.0, abs(ax - uRoadHalf)) * (1.0 - inCross);
    albedo += curb * 0.03;

    // --- wetness ------------------------------------------------------------
    float puddle = smoothstep(0.48, 0.62, fbm(xz * 0.16 + 11.0)) ;
    puddle = max(puddle * mix(0.55, 1.0, isRoad), curb * 0.6);
    float wet = mix(0.45, 1.0, puddle);

    vec2 rip = ripples(xz * 1.3, uTime) * uRipple;
    vec2 roughN = (vec2(vnoise(xz * 6.0), vnoise(xz * 6.0 + 9.0)) - 0.5);
    vec2 distort = rip * 0.018 + roughN * mix(0.02, 0.003, puddle);

    // --- reflection ---------------------------------------------------------
    vec3 refl = vec3(0.0);
    if (uReflect > 0.5) {
      vec2 ruv = vUvRefl.xy / vUvRefl.w + distort;
      float smear = mix(0.02, 0.004, puddle);
      refl += texture2D(tDiffuse, ruv).rgb * 0.28;
      refl += texture2D(tDiffuse, ruv + vec2(0.0, smear)).rgb * 0.22;
      refl += texture2D(tDiffuse, ruv - vec2(0.0, smear)).rgb * 0.22;
      refl += texture2D(tDiffuse, ruv + vec2(0.0, smear * 2.3)).rgb * 0.14;
      refl += texture2D(tDiffuse, ruv - vec2(0.0, smear * 2.3)).rgb * 0.14;
    }
    vec3 V = normalize(uCamPos - vWorld);
    float fres = 0.25 + 0.75 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    float reflAmt = wet * fres * (1.0 - paint * wear * 0.6);

    // --- neon light pools ---------------------------------------------------
    vec3 pools = vec3(0.0);
    for (int i = 0; i < NEON_COUNT; i++) {
      vec3 lp = uNeonPos[i];
      vec2 d = xz - lp.xz;
      float dist2 = dot(d, d) + lp.y * lp.y * 0.35;
      pools += uNeonColor[i] * (1.0 / (1.0 + dist2 * 0.045));
    }
    // street lamps: every 18m on both sidewalks
    float lz = mod(xz.y - 4.0 + 9.0, 18.0) - 9.0;
    float ldx = ax - 9.3;
    float lamp = exp(-(ldx * ldx + lz * lz) * 0.06);
    pools += vec3(0.45, 0.6, 1.0) * lamp * 0.18 * uLampFlicker;

    // glossy streak when looking toward lights: brighter on wet surfaces
    vec3 col = albedo + pools * (0.05 + 0.1 * wet) + pools * albedo * 6.0;
    col += (rip.x + rip.y) * 0.004 * wet;
    col += refl * reflAmt * uReflect;
    // without mirror pass, fake a sheen from the neon table
    col += (1.0 - uReflect) * pools * 0.06 * wet * fres;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

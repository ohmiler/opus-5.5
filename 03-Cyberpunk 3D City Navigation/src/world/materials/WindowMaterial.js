import * as THREE from 'three';
import { NOISE } from '../shaders/chunks.js';

// Procedural facade: self-lit window grid computed in world space, so any box (instanced or not)
// becomes a building with no textures and no lights.
export function createWindowMaterial({
  base = '#07080f',
  warm = '#ffb46a',
  cool = '#7fc8ff',
  density = 0.24,
  glow = '#3a1450',
  glowAmount = 0.6,
  cell = [1.8, 2.9],
  brightness = 0.42,
} = {}) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uBase: { value: new THREE.Color(base) },
        uWarm: { value: new THREE.Color(warm) },
        uCool: { value: new THREE.Color(cool) },
        uGlow: { value: new THREE.Color(glow) },
        uGlowAmount: { value: glowAmount },
        uDensity: { value: density },
        uCell: { value: new THREE.Vector2(...cell) },
        uBrightness: { value: brightness },
        uFlicker: { value: 1 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vOrigin;
      #include <fog_pars_vertex>
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(m) * normal);
        vOrigin = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBase, uWarm, uCool, uGlow;
      uniform float uGlowAmount, uDensity, uBrightness, uFlicker;
      uniform vec2 uCell;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vOrigin;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec3 n = vNormalW;
        float side = step(abs(n.y), 0.5);
        float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
        // round interpolated inputs: hashes are chaotic, varying noise would speckle every pixel
        vec2 face = floor(n.xz + 0.5);
        float seed = hash12(floor(vOrigin.xz + 0.5) * 0.173 + face * vec2(3.1, 7.3));

        vec2 g = vec2(u, vWorld.y - 0.6) / uCell;
        vec2 cell = floor(g);
        vec2 f = fract(g);

        float frame = step(0.16, f.x) * step(f.x, 0.84) * step(0.26, f.y) * step(f.y, 0.8);
        float h = hash12(cell + seed * 71.3);
        float floorOn = step(0.18, hash12(vec2(cell.y, seed * 13.7)));
        float lit = step(1.0 - uDensity, h) * floorOn * step(0.5, cell.y);

        // a few windows occasionally die and come back
        float flick = step(0.992, hash12(cell + 4.1)) * step(0.0, sin(uTime * (8.0 + h * 20.0) + h * 40.0));
        lit *= 1.0 - flick * uFlicker;

        vec3 wc = mix(uWarm, uCool, step(0.55, hash12(cell + 9.2)));
        float b = uBrightness * (0.35 + 0.65 * hash12(cell + 2.7));
        // blinds: vertical falloff inside a window
        b *= 0.7 + 0.3 * smoothstep(0.26, 0.8, f.y);

        vec3 col = uBase * (0.8 + 0.4 * seed);
        // street glow bouncing up the facade
        col += uGlow * uGlowAmount * exp(-vWorld.y * 0.09) * 0.25;
        col += wc * frame * lit * b * side;
        col += frame * (1.0 - lit) * side * vec3(0.008, 0.01, 0.02);
        // floor slab lines
        col += side * smoothstep(0.04, 0.0, abs(f.y - 0.05)) * 0.012;
        col = mix(col, uBase * 0.5, 1.0 - side);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

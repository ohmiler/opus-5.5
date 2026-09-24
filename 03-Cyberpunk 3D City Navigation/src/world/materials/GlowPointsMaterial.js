import * as THREE from 'three';
import { ADDITIVE_FOG } from '../shaders/chunks.js';

// Soft additive light sprites with world-space size (vehicle lights, beacons, drone strobes).
export function createGlowPointsMaterial({ scale = 300 } = {}) {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: scale } }]),
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      uniform float uScale;
      varying vec3 vColor;
      #include <fog_pars_vertex>
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / max(-mvPosition.z, 0.1);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      #include <fog_pars_fragment>
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 5.0) + 0.6 * exp(-d * d * 40.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a, 1.0);
        ${ADDITIVE_FOG}
      }
    `,
  });
}

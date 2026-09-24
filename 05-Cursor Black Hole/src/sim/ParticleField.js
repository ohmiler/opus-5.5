import * as THREE from 'three';
import { pointsVertexShader, pointsFragmentShader } from './shaders.js';

/** Draws the simulation: one point per texel, positioned in the vertex shader from the GPU state. */
export class ParticleField {
  constructor(size, { pixelRatio = 1 } = {}) {
    const count = size * size;
    const refs = new Float32Array(count * 2);
    for (let y = 0, i = 0; y < size; y++) {
      for (let x = 0; x < size; x++, i++) {
        refs[i * 2] = (x + 0.5) / size;
        refs[i * 2 + 1] = (y + 0.5) / size;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute('ref', new THREE.BufferAttribute(refs, 2));

    // Fewer bodies → each one a touch larger and brighter, so density reads the same on every tier.
    const sparsity = Math.sqrt(65536 / count);

    this.material = new THREE.ShaderMaterial({
      vertexShader: pointsVertexShader,
      fragmentShader: pointsFragmentShader,
      uniforms: {
        tPos: { value: null },
        tVel: { value: null },
        uSize: { value: 30 * Math.sqrt(sparsity) },
        uPixelRatio: { value: pixelRatio },
        uPointer: { value: new THREE.Vector3(0, 0, 100) },
        uReveal: { value: 0 },
        uOpacity: { value: Math.min(1, 0.62 * Math.sqrt(sparsity)) },
        // sRGB values passed straight through (no colour management on this material).
        uColorA: { value: new THREE.Vector3(0.486, 0.612, 1.0) }, // #7c9cff
        uColorB: { value: new THREE.Vector3(0.655, 0.545, 0.98) }, // #a78bfa
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setPixelRatio(pr) {
    this.material.uniforms.uPixelRatio.value = pr;
  }

  update(sim, pointerWorld, reveal) {
    const u = this.material.uniforms;
    u.tPos.value = sim.positionTexture;
    u.tVel.value = sim.velocityTexture;
    u.uPointer.value.copy(pointerWorld);
    u.uReveal.value = reveal;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

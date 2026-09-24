import * as THREE from 'three';
import { liquidChunk, beginNormalChunk, beginVertexChunk, RIPPLE_COUNT } from './shaders/liquid.js';

/**
 * The hero object: physically based glass (transmission, dispersion,
 * iridescence, clearcoat) with a living surface injected into
 * MeshPhysicalMaterial's vertex stage.
 */
export class LiquidBlob {
  constructor({ detail = 48 } = {}) {
    this.uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uNoiseAmp: { value: 0.05 },
      uNoiseFreq: { value: 1.25 },
      uMouseDir: { value: new THREE.Vector3(0, 0, 1) },
      uMouseStrength: { value: 0 },
      uRippleDir: { value: Array.from({ length: RIPPLE_COUNT }, () => new THREE.Vector3(0, 0, 1)) },
      uRippleAge: { value: new Array(RIPPLE_COUNT).fill(99) },
      uRippleAmp: { value: new Array(RIPPLE_COUNT).fill(0) },
    };
    this.slot = 0;

    this.geometry = new THREE.IcosahedronGeometry(1, detail);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 1.5,
      ior: 1.42,
      dispersion: 3,
      iridescence: 0.55,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [140, 520],
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      attenuationColor: new THREE.Color('#e6e8ff'),
      attenuationDistance: 2.6,
      specularIntensity: 1,
      envMapIntensity: 1.15,
    });

    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${liquidChunk}`)
        .replace('#include <beginnormal_vertex>', beginNormalChunk)
        .replace('#include <begin_vertex>', beginVertexChunk);
    };
    this.material.customProgramCacheKey = () => 'liquid-blob-v1';

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // displaced surface exceeds the base bounds
    this.object = this.mesh;
  }

  /** Launch a ripple from a direction in the blob's local space. */
  ripple(localDir, amplitude = 0.05) {
    const i = this.slot++ % RIPPLE_COUNT;
    this.uniforms.uRippleDir.value[i].copy(localDir).normalize();
    this.uniforms.uRippleAge.value[i] = 0;
    this.uniforms.uRippleAmp.value[i] = amplitude;
  }

  update(dt) {
    const ages = this.uniforms.uRippleAge.value;
    for (let i = 0; i < ages.length; i++) ages[i] = Math.min(ages[i] + dt, 99);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

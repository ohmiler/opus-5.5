import * as THREE from 'three';
import { sporeVertex, sporeFragment } from './shaders/spores.glsl.js';
import { randomUnit } from '../utils/math.js';

/** A drifting halo of spores the organism exhales when threatened. */
export class Spores {
  constructor(shared, { count, rand, pixelRatio }) {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const d = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      randomUnit(rand, d);
      const r = 1.3 + Math.pow(rand(), 1.8) * 3.6;
      pos[i * 3] = d[0] * r; pos[i * 3 + 1] = d[1] * r; pos[i * 3 + 2] = d[2] * r;
      rnd[i] = rand();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

    this.uniforms = {
      uTime: shared.uTime,
      uBirth: shared.uBirth,
      uPointer: shared.uPointer,
      uProx: shared.uProx,
      uAccent: shared.uAccent,
      uShock: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: 5.5 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: sporeVertex,
      fragmentShader: sporeFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setPixelRatio(pr) { this.uniforms.uPixelRatio.value = pr; }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

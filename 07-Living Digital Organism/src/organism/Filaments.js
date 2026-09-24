import * as THREE from 'three';
import { filamentVertex, filamentFragment } from './shaders/filaments.glsl.js';
import { randomUnit } from '../utils/math.js';

/**
 * Tentacle-like strands. Geometry is only topology (root direction + t along
 * the strand); the shape is computed every frame on the GPU.
 * Roots cluster into "polyps" so the organism reads as colonial, not a hedgehog.
 */
export class Filaments {
  constructor(uniforms, { count, segments, rand }) {
    this.count = count;
    const clusters = Array.from({ length: 5 + Math.floor(rand() * 4) }, () => randomUnit(rand));

    const verts = count * segments * 2;
    const root = new Float32Array(verts * 3);
    const tArr = new Float32Array(verts);
    const rArr = new Float32Array(verts);
    const tmp = [0, 0, 0];

    let v = 0;
    for (let i = 0; i < count; i++) {
      // 70% of roots gather around a polyp, the rest are scattered loners.
      let d;
      if (rand() < 0.7) {
        const c = clusters[Math.floor(rand() * clusters.length)];
        const j = randomUnit(rand, tmp);
        const spread = 0.28 + rand() * 0.2;
        d = new THREE.Vector3(c[0] + j[0] * spread, c[1] + j[1] * spread, c[2] + j[2] * spread).normalize();
      } else {
        const j = randomUnit(rand, tmp);
        d = new THREE.Vector3(j[0], j[1], j[2]);
      }
      const r = rand();
      for (let s = 0; s < segments; s++) {
        for (const k of [s, s + 1]) {
          root[v * 3] = d.x; root[v * 3 + 1] = d.y; root[v * 3 + 2] = d.z;
          tArr[v] = k / segments;
          rArr[v] = r;
          v++;
        }
      }
    }

    this.geometry = new THREE.BufferGeometry();
    // `position` is required by three but unused by the shader.
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    this.geometry.setAttribute('aRoot', new THREE.BufferAttribute(root, 3));
    this.geometry.setAttribute('aT', new THREE.BufferAttribute(tArr, 1));
    this.geometry.setAttribute('aRand', new THREE.BufferAttribute(rArr, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: filamentVertex,
      fragmentShader: filamentFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

import * as THREE from 'three';
import { bodyVertex, bodyFragment, latticeVertex, latticeFragment } from './shaders/body.glsl.js';

/** Translucent membrane + a neural lattice floating just above it. */
export class Body {
  constructor(uniforms, { detail }) {
    this.group = new THREE.Group();

    this.geometry = new THREE.IcosahedronGeometry(1, detail);
    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: bodyVertex,
      fragmentShader: bodyFragment,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // vertices move in the shader
    this.group.add(this.mesh);

    const latticeSource = new THREE.IcosahedronGeometry(1, Math.max(3, Math.round(detail / 12)));
    this.latticeGeometry = new THREE.WireframeGeometry(latticeSource);
    latticeSource.dispose();
    this.latticeMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: latticeVertex,
      fragmentShader: latticeFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lattice = new THREE.LineSegments(this.latticeGeometry, this.latticeMaterial);
    this.lattice.frustumCulled = false;
    this.group.add(this.lattice);
  }

  get vertexCount() { return this.geometry.attributes.position.count; }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.latticeGeometry.dispose();
    this.latticeMaterial.dispose();
  }
}

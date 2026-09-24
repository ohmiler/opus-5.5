import * as THREE from 'three';
import { LAYERS } from '../config.js';
import { ADDITIVE_FOG } from './shaders/chunks.js';

// A rooftop-projected wireframe hologram over the cross street — the district's landmark ad.
export class Hologram {
  constructor({ position = new THREE.Vector3(-26, 24, -64) } = {}) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    const lineMat = (color) =>
      new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

    this.geos = [new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(5, 1)), new THREE.EdgesGeometry(new THREE.OctahedronGeometry(2.4)), new THREE.EdgesGeometry(new THREE.TorusGeometry(7.5, 0.02, 3, 90))];
    this.mats = [lineMat('#19f0ff'), lineMat('#ff2bd6'), lineMat('#19f0ff')];
    this.outer = new THREE.LineSegments(this.geos[0], this.mats[0]);
    this.inner = new THREE.LineSegments(this.geos[1], this.mats[1]);
    this.ring = new THREE.LineSegments(this.geos[2], this.mats[2]);
    this.ring.rotation.x = Math.PI / 2.3;
    this.group.add(this.outer, this.inner, this.ring);

    // Projector beam from the rooftop below
    this.beamGeo = new THREE.CylinderGeometry(5.5, 0.4, 18, 32, 1, true).translate(0, -9 - 5, 0);
    this.beamMat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        #include <fog_pars_fragment>
        void main() {
          float streak = 0.5 + 0.5 * sin(vUv.x * 60.0 + uTime * 0.7);
          float a = vUv.y * vUv.y * 0.18 * (0.5 + 0.5 * streak);
          gl_FragColor = vec4(vec3(0.1, 0.9, 1.0) * a, 1.0);
          ${ADDITIVE_FOG}
        }
      `,
    });
    this.beam = new THREE.Mesh(this.beamGeo, this.beamMat);
    this.group.add(this.beam);
    for (const o of [this.outer, this.inner, this.ring]) o.layers.enable(LAYERS.REFLECT);
  }

  update(dt, t, reducedMotion) {
    const k = reducedMotion ? 0.15 : 1;
    this.outer.rotation.y += dt * 0.25 * k;
    this.outer.rotation.x += dt * 0.08 * k;
    this.inner.rotation.y -= dt * 0.6 * k;
    this.ring.rotation.z += dt * 0.12 * k;
    this.group.position.y += Math.sin(t * 0.8) * 0.004 * k;
    // hologram instability
    const glitch = !reducedMotion && Math.sin(t * 3.1) > 0.985 ? 0.3 : 1;
    this.mats[0].opacity = 0.85 * glitch;
    this.beamMat.uniforms.uTime.value = t;
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.beamGeo.dispose();
    this.beamMat.dispose();
  }
}

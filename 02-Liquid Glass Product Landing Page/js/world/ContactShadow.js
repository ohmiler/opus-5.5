import * as THREE from 'three';

/** Soft floor shadow that follows the blob and fades with its presence. */
export class ContactShadow {
  constructor() {
    this.uniforms = {
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#2a2833') },
    };
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uOpacity;
        uniform vec3 uColor;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.4) * uOpacity;
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.rotation.x = -Math.PI / 2;
  }

  place(x, floorY, size, opacity) {
    this.object.position.set(x, floorY, 0);
    this.object.scale.set(size, size, 1);
    this.uniforms.uOpacity.value = opacity;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

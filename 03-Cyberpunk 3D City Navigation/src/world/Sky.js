import * as THREE from 'three';
import { PALETTE, LAYERS } from '../config.js';
import { NOISE } from './shaders/chunks.js';
import { Disposer } from '../utils/Disposer.js';

// Gradient night sky with a procedural far skyline silhouette and slow smog.
export class Sky {
  constructor() {
    this.disposer = new Disposer();
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: new THREE.Color(PALETTE.skyTop) },
        uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
        uFog: { value: new THREE.Color(PALETTE.fog) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uTop, uHorizon, uFog;
        varying vec3 vDir;
        ${NOISE}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          float az = atan(d.x, d.z);

          vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.45, h));
          // magenta light-pollution band
          col += vec3(0.16, 0.03, 0.14) * exp(-abs(h - 0.03) * 16.0);

          // drifting smog lit from below
          float smog = fbm(vec2(az * 3.0 + uTime * 0.004, h * 7.0 - uTime * 0.01));
          col += vec3(0.05, 0.02, 0.08) * smog * smoothstep(0.5, 0.05, h);

          // far skyline: stepped heights by azimuth
          float bx = floor(az * 60.0);
          float bh = 0.02 + 0.09 * pow(hash12(vec2(bx, 3.0)), 2.2) + 0.03 * hash12(vec2(floor(az * 17.0), 1.0));
          float bld = step(h, bh);
          vec2 wg = vec2(az * 900.0, h * 500.0);
          float win = step(0.93, hash12(floor(wg))) * step(0.3, fract(wg.x)) * step(0.3, fract(wg.y));
          vec3 skyline = uFog * 0.75 + win * vec3(0.9, 0.55, 0.9) * 0.18;
          col = mix(col, skyline, bld);
          // horizon haze melts into the fog colour
          col = mix(col, uFog, smoothstep(0.08, -0.05, h) * 0.9);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.layers.enable(LAYERS.REFLECT);
    this.disposer.trackObject(this.mesh);
  }

  update(dt, t, camera) {
    this.mesh.position.copy(camera.position);
    this.mesh.material.uniforms.uTime.value = t;
  }

  dispose() {
    this.disposer.dispose();
  }
}

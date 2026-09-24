import * as THREE from 'three';
import { rng, ss } from '../util.js';

const BOX = 70;

const VERT = /* glsl */ `
uniform float uTime, uSize, uBox, uPixelRatio;
uniform vec3 uCam;
attribute float aSeed;
varying float vAlpha;
varying float vSeed;
void main() {
  vec3 p = position;
  p.y -= uTime * (0.12 + aSeed * 0.3);                  // marine snow sinks
  p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.8;
  p.z += cos(uTime * 0.25 + aSeed * 13.0) * 0.6;
  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;   // infinite volume around the camera
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = uSize * (0.4 + aSeed) * uPixelRatio * (30.0 / max(d, 0.1));
  vAlpha = smoothstep(uBox * 0.5, uBox * 0.2, length(p - uCam)) * smoothstep(0.5, 3.0, d);
  vSeed = aSeed;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColorA, uColorB;
uniform float uGlow, uTime;
varying float vAlpha;
varying float vSeed;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  float isGlow = step(0.78, vSeed) * uGlow;
  float twinkle = mix(1.0, 0.35 + 0.65 * sin(uTime * 1.7 + vSeed * 40.0), isGlow);
  vec3 col = mix(uColorA, uColorB, isGlow);
  float alpha = a * vAlpha * mix(0.4 - uGlow * 0.25, 1.0, isGlow) * twinkle;
  gl_FragColor = vec4(col, alpha);
}`;

export class Particles {
  constructor(scene, { count }) {
    const r = rng(11);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * BOX;
      pos[i * 3 + 1] = r() * BOX;
      pos[i * 3 + 2] = r() * BOX;
      seed[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.colorA = new THREE.Color();
    this.surfaceCol = new THREE.Color('#dff6ff');
    this.deepCol = new THREE.Color('#6d8ea3');
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.3 },
        uBox: { value: BOX },
        uPixelRatio: { value: 1 },
        uCam: { value: new THREE.Vector3() },
        uColorA: { value: this.colorA },
        uColorB: { value: new THREE.Color('#7ff3ff') },
        uGlow: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setPixelRatio(v) { this.mat.uniforms.uPixelRatio.value = v; }

  update(t, p, camera) {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uCam.value.copy(camera.position);
    u.uGlow.value = ss(0.45, 0.7, p) * (1 - ss(0.9, 1, p) * 0.5);
    this.colorA.lerpColors(this.surfaceCol, this.deepCol, ss(0.1, 0.55, p));
  }
}

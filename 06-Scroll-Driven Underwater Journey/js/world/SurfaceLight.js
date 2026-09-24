import * as THREE from 'three';
import { rng, ss } from '../util.js';

const SURFACE_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SURFACE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec3 vWorld;

float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

void main() {
  float d = length(vWorld.xz - cameraPosition.xz);
  float c = caustic(vWorld.xz * 0.02, uTime * 0.35);
  float snell = smoothstep(75.0, 0.0, d);
  vec3 col = mix(vec3(0.10, 0.45, 0.58), vec3(0.85, 0.98, 1.0), snell * 0.75) + c * 0.5;
  float a = uStrength * (0.3 + snell * 0.7) * smoothstep(190.0, 40.0, d);
  gl_FragColor = vec4(col, a);
}`;

const RAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const RAY_FRAG = /* glsl */ `
uniform float uTime, uStrength, uSeed;
varying vec2 vUv;
void main() {
  float e = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
  float v = pow(vUv.y, 1.8);
  float flick = 0.55 + 0.45 * sin(uTime * 0.6 + uSeed * 17.0) * sin(uTime * 0.23 + uSeed * 5.0);
  float a = e * e * v * flick * uStrength;
  gl_FragColor = vec4(vec3(0.78, 0.96, 1.0), a);
}`;

/** Water surface seen from below, plus cylindrical-billboard god rays. */
export class SurfaceLight {
  constructor(scene, { rays = 14 } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const geo = new THREE.PlaneGeometry(420, 420);
    geo.rotateX(-Math.PI / 2);
    this.surfaceMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 1 } },
      vertexShader: SURFACE_VERT,
      fragmentShader: SURFACE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.surface = new THREE.Mesh(geo, this.surfaceMat);
    this.surface.position.y = 4;
    this.group.add(this.surface);

    const r = rng(3);
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    this.rays = [];
    for (let i = 0; i < rays; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uSeed: { value: r() } },
        vertexShader: RAY_VERT,
        fragmentShader: RAY_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(rayGeo, mat);
      const h = 90 + r() * 70;
      m.scale.set(2 + r() * 6, h, 1);
      m.position.set((r() - 0.5) * 80, 4 - h / 2, -r() * 70 + 6);
      m.userData.base = 0.08 + r() * 0.14;
      this.rays.push(m);
      this.group.add(m);
    }
  }

  update(t, p, camera) {
    const fade = 1 - ss(0.1, 0.38, p);
    this.group.visible = fade > 0.001;
    if (!this.group.visible) return;
    this.surfaceMat.uniforms.uTime.value = t;
    this.surfaceMat.uniforms.uStrength.value = 1 - ss(0.04, 0.3, p);
    for (const m of this.rays) {
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uStrength.value = m.userData.base * fade;
      m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    }
  }
}

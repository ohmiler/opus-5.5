import * as THREE from 'three';
import { ADDITIVE_FOG, TAU, damp, fogFade, lerp, rng } from '../util.js';

const BELL_VERT = /* glsl */ `
#include <fog_pars_vertex>
uniform float uTime, uCycle;
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  vec3 p = position;
  float pulse = pow(0.5 + 0.5 * sin(uCycle), 2.0);
  float rim = clamp(1.0 - p.y, 0.0, 1.2);
  p.xz *= 1.0 - pulse * 0.22 * rim;
  p.y *= 1.0 + pulse * 0.12;
  p.xz *= 1.0 + 0.035 * sin(atan(p.z, p.x) * 8.0 + uTime * 1.5) * rim * rim;
  vH = position.y;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const BELL_FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uGlow, uTime;
varying vec3 vN;
varying vec3 vView;
varying float vH;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  float bands = smoothstep(0.6, 1.0, sin(vH * 26.0 - uTime * 1.2) * 0.5 + 0.5);
  float a = clamp(f * 0.85 + 0.06 + bands * 0.15 * f, 0.0, 1.0) * (1.0 + uGlow * 1.5);
  gl_FragColor = vec4(uColor * (1.0 + uGlow), a);
  ${ADDITIVE_FOG}
}`;

const COLORS = ['#ff9ad5', '#9ad8ff', '#c6a3ff', '#ffc9a3'];

/** Bell pulses drive thrust; tentacles trail and stretch with the jelly's own velocity. */
export class Jellyfish {
  constructor(scene, { count, hover, audio }) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.bellGeo = new THREE.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI * 0.55);
    const r = rng(7);
    this.items = [];

    for (let i = 0; i < count; i++) {
      const size = 1.2 + r() * 2.2;
      const color = COLORS[i % COLORS.length];
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uTime: { value: 0 }, uCycle: { value: 0 }, uColor: { value: new THREE.Color(color) }, uGlow: { value: 0 } },
        ]),
        vertexShader: BELL_VERT,
        fragmentShader: BELL_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: true,
      });
      const bell = new THREE.Mesh(this.bellGeo, mat);
      bell.scale.setScalar(size);

      const T = 12, S = 22;
      const pos = new Float32Array(T * S * 2 * 3);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      lines.frustumCulled = false;

      const g = new THREE.Group();
      g.add(bell, lines);
      const y = lerp(-34, -112, i / Math.max(1, count - 1)) + (r() - 0.5) * 8;
      g.position.set((r() - 0.5) * 50, y, -r() * 40 - 2);
      this.group.add(g);

      const it = {
        g, bell, mat, lines, pos, T, S, size,
        cycle: r() * TAU, speed: 0.9 + r() * 0.6, baseY: y, vy: 0,
        glow: 0, hovered: false, boost: 0, drift: r() * TAU,
      };
      this.items.push(it);
      hover.add(bell, {
        label: 'observe',
        onEnter: () => { it.hovered = true; it.boost = 1.2; audio.ping(196 + i * 24, 0.035, 2.2); },
        onLeave: () => { it.hovered = false; },
        onClick: () => { it.boost = 2; },
      });
    }
  }

  update(t, dt, p, camera, fogDensity) {
    this.group.visible = p > 0.1 && p < 0.72;
    if (!this.group.visible) return;
    for (const it of this.items) {
      it.boost = Math.max(0, it.boost - dt * 0.4);
      it.cycle += dt * it.speed * (1 + it.boost * 1.5);
      const pulse = (0.5 + 0.5 * Math.sin(it.cycle)) ** 2;
      const thrust = Math.max(0, Math.cos(it.cycle));
      const g = it.g;
      it.vy = damp(it.vy, thrust * 0.9 * (1 + it.boost) - 0.28 + (it.baseY - g.position.y) * 0.06, 2, dt);
      g.position.y += it.vy * dt;
      g.position.x += Math.sin(t * 0.05 + it.drift) * 0.15 * dt;
      g.rotation.z = Math.sin(t * 0.3 + it.drift) * 0.12;
      g.rotation.x = Math.cos(t * 0.25 + it.drift) * 0.1;

      it.glow = damp(it.glow, it.hovered ? 1 : 0, 4, dt);
      const u = it.mat.uniforms;
      u.uTime.value = t;
      u.uCycle.value = it.cycle;
      u.uGlow.value = it.glow + it.boost * 0.3;

      const fade = fogFade(g.position.distanceTo(camera.position), fogDensity);
      it.lines.material.opacity = (0.26 + it.glow * 0.4) * fade;
      if (fade > 0.02) this.tentacles(it, pulse, t);
    }
  }

  tentacles(it, pulse, t) {
    const { T, S, size, pos } = it;
    const rr = size * 0.95 * (1 - pulse * 0.2);
    const rimY = -0.156 * size * (1 + pulse * 0.12);
    const seg = size * 0.2 * (1 + Math.max(0, it.vy) * 0.3);
    let o = 0;
    for (let a = 0; a < T; a++) {
      const ang = (a / T) * TAU;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let px = ca * rr, py = rimY, pz = sa * rr;
      for (let k = 1; k <= S; k++) {
        const taper = 1 - (k / S) * 0.6;
        const nx = ca * rr * taper + Math.sin(t * 1.1 - k * 0.28 + a * 1.7) * k * 0.018 * size;
        const nz = sa * rr * taper + Math.cos(t * 0.9 - k * 0.31 + a * 2.3) * k * 0.018 * size;
        const ny = rimY - k * seg;
        pos[o++] = px; pos[o++] = py; pos[o++] = pz;
        pos[o++] = nx; pos[o++] = ny; pos[o++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    it.lines.geometry.attributes.position.needsUpdate = true;
  }
}

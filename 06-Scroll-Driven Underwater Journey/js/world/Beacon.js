import * as THREE from 'three';
import { TAU, damp, glowTexture, rng, ss } from '../util.js';

export const BEACON_CENTER = new THREE.Vector3(0, -243, -26);
const SEABED_Y = -255;

const DISC_FRAG = /* glsl */ `
uniform float uTime, uAwake, uHover;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float a = atan(c.y, c.x);
  float swirl = sin(a * 6.0 + r * 10.0 - uTime * 1.2) * 0.5 + 0.5;
  float rings = sin(r * 40.0 - uTime * 2.5) * 0.5 + 0.5;
  float core = smoothstep(1.0, 0.0, r);
  float edge = smoothstep(0.7, 1.0, r) * smoothstep(1.0, 0.95, r);
  vec3 col = mix(vec3(0.0, 0.35, 0.5), vec3(0.55, 1.0, 0.95), swirl * core);
  float i = (core * 0.3 * swirl + edge * 1.1 + rings * 0.08 * core) * uAwake * (1.0 + uHover * 0.9);
  gl_FragColor = vec4(col, i);
}`;

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying float vFacing;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */ `
uniform float uStrength, uTime;
varying vec2 vUv;
varying float vFacing;
void main() {
  float a = pow(vFacing, 3.0) * pow(1.0 - vUv.y, 2.2) * uStrength;
  a *= 0.8 + 0.2 * sin(uTime * 0.7 + vUv.y * 8.0);
  gl_FragColor = vec4(vec3(0.45, 0.95, 1.0), a);
}`;

const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * The discovery: a ring of unknown make on the abyssal plain. It is sensed from far above as a glow,
 * awakens as you arrive (shockwave + light), and resonates when touched.
 */
export class Beacon {
  constructor(scene, { hover, audio, cursor, reduced }) {
    this.audio = audio;
    this.cursor = cursor;
    this.reduced = reduced;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.awake = 0;
    this.flare = 0;
    this.hoverV = 0;
    this.hovered = false;
    this.awoken = false;
    this.shockStart = -1;
    this.time = 0;
    const r = rng(42);
    const C = BEACON_CENTER;

    // Seabed
    const bedGeo = new THREE.PlaneGeometry(600, 600, 140, 140);
    bedGeo.rotateX(-Math.PI / 2);
    const bp = bedGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), z = bp.getZ(i);
      const dist = Math.hypot(x - C.x, z - C.z);
      let h = Math.sin(x * 0.05) * Math.cos(z * 0.04) * 3 + Math.sin(x * 0.13 + z * 0.1) * 1.2 + (r() - 0.5) * 0.35;
      h *= ss(12, 40, dist);
      bp.setY(i, h);
    }
    bedGeo.computeVertexNormals();
    this.seabed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: '#0b1d26', roughness: 1 }));
    this.seabed.position.y = SEABED_Y;
    this.group.add(this.seabed);

    // Monoliths facing the ring, each with a glyph strip that pulses in sequence
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#10222b', roughness: 0.85, metalness: 0.2 });
    this.strips = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const th = -1.9 + (i / (N - 1)) * 3.8;
      const h = 8 + r() * 14;
      const R = 24 + r() * 6;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(2 + r(), h, 1.2), stoneMat);
      stone.position.set(C.x + Math.sin(th) * R, SEABED_Y + h / 2 - 1.5, C.z - Math.cos(th) * R);
      stone.lookAt(C.x, stone.position.y, C.z);
      stone.rotateZ((r() - 0.5) * 0.2);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, h * 0.7, 0.05),
        new THREE.MeshBasicMaterial({ color: '#5ff2ff' }),
      );
      strip.position.z = 0.63;
      stone.add(strip);
      this.strips.push(strip);
      this.group.add(stone);
    }

    // The ring
    this.ringGroup = new THREE.Group();
    this.ringGroup.position.copy(C);
    this.group.add(this.ringGroup);
    this.ringMat = new THREE.MeshStandardMaterial({
      color: '#0d1c22', metalness: 0.85, roughness: 0.3, emissive: '#3fe0ff', emissiveIntensity: 0.1,
    });
    this.ringGroup.add(new THREE.Mesh(new THREE.TorusGeometry(10, 0.55, 24, 160), this.ringMat));

    this.runes = new THREE.Group();
    this.runeMat = new THREE.MeshBasicMaterial({ color: '#5ff2ff' });
    const runeGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const m = new THREE.Mesh(runeGeo, this.runeMat);
      m.position.set(Math.cos(a) * 11.2, Math.sin(a) * 11.2, 0);
      m.rotation.z = a + Math.PI / 2;
      m.scale.y = i % 3 === 0 ? 1.8 : 0.8;
      this.runes.add(m);
    }
    this.ringGroup.add(this.runes);

    this.inner = new THREE.Mesh(new THREE.TorusGeometry(9.3, 0.05, 8, 160), this.runeMat);
    this.ringGroup.add(this.inner);

    this.discMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAwake: { value: 0 }, uHover: { value: 0 } },
      vertexShader: UV_VERT,
      fragmentShader: DISC_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(9.4, 96), this.discMat);
    this.ringGroup.add(this.disc);

    // Volumetric column rising from the ring
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(9, 6, 140, 40, 1, true), this.beamMat);
    beam.position.set(C.x, C.y + 70, C.z);
    this.group.add(beam);

    // Far-field halo: the glow you notice long before you see the structure
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: '#3fd8ff', blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, fog: false, opacity: 0,
    }));
    this.halo.scale.setScalar(80);
    this.halo.position.copy(C);
    this.group.add(this.halo);

    // Shockwave
    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 128),
      new THREE.MeshBasicMaterial({ color: '#8ff6ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.shock.position.copy(C);
    this.shock.visible = false;
    this.group.add(this.shock);

    // Orbiting fragments
    this.fragments = [];
    const fragGeo = new THREE.OctahedronGeometry(0.35);
    const fragMat = new THREE.MeshStandardMaterial({ color: '#0d1c22', emissive: '#3fe0ff', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(fragGeo, fragMat);
      m.userData = { a: r() * TAU, rad: 12.5 + r() * 5, z: (r() - 0.5) * 6, sp: (0.05 + r() * 0.1) * (r() > 0.5 ? 1 : -1), s: 0.5 + r() };
      m.scale.setScalar(m.userData.s);
      this.fragments.push(m);
      this.ringGroup.add(m);
    }
    this.fragMat = fragMat;

    this.light = new THREE.PointLight('#5fe8ff', 0, 95, 1.2);
    this.light.position.set(C.x, C.y, C.z + 4);
    this.group.add(this.light);

    hover.add(this.disc, {
      label: 'resonate',
      onEnter: () => { this.hovered = true; this.audio.ping(146.8, 0.04, 3); },
      onLeave: () => { this.hovered = false; },
      onClick: () => this.pulse(),
    });
  }

  pulse() {
    this.flare = 1;
    this.shockStart = this.time;
    this.shock.visible = true;
    this.audio.swell();
    this.cursor.pulse();
  }

  update(t, dt, p) {
    this.time = t;
    this.group.visible = p > 0.6;
    if (!this.group.visible) return;

    this.halo.material.opacity = ss(0.62, 0.9, p) * 0.5 * (0.85 + 0.15 * Math.sin(t * 0.8));
    this.awake = damp(this.awake, ss(0.84, 0.97, p), 1.2, dt);
    if (p > 0.94 && !this.awoken) { this.awoken = true; this.pulse(); }
    if (p < 0.85) this.awoken = false;

    this.flare = Math.max(0, this.flare - dt * 0.5);
    this.hoverV = damp(this.hoverV, this.hovered ? 1 : 0, 5, dt);
    const glow = this.awake * (1 + this.flare * 1.5 + this.hoverV * 0.5);

    const u = this.discMat.uniforms;
    u.uTime.value = t;
    u.uAwake.value = this.awake + this.flare * 0.8;
    u.uHover.value = this.hoverV;

    this.ringMat.emissiveIntensity = 0.1 + glow * 1.4;
    this.fragMat.emissiveIntensity = 0.3 + glow * 1.5;
    this.runeMat.color.setRGB(0.37, 0.95, 1).multiplyScalar(0.15 + glow * 2.2);
    this.runes.rotation.z = t * 0.05;
    this.inner.rotation.z = -t * 0.08;
    this.strips.forEach((s, i) => {
      s.material.color.setRGB(0.37, 0.95, 1).multiplyScalar(0.08 + glow * (1 + Math.sin(t * 1.2 - i * 0.7) * 0.8));
    });
    this.light.intensity = glow * 55;
    this.beamMat.uniforms.uStrength.value = this.awake * 0.45 * (1 + this.flare);
    this.beamMat.uniforms.uTime.value = t;

    for (const m of this.fragments) {
      const d = m.userData;
      d.a += d.sp * dt * (1 + this.flare * 4);
      m.position.set(Math.cos(d.a) * d.rad, Math.sin(d.a) * d.rad, d.z + Math.sin(t * 0.5 + d.a) * 0.8);
      m.rotation.set(t * 0.3 + d.a, t * 0.2, 0);
    }

    if (this.shock.visible) {
      const k = (t - this.shockStart) / 2.6;
      if (k >= 1) this.shock.visible = false;
      else {
        this.shock.scale.setScalar(10 + k * (this.reduced ? 12 : 55));
        this.shock.material.opacity = (1 - k) ** 2 * 0.9;
      }
    }
  }
}

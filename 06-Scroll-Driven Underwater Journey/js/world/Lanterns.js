import * as THREE from 'three';
import { TAU, fogFade, glowTexture, lerp, rng } from '../util.js';

const COLORS = ['#5ff2ff', '#6fb6ff', '#b98cff', '#4dffc3'];
const NOTES = [523.3, 587.3, 659.3, 784, 880];

/**
 * Bioluminescent creatures of the midnight zone. Hovering one makes it flare,
 * and the flare ripples outward to neighbours with a distance-based delay — they answer each other.
 */
export class Lanterns {
  constructor(scene, { count, chains = 3, hover, audio }) {
    this.audio = audio;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;

    const tex = glowTexture();
    const coreGeo = new THREE.IcosahedronGeometry(0.18, 1);
    const hitGeo = new THREE.SphereGeometry(1.8, 8, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const r = rng(21);
    this.items = [];

    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(COLORS[Math.floor(r() * COLORS.length)]);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: color.clone() }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
      const hit = new THREE.Mesh(hitGeo, hitMat);
      const g = new THREE.Group();
      g.add(core, halo, hit);
      const base = new THREE.Vector3((r() - 0.5) * 80, lerp(-118, -205, r()), -r() * 60 + 4);
      g.position.copy(base);
      this.group.add(g);

      const L = {
        g, core, halo, color, base, note: NOTES[i % NOTES.length],
        phase: r() * TAU, rate: 0.5 + r() * 1.6, scale: 0.7 + r() * 0.8, boost: 0, pending: -1, pendingAmt: 0,
      };
      this.items.push(L);
      hover.add(hit, {
        label: 'observe',
        onEnter: () => this.ignite(L, 1),
        onClick: () => this.ignite(L, 1.8),
      });
    }

    // Siphonophore-like chains: colonies of lights following a shared path.
    this.chains = [];
    for (let c = 0; c < chains; c++) {
      const beads = [];
      const col = new THREE.Color(c % 2 ? '#b98cff' : '#6fe7ff');
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
        }));
        s.scale.setScalar(0.9 - i * 0.03);
        this.group.add(s);
        beads.push(s);
      }
      this.chains.push({ beads, y: lerp(-130, -190, c / Math.max(1, chains - 1)), off: r() * 100, z: -20 - r() * 20 });
    }
  }

  ignite(L, amount) {
    L.boost = Math.max(L.boost, amount);
    this.audio.ping(L.note, 0.04);
    for (const o of this.items) {
      if (o === L) continue;
      const d = o.g.position.distanceTo(L.g.position);
      if (d < 18) {
        o.pending = this.time + d * 0.08;
        o.pendingAmt = amount * (1 - d / 18) * 0.9;
      }
    }
  }

  update(t, dt, p, camera, fogDensity) {
    this.time = t;
    this.group.visible = p > 0.38;
    if (!this.group.visible) return;
    const cam = camera.position;

    for (const L of this.items) {
      if (L.pending > 0 && t >= L.pending) {
        L.pending = -1;
        L.boost = Math.max(L.boost, L.pendingAmt);
      }
      L.boost = Math.max(0, L.boost - dt * 0.45);
      L.g.position.set(
        L.base.x + Math.sin(t * 0.17 + L.phase) * 1.6,
        L.base.y + Math.sin(t * 0.23 + L.phase * 1.3) * 1.2,
        L.base.z + Math.cos(t * 0.13 + L.phase) * 1.4,
      );
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * L.rate + L.phase)) ** 4;
      const I = pulse * 0.7 + L.boost * 1.8;
      const fade = fogFade(L.g.position.distanceTo(cam), fogDensity);
      L.halo.scale.setScalar((1.5 + I * 3.2) * L.scale);
      L.halo.material.opacity = Math.min(1, 0.2 + I * 0.55) * fade;
      L.core.material.color.copy(L.color).multiplyScalar(0.5 + I * 1.5);
    }

    for (const ch of this.chains) {
      for (let i = 0; i < ch.beads.length; i++) {
        const s = ch.beads[i];
        const tt = t * 0.9 + ch.off - i * 0.45;
        s.position.set(Math.sin(tt * 0.21) * 24, ch.y + Math.sin(tt * 0.13) * 6, ch.z + Math.cos(tt * 0.17) * 14);
        const wave = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2.4 - i * 0.55)) ** 3;
        s.material.opacity = wave * 0.8 * fogFade(s.position.distanceTo(cam), fogDensity);
      }
    }
  }
}

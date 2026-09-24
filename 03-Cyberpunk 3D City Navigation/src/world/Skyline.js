import * as THREE from 'three';
import { LAYERS, STREET, PALETTE } from '../config.js';
import { createWindowMaterial } from './materials/WindowMaterial.js';
import { createGlowPointsMaterial } from './materials/GlowPointsMaterial.js';
import { Disposer } from '../utils/Disposer.js';
import { rng } from '../utils/math.js';

const NEON = [PALETTE.cyan, PALETTE.magenta, PALETTE.amber, '#ff3355', '#e9f1ff'];

// Every non-landmark building in one instanced draw call, plus neon edge strips,
// blinking rooftop beacons, overhead cables and street lamps.
export class Skyline {
  constructor({ sections }) {
    this.disposer = new Disposer();
    this.group = new THREE.Group();
    const rand = rng(7);

    const blocked = sections
      .filter((s) => s.anchor.side !== 0)
      .map((s) => ({ side: s.anchor.side, z0: s.anchor.z - 10.5, z1: s.anchor.z + 10.5 }));
    const isBlocked = (side, z0, z1) =>
      blocked.some((b) => b.side === side && z1 > b.z0 && z0 < b.z1) ||
      (z1 > STREET.crossZ - 7.5 && z0 < STREET.crossZ + 7.5);

    const boxes = []; // {x, y(base), z, w(x), h, d(z)}
    const frontage = [];

    // Row 1: street frontage
    for (const side of [-1, 1]) {
      let z = 70;
      while (z > -128) {
        const len = 7 + rand() * 9;
        const z1 = z;
        const z0 = z - len;
        if (!isBlocked(side, z0 - 0.5, z1 + 0.5)) {
          const depth = 12 + rand() * 10;
          const h = 10 + Math.pow(rand(), 1.6) * 38;
          const b = { x: side * (STREET.walkHalf + depth / 2), z: (z0 + z1) / 2, w: depth, d: len - 0.4, h, side };
          boxes.push(b);
          frontage.push(b);
        }
        z = z0 - (0.3 + rand() * 1.2);
      }
    }
    // Row 2: taller, set back
    for (const side of [-1, 1]) {
      let z = 80;
      while (z > -160) {
        const len = 10 + rand() * 14;
        const depth = 14 + rand() * 12;
        boxes.push({ x: side * (36 + rand() * 6 + depth / 2), z: z - len / 2, w: depth, d: len - 1, h: 28 + Math.pow(rand(), 1.3) * 70 });
        z -= len + rand() * 4;
      }
    }
    // Row 3: far towers & the cluster behind the terminus
    for (let i = 0; i < 70; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const w = 12 + rand() * 18;
      boxes.push({ x: side * (72 + rand() * 90), z: 70 - rand() * 330, w, d: 10 + rand() * 18, h: 50 + Math.pow(rand(), 1.2) * 130 });
    }
    for (let i = 0; i < 26; i++) {
      const w = 12 + rand() * 18;
      boxes.push({ x: (rand() - 0.5) * 150, z: -165 - rand() * 120, w, d: 12 + rand() * 16, h: 60 + rand() * 120 });
    }

    // --- instanced towers ----------------------------------------------------
    const geo = this.disposer.track(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    this.material = this.disposer.track(createWindowMaterial({ glow: '#3a1450', glowAmount: 0.9 }));
    const mesh = new THREE.InstancedMesh(geo, this.material, boxes.length);
    const m = new THREE.Matrix4();
    boxes.forEach((b, i) => {
      m.makeScale(b.w, b.h, b.d).setPosition(b.x, 0, b.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.layers.enable(LAYERS.REFLECT);
    this.group.add(mesh);

    // --- neon edge strips on frontage ---------------------------------------
    const strips = [];
    for (const b of frontage) {
      if (rand() > 0.45) continue;
      const color = new THREE.Color(NEON[Math.floor(rand() * NEON.length)]).multiplyScalar(1.1 + rand() * 0.6);
      const faceX = b.side * STREET.walkHalf - b.side * 0.02;
      const endZ = b.z + (rand() < 0.5 ? 1 : -1) * (b.d / 2);
      const hFrac = 0.35 + rand() * 0.6;
      strips.push({ x: faceX, y: 2.5 + (b.h * hFrac) / 2, z: endZ, sx: 0.12, sy: b.h * hFrac, sz: 0.12, color });
      if (rand() < 0.5) {
        // horizontal cornice strip
        strips.push({ x: faceX, y: b.h - 0.6, z: b.z, sx: 0.12, sy: 0.1, sz: b.d * 0.9, color });
      }
    }
    const stripGeo = this.disposer.track(new THREE.BoxGeometry(1, 1, 1));
    const stripMat = this.disposer.track(new THREE.MeshBasicMaterial({ toneMapped: false }));
    const stripMesh = new THREE.InstancedMesh(stripGeo, stripMat, strips.length);
    strips.forEach((s, i) => {
      m.makeScale(s.sx, s.sy, s.sz).setPosition(s.x, s.y, s.z);
      stripMesh.setMatrixAt(i, m);
      stripMesh.setColorAt(i, s.color);
    });
    stripMesh.layers.enable(LAYERS.REFLECT);
    this.group.add(stripMesh);

    // --- rooftop beacons ------------------------------------------------------
    const tall = boxes.filter((b) => b.h > 45);
    const bpos = new Float32Array(tall.length * 3);
    this.beaconColor = new Float32Array(tall.length * 3);
    const bsize = new Float32Array(tall.length);
    this.beaconPhase = tall.map(() => rand() * Math.PI * 2);
    tall.forEach((b, i) => {
      bpos.set([b.x, b.h + 1.2, b.z], i * 3);
      bsize[i] = 2.2;
    });
    const bgeo = this.disposer.track(new THREE.BufferGeometry());
    bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    bgeo.setAttribute('color', new THREE.BufferAttribute(this.beaconColor, 3));
    bgeo.setAttribute('size', new THREE.BufferAttribute(bsize, 1));
    this.glowMaterial = this.disposer.track(createGlowPointsMaterial());
    this.beacons = new THREE.Points(bgeo, this.glowMaterial);
    this.beacons.frustumCulled = false;
    this.group.add(this.beacons);

    // --- overhead cables ----------------------------------------------------
    const cableMat = this.disposer.track(new THREE.LineBasicMaterial({ color: 0x1c1b2c }));
    for (let i = 0; i < 14; i++) {
      const z = 30 - rand() * 150;
      const z2 = z + (rand() - 0.5) * 10;
      const y = 8 + rand() * 10;
      const sag = 1 + rand() * 2.5;
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        pts.push(new THREE.Vector3(-STREET.walkHalf + t * STREET.walkHalf * 2, y - Math.sin(t * Math.PI) * sag, z + (z2 - z) * t));
      }
      const line = new THREE.Line(this.disposer.track(new THREE.BufferGeometry().setFromPoints(pts)), cableMat);
      this.group.add(line);
    }

    // --- street lamps (z = 4 + 18k, matching the lamp pools in the street shader)
    const lampZ = [];
    for (let z = 4 + 18 * 3; z > -120; z -= 18) lampZ.push(z);
    const poleGeo = this.disposer.track(new THREE.BoxGeometry(0.16, 7, 0.16).translate(0, 3.5, 0));
    const armGeo = this.disposer.track(new THREE.BoxGeometry(1.4, 0.1, 0.1));
    const headGeo = this.disposer.track(new THREE.BoxGeometry(1.1, 0.07, 0.24));
    const darkMat = this.disposer.track(new THREE.MeshBasicMaterial({ color: 0x0b0b12 }));
    this.lampMat = this.disposer.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.lamp).multiplyScalar(2.2), toneMapped: false }));
    const n = lampZ.length * 2;
    const poles = new THREE.InstancedMesh(poleGeo, darkMat, n);
    const arms = new THREE.InstancedMesh(armGeo, darkMat, n);
    const heads = new THREE.InstancedMesh(headGeo, this.lampMat, n);
    let i = 0;
    for (const z of lampZ) {
      for (const side of [-1, 1]) {
        m.makeTranslation(side * 10.2, 0, z);
        poles.setMatrixAt(i, m);
        m.makeTranslation(side * 9.6, 7, z);
        arms.setMatrixAt(i, m);
        m.makeTranslation(side * 9.3, 6.94, z);
        heads.setMatrixAt(i, m);
        i++;
      }
    }
    for (const o of [poles, arms, heads]) {
      o.layers.enable(LAYERS.REFLECT);
      this.group.add(o);
    }
    this.lampFlicker = 1;
    this.lampTimer = 4;
  }

  setPointScale(s) {
    this.glowMaterial.uniforms.uScale.value = s;
  }

  update(dt, t, reducedMotion) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uFlicker.value = reducedMotion ? 0 : 1;

    const c = this.beaconColor;
    for (let i = 0; i < this.beaconPhase.length; i++) {
      const on = reducedMotion ? 0.6 : Math.max(0, Math.sin(t * 1.6 + this.beaconPhase[i])) ** 12;
      c[i * 3] = 2.2 * on + 0.15;
      c[i * 3 + 1] = 0.05 * on;
      c[i * 3 + 2] = 0.08 * on;
    }
    this.beacons.geometry.attributes.color.needsUpdate = true;

    // the street lamps share a tired transformer: rare brownouts
    if (!reducedMotion) {
      this.lampTimer -= dt;
      if (this.lampTimer < 0) {
        this.lampTimer = 6 + Math.random() * 10;
        this.brownout = 0.35;
      }
    }
    if (this.brownout > 0) {
      this.brownout -= dt;
      this.lampFlicker = Math.sin(t * 60) > 0 ? 0.25 : 0.9;
    } else this.lampFlicker = 1;
    this.lampMat.color.set(PALETTE.lamp).multiplyScalar(2.2 * this.lampFlicker);
  }

  dispose() {
    this.disposer.dispose();
  }
}

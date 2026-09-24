import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DeskItem } from './DeskItem.js';
import { CRTScreen, SCREEN_GEOMETRY } from './CRTScreen.js';
import * as T from './textures.js';
import { damp, clamp, easeOutCubic, motion } from '../utils/helpers.js';

// ---------------------------------------------------------------- shapes

function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2;
  s.moveTo(x + r, 0); s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r);
  s.lineTo(x + w, h - r); s.quadraticCurveTo(x + w, h, x + w - r, h);
  s.lineTo(x + r, h); s.quadraticCurveTo(x, h, x, h - r);
  s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0);
  return s;
}

function folderShape(w, h, r = 0.08) {
  const s = new THREE.Shape(), x = -w / 2, tabW = w * 0.4, tabH = 0.16;
  s.moveTo(x + r, 0); s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r);
  s.lineTo(x + w, h - r); s.quadraticCurveTo(x + w, h, x + w - r, h);
  s.lineTo(x + tabW + 0.1, h); s.lineTo(x + tabW - 0.04, h + tabH);
  s.lineTo(x + r, h + tabH); s.quadraticCurveTo(x, h + tabH, x, h + tabH - r);
  s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0);
  return s;
}

function starShape(outer, inner, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? inner : outer;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

const EXTRUDE_THIN = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 };

// ---------------------------------------------------------------- Folder

export class Folder extends DeskItem {
  constructor(kit, { label, section, color }) {
    super({ name: label, section, radius: 0.95 });
    const w = 1.5, h = 1.05;
    this.h = h;
    const stand = new THREE.Group();
    stand.rotation.x = -0.2;
    stand.position.z = -0.12;
    this.body.add(stand);

    stand.add(new THREE.Mesh(new THREE.ExtrudeGeometry(folderShape(w, h), EXTRUDE_THIN), kit.mats.plastic(color)));

    this.paper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, h * 0.9, 0.012), new THREE.MeshStandardMaterial({ map: kit.tex.paper, roughness: 0.7 }));
    this.paper.position.set(0.02, h * 0.5 + 0.06, 0.1);
    this.paper.rotation.z = 0.035;
    stand.add(this.paper);

    this.flapPivot = new THREE.Group();
    this.flapPivot.position.z = 0.15;
    stand.add(this.flapPivot);
    this.flapPivot.add(new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(w, h * 0.84, 0.08), EXTRUDE_THIN), kit.mats.plastic(color, { roughness: 0.24 })));

    this.flap = 0;
    this.openTimer = 0;
    this.addShadow(kit, 2.1, 0.42);
    this.addLabel(kit, label, 0.14, 0.72);
  }

  onDoubleClick() { this.openTimer = 1.7; this.poke(5); }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.openTimer = Math.max(0, this.openTimer - dt);
    const target = this.openTimer > 0 ? 1 : this.hover * 0.3 + (this.dragging ? 0.15 : 0);
    this.flap = damp(this.flap, target, this.openTimer > 0 ? 9 : 7, dt);
    this.flapPivot.rotation.x = this.flap * 1.1;
    this.paper.position.y = this.h * 0.5 + 0.06 + this.flap * 0.32;
    this.paper.rotation.z = 0.035 - this.flap * 0.08;
  }
}

// ---------------------------------------------------------------- CD

export class CD extends DeskItem {
  constructor(kit, { label, section, hue }) {
    super({ name: label, section, radius: 0.85, floatAmp: 0.06 });
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.72, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.11, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 72 });
    geo.translate(0, 0, -0.01);

    const tex = T.cd(label.toUpperCase(), hue);
    tex.repeat.set(1 / 1.44, 1 / 1.44);
    tex.offset.set(0.5, 0.5);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex, metalness: 0.85, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.6,
      iridescenceThicknessRange: [120, 720], clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide,
    });
    this.disc = new THREE.Mesh(geo, mat);
    this.tilt = new THREE.Group();
    this.tilt.position.y = 0.82;
    this.tilt.rotation.x = -0.5;
    this.tilt.add(this.disc);
    this.body.add(this.tilt);

    this.spin = 0;
    this.flipY = 0;
    this.flipTarget = 0;
    this.addShadow(kit, 1.6, 0.35);
    this.addLabel(kit, label, 0.12, 0.62);
  }

  onClick() { this.flipTarget += Math.PI * 2; this.poke(5); }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    const idle = motion.reduced ? 0 : 0.5;
    const target = this.hoverTarget ? 18 : this.dragging ? 6 : idle;
    this.spin = damp(this.spin, target, this.hoverTarget ? 3 : 1.2, dt);
    this.disc.rotation.z -= this.spin * dt;
    this.flipY = damp(this.flipY, this.flipTarget, 5, dt);
    this.tilt.rotation.y = this.flipY;
    this.tilt.rotation.x = -0.5 + this.hover * 0.18;
  }
}

// ---------------------------------------------------------------- Floppy

export class Floppy extends DeskItem {
  constructor(kit, { label, sub, section, color, stripe = '#ff6fd8' }) {
    super({ name: label, section, radius: 0.78 });
    this.tilt = new THREE.Group();
    this.tilt.position.y = 0.56;
    this.tilt.rotation.x = -0.3;
    this.body.add(this.tilt);

    this.tilt.add(new THREE.Mesh(kit.geo.floppy, kit.mats.plastic(color, { roughness: 0.28 })));
    this.shutter = new THREE.Mesh(kit.geo.shutter, kit.mats.chrome);
    this.shutter.position.set(0.08, 0.3, 0);
    this.tilt.add(this.shutter);
    const lbl = new THREE.Mesh(kit.geo.floppyLabel, new THREE.MeshStandardMaterial({ map: T.floppyLabel(label.toUpperCase(), sub, stripe), roughness: 0.6 }));
    lbl.position.set(0, -0.17, 0.047);
    this.tilt.add(lbl);

    this.flip = 0;
    this.flipTarget = 0;
    this.addShadow(kit, 1.5, 0.38);
    this.addLabel(kit, label, 0.12, 0.62);
  }

  onClick() { this.flipTarget += Math.PI; this.poke(5); }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.shutter.position.x = 0.08 - this.hover * 0.18;
    this.flip = damp(this.flip, this.flipTarget, 6, dt);
    this.tilt.rotation.y = this.flip;
  }
}

// ---------------------------------------------------------------- Computer (translucent CRT)

export class Computer extends DeskItem {
  constructor(kit) {
    super({ name: 'My Computer', section: 'computer', radius: 1.6, floatAmp: 0, mass: 4 });
    const aqua = kit.mats.plastic('#39c6f0', { roughness: 0.16, thickness: 1.4 });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 0.16, 40), kit.mats.pearl);
    foot.position.y = 0.08;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 0.4, 28), aqua);
    neck.position.y = 0.36;
    this.body.add(foot, neck);

    this.head = new THREE.Group();
    this.head.position.y = 1.5;
    this.body.add(this.head);

    this.head.add(new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.95, 1.8, 6, 0.42), aqua));
    const guts = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.3, 1.05, 2, 0.1), kit.mats.dark);
    guts.position.z = -0.25;
    this.head.add(guts);
    const capGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 16);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(capGeo, kit.mats.chrome);
      c.position.set(-0.55 + i * 0.27, 0.72, -0.35 + (i % 2) * 0.2);
      this.head.add(c);
    }
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.98, 1.62, 0.16, 4, 0.08), kit.mats.pearl);
    bezel.position.z = 0.86;
    this.head.add(bezel);

    this.screen = new CRTScreen();
    const scr = new THREE.Mesh(SCREEN_GEOMETRY(), new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false }));
    scr.position.set(0, 0.04, 0.9);
    this.head.add(scr);
    const glare = new THREE.Mesh(scr.geometry, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1 }));
    glare.position.set(0, 0.04, 0.915);
    this.head.add(glare);

    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xc6ff4d, toneMapped: false }));
    this.led.position.set(0.82, -0.7, 0.95);
    this.head.add(this.led);
    this.ledPulse = 0;

    this.addShadow(kit, 3.4, 0.5);
    this.addLabel(kit, 'My Computer', 0.12, 1.25);
  }

  onClick() { this.screen.nextMood(); this.poke(2.5); this.ledPulse = 1; }
  onDoubleClick() { this.screen.setMood('love', 2); this.poke(3); }
  type(key) { this.ledPulse = 1; return this.screen.type(key); }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    // The monitor gently turns to look at the cursor.
    const dx = ctx.pointer.x - this.pos.x, dz = ctx.pointer.y - this.pos.y;
    const yaw = ctx.pointerActive ? clamp(Math.atan2(dx, Math.max(0.6, dz)), -0.45, 0.45) : 0;
    const pitch = ctx.pointerActive ? clamp(-dz * 0.03, -0.12, 0.08) : 0;
    this.head.rotation.y = damp(this.head.rotation.y, yaw, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, pitch, 3, dt);
    this.screen.lookX = damp(this.screen.lookX, yaw / 0.45, 4, dt);
    this.screen.update(dt, t);
    this.ledPulse = Math.max(0, this.ledPulse - dt * 4);
    this.led.material.color.setHSL(0.22 - this.ledPulse * 0.3, 1, 0.55 + this.ledPulse * 0.2);
  }

  dispose() { this.screen.dispose(); }
}

// ---------------------------------------------------------------- Keyboard

export class Keyboard extends DeskItem {
  constructor(kit) {
    super({ name: 'Keyboard', radius: 1.25, floatAmp: 0, mass: 2 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.14, 0.9, 3, 0.06), kit.mats.plastic('#39c6f0', { roughness: 0.2 }));
    base.position.y = 0.07;
    base.rotation.x = 0.05;
    this.body.add(base);
    this.cols = 13; this.rows = 3;
    const count = this.cols * this.rows + 1;
    this.keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.15, 0.08, 0.15, 2, 0.03), kit.mats.keycap, count);
    this.press = new Float32Array(count);
    this.dummy = new THREE.Object3D();
    this.body.add(this.keys);
    this.layout();
    this.addShadow(kit, 2.9, 0.35);
  }

  layout() {
    const d = this.dummy;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        d.position.set(-0.99 + c * 0.165 + r * 0.04, 0.17 - this.press[i] * 0.045 - r * 0.01, -0.28 + r * 0.19);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this.keys.setMatrixAt(i, d.matrix);
      }
    }
    const s = this.cols * this.rows;
    d.position.set(0.05, 0.14 - this.press[s] * 0.045, 0.3);
    d.scale.set(5.5, 1, 1);
    d.updateMatrix();
    this.keys.setMatrixAt(s, d.matrix);
    this.keys.instanceMatrix.needsUpdate = true;
  }

  pressKey(key) {
    const n = this.press.length;
    const i = key === ' ' ? n - 1 : key.length === 1 ? key.toLowerCase().charCodeAt(0) % (n - 1) : Math.floor(Math.random() * (n - 1));
    this.press[i] = 1;
    this.poke(0.6);
  }

  onClick() { for (let i = 0; i < 6; i++) this.press[Math.floor(Math.random() * this.press.length)] = 1; this.poke(2); }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    let active = false;
    const k = Math.exp(-12 * dt);
    for (let i = 0; i < this.press.length; i++) {
      if (this.press[i] > 0.001) { this.press[i] *= k; active = true; } else this.press[i] = 0;
    }
    if (active || this._wasActive) this.layout();
    this._wasActive = active;
  }
}

// ---------------------------------------------------------------- Chrome star

export class ChromeStar extends DeskItem {
  constructor(kit) {
    super({ name: 'Star', radius: 0.7, floatAmp: 0.08 });
    const geo = new THREE.ExtrudeGeometry(starShape(0.55, 0.24), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 5, curveSegments: 4 });
    geo.center();
    this.star = new THREE.Mesh(geo, kit.mats.chrome);
    this.star.position.y = 0.78;
    this.body.add(this.star);
    this.spin = 0.6;
    this.addShadow(kit, 1.3, 0.35);
  }
  onClick() { this.spin += 22; this.poke(6); }
  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    const base = motion.reduced ? 0 : 0.6 + this.hover * 2.5;
    this.spin = damp(this.spin, base, 1.4, dt);
    this.star.rotation.y += this.spin * dt;
  }
}

// ---------------------------------------------------------------- Chrome smiley

export class Smiley extends DeskItem {
  constructor(kit) {
    super({ name: 'Smiley', radius: 0.6, floatAmp: 0.02 });
    this.ball = new THREE.Group();
    this.ball.position.y = 0.5;
    this.body.add(this.ball);
    this.ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 48, 32), kit.mats.chrome));
    const eyeGeo = new THREE.CapsuleGeometry(0.045, 0.1, 4, 8);
    for (const x of [-0.15, 0.15]) {
      const e = new THREE.Mesh(eyeGeo, kit.mats.ink);
      e.position.set(x, 0.1, 0.44);
      this.ball.add(e);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24, Math.PI), kit.mats.ink);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.02, 0.42);
    this.ball.add(mouth);

    this.shades = new THREE.Group();
    const lensGeo = new RoundedBoxGeometry(0.24, 0.13, 0.05, 2, 0.03);
    for (const x of [-0.15, 0.15]) {
      const l = new THREE.Mesh(lensGeo, kit.mats.ink);
      l.position.set(x, 0.1, 0.47);
      this.shades.add(l);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), kit.mats.ink);
    bridge.position.set(0, 0.13, 0.48);
    this.shades.add(bridge);
    this.shades.scale.setScalar(0.001);
    this.ball.add(this.shades);
    this.cool = false;

    this.jumpY = 0; this.jumpV = 0; this.roll = 0; this.clicks = [];
    this.addShadow(kit, 1.2, 0.45);
  }

  /** Returns true the moment the secret is unlocked. */
  onClick() {
    this.jumpV = 5.5;
    this.roll += Math.PI * 2;
    this.poke(-4);
    const now = performance.now();
    this.clicks = this.clicks.filter((c) => now - c < 3000);
    this.clicks.push(now);
    if (!this.cool && this.clicks.length >= 7) { this.cool = true; return true; }
    return false;
  }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 22 * dt;
      this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.jumpV = 0; this.poke(5); }
    }
    this.ball.position.y = 0.5 + this.jumpY;
    this.ball.rotation.x = damp(this.ball.rotation.x, this.roll + this.vel.y * 0.3, 6, dt);
    this.ball.rotation.z = damp(this.ball.rotation.z, -this.vel.x * 0.25, 6, dt);
    const s = damp(this.shades.scale.x, this.cool ? 1 : 0.001, 8, dt);
    this.shades.scale.setScalar(s);
  }
}

// ---------------------------------------------------------------- Voxel hourglass

const HOURGLASS = [
  '#########',
  '.#.....#.',
  '.#sssss#.',
  '.#.sss.#.',
  '..#.s.#..',
  '...#s#...',
  '..#.s.#..',
  '.#..s..#.',
  '.#.sss.#.',
  '.#sssss#.',
  '#########',
];

export class Hourglass extends DeskItem {
  constructor(kit) {
    super({ name: 'Hourglass', radius: 0.6, floatAmp: 0.07 });
    const size = 0.1;
    const cells = [];
    HOURGLASS.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push([x, y, ch]); }));
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size * 0.92, size * 0.92, size * 0.92), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.35 }), cells.length);
    const d = new THREE.Object3D();
    const cFrame = new THREE.Color('#38c8ff'), cCap = new THREE.Color('#ff6fd8'), cSand = new THREE.Color('#ffe66b');
    cells.forEach(([x, y, ch], i) => {
      d.position.set((x - 4) * size, (5 - y) * size, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, ch === 's' ? cSand : y === 0 || y === 10 ? cCap : cFrame);
    });
    this.glass = new THREE.Group();
    this.glass.position.y = 0.72;
    this.glass.add(mesh);
    this.body.add(this.glass);
    this.flip = 0; this.flipTarget = 0;
    this.addShadow(kit, 1.1, 0.35);
  }
  onClick() { this.flipTarget += Math.PI; this.poke(4); }
  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.flip = damp(this.flip, this.flipTarget, 5, dt);
    this.glass.rotation.z = this.flip;
    if (!motion.reduced) this.glass.rotation.y += dt * (0.5 + this.hover * 2);
  }
}

// ---------------------------------------------------------------- Recycle bin

export class Bin extends DeskItem {
  constructor(kit) {
    super({ name: 'Recycle Bin', radius: 0.75, floatAmp: 0, mass: 2 });
    const can = new THREE.Group();
    can.position.y = 0.52;
    this.body.add(can);
    this.can = can;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.44, 1.0, 40, 1, true), kit.mats.plastic('#8fe3ff', { side: THREE.DoubleSide, roughness: 0.2 }));
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.455, 1.0, 18, 7, true), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, wireframe: true }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), kit.mats.pearl);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.49;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 12, 48), kit.mats.chrome);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.5;
    can.add(glass, mesh, floor, rim);
    this.queue = [];
    this.addShadow(kit, 1.5, 0.4);
    this.addLabel(kit, 'Recycle Bin', 0.1, 0.78);
  }

  accepts(item) {
    return item !== this && item.layer === 'desk' && !item.captured && item.mass < 3 && item.pos.distanceTo(this.pos) < this.radius + 0.45;
  }

  swallow(item) {
    item.captured = true;
    item.vel.set(0, 0);
    this.queue.push({ item, t: 0, from: item.pos.clone(), ejected: false });
    this.poke(-5);
  }

  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.can.rotation.z = damp(this.can.rotation.z, 0, 6, dt) + Math.sin(t * 40) * Math.max(0, this.sq) * 0.03;
    for (const q of this.queue) {
      q.t += dt;
      const { item } = q;
      if (q.t < 0.45) {
        const e = easeOutCubic(q.t / 0.45);
        item.pos.lerpVectors(q.from, this.pos, e);
        item.presenceTarget = 0.05;
      } else if (!q.ejected && q.t > 1.15) {
        q.ejected = true;
        const a = Math.atan2(q.from.y - this.pos.y, q.from.x - this.pos.x) + (Math.random() - 0.5) * 0.8;
        item.pos.set(this.pos.x + Math.cos(a) * 0.9, this.pos.y + Math.sin(a) * 0.9);
        item.vel.set(Math.cos(a) * 7, Math.sin(a) * 7);
        item.presenceTarget = 1;
        item.captured = false;
        item.poke(8);
        this.poke(7);
        ctx.onBinEject?.(item);
      } else if (!q.ejected && q.t > 0.5) {
        this.can.rotation.z = Math.sin(q.t * 30) * 0.08;
      }
    }
    this.queue = this.queue.filter((q) => !q.ejected);
  }
}

// ---------------------------------------------------------------- Sticky note

export class Sticky extends DeskItem {
  constructor(kit, { lines, color, rot = 0 }) {
    super({ name: 'Note', radius: 0.55, floatAmp: 0 });
    const geo = new THREE.PlaneGeometry(0.95, 0.95, 6, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.max(0, -y - 0.2) * Math.max(0, x + 0.1) * 0.35);
    }
    geo.computeVertexNormals();
    this.note = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.sticky(lines, color), roughness: 0.8, side: THREE.DoubleSide }));
    this.note.rotation.set(-Math.PI / 2, 0, rot);
    this.note.position.y = 0.012;
    this.body.add(this.note);
    this.flutter = 0;
    this.addShadow(kit, 1.05, 0.18);
  }
  onClick() { this.flutter = 1; this.poke(2); }
  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.flutter = Math.max(0, this.flutter - dt * 1.6);
    this.note.rotation.x = -Math.PI / 2 + Math.sin(this.flutter * 18) * this.flutter * 0.25 + this.hover * 0.1;
  }
}

// ---------------------------------------------------------------- Floating window

export class FloatWindow extends DeskItem {
  constructor(kit, { kind, section, height }) {
    super({ name: kind, section, radius: 1.3, height, floatAmp: 0.12, layer: 'air' });
    this.clickOpens = true;
    this.tilt = new THREE.Group();
    this.tilt.rotation.x = -0.28;
    this.body.add(this.tilt);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.62, 0.06, 3, 0.03), kit.mats.plastic('#cdefff', { roughness: 0.08 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 1.56), new THREE.MeshBasicMaterial({ map: T.windowFace(kind), transparent: true, toneMapped: false }));
    face.position.z = 0.035;
    this.tilt.add(panel, face);
    this.addShadow(kit, 2.8, 0.22);
  }
  update(dt, t, ctx) {
    super.update(dt, t, ctx);
    this.tilt.rotation.y = damp(this.tilt.rotation.y, (ctx.pointer.x - this.pos.x) * 0.02 * this.hover, 4, dt);
  }
}

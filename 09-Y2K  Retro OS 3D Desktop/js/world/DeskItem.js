import * as THREE from 'three';
import { damp, clamp, easeOutBack, motion } from '../utils/helpers.js';

/**
 * Base class for everything that lives on the desk.
 *
 * Hierarchy:  root (desk-plane position)  →  lift (hover / drag height, lean, squash)  →  body (item geometry)
 * Physics are 2D on the desk plane with inertial throws, soft bounds and a squash spring.
 */
export class DeskItem {
  constructor({ name = '', section = null, radius = 0.8, height = 0, floatAmp = 0.035, layer = 'desk', mass = 1 } = {}) {
    this.name = name;
    this.section = section;
    this.radius = radius;
    this.height = height;
    this.floatAmp = floatAmp;
    this.layer = layer;
    this.mass = mass;

    this.root = new THREE.Group();
    this.lift = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.lift);
    this.lift.add(this.body);

    this.pos = new THREE.Vector2();
    this.vel = new THREE.Vector2();
    this.dragTarget = new THREE.Vector2();
    this.dragging = false;
    this.captured = false; // controlled by something else (e.g. recycle bin)
    this.hover = 0;
    this.hoverTarget = 0;
    this.liftY = 0;
    this.lean = new THREE.Vector2();
    this.sq = 0; this.sqv = 0;
    this.presence = 1; this.presenceTarget = 1;
    this.phase = Math.random() * Math.PI * 2;
    this.appear = 0;
    this.appearDelay = 0;
    this.spinZeroG = 0;
    this.shadow = null;
  }

  place(x, z) { this.pos.set(x, z); this.root.position.set(x, 0, z); return this; }

  /** Tag every mesh so raycasts can resolve back to this item. */
  bind() {
    this.root.traverse((o) => { if (o.isMesh || o.isSprite) o.userData.item = this; });
    return this;
  }

  addShadow(kit, size = 1.6, opacity = 0.4) {
    const m = new THREE.Mesh(kit.geo.shadowPlane, new THREE.MeshBasicMaterial({ map: kit.tex.shadow, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.004;
    m.scale.setScalar(size);
    m.renderOrder = 1;
    this.shadowBase = size;
    this.shadowOpacity = opacity;
    this.shadow = m;
    this.root.add(m);
  }

  addLabel(kit, text, y = 0.1, z = 0.9) {
    const { texture, aspect } = kit.labelTexture(text);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8, depthWrite: false }));
    const h = 0.24;
    sprite.scale.set(h * aspect, h, 1);
    sprite.position.set(0, y, z);
    sprite.renderOrder = 5;
    this.labelSprite = sprite;
    this.labelScale = sprite.scale.clone();
    this.root.add(sprite);
  }

  poke(amount = 4) { this.sqv += amount; }
  setHover(on) { this.hoverTarget = on ? 1 : 0; }

  // Interaction hooks — subclasses override.
  onClick() { this.poke(3.5); }
  onDoubleClick() { this.poke(5); }
  onGrab() { this.poke(-2.5); }
  onDrop() { this.poke(4); }

  update(dt, t, ctx) {
    // ---- entrance ----
    if (ctx.introTime > this.appearDelay) this.appear = Math.min(1, this.appear + dt / 0.75);
    const appear = this.appear >= 1 ? 1 : easeOutBack(this.appear);
    this.root.visible = this.appear > 0;

    // ---- planar physics ----
    if (this.captured) {
      // position driven externally
    } else if (this.dragging) {
      const px = this.pos.x, pz = this.pos.y;
      const k = 1 - Math.exp(-24 * dt);
      this.pos.x += (this.dragTarget.x - this.pos.x) * k;
      this.pos.y += (this.dragTarget.y - this.pos.y) * k;
      const s = 1 - Math.exp(-12 * dt);
      this.vel.x += ((this.pos.x - px) / dt - this.vel.x) * s;
      this.vel.y += ((this.pos.y - pz) / dt - this.vel.y) * s;
    } else {
      this.pos.addScaledVector(this.vel, dt);
      this.vel.multiplyScalar(Math.exp(-3.4 * dt));
    }

    const b = ctx.bounds, r = this.radius * 0.6;
    if (this.pos.x < b.minX + r) { this.pos.x = b.minX + r; this.vel.x = Math.abs(this.vel.x) * 0.55; this.poke(Math.min(6, Math.abs(this.vel.x) * 0.5)); }
    if (this.pos.x > b.maxX - r) { this.pos.x = b.maxX - r; this.vel.x = -Math.abs(this.vel.x) * 0.55; this.poke(Math.min(6, Math.abs(this.vel.x) * 0.5)); }
    if (this.pos.y < b.minZ + r) { this.pos.y = b.minZ + r; this.vel.y = Math.abs(this.vel.y) * 0.55; this.poke(Math.min(6, Math.abs(this.vel.y) * 0.5)); }
    if (this.pos.y > b.maxZ - r) { this.pos.y = b.maxZ - r; this.vel.y = -Math.abs(this.vel.y) * 0.55; this.poke(Math.min(6, Math.abs(this.vel.y) * 0.5)); }

    // ---- lift, hover, float ----
    this.hover = damp(this.hover, this.hoverTarget, 12, dt);
    const zeroG = ctx.zeroG * (1.3 + Math.sin(t * 0.9 + this.phase) * 0.5);
    const liftTarget = (this.dragging ? 0.6 : 0) + this.hover * 0.14 + zeroG;
    this.liftY = damp(this.liftY, liftTarget, this.dragging ? 12 : 7, dt);
    const bob = motion.reduced ? 0 : Math.sin(t * 1.25 + this.phase) * this.floatAmp;
    this.lift.position.y = this.height + this.liftY + bob;

    // ---- lean into motion ----
    const lx = clamp(this.vel.x * 0.045, -0.4, 0.4);
    const lz = clamp(this.vel.y * 0.045, -0.4, 0.4);
    this.lean.x = damp(this.lean.x, lx, 9, dt);
    this.lean.y = damp(this.lean.y, lz, 9, dt);
    this.spinZeroG = damp(this.spinZeroG, ctx.zeroG * Math.sin(t * 0.7 + this.phase) * 0.6, 2, dt);
    this.lift.rotation.set(this.lean.y + this.spinZeroG * 0.5, this.spinZeroG, -this.lean.x);

    // ---- squash & stretch spring ----
    const acc = -180 * this.sq - 12 * this.sqv;
    this.sqv += acc * dt;
    this.sq += this.sqv * dt;
    this.sq = clamp(this.sq, -0.6, 0.6);
    const s = this.sq * 0.16;
    this.presence = damp(this.presence, this.presenceTarget, 9, dt);
    const scale = appear * this.presence;
    this.lift.scale.set((1 + s) * scale, (1 - s) * scale, (1 + s) * scale);

    this.root.position.set(this.pos.x, 0, this.pos.y);

    if (this.shadow) {
      const h = this.liftY + bob + (this.layer === 'air' ? this.height * 0.4 : 0);
      const sc = this.shadowBase * (1 + h * 0.35) * scale;
      this.shadow.scale.set(sc, sc, 1);
      this.shadow.material.opacity = this.shadowOpacity * appear / (1 + h * 1.1);
    }
    if (this.labelSprite) {
      const k = (1 + this.hover * 0.12) * appear * this.presence;
      this.labelSprite.scale.set(this.labelScale.x * k, this.labelScale.y * k, 1);
      this.labelSprite.material.opacity = 0.72 + this.hover * 0.28;
      this.labelSprite.position.y = this.labelBaseY ?? (this.labelBaseY = this.labelSprite.position.y);
    }
  }
}

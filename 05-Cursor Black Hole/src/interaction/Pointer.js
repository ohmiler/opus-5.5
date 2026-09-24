import * as THREE from 'three';
import { damp, easeOutQuad } from '../utils/math.js';

const CLICK_MS = 220;
const CHARGE_SECONDS = 2.2;

/**
 * The cursor as a massive body. Tracks screen + world position, builds charge while held,
 * and turns clicks / releases into detonations on the event bus.
 *
 *   hover   → presence fades in, mass 1
 *   hold    → charge builds over ~2s: mass up to ~4.4, reach and horizon grow
 *   click   → short press: detonation + brief negative mass (repulsion)
 *   release → after a hold: launch scaled by the stored charge
 */
export class Pointer {
  constructor({ bus, coarse = false, reducedMotion = false }) {
    this.bus = bus;
    this.coarse = coarse;
    this.reducedMotion = reducedMotion;

    this.client = { x: innerWidth / 2, y: innerHeight / 2 };
    this.ndc = new THREE.Vector2();
    this.ndcSmooth = new THREE.Vector2();
    this.world = new THREE.Vector3(0, 0, 100);
    this.ground = new THREE.Vector3(0, 0, 100);
    this.velocity = new THREE.Vector3();
    this.groundY = -0.8;

    this.type = coarse ? 'touch' : 'mouse';
    this.inside = false;
    this.presence = 0;
    this.isDown = false;
    this.charge = 0;
    this.repulse = 0;
    this.mass = 0;
    this.reach = 3;
    this.horizon = 0.28;

    this._moved = false;
    this._primed = false;
    this._downAt = 0;
    this._flash = 0;
    this._flashLabel = '';
    this._prevWorld = new THREE.Vector3();
    this._inst = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._dir = new THREE.Vector3();
    this._hit = new THREE.Vector3();

    this._onMove = (e) => this._setClient(e);
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    this._onCancel = () => this._cancel();
    this._onLeave = () => { if (!this.isDown) this.inside = false; };

    addEventListener('pointermove', this._onMove, { passive: true });
    addEventListener('pointerdown', this._onDown);
    addEventListener('pointerup', this._onUp);
    addEventListener('pointercancel', this._onCancel);
    addEventListener('blur', this._onCancel);
    document.documentElement.addEventListener('mouseleave', this._onLeave);
  }

  get chargeEased() {
    return easeOutQuad(this.charge);
  }

  /** Short label for the HUD readout. */
  get state() {
    if (this._flash > 0) return this._flashLabel;
    if (this.isDown) return `charging ${Math.round(this.charge * 100)}%`;
    if (this.presence < 0.15) return 'at rest';
    return this.inside ? 'attracting' : 'wandering';
  }

  _setClient(e) {
    this.client.x = e.clientX;
    this.client.y = e.clientY;
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.type = e.pointerType || 'mouse';
    this.inside = this.type !== 'touch' || this.isDown || e.type === 'pointerdown';
    this._moved = true;
  }

  _down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('a, button, [data-no-gravity]')) return;
    this._setClient(e);
    if (e.pointerType === 'touch') {
      // A finger teleports; don't read the jump as velocity.
      this._primed = false;
      this.ndcSmooth.copy(this.ndc);
    }
    this.isDown = true;
    this._downAt = performance.now();
    this.bus.emit('press', { x: this.client.x, y: this.client.y });
  }

  _up(e) {
    if (!this.isDown) return;
    this.isDown = false;
    const held = performance.now() - this._downAt;
    if (held < CLICK_MS && this.charge < 0.2) this._detonate('click', 0);
    else this._detonate('release', this.charge);
    this.charge = 0;
    if (e.pointerType === 'touch') this.inside = false;
  }

  /** The browser took the gesture (e.g. touch scroll) — let go quietly. */
  _cancel() {
    this.isDown = false;
    this.charge = 0;
    if (this.type === 'touch') this.inside = false;
  }

  _detonate(kind, charge) {
    const c = easeOutQuad(charge);
    const d = kind === 'click'
      ? { strength: 7.5, radius: 2.3, spin: 0.8, power: 0.7 }
      : { strength: 4.5 + c * 12, radius: 1.8 + c * 2.2, spin: 1 + c * 3.5, power: 0.5 + c * 1.4 };
    this.repulse = kind === 'click' ? 2.8 : 1.2 + c * 3.8;
    this._flash = 0.9;
    this._flashLabel = kind === 'click' ? 'detonation' : `launch ${Math.round(charge * 100)}%`;
    this.bus.emit('detonate', { kind, charge, ...d, x: this.client.x, y: this.client.y });
  }

  update(dt, camera, focus, time) {
    // Touch screens have no hover, so a faint body wanders on its own until a finger lands.
    const ghost = this.coarse && !this.reducedMotion && !this.inside && !this.isDown;
    if (ghost) this.ndc.set(Math.sin(time * 0.21) * 0.42, Math.sin(time * 0.29 + 1.3) * 0.26 + 0.05);

    const presenceTarget = this.inside ? 1 : ghost ? 0.45 : 0;
    this.presence = damp(this.presence, presenceTarget, this.inside ? 5 : 2.5, dt);
    this.ndcSmooth.x = damp(this.ndcSmooth.x, this.ndc.x, 22, dt);
    this.ndcSmooth.y = damp(this.ndcSmooth.y, this.ndc.y, 22, dt);
    if (ghost) {
      this.client.x = ((this.ndcSmooth.x + 1) / 2) * innerWidth;
      this.client.y = ((1 - this.ndcSmooth.y) / 2) * innerHeight;
    }

    if (this.isDown) this.charge = Math.min(1, this.charge + dt / CHARGE_SECONDS);
    this.repulse = damp(this.repulse, 0, 2.6, dt);
    this._flash = Math.max(0, this._flash - dt);

    const c = this.chargeEased;
    this.mass = this.presence * (1 + c * 3.4) - this.repulse;
    this.reach = 2.5 + c * 3.2;
    this.horizon = 0.28 + c * 0.22;

    // Project onto the camera-facing plane through the focus point, so the pull feels
    // identical from every camera angle.
    this._ray.setFromCamera(this.ndcSmooth, camera);
    camera.getWorldDirection(this._dir);
    this._plane.setFromNormalAndCoplanarPoint(this._dir, focus);
    if (this._ray.ray.intersectPlane(this._plane, this._hit)) {
      if (this._primed && this._moved) {
        // Velocity only from actual hand movement — camera moves during scroll shouldn't create a wake.
        this._inst.subVectors(this._hit, this._prevWorld).divideScalar(Math.max(dt, 1e-3));
        this.velocity.lerp(this._inst, 1 - Math.exp(-14 * dt));
      } else {
        this.velocity.multiplyScalar(Math.exp(-6 * dt));
      }
      this.velocity.clampLength(0, 30);
      this.world.copy(this._hit);
      this._prevWorld.copy(this._hit);
      this._primed = true;
    }

    this._groundPlane.constant = -this.groundY;
    if (this._ray.ray.intersectPlane(this._groundPlane, this._hit)) this.ground.copy(this._hit);

    this._moved = false;
  }

  dispose() {
    removeEventListener('pointermove', this._onMove);
    removeEventListener('pointerdown', this._onDown);
    removeEventListener('pointerup', this._onUp);
    removeEventListener('pointercancel', this._onCancel);
    removeEventListener('blur', this._onCancel);
    document.documentElement.removeEventListener('mouseleave', this._onLeave);
  }
}

import * as THREE from 'three';
import { damp } from '../core/math.js';

/** Normalised pointer state with smoothed speed; emits `press` on the bus. */
export class Pointer {
  constructor(bus) {
    this.bus = bus;
    this.ndc = new THREE.Vector2();
    this.prev = new THREE.Vector2();
    this.speed = 0;
    this.active = false;
    this.down = false;

    this._move = (e) => {
      this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      if (!this.active) this.prev.copy(this.ndc);
      this.active = true;
    };
    this._down = (e) => {
      this._move(e);
      this.down = true;
      this.bus.emit('press', { target: e.target, pointerType: e.pointerType });
    };
    this._up = (e) => {
      this.down = false;
      // A lifted finger is no longer "near" the glass.
      if (e.pointerType === 'touch') this.active = false;
    };
    this._leave = () => { this.active = false; this.down = false; };

    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerdown', this._down, { passive: true });
    window.addEventListener('pointerup', this._up, { passive: true });
    window.addEventListener('pointercancel', this._up, { passive: true });
    document.documentElement.addEventListener('pointerleave', this._leave);
  }

  update(dt) {
    const instant = this.ndc.distanceTo(this.prev) / Math.max(dt, 1e-4);
    this.speed = damp(this.speed, instant, 6, dt);
    this.prev.copy(this.ndc);
  }

  dispose() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
    document.documentElement.removeEventListener('pointerleave', this._leave);
  }
}

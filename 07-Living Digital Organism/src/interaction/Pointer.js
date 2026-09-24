import * as THREE from 'three';
import { clamp } from '../utils/math.js';

const CLICK_MOVE_PX = 7;
const CLICK_MS = 450;

/**
 * Normalises mouse / touch input into: ndc position, a world-space point
 * near the organism, proximity, drag velocity, taps, and idleness.
 */
export class Pointer {
  constructor({ bus, target = window }) {
    this.bus = bus;
    this.target = target;
    this.ndc = new THREE.Vector2(0, 0);
    this.client = { x: innerWidth / 2, y: innerHeight / 2 };
    this.inside = false;
    this.down = null;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.lastActivity = performance.now();
    this.dragDX = 0;
    this.raycaster = new THREE.Raycaster();
    this.world = new THREE.Vector3();
    this._closest = new THREE.Vector3();

    this.handlers = {
      pointermove: (e) => this.onMove(e),
      pointerdown: (e) => this.onDown(e),
      pointerup: (e) => this.onUp(e),
      pointerleave: () => { this.inside = false; },
      pointercancel: () => { this.down = null; },
      scroll: () => this.touch(),
      keydown: () => this.touch(),
      wheel: () => this.touch(),
    };
    for (const [k, fn] of Object.entries(this.handlers)) {
      (k === 'pointerleave' ? document.documentElement : target).addEventListener(k, fn, { passive: true });
    }
  }

  touch() { this.lastActivity = performance.now(); }

  isUi(e) { return !!e.target.closest?.('button, a, input'); }

  onMove(e) {
    this.touch();
    this.inside = true;
    this.client.x = e.clientX; this.client.y = e.clientY;
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (this.down && e.pointerType === 'mouse') {
      const dx = e.clientX - this.down.lastX;
      this.down.lastX = e.clientX;
      this.down.moved = Math.max(this.down.moved, Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y));
      if (this.down.moved > CLICK_MOVE_PX) this.dragDX += dx;
    }
  }

  onDown(e) {
    if (this.isUi(e)) return;
    this.onMove(e);
    this.down = { x: e.clientX, y: e.clientY, lastX: e.clientX, t: performance.now(), moved: 0 };
    this.bus.emit('press', {});
  }

  onUp(e) {
    const d = this.down;
    this.down = null;
    if (!d) return;
    this.bus.emit('release', {});
    if (d.moved < CLICK_MOVE_PX && performance.now() - d.t < CLICK_MS) {
      this.bus.emit('tap', { x: e.clientX, y: e.clientY });
    }
  }

  /** Drag delta in px since the last call (consumed). */
  consumeDrag() { const d = this.dragDX; this.dragDX = 0; return d; }

  /** 0 while active, ramps to 1 after ~4–14 s without input. */
  idleness(now = performance.now()) { return clamp((now - this.lastActivity - 4000) / 10000); }

  /**
   * Cast the cursor ray and find the point on it closest to `center`.
   * Returns proximity 0..1 based on ray-to-center distance vs. apparent radius.
   */
  probe(camera, center, radius) {
    this.raycaster.setFromCamera(this.ndc, camera);
    const ray = this.raycaster.ray;
    ray.closestPointToPoint(center, this._closest);
    const dist = this._closest.distanceTo(center);
    this.world.copy(this._closest);
    const active = this.inside || this.coarse;
    const prox = active ? 1 - clamp((dist - radius * 0.6) / (radius * 1.6)) : 0;
    return { world: this.world, proximity: prox * prox * (3 - 2 * prox), distance: dist };
  }

  dispose() {
    for (const [k, fn] of Object.entries(this.handlers)) {
      (k === 'pointerleave' ? document.documentElement : this.target).removeEventListener(k, fn);
    }
  }
}

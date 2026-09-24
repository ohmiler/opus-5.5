import * as THREE from 'three';
import { Emitter } from '../utils/Emitter.js';
import { clamp } from '../utils/math.js';
import { env } from '../utils/env.js';

// Translates raw DOM input into camera intentions.
//
//  wheel         → travel along the corridor (+ a little momentum)
//  drag  ↕       → travel (flick to glide)
//  drag  ↔       → drift sideways between walls
//  pointer move  → parallax + card attention
//  arrows/space  → keyboard travel; Esc closes, ←/→ step through projects
//
// Emits: 'tap' {ndc}, 'dragstart', 'dragend', 'key' {key}, 'move'.
export class Input extends Emitter {
  constructor(target, rig) {
    super();
    this.target = target;
    this.rig = rig;
    this.locked = false;

    this.pointer = new THREE.Vector2(0, 0); // NDC
    this.client = { x: innerWidth / 2, y: innerHeight / 2 };
    this.hasPointer = false;
    this.dragging = false;
    this.down = null;
    this.samples = [];

    this._onWheel = this._onWheel.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onLeave = () => this.rig.setPointer(0, 0);

    target.addEventListener('wheel', this._onWheel, { passive: false });
    target.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKey);
    document.documentElement.addEventListener('mouseleave', this._onLeave);
  }

  _onWheel(e) {
    e.preventDefault();
    if (this.locked) return;
    let dy = e.deltaY;
    let dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; }
    else if (e.deltaMode === 2) { dy *= innerHeight; dx *= innerHeight; }
    dy = clamp(dy, -240, 240);
    this.rig.addScroll(-dy * 0.016);
    this.rig.setScrollVelocity(this.rig.scrollVelocity - dy * 0.008);
    if (Math.abs(dx) > 0.5) this.rig.addPan(dx * 0.004, 0);
    this.emit('travel', { amount: dy });
  }

  _onDown(e) {
    if (e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
    this.last = { x: e.clientX, y: e.clientY };
    this.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    this.rig.setScrollVelocity(0);
    this.rig.setPanVelocity(0, 0);
    this._updatePointer(e);
  }

  _onMove(e) {
    this._updatePointer(e);
    this.emit('move', e);
    if (!this.down || e.pointerId !== this.down.id) return;

    const dist = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    if (!this.dragging && dist > (e.pointerType === 'touch' ? 8 : 5) && !this.locked) {
      this.dragging = true;
      this.emit('dragstart');
    }
    if (!this.dragging) return;

    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.last = { x: e.clientX, y: e.clientY };
    const k = this._dragScale(e.pointerType);
    this.rig.addScroll(dy * k);
    this.rig.addPan(-dx * k * 0.6, 0);

    const now = performance.now();
    this.samples.push({ x: e.clientX, y: e.clientY, t: now });
    while (this.samples.length > 2 && now - this.samples[0].t > 90) this.samples.shift();
  }

  _onUp(e) {
    if (!this.down || e.pointerId !== this.down.id) return;
    if (this.dragging) {
      // Release velocity from the last ~90ms of movement.
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      const dt = Math.max(16, b.t - a.t) / 1000;
      const k = this._dragScale(e.pointerType);
      const fresh = performance.now() - b.t < 60;
      if (fresh && !env.reducedMotion) {
        this.rig.setScrollVelocity(((b.y - a.y) / dt) * k);
        this.rig.setPanVelocity((-(b.x - a.x) / dt) * k * 0.6, 0);
      }
      this.dragging = false;
      this.emit('dragend');
    } else if (performance.now() - this.down.t < 600) {
      this.emit('tap', { ndc: this.pointer.clone(), pointerType: e.pointerType });
    }
    this.down = null;
  }

  _onKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    this.emit('key', { key: e.key, event: e });
    if (this.locked) return;
    const step = 6.4;
    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
        this.rig.addScroll(-step);
        break;
      case ' ':
        if (document.activeElement && document.activeElement !== document.body) return;
        e.preventDefault();
        this.rig.addScroll(e.shiftKey ? step : -step);
        break;
      case 'ArrowUp':
      case 'PageUp':
        this.rig.addScroll(step);
        break;
      case 'ArrowLeft':
        this.rig.addPan(-1.2, 0);
        break;
      case 'ArrowRight':
        this.rig.addPan(1.2, 0);
        break;
      default:
        return;
    }
    this.emit('travel', {});
  }

  _dragScale(type) {
    return type === 'touch' ? 0.034 : 0.022;
  }

  _updatePointer(e) {
    this.client.x = e.clientX;
    this.client.y = e.clientY;
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    // Touch has no hover, so parallax follows only mice and pens.
    if (e.pointerType !== 'touch') {
      this.hasPointer = true;
      this.rig.setPointer(this.pointer.x, this.pointer.y);
    }
  }

  dispose() {
    this.target.removeEventListener('wheel', this._onWheel);
    this.target.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('keydown', this._onKey);
    document.documentElement.removeEventListener('mouseleave', this._onLeave);
    this.clear();
  }
}

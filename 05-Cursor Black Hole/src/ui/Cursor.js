import { Spring, damp } from '../utils/math.js';

/**
 * Custom cursor: a hole with a lit rim (the dot, exact) and a ring that trails with inertia.
 * The ring stretches along fast motion, contracts and fills with charge while held,
 * springs open on release, and grows to frame interactive elements.
 */
export class Cursor {
  constructor(root, pointer, bus, { reducedMotion = false } = {}) {
    this.root = root;
    this.pointer = pointer;
    this.bus = bus;
    this.reducedMotion = reducedMotion;

    this.ring = root.querySelector('.cursor__ring');
    this.dot = root.querySelector('.cursor__dot');
    this.arc = root.querySelector('.cursor__charge');
    this.label = root.querySelector('[data-cursor-label]');
    this.shockEl = root.querySelector('.cursor__shock');

    this.x = pointer.client.x;
    this.y = pointer.client.y;
    this.scale = new Spring(1, 260, 17);
    this.hover = null;
    this._visible = null;

    this._onOver = (e) => {
      const t = e.target instanceof Element ? e.target.closest('a, button, [data-cursor]') : null;
      this._setHover(t);
    };
    document.addEventListener('pointerover', this._onOver);
    document.documentElement.classList.add('has-custom-cursor');
  }

  _setHover(el) {
    if (el === this.hover) return;
    this.hover = el;
    this.root.classList.toggle('is-hover', !!el);
    this.label.textContent = el?.dataset.cursor ?? '';
    if (el) this.bus.emit('hover');
  }

  shock({ kind, charge = 0 }) {
    const el = this.shockEl;
    el.style.transform = `translate3d(${this.pointer.client.x}px, ${this.pointer.client.y}px, 0)`;
    el.style.setProperty('--shock', kind === 'click' ? 4 : 4 + charge * 9);
    el.classList.remove('is-on');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-on');
    this.scale.velocity += 14 + charge * 18;
  }

  update(dt) {
    const p = this.pointer;
    const px = this.x;
    const py = this.y;
    this.x = damp(this.x, p.client.x, 20, dt);
    this.y = damp(this.y, p.client.y, 20, dt);

    const vx = (this.x - px) / dt;
    const vy = (this.y - py) / dt;
    const stretch = this.reducedMotion ? 0 : Math.min(Math.hypot(vx, vy) / 3200, 0.3);
    const angle = Math.atan2(vy, vx);

    this.scale.target = this.hover ? 1.9 : 1 - 0.45 * p.chargeEased;
    const s = this.scale.update(dt);

    // rotate → scale → unrotate: stretch along the direction of travel without spinning the ring.
    this.ring.style.transform =
      `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0) rotate(${angle}rad) ` +
      `scale(${(s * (1 + stretch)).toFixed(3)}, ${(s * (1 - stretch * 0.5)).toFixed(3)}) rotate(${-angle}rad)`;
    this.dot.style.transform = `translate3d(${p.client.x}px, ${p.client.y}px, 0)`;
    this.label.style.transform = `translate3d(${this.x.toFixed(1)}px, ${(this.y + 30 * s + 8).toFixed(1)}px, 0) translateX(-50%)`;
    this.arc.style.strokeDashoffset = (1 - p.charge).toFixed(3);
    this.root.style.setProperty('--charge', p.chargeEased.toFixed(3));

    const visible = p.type === 'mouse' && p.inside;
    if (visible !== this._visible) {
      this._visible = visible;
      this.root.style.opacity = visible ? '1' : '0';
    }
  }

  dispose() {
    document.removeEventListener('pointerover', this._onOver);
    document.documentElement.classList.remove('has-custom-cursor');
  }
}

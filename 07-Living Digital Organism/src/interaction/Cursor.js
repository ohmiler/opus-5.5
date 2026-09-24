import { damp, lerp } from '../utils/math.js';

/**
 * Custom cursor: a trailing ring with mass and an exact dot.
 * The ring swells and names the action when the organism is within reach,
 * and a shockwave ring is emitted on provoke.
 */
export class Cursor {
  constructor({ bus, root = document.querySelector('.cursor') }) {
    this.root = root;
    this.ring = root.querySelector('.cursor__ring');
    this.dot = root.querySelector('.cursor__dot');
    this.label = root.querySelector('.cursor__label');
    this.enabled = matchMedia('(pointer: fine)').matches;
    this.x = innerWidth / 2; this.y = innerHeight / 2;
    this.vx = 0; this.vy = 0;
    this.scale = 1; this.press = 0; this.near = false;
    this.labelText = '';
    this.offs = [
      bus.on('press', () => { this.press = 1; }),
      bus.on('release', () => { this.press = 0; }),
      bus.on('provoke', ({ strength }) => this.shock(strength)),
    ];
    if (this.enabled) document.body.classList.add('has-cursor');
  }

  shock(strength) {
    if (!this.enabled) return;
    const el = document.createElement('div');
    el.className = 'cursor__ring';
    el.style.cssText = `transform:translate(${this.tx}px,${this.ty}px) scale(1);opacity:${0.4 + strength * 0.6};border-color:var(--ember);transition:transform .9s cubic-bezier(.16,1,.3,1),opacity .9s`;
    this.root.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${this.tx}px,${this.ty}px) scale(${3 + strength * 3})`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 950);
  }

  update(dt, { x, y, proximity, defending, habituated }) {
    if (!this.enabled) return;
    this.tx = x; this.ty = y;
    // Ring follows with spring momentum, stretches along its velocity.
    const k = 180, c = 22;
    this.vx += ((x - this.x) * k - this.vx * c) * dt;
    this.vy += ((y - this.y) * k - this.vy * c) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    const target = lerp(1, 1.9, proximity) * (this.press ? 0.7 : 1);
    this.scale = damp(this.scale, target, 10, dt);
    const speed = Math.min(Math.hypot(this.vx, this.vy) / 2200, 0.35);
    const ang = Math.atan2(this.vy, this.vx);

    this.ring.style.transform =
      `translate(${this.x}px,${this.y}px) rotate(${ang}rad) scale(${this.scale * (1 + speed)},${this.scale * (1 - speed * 0.6)})`;
    this.dot.style.transform = `translate(${x}px,${y}px)`;

    const near = proximity > 0.35;
    if (near !== this.near) { this.near = near; this.root.classList.toggle('is-near', near); }
    const text = defending ? 'it bristles' : habituated ? 'it knows you' : 'click to provoke';
    if (text !== this.labelText) { this.labelText = text; this.label.textContent = text; }
    // Keep the label upright despite ring rotation.
    this.label.style.transform = `translateX(-50%) rotate(${-ang}rad)`;
  }

  dispose() {
    this.offs.forEach((off) => off());
    document.body.classList.remove('has-cursor');
  }
}

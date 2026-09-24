import { damp, clamp } from '../utils/math.js';
import { env } from '../utils/env.js';

// Custom cursor: a precise dot plus a lagging ring that carries state.
//   idle  → small ring
//   view  → ring blooms, "View" label (hovering a work)
//   drag  → ring stretches along velocity
//   close → ring with "Close" label (inside a project)
export class Cursor {
  constructor(root) {
    this.enabled = !env.touch;
    this.el = root;
    if (!this.enabled) {
      root.remove();
      return;
    }
    this.dot = root.querySelector('.cursor__dot');
    this.ring = root.querySelector('.cursor__ring');
    this.label = root.querySelector('.cursor__label');
    this.x = this.rx = innerWidth / 2;
    this.y = this.ry = innerHeight / 2;
    this.vx = this.vy = 0;
    this.scale = 1;
    this.state = 'idle';
    this.visible = false;
    document.documentElement.classList.add('has-cursor');

    this._move = (e) => {
      if (e.pointerType === 'touch') return;
      this.x = e.clientX;
      this.y = e.clientY;
      if (!this.visible) {
        this.visible = true;
        this.rx = this.x;
        this.ry = this.y;
        root.classList.add('is-visible');
      }
    };
    this._leave = () => {
      this.visible = false;
      root.classList.remove('is-visible');
    };
    this._down = () => root.classList.add('is-pressed');
    this._up = () => root.classList.remove('is-pressed');
    // Interactive DOM elements take over the cursor.
    this._over = (e) => {
      const ui = e.target.closest?.('button, a, [data-cursor]');
      root.classList.toggle('is-ui', !!ui);
    };
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerdown', this._down);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointerover', this._over);
    document.documentElement.addEventListener('mouseleave', this._leave);
  }

  set(state, text = '') {
    if (!this.enabled || (state === this.state && text === this._text)) return;
    this.state = state;
    this._text = text;
    this.el.dataset.state = state;
    this.label.textContent = text;
  }

  update(dt) {
    if (!this.enabled) return;
    const px = this.rx;
    const py = this.ry;
    const lag = env.reducedMotion ? 40 : 14;
    this.rx = damp(this.rx, this.x, lag, dt);
    this.ry = damp(this.ry, this.y, lag, dt);
    this.vx = damp(this.vx, (this.rx - px) / Math.max(dt, 1e-3), 10, dt);
    this.vy = damp(this.vy, (this.ry - py) / Math.max(dt, 1e-3), 10, dt);

    const speed = Math.hypot(this.vx, this.vy);
    const stretch = this.state === 'drag' && !env.reducedMotion ? clamp(speed / 1800, 0, 0.6) : 0;
    const angle = Math.atan2(this.vy, this.vx);

    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.ring.style.transform =
      `translate3d(${this.rx}px, ${this.ry}px, 0) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch * 0.5})`;
    this.label.style.transform = `translate3d(${this.rx}px, ${this.ry}px, 0)`;
  }

  dispose() {
    if (!this.enabled) return;
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointerover', this._over);
    document.documentElement.removeEventListener('mouseleave', this._leave);
  }
}

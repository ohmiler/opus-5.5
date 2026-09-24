import { damp } from '../util.js';

export class Cursor {
  constructor(pointer) {
    this.pointer = pointer;
    this.el = document.querySelector('.cursor');
    this.ring = this.el.querySelector('.cursor__ring');
    this.dot = this.el.querySelector('.cursor__dot');
    this.label = this.el.querySelector('.cursor__label');
    this.rx = pointer.px;
    this.ry = pointer.py;
    this.enabled = !pointer.coarse;
    if (this.enabled) document.body.classList.add('has-cursor');

    this.down = () => this.el.classList.add('is-down');
    this.up = () => this.el.classList.remove('is-down');
    addEventListener('pointerdown', this.down);
    addEventListener('pointerup', this.up);
  }

  setHover(label) {
    this.el.classList.toggle('is-hover', !!label);
    if (label) this.label.textContent = label;
  }

  pulse() {
    this.el.classList.remove('is-pulse');
    void this.el.offsetWidth;
    this.el.classList.add('is-pulse');
  }

  update(dt) {
    if (!this.enabled) return;
    const { px, py } = this.pointer;
    this.rx = damp(this.rx, px, 12, dt);
    this.ry = damp(this.ry, py, 12, dt);
    this.dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;
    this.ring.style.transform = `translate3d(${this.rx}px, ${this.ry}px, 0)`;
    this.label.style.transform = `translate3d(${this.rx + 40}px, ${this.ry - 5}px, 0)`;
  }

  dispose() {
    removeEventListener('pointerdown', this.down);
    removeEventListener('pointerup', this.up);
  }
}

import { damp } from '../utils/math.js';

/** Dot follows the pointer exactly; ring trails with inertia and morphs by state. */
export class Cursor {
  constructor(el, hoverCard) {
    this.el = el;
    this.dot = el.querySelector('.cursor-dot');
    this.ring = el.querySelector('.cursor-ring');
    this.label = el.querySelector('.cursor-label');
    this.card = hoverCard;
    this.x = this.rx = innerWidth / 2;
    this.y = this.ry = innerHeight / 2;
    this.state = 'default';
    this.enabled = matchMedia('(pointer: fine)').matches;
    if (this.enabled) document.body.classList.add('has-cursor');

    // UI elements get a smaller "magnetic" state.
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest?.('button, a')) this.setState('ui');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest?.('button, a') && this.state === 'ui') this.setState('default');
    });
  }

  move(x, y) {
    this.x = x;
    this.y = y;
  }

  setState(state, label) {
    if (state === this.state && !label) return;
    this.state = state;
    this.el.dataset.state = state;
    if (label) this.label.textContent = label;
  }

  press(down) {
    this.el.classList.toggle('is-down', down);
  }

  hide(hidden) {
    this.el.classList.toggle('is-hidden', hidden);
  }

  update(dt) {
    if (!this.enabled) return;
    this.rx = damp(this.rx, this.x, 16, dt);
    this.ry = damp(this.ry, this.y, 16, dt);
    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.ring.style.transform = `translate3d(${this.rx}px, ${this.ry}px, 0)`;
    this.card?.follow(this.rx, this.ry, dt);
  }
}

import { damp } from '../utils/math.js';

/** Small caption that trails the cursor while an installation is hovered. */
export class HoverCard {
  constructor(el) {
    this.el = el;
    this.index = el.querySelector('.hc-index');
    this.title = el.querySelector('.hc-title');
    this.meta = el.querySelector('.hc-meta');
    this.x = 0;
    this.y = 0;
  }

  show(p) {
    this.index.textContent = `N° ${p.index} — ${p.discipline}`;
    this.title.textContent = p.title;
    this.meta.textContent = `${p.location} · ${p.year} · Click to open`;
    this.el.classList.add('is-visible');
  }

  hide() {
    this.el.classList.remove('is-visible');
  }

  follow(x, y, dt) {
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    const tx = x + 44 + w > innerWidth ? x - w - 44 : x + 44;
    const ty = Math.min(y + 24, innerHeight - h - 16);
    this.x = damp(this.x, tx, 10, dt);
    this.y = damp(this.y, ty, 10, dt);
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }
}

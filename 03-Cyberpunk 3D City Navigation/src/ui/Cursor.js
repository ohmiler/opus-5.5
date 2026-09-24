import { damp } from '../utils/math.js';

// Custom cursor: the dot tracks exactly, the ring follows with inertia and morphs by context
// (link, 3D target with label, pressed, busy during camera flights).
export class Cursor {
  constructor(el, { enabled }) {
    this.el = el;
    this.enabled = enabled;
    this.dot = el.querySelector('.cursor__dot');
    this.ring = el.querySelector('.cursor__ring');
    this.kicker = el.querySelector('.cursor__label small');
    this.label = el.querySelector('.cursor__label b');
    this.labelWrap = el.querySelector('.cursor__label');
    this.x = this.rx = window.innerWidth / 2;
    this.y = this.ry = window.innerHeight / 2;
    this.visible = false;
    if (!enabled) return;

    document.body.classList.add('has-fine-pointer');
    el.classList.add('is-hidden');
    this.onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      this.x = e.clientX;
      this.y = e.clientY;
      if (!this.visible) {
        this.rx = this.x;
        this.ry = this.y;
        this.visible = true;
        this.el.classList.remove('is-hidden');
      }
    };
    this.onOver = (e) => {
      const link = e.target instanceof Element && e.target.closest('a, button, [data-cursor="link"]');
      this.el.classList.toggle('is-link', !!link);
    };
    this.onLeave = () => {
      this.visible = false;
      this.el.classList.add('is-hidden');
    };
    this.onDown = () => this.el.classList.add('is-down');
    this.onUp = () => this.el.classList.remove('is-down');
    window.addEventListener('pointermove', this.onMove);
    document.addEventListener('pointerover', this.onOver);
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
  }

  setTarget(section, cta = 'Enter') {
    if (!this.enabled) return;
    const key = section?.id ?? null;
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.el.classList.toggle('is-target', !!section);
    if (section) {
      this.el.style.setProperty('--c', section.color);
      this.kicker.textContent = `${section.index} · ${cta}`;
      this.label.textContent = section.title;
    } else {
      this.el.style.removeProperty('--c');
    }
  }

  setBusy(b) {
    this.el.classList.toggle('is-busy', b);
  }

  update(dt) {
    if (!this.enabled) return;
    this.rx = damp(this.rx, this.x, 14, dt);
    this.ry = damp(this.ry, this.y, 14, dt);
    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    // 'translate' (not transform) so CSS keeps ownership of the label's reveal transform
    this.ring.style.translate = `${this.rx}px ${this.ry}px`;
    this.labelWrap.style.translate = `${this.rx}px ${this.ry}px`;
  }

  dispose() {
    if (!this.enabled) return;
    window.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerover', this.onOver);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    document.body.classList.remove('has-fine-pointer');
  }
}

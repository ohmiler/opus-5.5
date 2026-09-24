import { clamp, motion } from '../utils/helpers.js';

/**
 * DOM windows layered over the canvas: open from the 3D object that spawned
 * them, drag with inertia and tilt, stack on focus, minimize to the taskbar,
 * roll up (window-shade) on title double-click.
 *
 * Emits 'change' whenever the set of windows or focus changes.
 */
export class WindowManager extends EventTarget {
  constructor(root, { sections, sound }) {
    super();
    this.root = root;
    this.sections = sections;
    this.sound = sound;
    this.wins = new Map();
    this.z = 20;
    this.cascade = 0;
    this.active = null;
    this.context = {};
    this.uid = 0;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.active) this.close(this.active);
    });
  }

  emit() { this.dispatchEvent(new Event('change')); }

  list() {
    return [...this.wins.values()].map((w) => ({ id: w.id, title: w.title, icon: w.icon, minimized: w.minimized, active: w.id === this.active }));
  }

  open(sectionId, { origin, instance } = {}) {
    const sec = this.sections[sectionId];
    if (!sec) return null;
    const id = instance ? `${sectionId}#${++this.uid}` : sectionId;
    const existing = this.wins.get(id);
    if (existing) {
      if (existing.minimized) this.restore(id);
      this.focus(id);
      if (!motion.reduced) existing.inner.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
      return existing;
    }

    const el = document.createElement('section');
    el.className = 'win';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', sec.title);
    el.style.setProperty('--w', (sec.width || 420) + 'px');
    el.innerHTML = `
      <div class="win__inner">
        <header class="win__bar">
          <div class="win__btns">
            <button class="win__btn win__btn--close" aria-label="Close"></button>
            <button class="win__btn win__btn--min" aria-label="Minimize"></button>
            <button class="win__btn win__btn--shade" aria-label="Roll up"></button>
          </div>
          <div class="win__title">${sec.icon ? sec.icon + '&nbsp; ' : ''}${sec.title}</div>
          <div class="win__spacer"></div>
        </header>
        <div class="win__body">${typeof sec.html === 'function' ? sec.html() : sec.html}</div>
        <footer class="win__status">${sec.status || 'Ready'}</footer>
      </div>`;
    this.root.appendChild(el);

    const w = {
      id, el, title: sec.title, icon: sec.icon || '',
      inner: el.querySelector('.win__inner'),
      body: el.querySelector('.win__body'),
      x: 0, y: 0, vx: 0, vy: 0, tilt: 0, minimized: false, origin,
    };
    const rect = el.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    if (mobile) {
      w.x = (window.innerWidth - rect.width) / 2 + this.cascade * 8;
      w.y = 64 + this.cascade * 18;
    } else {
      const ox = origin ? origin.x - rect.width / 2 : (window.innerWidth - rect.width) / 2;
      const oy = origin ? origin.y - rect.height - 40 : 100;
      w.x = ox + this.cascade * 26;
      w.y = oy + this.cascade * 22;
    }
    this.cascade = (this.cascade + 1) % 5;
    this.wins.set(id, w);
    this.clampWin(w, rect);
    this.apply(w);
    this.bind(w);
    this.focus(id);

    // Grow out of the object that opened it.
    const r2 = el.getBoundingClientRect();
    const from = origin
      ? `translate(${origin.x - (r2.left + r2.width / 2)}px, ${origin.y - (r2.top + r2.height / 2)}px) scale(.12)`
      : 'translateY(16px) scale(.92)';
    w.inner.animate(
      motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: from, opacity: 0, filter: 'blur(6px)' }, { opacity: 1, offset: 0.35 }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
      { duration: motion.reduced ? 160 : 620, easing: 'cubic-bezier(.16,1,.3,1.08)' },
    );

    w.cleanup = sec.mount?.(w.body, { ...this.context, wm: this, win: w, sound: this.sound });
    this.sound.play('open');
    this.emit();
    return w;
  }

  bind(w) {
    const bar = w.el.querySelector('.win__bar');
    w.el.addEventListener('pointerdown', () => this.focus(w.id), true);
    w.el.querySelector('.win__btn--close').addEventListener('click', () => this.close(w.id));
    w.el.querySelector('.win__btn--min').addEventListener('click', () => this.minimize(w.id));
    w.el.querySelector('.win__btn--shade').addEventListener('click', () => this.shade(w.id));
    bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) this.shade(w.id); });

    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.button !== 0) return;
      bar.setPointerCapture(e.pointerId);
      cancelAnimationFrame(w.raf);
      drag = { sx: e.clientX - w.x, sy: e.clientY - w.y, lx: e.clientX, ly: e.clientY, lt: performance.now() };
      w.vx = w.vy = 0;
      this.sound.play('grab');
      this.startTilt(w, () => !!drag);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const now = performance.now();
      const dt = Math.max(1, now - drag.lt) / 1000;
      const k = 0.35;
      w.vx = w.vx * (1 - k) + ((e.clientX - drag.lx) / dt) * k;
      w.vy = w.vy * (1 - k) + ((e.clientY - drag.ly) / dt) * k;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      w.x = e.clientX - drag.sx;
      w.y = e.clientY - drag.sy;
      this.clampWin(w);
      this.apply(w);
    });
    const end = () => {
      if (!drag) return;
      // Holding still before release means "place", not "throw".
      if (performance.now() - drag.lt > 80) w.vx = w.vy = 0;
      drag = null;
      this.glide(w);
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  /** Inertial throw after release. */
  glide(w) {
    if (motion.reduced) { w.vx = w.vy = 0; }
    let prev = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000)); prev = now;
      w.x += w.vx * dt; w.y += w.vy * dt;
      const f = Math.exp(-5.5 * dt);
      w.vx *= f; w.vy *= f;
      const before = { x: w.x, y: w.y };
      this.clampWin(w);
      if (before.x !== w.x) w.vx *= -0.35;
      if (before.y !== w.y) w.vy *= -0.35;
      this.apply(w);
      if (Math.hypot(w.vx, w.vy) > 12) w.raf = requestAnimationFrame(step);
    };
    w.raf = requestAnimationFrame(step);
  }

  /** Windows lean into their motion like a card on a string. */
  startTilt(w, isDragging) {
    if (motion.reduced) return;
    cancelAnimationFrame(w.tiltRaf);
    let prev = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000)); prev = now;
      const target = clamp(w.vx * 0.004, -4, 4);
      w.tilt += (target - w.tilt) * (1 - Math.exp(-10 * dt));
      this.apply(w);
      if (isDragging() || Math.abs(w.tilt) > 0.02 || Math.hypot(w.vx, w.vy) > 12) w.tiltRaf = requestAnimationFrame(step);
      else { w.tilt = 0; this.apply(w); }
    };
    w.tiltRaf = requestAnimationFrame(step);
  }

  clampWin(w, rect) {
    const r = rect || w.el.getBoundingClientRect();
    const width = r.width || 300;
    w.x = clamp(w.x, -width + 90, window.innerWidth - 90);
    w.y = clamp(w.y, 8, window.innerHeight - 110);
  }

  apply(w) {
    w.el.style.transform = `translate3d(${Math.round(w.x)}px, ${Math.round(w.y)}px, 0) rotate(${w.tilt.toFixed(2)}deg)`;
  }

  focus(id) {
    const w = this.wins.get(id);
    if (!w) return;
    if (this.active !== id) {
      w.el.style.zIndex = ++this.z;
      this.active = id;
      this.wins.forEach((o) => o.el.classList.toggle('is-inactive', o.id !== id));
      this.emit();
    }
  }

  shade(id) {
    const w = this.wins.get(id);
    if (!w) return;
    w.el.classList.toggle('is-shaded');
    this.sound.play('min');
  }

  taskButtonRect(id) {
    const btn = document.querySelector(`.task[data-id="${CSS.escape(id)}"]`);
    return btn?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight, width: 0, height: 0 };
  }

  minimize(id) {
    const w = this.wins.get(id);
    if (!w || w.minimized) return;
    w.minimized = true;
    const r = w.el.getBoundingClientRect(), t = this.taskButtonRect(id);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top - (r.top + r.height / 2);
    this.sound.play('min');
    const a = w.inner.animate(
      motion.reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.08, .04)`, opacity: 0 }],
      { duration: motion.reduced ? 120 : 420, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' },
    );
    a.onfinish = () => { w.el.style.visibility = 'hidden'; };
    if (this.active === id) this.active = null;
    this.emit();
  }

  restore(id) {
    const w = this.wins.get(id);
    if (!w || !w.minimized) return;
    w.minimized = false;
    w.el.style.visibility = '';
    w.inner.getAnimations().forEach((a) => a.cancel());
    const r = w.el.getBoundingClientRect(), t = this.taskButtonRect(id);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top - (r.top + r.height / 2);
    w.inner.animate(
      motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: `translate(${dx}px, ${dy}px) scale(.08, .04)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: motion.reduced ? 120 : 520, easing: 'cubic-bezier(.16,1,.3,1.06)' },
    );
    this.active = null;
    this.focus(id);
    this.sound.play('open');
  }

  toggleFromTaskbar(id) {
    const w = this.wins.get(id);
    if (!w) return;
    if (w.minimized) this.restore(id);
    else if (this.active === id) this.minimize(id);
    else this.focus(id);
  }

  close(id) {
    const w = this.wins.get(id);
    if (!w || w.closing) return;
    w.closing = true;
    cancelAnimationFrame(w.raf); cancelAnimationFrame(w.tiltRaf);
    w.cleanup?.();
    this.sound.play('close');
    const r = w.el.getBoundingClientRect();
    const o = w.origin;
    const to = o && !motion.reduced
      ? `translate(${o.x - (r.left + r.width / 2)}px, ${o.y - (r.top + r.height / 2)}px) scale(.1)`
      : 'scale(.94)';
    const a = w.inner.animate([{ transform: 'none', opacity: 1 }, { transform: to, opacity: 0 }], {
      duration: motion.reduced ? 120 : 360, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards',
    });
    a.onfinish = () => w.el.remove();
    this.wins.delete(id);
    if (this.active === id) {
      this.active = null;
      const top = [...this.wins.values()].filter((x) => !x.minimized).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0];
      if (top) this.focus(top.id);
    }
    this.emit();
  }

  onResize() {
    this.wins.forEach((w) => { this.clampWin(w); this.apply(w); });
  }
}

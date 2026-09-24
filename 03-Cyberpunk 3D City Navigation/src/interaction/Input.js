import { Emitter } from '../utils/Emitter.js';

// Normalises wheel / touch / mouse / keyboard into intent events:
//   scroll(deltaPx)  tap({x,y})  step(±1)  goto(i)  activate  escape  first
export class Input extends Emitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0, px: -1, py: -1, inside: false, type: 'mouse' };
    this.lastInput = performance.now();
    this.enabled = false;
    this.touch = null;
    this.#bind();
  }

  #isUI(target) {
    return target instanceof Element && !!target.closest('.holo, .hud button, .hud a, .rail');
  }

  #bind() {
    const on = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      (this.unbinders ??= []).push(() => el.removeEventListener(type, fn, opts));
    };

    on(window, 'pointermove', (e) => {
      this.pointer.type = e.pointerType;
      this.pointer.px = e.clientX;
      this.pointer.py = e.clientY;
      this.pointer.inside = true;
      this.pointer.overCanvas = e.target === this.canvas;
      if (e.pointerType === 'mouse') {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }
      if (this.touch && e.pointerId === this.touch.id) this.#touchMove(e);
    });

    on(document, 'pointerleave', () => (this.pointer.inside = false));
    on(window, 'blur', () => (this.pointer.inside = false));

    on(this.canvas, 'pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.emit('down');
      if (e.pointerType !== 'mouse') {
        this.touch = { id: e.pointerId, y: e.clientY, t: performance.now(), v: 0 };
        this.canvas.setPointerCapture?.(e.pointerId);
      }
    });

    on(window, 'pointerup', (e) => {
      this.emit('up');
      if (this.touch && e.pointerId === this.touch.id) {
        // fling with the release velocity
        if (Math.abs(this.touch.v) > 0.05 && performance.now() - this.touch.t < 80) this.#scroll(this.touch.v * 260);
        this.touch = null;
      }
      if (!this.down) return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      const quick = performance.now() - this.down.t < 450;
      if (moved < 8 && quick && e.target === this.canvas) {
        this.emit('tap', {
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: -(e.clientY / window.innerHeight) * 2 + 1,
          type: e.pointerType,
        });
      }
      this.down = null;
    });

    on(
      window,
      'wheel',
      (e) => {
        if (this.#isUI(e.target)) return;
        let d = e.deltaY;
        if (e.deltaMode === 1) d *= 16;
        else if (e.deltaMode === 2) d *= window.innerHeight;
        this.#scroll(Math.max(-160, Math.min(160, d)));
      },
      { passive: true },
    );

    on(window, 'keydown', (e) => {
      if (!this.enabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key;
      if (k === 'Escape') this.emit('escape');
      else if (k === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) this.emit('activate');
      else if (['ArrowDown', 'PageDown', 'j'].includes(k) || (k === ' ' && !this.#isUI(e.target))) {
        e.preventDefault();
        this.#mark();
        this.emit('step', 1);
      } else if (['ArrowUp', 'PageUp', 'k'].includes(k)) {
        e.preventDefault();
        this.#mark();
        this.emit('step', -1);
      } else if (/^[1-9]$/.test(k)) this.emit('goto', Number(k) - 1);
      else if (k === 'Home') this.emit('goto', -1);
    });
  }

  #touchMove(e) {
    const now = performance.now();
    const dy = this.touch.y - e.clientY;
    const dt = Math.max(1, now - this.touch.t);
    this.touch.v = dy / dt;
    this.touch.y = e.clientY;
    this.touch.t = now;
    this.#scroll(dy * 2.2);
  }

  #mark() {
    if (!this.hadFirst) {
      this.hadFirst = true;
      this.emit('first');
    }
    this.lastInput = performance.now();
  }

  #scroll(delta) {
    if (!this.enabled) return;
    this.#mark();
    this.emit('scroll', delta);
  }

  dispose() {
    this.unbinders?.forEach((u) => u());
    this.clear();
  }
}

/**
 * Normalises wheel, touch-drag, pointer and keyboard input into a few callbacks.
 * Owns no state beyond pointer position; the app decides what input means.
 */
export class Input {
  constructor(el, { onScroll, onMove, onTap, onKey, onPress }) {
    this.el = el;
    this.mouse = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, active: false };
    this.cb = { onScroll, onMove, onTap, onKey, onPress };
    this.drag = null;
    this.listeners = [];

    this.on(window, 'wheel', this.handleWheel, { passive: false });
    this.on(el, 'pointerdown', this.handleDown);
    this.on(window, 'pointermove', this.handleMove);
    this.on(window, 'pointerup', this.handleUp);
    this.on(window, 'pointercancel', this.handleUp);
    this.on(document, 'pointerleave', () => { this.mouse.active = false; });
    this.on(window, 'keydown', this.handleKey);
  }

  on(target, type, fn, opts) {
    const bound = fn.bind ? fn.bind(this) : fn;
    target.addEventListener(type, bound, opts);
    this.listeners.push(() => target.removeEventListener(type, bound, opts));
  }

  handleWheel(e) {
    if (e.target.closest?.('.panel-scroll')) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= innerHeight;
    this.cb.onScroll(Math.max(-240, Math.min(240, dy)) * 0.00009);
  }

  handleDown(e) {
    this.drag = { x: e.clientX, y: e.clientY, lastY: e.clientY, t: performance.now(), v: 0, type: e.pointerType, moved: 0 };
    this.cb.onPress?.(true);
  }

  handleMove(e) {
    const m = this.mouse;
    m.px = e.clientX; m.py = e.clientY;
    m.x = (e.clientX / innerWidth) * 2 - 1;
    m.y = -(e.clientY / innerHeight) * 2 + 1;
    m.active = e.pointerType === 'mouse';
    const d = this.drag;
    if (d) {
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x, e.clientY - d.y));
      if (d.type !== 'mouse') {
        const dy = e.clientY - d.lastY;
        d.v = dy;
        d.lastY = e.clientY;
        this.cb.onScroll(-dy * 0.0011);
      }
    }
    this.cb.onMove?.(m);
  }

  handleUp(e) {
    const d = this.drag;
    this.drag = null;
    this.cb.onPress?.(false);
    if (!d) return;
    if (d.type !== 'mouse' && d.moved > 8) this.cb.onScroll(-d.v * 0.006); // fling
    if (d.moved < 8 && performance.now() - d.t < 500 && e.type === 'pointerup') {
      this.cb.onTap?.({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1, type: d.type });
    }
  }

  handleKey(e) {
    this.cb.onKey?.(e);
  }

  dispose() {
    this.listeners.forEach((off) => off());
  }
}

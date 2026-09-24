// Boot sequence: real progress from world construction, eased counter, narrative log,
// then an explicit "enter" gesture (which also unlocks audio).
export class Loader {
  constructor(root) {
    this.root = root;
    this.pct = root.querySelector('#loader-pct');
    this.bar = root.querySelector('#loader-bar');
    this.log = root.querySelector('#loader-log');
    this.enter = root.querySelector('#loader-enter');
    this.target = 0;
    this.shown = 0;
    this.raf = requestAnimationFrame(this.#tick);
  }

  #tick = (now) => {
    // ease the displayed value so progress never jumps (frame-rate independent)
    const dt = Math.min(0.1, (now - (this.last ?? now)) / 1000);
    this.last = now;
    this.shown += (this.target - this.shown) * (1 - Math.exp(-dt * 7));
    if (Math.abs(this.target - this.shown) < 0.001) this.shown = this.target;
    const v = Math.round(this.shown * 100);
    this.pct.textContent = String(v).padStart(3, '0');
    this.bar.style.transform = `scaleX(${this.shown})`;
    this.raf = requestAnimationFrame(this.#tick);
  };

  progress(fraction, label) {
    this.target = Math.max(this.target, fraction);
    if (label && label !== this.lastLabel) {
      this.lastLabel = label;
      const li = document.createElement('li');
      li.textContent = label;
      this.log.append(li);
      while (this.log.children.length > 4) this.log.firstChild.remove();
    }
  }

  // Resolves when the visitor chooses to enter.
  ready() {
    this.progress(1);
    return new Promise((resolve) => {
      const waitFull = () => {
        if (this.shown < 0.995) return requestAnimationFrame(waitFull);
        this.enter.disabled = false;
        this.enter.focus({ preventScroll: true });
        this.enter.addEventListener('click', () => resolve(), { once: true });
      };
      waitFull();
    });
  }

  leave() {
    this.root.classList.add('is-leaving');
    this.root.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      cancelAnimationFrame(this.raf);
      this.root.remove();
    }, 1500);
  }

  fail(message) {
    cancelAnimationFrame(this.raf);
    this.progress(this.target, message);
  }
}

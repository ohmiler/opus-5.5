import { escapeHTML } from '../utils/helpers.js';

/** Taskbar, start menu and tray clock (which can be "Y2K-bugged"). */
export class Taskbar {
  constructor({ wm, sound, menu, onClockSecret, onShutdown }) {
    this.wm = wm;
    this.sound = sound;
    this.tasks = document.getElementById('tasks');
    this.startBtn = document.getElementById('startBtn');
    this.menuEl = document.getElementById('startmenu');
    this.soundBtn = document.getElementById('soundBtn');
    this.clock = document.getElementById('clock');
    this.fakeUntil = 0;
    this.clockClicks = [];

    wm.addEventListener('change', () => this.render());

    const list = this.menuEl.querySelector('.startmenu__list');
    list.innerHTML = menu.map((m) => m === '-'
      ? '<li role="separator"><hr></li>'
      : `<li role="none"><button role="menuitem" data-open="${m.id}"><span class="ico">${m.icon}</span>${escapeHTML(m.title)}</button></li>`).join('')
      + '<li role="separator"><hr></li><li role="none"><button role="menuitem" data-action="shutdown"><span class="ico">⏻</span>Shut Down…</button></li>';

    this.startBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMenu(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.toggleMenu(false);
      if (b.dataset.action === 'shutdown') onShutdown();
      else wm.open(b.dataset.open, { origin: this.originOf(this.startBtn) });
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.menuEl.hidden && !e.target.closest('#startmenu, #startBtn')) this.toggleMenu(false);
    });
    this.menuEl.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { this.toggleMenu(false); this.startBtn.focus(); }
    });

    this.tasks.addEventListener('click', (e) => {
      const b = e.target.closest('.task');
      if (b) wm.toggleFromTaskbar(b.dataset.id);
    });

    this.soundBtn.addEventListener('click', () => { sound.toggle(); sound.play('click'); });
    sound.onChange = (on) => {
      this.soundBtn.textContent = on ? '♪ ON' : '♪ OFF';
      this.soundBtn.setAttribute('aria-pressed', String(on));
    };

    this.clock.addEventListener('click', () => {
      const now = performance.now();
      this.clockClicks = this.clockClicks.filter((t) => now - t < 1500);
      this.clockClicks.push(now);
      sound.play('click');
      if (this.clockClicks.length >= 3) { this.clockClicks = []; onClockSecret(); }
    });
    this.tickClock();
    setInterval(() => this.tickClock(), 1000);
  }

  originOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  toggleMenu(force) {
    const open = force ?? this.menuEl.hidden;
    this.menuEl.hidden = !open;
    this.startBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      this.sound.play('click');
      this.menuEl.querySelector('button')?.focus({ preventScroll: true });
    }
  }

  bugClock(seconds = 6) {
    this.fakeUntil = performance.now() + seconds * 1000;
    this.tickClock();
  }

  tickClock() {
    const bugged = performance.now() < this.fakeUntil;
    this.clock.classList.toggle('is-bugged', bugged);
    this.clock.textContent = bugged
      ? '01/01/1900'
      : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  render() {
    const list = this.wm.list();
    const existing = new Map([...this.tasks.children].map((b) => [b.dataset.id, b]));
    for (const w of list) {
      let b = existing.get(w.id);
      if (!b) {
        b = document.createElement('button');
        b.className = 'task';
        b.dataset.id = w.id;
        b.textContent = w.title;
        this.tasks.appendChild(b);
      }
      b.classList.toggle('is-active', w.active);
      b.classList.toggle('is-min', w.minimized);
      existing.delete(w.id);
    }
    existing.forEach((b) => b.remove());
  }
}

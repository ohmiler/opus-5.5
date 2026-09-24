import { storage, escapeHTML } from '../utils/helpers.js';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export const SECRET_IDS = ['konami', 'y2k', 'bin', 'smiley', 'floppy'];

/** Balloon-tip notifications from the system tray. */
export class Toasts {
  constructor() { this.root = document.getElementById('toasts'); }
  show(message, icon = '✦', ms = 3600) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast__ico">${icon}</span><span>${escapeHTML(message)}</span>`;
    this.root.appendChild(el);
    while (this.root.children.length > 3) this.root.firstChild.remove();
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, ms);
  }
}

/** Tracks found easter eggs (persisted) and listens for the Konami code. */
export class Secrets {
  constructor({ toasts, sound, onKonami }) {
    this.toasts = toasts;
    this.sound = sound;
    this.found = new Set(storage.get('mos-secrets', []).filter((s) => SECRET_IDS.includes(s)));
    this.pips = document.querySelector('#secrets .hud__pips');
    this.pips.innerHTML = SECRET_IDS.map(() => '<i></i>').join('');
    this.render();

    let seq = [];
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      seq.push(k);
      seq = seq.slice(-KONAMI.length);
      if (seq.join() === KONAMI.join()) { seq = []; onKonami(); }
    });
  }

  find(id, message) {
    const isNew = !this.found.has(id);
    this.found.add(id);
    storage.set('mos-secrets', [...this.found]);
    this.render(isNew ? id : null);
    this.sound.play('egg');
    if (message) this.toasts.show(message, '★');
    if (isNew) {
      const n = this.found.size;
      setTimeout(() => this.toasts.show(n === SECRET_IDS.length ? 'All 5 secrets found. You are a certified Power User.' : `Secret found! ${n}/${SECRET_IDS.length}`, '◆'), 700);
    }
  }

  render() {
    [...this.pips.children].forEach((p, i) => p.classList.toggle('on', i < this.found.size));
    document.getElementById('secrets').title = `Secrets found: ${this.found.size}/${SECRET_IDS.length}`;
  }
}

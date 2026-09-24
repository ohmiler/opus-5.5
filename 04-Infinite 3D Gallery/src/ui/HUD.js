import { pad } from '../utils/math.js';
import { rooms } from '../gallery/projects.js';

// Minimal frame around the scene: wordmark, current room, current work,
// loop progress, a first-use hint and an accessible project index.
export class HUD {
  constructor(root, { projects, onSelect, onSoundToggle }) {
    this.root = root;
    this.roomEl = root.querySelector('[data-hud-room]');
    this.workIndex = root.querySelector('[data-hud-index]');
    this.workTitle = root.querySelector('[data-hud-title]');
    this.progress = root.querySelector('[data-hud-progress]');
    this.hint = root.querySelector('[data-hud-hint]');
    this.sound = root.querySelector('[data-hud-sound]');
    this.index = root.querySelector('[data-hud-list]');
    this.total = projects.length;
    this.room = -1;
    this.work = -1;

    // Screen-reader / keyboard route into every project.
    projects.forEach((p, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${pad(i + 1)} — ${p.title}, ${p.discipline}, ${p.year}`;
      b.addEventListener('click', () => onSelect(i));
      li.appendChild(b);
      this.index.appendChild(li);
    });

    this.sound.addEventListener('click', () => {
      const on = onSoundToggle();
      this.sound.setAttribute('aria-pressed', String(on));
      this.sound.querySelector('[data-hud-sound-label]').textContent = on ? 'Sound on' : 'Sound off';
    });
  }

  show() {
    this.root.classList.add('is-visible');
  }

  setHidden(hidden) {
    this.root.classList.toggle('is-muted', hidden);
  }

  dismissHint() {
    if (this.hint.classList.contains('is-gone')) return;
    this.hint.classList.add('is-gone');
  }

  // Returns true when the room changed (a narrative beat worth a sound).
  update({ card, progress }) {
    this.progress.style.transform = `scaleX(${progress})`;
    let roomChanged = false;
    if (card && card.room !== this.room) {
      roomChanged = this.room !== -1;
      this.room = card.room;
      swap(this.roomEl, `<span class="num">${rooms[card.room].numeral}</span> ${rooms[card.room].name}`);
    }
    if (card && card.index !== this.work) {
      this.work = card.index;
      swap(this.workIndex, pad(card.index + 1));
      swap(this.workTitle, card.project.title);
    }
    return roomChanged;
  }
}

// Text change as a quick vertical roll rather than a hard cut.
function swap(el, html) {
  el.classList.remove('is-in');
  el.classList.add('is-out');
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.innerHTML = html;
    el.classList.remove('is-out');
    void el.offsetWidth;
    el.classList.add('is-in');
  }, 180);
}

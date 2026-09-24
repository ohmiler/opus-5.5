// Screen-space overlay: brand, live readout, sound toggle, district rail, approach typography, hints.
export class Hud {
  constructor(root, { sections, stops, touch, onGoto, onHome, onSound }) {
    this.root = root;
    this.sections = sections;
    this.readout = root.querySelector('#hud-readout');
    this.soundBtn = root.querySelector('#hud-sound');
    this.soundLabel = root.querySelector('.hud__sound-label');
    this.beacon = root.querySelector('#beacon');
    this.hint = root.querySelector('#hint');
    this.rail = root.querySelector('#rail');
    this.nearIdx = -2;
    this.touch = touch;

    if (touch) this.hint.querySelector('.hint__text').textContent = 'Swipe to walk';

    // Rail: one item per section, placed at its position along the walk
    this.progressEl = Object.assign(document.createElement('div'), { className: 'rail__progress' });
    this.headEl = Object.assign(document.createElement('div'), { className: 'rail__head' });
    this.rail.append(this.progressEl, this.headEl);
    this.items = sections.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail__item';
      b.style.top = `${stops[i].u * 100}%`;
      b.style.setProperty('--c', s.color);
      b.dataset.cursor = 'link';
      b.setAttribute('aria-label', `${s.index} ${s.title}`);
      b.innerHTML = `<span>${s.index} ${s.title}</span>`;
      b.addEventListener('click', () => onGoto(i));
      this.rail.append(b);
      return b;
    });

    root.querySelector('[data-action="home"]').addEventListener('click', onHome);
    this.soundBtn.addEventListener('click', () => onSound(this.soundBtn.getAttribute('aria-pressed') !== 'true'));
  }

  show() {
    this.root.classList.add('is-visible');
    this.root.removeAttribute('aria-hidden');
  }

  setSound(on) {
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.soundLabel.textContent = on ? 'Sound on' : 'Sound off';
  }

  setFocused(f) {
    this.root.classList.toggle('is-focused', f);
  }

  hideHint() {
    this.hint.classList.add('is-hidden');
  }

  #setBeacon(idx) {
    const b = this.beacon;
    if (idx < 0) {
      b.classList.remove('is-on');
      return;
    }
    const s = this.sections[idx];
    b.style.setProperty('--accent', s.color);
    b.querySelector('.beacon__index').textContent = `${s.index} — ${s.kicker}`;
    b.querySelector('.beacon__title').innerHTML = [...s.title].map((ch, i) => `<i style="--i:${i}">${ch}</i>`).join('');
    b.querySelector('.beacon__cta').textContent = this.touch ? 'Tap the building to enter' : 'Click the building to enter  ·  or press Enter';
    // restart the letter cascade
    b.classList.remove('is-on');
    void b.offsetWidth;
    b.classList.add('is-on');
  }

  update(progress, nearIdx, z) {
    this.progressEl.style.transform = `scaleY(${progress})`;
    this.headEl.style.transform = `translateY(${progress * this.rail.clientHeight}px)`;
    if (nearIdx !== this.nearIdx) {
      this.nearIdx = nearIdx;
      this.items.forEach((el, i) => el.classList.toggle('is-near', i === nearIdx));
      this.#setBeacon(nearIdx);
    }
    const sign = z >= 0 ? '+' : '−';
    const text = `Z ${sign}${Math.abs(z).toFixed(1).padStart(5, '0')} · ST.07 · ${String(Math.round(progress * 100)).padStart(3, '0')}%`;
    if (text !== this.lastReadout) this.readout.textContent = this.lastReadout = text;
  }
}

/** Section navigation, architectural readouts and contextual hints. */
export class Hud {
  constructor(root, sections, { onNavigate }) {
    this.root = root;
    this.sections = sections;
    this.current = -1;
    this.$ = (s) => root.querySelector(s);
    this.num = this.$('#sec-num');
    this.name = this.$('#sec-name');
    this.rail = this.$('#rail-fill');
    this.z = this.$('#ro-z');
    this.rollEl = this.$('#ro-roll');
    this.depth = this.$('#ro-depth');
    this.arrow = this.$('#gravity-arrow');
    this.returnBtn = this.$('#return-btn');

    const list = this.$('#section-list');
    this.items = sections.map((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><em></em>`;
      b.querySelector('em').textContent = s.name;
      b.setAttribute('aria-label', `Go to ${s.name}`);
      b.addEventListener('click', () => onNavigate(s.at));
      li.append(b);
      list.append(li);
      return li;
    });
    this.returnBtn.addEventListener('click', () => onNavigate(0));
    root.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(Number(a.dataset.nav));
    }));
  }

  reveal() {
    this.root.classList.add('is-visible');
  }

  /** Returns true when the section changed. */
  update(s, camera, roll) {
    let idx = 0;
    this.sections.forEach((sec, i) => { if (s >= sec.at - 0.005) idx = i; });
    let changed = false;
    if (idx !== this.current) {
      changed = this.current !== -1;
      this.current = idx;
      this.items.forEach((li, i) => li.classList.toggle('is-active', i === idx));
      this.num.textContent = String(idx + 1).padStart(2, '0');
      this.name.classList.add('is-out');
      clearTimeout(this.nameTimer);
      this.nameTimer = setTimeout(() => {
        this.name.textContent = this.sections[idx].name;
        this.name.classList.remove('is-out');
      }, 280);
    }

    this.rail.style.transform = `scaleY(${s})`;
    const z = camera.position.z;
    this.z.textContent = `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(1).padStart(5, '0')}`;
    const deg = Math.round(((roll * 180) / Math.PI) % 360);
    this.rollEl.textContent = `${String(deg).padStart(3, '0')}°`;
    this.depth.textContent = `${String(Math.round(s * 100)).padStart(3, '0')}%`;
    this.arrow.style.transform = `rotate(${-roll}rad)`;

    this.root.classList.toggle('is-scrolled', s > 0.015);
    const end = s > 0.975;
    this.returnBtn.classList.toggle('is-visible', end);
    this.returnBtn.tabIndex = end ? 0 : -1;
    return changed;
  }
}

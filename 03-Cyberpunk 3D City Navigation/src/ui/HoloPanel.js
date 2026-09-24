const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Renders a section's content blocks. Shared by the holographic panel and the no-WebGL fallback.
export function renderBlocks(blocks) {
  return blocks
    .map((b, i) => {
      const s = `style="--i:${i}"`;
      switch (b.type) {
        case 'lead':
          return `<p class="b-lead" ${s}>${esc(b.text)}</p>`;
        case 'text':
          return `<p class="b-text" ${s}>${esc(b.text)}</p>`;
        case 'stats':
          return `<div class="b-stats" ${s}>${b.items.map(([v, l]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>`;
        case 'tags':
          return `<ul class="b-tags" ${s}>${b.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
        case 'status':
          return `<p class="b-status" ${s}><i></i>${esc(b.text)}</p>`;
        case 'projects':
          return b.items
            .map(
              (p, k) => `<a class="b-project" href="${esc(p.href)}" style="--i:${i + k}">
                <span class="n">${String(k + 1).padStart(2, '0')}</span><h3>${esc(p.title)}</h3><span class="y">${esc(p.year)}</span>
                <p>${esc(p.desc)}</p><span class="t">${esc(p.tags)}</span></a>`,
            )
            .join('');
        case 'timeline':
          return `<ol class="b-timeline" ${s}>${b.items
            .map((e) => `<li><span class="p">${esc(e.period)}</span><h3>${esc(e.role)}</h3><span class="o">${esc(e.org)}</span><p>${esc(e.desc)}</p></li>`)
            .join('')}</ol>`;
        case 'links':
          return `<nav class="b-links" ${s}>${b.items
            .map(([label, value, href]) => `<a href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><small>${esc(label)}</small><b>${esc(value)}</b></a>`)
            .join('')}</nav>`;
        default:
          return '';
      }
    })
    .join('');
}

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01アイウエカキ';

// DOM hologram: clip-path reveal, staggered blocks, decoding title, leader line to the building.
export class HoloPanel {
  constructor({ root, leader, onClose, onNav, reducedMotion }) {
    this.root = root;
    this.leader = leader;
    this.line = leader.querySelector('line');
    this.dots = leader.querySelectorAll('circle');
    this.title = root.querySelector('#holo-title');
    this.index = root.querySelector('#holo-index');
    this.kicker = root.querySelector('#holo-kicker');
    this.body = root.querySelector('#holo-body');
    this.navButtons = root.querySelectorAll('[data-nav]');
    this.reducedMotion = reducedMotion;
    this.isOpen = false;

    root.querySelector('#holo-close').addEventListener('click', onClose);
    this.navButtons.forEach((b) => b.addEventListener('click', () => onNav(Number(b.dataset.nav))));
  }

  open(section, { side, index, total, prevTitle, nextTitle }) {
    clearTimeout(this.hideTimer);
    const r = this.root;
    r.style.setProperty('--accent', section.color);
    this.leader.style.setProperty('--accent', section.color);
    r.style.setProperty('--side', side === 'left' ? -1 : 1);
    r.classList.toggle('is-left', side === 'left');
    this.index.textContent = `${section.index} / ${String(total).padStart(2, '0')}`;
    this.kicker.textContent = section.kicker;
    this.body.innerHTML = renderBlocks(section.blocks);
    this.body.scrollTop = 0;
    this.navButtons[0].querySelector('em').textContent = prevTitle;
    this.navButtons[1].querySelector('em').textContent = nextTitle;
    this.#decode(section.title);

    r.hidden = false;
    r.classList.remove('is-open');
    void r.offsetWidth;
    r.classList.add('is-open');
    this.leader.classList.add('is-on');
    this.isOpen = true;
    setTimeout(() => this.root.querySelector('#holo-close').focus({ preventScroll: true }), 50);
  }

  close() {
    if (!this.isOpen) return Promise.resolve();
    this.isOpen = false;
    this.root.classList.remove('is-open');
    this.leader.classList.remove('is-on');
    return new Promise((resolve) => {
      this.hideTimer = setTimeout(() => {
        this.root.hidden = true;
        resolve();
      }, 450);
    });
  }

  #decode(text) {
    cancelAnimationFrame(this.decodeRaf);
    const final = text.toUpperCase();
    if (this.reducedMotion) {
      this.title.textContent = final;
      return;
    }
    const start = performance.now();
    const step = () => {
      const t = (performance.now() - start) / 700;
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const settle = (i / final.length) * 0.7 + 0.3;
        out += t >= settle ? final[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      this.title.textContent = out;
      if (t < 1) this.decodeRaf = requestAnimationFrame(step);
    };
    this.title.setAttribute('aria-label', final);
    step();
  }

  // Leader line from the projected building anchor to the nearest panel edge.
  updateLeader(screen) {
    if (!this.isOpen || !screen) {
      this.leader.classList.toggle('is-on', false);
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const left = this.root.classList.contains('is-left');
    const mobile = window.innerWidth <= 760;
    let ex, ey;
    if (mobile) {
      ex = Math.min(Math.max(screen.x, rect.left + 24), rect.right - 24);
      ey = rect.top;
    } else {
      ex = left ? rect.right : rect.left;
      ey = Math.min(Math.max(screen.y, rect.top + 30), rect.bottom - 30);
    }
    this.line.setAttribute('x1', screen.x);
    this.line.setAttribute('y1', screen.y);
    this.line.setAttribute('x2', ex);
    this.line.setAttribute('y2', ey);
    this.dots.forEach((d) => {
      d.setAttribute('cx', screen.x);
      d.setAttribute('cy', screen.y);
    });
    this.leader.classList.toggle('is-on', screen.visible);
  }
}

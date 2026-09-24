/** Project detail sheet: accessible dialog with focus handling and staggered reveal. */
export class Panel {
  constructor(el, { onClose }) {
    this.el = el;
    this.onClose = onClose;
    this.isOpen = false;
    this.q = (s) => el.querySelector(s);
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') this.trapFocus(e);
    });
  }

  open(project, cover) {
    const p = project;
    this.q('.panel-kicker').textContent = `N° ${p.index} · ${p.discipline} · ${p.year}`;
    this.q('.panel-title').textContent = p.title;
    const img = this.q('.panel-cover img');
    img.src = cover;
    img.alt = `${p.title} — exhibition poster`;
    this.q('.panel-lede').textContent = p.lede;
    const facts = this.q('.panel-facts');
    facts.replaceChildren(...Object.entries({ Location: p.location, ...p.facts }).map(([k, v]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = k;
      dd.textContent = v;
      d.append(dt, dd);
      return d;
    }));
    this.q('.panel-body').replaceChildren(...p.body.map((t) => {
      const para = document.createElement('p');
      para.textContent = t;
      return para;
    }));
    this.q('.panel-credits').textContent = p.credits;
    this.q('.panel-scroll').scrollTop = 0;

    this.returnFocus = document.activeElement;
    this.el.hidden = false;
    this.isOpen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.el.classList.add('is-open');
      this.q('.panel-close').focus({ preventScroll: true });
    }));
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('is-open');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => { if (!this.isOpen) this.el.hidden = true; }, 900);
    this.returnFocus?.focus?.({ preventScroll: true });
    this.onClose?.();
  }

  trapFocus(e) {
    const f = [...this.el.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

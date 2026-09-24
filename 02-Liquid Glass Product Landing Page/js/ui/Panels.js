import { smoothstep } from '../core/math.js';

/** Split text into masked, index-tagged words while keeping inline markup. */
function splitWords(el) {
  let i = 0;
  const makeWord = (content) => {
    const w = document.createElement('span');
    w.className = 'w';
    w.style.setProperty('--i', i++);
    const inner = document.createElement('span');
    inner.className = 'w__i';
    inner.append(content);
    w.append(inner);
    return w;
  };
  const nodes = [...el.childNodes];
  el.textContent = '';
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        el.append(/^\s+$/.test(part) ? ' ' : makeWord(part));
      }
    } else if (node.nodeName === 'BR') {
      el.append(node);
    } else {
      el.append(makeWord(node));
    }
  }
}

/**
 * Drives the fixed text panels from story progress: each panel's distance
 * from the current section sets opacity and a --p variable CSS turns into
 * staggered, per-word parallax.
 */
export class Panels {
  constructor({ panels, progress, onSelect }) {
    this.panels = panels;
    this.last = new Array(panels.length).fill(null);
    panels.forEach((panel) => panel.querySelectorAll('[data-split]').forEach(splitWords));

    this.fill = progress?.querySelector('.progress__fill');
    this.indexLabel = progress?.querySelector('[data-index]');
    this.ticks = progress ? [...progress.querySelectorAll('.progress__tick')] : [];
    this.ticks.forEach((tick, i) => tick.addEventListener('click', () => onSelect?.(i)));
    this.current = -1;
  }

  update(progress) {
    this.panels.forEach((panel, i) => {
      const d = progress - i;
      const key = Math.round(d * 1000);
      if (key === this.last[i]) return;
      this.last[i] = key;
      const opacity = 1 - smoothstep(0.12, 0.46, Math.abs(d));
      panel.style.setProperty('--p', d.toFixed(3));
      panel.style.opacity = opacity.toFixed(3);
      panel.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      panel.classList.toggle('is-active', Math.abs(d) < 0.3);
    });

    if (this.fill) this.fill.style.transform = `scaleY(${progress / (this.panels.length - 1)})`;
    const current = Math.round(progress);
    if (current !== this.current) {
      this.current = current;
      this.ticks.forEach((t, i) => t.classList.toggle('is-active', i === current));
      if (this.indexLabel) this.indexLabel.textContent = String(current + 1).padStart(2, '0');
    }
  }
}

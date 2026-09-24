/**
 * Splits an element's text into word (.w) and character (.c) spans, keeping inline markup like <em>.
 * Words carry --i for staggered reveals; characters are returned for per-glyph physics.
 * The element keeps its accessible name via aria-label.
 */
export function splitText(root) {
  root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
  const chars = [];
  let wordIndex = 0;

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const word = document.createElement('span');
          word.className = 'w';
          word.setAttribute('aria-hidden', 'true');
          word.style.setProperty('--i', wordIndex++);
          for (const ch of part) {
            const c = document.createElement('span');
            c.className = 'c';
            c.textContent = ch;
            word.appendChild(c);
            chars.push(c);
          }
          frag.appendChild(word);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };

  walk(root);
  return chars;
}

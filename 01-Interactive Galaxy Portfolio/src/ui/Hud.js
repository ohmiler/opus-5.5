import gsap from 'gsap'

const pad = (n, l = 2) => String(Math.floor(Math.abs(n))).padStart(l, '0')

/**
 * Persistent interface chrome: brand, sound toggle, section rail with a
 * continuous progress fill, live celestial coordinates and the travel hint.
 */
export class Hud {
  constructor({ root, sections, onGoto, onSound }) {
    this.root = root
    this.sections = sections
    this.onGoto = onGoto
    this.rail = root.querySelector('[data-rail]')
    this.fill = root.querySelector('[data-rail-fill]')
    this.hint = root.querySelector('[data-hint]')
    this.sound = root.querySelector('[data-sound]')
    this.soundLabel = root.querySelector('[data-sound-label]')
    this.announcer = document.querySelector('[data-announcer]')
    this.coords = {
      ra: root.querySelector('[data-ra]'),
      dec: root.querySelector('[data-dec]'),
      dist: root.querySelector('[data-dist]'),
    }
    this.coordsAt = 0
    this.current = -1

    this.rail.innerHTML = sections
      .map(
        (s, i) => `
        <li>
          <button type="button" class="rail__item" data-goto="${i}" style="--accent:${s.accent}" aria-label="${pad(i)} ${s.name}">
            <span class="rail__name">${s.name}</span>
            <span class="rail__num mono">${pad(i)}</span>
            <span class="rail__tick"></span>
          </button>
        </li>`,
      )
      .join('')
    this.buttons = [...this.rail.querySelectorAll('[data-goto]')]

    this.onClick = (e) => {
      const btn = e.target.closest('[data-goto]')
      if (btn) onGoto(Number(btn.dataset.goto))
    }
    this.rail.addEventListener('click', this.onClick)
    this.home = root.querySelector('[data-home]')
    this.onHome = () => onGoto(0)
    this.home.addEventListener('click', this.onHome)
    this.onSoundClick = () => onSound()
    this.sound.addEventListener('click', this.onSoundClick)
  }

  reveal({ reducedMotion }) {
    this.root.classList.add('is-ready')
    if (reducedMotion) return
    gsap.from(this.root.querySelectorAll('[data-hud-in]'), {
      autoAlpha: 0,
      y: (i, el) => (el.dataset.hudIn === 'up' ? 14 : -14),
      duration: 1.2,
      stagger: 0.08,
      ease: 'expo.out',
      delay: 0.2,
      clearProps: 'all',
    })
  }

  setSection(index) {
    if (index === this.current) return
    this.current = index
    this.buttons.forEach((b, i) => {
      b.classList.toggle('is-active', i === index)
      if (i === index) b.setAttribute('aria-current', 'step')
      else b.removeAttribute('aria-current')
    })
    document.documentElement.style.setProperty('--section-accent', this.sections[index].accent)
    this.announce(`${pad(index)} — ${this.sections[index].name}`)
  }

  setProgress(p) {
    this.fill.style.transform = `scaleY(${p / (this.sections.length - 1)})`
  }

  hideHint() {
    if (this.hintHidden) return
    this.hintHidden = true
    gsap.to(this.hint, { autoAlpha: 0, y: 8, duration: 0.6, ease: 'power2.out' })
  }

  setSound(enabled) {
    this.sound.setAttribute('aria-pressed', String(enabled))
    this.sound.classList.toggle('is-on', enabled)
    this.soundLabel.textContent = enabled ? 'Sound on' : 'Sound off'
  }

  /** Celestial-style readout of the camera, throttled to ~12 Hz. */
  setCoords(position, now) {
    if (now - this.coordsAt < 80) return
    this.coordsAt = now
    const { x, y, z } = position
    const len = Math.max(Math.hypot(x, y, z), 0.0001)
    const ra = ((Math.atan2(z, x) / (Math.PI * 2) + 1) % 1) * 24
    const dec = (Math.asin(y / len) * 180) / Math.PI
    this.coords.ra.textContent = `${pad(ra)}h ${pad((ra % 1) * 60)}m`
    this.coords.dec.textContent = `${dec < 0 ? '−' : '+'}${pad(dec)}° ${pad((Math.abs(dec) % 1) * 60)}′`
    this.coords.dist.textContent = (len * 312).toFixed(0).padStart(5, '0')
  }

  announce(text) {
    if (this.announcer) this.announcer.textContent = text
  }

  dispose() {
    this.rail.removeEventListener('click', this.onClick)
    this.home.removeEventListener('click', this.onHome)
    this.sound.removeEventListener('click', this.onSoundClick)
  }
}

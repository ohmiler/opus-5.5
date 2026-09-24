import { damp } from '../utils/math.js'

/**
 * Two-part cursor: a dot that tracks the pointer tightly and a ring that
 * trails with inertia. Over a planet the ring grows, gets pulled toward the
 * planet's centre (magnetism) and names the action.
 */
export class Cursor {
  constructor({ root, viewport }) {
    this.viewport = viewport
    this.enabled = !viewport.touch
    this.el = root
    this.ring = root.querySelector('.cursor__ring')
    this.dot = root.querySelector('.cursor__dot')
    this.label = root.querySelector('.cursor__text')

    this.x = viewport.width / 2
    this.y = viewport.height / 2
    this.rx = this.x
    this.ry = this.y
    this.dx = this.x
    this.dy = this.y
    this.magnet = null
    this.state = ''
    this.visible = false

    if (!this.enabled) {
      root.remove()
      return
    }
    document.documentElement.classList.add('has-cursor')

    // Native UI elements get the "link" state automatically.
    this.onOver = (e) => {
      const interactive = e.target.closest?.('a, button, [data-cursor]')
      this.uiHover = interactive ? interactive.dataset.cursor || 'link' : null
      this.refresh()
    }
    document.addEventListener('pointerover', this.onOver)
  }

  move(x, y) {
    if (!this.enabled) return
    this.x = x
    this.y = y
    if (!this.visible) {
      this.visible = true
      this.rx = this.dx = x
      this.ry = this.dy = y
      this.el.classList.add('is-visible')
    }
  }

  hide() {
    if (!this.enabled) return
    this.visible = false
    this.el.classList.remove('is-visible')
  }

  press(down) {
    if (!this.enabled) return
    this.el.classList.toggle('is-down', down)
  }

  /** Planet hover: label text plus a screen-space magnet point. */
  setTarget(label, magnet) {
    if (!this.enabled) return
    this.magnet = magnet
    this.targetLabel = label
    this.refresh()
  }

  setBusy(busy) {
    if (!this.enabled) return
    this.el.classList.toggle('is-busy', busy)
  }

  refresh() {
    const state = this.targetLabel ? 'planet' : this.uiHover ? 'link' : ''
    if (state === this.state && this.label.textContent === (this.targetLabel ?? '')) return
    this.state = state
    this.el.classList.toggle('is-planet', state === 'planet')
    this.el.classList.toggle('is-link', state === 'link')
    if (this.targetLabel) this.label.textContent = this.targetLabel
  }

  update(dt, reducedMotion) {
    if (!this.enabled || !this.visible) return
    let tx = this.x
    let ty = this.y
    if (this.magnet) {
      tx += (this.magnet.x - tx) * 0.28
      ty += (this.magnet.y - ty) * 0.28
    }
    const ringLambda = reducedMotion ? 60 : 11
    this.rx = damp(this.rx, tx, ringLambda, dt)
    this.ry = damp(this.ry, ty, ringLambda, dt)
    this.dx = damp(this.dx, this.x, 40, dt)
    this.dy = damp(this.dy, this.y, 40, dt)
    this.ring.style.transform = `translate3d(${this.rx}px, ${this.ry}px, 0)`
    this.dot.style.transform = `translate3d(${this.dx}px, ${this.dy}px, 0)`
  }

  dispose() {
    if (!this.enabled) return
    document.removeEventListener('pointerover', this.onOver)
    document.documentElement.classList.remove('has-cursor')
  }
}

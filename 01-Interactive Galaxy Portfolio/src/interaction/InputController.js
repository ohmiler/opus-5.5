import { Emitter } from '../core/Emitter.js'
import { clamp } from '../utils/math.js'

const WHEEL_THRESHOLD = 70 // px of accumulated delta that commits a section change
const SWIPE_THRESHOLD = 46
const QUIET_MS = 170
const MAX_LOCK_MS = 1100

/**
 * Translates raw wheel / touch / keyboard / pointer input into intents:
 *   navigate (+1 / -1 / index), lean (live scroll preview), tap, escape, open.
 *
 * One wheel *gesture* moves exactly one section, however long a trackpad's
 * inertial tail is. Before the threshold is reached the camera "leans"
 * toward the next section, so every input gets immediate visual feedback.
 */
export class InputController extends Emitter {
  constructor({ element, viewport }) {
    super()
    this.element = element
    this.viewport = viewport
    this.enabled = false

    this.pointer = { x: 0, y: 0, clientX: -100, clientY: -100, inside: false }
    this.accum = 0
    this.locked = false
    this.lockedAt = 0
    this.quietTimer = 0
    this.touch = null
    this.down = null

    this.onWheel = this.onWheel.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.onPointerLeave = this.onPointerLeave.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onTouchMove = this.onTouchMove.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
    this.onKey = this.onKey.bind(this)

    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave)
    element.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    element.addEventListener('touchstart', this.onTouchStart, { passive: true })
    element.addEventListener('touchmove', this.onTouchMove, { passive: false })
    element.addEventListener('touchend', this.onTouchEnd)
    window.addEventListener('keydown', this.onKey)
  }

  /** True when the event started inside a UI element that scrolls itself. */
  static fromScrollableUi(target) {
    return !!target?.closest?.('[data-scroll-lock]')
  }

  normalizeWheel(e) {
    if (e.deltaMode === 1) return e.deltaY * 16
    if (e.deltaMode === 2) return e.deltaY * this.viewport.height
    return e.deltaY
  }

  onWheel(e) {
    if (InputController.fromScrollableUi(e.target)) return
    e.preventDefault()
    if (!this.enabled) return

    const now = performance.now()
    clearTimeout(this.quietTimer)
    this.quietTimer = setTimeout(() => this.release(), QUIET_MS)

    const delta = this.normalizeWheel(e)
    const lastDelta = this.lastDelta ?? 0
    this.lastDelta = delta

    // Swallow a trackpad's decaying inertial tail; a fresh, accelerating
    // swipe after the minimum lock time counts as a new gesture.
    if (this.locked) {
      const decaying = Math.abs(delta) <= Math.abs(lastDelta) + 1
      if (now - this.lockedAt < MAX_LOCK_MS || decaying) return
    }
    this.locked = false

    this.accum += delta
    const t = clamp(this.accum / WHEEL_THRESHOLD, -1, 1)
    this.emit('lean', t)

    if (Math.abs(this.accum) >= WHEEL_THRESHOLD) {
      this.emit('navigate', Math.sign(this.accum))
      this.accum = 0
      this.locked = true
      this.lockedAt = now
      this.emit('lean', 0)
    }
  }

  release() {
    this.accum = 0
    this.locked = false
    this.emit('lean', 0)
  }

  onPointerMove(e) {
    if (e.pointerType === 'touch') return
    this.pointer.clientX = e.clientX
    this.pointer.clientY = e.clientY
    this.pointer.x = (e.clientX / this.viewport.width) * 2 - 1
    this.pointer.y = -(e.clientY / this.viewport.height) * 2 + 1
    this.pointer.inside = true
    this.pointer.overCanvas = e.target === this.element
    this.emit('move', this.pointer)
  }

  onPointerLeave() {
    this.pointer.inside = false
    this.emit('leave')
  }

  onPointerDown(e) {
    if (e.pointerType === 'touch') return
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    this.emit('press', true)
  }

  onPointerUp(e) {
    if (e.pointerType === 'touch' || !this.down) return
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y)
    const onCanvas = e.target === this.element
    this.down = null
    this.emit('press', false)
    if (this.enabled && onCanvas && moved < 8) this.emit('tap', { clientX: e.clientX, clientY: e.clientY })
  }

  onTouchStart(e) {
    const t = e.touches[0]
    this.touch = { x: t.clientX, y: t.clientY, t: performance.now(), dy: 0, dx: 0 }
  }

  onTouchMove(e) {
    if (!this.touch || !this.enabled) return
    const t = e.touches[0]
    this.touch.dx = t.clientX - this.touch.x
    this.touch.dy = t.clientY - this.touch.y
    if (Math.abs(this.touch.dy) > Math.abs(this.touch.dx)) {
      e.preventDefault()
      this.emit('lean', clamp(-this.touch.dy / (SWIPE_THRESHOLD * 2.2), -1, 1))
    }
  }

  onTouchEnd() {
    if (!this.touch) return
    const { dx, dy, t, x, y } = this.touch
    this.touch = null
    this.emit('lean', 0)
    if (!this.enabled) return
    if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      this.emit('navigate', dy < 0 ? 1 : -1)
    } else if (Math.hypot(dx, dy) < 10 && performance.now() - t < 450) {
      this.emit('tap', { clientX: x, clientY: y, touch: true })
    }
  }

  onKey(e) {
    if (!this.enabled || e.defaultPrevented) return
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const inUi = e.target?.closest?.('button, a, [role="dialog"]')

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault()
        this.emit('navigate', 1)
        break
      case ' ':
        if (inUi) return
        e.preventDefault()
        this.emit('navigate', e.shiftKey ? -1 : 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault()
        this.emit('navigate', -1)
        break
      case 'Home':
        e.preventDefault()
        this.emit('goto', 0)
        break
      case 'End':
        e.preventDefault()
        this.emit('goto', Infinity)
        break
      case 'Enter':
        if (inUi) return
        this.emit('open')
        break
      case 'Escape':
        this.emit('escape')
        break
    }
  }

  dispose() {
    clearTimeout(this.quietTimer)
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('pointermove', this.onPointerMove)
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave)
    this.element.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.element.removeEventListener('touchstart', this.onTouchStart)
    this.element.removeEventListener('touchmove', this.onTouchMove)
    this.element.removeEventListener('touchend', this.onTouchEnd)
    window.removeEventListener('keydown', this.onKey)
    this.clear()
  }
}

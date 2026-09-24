import { Emitter } from './Emitter.js'

/**
 * Single source of truth for window size, device class, pixel ratio budget
 * and user motion preferences. Everything else listens to it.
 */
export class Viewport extends Emitter {
  constructor() {
    super()
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.touch = window.matchMedia('(pointer: coarse)').matches
    this.compact = Math.min(this.width, this.height) < 720

    const cores = navigator.hardwareConcurrency || 4
    const memory = navigator.deviceMemory || 8
    this.tier = this.touch || this.compact || cores <= 4 || memory <= 4 ? 'low' : 'high'

    // Pixel ratio budget. The PerformanceMonitor may lower `dpr` at runtime,
    // but never above this cap.
    this.maxDpr = this.tier === 'high' ? 2 : 1.5
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reducedMotion = this.motionQuery.matches

    this.onResize = this.onResize.bind(this)
    this.onMotionChange = this.onMotionChange.bind(this)
    this.resizeFrame = 0

    window.addEventListener('resize', this.onResize, { passive: true })
    this.motionQuery.addEventListener('change', this.onMotionChange)
  }

  get aspect() {
    return this.width / this.height
  }

  get portrait() {
    return this.aspect < 0.9
  }

  onResize() {
    // Coalesce bursts of resize events into one update per frame.
    cancelAnimationFrame(this.resizeFrame)
    this.resizeFrame = requestAnimationFrame(() => {
      this.width = window.innerWidth
      this.height = window.innerHeight
      this.compact = Math.min(this.width, this.height) < 720
      this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr, this.dprLimit ?? Infinity)
      this.emit('resize', this)
    })
  }

  /** Called by the performance monitor to step quality down. */
  limitDpr(value) {
    this.dprLimit = value
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr, value)
    this.emit('resize', this)
  }

  onMotionChange(e) {
    this.reducedMotion = e.matches
    document.documentElement.classList.toggle('reduced-motion', this.reducedMotion)
    this.emit('motion', this.reducedMotion)
  }

  dispose() {
    window.removeEventListener('resize', this.onResize)
    this.motionQuery.removeEventListener('change', this.onMotionChange)
    cancelAnimationFrame(this.resizeFrame)
    this.clear()
  }
}

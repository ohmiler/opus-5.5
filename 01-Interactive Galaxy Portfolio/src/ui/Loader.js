import gsap from 'gsap'
import { damp } from '../utils/math.js'

/**
 * Loading sequence driven by real work (fonts, world generation, shader
 * compilation, GPU warm-up). The displayed number is smoothed so it never
 * jumps, and the exit only plays once it has actually reached 100.
 */
export class Loader {
  constructor(root) {
    this.root = root
    this.countEl = root.querySelector('[data-count]')
    this.barEl = root.querySelector('[data-bar]')
    this.stepEl = root.querySelector('[data-step]')
    this.target = 0
    this.shown = 0
    this.lastText = ''
    this.raf = 0
    this.tasks = []
    this.startedAt = performance.now()
    this.tick = this.tick.bind(this)
    this.schedule()
  }

  // rAF pauses in background tabs; fall back to a timer so loading still lands.
  schedule() {
    this.raf = document.hidden ? setTimeout(this.tick, 50) : requestAnimationFrame(this.tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.raf)
  }

  /** Register weighted tasks; returns per-task progress setters. */
  plan(steps) {
    const total = steps.reduce((s, x) => s + x.weight, 0)
    this.tasks = steps.map((s) => ({ ...s, weight: s.weight / total, value: 0 }))
    return Object.fromEntries(
      this.tasks.map((task) => [
        task.id,
        (value) => {
          task.value = Math.max(task.value, Math.min(1, value))
          if (value > 0 && value < 1) this.setStep(task.label)
          this.target = this.tasks.reduce((s, t) => s + t.value * t.weight, 0)
        },
      ]),
    )
  }

  setStep(label) {
    if (this.stepEl.textContent !== label) this.stepEl.textContent = label
  }

  tick() {
    const now = performance.now()
    const dt = Math.min((now - (this.last ?? now)) / 1000, 0.1)
    this.last = now
    this.shown = damp(this.shown, this.target, 3.2, dt)
    if (this.target >= 1 && this.shown > 0.995) this.shown = 1

    const n = Math.floor(this.shown * 100)
    const text = String(n).padStart(3, '0')
    if (text !== this.lastText) {
      this.countEl.textContent = text
      this.root.setAttribute('aria-valuenow', String(n))
      this.lastText = text
    }
    this.barEl.style.transform = `scaleX(${this.shown})`
    this.schedule()
  }

  /** Waits for the counter to land on 100 (and a minimum dwell), then exits. */
  async finish({ reducedMotion }) {
    this.setStep('Ready')
    await new Promise((resolve) => {
      const check = () => {
        const dwell = performance.now() - this.startedAt > (reducedMotion ? 300 : 1600)
        if (this.shown >= 1 && dwell) resolve()
        else setTimeout(check, 50)
      }
      check()
    })
    this.stop()

    return new Promise((resolve) => {
      if (reducedMotion) {
        gsap.to(this.root, { autoAlpha: 0, duration: 0.4, onComplete: () => this.remove(resolve) })
        return
      }
      // The progress hairline becomes the horizon the loader collapses onto.
      gsap
        .timeline({ onComplete: () => this.remove(resolve) })
        .to(this.root.querySelectorAll('[data-loader-fade]'), { autoAlpha: 0, y: -12, duration: 0.5, stagger: 0.05, ease: 'power2.in' })
        .to(this.countEl, { yPercent: -110, duration: 0.7, ease: 'expo.in' }, 0)
        .to(this.root.querySelector('.loader__bar'), { width: '100vw', duration: 0.9, ease: 'expo.inOut' }, 0.3)
        .to(this.root, { clipPath: 'inset(50% 0% 50% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.95)
        .add(() => resolve(), 1.5)
    })
  }

  remove(resolve) {
    this.root.remove()
    resolve?.()
  }

  fail(message) {
    this.stop()
    this.setStep(message)
    this.root.classList.add('is-error')
  }
}

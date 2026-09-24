/**
 * Watches real frame times and steps quality down (pixel ratio first, then
 * bloom) when the device can't hold ~55 fps. It never steps back up, which
 * avoids oscillating between tiers.
 */
export class PerformanceMonitor {
  constructor({ viewport, renderer }) {
    this.viewport = viewport
    this.renderer = renderer
    this.samples = []
    this.window = 90
    this.cooldown = 0
    this.steps = 0
    this.active = false
  }

  start() {
    this.active = true
    this.samples.length = 0
    this.cooldown = 60
  }

  sample(dtMs) {
    if (!this.active || document.hidden) return
    if (this.cooldown > 0) {
      this.cooldown--
      return
    }
    // Ignore hitches (tab switches, GC) — we care about sustained load.
    if (dtMs > 200) return
    this.samples.push(dtMs)
    if (this.samples.length < this.window) return

    const sorted = [...this.samples].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    this.samples.length = 0
    if (median > 18.5) this.degrade()
  }

  degrade() {
    const { viewport, renderer } = this
    if (viewport.dpr > 1.01) {
      viewport.limitDpr(Math.max(1, viewport.dpr - 0.35))
    } else if (renderer.bloom.enabled) {
      renderer.setBloomEnabled(false)
    } else {
      this.active = false
      return
    }
    this.steps++
    this.cooldown = 90
    if (this.steps >= 4) this.active = false
  }
}

/**
 * Sound layer. The app only ever emits semantic cues (hover, select, travel,
 * open, close); this class decides what they sound like. Everything here is
 * synthesised with Web Audio so there are no assets to load. Swap any method
 * for sample playback without touching the rest of the app.
 *
 * Off by default; the preference is remembered. Audio only starts after a
 * user gesture, as browsers require.
 */
const STORAGE_KEY = 'tiny-universe:sound'

export class SoundDesign {
  constructor(bus) {
    this.bus = bus
    this.ctx = null
    this.enabled = false
    this.unsubscribe = [
      bus.on('sfx:hover', () => this.hover()),
      bus.on('sfx:select', () => this.select()),
      bus.on('sfx:travel', (d) => this.travel(d)),
      bus.on('sfx:open', () => this.chord([0, 7, 12], 0.05)),
      bus.on('sfx:close', () => this.chord([12, 7, 0], 0.035)),
    ]
    try {
      this.wanted = localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      this.wanted = false
    }
  }

  ensureContext() {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    const comp = this.ctx.createDynamicsCompressor()
    this.master.connect(comp).connect(this.ctx.destination)
    this.noise = this.makeNoise()
    return this.ctx
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  async setEnabled(enabled) {
    this.enabled = enabled
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {}
    if (enabled && !this.ensureContext()) return
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (enabled) {
      await this.ctx.resume()
      this.startAmbience()
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setTargetAtTime(0.9, now, 0.4)
    } else {
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setTargetAtTime(0, now, 0.15)
    }
  }

  toggle() {
    this.setEnabled(!this.enabled)
    return this.enabled
  }

  /** A low, slowly breathing drone — the room tone of the galaxy. */
  startAmbience() {
    if (this.ambience) return
    const ctx = this.ctx
    const out = ctx.createGain()
    out.gain.value = 0.045
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320
    filter.Q.value = 4
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.05
    lfoGain.gain.value = 160
    lfo.connect(lfoGain).connect(filter.frequency)
    const oscs = [55, 82.4, 110.3].map((f, i) => {
      const o = ctx.createOscillator()
      o.type = i === 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      o.detune.value = (i - 1) * 6
      o.connect(filter)
      o.start()
      return o
    })
    filter.connect(out).connect(this.master)
    lfo.start()
    this.ambience = { oscs, lfo, out }
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running'
  }

  hover() {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(1320 + Math.random() * 60, t)
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.08)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.025, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.2)
  }

  select() {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(392, t)
    o.frequency.exponentialRampToValueAtTime(196, t + 0.4)
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.55)
  }

  /** Filtered-noise swell shaped to the camera flight. */
  travel(duration = 2.5) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(180, t)
    filter.frequency.exponentialRampToValueAtTime(1400, t + duration * 0.5)
    filter.frequency.exponentialRampToValueAtTime(160, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + duration * 0.45)
    g.gain.linearRampToValueAtTime(0, t + duration)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.05)
  }

  chord(semitones, level) {
    if (!this.ready) return
    const ctx = this.ctx
    const t = ctx.currentTime
    semitones.forEach((s, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 440 * Math.pow(2, s / 12)
      const start = t + i * 0.07
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(level, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
      o.connect(g).connect(this.master)
      o.start(start)
      o.stop(start + 1.2)
    })
  }

  dispose() {
    this.unsubscribe.forEach((off) => off())
    this.ctx?.close()
    this.ctx = null
  }
}

import gsap from 'gsap'
import { Viewport } from './Viewport.js'
import { Emitter } from './Emitter.js'
import { Renderer } from './Renderer.js'
import { CameraRig } from './CameraRig.js'
import { PerformanceMonitor } from './PerformanceMonitor.js'
import { World } from '../world/World.js'
import { shared } from '../world/shared.js'
import { InputController } from '../interaction/InputController.js'
import { Picker } from '../interaction/Picker.js'
import { Loader } from '../ui/Loader.js'
import { Hud } from '../ui/Hud.js'
import { Labels } from '../ui/Labels.js'
import { Cursor } from '../ui/Cursor.js'
import { ProjectPanel } from '../ui/ProjectPanel.js'
import { SectionCopy } from '../ui/SectionCopy.js'
import { SoundDesign } from '../audio/SoundDesign.js'
import { projects, owner } from '../data/projects.js'
import { clamp } from '../utils/math.js'
import { nextFrame } from '../utils/frame.js'

const timeout = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Composition root. Owns the lifecycle (load → intro → explore), routes
 * input intents to the camera / world / UI, and runs the frame loop.
 */
export class App {
  constructor(dom) {
    this.dom = dom
    this.section = 0
    this.focused = null
    this.hovered = null
    this.time = 0
    this.last = performance.now()
    this.fader = { value: 0 }
    this.bus = new Emitter()
    this.tick = this.tick.bind(this)
  }

  get reducedMotion() {
    return this.viewport.reducedMotion
  }

  async start() {
    const { dom } = this
    this.viewport = new Viewport()
    document.documentElement.classList.toggle('reduced-motion', this.reducedMotion)
    document.documentElement.classList.toggle('is-touch', this.viewport.touch)
    this.loader = new Loader(dom.loader)

    if (!Renderer.supported()) return this.fallback()

    const progress = this.loader.plan([
      { id: 'fonts', label: 'Resolving typefaces', weight: 1 },
      { id: 'world', label: 'Forming worlds', weight: 3 },
      { id: 'shaders', label: 'Compiling light', weight: 3 },
      { id: 'warmup', label: 'Stabilising orbits', weight: 1 },
    ])

    try {
      // Fonts first: the in-scene typography is drawn to canvas and needs them.
      progress.fonts(0.2)
      await Promise.race([
        Promise.all([
          document.fonts.load('italic 300px "Instrument Serif"'),
          document.fonts.load('400 40px "Instrument Serif"'),
          document.fonts.load('400 12px "IBM Plex Mono"'),
          document.fonts.load('400 16px "Inter Tight Variable"'),
        ]),
        timeout(3500),
      ])
      progress.fonts(1)

      this.world = new World({ quality: this.viewport.tier })
      await this.world.build(progress.world)

      this.rig = new CameraRig({ viewport: this.viewport, fader: this.fader })
      this.rig.setStations(this.world.layout(this.viewport))
      this.renderer = new Renderer({
        canvas: dom.canvas,
        viewport: this.viewport,
        scene: this.world.scene,
        camera: this.rig.camera,
      })
      this.renderer.uniforms.uFade = this.fader
      this.applySize()
      this.rig.update(0, { x: 0, y: 0 }, this.reducedMotion)

      // Compile every program up front (including hidden scene text) so the
      // first reveal of anything never hitches.
      progress.shaders(0.15)
      for (const t of this.world.texts) t.mesh.visible = true
      await this.renderer.compile()
      for (const t of this.world.texts) t.mesh.visible = false
      progress.shaders(1)

      for (let i = 0; i < 6; i++) {
        this.renderer.render()
        progress.warmup((i + 1) / 6)
        await nextFrame()
      }
    } catch (err) {
      console.error(err)
      return this.fallback()
    }

    this.setupInterface()
    this.last = performance.now()
    this.renderer.gl.setAnimationLoop(this.tick)

    await this.loader.finish({ reducedMotion: this.reducedMotion })
    this.intro()
  }

  setupInterface() {
    const { dom, viewport, world } = this
    const sections = [
      { name: 'Origin', accent: '#ffd2a1' },
      ...projects.map((p) => ({ name: p.name, accent: p.world.accent })),
      { name: 'Signal', accent: '#ece6db' },
    ]
    this.lastSection = sections.length - 1

    this.hud = new Hud({
      root: dom.hud,
      sections,
      onGoto: (i) => this.onRailGoto(i),
      onSound: () => this.hud.setSound(this.sound.toggle()),
    })
    this.labels = new Labels({ root: dom.labels, planets: world.planets, touch: viewport.touch })
    this.cursor = new Cursor({ root: dom.cursor, viewport })
    this.panel = new ProjectPanel({
      root: dom.panel,
      onClose: () => this.closeProject(),
      onStep: (i) => this.openProject(i),
    })
    this.copy = new SectionCopy({ intro: dom.intro, outro: dom.outro, owner, lastIndex: this.lastSection })
    this.picker = new Picker(this.rig.camera, world.planets)
    this.sound = new SoundDesign(this.bus)
    this.perf = new PerformanceMonitor({ viewport, renderer: this.renderer })

    // Restore a remembered "sound on" at the first gesture (autoplay rules).
    if (this.sound.wanted) {
      const arm = () => {
        this.sound.setEnabled(true)
        this.hud.setSound(true)
        window.removeEventListener('pointerdown', arm)
        window.removeEventListener('keydown', arm)
      }
      window.addEventListener('pointerdown', arm)
      window.addEventListener('keydown', arm)
    }

    const input = (this.input = new InputController({ element: dom.canvas, viewport }))
    input.on('navigate', (dir) => this.navigate(dir))
    input.on('goto', (i) => this.goToSection(Math.min(i, this.lastSection)))
    input.on('lean', (v) => {
      if (!this.focused) this.rig.leanTarget = v * (this.reducedMotion ? 0 : 0.14)
    })
    input.on('tap', (e) => this.onTap(e))
    input.on('move', (p) => this.cursor.move(p.clientX, p.clientY))
    input.on('leave', () => this.cursor.hide())
    input.on('press', (down) => this.cursor.press(down))
    input.on('escape', () => this.focused && this.closeProject())
    input.on('open', () => {
      const planet = world.planets[this.section - 1]
      if (planet && !this.focused) this.openProject(planet.index)
    })

    viewport.on('resize', () => this.applySize())
    viewport.on('motion', (reduced) => world.setReducedMotion(reduced))
    world.setReducedMotion(this.reducedMotion)
  }

  applySize() {
    const { viewport, rig, renderer, world } = this
    rig.resize()
    rig.setStations(world.layout(viewport))
    renderer.resize()
    world.resize(renderer.bufferHeight)
    shared.uPointScale.value = rig.pointScale(renderer.bufferHeight)
    shared.uDpr.value = viewport.dpr
  }

  async intro() {
    const reducedMotion = this.reducedMotion
    this.hud.reveal({ reducedMotion })
    this.hud.setSection(0)
    this.copy.show(0, { reducedMotion, delay: reducedMotion ? 0 : 2.4 })
    gsap.delayedCall(reducedMotion ? 0 : 1.6, () => (this.input.enabled = true))
    await this.rig.playIntro({ reducedMotion })
    this.perf.start()
  }

  /* ------------------------------------------------------------ Intents -- */

  navigate(dir) {
    if (this.focused) return this.closeProject()
    this.goToSection(this.section + dir)
  }

  onRailGoto(index) {
    // Choosing the current world again from the rail opens it — keyboard path to a project.
    const planet = this.world.planets[index - 1]
    if (index === this.section && planet && !this.focused) return this.openProject(planet.index)
    if (this.focused) this.closeProject()
    this.goToSection(index)
  }

  goToSection(index) {
    index = clamp(index, 0, this.lastSection)
    if (index === this.section) {
      this.rig.leanTarget = 0
      return
    }
    const from = this.section
    this.section = index
    const reducedMotion = this.reducedMotion
    const planet = this.world.planets[index - 1] ?? null

    this.hud.setSection(index)
    if (index > 0) this.hud.hideHint()
    this.world.setActive(index, reducedMotion)
    this.labels.setActive(planet)
    this.copy.show(index, { reducedMotion, delay: reducedMotion ? 0 : 1.2 })
    this.bus.emit('sfx:travel', this.rig.travelDuration(from, index))
    this.rig.hurryIntro()
    this.rig.goTo(index, { reducedMotion })
  }

  openProject(i) {
    const planet = this.world.planets[i]
    if (!planet || this.focused === planet) return
    const reducedMotion = this.reducedMotion
    if (this.section !== i + 1) this.goToSection(i + 1)

    this.focused = planet
    this.rig.leanTarget = 0
    this.rig.focusOn(this.world.stations[i + 1], { reducedMotion })
    this.panel.open(planet.project, i, projects.length, { reducedMotion })
    this.labels.setSuppressed(true)
    this.world.setFocused(true)
    this.cursor.setTarget(null, null)
    document.documentElement.classList.add('is-focused')
    this.bus.emit('sfx:open')
    this.hud.announce(`${planet.project.name}. ${planet.project.tagline}`)
  }

  closeProject() {
    if (!this.focused) return
    const reducedMotion = this.reducedMotion
    this.focused = null
    this.rig.unfocus({ reducedMotion })
    this.panel.close({ reducedMotion })
    this.labels.setSuppressed(false)
    this.world.setFocused(false)
    document.documentElement.classList.remove('is-focused')
    this.bus.emit('sfx:close')
  }

  onTap({ clientX, clientY, touch }) {
    const planet = this.picker.pick(clientX, clientY, this.viewport, touch ? 1.6 : 1.25)
    if (planet) {
      this.bus.emit('sfx:select')
      this.openProject(planet.index)
    } else if (this.focused) {
      this.closeProject()
    }
  }

  /* -------------------------------------------------------------- Frame -- */

  updateHover() {
    const p = this.input.pointer
    let planet = null
    if (!this.viewport.touch && p.inside && p.overCanvas && this.input.enabled) {
      planet = this.picker.pick(p.clientX, p.clientY, this.viewport, 1.25)
      if (planet && planet === this.focused) planet = null
    }

    if (planet !== this.hovered) {
      if (this.hovered) this.hovered.hoverTarget = 0
      if (planet) {
        planet.hoverTarget = 1
        this.bus.emit('sfx:hover')
      }
      this.hovered = planet
      this.labels.setHover(planet)
      this.dom.canvas.classList.toggle('is-pointer', !!planet)
    }

    if (planet) {
      this.magnet = this.labels.screenInfo(planet, this.rig.camera, this.viewport, this.magnet ?? {})
      this.cursor.setTarget('Land', this.magnet)
    } else {
      this.cursor.setTarget(null, null)
    }
  }

  tick() {
    const now = performance.now()
    const dtMs = now - this.last
    const dt = Math.min(dtMs / 1000, 1 / 20)
    this.last = now
    const reducedMotion = this.reducedMotion

    this.time += dt * (reducedMotion ? 0.3 : 1)
    shared.uTime.value = this.time

    this.rig.update(dt, this.input.pointer, reducedMotion)
    this.world.update(dt, this.rig.camera)
    this.updateHover()
    this.labels.update(dt, this.rig.camera, this.viewport)
    this.cursor.update(dt, reducedMotion)
    this.hud.setProgress(clamp(this.rig.progress + this.rig.lean, 0, this.lastSection))
    this.hud.setCoords(this.rig.camera.position, now)

    const lens = this.renderer.uniforms
    if (!reducedMotion) lens.uTime.value = this.time
    lens.uTravel.value = this.rig.travel

    this.renderer.render()
    this.perf.sample(dtMs)
  }

  /* ------------------------------------------------------------ Fallback -- */

  fallback() {
    document.documentElement.classList.add('no-webgl')
    this.loader?.fail('WebGL unavailable')
    this.loader?.root.remove()
    const list = this.dom.fallback
    list.hidden = false
    list.querySelector('[data-fallback-list]').innerHTML = projects
      .map(
        (p) => `
        <li style="--accent:${p.world.accent}">
          <p class="mono">${p.code} · ${p.classification} · ${p.year}</p>
          <h2 class="serif">${p.name}</h2>
          <p>${p.description}</p>
          <a href="${p.link}" target="_blank" rel="noopener">Visit the project ↗</a>
        </li>`,
      )
      .join('')
  }

  dispose() {
    this.renderer?.gl.setAnimationLoop(null)
    this.input?.dispose()
    this.hud?.dispose()
    this.labels?.dispose()
    this.cursor?.dispose()
    this.panel?.dispose()
    this.sound?.dispose()
    this.rig?.dispose()
    this.world?.dispose()
    this.renderer?.dispose()
    this.viewport?.dispose()
    this.bus.clear()
    gsap.globalTimeline.clear()
  }
}

import * as THREE from 'three'
import { clamp, damp } from '../utils/math.js'

const _v = new THREE.Vector3()
const _edge = new THREE.Vector3()
const _right = new THREE.Vector3()
const _toPlanet = new THREE.Vector3()
const _fwd = new THREE.Vector3()

/**
 * Catalogue annotations pinned to each planet in screen space. A hairline
 * leader runs from the planet limb to the label; the project name is set
 * letter by letter and only revealed on hover (or when active on touch).
 */
export class Labels {
  constructor({ root, planets, touch }) {
    this.root = root
    this.touch = touch
    this.items = planets.map((planet) => {
      const p = planet.project
      const el = document.createElement('div')
      el.className = 'plabel'
      el.style.setProperty('--accent', p.world.accent)
      el.innerHTML = `
        <span class="plabel__lead"></span>
        <span class="plabel__body">
          <span class="plabel__code mono">${p.code}</span>
          <span class="plabel__name serif">${[...p.name].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</span>
          <span class="plabel__meta mono">${p.classification} · ${p.year}</span>
        </span>`
      root.appendChild(el)
      return { planet, el, x: 0, y: 0, opacity: 0, shownOpacity: -1, hover: false, active: false }
    })
  }

  setActive(planet) {
    this.hasActive = !!planet
    for (const item of this.items) {
      const active = item.planet === planet
      if (active !== item.active) {
        item.active = active
        item.el.classList.toggle('is-active', active)
        if (this.touch) item.el.classList.toggle('is-hover', active)
      }
    }
  }

  setHover(planet) {
    if (this.touch) return
    for (const item of this.items) {
      const hover = item.planet === planet
      if (hover !== item.hover) {
        item.hover = hover
        item.el.classList.toggle('is-hover', hover)
      }
    }
  }

  /** Hide while a project panel is open so the close-up stays clean. */
  setSuppressed(suppressed) {
    this.root.classList.toggle('is-suppressed', suppressed)
  }

  /** Screen-space centre and radius of a planet, used by the cursor magnet. */
  screenInfo(planet, camera, viewport, out = {}) {
    _v.copy(planet.position).project(camera)
    out.x = (_v.x * 0.5 + 0.5) * viewport.width
    out.y = (-_v.y * 0.5 + 0.5) * viewport.height
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _edge.copy(planet.position).addScaledVector(_right, planet.radius).project(camera)
    out.r = Math.abs((_edge.x * 0.5 + 0.5) * viewport.width - out.x)
    out.front = _v.z < 1
    return out
  }

  update(dt, camera, viewport) {
    const info = {}
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
    for (const item of this.items) {
      const { planet, el } = item
      this.screenInfo(planet, camera, viewport, info)
      _toPlanet.subVectors(planet.position, camera.position)
      const dist = _toPlanet.length()
      const inFront = _toPlanet.dot(_fwd) > 0 && info.front

      // Fade with distance; keep far planets as quiet catalogue marks.
      const near = clamp(1 - (dist - 14) / 50, 0, 1)
      const onScreen = info.x > -80 && info.x < viewport.width + 80 && info.y > -80 && info.y < viewport.height + 80
      // While a world is active, the others recede to quiet catalogue marks.
      const idle = this.hasActive ? 0.22 : 0.35 + near * 0.35
      const target = inFront && onScreen ? (item.active || item.hover ? 1 : idle) : 0
      item.opacity = damp(item.opacity, target, 6, dt)

      const r = Math.max(info.r, 6)
      const k = Math.SQRT1_2
      item.x = info.x + r * k
      item.y = info.y - r * k

      if (item.opacity < 0.01) {
        if (item.shownOpacity !== 0) {
          el.style.opacity = '0'
          item.shownOpacity = 0
        }
        continue
      }
      el.style.opacity = item.opacity.toFixed(3)
      item.shownOpacity = item.opacity
      // Narrow screens: centre the label under the planet. Otherwise flip to
      // the planet's left when it would run off the right edge.
      const mode = viewport.width < 560 ? 'below' : item.x + 190 > viewport.width ? 'flip' : 'side'
      if (mode !== item.mode) {
        item.mode = mode
        el.classList.toggle('is-flip', mode === 'flip')
        el.classList.toggle('is-below', mode === 'below')
      }
      if (mode === 'flip') item.x = info.x - r * k
      if (mode === 'below') {
        item.x = info.x
        item.y = info.y + r * 1.15 + 18
      }
      el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`
      el.style.setProperty('--lead', `${clamp(40 + r * 0.2, 40, 80).toFixed(0)}px`)
    }
  }

  dispose() {
    this.root.innerHTML = ''
    this.items = []
  }
}

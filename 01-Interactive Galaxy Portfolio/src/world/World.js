import * as THREE from 'three'
import gsap from 'gsap'
import { Planet } from './Planet.js'
import { Galaxy, Starfield, Core } from './Galaxy.js'
import { SceneText } from './SceneText.js'
import { shared } from './shared.js'
import { projects } from '../data/projects.js'
import { nextFrame } from '../utils/frame.js'

const UP = new THREE.Vector3(0, 1, 0)
const STATION_SWING = 2.05

/**
 * Owns everything in the 3D scene and the art-directed camera "stations"
 * (one per section: origin, five worlds, signal).
 */
export class World {
  constructor({ quality }) {
    this.quality = quality
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#020203')
    this.planets = []
    this.texts = []
    this.activeText = null
  }

  /** Builds the scene in slices so the loader can report honest progress. */
  async build(onProgress) {
    const high = this.quality === 'high'
    this.sphere = new THREE.SphereGeometry(1, high ? 128 : 72, high ? 96 : 48)

    const steps = projects.length + 3
    let done = 0
    const tick = async () => {
      onProgress(++done / steps)
      await nextFrame()
    }

    for (const [i, project] of projects.entries()) {
      const planet = new Planet(project, i, { sphere: this.sphere, quality: this.quality })
      this.planets.push(planet)
      this.scene.add(planet.group)
      await tick()
    }

    this.galaxy = new Galaxy({ quality: this.quality, planets: this.planets })
    this.scene.add(this.galaxy.group)
    await tick()

    this.stars = new Starfield({ quality: this.quality })
    this.core = new Core()
    this.scene.add(this.stars.points, this.core.mesh)
    await tick()

    for (const planet of this.planets) {
      const text = new SceneText({
        text: planet.project.name,
        accent: planet.project.world.accent,
        width: planet.radius * (planet.project.world.ring ? 11 : 8.5),
      })
      this.texts.push(text)
      this.scene.add(text.mesh)
    }
    await tick()
  }

  /**
   * Camera compositions for every section. Recomputed on resize because
   * portrait screens need wider framing and a different focus layout.
   */
  layout({ portrait }) {
    const stations = []
    const far = portrait ? 1.6 : 1

    // Origin: wide screens push the galaxy right so the headline owns the left.
    stations.push(
      portrait
        ? { position: new THREE.Vector3(-22, 44, 74).multiplyScalar(far), target: new THREE.Vector3(2, -8, 2) }
        : { position: new THREE.Vector3(-56, 92, 78), target: new THREE.Vector3(-22, -2, -8) },
    )

    for (const [i, planet] of this.planets.entries()) {
      const R = planet.radius
      const P = planet.position
      const radial = new THREE.Vector3(P.x, 0, P.z).normalize()

      // Swing ~120° around from the outward radial: the core lights the planet
      // three-quarters from the side instead of silhouetting it.
      const reach = planet.project.world.ring ? 1.4 : 1
      const dir = radial.clone().applyAxisAngle(UP, STATION_SWING).setY(planet.project.world.ring ? 0.42 : 0.24).normalize()
      const position = P.clone().addScaledVector(dir, R * reach * (portrait ? 7.4 : 5.2))
      const forward = P.clone().sub(position).normalize()
      const right = forward.clone().cross(UP).normalize()
      const up = right.clone().cross(forward).normalize()
      const target = P.clone()
        .addScaledVector(right, portrait ? 0 : R * 0.5)
        .addScaledVector(up, portrait ? -R * 0.4 : 0)

      // Focus: swing further around the planet and move in close.
      const fdir = radial.clone().applyAxisAngle(UP, STATION_SWING + 0.5).setY(planet.project.world.ring ? 0.3 : 0.1).normalize()
      const fpos = P.clone().addScaledVector(fdir, R * reach * (portrait ? 5.4 : 4.3))
      const fforward = P.clone().sub(fpos).normalize()
      const fright = fforward.clone().cross(UP).normalize()
      const fup = fright.clone().cross(fforward).normalize()
      const ftarget = portrait
        ? P.clone().addScaledVector(fup, -R * 1.05)
        : P.clone().addScaledVector(fright, R * 1.0)

      stations.push({ position, target, planet, focus: { position: fpos, target: ftarget } })

      // Word sits behind the planet, centred on the composition.
      const textPos = target.clone().addScaledVector(forward, R * reach * 7).addScaledVector(up, R * (portrait ? 2 : 0.6))
      this.texts[i].place(textPos, position)
      this.texts[i].mesh.scale.setScalar(portrait ? 0.62 : 1)
    }

    // Signal: the whole system from the far side, galaxy right, contact left.
    stations.push(
      portrait
        ? { position: new THREE.Vector3(46, 88, -30).multiplyScalar(far), target: new THREE.Vector3(-4, 0, 6) }
        : { position: new THREE.Vector3(80, 118, -8), target: new THREE.Vector3(6, -4, 34) },
    )

    this.stations = stations
    return stations
  }

  setActive(index, reducedMotion) {
    const next = this.texts[index - 1] ?? null
    if (next === this.activeText) return
    this.activeText?.hide(reducedMotion)
    next?.show(reducedMotion)
    this.activeText = next
  }

  /** Monumental type steps back while a dossier is open. */
  setFocused(focused) {
    for (const text of this.texts) {
      gsap.to(text.uniforms.uOpacity, { value: focused ? 0 : 0.075, duration: focused ? 0.6 : 1.4, ease: 'power2.inOut', overwrite: true })
    }
  }

  setReducedMotion(reduced) {
    for (const planet of this.planets) planet.motionScale = reduced ? 0.2 : 1
  }

  resize(heightPx) {
    this.galaxy.resize(heightPx)
  }

  update(dt, camera) {
    for (const planet of this.planets) planet.update(dt)
    this.stars.update(camera)
  }

  dispose() {
    for (const planet of this.planets) planet.dispose()
    for (const text of this.texts) text.dispose()
    this.galaxy?.dispose()
    this.stars?.dispose()
    this.core?.dispose()
    this.sphere?.dispose()
    this.planets = []
    this.texts = []
  }
}

export { shared }

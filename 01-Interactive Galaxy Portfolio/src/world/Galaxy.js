import * as THREE from 'three'
import { dustVertex, dustFragment, starsVertex, starsFragment, coreVertex, coreFragment } from '../shaders/particles.js'
import { shared, galaxy, armAngle } from './shared.js'
import { mulberry32, gaussian, clamp } from '../utils/math.js'
import { disposeObject } from '../utils/dispose.js'

const CORE_COLOR = new THREE.Color('#ffd2a1')
const MID_COLOR = new THREE.Color('#c4c8e0')
const RIM_COLOR = new THREE.Color('#5b67b8')
const HII_COLOR = new THREE.Color('#e0708f')

function dustMaterial({ soft, maxSize, nearFade }) {
  return new THREE.ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    uniforms: {
      uTime: shared.uTime,
      uPointScale: shared.uPointScale,
      uMaxSize: { value: maxSize },
      uNearFade: { value: nearFade },
      uSoft: { value: soft },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
}

/**
 * The spiral disc: fine dust grains plus a few large, very soft haze sprites
 * that give the arms volume. Grains close to a planet pick up its accent
 * colour, tying each world into its neighbourhood.
 */
export class Galaxy {
  constructor({ quality, planets }) {
    this.group = new THREE.Group()
    this.group.name = 'galaxy'
    this.planets = planets

    const high = quality === 'high'
    this.dust = this.createDust(high ? 22000 : 9000, 0)
    this.haze = this.createHaze(high ? 90 : 44)
    this.group.add(this.dust, this.haze)
  }

  tintNearPlanets(pos, color, strength = 0.85) {
    for (const planet of this.planets) {
      const reach = planet.radius * 4.5
      const d = pos.distanceTo(planet.position)
      if (d < reach) {
        const t = Math.pow(1 - d / reach, 2) * strength
        color.lerp(planet.accentColor, t)
      }
    }
  }

  /** Keep grains out of the planets themselves and their immediate halo. */
  clearPlanets(pos) {
    for (const planet of this.planets) {
      const min = planet.radius * 1.7
      const d = pos.distanceTo(planet.position)
      if (d < min) {
        const dir = pos.clone().sub(planet.position).normalize()
        if (!Number.isFinite(dir.x)) dir.set(0, 1, 0)
        pos.copy(planet.position).addScaledVector(dir, min + Math.random() * planet.radius)
      }
    }
  }

  createDust(count, seedOffset) {
    const rand = mulberry32(galaxy.seed + seedOffset)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const rands = new Float32Array(count * 4)
    const pos = new THREE.Vector3()
    const color = new THREE.Color()
    const R = galaxy.radius

    for (let i = 0; i < count; i++) {
      const fill = rand() < 0.16
      const r = 0.6 + Math.pow(rand(), fill ? 0.7 : 1.35) * R
      const t = r / R
      let theta
      if (fill) {
        theta = rand() * Math.PI * 2
      } else {
        const arm = Math.floor(rand() * galaxy.arms)
        theta = armAngle(r, arm) + gaussian(rand) * (0.14 + 0.25 * (1 - t))
      }
      const spread = 0.6 + r * 0.07
      pos.set(
        Math.cos(theta) * r + gaussian(rand) * spread,
        gaussian(rand) * (0.35 + Math.pow(1 - t, 3) * 4.5),
        Math.sin(theta) * r + gaussian(rand) * spread,
      )
      this.clearPlanets(pos)
      pos.toArray(positions, i * 3)

      if (t < 0.35) color.copy(CORE_COLOR).lerp(MID_COLOR, t / 0.35)
      else color.copy(MID_COLOR).lerp(RIM_COLOR, clamp((t - 0.35) / 0.65, 0, 1))
      if (!fill && rand() < 0.035) color.lerp(HII_COLOR, 0.75)
      this.tintNearPlanets(pos, color)

      const brightness = (fill ? 0.5 : 1.35) * (0.35 + rand() * 0.65) * (1.15 - t * 0.7)
      color.multiplyScalar(brightness)
      color.toArray(colors, i * 3)

      sizes[i] = 0.035 + Math.pow(rand(), 5) * 0.16
      rands[i * 4 + 0] = rand()
      rands[i * 4 + 1] = 0.04 + rand() * 0.35
      rands[i * 4 + 2] = 0.04 + rand() * 0.16
      rands[i * 4 + 3] = 0.5 + rand() * 2.0
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rands, 4))
    geometry.computeBoundingSphere()

    const points = new THREE.Points(geometry, dustMaterial({ soft: 0, maxSize: 9, nearFade: 5 }))
    points.frustumCulled = false
    return points
  }

  createHaze(count) {
    const rand = mulberry32(galaxy.seed + 91)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const rands = new Float32Array(count * 4)
    const pos = new THREE.Vector3()
    const color = new THREE.Color()
    const R = galaxy.radius

    for (let i = 0; i < count; i++) {
      const r = 3 + Math.pow(rand(), 1.1) * R * 0.95
      const t = r / R
      const arm = Math.floor(rand() * galaxy.arms)
      const theta = armAngle(r, arm) + gaussian(rand) * 0.12
      pos.set(Math.cos(theta) * r, gaussian(rand) * 0.8, Math.sin(theta) * r)
      pos.toArray(positions, i * 3)

      if (t < 0.3) color.copy(CORE_COLOR)
      else color.copy(MID_COLOR).lerp(RIM_COLOR, t)
      if (rand() < 0.2) color.lerp(HII_COLOR, 0.5)
      this.tintNearPlanets(pos, color, 0.5)
      color.multiplyScalar((0.035 + rand() * 0.035) * (t < 0.25 ? 1.6 : 1))
      color.toArray(colors, i * 3)

      sizes[i] = 5 + rand() * 9 + (1 - t) * 6
      rands[i * 4 + 0] = rand()
      rands[i * 4 + 1] = 0.3 + rand() * 0.8
      rands[i * 4 + 2] = 0.02 + rand() * 0.04
      rands[i * 4 + 3] = 0.2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rands, 4))
    geometry.computeBoundingSphere()

    this.hazeMaterial = dustMaterial({ soft: 1, maxSize: 420, nearFade: 14 })
    const points = new THREE.Points(geometry, this.hazeMaterial)
    points.frustumCulled = false
    return points
  }

  /** Haze sprites are capped relative to the viewport so they never flood the screen. */
  resize(heightPx) {
    this.hazeMaterial.uniforms.uMaxSize.value = heightPx * 0.45
  }

  dispose() {
    disposeObject(this.group)
  }
}

/** Distant stars on a far shell, sized in screen pixels. */
export class Starfield {
  constructor({ quality }) {
    const count = quality === 'high' ? 3800 : 1700
    const rand = mulberry32(7)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const stars = new Float32Array(count * 2)
    const temps = ['#9fb8ff', '#cad7ff', '#fff4ea', '#ffe2b8', '#ffc58f']
      .map((c) => new THREE.Color(c))
    const v = new THREE.Vector3()
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      v.set(gaussian(rand), gaussian(rand), gaussian(rand)).normalize()
      v.multiplyScalar(380 + rand() * 160)
      v.toArray(positions, i * 3)

      color.copy(temps[Math.floor(Math.pow(rand(), 0.8) * temps.length)])
      const bright = rand() < 0.02
      color.multiplyScalar(bright ? 1.4 : 0.25 + rand() * 0.55)
      color.toArray(colors, i * 3)

      stars[i * 2] = bright ? 2.6 + rand() : 0.8 + Math.pow(rand(), 2.5) * 1.6
      stars[i * 2 + 1] = rand()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aStar', new THREE.BufferAttribute(stars, 2))

    this.points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: starsVertex,
        fragmentShader: starsFragment,
        uniforms: { uTime: shared.uTime, uDpr: shared.uDpr },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.points.frustumCulled = false
    this.points.name = 'stars'
  }

  /** Stars live "at infinity": they follow the camera so they never parallax. */
  update(camera) {
    this.points.position.copy(camera.position)
  }

  dispose() {
    disposeObject(this.points)
  }
}

/** The galactic core — also the light source for every planet. */
export class Core {
  constructor() {
    this.uniforms = {
      uTime: shared.uTime,
      uSize: { value: 46 },
      uIntensity: { value: 1 },
      uColor: { value: new THREE.Color('#ffb784') },
    }
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        uniforms: this.uniforms,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.name = 'core'
  }

  dispose() {
    disposeObject(this.mesh)
  }
}

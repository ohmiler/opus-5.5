import * as THREE from 'three'
import { planetVertex, planetFragment, atmosphereVertex, atmosphereFragment, ringVertex, ringFragment } from '../shaders/planet.js'
import { haloVertex, haloFragment } from '../shaders/particles.js'
import { shared, armAngle } from './shared.js'
import { damp, mulberry32, gaussian } from '../utils/math.js'
import { disposeObject } from '../utils/dispose.js'

const TYPE_DEFINES = {
  gas: 'TYPE_GAS',
  magma: 'TYPE_MAGMA',
  ocean: 'TYPE_OCEAN',
  pearl: 'TYPE_PEARL',
  ice: 'TYPE_ICE',
}

// Atmosphere thickness / brightness per world type.
const ATMOSPHERE = {
  gas: { scale: 1.16, strength: 1.1 },
  magma: { scale: 1.08, strength: 0.7 },
  ocean: { scale: 1.2, strength: 1.35 },
  pearl: { scale: 1.14, strength: 1.0 },
  ice: { scale: 1.17, strength: 1.15 },
}

const linear = (hex) => new THREE.Color(hex)
const _oc = new THREE.Vector3()

/**
 * A single portfolio world: surface, atmosphere shell, optional ring and a
 * field of infalling "gravitational" particles.
 */
export class Planet {
  constructor(project, index, { sphere, quality }) {
    this.project = project
    this.index = index
    this.radius = project.world.radius

    const w = project.world
    const angle = armAngle(w.orbit)
    this.position = new THREE.Vector3(Math.cos(angle) * w.orbit, w.lift, Math.sin(angle) * w.orbit)

    this.hover = 0
    this.hoverTarget = 0
    this.orbitTime = 0
    this.motionScale = 1

    // One uniform object shared by surface, atmosphere, ring and halo.
    this.uHover = { value: 0 }
    const lightPos = { value: new THREE.Vector3(0, 0, 0) }
    const accent = linear(w.accent)
    this.accentColor = accent

    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.group.name = `planet:${project.id}`

    // Tilted frame: everything orbits in the planet's equatorial plane.
    this.frame = new THREE.Group()
    this.frame.rotation.set(0.15 * (index % 2 ? 1 : -1), 0, w.tilt)
    this.group.add(this.frame)

    this.surfaceMaterial = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      defines: { [TYPE_DEFINES[w.type]]: '' },
      uniforms: {
        uTime: shared.uTime,
        uSeed: { value: index * 7.31 + 2.0 },
        uHover: this.uHover,
        uLightPos: lightPos,
        uColorA: { value: linear(w.palette[0]) },
        uColorB: { value: linear(w.palette[1]) },
        uColorC: { value: linear(w.palette[2]) },
        uAccent: { value: accent },
      },
    })
    this.surface = new THREE.Mesh(sphere, this.surfaceMaterial)
    this.surface.scale.setScalar(this.radius)
    this.frame.add(this.surface)

    const atmo = ATMOSPHERE[w.type]
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      uniforms: {
        uColor: { value: accent },
        uCenter: { value: this.position },
        uLightPos: lightPos,
        uHover: this.uHover,
        uStrength: { value: atmo.strength },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    this.atmosphere = new THREE.Mesh(sphere, this.atmosphereMaterial)
    this.atmosphere.scale.setScalar(this.radius * atmo.scale)
    this.group.add(this.atmosphere)

    if (w.ring) this.createRing(accent, lightPos, w.palette[2])
    this.createHalo(accent, quality, w.ring ? 0.5 : 1)
  }

  createRing(accent, lightPos, color) {
    const inner = this.radius * 1.45
    const outer = this.radius * 2.45
    const geometry = new THREE.RingGeometry(inner, outer, 160, 1)
    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: {
        uColor: { value: linear(color) },
        uAccent: { value: accent },
        uCenter: { value: this.position },
        uLightPos: lightPos,
        uPlanetRadius: { value: this.radius },
        uInner: { value: inner },
        uOuter: { value: outer },
        uHover: this.uHover,
      },
      side: THREE.DoubleSide,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    })
    this.ring = new THREE.Mesh(geometry, this.ringMaterial)
    this.ring.rotation.x = -Math.PI / 2
    this.frame.add(this.ring)
  }

  createHalo(accent, quality, density) {
    const count = Math.round((quality === 'high' ? 720 : 280) * density)
    const rand = mulberry32(4001 + this.index * 97)
    const orbit = new Float32Array(count * 4)
    const shape = new Float32Array(count * 4)
    const node = new Float32Array(count)
    const scale = this.radius / 2

    for (let i = 0; i < count; i++) {
      const wide = rand() < 0.15
      const outer = 1.45 + Math.pow(rand(), 1.4) * (wide ? 2.4 : 1.7)
      orbit[i * 4 + 0] = outer
      orbit[i * 4 + 1] = rand() * Math.PI * 2
      orbit[i * 4 + 2] = (0.07 + rand() * 0.14) * (2.2 / outer)
      orbit[i * 4 + 3] = 2.0 + rand() * 3.5

      shape[i * 4 + 0] = 1 / (16 + rand() * 22)
      shape[i * 4 + 1] = rand()
      shape[i * 4 + 2] = (0.018 + Math.pow(rand(), 3) * 0.05) * scale
      shape[i * 4 + 3] = gaussian(rand) * (wide ? 0.9 : 0.22)
      node[i] = rand() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    // Particles are generated in the shader; position only feeds bounding volumes.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4))
    geometry.setAttribute('aShape', new THREE.BufferAttribute(shape, 4))
    geometry.setAttribute('aNode', new THREE.BufferAttribute(node, 1))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), this.radius * 5)

    this.haloUniforms = {
      uTime: shared.uTime,
      uOrbitTime: { value: 0 },
      uRadius: { value: this.radius },
      uHover: this.uHover,
      uPointScale: shared.uPointScale,
      uColor: { value: accent },
    }
    this.halo = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: haloVertex,
        fragmentShader: haloFragment,
        uniforms: this.haloUniforms,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.frame.add(this.halo)
  }

  /**
   * Ray / sphere test against a slightly generous hit radius.
   * Returns the distance along the ray, or null.
   */
  intersect(ray, padding = 1.2) {
    _oc.subVectors(ray.origin, this.position)
    // Distant planets keep a minimum angular hit size so they stay clickable.
    const r = Math.max(this.radius * padding, _oc.length() * 0.022)
    const b = _oc.dot(ray.direction)
    const c = _oc.lengthSq() - r * r
    const h = b * b - c
    if (h < 0) return null
    const t = -b - Math.sqrt(h)
    return t > 0 ? t : null
  }

  update(dt) {
    this.hover = damp(this.hover, this.hoverTarget, this.hoverTarget > this.hover ? 7 : 3.5, dt)
    this.uHover.value = this.hover
    this.orbitTime += dt * (1 + this.hover * 1.8) * this.motionScale
    this.haloUniforms.uOrbitTime.value = this.orbitTime
    this.surface.rotation.y += dt * this.project.world.spin * this.motionScale
  }

  dispose() {
    // The sphere geometry is shared and owned by World; detach before disposing.
    this.surface.geometry = new THREE.BufferGeometry()
    this.atmosphere.geometry = new THREE.BufferGeometry()
    disposeObject(this.group)
  }
}

import * as THREE from 'three'
import gsap from 'gsap'
import { clamp, damp } from '../utils/math.js'

const _pos = new THREE.Vector3()
const _target = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _vel = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * The camera never jumps: its pose is a pure function of a few scalar
 * "intent" values (progress along the galaxy path, scroll lean, focus blend,
 * intro dolly) that are tweened by GSAP or damped every frame. Pointer
 * parallax and banking are layered on top.
 */
export class CameraRig {
  constructor({ viewport, fader }) {
    this.viewport = viewport
    this.fader = fader
    this.camera = new THREE.PerspectiveCamera(40, viewport.aspect, 0.1, 1400)

    this.progress = 0
    this.lean = 0
    this.leanTarget = 0
    this.focus = 0
    this.focusStation = null
    this.intro = 1

    this.pointer = new THREE.Vector2()
    this.roll = 0
    this.travel = 0
    this.lastProgress = 0
    this.lastPos = new THREE.Vector3()
    this.hasLast = false

    this.resize()
  }

  get sections() {
    return this.stations.length
  }

  setStations(stations) {
    this.stations = stations
    this.posCurve = new THREE.CatmullRomCurve3(stations.map((s) => s.position), false, 'centripetal')
    this.targetCurve = new THREE.CatmullRomCurve3(stations.map((s) => s.target), false, 'centripetal')

    // Arrival from deep space, far behind the opening composition.
    const s0 = stations[0]
    const back = s0.position.clone().sub(s0.target).normalize()
    this.introFrom = {
      position: s0.position.clone().addScaledVector(back, 190).add(new THREE.Vector3(60, 40, 0)),
      target: s0.target.clone().add(new THREE.Vector3(0, 30, 0)),
    }

    if (this.focusStation) {
      this.focusStation = stations.find((s) => s.planet === this.focusStation.planet) ?? null
    }
  }

  sample(p, outPos, outTarget) {
    const t = clamp(p / (this.stations.length - 1), 0, 1)
    this.posCurve.getPoint(t, outPos)
    this.targetCurve.getPoint(t, outTarget)
  }

  travelDuration(from, to) {
    const d = Math.abs(to - from)
    return Math.min(2.5 + (d - 1) * 0.5, 4.2)
  }

  /** Fly along the galaxy path to a section. Resolves on arrival. */
  goTo(index, { reducedMotion } = {}) {
    index = clamp(index, 0, this.stations.length - 1)
    return new Promise((resolve) => {
      if (reducedMotion) {
        this.cut(() => (this.progress = index), resolve)
        return
      }
      gsap.to(this, {
        progress: index,
        duration: this.travelDuration(this.progress, index),
        ease: 'power3.inOut',
        overwrite: 'auto',
        onComplete: resolve,
      })
    })
  }

  /** If the visitor starts exploring mid-intro, land the arrival quickly. */
  hurryIntro() {
    if (this.intro <= 0.001) return
    gsap.to(this, { intro: 0, duration: 1.4, ease: 'power2.out', overwrite: 'auto' })
  }

  focusOn(station, { reducedMotion } = {}) {
    this.focusStation = station
    if (reducedMotion) return this.cut(() => (this.focus = 1))
    gsap.to(this, { focus: 1, duration: 2.1, ease: 'expo.inOut', overwrite: 'auto' })
  }

  unfocus({ reducedMotion } = {}) {
    if (!this.focusStation) return
    const done = () => (this.focusStation = null)
    if (reducedMotion) return this.cut(() => ((this.focus = 0), done()))
    gsap.to(this, { focus: 0, duration: 1.5, ease: 'power3.inOut', overwrite: 'auto', onComplete: done })
  }

  /** Reduced-motion transition: a short fade through black instead of flight. */
  cut(apply, onComplete) {
    gsap.killTweensOf(this)
    gsap
      .timeline({ onComplete })
      .to(this.fader, { value: 1, duration: 0.22, ease: 'power1.in' })
      .add(apply)
      .to(this.fader, { value: 0, duration: 0.35, ease: 'power1.out' })
  }

  playIntro({ reducedMotion } = {}) {
    if (reducedMotion) {
      this.intro = 0
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      gsap.to(this, { intro: 0, duration: 4.6, ease: 'power3.inOut', onComplete: resolve })
    })
  }

  update(dt, pointer, reducedMotion) {
    if (!this.stations) return
    const last = this.stations.length - 1
    this.lean = damp(this.lean, this.leanTarget, 6, dt)
    const p = clamp(this.progress + this.lean, 0, last)
    this.sample(p, _pos, _target)

    // Blend toward the close-up composition, arcing over the planet mid-flight.
    if (this.focusStation && this.focus > 0) {
      const f = this.focus
      _pos.lerp(this.focusStation.focus.position, f)
      _target.lerp(this.focusStation.focus.target, f)
      _pos.y += Math.sin(f * Math.PI) * this.focusStation.planet.radius * 0.9
    }

    if (this.intro > 0) {
      const k = this.intro
      _pos.lerp(this.introFrom.position, k)
      _target.lerp(this.introFrom.target, k)
    }

    // Pointer parallax, scaled to how far we are from what we look at.
    const px = reducedMotion ? 0 : pointer.x
    const py = reducedMotion ? 0 : pointer.y
    this.pointer.x = damp(this.pointer.x, px, 2.4, dt)
    this.pointer.y = damp(this.pointer.y, py, 2.4, dt)

    _fwd.subVectors(_target, _pos)
    const dist = _fwd.length()
    _fwd.divideScalar(dist)
    _right.crossVectors(_fwd, UP).normalize()
    _up.crossVectors(_right, _fwd)

    const amount = dist * (1 - this.focus * 0.55)
    _pos.addScaledVector(_right, this.pointer.x * amount * 0.03)
    _pos.addScaledVector(_up, this.pointer.y * amount * 0.02)
    _target.addScaledVector(_right, this.pointer.x * amount * 0.008)

    this.camera.position.copy(_pos)
    this.camera.lookAt(_target)

    // Bank gently into lateral motion, like a camera on a crane.
    if (this.hasLast && dt > 0) {
      _vel.subVectors(_pos, this.lastPos).divideScalar(dt)
      const lateral = _vel.dot(_right) / Math.max(dist, 1)
      this.roll = damp(this.roll, clamp(-lateral * 0.25, -0.1, 0.1), 2.5, dt)
      this.camera.rotateZ(reducedMotion ? 0 : this.roll)

      const speed = Math.abs(p - this.lastProgress) / dt + Math.abs(this.intro > 0 ? _vel.length() / 120 : 0)
      this.travel = damp(this.travel, reducedMotion ? 0 : clamp(speed * 0.7, 0, 1), 4, dt)
    }
    this.lastPos.copy(_pos)
    this.lastProgress = p
    this.hasLast = true
  }

  resize() {
    const { aspect, portrait } = this.viewport
    this.camera.aspect = aspect
    this.camera.fov = portrait ? 54 : 38
    this.camera.updateProjectionMatrix()
  }

  /** World units → pixels at distance 1, for size-attenuated points. */
  pointScale(bufferHeight) {
    return bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2))
  }

  dispose() {
    gsap.killTweensOf(this)
    gsap.killTweensOf(this.fader)
  }
}

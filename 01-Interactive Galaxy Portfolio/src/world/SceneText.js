import * as THREE from 'three'
import gsap from 'gsap'
import { textVertex, textFragment } from '../shaders/screen.js'
import { disposeObject } from '../utils/dispose.js'

/**
 * Monumental word set in world space behind a planet. Because it is real
 * geometry it parallaxes with the camera and is occluded by the planet,
 * so type and world read as one composition.
 */
export class SceneText {
  constructor({ text, accent, width = 20 }) {
    this.width = width
    const { canvas, aspect } = SceneText.draw(text)
    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
    this.texture.generateMipmaps = true

    this.uniforms = {
      uMap: { value: this.texture },
      uReveal: { value: 0 },
      uOpacity: { value: 0.075 },
      uColor: { value: new THREE.Color('#ece6db') },
      uAccent: { value: new THREE.Color(accent) },
    }

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / aspect),
      new THREE.ShaderMaterial({
        vertexShader: textVertex,
        fragmentShader: textFragment,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.renderOrder = -1
    this.mesh.visible = false
  }

  static draw(text) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const fontSize = 300
    const font = `italic 400 ${fontSize}px "Instrument Serif", "Times New Roman", serif`
    ctx.font = font
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-6px'
    const metrics = ctx.measureText(text)
    const padX = 60
    canvas.width = Math.ceil(metrics.width + padX * 2)
    canvas.height = Math.ceil(fontSize * 1.25)
    // Resizing resets context state.
    ctx.font = font
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-6px'
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, padX, canvas.height * 0.54)
    return { canvas, aspect: canvas.width / canvas.height }
  }

  /** Place at `position`, facing `viewer`. */
  place(position, viewer) {
    this.mesh.position.copy(position)
    this.mesh.lookAt(viewer)
  }

  show(reducedMotion) {
    this.mesh.visible = true
    gsap.to(this.uniforms.uReveal, {
      value: 1,
      duration: reducedMotion ? 0.01 : 2.4,
      delay: reducedMotion ? 0 : 0.5,
      ease: 'power2.inOut',
      overwrite: true,
    })
  }

  hide(reducedMotion) {
    gsap.to(this.uniforms.uReveal, {
      value: 0,
      duration: reducedMotion ? 0.01 : 0.9,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => (this.mesh.visible = false),
    })
  }

  dispose() {
    gsap.killTweensOf(this.uniforms.uReveal)
    disposeObject(this.mesh)
  }
}

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { lensShader } from '../shaders/screen.js'

/**
 * WebGL renderer + post chain: scene → bloom → tone map → lens.
 * Bloom threshold is high enough that only HDR highlights (core, magma,
 * ocean glints, halo embers) glow; the rest of the frame stays crisp.
 */
export class Renderer {
  static supported() {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      return false
    }
  }

  constructor({ canvas, viewport, scene, camera }) {
    this.viewport = viewport
    this.scene = scene
    this.camera = camera

    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    this.gl.toneMapping = THREE.ACESFilmicToneMapping
    this.gl.toneMappingExposure = 1.05
    this.gl.outputColorSpace = THREE.SRGBColorSpace
    this.gl.setPixelRatio(viewport.dpr)
    this.gl.setSize(viewport.width, viewport.height, false)

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: viewport.tier === 'high' ? 4 : 0,
    })
    this.composer = new EffectComposer(this.gl, target)
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.82)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.lens = new ShaderPass(lensShader)
    this.composer.addPass(this.lens)

    this.contextLost = false
    this.onContextLost = (e) => {
      e.preventDefault()
      this.contextLost = true
      document.documentElement.classList.add('context-lost')
    }
    this.onContextRestored = () => {
      this.contextLost = false
      document.documentElement.classList.remove('context-lost')
    }
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)

    this.resize()
  }

  get uniforms() {
    return this.lens.uniforms
  }

  /** Drawing-buffer height in physical pixels. */
  get bufferHeight() {
    return this.viewport.height * this.viewport.dpr
  }

  setBloomEnabled(enabled) {
    this.bloom.enabled = enabled
  }

  resize() {
    const { width, height, dpr } = this.viewport
    this.gl.setPixelRatio(dpr)
    this.gl.setSize(width, height, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(width, height)
    this.lens.uniforms.uAspect.value = width / height
  }

  async compile() {
    if (this.gl.compileAsync) await this.gl.compileAsync(this.scene, this.camera)
    else this.gl.compile(this.scene, this.camera)
  }

  render() {
    if (this.contextLost) return
    this.composer.render()
  }

  dispose() {
    const canvas = this.gl.domElement
    canvas.removeEventListener('webglcontextlost', this.onContextLost)
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    for (const pass of this.composer.passes) pass.dispose?.()
    this.composer.renderTarget1.dispose()
    this.composer.renderTarget2.dispose()
    this.gl.dispose()
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0005 },
    uVignette: { value: 1 },
    uGrain: { value: 0.012 },
    uGlitch: { value: 0 },
    uFade: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberration, uVignette, uGrain, uGlitch, uFade;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // transition glitch: displaced horizontal bands
      if (uGlitch > 0.001) {
        float band = floor(uv.y * 28.0);
        float n = h(vec2(band, floor(uTime * 24.0)));
        uv.x += (n - 0.5) * 0.045 * uGlitch * step(0.8, n);
      }

      float ab = uAberration * (1.0 + r2 * 6.0) + uGlitch * 0.006;
      vec2 dir = normalize(c + 1e-5) * ab;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      col *= mix(1.0, smoothstep(0.95, 0.15, r2 * 1.9), uVignette * 0.85);
      col += (h(uv * uResolution + fract(uTime) * 91.0) - 0.5) * uGrain;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

// WebGL renderer + post chain (render → bloom → grade/grain/aberration → tone map + sRGB).
export class Renderer {
  constructor(canvas, quality) {
    this.quality = quality;
    this.dprScale = 1;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x05060d, 1);

    this.composer = new EffectComposer(this.renderer);
    this.size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.frameTimes = [];
  }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(this.size.clone(), this.quality.mobile ? 0.7 : 0.8, 0.5, 0.7);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  get dpr() {
    return Math.min(window.devicePixelRatio || 1, this.quality.maxDpr) * this.dprScale;
  }

  resize(w = window.innerWidth, h = window.innerHeight) {
    this.size.set(w, h);
    const dpr = this.dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    // bloom runs at reduced resolution on low tier
    if (this.quality.mobile) this.bloom?.setSize(Math.round(w * dpr * 0.5), Math.round(h * dpr * 0.5));
    this.final?.uniforms.uResolution.value.set(w * dpr, h * dpr);
  }

  get drawingHeight() {
    return this.size.y * this.dpr;
  }

  // Adaptive resolution: trade pixels for frame rate, with hysteresis. Returns true if the size changed.
  adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return false;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const prev = this.dprScale;
    if (avg > 1 / 45 && this.dprScale > 0.6) this.dprScale = Math.max(0.6, this.dprScale - 0.12);
    else if (avg < 1 / 58 && this.dprScale < 1) this.dprScale = Math.min(1, this.dprScale + 0.05);
    if (prev !== this.dprScale) {
      this.resize();
      return true;
    }
    return false;
  }

  set glitch(v) {
    this.final.uniforms.uGlitch.value = v;
  }

  set fade(v) {
    this.final.uniforms.uFade.value = v;
  }

  render(t) {
    this.final.uniforms.uTime.value = t;
    this.composer.render();
  }

  async compile() {
    if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
    else this.renderer.compile(this.scene, this.camera);
  }

  dispose() {
    this.composer.passes.forEach((p) => p.dispose?.());
    this.composer.dispose();
    this.renderer.dispose();
  }
}

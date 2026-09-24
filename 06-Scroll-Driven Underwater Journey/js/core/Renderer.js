import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class Renderer {
  constructor(canvas, { maxDpr, bloom }) {
    this.maxDpr = maxDpr;
    this.useBloom = bloom;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !bloom, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(this.dpr);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
  }

  get dpr() { return Math.min(window.devicePixelRatio || 1, this.maxDpr); }

  setupPost(scene, camera) {
    if (!this.useBloom) return;
    const { innerWidth: w, innerHeight: h } = window;
    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.4, 0.65, 0.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize(w, h) {
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(Math.min(this.dpr, 1.5));
      this.composer.setSize(w, h);
    }
  }

  render(scene, camera) {
    if (this.composer) this.composer.render();
    else this.gl.render(scene, camera);
  }

  dispose() {
    this.composer?.dispose();
    this.bloom?.dispose();
    this.gl.dispose();
  }
}

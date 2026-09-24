import * as THREE from 'three';

export class Renderer {
  constructor(canvas, { maxDpr = 2, antialias = true } = {}) {
    this.maxDpr = maxDpr;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: 'high-performance' });
    this.gl.setClearColor(0x0b0a09, 1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.resize(window.innerWidth, window.innerHeight);
  }

  get pixelRatio() { return Math.min(window.devicePixelRatio || 1, this.maxDpr); }

  resize(w, h) {
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(w, h, false);
  }

  /** Compile all programs up front so the first visible frame doesn't hitch. */
  compile(scene, camera) { this.gl.compile(scene, camera); }

  render(scene, camera) { this.gl.render(scene, camera); }

  dispose() {
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}

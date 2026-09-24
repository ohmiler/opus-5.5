import * as THREE from 'three';

/** WebGL renderer wrapper: capped DPR, resize handling and adaptive resolution. */
export class Renderer {
  constructor(canvas, { maxDPR = 2 } = {}) {
    this.maxDPR = maxDPR;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    // Glass/plastic transmission pass at half resolution: big GPU saving, same look.
    this.gl.transmissionResolutionScale = 0.5;
    this.slowTime = 0;
    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(this.width, this.height, false);
  }

  /** Lower the pixel ratio if frames are consistently slow. */
  adapt(dt) {
    if (dt > 1 / 40) this.slowTime += dt;
    else this.slowTime = Math.max(0, this.slowTime - dt * 0.5);
    if (this.slowTime > 2 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.slowTime = 0;
      this.resize();
    }
  }

  render(scene, camera) {
    this.gl.render(scene, camera);
  }

  dispose() {
    this.gl.dispose();
  }
}

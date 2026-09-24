import * as THREE from 'three';

export class Renderer {
  constructor(canvas, { mobile }) {
    this.maxDpr = mobile ? 1.5 : 2;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.exposure = 1.05;
  }

  resize(w, h) {
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    this.gl.setSize(w, h, false);
  }

  render(scene, camera) {
    this.gl.toneMappingExposure = this.exposure;
    this.gl.render(scene, camera);
  }

  dispose() {
    this.gl.dispose();
  }
}

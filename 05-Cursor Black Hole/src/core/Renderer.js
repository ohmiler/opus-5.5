import * as THREE from 'three';

export class Renderer {
  constructor(canvas, { maxDpr = 2 } = {}) {
    this.maxDpr = maxDpr;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;

    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.gl.setClearColor(0x050507, 1);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(width, height, false);
  }

  /** Step the pixel ratio down when frames run long. Returns false once there's nothing left to give. */
  degrade() {
    const before = this.pixelRatio;
    this.maxDpr = Math.max(1, this.maxDpr - 0.5);
    this.resize(this.width, this.height);
    return this.pixelRatio < before;
  }

  render(scene, camera) {
    this.gl.render(scene, camera);
  }

  dispose() {
    this.gl.dispose();
  }
}

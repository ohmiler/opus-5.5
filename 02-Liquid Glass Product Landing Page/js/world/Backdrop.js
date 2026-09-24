import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Editorial type lives *inside* the scene, behind the glass, so the blob
// refracts and disperses it. Words cross-fade continuously with scroll.
const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uText;
uniform float uProgress;
uniform float uAspect;
uniform float uCount;
uniform float uReveal;
uniform float uTime;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uGlowA;
uniform vec3 uGlowB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float word(float idx, vec2 uv) {
  if (idx < 0.0 || idx > uCount - 1.0) return 0.0;
  vec2 p = uv - 0.5;
  p.x *= uAspect;
  float boxW = min(uAspect * 0.86, 2.3);
  vec2 q = p / vec2(boxW, boxW * 0.25) + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  float v = 1.0 - (idx + (1.0 - q.y)) / uCount;
  return texture2D(uText, vec2(q.x, v)).a;
}

void main() {
  float i0 = floor(uProgress);
  float e = smoothstep(0.12, 0.88, uProgress - i0);
  float shift = 0.14;
  float a = word(i0, vUv - vec2(0.0, e * shift)) * (1.0 - e);
  float b = word(i0 + 1.0, vUv + vec2(0.0, (1.0 - e) * shift)) * e;
  float ink = max(a, b) * uReveal;

  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float drift = uProgress * 0.18;
  vec2 ga = p - vec2(-0.55 + drift, 0.22);
  vec2 gb = p - vec2(0.6 - drift, -0.28);
  vec3 col = uBg;
  col = mix(col, uGlowA, exp(-dot(ga, ga) * 3.2) * 0.55);
  col = mix(col, uGlowB, exp(-dot(gb, gb) * 3.2) * 0.5);
  col = mix(col, uInk, ink);

  // Film grain keeps the white from feeling digital.
  col += (hash(vUv * 1024.0 + fract(uTime * 0.37)) - 0.5) * 0.014;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class Backdrop {
  constructor({ camera, words, z = -3.5 }) {
    this.camera = camera;
    this.z = z;

    this.texture = new THREE.CanvasTexture(Backdrop.drawAtlas(words));
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.anisotropy = 4;

    this.uniforms = {
      uText: { value: this.texture },
      uProgress: { value: 0 },
      uAspect: { value: 1 },
      uCount: { value: words.length },
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uBg: { value: new THREE.Color('#f3f2ee') },
      uInk: { value: new THREE.Color('#17171b') },
      uGlowA: { value: new THREE.Color('#d9d3ff') },
      uGlowB: { value: new THREE.Color('#ffdcc6') },
    };

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      depthWrite: false,
    });
    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.position.z = z;
    this.object.renderOrder = -1;
    this.object.frustumCulled = false;
  }

  /** One row per word in a single texture, so nothing is re-uploaded at runtime. */
  static drawAtlas(words) {
    const W = 2048;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H * words.length;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    words.forEach((word, i) => {
      let size = 420;
      ctx.font = `italic 400 ${size}px "Instrument Serif", Georgia, serif`;
      const w = ctx.measureText(word).width;
      if (w > W * 0.94) {
        size *= (W * 0.94) / w;
        ctx.font = `italic 400 ${size}px "Instrument Serif", Georgia, serif`;
      }
      ctx.fillText(word, W / 2, i * H + H * 0.72);
    });
    return canvas;
  }

  update(dt, t) {
    const cam = this.camera;
    const dist = cam.position.z - this.z;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist * 1.15;
    const w = h * cam.aspect;
    this.object.scale.set(w, h, 1);
    this.object.position.x = cam.position.x;
    this.object.position.y = cam.position.y;
    this.uniforms.uAspect.value = w / h;
    this.uniforms.uTime.value = t;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}

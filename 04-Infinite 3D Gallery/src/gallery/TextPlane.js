import * as THREE from 'three';
import { atmosphereGLSL } from '../core/Stage.js';

// Typography rendered into the scene: a canvas painted once, mapped onto a
// plane that obeys the same fog and near-fade as the artworks.
//
// `draw(ctx, w, h)` paints white glyphs on a transparent canvas; tint and
// opacity are shader uniforms so they can animate without repainting.

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  ${atmosphereGLSL}
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec2 uFade; // near-fade range specific to this plane
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    float a = texture2D(uMap, vUv).a * uOpacity;
    a *= smoothstep(uFade.x, uFade.y, vDepth);
    a *= 1.0 - fogFactor(vDepth);
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class TextPlane {
  constructor({ width, pxWidth = 1024, pxHeight = 256, draw, atmosphere, color = 0xffffff, opacity = 1, fade }) {
    const canvas = document.createElement('canvas');
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext('2d');
    draw(ctx, pxWidth, pxHeight);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.anisotropy = 4;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;

    const height = width * (pxHeight / pxWidth);
    this.width = width;
    this.height = height;
    this.geometry = new THREE.PlaneGeometry(width, height);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...atmosphere,
        uMap: { value: this.texture },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uFade: {
          value: new THREE.Vector2(
            fade ? fade[0] : atmosphere.uNearFadeStart.value,
            fade ? fade[1] : atmosphere.uNearFadeEnd.value
          ),
        },
      },
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  set opacity(v) {
    this.material.uniforms.uOpacity.value = v;
  }

  get opacity() {
    return this.material.uniforms.uOpacity.value;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}

export const fonts = {
  serif: '"Instrument Serif", "Times New Roman", serif',
  sans: '"Inter Tight", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

// Canvas letter-spacing with graceful fallback for older engines.
export function setTracking(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

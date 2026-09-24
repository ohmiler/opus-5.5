import * as THREE from 'three';
import { createCanvas, canvasTexture, FONT_DISPLAY, FONT_MONO, plainText } from '../utils/canvas.js';
import { ADDITIVE_FOG } from './shaders/chunks.js';
import { damp } from '../utils/math.js';

// Type that lives in the scene rather than on top of it.

// ─── Holographic name title hanging over the street entrance ───
export class HoloTitle {
  constructor({ name, role }) {
    const { canvas, ctx } = createCanvas(2048, 512);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-6px';
    // fit the name to the canvas whatever its length
    ctx.font = `900 250px ${FONT_DISPLAY}`;
    const size = Math.min(250, Math.floor((250 * 1900) / ctx.measureText(name.toUpperCase()).width));
    ctx.font = `900 ${size}px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name.toUpperCase(), 1024, 300);
    plainText(ctx, `${role.toUpperCase()}  ·  DISTRICT 07  ·  SCROLL TO WALK`, 1024, 400, {
      size: 34,
      color: '#9ff8ff',
      align: 'center',
      letterSpacing: 8,
      font: FONT_MONO,
    });
    this.texture = canvasTexture(canvas);
    this.reveal = 0;
    this.targetReveal = 0;

    this.material = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          map: { value: null },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uNear: { value: 1 },
          uColor: { value: new THREE.Color('#bff9ff') },
        },
      ]),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float uTime, uReveal, uNear;
        uniform vec3 uColor;
        varying vec2 vUv;
        #include <fog_pars_fragment>
        float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
        void main() {
          vec2 uv = vUv;
          // row jitter that settles as the title resolves
          float row = floor(uv.y * 60.0);
          uv.x += (h(row + floor(uTime * 12.0)) - 0.5) * 0.04 * (1.0 - uReveal) * step(0.6, h(row * 3.1));
          float a = texture2D(map, uv).a;
          float r = texture2D(map, uv + vec2(0.002, 0.0)).a;
          float b = texture2D(map, uv - vec2(0.002, 0.0)).a;
          float scan = 0.75 + 0.25 * sin(uv.y * 420.0 - uTime * 6.0);
          // dissolve reveal left to right with noisy edge
          float edge = uReveal * 1.3 - 0.15 + (h(row) - 0.5) * 0.1;
          float vis = smoothstep(edge, edge - 0.08, vUv.x);
          vec3 col = uColor * a + vec3(1.0, 0.1, 0.6) * max(r - a, 0.0) + vec3(0.1, 0.9, 1.0) * max(b - a, 0.0);
          gl_FragColor = vec4(col * scan * vis * 0.95 * uNear, 1.0);
          ${ADDITIVE_FOG}
        }
      `,
    });
    this.material.uniforms.map.value = this.texture;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), this.material);
    this.mesh.position.set(0, 8.2, 12);
  }

  show() {
    this.targetReveal = 1;
  }

  update(dt, t, camera, reducedMotion) {
    this.reveal = reducedMotion ? this.targetReveal : damp(this.reveal, this.targetReveal, 1.4, dt);
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uReveal.value = this.reveal;
    // fade as the viewer walks under it so it never blows out the frame
    const dz = camera.position.z - this.mesh.position.z;
    u.uNear.value = THREE.MathUtils.smoothstep(dz, 2, 14);
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

// ─── Section names stencilled onto the asphalt, pointing to each landmark ───
export class RoadText {
  constructor({ sections }) {
    this.group = new THREE.Group();
    this.items = sections.map((s) => {
      const { canvas, ctx } = createCanvas(1024, 256);
      const arrow = s.anchor.side < 0 ? '←' : s.anchor.side > 0 ? '→' : '↑';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 140px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${s.index} ${arrow}`, 512, 128);
      const tex = canvasTexture(canvas, { anisotropy: 8 });
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        color: new THREE.Color(s.color).multiplyScalar(0.28),
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(s.anchor.side * 2.8, 0.02, s.anchor.z + (s.anchor.side === 0 ? 26 : 22));
      this.group.add(mesh);
      return { tex, mat, mesh };
    });
  }

  dispose() {
    for (const { tex, mat, mesh } of this.items) {
      tex.dispose();
      mat.dispose();
      mesh.geometry.dispose();
    }
  }
}

import * as THREE from 'three';
import { atmosphereGLSL } from '../core/Stage.js';
import { TextPlane, fonts, setTracking } from './TextPlane.js';
import { clamp, damp, mod, pad } from '../utils/math.js';

const vertex = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Inertial bow: the plane flexes against the direction of travel.
    float bow = 1.0 - pow(abs(uv.x * 2.0 - 1.0), 2.0);
    p.z += bow * uBend;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  ${atmosphereGLSL}
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform vec2 uParallax;
  uniform float uRadius;
  uniform float uHover;
  uniform float uFocus;
  uniform float uDim;
  uniform float uReveal;
  varying vec2 vUv;
  varying float vDepth;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    // Rounded mask in world units so every card shares the same corner.
    vec2 p = (vUv - 0.5) * uSize;
    float d = sdRoundBox(p, uSize * 0.5, uRadius * (1.0 - uFocus));
    float aa = fwidth(d) * 1.2;
    float mask = 1.0 - smoothstep(-aa, aa, d);

    // Reveal: an upward curtain with the image settling from a deeper zoom.
    float r = uReveal * 1.01;
    float curtain = 1.0 - smoothstep(r - 0.001, r + 0.001, vUv.y);
    mask *= curtain;

    float zoom = 1.12 + (1.0 - uReveal) * 0.25 - uHover * 0.05 - uFocus * 0.1;
    vec2 uv = (vUv - 0.5) / zoom + 0.5 + uParallax * 0.035 * (1.0 - uFocus);
    vec3 col = texture2D(uMap, uv).rgb;

    // Resting works are slightly muted; attention brings them to full colour.
    float wake = max(uHover, uFocus);
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, mix(0.72, 1.0, wake));
    col *= mix(0.86, 1.0, wake);

    // Hairline edge that appears on hover.
    float edge = smoothstep(-0.012, -0.002, d) * uHover * (1.0 - uFocus);
    col = mix(col, vec3(1.0), edge * 0.55);

    col *= 1.0 - uDim * 0.82;
    col = mix(col, uFogColor, fogFactor(vDepth) * (1.0 - uFocus));

    float alpha = mask * mix(nearFade(vDepth), 1.0, uFocus);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const tmp = new THREE.Vector3();

export class Card {
  constructor({ project, index, total, room, canvas, slot, atmosphere, segments }) {
    this.project = project;
    this.index = index;
    this.room = room;
    this.slot = slot; // procedural placement (see layout.js)

    this.width = slot.size * Math.sqrt(project.aspect);
    this.height = slot.size / Math.sqrt(project.aspect);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;

    this.geometry = new THREE.PlaneGeometry(this.width, this.height, segments, 1);
    this.uniforms = {
      ...atmosphere,
      uMap: { value: this.texture },
      uSize: { value: new THREE.Vector2(this.width, this.height) },
      uParallax: { value: new THREE.Vector2() },
      uRadius: { value: 0.04 },
      uHover: { value: 0 },
      uFocus: { value: 0 },
      uDim: { value: 0 },
      uReveal: { value: 0 },
      uBend: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.userData.card = this;

    this.label = new TextPlane({
      width: 2.5,
      pxWidth: 1024,
      pxHeight: 200,
      atmosphere,
      opacity: 0,
      draw: (ctx, w, h) => {
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `500 22px ${fonts.mono}`;
        setTracking(ctx, 2);
        ctx.fillText(`${pad(index + 1)} / ${pad(total)}`, 4, 34);
        ctx.font = `400 84px ${fonts.serif}`;
        setTracking(ctx, -1);
        ctx.fillText(project.title, 0, 118);
        ctx.font = `500 20px ${fonts.mono}`;
        setTracking(ctx, 2);
        ctx.globalAlpha = 0.6;
        ctx.fillText(`${project.discipline.toUpperCase()}  —  ${project.year}`, 4, 166);
      },
    });
    // Anchored to the lower-left edge, like a museum wall label.
    this.label.mesh.position.set(-this.width / 2 + this.label.width / 2, -this.height / 2 - this.label.height / 2 - 0.08, 0.001);

    this.group = new THREE.Group();
    this.group.add(this.mesh, this.label.mesh);

    // Animated state (current / target pairs, all damped).
    this.hover = 0;
    this.hoverTarget = 0;
    this.focus = 0;
    this.focusTarget = 0;
    this.dim = 0;
    this.dimTarget = 0;
    this.reveal = 0;
    this.revealAt = Infinity;
    this.tilt = new THREE.Vector2();
    this.worldZ = slot.z;
    this.ndc = new THREE.Vector2();
    // Viewport adaptation (portrait screens pull works toward the axis).
    this.xScale = 1;
    this.sizeScale = 1;
  }

  get x() {
    return this.slot.x * this.xScale;
  }

  // Absolute (unwrapped) rest position — used by the camera to frame it.
  get framing() {
    const k = this.sizeScale;
    return { x: this.x, y: this.slot.y, z: this.worldZ, width: this.width * k, height: this.height * k };
  }

  update(dt, s) {
    // Infinite corridor: wrap each card into the window in front of the camera.
    const rel = mod(this.slot.z - s.camZ - s.behind, s.loop) - s.loop + s.behind;
    this.worldZ = s.camZ + rel;

    const reduced = s.reduced;
    this.hover = damp(this.hover, this.hoverTarget, 7, dt);
    this.focus = damp(this.focus, this.focusTarget, this.focusTarget ? 5 : 4, dt);
    this.dim = damp(this.dim, this.dimTarget, 3.2, dt);
    if (s.time >= this.revealAt) this.reveal = damp(this.reveal, 1, reduced ? 12 : 2.2, dt);

    // Screen position → cursor proximity tilt and inner parallax.
    tmp.set(this.x, this.slot.y, this.worldZ).project(s.camera);
    this.ndc.set(tmp.x, tmp.y);
    const dx = s.pointer.x - tmp.x;
    const dy = s.pointer.y - tmp.y;
    const prox = tmp.z < 1 ? Math.exp(-(dx * dx + dy * dy) * 2.2) : 0;
    const tiltK = reduced ? 0 : 1 - this.focus;
    this.tilt.x = damp(this.tilt.x, -dy * prox * 0.22 * tiltK, 5, dt);
    this.tilt.y = damp(this.tilt.y, dx * prox * 0.32 * tiltK, 5, dt);

    const rest = 1 - this.focus;
    const g = this.group;
    g.position.set(
      this.x,
      this.slot.y + (1 - this.reveal) * -0.6,
      this.worldZ + this.hover * 1.15 * rest - this.dim * 2.5
    );
    g.rotation.set(
      this.tilt.x,
      this.slot.ry * rest + this.tilt.y,
      this.slot.rz * rest,
      'YXZ'
    );
    g.scale.setScalar(this.sizeScale * (1 + this.hover * 0.035 * rest - this.dim * 0.08));

    const u = this.uniforms;
    u.uHover.value = this.hover;
    u.uFocus.value = this.focus;
    u.uDim.value = this.dim;
    u.uReveal.value = this.reveal;
    u.uParallax.value.set(clamp(tmp.x, -1.5, 1.5), clamp(tmp.y, -1.5, 1.5));
    u.uBend.value = reduced ? 0 : clamp(-s.speed * 0.01, -0.35, 0.35) * rest;

    this.label.opacity = this.reveal * (0.5 + this.hover * 0.5) * (1 - this.focus) * (1 - this.dim);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.label.dispose();
  }
}

import * as THREE from 'three';
import { LAYERS, STREET } from '../config.js';
import { createWindowMaterial } from './materials/WindowMaterial.js';
import { NeonSign } from './NeonSign.js';
import { neonText, plainText, FONT_MONO } from '../utils/canvas.js';
import { Disposer } from '../utils/Disposer.js';
import { damp } from '../utils/math.js';

const POWER = { idle: 0.5, near: 0.78, hover: 1.15, focus: 1.05 };

// A section building: tiered tower, vertical blade sign readable from down the street,
// facade sign readable when focused, neon trims, a lit entrance and an invisible pick proxy.
export class Landmark {
  constructor({ section, neonLights }) {
    this.section = section;
    this.color = new THREE.Color(section.color);
    this.group = new THREE.Group();
    this.disposer = new Disposer();
    this.signs = [];
    this.state = { near: false, hover: false, focus: false };
    this.trimLevel = 0;

    const { side, z, height: H } = section.anchor;
    this.side = side;
    this.material = this.disposer.track(
      createWindowMaterial({ glow: section.color, glowAmount: 0.6, density: 0.34, brightness: 0.62, base: '#080913' }),
    );
    this.trimMaterial = this.disposer.track(new THREE.MeshBasicMaterial({ color: this.color, toneMapped: false }));

    if (side === 0) this.#buildTerminus(z, H);
    else this.#buildSide(side, z, H);

    this.group.traverse((o) => o.isMesh && !o.userData.noReflect && o.layers.enable(LAYERS.REFLECT));
    this.light = neonLights.add(this.lightPos, section.color, 1.1);
  }

  #box(w, h, d, x, y, z, material = this.material) {
    const m = new THREE.Mesh(this.disposer.track(new THREE.BoxGeometry(w, h, d)), material);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  #trim(w, h, d, x, y, z) {
    return this.#box(w, h, d, x, y, z, this.trimMaterial);
  }

  #buildSide(side, z, H) {
    const face = side * STREET.walkHalf;
    const depth = 22;
    const width = 18;
    const cx = side * (STREET.walkHalf + depth / 2);
    const h1 = H * 0.62;
    const h2 = H * 0.26;

    this.#box(depth, h1, width, cx, h1 / 2, z);
    this.#box(depth * 0.78, h2, width * 0.8, cx + side * 2.4, h1 + h2 / 2, z - 1);
    this.#box(6, H * 0.12, 6, cx + side * 3, h1 + h2 + H * 0.06, z - 2);
    this.#box(0.25, 14, 0.25, cx + side * 3, H + 7, z - 2, this.trimMaterial);

    // Neon trims on the street-facing corners + cornice
    const tx = face + side * 0.05;
    this.#trim(0.14, h1, 0.14, tx, h1 / 2, z + width / 2);
    this.#trim(0.14, h1, 0.14, tx, h1 / 2, z - width / 2);
    this.#trim(0.14, 0.14, width, tx, h1, z);
    this.#trim(0.14, 0.14, width * 0.8, face + side * (depth * 0.11 + 2.4 - 0.05), h1 + h2, z - 1);

    // Entrance: warm door slab + canopy line
    const door = new THREE.Mesh(
      this.disposer.track(new THREE.PlaneGeometry(3.2, 3.4)),
      this.disposer.track(new THREE.MeshBasicMaterial({ color: this.color.clone().multiplyScalar(0.35), toneMapped: false })),
    );
    door.rotation.y = -side * (Math.PI / 2);
    door.position.set(face - side * 0.02, 1.7, z - 3);
    this.group.add(door);
    this.#trim(0.9, 0.06, 5.2, face - side * 0.45, 3.9, z - 3);

    // Blade sign: faces down the avenue (+Z)
    const bladeX = face - side * 2.3;
    const blade = new NeonSign({
      width: 3.2,
      height: 12.8,
      canvasSize: [256, 1024],
      power: POWER.idle,
      flicker: 'buzz',
      draw: (ctx, w, h) => drawBlade(ctx, w, h, this.section),
    });
    blade.group.position.set(bladeX, 12.5, z + width / 2 - 1.2);
    this.group.add(blade.group);
    this.signs.push(blade);
    // brackets to the facade
    for (const y of [7, 18]) this.#box(2.2, 0.12, 0.12, face - side * 1.1, y, z + width / 2 - 1.2, this.trimMaterial);

    // Facade sign: faces the street
    const facade = new NeonSign({
      width: 11,
      height: 2.75,
      canvasSize: [1024, 256],
      power: POWER.idle,
      flicker: 'steady',
      draw: (ctx, w, h) => drawFacade(ctx, w, h, this.section),
    });
    facade.group.rotation.y = -side * (Math.PI / 2);
    facade.group.position.set(face - side * 0.3, 6.2, z + 1.5);
    this.group.add(facade.group);
    this.signs.push(facade);

    this.anchorPoint = new THREE.Vector3(face - side * 0.3, 6.2, z + 1.5);
    this.lightPos = new THREE.Vector3(bladeX, 3.5, z + width / 2 - 1.2);
    this.focusPose = {
      position: new THREE.Vector3(-side * 2.2, 3.4, z + 17),
      target: new THREE.Vector3(face, 7.5, z + 1.5),
    };
    this.#hitProxy(depth + 2, H, width + 2, cx - side * 1, z);
  }

  #buildTerminus(z, H) {
    const width = 36;
    const depth = 22;
    const front = z + depth / 2;
    this.#box(width, H * 0.55, depth, 0, (H * 0.55) / 2, z);
    this.#box(width * 0.6, H * 0.3, depth * 0.8, -3, H * 0.55 + H * 0.15, z - 2);
    this.#box(8, H * 0.15, 8, -6, H * 0.85 + H * 0.075, z - 3);
    this.#box(0.3, 18, 0.3, -6, H + 9, z - 3, this.trimMaterial);

    // Frame trims
    this.#trim(width, 0.16, 0.16, 0, H * 0.55, front + 0.05);
    this.#trim(0.16, H * 0.55, 0.16, -width / 2, (H * 0.55) / 2, front + 0.05);
    this.#trim(0.16, H * 0.55, 0.16, width / 2, (H * 0.55) / 2, front + 0.05);
    this.#trim(14, 0.08, 0.6, 0, 4.2, front + 0.3);

    const door = new THREE.Mesh(
      this.disposer.track(new THREE.PlaneGeometry(10, 3.8)),
      this.disposer.track(new THREE.MeshBasicMaterial({ color: this.color.clone().multiplyScalar(0.3), toneMapped: false })),
    );
    door.position.set(0, 1.9, front + 0.02);
    this.group.add(door);

    const sign = new NeonSign({
      width: 20,
      height: 5,
      canvasSize: [1024, 256],
      power: POWER.idle,
      flicker: 'steady',
      draw: (ctx, w, h) => drawFacade(ctx, w, h, this.section),
    });
    sign.group.position.set(0, 9, front + 0.3);
    this.group.add(sign.group);
    this.signs.push(sign);

    this.anchorPoint = new THREE.Vector3(0, 9, front + 0.3);
    this.lightPos = new THREE.Vector3(0, 4, front + 3);
    this.focusPose = {
      position: new THREE.Vector3(0.5, 3.8, front + 29),
      target: new THREE.Vector3(0, 8.5, front),
    };
    this.#hitProxy(width, H, depth, 0, z);
  }

  #hitProxy(w, h, d, x, z) {
    this.hit = new THREE.Mesh(this.disposer.track(new THREE.BoxGeometry(w, h, d)), this.disposer.track(new THREE.MeshBasicMaterial()));
    this.hit.position.set(x, h / 2, z);
    this.hit.layers.set(LAYERS.PICK);
    this.hit.userData.landmark = this;
    this.hit.userData.noReflect = true;
    this.group.add(this.hit);
  }

  set(key, value) {
    if (this.state[key] === value) return;
    this.state[key] = value;
    const { hover, focus, near } = this.state;
    const p = hover ? POWER.hover : focus ? POWER.focus : near ? POWER.near : POWER.idle;
    for (const s of this.signs) s.setPower(p, key === 'hover' && value);
  }

  update(dt, t, reducedMotion) {
    this.material.uniforms.uTime.value = t;
    let intensity = 0;
    for (const s of this.signs) {
      s.update(dt, t, reducedMotion);
      intensity = Math.max(intensity, s.intensity);
    }
    this.trimLevel = damp(this.trimLevel, intensity, 10, dt);
    this.trimMaterial.color.copy(this.color).multiplyScalar(0.6 + this.trimLevel * 2.2);
    this.light.power = 0.35 + intensity * 0.9;
  }

  dispose() {
    this.signs.forEach((s) => s.dispose());
    this.disposer.dispose();
  }
}

function drawBlade(ctx, w, h, section) {
  ctx.clearRect(0, 0, w, h);
  // frame tube
  ctx.save();
  ctx.strokeStyle = section.color;
  ctx.shadowColor = section.color;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.restore();

  neonText(ctx, section.index, w / 2, 110, { size: 88, color: '#ffffff', weight: 300, tube: 0.05, fill: 0.2 });
  plainText(ctx, '— SECTOR —', w / 2, 190, { size: 18, color: section.color, align: 'center', letterSpacing: 4, font: FONT_MONO });

  // Title, rotated to read top → bottom
  ctx.save();
  ctx.translate(w / 2 + 6, 240);
  ctx.rotate(Math.PI / 2);
  const title = section.title.toUpperCase();
  const size = Math.min(128, 700 / (title.length * 0.78));
  neonText(ctx, title, 0, 0, { size, color: section.color, align: 'left', weight: 800, tube: 0.07, letterSpacing: 6 });
  ctx.restore();
}

function drawFacade(ctx, w, h, section) {
  ctx.clearRect(0, 0, w, h);
  neonText(ctx, section.title.toUpperCase(), 40, h * 0.54, {
    size: 118,
    color: section.color,
    align: 'left',
    weight: 800,
    tube: 0.06,
    letterSpacing: 4,
  });
  plainText(ctx, `${section.index} / ${section.kicker.toUpperCase()}`, w - 40, 58, {
    size: 26,
    color: '#ffffff',
    align: 'right',
    letterSpacing: 5,
    alpha: 0.85,
  });
  ctx.fillStyle = section.color;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(w - 240, 78, 200, 4);
  ctx.globalAlpha = 1;
}

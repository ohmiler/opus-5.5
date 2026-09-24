import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createMaterials } from './materials.js';
import * as T from './textures.js';
import { Folder, CD, Floppy, Computer, Keyboard, ChromeStar, Smiley, Hourglass, Bin, Sticky, FloatWindow } from './items.js';
import { damp, nextFrame, motion } from '../utils/helpers.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _plane = new THREE.Plane();

/** Owns the scene graph: environment, desk, backdrop and every desk item. */
export class World {
  constructor(gl, { lite }) {
    this.gl = gl;
    this.lite = lite;
    this.scene = new THREE.Scene();
    this.items = [];
    this.pickables = [];
    this.textures = [];
    this.desk = new THREE.Group();
    this.desk.rotation.set(0.04, -0.08, -0.035); // the slight, playful tilt
    this.scene.add(this.desk);
    this.introTime = -1;
    this.zeroG = 0;
    this.zeroGTimer = 0;
    this.ctx = {
      bounds: { minX: -7.7, maxX: 7.7, minZ: -4.7, maxZ: 4.7 },
      pointer: new THREE.Vector2(),
      pointerActive: false,
      introTime: -1,
      zeroG: 0,
      onBinEject: null,
    };
  }

  async build(progress) {
    const steps = [
      ['Polishing chrome…', () => this.buildEnvironment()],
      ['Mixing translucent plastic…', () => this.buildKit()],
      ['Laying out the desktop…', () => this.buildDesk()],
      ['Burning CDs…', () => this.buildItems()],
      ['Defragmenting the sky…', () => this.buildBackdrop()],
    ];
    for (let i = 0; i < steps.length; i++) {
      progress(i / steps.length, steps[i][0]);
      await nextFrame();
      steps[i][1]();
    }
    progress(1, 'Compiling shaders…');
  }

  track(tex) { this.textures.push(tex); return tex; }

  // ------------------------------------------------------------ environment

  buildEnvironment() {
    // A custom studio for reflections: aqua sky, pearl horizon, pink + white softboxes.
    const env = new THREE.Scene();
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){
        float y = vP.y;
        vec3 top = vec3(.42,.78,1.), mid = vec3(.95,.98,1.), bot = vec3(.02,.1,.28);
        vec3 c = y > 0. ? mix(mid, top, pow(y, .5)) : mix(mid, bot, pow(-y, .35));
        gl_FragColor = vec4(c, 1.); }`,
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), skyMat));
    const box = (color, intensity, pos, size) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box('#ffffff', 5, [0, 12, 4], [10, 6]);
    box('#ff7ad9', 3, [-12, 3, 2], [3, 10]);
    box('#5fd6ff', 3.5, [12, 4, -3], [3, 10]);
    box('#ffffff', 2, [0, 2, 14], [14, 2]);
    const pmrem = new THREE.PMREMGenerator(this.gl);
    this.envMap = pmrem.fromScene(env, 0.02).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();
    env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

    this.scene.add(new THREE.HemisphereLight(0xcdefff, 0x0a2a55, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 10, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9ee6, 0.9);
    rim.position.set(6, 3, -8);
    this.scene.add(rim);
  }

  buildKit() {
    this.mats = createMaterials({ lite: this.lite });
    const shadow = this.track(T.blobShadow());
    const paper = this.track(T.paper());
    this.kit = {
      mats: this.mats,
      tex: { shadow, paper },
      geo: {
        shadowPlane: new THREE.PlaneGeometry(1, 1),
        floppy: new RoundedBoxGeometry(1.0, 1.04, 0.09, 3, 0.035),
        shutter: new THREE.BoxGeometry(0.52, 0.36, 0.1),
        floppyLabel: new THREE.PlaneGeometry(0.8, 0.46),
      },
      labelTexture: (text) => { const l = T.label(text); this.track(l.texture); return l; },
    };
  }

  // ------------------------------------------------------------ desk

  buildDesk() {
    const top = new THREE.Mesh(
      new RoundedBoxGeometry(16.6, 0.36, 10.6, 5, 0.18),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: this.track(T.desk()), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 }),
    );
    top.position.y = -0.18;
    const glow = new THREE.Mesh(new RoundedBoxGeometry(17.1, 0.3, 11.1, 5, 0.14), this.mats.plastic('#38c8ff', { roughness: 0.1, thickness: 2 }));
    glow.position.y = -0.46;
    const edge = new THREE.Mesh(new RoundedBoxGeometry(16.8, 0.06, 10.8, 3, 0.03), this.mats.chrome);
    edge.position.y = -0.34;
    this.desk.add(top, glow, edge);

    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 1.8),
      new THREE.MeshBasicMaterial({ map: this.track(T.deskTitle()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    title.rotation.x = -Math.PI / 2;
    title.position.set(-1.2, 0.002, 3.9);
    this.desk.add(title);

    // invisible surface used for drag projection
    this.deskTopY = 0;
  }

  // ------------------------------------------------------------ items

  buildItems() {
    const k = this.kit;
    const add = (item, x, z, delay) => {
      item.place(x, z);
      item.appearDelay = delay;
      item.bind();
      this.items.push(item);
      this.pickables.push(item.root);
      this.desk.add(item.root);
      return item;
    };

    this.computer = add(new Computer(k), -4.6, -1.7, 0.1);
    this.keyboard = add(new Keyboard(k), -4.3, 1.2, 0.25);
    this.secretFloppy = add(new Floppy(k, { label: 'secret.flp', sub: "don't look", section: 'secret', color: '#2a2f45', stripe: '#c6ff4d' }), -5.9, -3.9, 0.3);
    this.secretFloppy.secret = true;

    add(new Folder(k, { label: 'About', section: 'about', color: '#46c9ff' }), 0.2, -2.6, 0.35);
    add(new Folder(k, { label: 'Projects', section: 'projects', color: '#ff7ad9' }), 2.3, -2.7, 0.45);
    add(new Folder(k, { label: 'Guestbook', section: 'guestbook', color: '#b6ff5c' }), 4.4, -2.6, 0.55);

    add(new CD(k, { label: 'Mixtape 2000', section: 'mixtape', hue: 318 }), 0.9, 0.3, 0.6);
    add(new CD(k, { label: 'Encyclopedia', section: 'cdrom', hue: 196 }), 3.0, 0.7, 0.7);
    add(new Floppy(k, { label: 'Downloads', sub: 'warez (legal)', section: 'downloads', color: '#ff9ce4' }), 5.1, 0.4, 0.75);

    this.smiley = add(new Smiley(k), -1.2, 1.9, 0.8);
    this.star = add(new ChromeStar(k), 6.8, -1.5, 0.85);
    add(new Hourglass(k), 6.9, 1.6, 0.9);
    this.bin = add(new Bin(k), 6.7, 3.6, 0.95);

    add(new Sticky(k, { lines: ['TODO:', '- find 5 secrets', '- ↑↑↓↓←→←→ B A'], color: '#fff27a', rot: 0.12 }), 3.6, 3.2, 1.0);
    add(new Sticky(k, { lines: ['psst.', 'the computer', 'can hear you', 'type "help"'], color: '#ffb8ea', rot: -0.1 }), -7.0, 3.4, 1.05);

    add(new FloatWindow(k, { kind: 'welcome', section: 'welcome', height: 1.7 }), -0.9, -3.9, 1.1);
    add(new FloatWindow(k, { kind: 'error', section: 'error', height: 2.2 }), 4.7, -4.1, 1.2);

    if (this.lite) this.pickables.forEach((r) => r.traverse((o) => { if (o.isMesh) o.frustumCulled = true; }));
  }

  // ------------------------------------------------------------ backdrop

  buildBackdrop() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: `varying vec3 vP; uniform float uTime;
          void main(){
            float y = vP.y;
            vec3 deep = vec3(.012,.05,.16), mid = vec3(.03,.2,.48), glow = vec3(.25,.75,1.);
            vec3 c = mix(mid, deep, smoothstep(-.05, .7, y));
            c = mix(c, glow, pow(1. - abs(y + .08), 14.) * .9);
            c += vec3(1.,.45,.85) * pow(max(0., 1. - abs(y + .02) * 6.), 6.) * .12;
            c = mix(c, vec3(.0,.02,.08), smoothstep(-.1, -.7, y));
            gl_FragColor = vec4(c, 1.); }`,
      }),
    );
    this.sky = sky;
    this.scene.add(sky);

    // Infinite retro grid below the floating desk.
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `varying vec3 vW; uniform float uTime;
          void main(){
            vec2 p = vW.xz / 3.; p.y += uTime * .25;
            vec2 g = abs(fract(p - .5) - .5) / fwidth(p);
            float line = 1. - min(min(g.x, g.y), 1.);
            float fade = smoothstep(90., 8., length(vW.xz));
            gl_FragColor = vec4(vec3(.35,.8,1.), line * fade * .55); }`,
      }),
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -7;
    this.grid = grid;
    this.scene.add(grid);

    // Sparse drifting dust.
    const n = this.lite ? 140 : 320;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 20 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.18, map: this.track(T.sparkle()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    this.scene.add(this.dust);
  }

  // ------------------------------------------------------------ api

  playIntro() { this.introTime = 0; }

  setZeroG(seconds) { this.zeroGTimer = seconds; }

  /** Ray → desk-local 2D point on a horizontal plane at `height` above the desk. */
  projectRay(ray, height = 0, out = new THREE.Vector2()) {
    this.desk.updateMatrixWorld();
    _n.set(0, 1, 0).transformDirection(this.desk.matrixWorld);
    _v.set(0, height, 0).applyMatrix4(this.desk.matrixWorld);
    _plane.setFromNormalAndCoplanarPoint(_n, _v);
    if (!ray.intersectPlane(_plane, _v)) return null;
    this.desk.worldToLocal(_v);
    return out.set(_v.x, _v.z);
  }

  worldPositionOf(item, out = new THREE.Vector3()) {
    return item.lift.getWorldPosition(out).add(_v.set(0, 0.6, 0));
  }

  update(dt, t) {
    if (this.introTime >= 0) this.introTime += Math.max(0, dt);
    this.ctx.introTime = this.introTime;
    this.zeroGTimer = Math.max(0, this.zeroGTimer - dt);
    this.zeroG = damp(this.zeroG, this.zeroGTimer > 0 ? 1 : 0, 1.6, dt);
    this.ctx.zeroG = this.zeroG;

    if (!motion.reduced) {
      this.desk.position.y = Math.sin(t * 0.5) * 0.08;
      this.desk.rotation.z = -0.035 + Math.sin(t * 0.33) * 0.008;
      this.dust.rotation.y = t * 0.01;
      this.grid.material.uniforms.uTime.value = t;
    }

    for (const it of this.items) it.update(dt, t, this.ctx);
    this.resolveCollisions();
  }

  resolveCollisions() {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.captured || a.appear < 1) continue;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (b.captured || b.layer !== a.layer || b.appear < 1) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y;
        const min = (a.radius + b.radius) * 0.78;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), overlap = (min - d), nx = dx / d, nz = dz / d;
        // dragged items are "heavy": they shove others around
        const wa = a.dragging ? 0 : b.dragging ? 1 : b.mass / (a.mass + b.mass);
        const wb = 1 - wa;
        a.pos.x -= nx * overlap * wa; a.pos.y -= nz * overlap * wa;
        b.pos.x += nx * overlap * wb; b.pos.y += nz * overlap * wb;
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * nz;
        if (rel < 0) {
          const imp = -rel * 0.8;
          if (!a.dragging) { a.vel.x -= nx * imp * wa; a.vel.y -= nz * imp * wa; }
          if (!b.dragging) { b.vel.x += nx * imp * wb; b.vel.y += nz * imp * wb; }
          if (imp > 2) { a.poke(Math.min(4, imp * 0.3)); b.poke(Math.min(4, imp * 0.3)); }
        }
      }
    }
  }

  dispose() {
    this.items.forEach((i) => i.dispose?.());
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    Object.values(this.kit?.geo || {}).forEach((g) => g.dispose());
    this.textures.forEach((t) => t.dispose());
    this.envMap?.dispose();
    this.mats?.dispose();
  }
}

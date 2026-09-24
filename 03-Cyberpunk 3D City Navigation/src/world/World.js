import * as THREE from 'three';
import { PALETTE, STREET } from '../config.js';
import { NeonLights } from './NeonLights.js';
import { Sky } from './Sky.js';
import { Street } from './Street.js';
import { Skyline } from './Skyline.js';
import { Landmark } from './Landmark.js';
import { NeonSign } from './NeonSign.js';
import { Billboard } from './Billboard.js';
import { Rain, Splashes, Steam } from './Weather.js';
import { Traffic, Drones } from './Traffic.js';
import { Hologram } from './Hologram.js';
import { HoloTitle, RoadText } from './Typography.js';
import { neonText } from '../utils/canvas.js';
import { nextFrame } from '../utils/math.js';

const SHOP_SIGNS = [
  { side: -1, z: 24, text: 'RAMEN', color: '#ff3355', blade: true, flicker: 'buzz' },
  { side: 1, z: 27, text: '24H', color: '#6dff9b', blade: false, flicker: 'steady' },
  { side: 1, z: 8, text: 'ホテル', color: '#ff2bd6', blade: true, flicker: 'broken' },
  { side: -1, z: 10, text: 'BAR', color: '#19f0ff', blade: false, flicker: 'steady' },
  { side: 1, z: -8, text: 'KARAOKE', color: '#ffb13b', blade: false, flicker: 'buzz' },
  { side: 1, z: -22, text: '薬', color: '#6dff9b', blade: true, flicker: 'steady' },
  { side: -1, z: -30, text: 'NOODLE', color: '#ffb13b', blade: true, flicker: 'broken' },
  { side: -1, z: -48, text: 'CYBER-DOC', color: '#19f0ff', blade: false, flicker: 'buzz' },
  { side: 1, z: -86, text: 'PACHINKO', color: '#ff2bd6', blade: true, flicker: 'buzz' },
  { side: -1, z: -100, text: '酒', color: '#ff3355', blade: true, flicker: 'broken' },
  { side: 1, z: -104, text: 'MOTEL', color: '#8f7bff', blade: false, flicker: 'steady' },
  { side: -1, z: -114, text: 'OPEN', color: '#ff3355', blade: false, flicker: 'buzz' },
];

const BILLBOARDS = [
  { program: 'synth', pos: [15, 21, -22], rotY: -0.35, size: [10, 5], light: '#ff2bd6' },
  { program: 'ticker', pos: [-16, 27, -54], rotY: 0.3, size: [12, 6], light: '#19f0ff' },
  { program: 'eye', pos: [14, 17, -96], rotY: -0.3, size: [9, 4.5], light: '#ffb13b' },
  { program: 'radio', pos: [13, 34, -121.6], rotY: 0, size: [7, 14], canvas: [256, 512], light: '#8f7bff', legs: 0 },
];

const VENTS = [
  { x: -3.5, z: 16, tint: '#8f9ec8' },
  { x: 4, z: -24, tint: '#7fbfcc' },
  { x: -4.5, z: -60, tint: '#c08fc0' },
  { x: 3, z: -94, tint: '#c8a888' },
  { x: -2, z: -114, tint: '#9c90cc' },
];

// Owns the scene graph and every environmental component.
export class World {
  constructor({ quality, reducedMotion, profile, sections, sound }) {
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    this.profile = profile;
    this.sections = sections;
    this.sound = sound;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.ink);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0115);
    this.components = [];
    this.landmarks = [];
    this.pointScaled = [];
  }

  #add(component, object = component.group ?? component.mesh) {
    this.components.push(component);
    if (object) this.scene.add(object);
    if (component.setPointScale) this.pointScaled.push(component);
    return component;
  }

  // Built in steps so the loader can report real progress.
  async build(onProgress = () => {}) {
    const q = this.quality;
    const steps = [
      ['Pressurising night sky', () => (this.sky = this.#add(new Sky()))],
      ['Neon grid online', () => (this.neon = new NeonLights())],
      ['Wetting the asphalt', () => (this.street = this.#add(new Street({ quality: q, neonLights: this.neon, reducedMotion: this.reducedMotion })))],
      ['Raising the skyline', () => (this.skyline = this.#add(new Skyline({ sections: this.sections })))],
      [
        'Lighting landmark signage',
        () => {
          for (const section of this.sections) this.landmarks.push(this.#add(new Landmark({ section, neonLights: this.neon })));
        },
      ],
      ['Hanging shop signs', () => this.#buildShopSigns()],
      [
        'Booting advertising network',
        () => {
          this.billboards = BILLBOARDS.map((b) => {
            const bb = this.#add(new Billboard({ program: b.program, width: b.size[0], height: b.size[1], canvasSize: b.canvas, legs: b.legs ?? b.pos[1] - b.size[1] / 2 }));
            bb.group.position.set(...b.pos);
            bb.group.rotation.y = b.rotY;
            this.neon.add(new THREE.Vector3(b.pos[0] * 0.8, 6, b.pos[2] + 4), b.light, 0.45);
            return bb;
          });
          this.hologram = this.#add(new Hologram());
        },
      ],
      [
        'Calibrating rainfall',
        () => {
          this.rain = this.#add(new Rain({ count: q.rain, neonLights: this.neon, reducedMotion: this.reducedMotion }));
          this.splashes = this.#add(new Splashes({ count: q.splashes }));
          this.steam = this.#add(new Steam({ vents: VENTS, perVent: q.steam, reducedMotion: this.reducedMotion }));
          this.scene.add(this.steam.grates);
        },
      ],
      [
        'Clearing sky lanes',
        () => {
          this.traffic = this.#add(new Traffic({ count: q.traffic }));
          this.drones = this.#add(new Drones({ onPass: () => this.sound?.play('drone') }));
        },
      ],
      [
        'Projecting typography',
        () => {
          this.title = this.#add(new HoloTitle(this.profile));
          this.roadText = this.#add(new RoadText({ sections: this.sections }));
        },
      ],
    ];

    for (let i = 0; i < steps.length; i++) {
      onProgress(i / steps.length, steps[i][0]);
      await nextFrame();
      steps[i][1]();
    }
    this.neon.update();
    onProgress(1, 'District ready');
    this.pickables = this.landmarks.map((l) => l.hit);
  }

  #buildShopSigns() {
    this.shopSigns = SHOP_SIGNS.map((s) => {
      const vertical = s.blade && s.text.length <= 3;
      const sign = new NeonSign({
        width: s.blade ? (vertical ? 1.3 : 3.4) : 4.2,
        height: s.blade ? (vertical ? 3.4 : 1.1) : 1.2,
        canvasSize: vertical ? [128, 384] : [512, 128],
        flicker: s.flicker,
        power: 0.9,
        boost: 1.8,
        draw: (ctx, w, h) => {
          if (vertical) {
            const chars = [...s.text];
            const step = h / (chars.length + 0.4);
            chars.forEach((c, i) => neonText(ctx, c, w / 2, step * (i + 0.7), { size: Math.min(96, step * 0.8), color: s.color, weight: 800 }));
          } else {
            const size = Math.min(80, 780 / Math.max(3, s.text.length));
            neonText(ctx, s.text, w / 2, h / 2 + 4, { size, color: s.color, weight: 800, letterSpacing: 2 });
          }
        },
      });
      const face = s.side * STREET.walkHalf;
      if (s.blade) {
        sign.group.position.set(face - s.side * 1.2, 4.6 + Math.random() * 1.5, s.z);
      } else {
        sign.group.rotation.y = -s.side * (Math.PI / 2);
        sign.group.position.set(face - s.side * 0.25, 3.6 + Math.random() * 1.2, s.z);
      }
      this.#add(sign);
      return sign;
    });
  }

  setReducedMotion(v) {
    this.reducedMotion = v;
    this.rain?.setReducedMotion(v);
    this.steam?.setReducedMotion(v);
    if (this.street) this.street.uniforms.uRipple.value = v ? 0.3 : 1;
  }

  // Keep world-sized point sprites consistent across resolutions.
  setViewport(heightPx, fovDeg) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    for (const c of this.pointScaled) c.setPointScale(s);
  }

  update(dt, t, camera) {
    const rm = this.reducedMotion;
    this.sky.update(dt, t, camera);
    this.street.update(dt, t, camera);
    this.street.uniforms.uLampFlicker.value = this.skyline.lampFlicker;
    this.skyline.update(dt, t, rm);
    for (const l of this.landmarks) l.update(dt, t, rm);
    for (const s of this.shopSigns) s.update(dt, t, rm);
    for (const b of this.billboards) b.update(dt, t, rm);
    this.hologram.update(dt, t, rm);
    this.rain.update(dt, t, camera);
    this.splashes.update(dt, t, camera);
    this.steam.update(dt, t);
    this.traffic.update(dt, t, rm);
    this.drones.update(dt, t, camera, rm);
    this.title.update(dt, t, camera, rm);
    this.neon.update();
  }

  dispose() {
    for (const c of this.components) c.dispose?.();
    this.components = [];
    this.scene.clear();
  }
}

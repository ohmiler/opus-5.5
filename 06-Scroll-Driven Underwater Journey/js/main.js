import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { ScrollController } from './core/ScrollController.js';
import { Pointer } from './core/Pointer.js';
import { Hover } from './core/Hover.js';
import { AudioBus } from './core/AudioBus.js';
import { Cursor } from './ui/Cursor.js';
import { Loader } from './ui/Loader.js';
import { Narrative } from './ui/Narrative.js';
import { Hud } from './ui/Hud.js';
import { Environment } from './world/Environment.js';
import { SurfaceLight } from './world/SurfaceLight.js';
import { Particles } from './world/Particles.js';
import { FishSchool } from './world/FishSchool.js';
import { Jellyfish } from './world/Jellyfish.js';
import { Lanterns } from './world/Lanterns.js';
import { Beacon, BEACON_CENTER } from './world/Beacon.js';
import { disposeObject, lerp, nextFrame, ss } from './util.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
const Q = {
  maxDpr: mobile ? 1.5 : 2,
  bloom: !mobile,
  particles: mobile ? 1000 : 2400,
  fish: mobile ? 0.5 : 1,
  jellies: mobile ? 6 : 10,
  lanterns: mobile ? 28 : 48,
  chains: mobile ? 1 : 3,
};

history.scrollRestoration = 'manual';
scrollTo(0, 0);

const loader = new Loader();

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

async function init() {
  if (!webglAvailable()) {
    loader.fail('This experience needs WebGL. Try a recent desktop browser.');
    return;
  }

  loader.step(0.08, 'Calibrating pressure');
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);

  const canvas = document.getElementById('scene');
  const renderer = new Renderer(canvas, Q);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

  const audio = new AudioBus();
  const pointer = new Pointer();
  const cursor = new Cursor(pointer);
  const hover = new Hover(pointer, cursor);
  const scroll = new ScrollController({ reduced });
  const rig = new CameraRig(camera, { reduced });

  loader.step(0.2, 'Pouring the ocean');
  const env = new Environment(scene);
  const surface = new SurfaceLight(scene, { rays: mobile ? 8 : 14 });
  await nextFrame();

  loader.step(0.35, 'Seeding marine snow');
  const particles = new Particles(scene, { count: Q.particles });
  await nextFrame();

  loader.step(0.5, 'Schooling fish');
  const scatter = () => audio.ping(1400 + Math.random() * 400, 0.012, 0.4);
  const schools = [
    { y: -9, z: -10, count: 40, size: 0.32, color: '#d6eef6', radius: 10, speed: 0.35, seed: 2 },
    { y: -28, z: -18, count: 90, size: 0.5, color: '#a4c9da', radius: 16, speed: 0.25, seed: 3 },
    { y: -56, z: -12, count: 140, size: 0.45, color: '#77a2bb', radius: 18, speed: 0.3, seed: 4 },
    { y: -86, z: -20, count: 110, size: 0.55, color: '#4d7892', radius: 14, speed: 0.22, seed: 5 },
  ].map((c) => new FishSchool(scene, { ...c, count: Math.round(c.count * Q.fish), onScatter: scatter }));
  await nextFrame();

  loader.step(0.65, 'Growing jellyfish');
  const jellies = new Jellyfish(scene, { count: Q.jellies, hover, audio });
  await nextFrame();

  loader.step(0.78, 'Kindling the dark');
  const lanterns = new Lanterns(scene, { count: Q.lanterns, chains: Q.chains, hover, audio });
  await nextFrame();

  loader.step(0.88, 'Something stirs below');
  const beacon = new Beacon(scene, { hover, audio, cursor, reduced });
  renderer.setupPost(scene, camera);

  const narrative = new Narrative({ beacon: new THREE.Vector3(BEACON_CENTER.x, BEACON_CENTER.y + 15, BEACON_CENTER.z) });
  const blackout = document.querySelector('.blackout');
  const hud = new Hud((zone, prev) => {
    audio.whoosh();
    if (zone === 2 && prev < zone && !reduced) {
      blackout.classList.remove('is-flicker');
      void blackout.offsetWidth;
      blackout.classList.add('is-flicker');
    }
  });

  // Resize
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 70 : 55;
    camera.updateProjectionMatrix();
    renderer.resize(w, h);
    particles.setPixelRatio(renderer.dpr);
  };
  let resizeRaf = 0;
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resize); };
  addEventListener('resize', onResize);
  resize();

  // Compile every depth's shaders up front so the first scroll never hitches
  renderer.gl.compile(scene, camera);
  loader.step(1, 'Ready when you are');

  // Loop
  const root = document.documentElement;
  const timeScale = reduced ? 0.5 : 1;
  let t = 0;
  let raf = 0;
  let last = performance.now();
  let finale = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 20);
    last = now;
    t += dt * timeScale;

    scroll.update(dt);
    const p = scroll.p;

    rig.update(p, scroll.vel, { x: pointer.sx, y: pointer.sy }, t, dt);
    pointer.update(camera, dt);

    env.update(p);
    const fogD = env.fog.density;
    surface.update(t, p, camera);
    particles.update(t, p, camera);
    for (const s of schools) s.update(t, dt * timeScale, pointer, camera, p);
    jellies.update(t, dt * timeScale, p, camera, fogD);
    lanterns.update(t, dt, p, camera, fogD);
    beacon.update(t, dt, p);

    hover.update();
    cursor.update(dt);
    narrative.update(p, pointer, camera);
    hud.update(p);
    audio.setDepth(p);

    root.style.setProperty('--deep', p.toFixed(4));
    if ((p > 0.9) !== finale) {
      finale = p > 0.9;
      document.body.classList.toggle('is-finale', finale);
    }
    if (renderer.bloom) renderer.bloom.strength = lerp(0.3, 1.05, ss(0.3, 0.75, p));

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); audio.ctx?.suspend(); }
    else { last = performance.now(); raf = requestAnimationFrame(frame); if (audio.on) audio.ctx.resume(); }
  });

  // Sound toggle
  const soundBtn = document.querySelector('.hud__sound');
  const setSound = (on) => {
    on ? audio.enable() : audio.disable();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('span').textContent = on ? 'on' : 'off';
  };
  soundBtn.addEventListener('click', () => setSound(!audio.on));

  // Teardown
  addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize);
    [scroll, pointer, hover, cursor, audio].forEach((o) => o.dispose());
    disposeObject(scene);
    renderer.dispose();
  }, { once: true });

  const { sound } = await loader.ready();
  if (sound) setSound(true);
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-live');
}

init().catch((err) => {
  console.error(err);
  loader.fail('Something went wrong while preparing the dive.');
});

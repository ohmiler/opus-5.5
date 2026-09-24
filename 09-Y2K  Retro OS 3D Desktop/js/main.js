import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { World } from './world/World.js';
import { Interaction } from './interaction/Interaction.js';
import { WindowManager } from './ui/WindowManager.js';
import { Cursor } from './ui/Cursor.js';
import { Loader } from './ui/Loader.js';
import { Sound } from './ui/Sound.js';
import { Taskbar } from './ui/Taskbar.js';
import { Secrets, Toasts } from './ui/Secrets.js';
import { SECTIONS, START_MENU } from './content.js';
import { hasWebGL, isCoarsePointer, isFinePointer, isTypingTarget, motion, wait } from './utils/helpers.js';

// ------------------------------------------------------------------ shell (DOM, works without WebGL)

const lite = isCoarsePointer() || Math.min(window.innerWidth, window.innerHeight) < 600;
const sound = new Sound();
const toasts = new Toasts();
const cursor = new Cursor({ fine: isFinePointer() });
const loader = new Loader();
const wm = new WindowManager(document.getElementById('windows'), { sections: SECTIONS, sound });
wm.context = { toasts };

let world = null, rig = null, renderer = null, interaction = null;

const secrets = new Secrets({ toasts, sound, onKonami: () => triggerKonami() });
const taskbar = new Taskbar({
  wm, sound, menu: START_MENU,
  onClockSecret: () => triggerY2K(),
  onShutdown: () => shutdown(),
});

const hint = document.getElementById('hint');
let interactions = 0;
function noteInteraction() {
  if (++interactions === 4) hint.classList.add('is-gone');
}

// ------------------------------------------------------------------ easter eggs

function triggerKonami() {
  world?.setZeroG(9);
  sound.play('egg');
  secrets.find('konami', 'GRAVITY.DLL not found. Everything is floating.');
}

function triggerY2K() {
  document.body.classList.remove('y2k');
  void document.body.offsetWidth;
  document.body.classList.add('y2k');
  setTimeout(() => document.body.classList.remove('y2k'), 1400);
  taskbar.bugClock(6);
  sound.play('error');
  if (world) {
    world.computer.screen.glitch = 1.6;
    world.computer.screen.print('DATE: 01/01/1900 ?!', 'Y2K BUG... JUST KIDDING');
    world.computer.screen.setMood('dizzy', 3);
  }
  secrets.find('y2k', 'The clock rolled over to 1900. Y2K averted. Probably.');
}

function shutdown() {
  const el = document.getElementById('shutdown');
  sound.play('close');
  el.hidden = false;
  const reboot = () => {
    el.hidden = true;
    sound.play('boot');
    toasts.show('Welcome back! Scandisk found 0 problems and 12 good vibes.', '✦');
  };
  setTimeout(() => el.addEventListener('click', reboot, { once: true }), 400);
}

// ------------------------------------------------------------------ keyboard → CRT

let typed = '';
window.addEventListener('keydown', (e) => {
  if (!world || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
  if (e.key.length !== 1 && e.key !== 'Backspace' && e.key !== 'Enter') return;
  if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
  if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return;
  const cmd = world.computer.type(e.key);
  world.keyboard.pressKey(e.key);
  sound.play('type');
  noteInteraction();
  if (e.key === ' ') e.preventDefault();
  typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-8);
  if (typed.endsWith('y2k') || cmd === 'y2k') { typed = ''; triggerY2K(); }
  if (cmd === 'party') world.setZeroG(5);
});

// ------------------------------------------------------------------ boot

async function boot() {
  loader.step(0.06, 'Detecting hardware…');
  await Promise.race([Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('20px VT323')]), wait(2500)]).catch(() => {});
  loader.step(0.14, 'Loading fonts.fon…');

  if (!hasWebGL()) return bootFallback();

  try {
    renderer = new Renderer(document.getElementById('scene'), { maxDPR: lite ? 1.25 : 1.5 });
  } catch {
    return bootFallback();
  }
  rig = new CameraRig();
  rig.resize(window.innerWidth, window.innerHeight);
  world = new World(renderer.gl, { lite });
  await world.build((p, msg) => loader.step(0.14 + p * 0.74, msg));
  rig.update(0);
  // Warm up every shader (items included) before the intro so nothing compiles mid-animation.
  world.items.forEach((i) => { i.root.visible = true; i.lift.scale.setScalar(1); });
  if (renderer.gl.compileAsync) await renderer.gl.compileAsync(world.scene, rig.camera).catch(() => {});
  else renderer.gl.compile(world.scene, rig.camera);
  // The warm-up frame keeps every object visible: if the browser ever stops painting
  // (hidden/occluded window), the last shown frame is a full desk, never an empty one.
  renderer.render(world.scene, rig.camera);
  loader.step(1, 'Ready.');

  const mode = await loader.waitForStart();
  if (mode === 'sound') sound.enable();
  sound.play('boot');
  // Don't spend the intro while the tab is hidden — play it when the visitor can see it.
  if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
  loader.hide();
  document.body.classList.add('is-live');
  rig.playIntro();
  world.playIntro();
  setTimeout(() => toasts.show('Tip: double-click things. Type anything. Look for secrets.', '✦', 5200), motion.reduced ? 600 : 3400);

  world.ctx.onBinEject = (item) => {
    sound.play('boing');
    secrets.find('bin', `Recycle Bin: "I'd rather not." (${item.name || 'item'} restored)`);
  };

  interaction = new Interaction({
    dom: renderer.gl.domElement, rig, world,
    handlers: {
      onHoverChange(item) {
        cursor.setState(item ? 'hover' : 'default');
        if (item) sound.play(item.disc ? 'spin' : 'hover');
      },
      onDragStart() { cursor.setState('grab'); sound.play('grab'); noteInteraction(); },
      onDragEnd(item) {
        cursor.setState('hover');
        sound.play('drop');
        if (world.bin.accepts(item)) { world.bin.swallow(item); sound.play('suck'); }
      },
      onClick(item, e) {
        const secret = item.onClick();
        sound.play('click');
        cursor.burst(e.clientX, e.clientY, 10);
        noteInteraction();
        if (item === world.smiley && secret) secrets.find('smiley', 'Smiley is now way too cool for this desk.');
        if (item.clickOpens) openItem(item);
      },
      onDoubleClick(item, e) {
        item.onDoubleClick();
        cursor.burst(e.clientX, e.clientY, 24);
        noteInteraction();
        if (!item.clickOpens) openItem(item);
      },
    },
  });

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  renderer.gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); bootFallback(); });
  window.addEventListener('pagehide', teardown);
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

const _p = new THREE.Vector3();
function openItem(item) {
  if (!item.section) return;
  world.worldPositionOf(item, _p);
  rig.focusOn(_p);
  const s = _p.clone().project(rig.camera);
  const origin = { x: (s.x * 0.5 + 0.5) * window.innerWidth, y: (-s.y * 0.5 + 0.5) * window.innerHeight };
  wm.open(item.section, { origin });
  if (item.secret) secrets.find('floppy', 'You found the hidden floppy behind the computer!');
}

// ------------------------------------------------------------------ loop

let raf = 0, last = 0, elapsed = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  // rAF timestamps can predate performance.now(): never let dt go negative.
  const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000));
  last = now;
  elapsed += dt;
  try {
    interaction.update();
    world.update(dt, elapsed);
    rig.update(dt);
    renderer.render(world.scene, rig.camera);
    renderer.adapt(dt);
  } catch (err) {
    if (!loop.warned) { loop.warned = true; console.error('[MillenniumOS] frame error', err); }
  }
  cursor.update(dt);
}

function onResize() {
  renderer.resize();
  rig.resize(window.innerWidth, window.innerHeight);
  cursor.resize();
  wm.onResize();
}

function teardown() {
  cancelAnimationFrame(raf);
  interaction?.dispose();
  world?.dispose();
  renderer?.dispose();
}

// ------------------------------------------------------------------ safe mode (no WebGL)

async function bootFallback() {
  const fb = document.getElementById('fallback');
  const grid = fb.querySelector('.fallback__grid');
  grid.innerHTML = START_MENU.filter((m) => m !== '-').map((m) => `<button data-open="${m.id}"><span class="ico">${m.icon}</span>${m.title}</button>`).join('');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { const r = b.getBoundingClientRect(); wm.open(b.dataset.open, { origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }); }
  });
  fb.hidden = false;
  document.getElementById('scene').style.display = 'none';
  loader.step(1, 'Safe Mode');
  const mode = await loader.waitForStart();
  if (mode === 'sound') sound.enable();
  loader.hide();
  document.body.classList.add('is-live');
  const tick = (() => { let l = performance.now(); return function f(n) { cursor.update(Math.min(0.05, (n - l) / 1000)); l = n; requestAnimationFrame(f); }; })();
  requestAnimationFrame(tick);
  window.addEventListener('resize', () => { cursor.resize(); wm.onResize(); });
}

boot().catch((err) => {
  console.error(err);
  loader.fail('Boot failed — starting Safe Mode');
  bootFallback();
});

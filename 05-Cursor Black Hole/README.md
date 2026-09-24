# Singularity — a study in gravity

An interactive Three.js site where the cursor behaves like a black hole. Tens of thousands of bodies
are simulated on the GPU, and scrolling carries them through five forms: drift, accretion disk,
spiral, spacetime fabric, and finally a word.

## Run

It is plain ES modules with no build step. Any static server works:

```bash
npm start            # http-server on http://localhost:5188
# or
npx serve .
python -m http.server 5188
```

Opening `index.html` directly from disk won't work, because browsers block module imports over `file://`.

## Interaction

| Gesture | Effect |
| --- | --- |
| Move | Bodies fall toward the cursor, orbit it, and trail in its wake when it moves fast |
| Click | Detonation: a radial impulse, then a brief negative mass that repels |
| Hold | Charge builds over about 2 s, so mass, reach and horizon all grow (the ring shows the charge) |
| Release | Launch, scaled by the stored charge |
| Scroll | Morphs the form, and scroll speed adds a "wind" to the particles |

Headline glyphs are lensed by the same mass. Sound is procedural (Web Audio) and stays off until the
user switches it on.

## Architecture

```
src/
  main.js                 boot: loader, fonts, WebGL check, fallback
  App.js                  wires everything together, owns the frame loop, adaptive quality, dispose
  config/chapters.js      narrative as data: form, layout side, stiffness, flow, pinch, camera pose
  core/Renderer.js        WebGLRenderer, DPR cap, resize, degrade()
  core/CameraRig.js       per-chapter poses blended by scroll, springs, pointer parallax
  core/EventBus.js        interaction events (press, detonate, chapter, hover, field)
  sim/ParticleSimulation  GPUComputationRenderer: position + velocity ping-pong textures
  sim/shaders.js          physics (velocity/position passes) + point rendering
  sim/shapes.js           seed data: random, drift field, big-bang start, word sampling
  sim/ParticleField.js    Points geometry that reads positions from the sim texture
  interaction/Pointer.js  screen→world projection, charge, mass, detonations
  ui/                     Cursor, LensText, Narrative (scroll→chapter), Hud, Loader, splitText
  audio/SoundDesign.js    Web Audio synth that subscribes to the event bus
```

## Performance and accessibility

- **Budget:** 65,536 bodies on desktop, 36,864 on ≤4-core machines and 16,384 on touch or small screens.
  Override it with `?particles=128|192|256|384`.
- **DPR:** capped at 2 (1.5 on touch). It steps down automatically if frames average under 45 fps.
- **Float fallback:** uses half-float render targets when full float isn't renderable.
- **No WebGL 2:** the content, reveals and HUD still work over a static gradient.
- **Reduced motion:** no big-bang intro, dolly, parallax, pinch transitions or glyph lensing,
  softer currents and detonations, and short fades. The setting is honoured live if it changes.
- **Touch:** tap to detonate and hold to charge. A faint body wanders on its own when no finger is down.
- **Cleanup:** textures, geometries, materials, render targets and listeners are disposed on `pagehide`.

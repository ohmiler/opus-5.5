# Nocturne — an endless archive

An infinite, inertial 3D gallery built with Three.js (r169, loaded via import map — no build step).

```bash
npm start            # → http://localhost:5288
```

## Interaction

| Input | Result |
| --- | --- |
| Wheel / trackpad | Travel through the corridor (smoothed, with momentum) |
| Drag ↕ / swipe | Travel; flick to glide |
| Drag ↔ | Drift sideways between walls (soft, rubber-banded bounds) |
| Pointer | Camera parallax + gaze; nearby works turn toward the cursor |
| Hover a work | It lifts toward the camera, wakes to full colour, cursor → "View" |
| Click a work | Cinematic fly-in: dolly-zoom kick, letterbox, work fills frame |
| ← → / Prev · Next | Fly directly between projects |
| Esc / Close / click | Return to the corridor, parked in front of that work |
| ↑ ↓ Space | Keyboard travel; Tab reveals an accessible project index |

Projects deep-link (`#/glass-weather`) and the browser Back button closes them.

## Architecture

```
src/
  main.js                 boot, WebGL check, fallback catalogue
  App.js                  state machine (loading → intro → explore ⇄ focus), frame loop
  core/Renderer.js        WebGL context, DPR cap (2 desktop / 1.5 touch), resize, dispose
  core/Stage.js           scene + shared atmosphere uniforms (fog, near-fade)
  core/CameraRig.js       camera physics: damped targets, momentum, parallax, focus tweens
  interaction/Input.js    wheel / drag / keyboard → camera intentions
  gallery/Gallery.js      builds works + room titles, infinite wrapping, picking
  gallery/Card.js         artwork plane (custom shader) + in-scene wall label
  gallery/TextPlane.js    typography rendered into the 3D scene
  gallery/layout.js       seeded procedural composition
  gallery/ArtworkFactory  procedural placeholder artworks (canvas)
  gallery/projects.js     the 20 placeholder projects
  ui/                     Loader, HUD, Detail view, custom Cursor
  audio/SoundEngine.js    sound-ready hooks; optional Web Audio synth (off by default)
```

**Using real images:** replace `ArtworkFactory.paint()` with an image loader
(keep `project.aspect` in sync with the image's width / height).

**Reduced motion:** parallax, bend, sway and dolly-zoom are disabled; transitions
become short crossfades; inertia is shortened.

**Mobile:** touch-driven travel, no custom cursor, smaller textures, fewer
vertices, portrait-aware lens and composition.

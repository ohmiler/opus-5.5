# A Catalogue of Worlds — 3D portfolio

A portfolio presented as a miniature galaxy. Each planet is a project; the galactic core is the light source for every world.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## Editing content

All copy and planet art direction live in **`src/data/projects.js`**:

- `owner` — name, role, email and links (intro + contact sections)
- `projects[]` — one entry per planet. `world.type` picks the surface shader
  (`gas`, `magma`, `ocean`, `pearl`, `ice`); `palette`, `accent`, `radius`,
  `orbit`, `tilt` and `ring` shape the look and position.

Camera compositions for each section are in `World.layout()` (`src/world/World.js`).

## Interaction

| Input | Action |
| --- | --- |
| Wheel / swipe / ↑↓ / PgUp PgDn / Space | Travel one section (one gesture = one section; the camera leans as you scroll) |
| Hover a planet | Reveal its name, brighten its atmosphere, excite its particles |
| Click / tap a planet | Fly in and open the project dossier |
| Esc / "Return to orbit" / scroll | Close the dossier |
| Rail on the right | Jump to any section (select the current world again to open it) |
| Home / End | First / last section |

## Architecture

```
src/
  core/         App (composition root + frame loop), Renderer (WebGL + post),
                CameraRig (curve path, focus, parallax, banking), Viewport,
                PerformanceMonitor, Emitter
  world/        World (scene + camera stations), Planet, Galaxy/Starfield/Core,
                SceneText (world-space typography), shared uniforms
  interaction/  InputController (wheel/touch/keys → intents), Picker (ray–sphere)
  ui/           Loader, Hud, Labels, Cursor, ProjectPanel, SectionCopy
  audio/        SoundDesign (semantic cues → Web Audio synthesis)
  shaders/      GLSL as JS template strings
```

- **Camera:** its pose is computed from a few scalar values: path progress (tweened with GSAP along a Catmull-Rom curve), scroll lean, focus blend and intro dolly. Pointer parallax and banking are layered on top with frame-rate-independent damping.
- **Particles:** all motion runs in vertex shaders (galaxy dust, haze, star shell, planet debris that spirals inward). The CPU only updates a few uniforms per frame.
- **Post:** render → bloom (HDR highlights only) → tone mapping → lens pass (subtle chromatic fringing, zoom blur only while travelling, vignette, grain).
- **Performance:** DPR capped at 2 on desktop and 1.5 on mobile, with lower particle counts and sphere detail on low tiers. Runtime monitoring steps DPR down, then disables bloom, if frames stay slow. Shaders are precompiled behind the loader.
- **Accessibility:** `prefers-reduced-motion` swaps flights for short fades, freezes grain and slows ambient motion. It is watched live. The HUD rail and dossier are keyboard-operable, section changes are announced, and a static project list is shown when WebGL is unavailable.
- **Sound:** off by default. The app only emits cues (`sfx:hover`, `sfx:travel`, …) and `SoundDesign` synthesises them, so you can swap in samples without touching the rest of the app.

In dev, `window.__app` exposes the running app for debugging.

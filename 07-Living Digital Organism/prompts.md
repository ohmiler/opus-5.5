Create an interactive generative digital organism using Three.js.

The entire homepage contains one strange living 3D creature generated from particles, lines, noise and shaders.

It should not resemble a recognizable animal.

Visual inspiration:
- microscopic organisms
- neural networks
- coral
- alien biology
- generative art

Behavior:
- Creature slowly breathes
- Surface pulses organically
- Tentacle-like structures move using noise
- Cursor proximity makes the organism react
- Clicking causes a temporary defensive transformation
- Idle users see the creature slowly evolve over time

Scrolling reveals information about the project while the organism changes form.

Use:
- simplex/perlin noise
- custom shaders
- particle systems
- procedural geometry

Avoid repetitive looping animations.

The organism should feel unpredictable and alive.

Creative direction:
Avoid generic Three.js demo aesthetics.

Prioritize:
- strong art direction
- cinematic camera composition
- typography integrated with the 3D scene
- meaningful micro-interactions
- smooth inertial motion
- unexpected transitions
- responsive interaction feedback
- polished loading sequence
- custom cursor interactions
- subtle sound-ready interaction design
- high visual hierarchy

Do not overload the scene with effects.
Every animation should respond to user behavior or support the narrative.

Use realistic easing and momentum.
Avoid abrupt camera movement.

Architecture:
- Separate scene, camera, renderer and interaction logic
- Reusable components/classes
- Proper resize handling
- Device pixel ratio capped for performance
- Dispose unused geometries/materials/textures
- Graceful mobile fallback
- Respect prefers-reduced-motion
- Include a loading/progress state

The final result should feel like a production-ready interactive experience rather than a technical WebGL demo.
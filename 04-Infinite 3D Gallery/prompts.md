Create an infinite interactive 3D gallery using Three.js.

Concept:
Images and projects exist as floating cards inside an endless 3D space.

Visual direction:
- Black background
- Large floating image planes
- Editorial typography
- Minimal UI
- Strong depth perception
- Subtle fog

Interactions:
- Mouse wheel travels forward/backward through the gallery
- Mouse movement creates parallax
- Cards rotate slightly based on cursor proximity
- Hovering a card causes it to move toward the camera
- Clicking opens the project in a cinematic fullscreen transition
- Dragging allows free exploration of the gallery

Add procedural positioning so cards feel naturally scattered but intentionally composed.

Include approximately 20 placeholder projects.

Focus heavily on smooth camera physics and inertia.

The result should feel like exploring an endless digital art museum.

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
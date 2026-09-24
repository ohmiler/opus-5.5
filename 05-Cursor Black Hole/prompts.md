Create an experimental Three.js website where the mouse cursor behaves like a gravitational black hole.

Scene:
Thousands of small particles float peacefully across the screen.

Interaction:
- Cursor attracts nearby particles
- Particles orbit around the cursor
- Moving quickly causes particles to trail behind
- Clicking creates a temporary gravitational explosion
- Holding mouse creates a stronger gravity field
- Releasing the mouse launches particles outward

Use GPU-friendly particle simulation if possible.

Visual style:
- Near-black background
- White particles
- Occasional subtle blue/purple highlights
- Minimal typography
- Large centered headline

Add website content that appears between particle clusters.

Scrolling should gradually change particle behavior and form different shapes.

Make the physics feel satisfying and responsive rather than purely decorative.

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
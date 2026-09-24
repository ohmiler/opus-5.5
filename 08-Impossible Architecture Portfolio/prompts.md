Create a surreal interactive architecture website using Three.js.

Concept:
A brutalist building exists in an impossible infinite environment inspired by surreal architecture.

Scene:
- Giant concrete structures
- Impossible staircases
- Floating rooms
- Endless corridors
- Strong directional sunlight
- Large dramatic shadows
- Slight atmospheric fog

Portfolio projects appear as posters, screens and installations inside the architecture.

Interactions:
- Scroll moves the camera through the building
- Some rooms rotate while entering them
- Gravity orientation occasionally changes
- Hovering installations reveals project information
- Clicking opens detailed project content
- Mouse movement adds subtle camera parallax

Transitions should create impossible spatial illusions.

Use clever geometry and camera movement rather than extremely complex models.

The experience should feel like exploring a digital architecture exhibition.

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
Build an interactive cyberpunk city website using Three.js.

Instead of normal website navigation, users explore a small futuristic city.

Scene:
- Dark futuristic city
- Neon signs
- Rain particles
- Fog
- Reflective wet streets
- Moving flying vehicles in the distance
- Animated billboards

Navigation:
Each major building represents a website section:
About
Projects
Experience
Contact

Interactions:
- Mouse movement controls camera orientation slightly
- Scroll moves the camera forward through the city
- Hovering buildings highlights their neon signage
- Clicking a building smoothly moves the camera toward it
- Display content using holographic UI panels

Add environmental details:
- animated advertisements
- flickering lights
- steam vents
- occasional drones
- rain hitting surfaces

Keep the city stylized and optimized rather than extremely detailed.

The experience should feel like walking through an interactive futuristic portfolio.

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
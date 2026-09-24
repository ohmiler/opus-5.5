Build a cinematic underwater storytelling website using Three.js.

The user begins at the ocean surface and travels deeper underwater by scrolling.

Progression:

0-20% scroll:
Bright ocean surface
Sun rays
Small fish
Floating particles

20-50%:
Blue deep ocean
Schools of fish
Jellyfish
More atmospheric fog

50-80%:
Very dark deep sea
Bioluminescent creatures
Floating glowing particles

80-100%:
Discover a mysterious glowing underwater structure.

Interactions:
- Scroll controls camera depth
- Mouse movement slightly changes camera direction
- Fish react to cursor proximity
- Jellyfish animate organically
- Bioluminescent objects glow when hovered

Use volumetric-looking light effects and fog.

Add minimal narrative text that fades in at different depths.

The experience should feel like an interactive documentary mixed with a cinematic game intro.

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
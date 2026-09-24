Create an experimental 3D product landing page using Three.js.

Hero object:
A large floating translucent glass/liquid blob in the center of the screen.

Visual style:
- Apple-like minimalism mixed with experimental WebGL
- White/off-white background
- Glass refraction
- Chromatic dispersion
- Soft shadows
- Subtle iridescent materials
- Large editorial typography

Interactions:
- Blob subtly follows mouse movement
- Mouse proximity deforms the liquid surface
- Click creates a ripple traveling across the object
- Scrolling morphs the blob into different shapes
- Text sections transition together with the 3D object
- Add smooth inertia to all interactions

Use shaders to make the material feel physically alive.

The final website should feel like a luxury technology product reveal, not a standard landing page.

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
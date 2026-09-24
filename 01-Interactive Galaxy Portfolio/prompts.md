Build a premium interactive 3D portfolio website using Three.js.

Concept:
The website is a miniature galaxy where each planet represents a portfolio project.

Visual direction:
- Deep black space background
- Thousands of subtle particle stars
- Glowing planets with atmospheric effects
- Cinematic bloom and soft lighting
- Minimal futuristic typography
- Avoid looking like a generic sci-fi template

Interactions:
- Mouse movement creates subtle camera parallax
- Hovering a planet reveals the project name
- Clicking a planet smoothly flies the camera toward it
- Show project information as an elegant HTML overlay
- Mouse wheel moves through different sections of the galaxy
- Add subtle gravitational particle movement around planets

Technical requirements:
- Three.js
- GSAP for smooth camera transitions
- Custom shaders where appropriate
- Responsive desktop/mobile
- Optimize particle count and rendering performance
- Smooth 60fps experience

Create at least 5 visually distinct planets/projects.

The experience should feel like exploring a tiny universe rather than navigating a normal portfolio website.

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
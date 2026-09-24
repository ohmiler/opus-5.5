Build a playful Y2K-inspired interactive 3D desktop website using Three.js.

Imagine a computer operating system from an alternate version of the year 2000.

Scene:
A slightly tilted 3D desktop floating in space.

Objects:
- translucent folders
- chrome icons
- CDs
- floppy disks
- floating windows
- old computer hardware
- pixel UI elements

Visual style:
- chrome
- translucent plastic
- aqua blue
- glossy gradients
- pixel fonts
- early internet aesthetics

Interactions:
- Drag 3D icons around
- Double-click folders to open sections
- Windows can be moved and stacked
- CDs spin when hovered
- Cursor creates sparkly trails
- Clicking certain objects triggers playful animations
- Add hidden easter eggs

Despite the retro aesthetic, animations should feel modern and extremely smooth.

Make it playful enough that users want to explore the interface.

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
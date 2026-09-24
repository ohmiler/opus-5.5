/**
 * The narrative, as data. Each chapter is a form the particles settle into and a camera pose.
 *
 * shape      which target form the simulation pulls toward (see sim/shaders.js)
 * side       where the form sits: 1 = right of the text, -1 = left, 0 = centred
 * lift       vertical offset of the form in world units
 * stiffness  how firmly bodies hold the form (low = loose, drifting)
 * flow       strength of the ambient currents
 * pinch      on entering this chapter, how far the transition collapses through a single point
 */
export const CHAPTERS = [
  {
    name: 'Attraction',
    shape: 0,
    side: 0,
    lift: 0,
    stiffness: 0.55,
    flow: 0.9,
    pinch: 0,
    camera: { position: [0, 0, 12], look: [0, 0, 0], roll: 0 },
  },
  {
    name: 'Orbit',
    shape: 1,
    side: 1,
    lift: 0,
    stiffness: 2.4,
    flow: 0.12,
    pinch: 0.55,
    camera: { position: [-0.6, 1.7, 10.4], look: [0.4, 0.1, 0], roll: -0.05 },
  },
  {
    name: 'Structure',
    shape: 2,
    side: -1,
    lift: 0,
    stiffness: 2.0,
    flow: 0.18,
    pinch: 0.12,
    camera: { position: [0.8, 7.6, 6.8], look: [-0.4, -0.4, 0], roll: 0.08 },
  },
  {
    name: 'Curvature',
    shape: 3,
    side: 1,
    lift: 0,
    stiffness: 3.2,
    flow: 0.04,
    pinch: 0.85,
    camera: { position: [-1.0, 4.6, 9.6], look: [0.6, -1.0, 0], roll: -0.03 },
  },
  {
    name: 'Horizon',
    shape: 4,
    side: 0,
    lift: 1.25,
    stiffness: 2.8,
    flow: 0.08,
    pinch: 0.6,
    camera: { position: [0, 0, 11], look: [0, 0, 0], roll: 0 },
  },
];

/** The last chapter's particles spell this — the headline's answer. */
export const PARTICLE_WORD = 'you';

/** Height of the spacetime fabric (chapter 4) in the form's local space. */
export const FABRIC_Y = -0.8;

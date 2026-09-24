import { FABRIC_Y } from '../config/chapters.js';

/*
 * GPGPU particle physics. Two ping-ponged float textures hold every body's position and velocity;
 * each frame the velocity pass integrates forces and the position pass integrates velocity.
 *
 * Forces, in order of intent:
 *   1. a spring toward the current chapter's form (morphing to the next as you scroll)
 *   2. divergence-free ambient currents + "wind" from scroll velocity
 *   3. the cursor: inverse-square pull, orbital swirl, an event horizon that forms a ring
 *      instead of a singularity, and a wake that drags bodies after fast movement
 *   4. detonations: one-frame radial impulses from clicks and releases
 */

const common = /* glsl */ `
  #define PI 3.14159265
  #define TAU 6.28318531
  #define FABRIC_Y ${FABRIC_Y.toFixed(3)}
`;

export const positionShader = /* glsl */ `
  uniform float uDelta;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 p = texture2D(texturePosition, uv);
    vec3 v = texture2D(textureVelocity, uv).xyz;
    p.xyz += v * uDelta;
    // Never let one bad value poison a body forever.
    if (!(abs(p.x) + abs(p.y) + abs(p.z) < 1e4)) p.xyz = vec3(0.0);
    gl_FragColor = p;
  }
`;

export const velocityShader = /* glsl */ `
  ${common}

  uniform float uTime;
  uniform float uDelta;

  uniform vec3 uPointer;
  uniform vec3 uPointerGround;
  uniform vec3 uPointerVel;
  uniform vec3 uViewDir;
  uniform float uMass;
  uniform float uReach;
  uniform float uHorizon;

  uniform vec4 uBurst;       // xyz centre, w impulse (0 = none this frame)
  uniform vec2 uBurstShape;  // x radius, y spin

  uniform int uShapeA;
  uniform int uShapeB;
  uniform float uBlend;
  uniform float uPinch;
  uniform vec3 uOffsetA;
  uniform vec3 uOffsetB;
  uniform float uScale;

  uniform float uStiffness;
  uniform float uFlow;
  uniform float uDamping;
  uniform float uScrollVel;

  uniform sampler2D tHome;
  uniform sampler2D tRand;
  uniform sampler2D tWord;

  vec3 safeNormalize(vec3 v) {
    float l = length(v);
    return l > 1e-5 ? v / l : vec3(0.0);
  }

  vec3 rotateX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  }

  // Each component depends only on the other two axes, so the field is divergence-free:
  // matter swirls and folds but never bunches up or thins out.
  vec3 flowField(vec3 p, float t) {
    return vec3(
      sin(p.y * 1.10 + t * 0.9) + 0.5 * sin(p.z * 2.30 - t * 0.7),
      sin(p.z * 1.30 + t * 0.6) + 0.5 * sin(p.x * 1.90 + t * 0.8),
      sin(p.x * 0.90 - t * 0.5) + 0.5 * sin(p.y * 2.10 + t * 0.4)
    );
  }

  // 0 — a loose river of matter drifting behind the headline
  vec3 shapeDrift(vec2 uv, vec4 r) {
    vec3 h = texture2D(tHome, uv).xyz;
    return h + vec3(
      sin(uTime * 0.070 + r.x * TAU),
      cos(uTime * 0.050 + r.y * TAU) * 0.7,
      sin(uTime * 0.060 + r.z * TAU)
    ) * 0.8;
  }

  // 1 — accretion disk with a photon ring; inner orbits run faster (Kepler)
  vec3 shapeDisk(vec4 r) {
    if (r.w < 0.09) {
      float a = r.x * TAU + uTime * 0.25;
      float rr = 1.08 + (r.y - 0.5) * 0.06;
      return vec3(cos(a) * rr, sin(a) * rr, -0.1);
    }
    float rad = mix(1.45, 4.8, pow(r.x, 1.7));
    float w = 1.5 / pow(rad, 1.5);
    float a = r.y * TAU + uTime * w;
    float h = (r.z - 0.5) * 0.045 * rad;
    return rotateX(vec3(cos(a) * rad, h, sin(a) * rad), 0.16);
  }

  // 2 — three logarithmic arms around a bulge
  vec3 shapeSpiral(vec4 r) {
    float e = fract(r.w * 7.13 + r.x * 3.7);
    if (r.w < 0.16) {
      vec3 dir = safeNormalize(vec3(r.x - 0.5, (r.y - 0.5) * 0.55, r.z - 0.5));
      return dir * pow(e, 1.8);
    }
    float rad = 0.35 + pow(r.x, 0.85) * 4.9;
    float arm = floor(r.y * 3.0);
    float scatter = (r.z - 0.5) * (0.35 + 0.5 / (1.0 + rad));
    float a = arm * TAU / 3.0 + log(rad) * 2.2 + scatter - uTime * 0.08;
    float y = (e - 0.5) * 0.22 * exp(-rad * 0.35);
    return vec3(cos(a) * rad, y, sin(a) * rad);
  }

  // 3 — the spacetime fabric: a grid of lines (wells are added in world space below)
  vec3 shapeFabric(vec4 r) {
    float lines = 25.0;
    float ext = 6.2;
    float along = (r.x * 2.0 - 1.0) * ext;
    float across = (floor(r.y * lines) / (lines - 1.0) * 2.0 - 1.0) * ext;
    return r.z < 0.5 ? vec3(along, FABRIC_Y, across) : vec3(across, FABRIC_Y, along);
  }

  // 4 — typography sampled from the headline face
  vec3 shapeWord(vec2 uv) {
    vec3 p = texture2D(tWord, uv).xyz;
    p.z += sin(uTime * 0.8 + p.x * 0.9) * 0.06;
    return p;
  }

  vec3 shapeAt(int id, vec2 uv, vec4 r) {
    if (id == 0) return shapeDrift(uv, r);
    if (id == 1) return shapeDisk(r);
    if (id == 2) return shapeSpiral(r);
    if (id == 3) return shapeFabric(r);
    return shapeWord(uv);
  }

  vec3 targetFor(int id, vec2 uv, vec4 r, vec3 offset) {
    vec3 p = shapeAt(id, uv, r);
    // The drift field fills the frame on its own; every other form is composed beside the text.
    if (id != 0) p = p * uScale + offset;
    if (id == 3) {
      vec2 toCore = p.xz - offset.xz;
      vec2 toYou = p.xz - uPointerGround.xz;
      float k2 = dot(toCore, toCore);
      float c2 = dot(toYou, toYou);
      p.y -= 0.9 / (1.0 + k2 * 0.7);              // the resident mass
      p.y -= 0.6 * uMass / (1.0 + c2 * 0.9);        // yours — negative mass lifts it
      p.y += sin(sqrt(k2) * 2.4 - uTime * 1.6) * 0.035;
    }
    return p;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec4 r = texture2D(tRand, uv);
    float dt = uDelta;

    // 1. Form. Bodies leave for the next form at slightly different moments, so morphs feel organic.
    float bl = clamp(uBlend * 1.3 - r.w * 0.3, 0.0, 1.0);
    bl = bl * bl * (3.0 - 2.0 * bl);
    vec3 goal = mix(targetFor(uShapeA, uv, r, uOffsetA), targetFor(uShapeB, uv, r, uOffsetB), bl);
    vec3 core = mix(uOffsetA, uOffsetB, bl);
    goal = mix(goal, core, sin(PI * bl) * uPinch);

    vec3 acc = (goal - pos) * uStiffness * mix(0.55, 1.45, r.z);

    // 2. Currents and scroll wind.
    acc += flowField(pos * 0.35, uTime * 0.3) * uFlow;
    acc.y += uScrollVel * (1.0 + r.x * 2.0);

    // 3. The cursor.
    vec3 d = uPointer - pos;
    float dist = length(d) + 1e-4;
    vec3 dn = d / dist;
    float fall = 1.0 - smoothstep(uReach * 0.35, uReach, dist);
    float g = clamp(uMass * 4.5 / (dist * dist + 0.12), -70.0, 70.0);
    acc += dn * g * fall;
    acc += safeNormalize(cross(uViewDir, dn)) * max(uMass, 0.0) * 2.6 / (dist + 0.35) * fall;
    float inside = 1.0 - smoothstep(0.0, uHorizon, dist);
    acc -= dn * inside * (20.0 + abs(g) * 1.4) * step(0.0, uMass);
    acc += uPointerVel * fall * 1.15;

    vel += acc * dt;

    // 4. Detonation.
    if (uBurst.w > 0.0) {
      vec3 bd = pos - uBurst.xyz;
      float bdist = length(bd) + 1e-4;
      vec3 dirOut = bd / bdist;
      float falloff = exp(-(bdist * bdist) / (uBurstShape.x * uBurstShape.x));
      vec3 swirl = safeNormalize(cross(uViewDir, dirOut));
      vel += (dirOut * (0.6 + 0.8 * r.y) + swirl * uBurstShape.y * 0.25) * uBurst.w * falloff;
    }

    vel *= pow(uDamping, dt * 60.0);
    float speed = length(vel);
    if (speed > 24.0) vel *= 24.0 / speed;
    if (!(speed < 1e5)) vel = vec3(0.0);

    gl_FragColor = vec4(vel, 1.0);
  }
`;

export const pointsVertexShader = /* glsl */ `
  uniform sampler2D tPos;
  uniform sampler2D tVel;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uPointer;

  attribute vec2 ref;

  varying float vSpeed;
  varying float vSeed;
  varying float vGlow;
  varying float vFade;

  void main() {
    vec4 P = texture2D(tPos, ref);
    vec3 v = texture2D(tVel, ref).xyz;
    vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
    gl_Position = projectionMatrix * mv;

    float seed = P.w;
    float rare = pow(fract(seed * 91.7), 12.0);   // a few larger motes give depth cues
    float size = uSize * (0.55 + 0.5 * fract(seed * 13.1) + rare * 1.8);
    float depth = max(-mv.z, 0.001);
    gl_PointSize = max(1.0, size * uPixelRatio / depth);

    vSpeed = length(v);
    vSeed = seed;
    float pd = length(P.xyz - uPointer);
    vGlow = exp(-pd * pd * 1.2);
    vFade = smoothstep(34.0, 7.0, depth) * smoothstep(0.4, 2.0, depth);
  }
`;

export const pointsFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uReveal;

  varying float vSpeed;
  varying float vSeed;
  varying float vGlow;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);

    // White by default. Colour appears only where there's energy — plus a rare few tinted bodies.
    float tinted = step(fract(vSeed * 7.77), 0.045);
    float fast = smoothstep(3.0, 12.0, vSpeed);
    vec3 tint = mix(uColorA, uColorB, fract(vSeed * 3.3));
    vec3 col = mix(vec3(1.0), tint, clamp(tinted * 0.8 + fast * 0.6, 0.0, 0.85));

    float bright = 0.55 + 0.55 * fast + 0.45 * vGlow;
    gl_FragColor = vec4(col * bright, a * uOpacity * vFade * uReveal);
  }
`;

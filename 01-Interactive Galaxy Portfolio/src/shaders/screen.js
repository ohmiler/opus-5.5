/* ----------------------------------------------------------- Scene text -- */
// Monumental typography living in world space behind each planet.
// It reveals with a scanning wipe whose leading edge briefly catches light.
export const textVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const textFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uReveal;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uAccent;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float a = texture2D(uMap, vUv).a;
  float jitter = hash(floor(vUv.y * 28.0)) * 0.06;
  float w = 0.22;
  float p = uReveal * (1.0 + w) - w;
  float x = vUv.x + jitter;
  float mask = 1.0 - smoothstep(p, p + w, x);
  float front = exp(-pow((x - (p + w * 0.5)) / (w * 0.22), 2.0)) * (1.0 - uReveal);
  vec3 col = uColor + uAccent * front * 2.5;
  gl_FragColor = vec4(col, a * uOpacity * (mask + front * 3.0));
}
`

/* ------------------------------------------------------------ Lens pass -- */
// Final composite after tone mapping: subtle chromatic fringing, a zoom-blur
// that only appears while the camera is travelling, vignette, film grain,
// and a fade used by reduced-motion "cuts".
export const lensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uGrain: { value: 0.035 },
    uFade: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uTravel;
    uniform float uGrain;
    uniform float uFade;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uAspect, 1.0));
      float ca = (0.0012 + uTravel * 0.006) * r * r * 4.0;

      vec3 col = vec3(
        texture2D(tDiffuse, vUv - c * ca).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv + c * ca).b
      );

      if (uTravel > 0.002) {
        vec3 acc = col;
        for (int i = 1; i <= 6; i++) {
          acc += texture2D(tDiffuse, vUv - c * uTravel * 0.018 * float(i)).rgb;
        }
        col = mix(col, acc / 7.0, smoothstep(0.1, 0.6, r));
      }

      col *= mix(1.0, smoothstep(1.15, 0.2, r), 0.7);
      col += (hash(vUv * 1000.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

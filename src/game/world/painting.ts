/**
 * The painting's liquid surface: a ShaderMaterial that samples the canvas
 * texture through a concentric radial UV displacement. The ring train is
 * confined to a disc (`uFront`) that grows from the impact point on the way
 * in, and shrinks onto it and then pops on the way out; an attack / decay
 * envelope (`uAmp`) fades it over about 1.1 s.
 *
 * Colour: the canvas texture is tagged sRGB, so sampling returns linear
 * values, and the shader ends with three's colour-space chunk — at rest the
 * painting shows exactly the canvas colours.
 */
import * as THREE from "three";
import { clamp } from "./util";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uCenter;   // impact point in UV space
uniform float uAmp;     // displacement envelope, 0..1
uniform float uPhase;   // ring phase; rising = rings travel outward
uniform float uFront;   // radius of the disc the rings live in
uniform float uPulse;   // brightness flash, 0..1
uniform float uGlow;    // eased focus highlight, 0..1
uniform vec3 uAccent;
varying vec2 vUv;

const float RINGS = 34.0;       // radians of phase per UV unit (≈ 5.4 rings across)
const float STRENGTH = 0.034;   // peak UV displacement

void main() {
  vec2 d = vUv - uCenter;
  float r = length(d);
  vec2 dir = d / max(r, 1e-4);
  float wave = sin(r * RINGS - uPhase);
  float inside = 1.0 - smoothstep(uFront - 0.16, uFront, r);
  float k = uAmp * inside / (1.0 + r * 1.2);

  vec2 uv = clamp(vUv + dir * wave * k * STRENGTH, 0.0, 1.0);
  vec3 col = texture2D(uMap, uv).rgb;

  // crests catch the light, troughs fall into shade
  float crest = pow(max(wave, 0.0), 6.0) * k;
  col *= 1.0 - 0.22 * max(-wave, 0.0) * k;
  col += mix(vec3(1.0), uAccent, 0.35) * crest * 0.6;
  // the leading edge of the ring train is one bright band
  float lip = smoothstep(uFront - 0.1, uFront - 0.03, r) * (1.0 - smoothstep(uFront - 0.03, uFront + 0.02, r));
  col += vec3(1.0, 0.98, 0.9) * lip * uAmp * 0.3;
  // flash centred on the impact point
  col += vec3(1.0) * uPulse * (0.25 + 0.75 * exp(-r * 3.2));

  // focus highlight: a gentle lift plus an accent rim just inside the frame
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  col *= 1.0 + 0.16 * uGlow;
  col += uAccent * (1.0 - smoothstep(0.0, 0.11, edge)) * 0.4 * uGlow;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface PaintingUniforms {
  [uniform: string]: THREE.IUniform;
  uMap: { value: THREE.Texture };
  uCenter: { value: THREE.Vector2 };
  uAmp: { value: number };
  uPhase: { value: number };
  uFront: { value: number };
  uPulse: { value: number };
  uGlow: { value: number };
  uAccent: { value: THREE.Color };
}

export function createPaintingMaterial(map: THREE.Texture, accent: string): THREE.ShaderMaterial {
  const uniforms: PaintingUniforms = {
    uMap: { value: map },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uAmp: { value: 0 },
    uPhase: { value: 0 },
    uFront: { value: 0 },
    uPulse: { value: 0 },
    uGlow: { value: 0 },
    uAccent: { value: new THREE.Color(accent) },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    toneMapped: false,
  });
}

/** Total length of a ripple, seconds. */
const RIPPLE_DURATION = 1.1;
/** On the way out the rings converge for this long, then pop. */
const POP_AT = 0.78;
/** Ring speed, radians of phase per second (≈ 0.65 UV units / s). */
const RING_SPEED = 22;

/**
 * Drives one painting's ripple uniforms. `start()` restarts it; `update()`
 * advances the envelope. No allocation in either.
 */
export class Ripple {
  private t = RIPPLE_DURATION;
  private direction: "in" | "out" = "in";
  /** Extra brightness the halo behind the frame borrows from the ripple. */
  flash = 0;

  constructor(
    private readonly u: PaintingUniforms,
    private readonly reducedMotion: boolean,
  ) {}

  get active(): boolean {
    return this.t < RIPPLE_DURATION;
  }

  start(direction: "in" | "out", u = 0.5, v = 0.5): void {
    this.direction = direction;
    this.t = 0;
    this.u.uCenter.value.set(clamp(u, 0, 1), clamp(v, 0, 1));
    this.apply();
  }

  update(dt: number): void {
    if (this.t >= RIPPLE_DURATION) return;
    this.t = Math.min(RIPPLE_DURATION, this.t + dt);
    this.apply();
  }

  private apply(): void {
    const t = this.t;
    const u = this.u;
    let amp = 0;
    let front = 0;
    let phase = 0;
    let pulse = 0;
    if (t < RIPPLE_DURATION) {
      if (this.direction === "in") {
        // sharp attack on impact, long decay; rings spread from the impact point
        const attack = 0.09;
        amp = t < attack ? t / attack : Math.pow(1 - (t - attack) / (RIPPLE_DURATION - attack), 1.6);
        front = 0.06 + t * 1.7;
        phase = t * RING_SPEED;
        pulse = 0.3 * Math.exp(-t * 9);
      } else if (t < POP_AT) {
        // rings run inward and tighten onto the exit point, swelling as they go
        const k = t / POP_AT;
        amp = 0.12 * k + 0.88 * k * k;
        front = 1.35 - 1.25 * k;
        phase = -t * RING_SPEED;
        pulse = 0.12 * k * k * k;
      } else {
        // pop: one fast ring thrown back out, and a flash
        const k = (t - POP_AT) / (RIPPLE_DURATION - POP_AT);
        amp = (1 - k) * (1 - k);
        front = 0.1 + k * 1.6;
        phase = -POP_AT * RING_SPEED + (t - POP_AT) * RING_SPEED * 2.2;
        pulse = 0.85 * (1 - k) * (1 - k);
      }
      if (this.reducedMotion) {
        // no displacement at all: a soft brightness swell instead
        amp = 0;
        pulse = 0.3 * Math.sin((Math.PI * t) / RIPPLE_DURATION);
      }
    }
    u.uAmp.value = amp;
    u.uFront.value = front;
    u.uPhase.value = phase;
    u.uPulse.value = pulse;
    this.flash = Math.max(pulse, amp * 0.5);
  }
}

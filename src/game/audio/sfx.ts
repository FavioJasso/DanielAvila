/**
 * The sound effects — every one an original recipe built from a handful of
 * `voice()` calls (simple waves, filtered noise, envelopes, pitch sweeps).
 * Nothing here is sampled from, or modelled on, another game's sounds.
 *
 * Levels are tuned so a single effect peaks around 0.3–0.6 before the mixer;
 * see the offline test in /dev/audio for the measured numbers.
 */
import type { SfxName } from "../contract";
import { hz, voice, type Bus, type Mixer } from "./synth";

/** `x` is a 0..1 pseudo-random number for recipes that want variation. */
type Recipe = (b: Bus, x: number) => void;

/** A struck bell: sine body with a short triangle "ping" an octave up. */
function bell(b: Bus, midi: number, at: number, d: number, v: number): void {
  voice(b, { w: "sine", f: hz(midi), at, d, v });
  voice(b, { w: "triangle", f: hz(midi + 12), at, d: d * 0.4, v: v * 0.3 });
}

/** A soft brass-like stab: low-passed saw with a slower attack. */
function brass(b: Bus, midi: number, at: number, d: number, v: number, vib = 0): void {
  voice(b, {
    w: "sawtooth", f: hz(midi), at, d, v, a: 0.025, s: 0.8, r: 0.07, vib, vr: 5.5,
    flt: ["lowpass", 2600, 1700, 0.9],
  });
}

/** Three pulse blips; `pause` plays them falling, `unpause` rising. */
function blips(b: Bus, notes: readonly number[]): void {
  notes.forEach((m, i) => {
    const last = i === notes.length - 1;
    voice(b, { w: "pulse", f: hz(m), at: i * 0.075, d: last ? 0.24 : 0.1, v: 0.13 });
    voice(b, { w: "triangle", f: hz(m - 12), at: i * 0.075, d: last ? 0.2 : 0.09, v: 0.2 });
  });
}

/** The painting warp: two gliding tones with a warble that changes speed. */
function warp(b: Bus, up: boolean): void {
  const lo = 196;
  const hi = 1175;
  const from = up ? lo : hi;
  const to = up ? hi : lo;
  // Rising: swells in and speeds up. Falling: starts bright and winds down.
  const a = up ? 0.28 : 0.04;
  const r = up ? 0.28 : 0.5;
  const v1 = up ? 7 : 17;
  const v2 = up ? 17 : 7;
  voice(b, { w: "sine", f: from, to, d: 0.95, v: 0.3, a, s: 0.9, r, vib: 75, vr: v1, vr2: v2 });
  voice(b, {
    w: "triangle", f: from * 1.5, to: to * 1.5, d: 0.95, v: 0.14, a, s: 0.9, r,
    vib: 95, vr: v1 + 2.5, vr2: v2 + 2.5, am: [11, 0.6],
  });
  voice(b, {
    w: "noise", d: 0.92, v: 0.1, a, s: 0.9, r,
    flt: ["bandpass", up ? 700 : 5200, up ? 5200 : 700, 6],
  });
}

const RECIPES: Record<SfxName, readonly [echo: boolean, make: Recipe]> = {
  /** PRESS START: a rising run that lands on a ringing open fifth. */
  start: [true, (b) => {
    [69, 76, 81, 85].forEach((m, i) => bell(b, m, i * 0.07, 0.26, 0.3));
    bell(b, 88, 0.28, 0.75, 0.26);
    voice(b, { w: "triangle", f: hz(81), at: 0.28, d: 0.7, v: 0.2, vib: 9, vr: 7 });
  }],

  /** Cursor tick: one tiny upward chirp. */
  uiMove: [false, (b) => {
    voice(b, { w: "triangle", f: 880, to: 1180, d: 0.06, v: 0.34 });
  }],

  /** Confirm: two notes up a fifth. */
  uiSelect: [false, (b) => {
    voice(b, { w: "triangle", f: hz(81), d: 0.09, v: 0.32 });
    voice(b, { w: "triangle", f: hz(88), at: 0.07, d: 0.17, v: 0.32 });
    voice(b, { w: "pulse", f: hz(88), at: 0.07, d: 0.1, v: 0.05 });
  }],

  /** Cancel: two notes down a fifth. */
  uiBack: [false, (b) => {
    voice(b, { w: "triangle", f: hz(79), d: 0.09, v: 0.32 });
    voice(b, { w: "triangle", f: hz(72), at: 0.07, d: 0.17, v: 0.32 });
  }],

  pause: [true, (b) => blips(b, [88, 83, 76])],
  unpause: [true, (b) => blips(b, [76, 83, 88])],

  /**
   * Wooden creak: a low saw is a train of clicks (the stick-slip of a dry
   * hinge). Narrow band-passes ring on every click like the wood of the
   * door, so the clicks blur into a rough, pitched groan; a slow wobble on
   * top of an upward drift makes it waver as the door swings.
   */
  doorOpen: [false, (b) => {
    voice(b, { w: "sine", f: 150, to: 78, d: 0.07, v: 0.3 });
    voice(b, { w: "noise", d: 0.03, v: 0.2, flt: ["bandpass", 1800, 900, 1] });
    const creak = { w: "sawtooth", at: 0.05, d: 0.74, s: 0.85, r: 0.3, vib: 240, vr: 3.1 } as const;
    voice(b, { ...creak, f: 52, to: 98, v: 2.6, a: 0.08, flt: ["bandpass", 540, 860, 11] });
    voice(b, { ...creak, f: 52.6, to: 99, v: 2.2, a: 0.12, flt: ["bandpass", 1450, 2150, 13] });
    voice(b, { ...creak, f: 51.5, to: 97, v: 1.2, a: 0.16, flt: ["bandpass", 2900, 3500, 14] });
    voice(b, {
      w: "noise", at: 0.05, d: 0.68, v: 0.05, a: 0.12, s: 0.7, r: 0.3,
      flt: ["bandpass", 1300, 2100, 3], am: [31, 0.9, "square"], off: 0.2,
    });
  }],

  /** Soft thud with a little woody knock on top. */
  doorClose: [false, (b) => {
    voice(b, { w: "sine", f: 118, to: 46, d: 0.19, v: 0.4 });
    voice(b, { w: "triangle", f: 250, to: 120, d: 0.06, v: 0.24 });
    voice(b, { w: "noise", d: 0.06, v: 0.3, flt: ["lowpass", 900, 220] });
  }],

  /** Footstep: a tiny low tap. Pitch drifts ±8 % from step to step. */
  step: [false, (b, x) => {
    b.rate *= 0.92 + x * 0.16;
    voice(b, { w: "noise", d: 0.035, v: 0.2, flt: ["bandpass", 950, 520, 1.2], off: x });
    voice(b, { w: "sine", f: 172, to: 96, d: 0.045, v: 0.2 });
  }],

  /** Hop: a rounded upward swoop with a breath of air. */
  jump: [false, (b) => {
    voice(b, { w: "triangle", f: 300, to: 650, d: 0.17, v: 0.38, a: 0.008 });
    voice(b, { w: "sine", f: 600, to: 1300, d: 0.12, v: 0.09 });
    voice(b, { w: "noise", d: 0.1, v: 0.07, flt: ["highpass", 2500, 6000] });
  }],

  /** Landing: a short padded thump. */
  land: [false, (b) => {
    voice(b, { w: "sine", f: 172, to: 62, d: 0.11, v: 0.4 });
    voice(b, { w: "noise", d: 0.05, v: 0.26, flt: ["lowpass", 1600, 420] });
  }],

  /** Dive: a whoosh of air that rises, then falls away. */
  dive: [false, (b) => {
    voice(b, { w: "noise", d: 0.24, v: 0.95, a: 0.1, flt: ["bandpass", 480, 2600, 2.2] });
    voice(b, { w: "noise", at: 0.14, d: 0.3, v: 0.9, a: 0.08, flt: ["bandpass", 2600, 420, 2.2], off: 0.37 });
    voice(b, { w: "triangle", f: 820, to: 300, at: 0.05, d: 0.32, v: 0.2, a: 0.04 });
  }],

  warpIn: [true, (b) => warp(b, true)],
  warpOut: [true, (b) => warp(b, false)],

  /** New star: a quick climbing sparkle that hangs in the air. */
  starGet: [true, (b) => {
    [76, 80, 83, 88, 92, 95, 100].forEach((m, i) => bell(b, m, i * 0.055, 0.3, 0.25));
    voice(b, { w: "sine", f: hz(100), at: 0.42, d: 0.6, v: 0.19, vib: 12, vr: 9 });
    voice(b, { w: "sine", f: hz(95), at: 0.42, d: 0.6, v: 0.15 });
  }],

  /** Pedestal fanfare: stepping thirds up to a held chord. */
  starPose: [true, (b) => {
    const steps: readonly (readonly [at: number, d: number, lo: number, hi: number])[] = [
      [0, 0.13, 74, 78],
      [0.15, 0.13, 78, 81],
      [0.3, 0.2, 81, 86],
      [0.52, 0.13, 79, 83],
      [0.67, 0.13, 81, 85],
    ];
    for (const [at, d, lo, hi] of steps) {
      brass(b, lo, at, d, 0.2);
      brass(b, hi, at, d, 0.2);
    }
    brass(b, 81, 0.82, 0.75, 0.15, 10);
    brass(b, 86, 0.82, 0.75, 0.17, 10);
    brass(b, 90, 0.82, 0.75, 0.17, 10);
    voice(b, { w: "triangle", f: hz(50), d: 0.46, v: 0.2, s: 0.8, r: 0.05 });
    voice(b, { w: "triangle", f: hz(55), at: 0.52, d: 0.13, v: 0.2, s: 0.8 });
    voice(b, { w: "triangle", f: hz(57), at: 0.67, d: 0.13, v: 0.2, s: 0.8 });
    voice(b, { w: "triangle", f: hz(50), at: 0.82, d: 0.75, v: 0.22, s: 0.8, r: 0.2 });
    voice(b, { w: "noise", at: 0.82, d: 0.5, v: 0.07, flt: ["highpass", 6000] });
  }],

  /** Snore: a low raspy breath in, then a soft sigh out. */
  snore: [false, (b) => {
    voice(b, {
      w: "sawtooth", f: 52, to: 66, d: 0.78, v: 0.32, a: 0.3, s: 0.9, r: 0.3,
      vib: 60, vr: 3, flt: ["lowpass", 320, 520, 2], am: [24, 0.8, "square"],
    });
    voice(b, {
      w: "noise", d: 0.78, v: 0.08, a: 0.35, s: 0.8, r: 0.3,
      flt: ["bandpass", 500, 900, 1.5], am: [24, 0.9, "square"],
    });
    voice(b, {
      w: "noise", at: 0.88, d: 0.7, v: 0.12, a: 0.2, s: 0.7, r: 0.4,
      flt: ["bandpass", 1300, 800, 3], off: 0.5,
    });
    voice(b, { w: "sine", f: 420, to: 300, at: 0.92, d: 0.55, v: 0.04, a: 0.2, s: 0.8, r: 0.3 });
  }],
};

export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

/**
 * Schedule one effect at context time `when`. Returns the time its last
 * voice ends (echo tails ring a little longer).
 */
export function triggerSfx(
  mix: Mixer,
  name: SfxName,
  when: number,
  volume = 1,
  rate = 1,
  x = 0,
): number {
  const [echo, make] = RECIPES[name];
  const ctx = mix.ctx;
  let out: AudioNode = echo ? mix.sfxEcho : mix.sfx;
  if (volume !== 1) {
    const g = ctx.createGain();
    g.gain.value = volume;
    g.connect(out);
    out = g;
  }
  const bus: Bus = { ctx, out, t0: when, rate, end: when };
  make(bus, x);
  return bus.end;
}

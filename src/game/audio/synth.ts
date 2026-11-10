/**
 * Synthesis primitives shared by the effects and the music.
 *
 * Everything here takes a `BaseAudioContext`, so the exact same code renders
 * live through an `AudioContext` and, for tests, through an
 * `OfflineAudioContext`. No audio files, no dependencies, no three.js — this
 * module ships in the first-paint bundle.
 */

/** Oscillator shapes, plus a 25 % pulse and looping white noise. */
export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "pulse" | "noise";

/**
 * Where a group of voices is sent and when it starts. `rate` is a playback
 * rate: it multiplies every pitch and divides every time, like speeding up a
 * sample would. `end` is written back by `voice()` so callers learn how long
 * the sound they just scheduled is.
 */
export interface Bus {
  readonly ctx: BaseAudioContext;
  out: AudioNode;
  /** Context time of the sound's origin. */
  t0: number;
  rate: number;
  /** Latest scheduled end time so far (output). */
  end: number;
}

/** One oscillator or noise burst with an envelope and optional modulation. */
export interface VoiceSpec {
  /** Waveform (default triangle). */
  w?: Wave;
  /** Frequency in Hz at the start. Ignored for noise. */
  f?: number;
  /** Frequency in Hz at the end (exponential glide). */
  to?: number;
  /** Start offset in seconds from the bus origin. */
  at?: number;
  /** Length in seconds. */
  d: number;
  /** Peak gain. */
  v: number;
  /** Attack in seconds (default 4 ms — just enough to avoid a click). */
  a?: number;
  /**
   * Sustain level 0..1. Omitted = percussive: the voice decays exponentially
   * across its whole length, like a plucked or struck sound.
   */
  s?: number;
  /** Release in seconds, sustained voices only (default 30 ms). */
  r?: number;
  /** Vibrato depth in cents; eases in over the first part of the note. */
  vib?: number;
  /** Vibrato rate in Hz at the start (default 6) … */
  vr?: number;
  /** … and at the end, for a warble that speeds up or slows down. */
  vr2?: number;
  /** Filter: type, cutoff Hz at the start, cutoff at the end, Q. */
  flt?: readonly [BiquadFilterType, number, number?, number?];
  /** Amplitude modulation: rate Hz, depth 0..1, LFO shape (default sine). */
  am?: readonly [number, number, OscillatorType?];
  /** Noise only: where in the noise buffer to start, 0..1. */
  off?: number;
}

/** MIDI note number → Hz. */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
const pulseCache = new WeakMap<BaseAudioContext, PeriodicWave>();

/** One second of white noise from a fixed-seed generator (deterministic). */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const n = Math.floor(ctx.sampleRate);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let s = 0x2f6e2b1;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      data[i] = s / 2147483648;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Band-limited 25 % pulse: brighter and thinner than a square. */
function pulseWave(ctx: BaseAudioContext): PeriodicWave {
  let wave = pulseCache.get(ctx);
  if (!wave) {
    const n = 24;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = Math.sin(k * Math.PI * 0.25) / k;
    wave = ctx.createPeriodicWave(real, imag);
    pulseCache.set(ctx, wave);
  }
  return wave;
}

/**
 * Schedule one voice on a bus. Every node it creates is released when it ends.
 *
 * Start values are written to `param.value` rather than left to a
 * `setValueAtTime` at the start time: Chrome reads a parameter's values for
 * the render block in which an oscillator starts from the top of that block,
 * so an event placed exactly at the start would let the first couple of
 * milliseconds sound at the default 440 Hz.
 */
export function voice(bus: Bus, p: VoiceSpec): void {
  const { ctx, rate } = bus;
  const t = bus.t0 + (p.at ?? 0) / rate;
  const d = p.d / rate;
  const end = t + d;
  // The source is held a hair past the envelope's end so the final ramp to
  // zero always completes before it stops.
  const off = end + 0.03;

  let src: AudioScheduledSourceNode;
  if (p.w === "noise") {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx);
    n.loop = true;
    n.playbackRate.value = rate;
    n.start(t, (p.off ?? 0) % 1);
    src = n;
  } else {
    const o = ctx.createOscillator();
    if (p.w === "pulse") o.setPeriodicWave(pulseWave(ctx));
    else o.type = p.w ?? "triangle";
    const f = (p.f ?? 440) * rate;
    o.frequency.value = f;
    if (p.to) {
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(p.to * rate, end);
    }
    if (p.vib) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      const vr = p.vr ?? 6;
      lfo.frequency.value = vr;
      if (p.vr2) {
        lfo.frequency.setValueAtTime(vr, t);
        lfo.frequency.linearRampToValueAtTime(p.vr2, end);
      }
      depth.gain.value = 0;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(p.vib, t + Math.min(0.18, d * 0.4));
      lfo.connect(depth);
      depth.connect(o.detune);
      lfo.start(t);
      lfo.stop(off);
    }
    o.start(t);
    src = o;
  }
  src.stop(off);

  let node: AudioNode = src;
  if (p.flt) {
    const [type, from, to, q] = p.flt;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q ?? 0.7;
    const cutoff = Math.min(18000, from * rate);
    flt.frequency.value = cutoff;
    if (to) {
      flt.frequency.setValueAtTime(cutoff, t);
      flt.frequency.exponentialRampToValueAtTime(Math.min(18000, to * rate), end);
    }
    node.connect(flt);
    node = flt;
  }
  if (p.am) {
    // gain = (1 - depth/2) ± depth/2, i.e. it swings between 1 - depth and 1.
    const [amRate, amDepth, shape] = p.am;
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    trem.gain.value = 1 - amDepth / 2;
    depth.gain.value = amDepth / 2;
    lfo.type = shape ?? "sine";
    lfo.frequency.value = amRate * rate;
    lfo.connect(depth);
    depth.connect(trem.gain);
    lfo.start(t);
    lfo.stop(off);
    node.connect(trem);
    node = trem;
  }

  const env = ctx.createGain();
  const g = env.gain;
  const a = Math.min(p.a ?? 0.004, d * 0.5);
  g.value = 0;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(p.v, t + a);
  if (p.s === undefined) {
    g.exponentialRampToValueAtTime(p.v * 0.002, end);
    g.linearRampToValueAtTime(0, end + 0.015);
  } else {
    const r = Math.min(p.r ?? 0.03, (d - a) * 0.5);
    const hold = end - r;
    g.linearRampToValueAtTime(p.v * p.s, Math.min(t + a + 0.06, hold));
    g.setValueAtTime(p.v * p.s, hold);
    g.linearRampToValueAtTime(0, end);
  }
  node.connect(env);
  env.connect(bus.out);
  // Detach the finished chain from the long-lived bus so it can be collected
  // even by engines that keep connected nodes alive.
  src.onended = () => env.disconnect();

  if (end > bus.end) bus.end = end;
}

/* ------------------------------------------------------------------ */
/* Mix                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Final output level. Mute ramps this gain to zero. The limiter's output can
 * never exceed 1 (its curve flattens just below it), so the loudest possible
 * pile-up leaves the speakers at about 0.85: clipping cannot happen at all,
 * while ordinary effects and music sit at a level that is clearly audible on
 * laptop and phone speakers (0.5 left the music near -31 dBFS RMS).
 */
export const MASTER_GAIN = 0.85;
const SFX_GAIN = 1.2;
/** Music sits well under the effects. */
const MUSIC_GAIN = 0.26;

/** Below this level the limiter is a straight wire. */
const KNEE = 0.5;
/** Input level mapped to the ends of the limiter curve. */
const LIMIT_RANGE = 2;

/**
 * Soft limiter curve: unity gain up to the knee, then a tanh shoulder that
 * approaches (never reaches) full scale. A wave-shaper rather than a
 * DynamicsCompressorNode on purpose: it has no state, so there is no look-
 * ahead latency and no start-up dip swallowing the first sound after
 * unlock(), and it behaves identically in every browser and offline.
 */
function limiterCurve() {
  const n = 2049;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * LIMIT_RANGE;
    const a = Math.abs(x);
    const y = a <= KNEE ? a : KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE));
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

export interface Mixer {
  readonly ctx: BaseAudioContext;
  /** Dry effects. */
  readonly sfx: GainNode;
  /** Effects that also feed the shared echo. */
  readonly sfxEcho: GainNode;
  readonly music: GainNode;
  /** Sum of both buses, before the limiter — tapped by the offline tests. */
  readonly pre: GainNode;
  /** After the limiter; the mute ramp lives here. */
  readonly master: GainNode;
}

/**
 *   sfx ──┐
 *   music ┴→ pre → soft limiter → master (0.5 / mute) → dest
 *
 *   sfxEcho → sfx, and → delay ⟲ feedback → sfx
 */
export function createMixer(ctx: BaseAudioContext, dest: AudioNode, muted = false): Mixer {
  const gain = (value: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  };
  const pre = gain(1);
  // The shaper only reads inputs in -1..1, so scale the range it should
  // cover down into that window; the curve is defined in pre-scale units.
  const drive = gain(1 / LIMIT_RANGE);
  const limiter = ctx.createWaveShaper();
  limiter.curve = limiterCurve();
  const master = gain(muted ? 0 : MASTER_GAIN);
  pre.connect(drive);
  drive.connect(limiter);
  limiter.connect(master);
  master.connect(dest);

  const sfx = gain(SFX_GAIN);
  const music = gain(MUSIC_GAIN);
  sfx.connect(pre);
  music.connect(pre);

  const sfxEcho = gain(1);
  const send = gain(0.3);
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.17;
  const feedback = gain(0.3);
  sfxEcho.connect(sfx);
  sfxEcho.connect(send);
  send.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(sfx);

  return { ctx, sfx, sfxEcho, music, pre, master };
}

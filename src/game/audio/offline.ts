/**
 * Offline rendering for tests and the dev harness. Audio cannot be heard in
 * a headless browser, so the same mixer, recipes and sequencer that run live
 * are rendered into an `OfflineAudioContext` and the samples are inspected.
 *
 * Not imported by the game — only by /dev/audio — so it adds nothing to the
 * first-paint bundle.
 */
import type { MusicTrack, SfxName } from "../contract";
import { createPlayer } from "./music";
import { triggerSfx } from "./sfx";
import { createMixer, type Mixer } from "./synth";

export const OFFLINE_RATE = 44100;
/** Everything is scheduled this far into the render, as it is live. */
export const LEAD_IN = 0.02;

export interface Rendered {
  sampleRate: number;
  /** What reaches the speakers: after the limiter and the master gain. */
  out: Float32Array;
  /** The same moment before the limiter — shows how hard it is being hit. */
  pre: Float32Array;
}

type OfflineCtor = new (channels: number, length: number, rate: number) => OfflineAudioContext;

/**
 * Render `seconds` of audio. `build` receives a mixer wired exactly like the
 * live one and schedules whatever it wants on it. `sampleRate` can be chosen
 * so that a musical step is a whole number of samples, which makes one pass
 * of a loop directly comparable with the next.
 */
export async function renderOffline(
  seconds: number,
  build: (mix: Mixer) => void,
  sampleRate = OFFLINE_RATE,
): Promise<Rendered> {
  const w = window as unknown as {
    OfflineAudioContext?: OfflineCtor;
    webkitOfflineAudioContext?: OfflineCtor;
  };
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error("OfflineAudioContext is not available");
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  // Channel 0 = final output, channel 1 = pre-limiter tap.
  const merger = ctx.createChannelMerger(2);
  merger.connect(ctx.destination);
  const mix = createMixer(ctx, merger);
  mix.pre.connect(merger, 0, 1);
  build(mix);
  const buf = await ctx.startRendering();
  return {
    sampleRate: buf.sampleRate,
    out: buf.getChannelData(0),
    pre: buf.getChannelData(1),
  };
}

export interface RenderedSfx extends Rendered {
  /** Scheduled length of the effect in seconds (echo tails ring longer). */
  nominal: number;
}

export async function renderSfx(
  name: SfxName,
  opts: { volume?: number; rate?: number; seconds?: number } = {},
): Promise<RenderedSfx> {
  let nominal = 0;
  const r = await renderOffline(opts.seconds ?? 3, (mix) => {
    nominal = triggerSfx(mix, name, LEAD_IN, opts.volume ?? 1, opts.rate ?? 1, 0.5) - LEAD_IN;
  });
  return { ...r, nominal };
}

/** Render a track from its first step, with its normal fade-in. */
export function renderMusic(track: MusicTrack, seconds: number): Promise<Rendered> {
  return renderOffline(seconds, (mix) => {
    const player = createPlayer(mix, track, LEAD_IN);
    player.fade(true, 0);
    player.schedule(seconds);
  });
}

export interface Stats {
  peak: number;
  rms: number;
}

/** Peak and RMS of `samples[from, to)`. */
export function stats(samples: Float32Array, from = 0, to = samples.length): Stats {
  let peak = 0;
  let sum = 0;
  const end = Math.min(to, samples.length);
  for (let i = from; i < end; i++) {
    const v = samples[i];
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sum += v * v;
  }
  const n = Math.max(1, end - from);
  return { peak, rms: Math.sqrt(sum / n) };
}

/** Index just past the last sample louder than `floor` (0 if none). */
export function activeLength(samples: Float32Array, floor = 0.001): number {
  for (let i = samples.length - 1; i >= 0; i--) {
    const v = samples[i];
    if (v > floor || v < -floor) return i + 1;
  }
  return 0;
}

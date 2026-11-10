/**
 * Scripted checks for the audio engine (dev harness only).
 *
 * - `runAudioTest`      every effect and 8 s of every track, rendered offline
 *                       and measured: duration, peak, RMS, silent, clipping.
 * - `runMixTest`        loop length and seamlessness, play() options, a
 *                       worst-case pile-up, cross-fade timing, music vs effects.
 * - `runLifecycleTest`  the live engine called in awkward orders.
 * - `runLiveTest`       a track played live across its loop seam, captured
 *                       from the real output and compared with the offline
 *                       render — proves the look-ahead scheduler drops,
 *                       delays and doubles nothing.
 */
import type { MusicTrack, SfxName } from "@/game/contract";
import { createAudioEngine, type AudioEngineDev, type AudioInspect } from "@/game/audio";
import { createPlayer, trackInfo, type TrackInfo } from "@/game/audio/music";
import {
  activeLength,
  LEAD_IN,
  renderMusic,
  renderOffline,
  renderSfx,
  stats,
} from "@/game/audio/offline";
import { SFX_NAMES, triggerSfx } from "@/game/audio/sfx";
import { centroidHz, dominantHz } from "./analysis";

export const TRACK_NAMES: MusicTrack[] = ["title", "lobby", "course"];
const MUSIC_SECONDS = 8;
/** At or above this the output is treated as clipping. */
const CLIP = 0.98;

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const db = (ratio: number): number => round(20 * Math.log10(Math.max(ratio, 1e-12)), 1);

export interface AudioTestRow {
  name: string;
  kind: "sfx" | "music";
  /**
   * Seconds of sound. Effects: until the tail (echo included) has dropped
   * below −60 dBFS for good. Music: the rendered length.
   */
  duration: number;
  /** Effects: scheduled length without the echo tail. Music: loop length. */
  nominal: number;
  /** Peak of the final output (after the limiter and master gain). */
  peak: number;
  /** RMS of the final output over the nominal length. */
  rms: number;
  /** Peak before the limiter — under 1 means it would not clip without it. */
  prePeak: number;
  silent: boolean;
  clipping: boolean;
  /** Strongest frequency 20 % and 80 % of the way through. */
  startHz: number;
  endHz: number;
  /** Spectral centroid at the same two points (brightness of noisy sounds). */
  startBright: number;
  endBright: number;
}

/** Samples kept for drawing. */
export interface Capture {
  samples: Float32Array;
  sampleRate: number;
  /** Samples worth drawing. */
  length: number;
}

function measure(
  name: string,
  kind: "sfx" | "music",
  out: Float32Array,
  pre: Float32Array,
  sampleRate: number,
  nominal: number,
  span: number,
): AudioTestRow {
  const from = Math.floor(LEAD_IN * sampleRate);
  const to = Math.min(out.length, Math.ceil((LEAD_IN + span) * sampleRate));
  const all = stats(out);
  const body = stats(out, from, to);
  const at = (frac: number): number => LEAD_IN + span * frac;
  return {
    name,
    kind,
    duration: round(kind === "music" ? out.length / sampleRate : activeLength(out) / sampleRate, 3),
    nominal: round(nominal, 3),
    peak: round(all.peak),
    rms: round(body.rms),
    prePeak: round(stats(pre).peak),
    silent: body.rms < 0.005 || all.peak < 0.02,
    clipping: all.peak >= CLIP,
    startHz: Math.round(dominantHz(out, sampleRate, at(0.2))),
    endHz: Math.round(dominantHz(out, sampleRate, at(0.8))),
    startBright: Math.round(centroidHz(out, sampleRate, at(0.2))),
    endBright: Math.round(centroidHz(out, sampleRate, at(0.8))),
  };
}

export async function runAudioTest(captures?: Map<string, Capture>): Promise<AudioTestRow[]> {
  const rows: AudioTestRow[] = [];
  for (const name of SFX_NAMES) {
    const r = await renderSfx(name);
    const row = measure(name, "sfx", r.out, r.pre, r.sampleRate, r.nominal, r.nominal);
    rows.push(row);
    captures?.set(name, {
      samples: r.out,
      sampleRate: r.sampleRate,
      length: Math.ceil(Math.max(row.duration, r.nominal + LEAD_IN) * r.sampleRate),
    });
  }
  for (const name of TRACK_NAMES) {
    const r = await renderMusic(name, MUSIC_SECONDS);
    rows.push(
      measure(name, "music", r.out, r.pre, r.sampleRate, trackInfo(name).loopSeconds, MUSIC_SECONDS - LEAD_IN),
    );
    captures?.set(name, { samples: r.out, sampleRate: r.sampleRate, length: r.out.length });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Mix test                                                            */
/* ------------------------------------------------------------------ */

export interface LoopReport extends TrackInfo {
  name: MusicTrack;
  /** Every voice was written to exactly the loop's length. */
  voicesMatch: boolean;
  /** Third pass minus second pass, relative to the pass itself (dB). −∞ ≈ identical. */
  repeatErrorDb: number;
  /** The same comparison one bar short — must be large, or the period is wrong. */
  offByOneBarDb: number;
  /** RMS in the half second around the seam, relative to the whole loop (dB). */
  seamLevelDb: number;
  /** Largest sample-to-sample jump within 50 ms of the seam vs. anywhere in the loop. */
  seamJump: number;
  loopJump: number;
  pass: boolean;
}

export interface MixReport {
  loops: LoopReport[];
  options: {
    /** Pre-limiter peak at volume 0.5 over volume 1 (expect 0.5). */
    halfVolumeRatio: number;
    /** Scheduled length at rate 2 over rate 1 (expect 0.5). */
    doubleRateLength: number;
    /** Pitch at rate 2 over rate 1 (expect 2). */
    doubleRatePitch: number;
    /** Length of the slowest step variation over the fastest (expect ≈ 1.17). */
    stepSpread: number;
    pass: boolean;
  };
  /** Lobby music with seven effects landing inside one second. */
  pileUp: { peak: number; prePeak: number; clipping: boolean };
  crossfade: {
    /** Gain of the outgoing track 0.1 / 0.2 / 0.4 / 0.8 s into the fade. */
    out: number[];
    /** Gain of the incoming track at the same times. */
    in: number[];
    /** Output peak during a lobby → title cross-fade, and around it. */
    peakDuring: number;
    peakAround: number;
    pass: boolean;
  };
  levels: {
    musicRmsDb: number;
    sfxRmsDb: number;
    /** Effects minus music (dB): positive = music is quieter. */
    sfxOverMusicDb: number;
    pass: boolean;
  };
}

/**
 * Sample rates at which each track's step is a whole number of samples and
 * its loop a whole number of 128-frame render blocks, so every pass of the
 * loop meets the renderer in exactly the same position and a perfect repeat
 * shows up as (near) zero difference.
 */
const LOOP_RATE: Record<MusicTrack, number> = { title: 44000, lobby: 44096, course: 44128 };

async function loopReport(name: MusicTrack): Promise<LoopReport> {
  const info = trackInfo(name);
  const rate = LOOP_RATE[name];
  const seconds = info.loopSeconds * 3 + LEAD_IN;
  const lead = Math.round(LEAD_IN * rate);
  const r = await renderOffline(
    seconds,
    (mix) => {
      // Start half a sample off the grid: every note then lands mid-sample,
      // so float rounding can never tip one pass's noise burst onto the
      // neighbouring frame and spoil the comparison.
      const p = createPlayer(mix, name, (lead + 0.5) / rate);
      p.fade(true, 0);
      p.schedule(seconds);
    },
    rate,
  );
  // Compare before the limiter, where a repeat should be bit-for-bit close.
  const x = r.pre;
  const loop = Math.round(info.loopSeconds * rate);
  const bar = loop / info.bars;
  const second = lead + loop;
  const third = lead + loop * 2;
  let err = 0;
  let wrong = 0;
  let energy = 0;
  for (let i = 0; i < loop; i++) {
    const a = x[second + i];
    const d = x[third + i] - a;
    const w = x[third + i - bar] - a;
    err += d * d;
    wrong += w * w;
    energy += a * a;
  }
  const jump = (from: number, to: number): number => {
    let m = 0;
    for (let i = from; i < to; i++) {
      const d = Math.abs(x[i + 1] - x[i]);
      if (d > m) m = d;
    }
    return m;
  };
  const near = Math.round(0.05 * rate);
  const half = Math.round(0.25 * rate);
  const seamLevel = stats(x, third - half, third + half).rms / Math.sqrt(energy / loop);
  const voicesMatch = info.written.every((w) => w === 0 || w === info.steps);
  const repeatErrorDb = db(Math.sqrt(err / Math.max(energy, 1e-20)));
  const offByOneBarDb = db(Math.sqrt(wrong / Math.max(energy, 1e-20)));
  const seamJump = jump(third - near, third + near);
  const loopJump = jump(second, third);
  return {
    name,
    ...info,
    loopSeconds: round(info.loopSeconds, 3),
    voicesMatch,
    repeatErrorDb,
    offByOneBarDb,
    seamLevelDb: db(seamLevel),
    seamJump: round(seamJump, 5),
    loopJump: round(loopJump, 5),
    pass:
      voicesMatch &&
      repeatErrorDb < -50 &&
      offByOneBarDb > -10 &&
      seamLevel > 0.25 &&
      seamJump <= loopJump * 1.05,
  };
}

/** Mean RMS of `samples` in a 0.1 s window centred on `seconds`. */
function windowRms(samples: Float32Array, sampleRate: number, seconds: number): number {
  const c = Math.round(seconds * sampleRate);
  const h = Math.round(0.05 * sampleRate);
  return stats(samples, c - h, c + h).rms;
}

export async function runMixTest(): Promise<MixReport> {
  const loops: LoopReport[] = [];
  for (const name of TRACK_NAMES) loops.push(await loopReport(name));

  // play() options, measured before the limiter so the maths is exact.
  const base = await renderSfx("uiSelect");
  const quiet = await renderSfx("uiSelect", { volume: 0.5 });
  const fast = await renderSfx("uiSelect", { rate: 2 });
  const pitch = (r: { out: Float32Array; sampleRate: number; nominal: number }): number =>
    dominantHz(r.out, r.sampleRate, LEAD_IN + r.nominal * 0.7);
  let slowStep = 0;
  let fastStep = 0;
  await renderOffline(0.2, (mix) => {
    slowStep = triggerSfx(mix, "step", 0, 1, 1, 0);
    fastStep = triggerSfx(mix, "step", 0, 1, 1, 1);
  });
  const options = {
    halfVolumeRatio: round(stats(quiet.pre).peak / stats(base.pre).peak, 3),
    doubleRateLength: round(fast.nominal / base.nominal, 3),
    doubleRatePitch: round(pitch(fast) / pitch(base), 3),
    stepSpread: round(slowStep / fastStep, 3),
    pass: false,
  };
  options.pass =
    Math.abs(options.halfVolumeRatio - 0.5) < 0.01 &&
    Math.abs(options.doubleRateLength - 0.5) < 0.01 &&
    Math.abs(options.doubleRatePitch - 2) < 0.05 &&
    options.stepSpread > 1.1;

  // Worst case: music plus a burst of the loudest effects, as when diving
  // into a painting right after opening a door.
  const pile = await renderOffline(5, (mix) => {
    const p = createPlayer(mix, "lobby", LEAD_IN);
    p.fade(true, 0);
    p.schedule(5);
    const hits: [SfxName, number][] = [
      ["doorOpen", 2], ["jump", 2.05], ["step", 2.1], ["dive", 2.2],
      ["warpIn", 2.3], ["starGet", 2.6], ["starPose", 2.7],
    ];
    for (const [name, at] of hits) triggerSfx(mix, name, at);
  });
  const pileUp = {
    peak: round(stats(pile.out).peak),
    prePeak: round(stats(pile.pre).peak),
    clipping: stats(pile.out).peak >= CLIP,
  };

  // Cross-fade envelope: the same passage with and without a fade, compared
  // before the limiter, gives the gain curve directly.
  const FADE_AT = 3;
  const times = [0.1, 0.2, 0.4, 0.8];
  const steady = await renderMusic("lobby", 6);
  const fadedOut = await renderOffline(6, (mix) => {
    const p = createPlayer(mix, "lobby", LEAD_IN);
    p.fade(true, 0);
    p.fade(false, FADE_AT);
    p.schedule(6);
  });
  const fadedIn = await renderOffline(6, (mix) => {
    const p = createPlayer(mix, "lobby", LEAD_IN);
    p.fade(true, FADE_AT);
    p.schedule(6);
  });
  const gainAt = (r: { pre: Float32Array; sampleRate: number }, t: number): number =>
    round(
      windowRms(r.pre, r.sampleRate, FADE_AT + t) /
        Math.max(windowRms(steady.pre, steady.sampleRate, FADE_AT + t), 1e-9),
      3,
    );
  const both = await renderOffline(7, (mix) => {
    const a = createPlayer(mix, "lobby", LEAD_IN);
    a.fade(true, 0);
    a.schedule(FADE_AT + 0.9);
    a.fade(false, FADE_AT);
    const b = createPlayer(mix, "title", FADE_AT + 0.06);
    b.fade(true, FADE_AT);
    b.schedule(7);
  });
  const rate = both.sampleRate;
  const crossfade = {
    out: times.map((t) => gainAt(fadedOut, t)),
    in: times.map((t) => gainAt(fadedIn, t)),
    peakDuring: round(stats(both.out, FADE_AT * rate, (FADE_AT + 1) * rate).peak),
    peakAround: round(
      Math.max(stats(both.out, 0, FADE_AT * rate).peak, stats(both.out, (FADE_AT + 1) * rate).peak),
    ),
    pass: false,
  };
  crossfade.pass =
    crossfade.out[2] < 0.1 &&
    crossfade.in[2] > 0.9 &&
    crossfade.out[0] > 0.3 &&
    crossfade.peakDuring <= crossfade.peakAround * 1.25;

  // Music must sit clearly under the effects.
  const rows = await runAudioTest();
  const mean = (kind: "sfx" | "music"): number => {
    const list = rows.filter((r) => r.kind === kind && r.name !== "step" && r.name !== "snore");
    return list.reduce((s, r) => s + r.rms, 0) / list.length;
  };
  const musicRms = mean("music");
  const sfxRms = mean("sfx");
  const levels = {
    musicRmsDb: db(musicRms),
    sfxRmsDb: db(sfxRms),
    sfxOverMusicDb: db(sfxRms / musicRms),
    pass: sfxRms / musicRms > 1.6,
  };

  return { loops, options, pileUp, crossfade, levels };
}

/* ------------------------------------------------------------------ */
/* Lifecycle test (live AudioContext)                                  */
/* ------------------------------------------------------------------ */

export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Call everything on the public interface once; throws if any call throws. */
function exercise(a: AudioEngineDev): void {
  a.play("jump");
  a.play("step", { volume: 0.3, rate: 1.2 });
  a.setMusic("title");
  a.setMusic("title");
  a.setMusic(null);
  a.setMuted(true);
  a.setMuted(false);
  a.suspend();
  a.resume();
  void a.unlocked;
  void a.muted;
}

export async function runLifecycleTest(): Promise<Check[]> {
  const checks: Check[] = [];
  /** `fn` returns true, or a string describing what was wrong. */
  const check = (name: string, fn: () => true | string): void => {
    try {
      const r = fn();
      checks.push(r === true ? { name, pass: true } : { name, pass: false, detail: r });
    } catch (e) {
      checks.push({ name, pass: false, detail: `threw: ${String(e)}` });
    }
  };
  const expect = (cond: boolean, detail: unknown): true | string =>
    cond ? true : JSON.stringify(detail);
  const brief = (a: AudioEngineDev): Record<string, unknown> => {
    const rest: Partial<AudioInspect> = { ...a.inspect() };
    delete rest.output; // an AudioNode does not serialise
    return { ...rest, unlocked: a.unlocked, muted: a.muted };
  };

  const a = createAudioEngine();

  check("play() before unlock is a safe no-op", () => {
    for (const n of SFX_NAMES) a.play(n);
    a.play("step", { volume: 2, rate: 0.5 });
    return expect(!a.unlocked && a.inspect().sfxPlayed === 0 && a.inspect().contexts === 0, brief(a));
  });
  check("setMusic() before unlock is remembered, nothing is created", () => {
    a.setMusic("title");
    a.setMusic("lobby");
    const i = a.inspect();
    return expect(i.wanted === "lobby" && i.playing === null && i.contexts === 0, brief(a));
  });
  check("setMuted / suspend / resume before unlock", () => {
    a.setMuted(true);
    a.suspend();
    a.resume();
    return expect(a.muted && a.inspect().contexts === 0, brief(a));
  });
  check("unlock() creates the context and starts the remembered track", () => {
    a.unlock();
    const i = a.inspect();
    return expect(a.unlocked && i.contexts === 1 && i.playing === "lobby" && i.players === 1, brief(a));
  });
  check("play() right after unlock() is accepted (PRESS START chime)", () => {
    const before = a.inspect().sfxPlayed;
    a.play("start");
    return expect(a.inspect().sfxPlayed === before + 1, brief(a));
  });

  // Listen to the real output.
  const output = a.inspect().output;
  const ctx = output ? (output.context as AudioContext) : null;
  const analyser = ctx ? ctx.createAnalyser() : null;
  if (analyser && output) {
    analyser.fftSize = 2048;
    output.connect(analyser);
  }
  const scratch = new Float32Array(2048);
  /** Loudest of several snapshots, so a rest between notes is not mistaken for silence. */
  const listen = async (): Promise<number> => {
    let loudest = 0;
    for (let i = 0; i < 8; i++) {
      if (analyser) {
        analyser.getFloatTimeDomainData(scratch);
        loudest = Math.max(loudest, stats(scratch).peak);
      }
      await sleep(60);
    }
    return loudest;
  };

  // The output device can take a while to open (seconds in a headless
  // browser); nothing can be heard or measured until the clock moves.
  const waited = performance.now();
  while (a.inspect().time < 0.3 && performance.now() - waited < 15000) await sleep(50);
  const startup = Math.round(performance.now() - waited);
  check(`context is running and its clock moves (${startup} ms after unlock)`, () =>
    expect(a.inspect().state === "running" && a.inspect().time >= 0.3, brief(a)),
  );
  const mutedLevel = await listen();
  check("mute set before unlock is honoured (output silent)", () =>
    expect(mutedLevel < 1e-4, { mutedLevel }),
  );
  check("unlock() is idempotent", () => {
    a.unlock();
    a.unlock();
    const i = a.inspect();
    return expect(i.contexts === 1 && i.players === 1 && i.playing === "lobby", brief(a));
  });

  a.setMuted(false);
  await sleep(300);
  const liveLevel = await listen();
  check("unmuted music is audible on the live output", () =>
    expect(liveLevel > 0.01 && liveLevel < CLIP, { liveLevel }),
  );

  check("setMusic() with the current track twice does not restart it", () => {
    const before = a.inspect();
    a.setMusic("lobby");
    a.setMusic("lobby");
    const after = a.inspect();
    return expect(
      after.players === 1 && after.position >= before.position && before.position > 1,
      { before: before.position, after: after.position, players: after.players },
    );
  });
  check("cross-fades stacked with mute toggles mid-fade", () => {
    a.setMusic("title");
    a.setMuted(true);
    a.setMuted(false);
    a.setMusic("course");
    a.setMuted(true);
    a.setMusic("title");
    a.setMuted(false);
    const i = a.inspect();
    return expect(i.playing === "title" && i.players === 4 && !a.muted, brief(a));
  });
  await sleep(1300);
  check("faded-out tracks are released", () => {
    const i = a.inspect();
    return expect(i.players === 1 && i.playing === "title", brief(a));
  });

  check("rapid step calls never stack", () => {
    const before = a.inspect().sfxPlayed;
    for (let i = 0; i < 60; i++) a.play("step");
    return expect(a.inspect().sfxPlayed === before + 1, { played: a.inspect().sfxPlayed - before });
  });
  await sleep(200);
  check("step plays again once its gap has passed", () => {
    const before = a.inspect().sfxPlayed;
    a.play("step");
    return expect(a.inspect().sfxPlayed === before + 1, brief(a));
  });
  await sleep(250);
  check("every effect plays with volume and rate options", () => {
    const before = a.inspect().sfxPlayed;
    for (const n of SFX_NAMES) a.play(n, { volume: 0.4, rate: 1.3 });
    return expect(a.inspect().sfxPlayed === before + SFX_NAMES.length, {
      played: a.inspect().sfxPlayed - before,
    });
  });
  await sleep(1100);
  check("nonsense options do not throw", () => {
    const odd = [0, -1, NaN, Infinity, 1e9];
    for (const v of odd) for (const r of odd) a.play("uiMove", { volume: v, rate: r });
    a.play("nope" as SfxName);
    a.setMusic("nope" as MusicTrack);
    a.setMusic("title");
    return true;
  });
  await sleep(1100);
  const busyLevel = await listen();
  check("live output never reached clipping", () => expect(busyLevel < CLIP, { busyLevel }));

  a.suspend();
  await sleep(300);
  const frozen = a.inspect();
  await sleep(400);
  const stillFrozen = a.inspect();
  check("suspend() freezes the context clock", () =>
    expect(frozen.state === "suspended" && stillFrozen.time === frozen.time, {
      state: frozen.state,
      t1: frozen.time,
      t2: stillFrozen.time,
    }),
  );
  check("play() while suspended is dropped, not queued", () => {
    const before = a.inspect().sfxPlayed;
    a.play("jump");
    a.play("land");
    return expect(a.inspect().sfxPlayed === before, brief(a));
  });
  a.resume();
  await sleep(500);
  const resumed = a.inspect();
  check("resume() continues the same loop where it stopped", () =>
    expect(
      resumed.state === "running" &&
        resumed.players === 1 &&
        resumed.playing === "title" &&
        resumed.position > stillFrozen.position &&
        resumed.position < stillFrozen.position + 12 &&
        stillFrozen.position > 4,
      { before: stillFrozen.position, after: resumed.position, state: resumed.state },
    ),
  );
  const resumedLevel = await listen();
  check("music is audible again after resume", () => expect(resumedLevel > 0.01, { resumedLevel }));

  // A system interruption: the browser stops the context on its own (phone
  // call, background, refused resume). The next gesture must revive it.
  if (ctx) await ctx.suspend().catch(() => {});
  await sleep(200);
  const interrupted = a.inspect().state;
  window.dispatchEvent(new Event("pointerdown"));
  await sleep(400);
  check("a system-suspended context is revived by the next gesture", () =>
    expect(interrupted === "suspended" && a.inspect().state === "running", {
      interrupted,
      after: a.inspect().state,
    }),
  );
  a.suspend();
  await sleep(200);
  window.dispatchEvent(new Event("pointerdown"));
  await sleep(300);
  check("a gesture does not undo an app suspend() (tab hidden)", () =>
    expect(a.inspect().state === "suspended", { state: a.inspect().state }),
  );
  a.resume();
  await sleep(300);

  a.suspend();
  await sleep(250);
  a.unlock();
  await sleep(300);
  check("unlock() resumes a suspended context", () =>
    expect(a.inspect().state === "running" && a.inspect().contexts === 1, brief(a)),
  );

  a.setMusic(null);
  await sleep(1300);
  const silentLevel = await listen();
  check("setMusic(null) fades out and releases the track", () => {
    const i = a.inspect();
    return expect(i.players === 0 && i.playing === null && silentLevel < 1e-3, {
      players: i.players,
      silentLevel,
    });
  });

  a.setMusic("course");
  check("dispose() closes the context and re-locks", () => {
    a.dispose();
    const i = a.inspect();
    return expect(!a.unlocked && i.state === "none" && i.players === 0 && i.wanted === null, brief(a));
  });
  await sleep(150);
  check("the disposed AudioContext is closed", () => expect(ctx?.state === "closed", { state: ctx?.state }));
  check("every call after dispose() is safe", () => {
    exercise(a);
    a.dispose();
    a.dispose();
    return expect(!a.unlocked && a.inspect().contexts === 1, brief(a));
  });
  check("unlock() after dispose() starts fresh, mute preference kept", () => {
    a.setMuted(true);
    a.setMusic("lobby");
    a.unlock();
    const i = a.inspect();
    const ok = a.unlocked && i.contexts === 2 && i.playing === "lobby" && a.muted;
    a.dispose();
    return expect(ok, i);
  });

  type Ctor = new () => AudioContext;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const saved = { a: w.AudioContext, k: w.webkitAudioContext };
  check("no Web Audio at all → silent no-op", () => {
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    try {
      const e = createAudioEngine();
      e.unlock();
      exercise(e);
      e.unlock();
      e.dispose();
      return expect(!e.unlocked && e.inspect().contexts === 0, brief(e));
    } finally {
      w.AudioContext = saved.a;
      w.webkitAudioContext = saved.k;
    }
  });
  check("AudioContext constructor throws → silent no-op", () => {
    w.AudioContext = function Broken() {
      throw new Error("no audio device");
    } as unknown as Ctor;
    try {
      const e = createAudioEngine();
      e.unlock();
      exercise(e);
      e.dispose();
      return expect(!e.unlocked, brief(e));
    } finally {
      w.AudioContext = saved.a;
    }
  });
  check("engine works again once Web Audio is back", () => {
    const e = createAudioEngine();
    e.unlock();
    const ok = e.unlocked;
    e.dispose();
    return expect(ok, brief(e));
  });

  return checks;
}

/* ------------------------------------------------------------------ */
/* Live scheduler test                                                 */
/* ------------------------------------------------------------------ */

export interface LiveReport {
  track: MusicTrack;
  sampleRate: number;
  /** Seconds compared; longer than one loop, so the seam is included. */
  seconds: number;
  loopSeconds: number;
  /** Where the offline render lined up inside the live capture. */
  lagMs: number;
  /** Live minus offline, relative to offline: overall, and the worst 0.25 s window. */
  errorDb: number;
  worstWindowDb: number;
  /** Start of that worst window, seconds into the track. */
  worstAt: number;
  pass: boolean;
}

/**
 * Play `track` through a live engine while recording the master output, then
 * render the same thing offline at the same sample rate and subtract. The two
 * can only match to within a fraction of a sample (the live start time is not
 * on the sample grid), so "the same" means an error far below the signal; a
 * dropped or late note would push its window to around 0 dB.
 */
export async function runLiveTest(track: MusicTrack = "title", seconds?: number): Promise<LiveReport> {
  const info = trackInfo(track);
  const length = seconds ?? info.loopSeconds + 2.5;
  const a = createAudioEngine();
  a.unlock();
  const output = a.inspect().output;
  if (!output) throw new Error("Web Audio is not available");
  const ctx = output.context as AudioContext;
  const waited = performance.now();
  while (a.inspect().time < 0.2 && performance.now() - waited < 15000) await sleep(50);

  const rate = ctx.sampleRate;
  const live = new Float32Array(Math.ceil((length + 2) * rate));
  let filled = 0;
  // Deprecated, but the simplest way to read real output samples in a test.
  const tap = ctx.createScriptProcessor(2048, 1, 1);
  tap.onaudioprocess = (e) => {
    const block = e.inputBuffer.getChannelData(0);
    if (filled + block.length <= live.length) {
      live.set(block, filled);
      filled += block.length;
    }
  };
  output.connect(tap);
  tap.connect(ctx.destination);
  await sleep(300);
  a.setMusic(track);
  await sleep((length + 1) * 1000);
  output.disconnect(tap);
  tap.disconnect();
  a.dispose();

  // The engine fades a new track in from "now" and starts it 60 ms later.
  const ref = (
    await renderOffline(
      length,
      (mix) => {
        const p = createPlayer(mix, track, 0.06);
        p.fade(true, 0);
        p.schedule(length);
      },
      rate,
    )
  ).out;

  // Find where the reference sits in the capture: slide a third of a second
  // of it (taken one second in) across the first 1.5 s of possible lags.
  const probeAt = Math.round(rate);
  const probeLen = 16384;
  let bestLag = 0;
  let best = -Infinity;
  const maxLag = Math.min(Math.round(1.5 * rate), filled - probeAt - probeLen);
  for (let lag = 0; lag < maxLag; lag++) {
    let dot = 0;
    for (let i = 0; i < probeLen; i += 2) dot += live[lag + probeAt + i] * ref[probeAt + i];
    if (dot > best) {
      best = dot;
      bestLag = lag;
    }
  }

  const win = Math.round(0.25 * rate);
  const usable = Math.min(ref.length, filled - bestLag);
  let errAll = 0;
  let sigAll = 0;
  let worst = 0;
  let worstAt = 0;
  for (let start = 0; start + win <= usable; start += win) {
    let err = 0;
    let sig = 0;
    for (let i = start; i < start + win; i++) {
      const d = live[bestLag + i] - ref[i];
      err += d * d;
      sig += ref[i] * ref[i];
    }
    errAll += err;
    sigAll += sig;
    // Ignore the fade-in's first window, where there is almost no signal.
    if (sig / win > 1e-6 && err / sig > worst) {
      worst = err / sig;
      worstAt = start / rate;
    }
  }
  const errorDb = db(Math.sqrt(errAll / Math.max(sigAll, 1e-20)));
  const worstWindowDb = db(Math.sqrt(worst));
  return {
    track,
    sampleRate: rate,
    seconds: round(usable / rate, 2),
    loopSeconds: round(info.loopSeconds, 3),
    lagMs: round((bestLag / rate) * 1000, 1),
    errorDb,
    worstWindowDb,
    worstAt: round(worstAt, 2),
    pass: usable / rate > info.loopSeconds + 1 && errorDb < -15 && worstWindowDb < -6,
  };
}

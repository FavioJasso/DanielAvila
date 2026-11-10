/**
 * DANIEL AVILA 64 — procedural audio engine.
 *
 * Every sound is synthesized with the Web Audio API: no audio files, no
 * dependencies, no three.js (this module is in the first-paint bundle).
 *
 * Lifecycle
 * - Nothing is created until `unlock()` runs inside a user gesture. Calls
 *   made earlier are safe: effects are dropped, the requested music track
 *   and the mute state are remembered and applied on unlock.
 * - `suspend()` / `resume()` freeze and continue the context clock, so a loop
 *   carries on from where it stopped instead of restarting.
 * - If the browser stops the context by itself (mobile interruptions, a
 *   refused resume outside a gesture), the next tap / click / key revives it.
 * - `dispose()` closes the context and returns the engine to its locked
 *   state; the mute preference survives, and a later `unlock()` starts fresh.
 * - Without Web Audio (server render, very old browsers) every method is a
 *   silent no-op. No public method ever throws.
 */
import type { AudioEngine, CreateAudio, MusicTrack, SfxName } from "../contract";
import { createPlayer, type Player } from "./music";
import { triggerSfx } from "./sfx";
import { createMixer, MASTER_GAIN, type Mixer } from "./synth";

/** How far ahead of the context clock notes are scheduled, in seconds. */
const LOOKAHEAD = 0.25;
/** How often the scheduler wakes, in milliseconds. */
const TICK_MS = 40;
/** A faded-out track is disconnected this long after its fade began. */
const FADE_OUT_HOLD = 0.9;
/** Time constant of the mute ramp, in seconds. */
const MUTE_TC = 0.025;
/**
 * Minimum spacing between repeats of one effect, so rapid calls never stack.
 * `snore` is longer than the sound itself: called every frame while the
 * avatar sleeps, it still comes out as one unhurried breath at a time.
 */
const MIN_GAP: Partial<Record<SfxName, number>> = { step: 0.12, snore: 2.8, doorOpen: 0.2 };
const DEFAULT_GAP = 0.04;
/** Effects allowed to pile up while the context clock is not moving yet. */
const MAX_QUEUED = 4;
/** Events that count as a user gesture for audio in every browser. */
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
const GESTURE_OPTS: AddEventListenerOptions = { capture: true, passive: true };

interface FadingPlayer {
  player: Player;
  /** Context time after which it can be disconnected. */
  until: number;
}

/** Everything that exists only between `unlock()` and `dispose()`. */
interface Live {
  ctx: AudioContext;
  mix: Mixer;
  current: Player | null;
  fading: FadingPlayer[];
  timer: ReturnType<typeof setInterval> | null;
  /** Context time each effect last started. */
  last: Partial<Record<SfxName, number>>;
  /** Effects scheduled while the context clock was not moving yet. */
  queued: number;
}

/** Engine internals exposed for the dev harness and tests. */
export interface AudioInspect {
  state: AudioContextState | "none";
  /** Context clock in seconds. */
  time: number;
  /** The track asked for (remembered even while locked). */
  wanted: MusicTrack | null;
  /** The track actually sounding. */
  playing: MusicTrack | null;
  /** Players alive, including ones still fading out. */
  players: number;
  /** Loop position of the current track, in steps. */
  position: number;
  /** Effects actually scheduled since creation. */
  sfxPlayed: number;
  /** AudioContexts created since creation. */
  contexts: number;
  /** The master output node, for attaching an analyser. */
  output: AudioNode | null;
}

export interface AudioEngineDev extends AudioEngine {
  inspect(): AudioInspect;
}

type AudioContextCtor = new () => AudioContext;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Run something that may throw or reject (old WebKit, closed contexts). */
function quiet(fn: () => unknown): void {
  try {
    const p = fn() as { catch?: (onRejected: () => void) => unknown } | undefined;
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* audio must never break the game */
  }
}

export function createAudioEngine(): AudioEngineDev {
  let live: Live | null = null;
  let muted = false;
  let wanted: MusicTrack | null = null;
  /** Suspended by the app (tab hidden), as opposed to not started yet. */
  let held = false;
  /** State of the tiny generator behind the footstep pitch variation. */
  let seed = 0x9e3779b9;
  let sfxPlayed = 0;
  let contexts = 0;

  /** Next pseudo-random number in 0..1 (never Math.random: deterministic). */
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 8) / 16777216;
  };

  /*
   * Self-healing after a system interruption. Mobile browsers suspend (iOS:
   * "interrupted") the context on their own — a phone call, another app
   * taking the audio route, a return from the background where `resume()`
   * ran outside a gesture and was refused. Nothing else calls `unlock()`
   * after PRESS START, so while the context is stopped without the app
   * having asked for it, the next tap, click or key press revives it.
   */
  let armed = false;
  const onGesture = (): void => {
    disarm();
    engine.unlock();
  };
  const arm = (): void => {
    if (armed || typeof window === "undefined") return;
    armed = true;
    for (const g of GESTURES) window.addEventListener(g, onGesture, GESTURE_OPTS);
  };
  const disarm = (): void => {
    if (!armed) return;
    armed = false;
    for (const g of GESTURES) window.removeEventListener(g, onGesture, GESTURE_OPTS);
  };
  /** Arm when the context is stopped though the app wants sound, else disarm. */
  const watchState = (): void => {
    const l = live;
    const s: string = l ? l.ctx.state : "closed";
    if (l && !held && s !== "running" && s !== "closed") arm();
    else disarm();
  };

  const stopTimer = (l: Live): void => {
    if (l.timer !== null) {
      clearInterval(l.timer);
      l.timer = null;
    }
  };

  /** The look-ahead scheduler: tops up every live track, retires faded ones. */
  const tick = (): void => {
    const l = live;
    if (!l) return;
    const now = l.ctx.currentTime;
    l.current?.schedule(now + LOOKAHEAD);
    for (let i = l.fading.length - 1; i >= 0; i--) {
      const f = l.fading[i];
      if (now >= f.until) {
        f.player.stop();
        l.fading.splice(i, 1);
      } else {
        f.player.schedule(now + LOOKAHEAD);
      }
    }
    if (!l.current && l.fading.length === 0) stopTimer(l);
  };

  /** Runs only while something is playing and the app has not suspended us. */
  const startTimer = (l: Live): void => {
    if (l.timer === null && !held && (l.current || l.fading.length > 0)) {
      l.timer = setInterval(tick, TICK_MS);
    }
  };

  /** Cross-fade from whatever is playing to `track` (or to silence). */
  const applyMusic = (l: Live, track: MusicTrack | null): void => {
    if ((l.current?.track ?? null) === track) return;
    const now = l.ctx.currentTime;
    if (l.current) {
      l.current.fade(false, now);
      l.fading.push({ player: l.current, until: now + FADE_OUT_HOLD });
      l.current = null;
    }
    if (track) {
      const player = createPlayer(l.mix, track, now + 0.06);
      player.fade(true, now);
      player.schedule(now + LOOKAHEAD);
      l.current = player;
    }
    startTimer(l);
  };

  const engine: AudioEngineDev = {
    unlock() {
      try {
        if (!live) {
          const Ctor = contextCtor();
          if (!Ctor) return;
          const ctx = new Ctor();
          contexts++;
          let mix: Mixer;
          try {
            mix = createMixer(ctx, ctx.destination, muted);
          } catch {
            quiet(() => ctx.close());
            return;
          }
          const l: Live = { ctx, mix, current: null, fading: [], timer: null, last: {}, queued: 0 };
          live = l;
          held = false;
          ctx.onstatechange = watchState;
          // iOS only opens the audio route once a buffer has been started
          // inside the gesture; one silent sample is enough.
          quiet(() => {
            const src = ctx.createBufferSource();
            src.buffer = ctx.createBuffer(1, 1, 22050);
            src.connect(ctx.destination);
            src.start(0);
          });
          if (wanted) applyMusic(l, wanted);
        }
        const l = live;
        if (held || l.ctx.state !== "running") {
          held = false;
          quiet(() => l.ctx.resume());
          startTimer(l);
        }
        watchState();
      } catch {
        /* stay silent */
      }
    },

    get unlocked() {
      return live !== null;
    },

    play(name, opts) {
      const l = live;
      if (!l || held) return;
      try {
        const now = l.ctx.currentTime;
        // Until the context is running and its clock has begun to move (the
        // output device can take a moment to open), time stands still and
        // everything scheduled lands in one burst — keep that burst small.
        const ticking = l.ctx.state === "running" && now > 0;
        if (ticking) l.queued = 0;
        else if (l.queued >= MAX_QUEUED) return;
        const last = l.last[name];
        if (last !== undefined && now - last < (MIN_GAP[name] ?? DEFAULT_GAP)) return;

        // Nonsense values (NaN, Infinity, a zero or negative rate) mean "default".
        const v = opts?.volume ?? 1;
        const r = opts?.rate ?? 1;
        const volume = Number.isFinite(v) ? Math.min(Math.max(v, 0), 2) : 1;
        const rate = Number.isFinite(r) && r > 0 ? Math.min(Math.max(r, 0.25), 4) : 1;
        if (volume === 0) return;

        triggerSfx(l.mix, name, now + 0.005, volume, rate, random());
        l.last[name] = now;
        if (!ticking) l.queued++;
        sfxPlayed++;
      } catch {
        /* stay silent */
      }
    },

    setMusic(track) {
      wanted = track;
      const l = live;
      if (!l) return;
      try {
        applyMusic(l, track);
      } catch {
        /* stay silent */
      }
    },

    setMuted(m) {
      muted = m;
      const l = live;
      if (!l) return;
      quiet(() => {
        const g = l.mix.master.gain;
        const now = l.ctx.currentTime;
        // Eases from the current value, so toggling mid-ramp cannot click.
        g.cancelScheduledValues(now);
        g.setTargetAtTime(m ? 0 : MASTER_GAIN, now, MUTE_TC);
      });
    },

    get muted() {
      return muted;
    },

    suspend() {
      const l = live;
      if (!l) return;
      held = true;
      disarm();
      stopTimer(l);
      quiet(() => l.ctx.suspend());
    },

    resume() {
      const l = live;
      if (!l) return;
      held = false;
      quiet(() => l.ctx.resume());
      startTimer(l);
      // Outside a gesture a mobile browser may refuse; the next tap then retries.
      watchState();
    },

    dispose() {
      const l = live;
      live = null;
      wanted = null;
      held = false;
      disarm();
      if (!l) return;
      l.ctx.onstatechange = null;
      stopTimer(l);
      quiet(() => {
        l.current?.stop();
        for (const f of l.fading) f.player.stop();
      });
      quiet(() => l.ctx.close());
    },

    inspect() {
      const l = live;
      return {
        state: l ? l.ctx.state : "none",
        time: l ? l.ctx.currentTime : 0,
        wanted,
        playing: l?.current?.track ?? null,
        players: l ? l.fading.length + (l.current ? 1 : 0) : 0,
        position: l?.current ? l.current.position(l.ctx.currentTime) : 0,
        sfxPlayed,
        contexts,
        output: l ? l.mix.master : null,
      };
    },
  };
  return engine;
}

export const createAudio: CreateAudio = () => createAudioEngine();

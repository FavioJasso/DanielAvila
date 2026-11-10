/**
 * The three looping tunes and the step sequencer that plays them.
 *
 * All three are original compositions written for this site:
 *   title  — G major, 4/4, bright and bouncy, 8 bars.
 *   lobby  — F major, 3/4, a stately hall tune, 16 bars (percussion joins
 *            for the second half so the repeat keeps a little shape).
 *   course — the lobby's harmony as a slow music-box arpeggio: calm
 *            background for reading, no percussion.
 *
 * Notation: space-separated `note:length` tokens, length in steps (default
 * 1), `-` is a rest, `|` is a bar line for the reader and is ignored.
 * Percussion uses `k` (soft thump), `h` (tick) and `s` (brush).
 */
import type { MusicTrack } from "../contract";
import { hz, voice, type Bus, type Mixer } from "./synth";

interface TrackDef {
  bpm: number;
  /** Steps per beat. */
  div: number;
  beatsPerBar: number;
  bars: number;
  /** Track level relative to the music bus. */
  gain: number;
  /** Lead echo: delay in steps, feedback, wet level. */
  echo: readonly [number, number, number];
  lead: string;
  bass: string;
  perc?: string;
}

const TRACKS: Record<MusicTrack, TrackDef> = {
  title: {
    bpm: 132,
    div: 4,
    beatsPerBar: 4,
    bars: 8,
    gain: 1,
    echo: [3, 0.25, 0.2],
    lead: `d5:2 g5:2 b5:3 a5 g5:2 -:2 d5:2 g5:2 | a5:3 f#5:3 d5:2 -:2 e5:2 f#5:2 a5:2
         | g5:3 e5:3 b4:2 -:2 e5:2 g5:2 b5:2 | c6:4 b5:2 g5:2 e5:4 -:2 d5:2
         | d5:2 g5:2 b5:3 a5 g5:2 -:2 b5:2 d6:2 | e6:3 c6:3 a5:2 -:2 g5:2 a5:2 c6:2
         | b5:2 a5:2 f#5:2 d5:2 e5:2 f#5:2 a5:2 c6:2 | b5:3 g5:3 d5:2 g5:4 -:2 a4 b4`,
    bass: `g2:3 g2:3 d3:2 g2:3 g2:3 b2:2 | f#2:3 f#2:3 a2:2 f#2:3 f#2:3 d3:2
         | e2:3 e2:3 b2:2 e2:3 e2:3 g2:2 | c3:3 c3:3 g2:2 c3:3 c3:3 d3:2
         | b2:3 b2:3 d3:2 b2:3 b2:3 g2:2 | a2:3 a2:3 e3:2 a2:3 a2:3 c3:2
         | d3:3 d3:3 a2:2 d3:3 d3:3 f#2:2 | g2:3 g2:3 d3:2 g2:4 d3:2 d2:2`,
    perc: `k:2 h:2 s:2 h:2 k:2 k h s:2 h:2 | k:2 h:2 s:2 h:2 k:2 k h s:2 h:2
         | k:2 h:2 s:2 h:2 k:2 k h s:2 h:2 | k:2 h:2 s:2 h:2 k:2 k h s:2 h h
         | k:2 h:2 s:2 h:2 k:2 k h s:2 h:2 | k:2 h:2 s:2 h:2 k:2 k h s:2 h:2
         | k:2 h:2 s:2 h:2 k:2 k h s:2 h:2 | k:2 h:2 s:2 h:2 k:2 h:2 s s s:2`,
  },
  lobby: {
    bpm: 104,
    div: 2,
    beatsPerBar: 3,
    bars: 16,
    gain: 1,
    echo: [1.5, 0.3, 0.26],
    lead: `f5:4 a5:2 | g5:3 f5 e5:2 | f5:4 d5:2 | d5:2 c5 bb4 d5:2
         | c5:4 f5:2 | g5:3 a5 bb5:2 | a5:2 g5:2 e5:2 | g5:4 c5 e5
         | f5:4 a5:2 | c6:3 bb5 g5:2 | a5:4 f5:2 | d5:2 f5:2 bb5:2
         | a5:3 g5 bb5:2 | g5:3 f5 e5:2 | f5:6 | -:2 c5:2 e5:2`,
    bass: `f2:2 c3:2 a3:2 | e2:2 c3:2 g3:2 | d2:2 a2:2 f3:2 | bb2:2 f3:2 d3:2
         | a2:2 f3:2 c3:2 | g2:2 d3:2 bb3:2 | c3:2 g3:2 e3:2 | c3:2 bb3:2 g3:2
         | f2:2 c3:2 a3:2 | e2:2 c3:2 g3:2 | d2:2 a2:2 f3:2 | bb2:2 f3:2 d3:2
         | g2:2 d3:2 bb3:2 | c3:2 g3:2 bb3:2 | f2:2 c3:2 a3:2 | f2:2 a2:2 c3:2`,
    perc: `-:48
         | k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 h:2 h h
         | k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 h:2 s:2`,
  },
  course: {
    bpm: 84,
    div: 2,
    beatsPerBar: 3,
    bars: 16,
    gain: 0.95,
    echo: [1.5, 0.35, 0.3],
    lead: `f4 a4 c5 f5 c5 a4 | e4 g4 c5 g5 c5 g4 | d4 f4 a4 f5 a4 f4 | d4 f4 bb4 d5 bb4 f4
         | c4 f4 a4 c5 a4 f4 | d4 g4 bb4 g5 bb4 g4 | e4 g4 c5 e5 c5 g4 | e4 bb4 c5 g5:3
         | f4 a4 c5 f5 c5 a4 | g4 c5 e5 c6 g5 e5 | f4 a4 d5 a5 f5 d5 | f4 bb4 d5 f5 d5 bb4
         | d4 g4 bb4 g5 bb4 g4 | e4 g4 bb4 e5 c5 g4 | f4 a4 c5 f5:3 | a4 c5 a4 f4:3`,
    bass: `f3:6 | e3:6 | d3:6 | bb2:6 | a2:6 | g2:6 | c3:6 | c3:6
         | f3:6 | e3:6 | d3:6 | bb2:6 | g2:6 | c3:6 | f2:6 | f2:4 c3:2`,
  },
};

const SEMITONE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "f#5" / "bb4" → MIDI note number. */
function midi(name: string): number {
  let n = SEMITONE[name[0]];
  let i = 1;
  if (name[i] === "#") { n++; i++; }
  else if (name[i] === "b") { n--; i++; }
  return n + 12 * (Number(name.slice(i)) + 1);
}

const LEAD = 0;
const BASS = 1;
const PERC = 2;

interface NoteEvent {
  /** Step within the loop. */
  s: number;
  /** Length in steps. */
  l: number;
  /** Frequency in Hz, or the percussion sound (0 k, 1 h, 2 s). */
  n: number;
  /** LEAD, BASS or PERC. */
  k: number;
}

interface Compiled {
  def: TrackDef;
  /** Steps per loop. */
  steps: number;
  stepDur: number;
  /** Steps written for each voice — each must equal `steps`. */
  written: number[];
  events: NoteEvent[];
}

const compiled = new Map<MusicTrack, Compiled>();

function compile(track: MusicTrack): Compiled {
  let c = compiled.get(track);
  if (c) return c;
  const def = TRACKS[track];
  const events: NoteEvent[] = [];
  const written: number[] = [];
  [def.lead, def.bass, def.perc].forEach((src, k) => {
    let s = 0;
    for (const tok of (src ?? "").split(/[\s|]+/)) {
      if (!tok) continue;
      const [name, len] = tok.split(":");
      const l = len ? Number(len) : 1;
      if (name !== "-") {
        events.push({ s, l, n: k === PERC ? "khs".indexOf(name) : hz(midi(name)), k });
      }
      s += l;
    }
    written.push(s);
  });
  // Array.prototype.sort is stable, so voices keep their order within a step.
  events.sort((a, b) => a.s - b.s);
  c = {
    def,
    steps: def.bars * def.beatsPerBar * def.div,
    stepDur: 60 / def.bpm / def.div,
    written,
    events,
  };
  compiled.set(track, c);
  return c;
}

export interface TrackInfo {
  bpm: number;
  bars: number;
  beatsPerBar: number;
  steps: number;
  /** Steps written per voice (lead, bass, percussion); 0 = voice unused. */
  written: number[];
  loopSeconds: number;
}

/** Facts about a track, for the harness and tests. */
export function trackInfo(track: MusicTrack): TrackInfo {
  const c = compile(track);
  return {
    bpm: c.def.bpm,
    bars: c.def.bars,
    beatsPerBar: c.def.beatsPerBar,
    steps: c.steps,
    written: c.written,
    loopSeconds: c.steps * c.stepDur,
  };
}

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */

/** Lead voices: `f` Hz for `d` seconds on the echoed bus. */
const LEADS: Record<MusicTrack, (b: Bus, f: number, d: number) => void> = {
  // Thin pulse with a triangle underneath; vibrato only on held notes.
  title(b, f, d) {
    voice(b, { w: "pulse", f, d, v: 0.15, a: 0.006, s: 0.55, r: 0.04, vib: d > 0.3 ? 14 : 0 });
    voice(b, { w: "triangle", f, d, v: 0.2, a: 0.006, s: 0.6, r: 0.04 });
  },
  // Round, flute-like triangle with a soft chime on each attack.
  lobby(b, f, d) {
    voice(b, { w: "triangle", f, d, v: 0.4, a: 0.025, s: 0.78, r: 0.09, vib: d > 0.5 ? 11 : 0, vr: 5.5 });
    voice(b, { w: "sine", f: f * 2, d: Math.min(d, 0.3), v: 0.07 });
  },
  // Music box: a struck sine that rings past its step.
  course(b, f, d) {
    voice(b, { w: "sine", f, d: d + 0.55, v: 0.36 });
    voice(b, { w: "triangle", f: f * 2, d: 0.14, v: 0.05 });
  },
};

function bassNote(b: Bus, track: MusicTrack, f: number, d: number): void {
  if (track === "course") {
    voice(b, { w: "sine", f, d, v: 0.3, a: 0.06, s: 0.8, r: 0.5 });
    voice(b, { w: "triangle", f, d, v: 0.1, a: 0.06, s: 0.7, r: 0.5 });
  } else {
    voice(b, { w: "triangle", f, d, v: 0.45, a: 0.008, s: 0.7, r: 0.06 });
    // A triangle this low all but vanishes on laptop and phone speakers;
    // a quiet filtered saw adds the overtones that let the line be heard.
    voice(b, { w: "sawtooth", f, d, v: 0.08, a: 0.008, s: 0.6, r: 0.06, flt: ["lowpass", 1200] });
  }
}

function percHit(b: Bus, kind: number, v: number, step: number): void {
  if (kind === 0) {
    voice(b, { w: "sine", f: 128, to: 52, d: 0.11, v: 0.5 * v });
  } else if (kind === 1) {
    // `off` walks through the noise buffer so repeated ticks are not
    // identical, yet every pass of the loop is.
    voice(b, { w: "noise", d: 0.035, v: 0.16 * v, flt: ["highpass", 7000], off: step * 0.137 });
  } else {
    voice(b, { w: "noise", d: 0.09, v: 0.22 * v, flt: ["bandpass", 1900, 1300, 0.9], off: step * 0.211 });
  }
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

/** Time constant of the cross-fade: ~95 % of the way there after 0.4 s. */
const FADE_TC = 0.13;

export interface Player {
  readonly track: MusicTrack;
  /** Schedule every note that starts before context time `until`. */
  schedule(until: number): void;
  /** Ease the track in (true) or out (false) from context time `at`. */
  fade(on: boolean, at: number): void;
  /** Loop position in steps at context time `t` (keeps counting past one loop). */
  position(t: number): number;
  /** Disconnect from the mixer. Notes already scheduled die with it. */
  stop(): void;
}

/**
 * A looping track whose first step sounds at context time `t0`. The caller
 * drives it: live, a timer calls `schedule(currentTime + lookahead)`; offline,
 * one call schedules the whole render. Note times are derived from integer
 * step counts, so a loop never drifts and its seam is sample-accurate.
 */
export function createPlayer(mix: Mixer, track: MusicTrack, t0: number): Player {
  const { ctx } = mix;
  const { def, steps, stepDur, events } = compile(track);
  const [echoSteps, feedback, wet] = def.echo;

  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(mix.music);

  // lead → out, and lead → delay ⟲ feedback → wet → out
  const lead = ctx.createGain();
  const delay = ctx.createDelay(1);
  const fb = ctx.createGain();
  const wetGain = ctx.createGain();
  delay.delayTime.value = echoSteps * stepDur;
  fb.gain.value = feedback;
  wetGain.gain.value = wet;
  lead.connect(out);
  lead.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(out);

  const leadBus: Bus = { ctx, out: lead, t0, rate: 1, end: t0 };
  const dryBus: Bus = { ctx, out, t0, rate: 1, end: t0 };
  const playLead = LEADS[track];
  const percLevel = track === "lobby" ? 0.6 : 1;

  let index = 0;
  let loop = 0;

  return {
    track,
    schedule(until) {
      const now = ctx.currentTime;
      for (;;) {
        const ev = events[index];
        const t = t0 + (loop * steps + ev.s) * stepDur;
        if (t >= until) break;
        // A throttled timer can fall behind; late notes are dropped rather
        // than fired all at once.
        if (t > now - 0.02) {
          const d = ev.l * stepDur;
          if (ev.k === LEAD) {
            leadBus.t0 = t;
            playLead(leadBus, ev.n, d * 0.94);
          } else {
            dryBus.t0 = t;
            if (ev.k === BASS) bassNote(dryBus, track, ev.n, d * 0.88);
            else percHit(dryBus, ev.n, percLevel, ev.s);
          }
        }
        if (++index === events.length) {
          index = 0;
          loop++;
        }
      }
    },
    fade(on, at) {
      // setTargetAtTime eases from whatever the gain is right now, so a fade
      // can be interrupted by another without a jump.
      out.gain.cancelScheduledValues(at);
      out.gain.setTargetAtTime(on ? def.gain : 0, at, FADE_TC);
    },
    position: (t) => (t - t0) / stepDur,
    stop() {
      out.disconnect();
      fb.disconnect();
    },
  };
}

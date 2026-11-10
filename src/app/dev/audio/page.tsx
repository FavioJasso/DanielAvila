"use client";

/**
 * Dev harness for the audio engine (src/game/audio).
 *
 * By ear:  unlock, every effect, each track, mute, suspend / resume, dispose.
 * By eye:  "Run offline test" renders everything through an
 *          OfflineAudioContext and shows numbers, waveforms and spectrograms.
 * Scripted (all return promises of plain JSON):
 *   window.__audioTest()           per item: duration, peak, RMS, silent, clipping
 *   window.__audioMixTest()        loop length + seam, options, pile-up, cross-fade, levels
 *   window.__audioLifecycleTest()  the live engine called in awkward orders
 *   window.__audioLiveTest(track)  live output vs offline render, across the loop seam
 * ?run=1 runs the offline test on load; ?run=all runs all three.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicTrack } from "@/game/contract";
import { createAudioEngine, type AudioEngineDev } from "@/game/audio";
import { createPlayer, trackInfo } from "@/game/audio/music";
import { activeLength, renderMusic, renderOffline, renderSfx, stats } from "@/game/audio/offline";
import { SFX_NAMES, triggerSfx } from "@/game/audio/sfx";
import { MASTER_GAIN, voice } from "@/game/audio/synth";
import { centroidHz, dominantHz, drawSpectrogram, drawWave } from "./analysis";
import {
  runAudioTest,
  runLifecycleTest,
  runLiveTest,
  runMixTest,
  TRACK_NAMES,
  type AudioTestRow,
  type Capture,
  type Check,
  type LiveReport,
  type MixReport,
} from "./tests";

declare global {
  interface Window {
    __audio?: AudioEngineDev;
    __audioTest?: () => Promise<AudioTestRow[]>;
    __audioMixTest?: () => Promise<MixReport>;
    __audioLifecycleTest?: () => Promise<Check[]>;
    __audioLiveTest?: (track?: MusicTrack, seconds?: number) => Promise<LiveReport>;
    /** The building blocks, for ad-hoc experiments from the console. */
    __audioLab?: typeof lab;
  }
}

const lab = {
  activeLength, centroidHz, createPlayer, dominantHz, renderMusic, renderOffline,
  renderSfx, stats, trackInfo, triggerSfx, voice,
};

/** Waveforms are drawn against the master gain, so loudness is comparable. */
const WAVE_SCALE = MASTER_GAIN;

function Trace({ capture, big }: { capture: Capture; big: boolean }) {
  const wave = useRef<HTMLCanvasElement>(null);
  const spec = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (wave.current) drawWave(wave.current, capture.samples, capture.length, WAVE_SCALE);
    if (spec.current) drawSpectrogram(spec.current, capture.samples, capture.length, capture.sampleRate);
  }, [capture]);
  return (
    <>
      <td className="px-1 py-0.5">
        <canvas ref={wave} width={big ? 330 : 250} height={big ? 96 : 40} className="block rounded-sm" />
      </td>
      <td className="px-1 py-0.5">
        <canvas ref={spec} width={big ? 420 : 300} height={big ? 96 : 40} className="block rounded-sm" />
      </td>
    </>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
      style={{ background: ok ? "var(--leaf)" : "var(--ruby)", color: "#fff" }}
    >
      {children}
    </span>
  );
}

export default function AudioHarnessPage() {
  const engineRef = useRef<AudioEngineDev | null>(null);
  if (!engineRef.current) engineRef.current = createAudioEngine();
  const engine = engineRef.current;

  const captures = useRef(new Map<string, Capture>());
  const [status, setStatus] = useState("locked");
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<AudioTestRow[] | null>(null);
  const [mix, setMix] = useState<MixReport | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  /** ?big=1 draws tall traces for close inspection. */
  const [big, setBig] = useState(false);

  const offline = useCallback(async () => {
    setBusy("Rendering every effect and track offline…");
    const result = await runAudioTest(captures.current);
    setRows(result);
    setBusy(null);
    return result;
  }, []);
  const mixTest = useCallback(async () => {
    setBusy("Rendering loops, pile-up and cross-fades…");
    const result = await runMixTest();
    setMix(result);
    setBusy(null);
    return result;
  }, []);
  const lifecycle = useCallback(async () => {
    setBusy("Driving a live engine through awkward call orders (about 12 s)…");
    const result = await runLifecycleTest();
    setChecks(result);
    setBusy(null);
    return result;
  }, []);

  useEffect(() => {
    window.__audio = engine;
    window.__audioTest = offline;
    window.__audioMixTest = mixTest;
    window.__audioLifecycleTest = lifecycle;
    window.__audioLiveTest = runLiveTest;
    window.__audioLab = lab;
    const poll = setInterval(() => {
      const i = engine.inspect();
      setStatus(
        [
          engine.unlocked ? `context ${i.state}` : "locked (press Unlock)",
          engine.muted ? "MUTED" : "sound on",
          `wanted ${i.wanted ?? "—"}`,
          `playing ${i.playing ?? "—"}`,
          `players ${i.players}`,
          `step ${i.position.toFixed(1)}`,
          `t ${i.time.toFixed(2)} s`,
          `effects played ${i.sfxPlayed}`,
        ].join("  ·  "),
      );
    }, 200);
    const params = new URLSearchParams(window.location.search);
    setBig(params.has("big"));
    const run = params.get("run");
    if (run) {
      void (async () => {
        await offline();
        if (run === "all") {
          await mixTest();
          await lifecycle();
        }
      })();
    }
    return () => {
      clearInterval(poll);
      engine.dispose();
    };
  }, [engine, offline, mixTest, lifecycle]);

  const music = (track: MusicTrack | null) => () => {
    engine.unlock();
    engine.setMusic(track);
  };

  return (
    <main
      className="min-h-screen p-4 font-body sm:p-6"
      style={{ background: "var(--ink)", color: "var(--cream)" }}
    >
      <h1 className="text-chunky text-3xl">Audio harness</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }} data-testid="status">
        {status}
      </p>

      <section className="panel-retro mt-4 p-4">
        <h2 className="text-pixel" style={{ color: "var(--star)" }}>Engine</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-retro btn-retro--gold" onClick={() => engine.unlock()}>Unlock</button>
          <button className="btn-retro" onClick={() => engine.setMuted(!engine.muted)}>Mute / unmute</button>
          <button className="btn-retro" onClick={() => engine.suspend()}>Suspend</button>
          <button className="btn-retro" onClick={() => engine.resume()}>Resume</button>
          <button className="btn-retro btn-retro--ruby" onClick={() => engine.dispose()}>Dispose</button>
        </div>

        <h2 className="text-pixel mt-4" style={{ color: "var(--star)" }}>Music</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRACK_NAMES.map((t) => {
            const info = trackInfo(t);
            return (
              <button key={t} className="btn-retro" onClick={music(t)}>
                {t}
                <span className="font-body text-xs opacity-80">
                  {info.bars} bars · {info.loopSeconds.toFixed(1)} s
                </span>
              </button>
            );
          })}
          <button className="btn-retro btn-retro--ghost" onClick={music(null)}>Silence</button>
        </div>

        <h2 className="text-pixel mt-4" style={{ color: "var(--star)" }}>Effects</h2>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Volume {volume.toFixed(2)}
            <input
              type="range" min={0} max={1.5} step={0.05} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            Rate {rate.toFixed(2)}
            <input
              type="range" min={0.5} max={2} step={0.05} value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {SFX_NAMES.map((name) => (
            <button
              key={name}
              className="btn-retro btn-retro--ghost"
              onClick={() => {
                engine.unlock();
                engine.play(name, { volume, rate });
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-retro mt-4 p-4">
        <h2 className="text-pixel" style={{ color: "var(--star)" }}>Offline checks</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn-retro" disabled={!!busy} onClick={() => void offline()}>Run offline test</button>
          <button className="btn-retro" disabled={!!busy} onClick={() => void mixTest()}>Run mix test</button>
          <button className="btn-retro" disabled={!!busy} onClick={() => void lifecycle()}>Run lifecycle test</button>
          {busy && <span className="text-sm" style={{ color: "var(--sky)" }}>{busy}</span>}
        </div>

        {rows && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs" data-testid="results">
              <thead style={{ color: "var(--sky)" }}>
                <tr>
                  <th className="px-1">item</th>
                  <th className="px-1">length s</th>
                  <th className="px-1">with tail s</th>
                  <th className="px-1">peak</th>
                  <th className="px-1">RMS</th>
                  <th className="px-1">pre-limiter</th>
                  <th className="px-1">Hz start → end</th>
                  <th className="px-1">status</th>
                  <th className="px-1">waveform (±{WAVE_SCALE})</th>
                  <th className="px-1">spectrogram (50 Hz – 12 kHz, log)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => {
                  const capture = captures.current.get(r.name);
                  const ok = !r.silent && !r.clipping;
                  return (
                    <tr key={r.name} style={{ borderTop: "1px solid var(--dusk)" }}>
                      <td className="px-1 font-bold">
                        {r.name}
                        {r.kind === "music" && <span className="font-normal opacity-70"> (8 s)</span>}
                      </td>
                      <td className="px-1">{r.nominal.toFixed(2)}{r.kind === "music" ? " loop" : ""}</td>
                      <td className="px-1">{r.duration.toFixed(2)}</td>
                      <td className="px-1">{r.peak.toFixed(3)}</td>
                      <td className="px-1">{r.rms.toFixed(3)}</td>
                      <td className="px-1">{r.prePeak.toFixed(3)}</td>
                      <td className="px-1">{r.startHz} → {r.endHz}</td>
                      <td className="px-1">
                        <Badge ok={ok}>{r.silent ? "SILENT" : r.clipping ? "CLIPPING" : "OK"}</Badge>
                      </td>
                      {capture ? <Trace capture={capture} big={big} /> : <td colSpan={2} />}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {mix && (
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2" data-testid="mix">
            <div>
              <h3 className="font-bold" style={{ color: "var(--sky)" }}>Loops</h3>
              {mix.loops.map((l) => (
                <p key={l.name} className="mt-1">
                  <Badge ok={l.pass}>{l.pass ? "OK" : "FAIL"}</Badge> <b>{l.name}</b> — {l.bars} bars of{" "}
                  {l.beatsPerBar}/4 at {l.bpm} bpm = {l.loopSeconds} s; voices {l.written.join("/")} of{" "}
                  {l.steps} steps; repeat error {l.repeatErrorDb} dB (one bar off: {l.offByOneBarDb} dB);
                  seam level {l.seamLevelDb} dB; seam jump {l.seamJump} vs loop {l.loopJump}
                </p>
              ))}
            </div>
            <div>
              <h3 className="font-bold" style={{ color: "var(--sky)" }}>Mix</h3>
              <p className="mt-1">
                <Badge ok={mix.options.pass}>{mix.options.pass ? "OK" : "FAIL"}</Badge> options — volume 0.5 →
                ×{mix.options.halfVolumeRatio}; rate 2 → length ×{mix.options.doubleRateLength}, pitch ×
                {mix.options.doubleRatePitch}; step spread ×{mix.options.stepSpread}
              </p>
              <p className="mt-1">
                <Badge ok={!mix.pileUp.clipping}>{mix.pileUp.clipping ? "CLIPPING" : "OK"}</Badge> pile-up —
                output peak {mix.pileUp.peak} (pre-limiter {mix.pileUp.prePeak})
              </p>
              <p className="mt-1">
                <Badge ok={mix.crossfade.pass}>{mix.crossfade.pass ? "OK" : "FAIL"}</Badge> cross-fade — out{" "}
                {mix.crossfade.out.join(" / ")}; in {mix.crossfade.in.join(" / ")} at 0.1 / 0.2 / 0.4 / 0.8 s;
                peak {mix.crossfade.peakDuring} during vs {mix.crossfade.peakAround} around
              </p>
              <p className="mt-1">
                <Badge ok={mix.levels.pass}>{mix.levels.pass ? "OK" : "FAIL"}</Badge> levels — music{" "}
                {mix.levels.musicRmsDb} dB, effects {mix.levels.sfxRmsDb} dB (effects +
                {mix.levels.sfxOverMusicDb} dB)
              </p>
            </div>
          </div>
        )}

        {checks && (
          <ul className="mt-4 grid gap-1 text-xs md:grid-cols-2" data-testid="lifecycle">
            {checks.map((c) => (
              <li key={c.name}>
                <Badge ok={c.pass}>{c.pass ? "OK" : "FAIL"}</Badge> {c.name}
                {c.detail && <span style={{ color: "var(--muted)" }}> — {c.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

"use client";

/**
 * Dev harness for the game engine (src/game/engine): a full-viewport canvas
 * running the real engine against whatever world / avatar / audio modules
 * the registries point at, with debug buttons and a live readout of the UI
 * store. Stand-ins for the real HUD: a white flash layer, a course overlay
 * placeholder, and Esc (pause in the lobby, exit inside a course).
 *
 * Query flags: ?autostart  skip the title    ?hud=0  hide the debug panels
 *              ?rm  force reduced motion      ?touch  force touch mode
 *              ?avatar=real / ?world=real  use src/game/avatar / src/game/world
 *              instead of the registry (to check framing before integration)
 *
 * Scripted checks go through `window.__da64` (see engine/devHook.ts).
 */
import { useEffect, useRef, useState } from "react";
import { DOORS, RESUME_STAR, type GameApi, type OverlayId } from "@/game/contract";
import { createGame } from "@/game/engine";
import { setModuleOverrides } from "@/game/engine/overrides";
import { ui, useUi } from "@/game/store";

const IDS: OverlayId[] = [...DOORS.map((d) => d.id), "resume"];

function titleOf(id: OverlayId): string {
  if (id === "resume") return RESUME_STAR.title;
  const door = DOORS.find((d) => d.id === id);
  return door ? `Course ${door.courseNumber}: ${door.courseTitle}` : id;
}

export default function EngineHarness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  /** Bumping this disposes the engine and creates a fresh one. */
  const [generation, setGeneration] = useState(0);
  const [showHud, setShowHud] = useState(true);
  const state = useUi((s) => s);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    setShowHud(params.get("hud") !== "0");
    const reducedMotion =
      params.has("rm") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch =
      params.has("touch") ||
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0;
    let cancelled = false;
    let api: GameApi | null = null;
    // ?avatar=real / ?world=real: try the real module before integration.
    // Loaded dynamically so a module that is mid-edit cannot break this page.
    const wantAvatar = params.get("avatar") === "real";
    const wantWorld = params.get("world") === "real";
    Promise.all([
      wantAvatar ? import("@/game/avatar").then((m) => m.createAvatar) : null,
      wantWorld ? import("@/game/world").then((m) => m.createWorld) : null,
    ])
      .catch((error) => {
        console.warn("[engine harness] real module failed to load, using the registry", error);
        return [null, null] as const;
      })
      .then(([createAvatar, createWorld]) => {
        if (cancelled) return;
        setModuleOverrides({ createAvatar, createWorld });
        ui.reset();
        api = createGame({ canvas, reducedMotion, touch });
        apiRef.current = api;
        if (params.has("autostart")) api.start();
      });
    return () => {
      cancelled = true;
      api?.dispose();
      apiRef.current = null;
      setModuleOverrides({ createAvatar: null, createWorld: null });
    };
  }, [generation]);

  // What GameRoot / CourseOverlay do with Esc in the real app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      const s = ui.get();
      if (s.overlay) apiRef.current?.exitCourse();
      else apiRef.current?.setPaused(!s.paused);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const api = () => apiRef.current;
  const covering = state.overlay !== null && state.overlay !== "resume";

  return (
    <main style={{ position: "fixed", inset: 0, background: "#0a0f2c", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      {/* white warp flash: restarts whenever ui.flash changes */}
      {state.flash > 0 && (
        <div
          key={state.flash}
          data-testid="flash"
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            pointerEvents: "none",
            animation: state.reducedMotion ? "da64-flash 0.2s linear both" : "da64-flash 0.55s ease-out both",
          }}
        />
      )}

      {/* course overlay placeholder */}
      {state.overlay && (
        <section
          data-testid="overlay"
          style={
            covering
              ? { ...overlayBase, inset: 0, background: "#131b4d" }
              : {
                  ...overlayBase,
                  left: "50%",
                  bottom: 24,
                  transform: "translateX(-50%)",
                  width: "min(92vw, 420px)",
                  padding: 20,
                  borderRadius: 14,
                  background: "rgba(19,27,77,0.94)",
                  border: "3px solid #ffc93c",
                }
          }
        >
          <h1 style={{ margin: 0, fontSize: covering ? 34 : 22, color: "#ffc93c" }}>
            {titleOf(state.overlay)}
          </h1>
          <p style={{ margin: 0, opacity: 0.8 }}>overlay placeholder (the real one is HTML content)</p>
          <button style={bigButton} onClick={() => api()?.exitCourse()}>
            [ JUMP OUT OF PAINTING (ESC) ]
          </button>
        </section>
      )}

      {state.toast && (
        <div data-testid="toast" style={toastStyle}>
          {state.toast}
        </div>
      )}

      {showHud && (
        <>
          <pre data-testid="readout" style={readoutStyle}>
            {[
              `phase       ${state.phase}${state.paused ? "  (PAUSED)" : ""}`,
              `webgl       ${state.webgl}  ready=${state.engineReady}`,
              `control     ${state.controlMode}`,
              `focusedDoor ${state.focusedDoor}   nearDoor ${state.nearDoor}`,
              `nearStar    ${state.nearStar}`,
              `overlay     ${state.overlay ?? "-"}`,
              `stars       ${state.collected.length}  [${state.collected.join(" ")}]`,
              `flash       ${state.flash}   toast ${state.toast ?? "-"}`,
              `touch ${state.touch}  reducedMotion ${state.reducedMotion}`,
            ].join("\n")}
          </pre>

          <div data-testid="controls" style={panelStyle}>
            <button style={button} onClick={() => api()?.start()}>
              start
            </button>
            <button style={button} onClick={() => api()?.cycleDoor(-1)}>
              &lt; prev
            </button>
            <button style={button} onClick={() => api()?.cycleDoor(1)}>
              next &gt;
            </button>
            {IDS.map((id) => (
              <button key={id} style={button} onClick={() => api()?.enterCourse(id)}>
                enter {id}
              </button>
            ))}
            {IDS.map((id) => (
              <button
                key={`${id}-instant`}
                style={button}
                onClick={() => api()?.enterCourse(id, { instant: true })}
              >
                warp {id}
              </button>
            ))}
            <button style={button} onClick={() => api()?.exitCourse()}>
              exit
            </button>
            <button style={button} onClick={() => api()?.setPaused(!ui.get().paused)}>
              {state.paused ? "unpause" : "pause"}
            </button>
            <button style={button} onClick={() => api()?.jump()}>
              jump
            </button>
            <button style={button} onClick={() => setGeneration((g) => g + 1)}>
              dispose + recreate
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes da64-flash { from { opacity: 1 } to { opacity: 0 } }`}</style>
    </main>
  );
}

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const overlayBase: React.CSSProperties = {
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  color: "#fff4d6",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
};

const bigButton: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 18px",
  font: `600 14px ${mono}`,
  color: "#0a0f2c",
  background: "#ffc93c",
  border: "3px solid #0a0f2c",
  borderRadius: 10,
  cursor: "pointer",
};

const toastStyle: React.CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  padding: "6px 14px",
  font: `700 14px ${mono}`,
  color: "#0a0f2c",
  background: "#ffc93c",
  borderRadius: 8,
  pointerEvents: "none",
};

// Top right, so the top-left corner of the canvas stays free: the screenshot
// driver's wheel events land at (0, 0).
const readoutStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  margin: 0,
  padding: "6px 8px",
  font: `11px/1.35 ${mono}`,
  color: "#d7f7ff",
  background: "rgba(10,15,44,0.72)",
  borderRadius: 6,
  pointerEvents: "none",
  maxWidth: "calc(100vw - 16px)",
  whiteSpace: "pre-wrap",
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: 8,
  right: 8,
  bottom: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  pointerEvents: "none",
};

const button: React.CSSProperties = {
  pointerEvents: "auto",
  padding: "5px 8px",
  font: `11px ${mono}`,
  color: "#fff4d6",
  background: "rgba(19,27,77,0.86)",
  border: "1px solid #8fc1ff",
  borderRadius: 5,
  cursor: "pointer",
};

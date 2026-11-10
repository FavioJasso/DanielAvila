"use client";

/**
 * GameRoot — the HTML layer of DANIEL AVILA 64.
 *
 * Mounts the fixed full-viewport stage (canvas + title screen, HUD, pause
 * menu, course overlay, toasts, warp flash), lazy-loads the engine after the
 * first paint and wires the UI to it. It talks to the engine only through
 * `GameApi` (commands) and the `ui` store (state), so the mock engine and
 * the real one are interchangeable.
 *
 * The stage is server-rendered in its title state, so it must not touch
 * `window` / `document` while rendering — everything browser-specific lives
 * in effects and event handlers.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CourseOverlay } from "@/components/course/CourseOverlay";
import type { CreateGame, GameApi } from "@/game/contract";
import { getAudio, loadGame } from "@/game/services";
import { hydrateUiFromStorage, ui, useUi } from "@/game/store";
import { GameCommandsContext, type GameCommands } from "./commands";
import { FlashLayer } from "./FlashLayer";
import { LobbyHud } from "./LobbyHud";
import { ContextLostNotice, WebglNotice } from "./Notices";
import { PauseMenu } from "./PauseMenu";
import { TitleScreen } from "./TitleScreen";
import { ToastLayer } from "./ToastLayer";
import {
  hashTargetsPlainPage,
  isActivatableTarget,
  isCoarsePointer,
  isTypingTarget,
  PLAIN_ID,
  prefersReducedMotion,
  sfx,
  toggleMuted,
  whenIdle,
} from "./util";
import "./game.css";

const START_BUTTON_ID = "da64-start";
const PLAY_BUTTON_SELECTOR = "[data-da64-play]";

export interface GameRootProps {
  /**
   * Engine loader. Defaults to the lazy `loadGame()` from the service
   * registry; the dev harness swaps it to exercise slow and failing loads.
   * Must be referentially stable.
   */
  load?: () => Promise<CreateGame>;
}

/**
 * The element to make inert while the game covers the page: `#plain-portfolio`
 * widened to its outermost wrapper that does not also contain the stage, so
 * the plain page's header, skip link and footer (siblings of its <main>) are
 * taken out of the tab order too — not just the main content.
 */
function plainPageRoot(stage: HTMLElement | null): HTMLElement | null {
  let el = document.getElementById(PLAIN_ID);
  if (!el) return null;
  for (;;) {
    const parent: HTMLElement | null = el.parentElement;
    if (!parent || parent === document.body || (stage && parent.contains(stage))) return el;
    el = parent;
  }
}

/** Back to a clean title state whenever an engine instance goes away. */
function resetTransientUi(): void {
  ui.set({
    engineReady: false,
    // "unavailable" is sticky: it is why we are in plain mode.
    webgl: ui.get().webgl === "unavailable" ? "unavailable" : "pending",
    phase: "title",
    paused: false,
    overlay: null,
    focusedDoor: -1,
    nearDoor: -1,
    nearStar: false,
    toast: null,
  });
}

export function GameRoot({ load = loadGame }: GameRootProps) {
  const mode = useUi((s) => s.mode);
  const phase = useUi((s) => s.phase);
  const paused = useUi((s) => s.paused);
  const overlay = useUi((s) => s.overlay);
  const webgl = useUi((s) => s.webgl);
  const engineReady = useUi((s) => s.engineReady);

  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  /** The control that had keyboard focus when the pause menu opened. */
  const pauseOpener = useRef<HTMLElement | null>(null);
  /** Bumped to throw the canvas away and boot a fresh engine on a new one. */
  const [epoch, setEpoch] = useState(0);
  /** Bumped when `apiRef` is (re)assigned, so effects can react to it. */
  const [apiVersion, setApiVersion] = useState(0);
  const [startQueued, setStartQueued] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const commands = useMemo<GameCommands>(
    () => ({
      pressStart() {
        const s = ui.get();
        if (s.mode !== "game" || s.phase !== "title" || s.webgl === "lost") return;
        // We are inside the click / key gesture now; a queued start below is
        // not, so the audio context has to be unlocked here.
        getAudio().unlock();
        const api = apiRef.current;
        if (api && s.engineReady) api.start();
        else setStartQueued(true);
      },
      cycleDoor: (delta) => apiRef.current?.cycleDoor(delta),
      enterCourse: (id, opts) => apiRef.current?.enterCourse(id, opts),
      exitCourse: () => apiRef.current?.exitCourse(),
      setStick: (x, y) => apiRef.current?.setStick(x, y),
      jump: () => apiRef.current?.jump(),
      openPause() {
        const s = ui.get();
        if (s.phase !== "lobby" || s.overlay || s.paused || s.webgl === "lost") return;
        // Remember the focused control now: the HUD goes inert (and so blurs
        // it) the moment the menu opens. Pointer clicks have already let go
        // of focus, so this is only ever a control a keyboard user was on.
        const active = document.activeElement;
        pauseOpener.current =
          active instanceof HTMLElement && active !== document.body ? active : null;
        apiRef.current?.setPaused(true);
      },
      closePause() {
        if (!ui.get().paused) return;
        sfx("uiBack");
        apiRef.current?.setPaused(false);
      },
      fastTravel(id) {
        sfx("uiSelect");
        apiRef.current?.setPaused(false);
        apiRef.current?.enterCourse(id, { instant: true });
      },
      goPlain() {
        getAudio().setMusic(null);
        ui.set({ mode: "plain" });
      },
      reload3d: () => setEpoch((n) => n + 1),
    }),
    [],
  );

  /* ---- once, on the client ------------------------------------------ */
  useEffect(() => {
    hydrateUiFromStorage();
    ui.set({ touch: isCoarsePointer(), reducedMotion: prefersReducedMotion() });
    // A shared or reloaded link into the plain page ("#plain-portfolio",
    // "#contact", …) opens the plain version rather than the title screen.
    // The browser has already scrolled and focused that target itself.
    if (hashTargetsPlainPage()) {
      arrivedByLink.current = true;
      ui.set({ mode: "plain" });
    }
    setHydrated(true);
  }, []);

  /* ---- mode: scroll lock, inert plain page, focus hand-off ----------- */
  const lastMode = useRef(mode);
  const arrivedByLink = useRef(false);
  useEffect(() => {
    const was = lastMode.current;
    lastMode.current = mode;
    if (mode !== "game") {
      // Leaving the game: put focus at the start of the plain content (its
      // <main> is focusable for exactly this), else on the way back in.
      if (arrivedByLink.current) arrivedByLink.current = false;
      else if (was === "game") {
        const main = document.getElementById(PLAIN_ID);
        const target = main?.hasAttribute("tabindex")
          ? main
          : document.querySelector<HTMLElement>(PLAY_BUTTON_SELECTOR);
        target?.focus({ preventScroll: true });
      }
      return;
    }
    const root = document.documentElement;
    const plain = plainPageRoot(stageRef.current);
    root.dataset.da64 = "game";
    plain?.setAttribute("inert", "");
    if (was === "plain") {
      document.getElementById(START_BUTTON_ID)?.focus({ preventScroll: true });
    }
    return () => {
      delete root.dataset.da64;
      plain?.removeAttribute("inert");
    };
  }, [mode]);

  /* ---- engine lifecycle ---------------------------------------------- */
  useEffect(() => {
    if (mode !== "game") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let api: GameApi | null = null;

    const boot = async () => {
      try {
        const createGame = await load();
        if (cancelled) return;
        api = createGame({
          canvas,
          reducedMotion: prefersReducedMotion(),
          touch: isCoarsePointer(),
        });
        apiRef.current = api;
        setApiVersion((n) => n + 1);
      } catch (err) {
        if (cancelled) return;
        console.warn("[da64] The 3D engine could not start; showing the plain version.", err);
        ui.set({ webgl: "unavailable", mode: "plain" });
      }
    };
    // Defer the three.js chunk until the title screen has painted.
    const cancelIdle = whenIdle(() => void boot());

    return () => {
      cancelled = true;
      cancelIdle();
      if (apiRef.current === api) apiRef.current = null;
      try {
        api?.dispose();
      } catch (err) {
        console.warn("[da64] Engine dispose failed.", err);
      }
      setStartQueued(false);
      resetTransientUi();
    };
  }, [mode, epoch, load]);

  /* ---- PRESS START before the engine was ready ------------------------ */
  useEffect(() => {
    if (!startQueued || !engineReady) return;
    const api = apiRef.current;
    if (!api) return;
    setStartQueued(false);
    api.start();
  }, [startQueued, engineReady, apiVersion]);

  /* ---- pause menu closed: give focus back to what opened it ----------- */
  // Runs after the commit that un-inerts the HUD, so the control can take
  // focus again. (After a fast travel the HUD is inert and this is a no-op.)
  useEffect(() => {
    if (paused) return;
    const opener = pauseOpener.current;
    pauseOpener.current = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, [paused]);

  /* ---- browser Back / Forward between the game and the plain page ------ */
  // Going plain pushes "#plain-portfolio"; Back then lands on the bare URL
  // and should bring the game back, Forward should return to the plain
  // page. In-page links inside the plain page ("#contact", "#") keep it.
  useEffect(() => {
    const onHashChange = () => {
      const s = ui.get();
      if (s.mode === "game" && hashTargetsPlainPage()) {
        getAudio().setMusic(null);
        ui.set({ mode: "plain" });
      } else if (
        s.mode === "plain" &&
        s.webgl !== "unavailable" &&
        !window.location.href.includes("#")
      ) {
        ui.set({ mode: "game" });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  /* ---- no WebGL → plain version --------------------------------------- */
  useEffect(() => {
    if (webgl === "unavailable" && mode === "game") ui.set({ mode: "plain" });
  }, [webgl, mode]);

  /* ---- keyboard ------------------------------------------------------- */
  // Capture phase: the decision is made on the state as it was when the key
  // went down, before any other handler (e.g. CourseOverlay closing itself on
  // Esc) has changed it — so Esc is never handled twice. Movement keys are
  // the engine's and pass through untouched.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const s = ui.get();
      if (s.mode !== "game" || isTypingTarget(e.target)) return;

      if (e.key === "Escape") {
        if (s.overlay) return; // CourseOverlay owns Esc while it is open
        if (s.paused) commands.closePause();
        else commands.openPause();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        toggleMuted();
        return;
      }
      if (
        (e.key === "Enter" || e.key === " ") &&
        s.phase === "title" &&
        !isActivatableTarget(e.target)
      ) {
        e.preventDefault();
        commands.pressStart();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [commands]);

  const game = mode === "game";

  return (
    <GameCommandsContext.Provider value={commands}>
      {/* Without JavaScript the stage can never start: show the plain page. */}
      <noscript>
        <style>{".da64-stage{display:none!important}"}</style>
      </noscript>

      {!game && webgl === "unavailable" && !noticeDismissed && (
        <WebglNotice onDismiss={() => setNoticeDismissed(true)} />
      )}

      <section
        ref={stageRef}
        className="da64-stage"
        hidden={!game}
        data-hydrated={hydrated || undefined}
        aria-label="Daniel Avila 64, an interactive 3D portfolio"
        aria-describedby="da64-stage-desc"
      >
        {game && (
          <>
            <p id="da64-stage-desc" className="da64-sr">
              A playable low-poly castle lobby with five doors: Education, Skills, Career and Labs,
              Certifications, and About and Contact. Every section can also be opened from the
              on-screen buttons and the pause menu, and a plain HTML version is one link away.
            </p>

            {/* A fresh canvas per engine instance: a disposed or lost WebGL
                context is never handed to the next engine. */}
            <canvas key={epoch} ref={canvasRef} className="da64-canvas" aria-hidden="true" />

            {phase !== "title" && <LobbyHud />}
            {(phase === "title" || phase === "intro") && (
              <TitleScreen leaving={phase !== "title"} starting={startQueued} />
            )}
            {/* A course overlay is plain HTML and keeps working without the
                3D view, so the notice waits until it closes. */}
            {webgl === "lost" && !overlay && <ContextLostNotice />}
            {paused && !overlay && webgl !== "lost" && <PauseMenu />}
            {overlay && <CourseOverlay id={overlay} onExit={commands.exitCourse} />}
            <ToastLayer />
            <FlashLayer />
          </>
        )}
      </section>
    </GameCommandsContext.Provider>
  );
}

/**
 * "Play the 3D version" — for the plain page's header. Switches back to game
 * mode, which boots a fresh engine. Hidden when WebGL is unavailable.
 */
export function PlayButton({
  className = "btn-retro",
  children = "Play the 3D version",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const webgl = useUi((s) => s.webgl);
  if (webgl === "unavailable") return null;
  return (
    <button
      type="button"
      className={className}
      data-da64-play=""
      onClick={() => {
        // Drop the plain-page anchor so a reload comes back to the game.
        if (hashTargetsPlainPage()) {
          window.history.replaceState(
            window.history.state,
            "",
            window.location.pathname + window.location.search,
          );
        }
        ui.set({ mode: "game" });
      }}
    >
      {children}
    </button>
  );
}

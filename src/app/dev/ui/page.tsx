"use client";

/**
 * Dev harness for the game UI: <GameRoot /> over a placeholder plain page.
 * The (mock or real) engine drives the store; these query parameters poke
 * the store once the engine is ready so every state can be screenshotted.
 *
 *   ?state=title | lobby | door | near | star | pause | touch | toast |
 *          course | lost | plain | nowebgl | throw
 *   &door=0..4      which door "door" / "near" / "course" use (default 2)
 *   &stars=0..6     pretend this many stars are collected
 *   &touch=1 | 0    force touch controls on / off
 *   &toast=Text     toast message for state=toast
 *   &delay=ms       delay the engine load (to test the queued PRESS START)
 *   &engine=real    use the real engine (src/game/engine) instead of the registry's
 *
 * `throw` makes the engine loader fail (→ plain mode + notice); `nowebgl`
 * simulates the engine reporting that WebGL is unavailable.
 * For scripted checks: window.__da64ui = { ui, state() } and
 * window.__da64calls (every GameApi call the UI made, in order).
 */
import { useEffect } from "react";
import { PlainPortfolio } from "@/components/course/PlainPortfolio";
import { GameRoot, PlayButton } from "@/components/game/GameRoot";
import { DOORS, type CreateGame, type OverlayId } from "@/game/contract";
import { loadGame } from "@/game/services";
import { ui, type UiState } from "@/game/store";

const ALL_STARS: OverlayId[] = [...DOORS.map((d) => d.id), "resume"];

/**
 * Module-level so its identity is stable; reads the query when called.
 * The engine it returns is wrapped so every command the UI sends is recorded
 * in `window.__da64calls` (e.g. "setStick(0.5,-1)"), for scripted checks.
 */
async function harnessLoad(): Promise<CreateGame> {
  const params = new URLSearchParams(window.location.search);
  const delay = Number(params.get("delay") ?? 0);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  if (params.get("state") === "throw") throw new Error("harness: simulated engine failure");
  // `?engine=real` runs the real three.js engine instead of whatever the
  // registry points at, for integration checks before the registry flips.
  // Dev-only harness code; module code always goes through the registry.
  const createGame =
    params.get("engine") === "real"
      ? (await import("@/game/engine")).createGame
      : await loadGame();

  const calls: string[] = [];
  (window as unknown as { __da64calls: string[] }).__da64calls = calls;
  return (opts) => {
    const api = createGame(opts);
    return new Proxy(api, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          calls.push(`${String(key)}(${args.map((a) => JSON.stringify(a)).join(",")})`);
          return value.apply(target, args);
        };
      },
    });
  };
}

function patchFor(params: URLSearchParams): Partial<UiState> {
  const state = params.get("state") ?? "title";
  const door = Math.min(DOORS.length - 1, Math.max(0, Number(params.get("door") ?? 2) || 0));
  const patch: Partial<UiState> = {};

  if (params.has("stars")) {
    patch.collected = ALL_STARS.slice(0, Math.max(0, Number(params.get("stars")) || 0));
  }
  if (params.has("touch")) patch.touch = params.get("touch") !== "0";

  switch (state) {
    case "lobby":
      patch.phase = "lobby";
      break;
    case "door":
      Object.assign(patch, { phase: "lobby", focusedDoor: door, controlMode: "guided" });
      break;
    case "near":
      Object.assign(patch, { phase: "lobby", focusedDoor: door, nearDoor: door });
      break;
    case "star":
      Object.assign(patch, { phase: "lobby", nearStar: true });
      break;
    case "pause":
      Object.assign(patch, { phase: "lobby", paused: true });
      break;
    case "touch":
      Object.assign(patch, { phase: "lobby", touch: true });
      break;
    case "toast":
      Object.assign(patch, { phase: "lobby", toast: params.get("toast") ?? "New star!" });
      break;
    case "course":
      Object.assign(patch, { phase: "course", overlay: DOORS[door].id });
      break;
    case "lost":
      Object.assign(patch, { phase: "lobby", webgl: "lost" });
      break;
    default:
      break;
  }
  return patch;
}

export default function UiHarnessPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    (window as unknown as { __da64ui: unknown }).__da64ui = { ui, state: () => ui.get() };

    // These two never get an engine, so there is nothing to wait for.
    if (state === "plain") {
      ui.set({ mode: "plain" });
      return;
    }
    if (state === "nowebgl") {
      ui.set({ webgl: "unavailable", mode: "plain" });
      return;
    }

    // Everything else is applied once, right after the engine reports ready
    // (the engine resets the store to the title state when it is created).
    // Deferred a tick so the poke lands after the engine's own start-up writes.
    let timer = 0;
    const apply = () => {
      timer = window.setTimeout(() => ui.set(patchFor(params)), 0);
    };
    let off = () => {};
    if (ui.get().engineReady) apply();
    else {
      off = ui.subscribe(() => {
        if (!ui.get().engineReady) return;
        off();
        apply();
      });
    }
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <PlainPortfolio actions={<PlayButton />} />
      <GameRoot load={harnessLoad} />
    </>
  );
}

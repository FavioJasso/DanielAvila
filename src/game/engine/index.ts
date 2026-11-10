/**
 * DANIEL AVILA 64 — game engine entry point.
 *
 * `createGame` builds the renderer, the world and the avatar (through the
 * module registry), starts the frame loop on the title orbit and returns the
 * command interface the React UI drives. State flows back through the `ui`
 * store. See game.ts for how it all fits together.
 */
import type { CreateGame, GameApi } from "../contract";
import { ui } from "../store";
import { Game } from "./game";
import { createView } from "./renderer";

/** Returned when the 3D game cannot run; every command is a safe no-op. */
const INERT: GameApi = {
  start() {},
  cycleDoor() {},
  goToDoor() {},
  enterCourse() {},
  exitCourse() {},
  setStick() {},
  jump() {},
  setPaused() {},
  dispose() {},
};

export const createGame: CreateGame = (opts) => {
  const view = createView(opts.canvas, opts.touch);
  if (!view) {
    // No WebGL: the semantic HTML version takes over.
    ui.set({ webgl: "unavailable", mode: "plain" });
    return INERT;
  }
  try {
    return new Game(opts, view).api;
  } catch (error) {
    // A module failed to build its scene. Do not leave a dead canvas behind.
    console.error("[da64] engine failed to start", error);
    view.dispose();
    ui.set({ webgl: "unavailable", mode: "plain" });
    return INERT;
  }
};

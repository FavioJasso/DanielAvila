"use client";

/**
 * The commands the HTML layer can issue. `GameRoot` owns the `GameApi`
 * instance (which may not exist yet, or may be swapped when the engine is
 * remounted) and exposes this stable facade through context, so the HUD,
 * title screen and pause menu never hold an engine reference themselves.
 */
import { createContext, useContext } from "react";
import type { OverlayId } from "@/game/contract";

export interface GameCommands {
  /** PRESS START — starts now, or as soon as the engine is ready. */
  pressStart(): void;
  cycleDoor(delta: 1 | -1): void;
  enterCourse(id: OverlayId, opts?: { instant?: boolean }): void;
  exitCourse(): void;
  setStick(x: number, y: number): void;
  jump(): void;
  openPause(): void;
  /** Close the pause menu with the "back" sound. */
  closePause(): void;
  /** Close the pause menu and cut straight to a course overlay. */
  fastTravel(id: OverlayId): void;
  /** Switch to the plain HTML version (disposes the engine). */
  goPlain(): void;
  /** Throw the canvas away and boot a fresh engine (after a lost context). */
  reload3d(): void;
}

export const GameCommandsContext = createContext<GameCommands | null>(null);

export function useGameCommands(): GameCommands {
  const commands = useContext(GameCommandsContext);
  if (!commands) throw new Error("useGameCommands must be used inside <GameRoot>");
  return commands;
}

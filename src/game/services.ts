/**
 * UI-safe service registry — nothing here may import three.js (directly or
 * transitively), because the React UI imports this file in the first-paint
 * bundle. Entries point at the real modules
 * (stubs in ./stubs remain for isolated tests):
 *
 *   audio   → ./audio          (createAudio)
 *   art     → ./art/paintings  (createPaintingCanvas, canvas-2D only)
 *             ./art/emblem     (createEmblemCanvas, canvas-2D only)
 *   engine  → ./engine         (createGame, lazy-loaded with three.js)
 *
 * Module code must import its collaborators from here or from ./modules,
 * never from another module's folder directly.
 */
import type {
  AudioEngine,
  CreateEmblemCanvas,
  CreateGame,
  CreatePaintingCanvas,
} from "./contract";
import { persistMuted, ui } from "./store";
import { createAudio } from "./audio";
import { createPaintingCanvas as realPainting } from "./art/paintings";
import { createEmblemCanvas as realEmblem } from "./art/emblem";

export const createPaintingCanvas: CreatePaintingCanvas = realPainting;
export const createEmblemCanvas: CreateEmblemCanvas = realEmblem;

let audio: AudioEngine | null = null;
/** The single shared audio engine (client only). */
export function getAudio(): AudioEngine {
  if (!audio) {
    audio = createAudio();
    audio.setMuted(ui.get().muted);
  }
  return audio;
}

/** Toggle sound everywhere: audio engine + persisted UI state. */
export function setMuted(muted: boolean): void {
  getAudio().setMuted(muted);
  persistMuted(muted);
}

/**
 * Lazy-load the engine (and with it three.js) so the title screen can paint
 * before the 3D bundle arrives.
 */
export async function loadGame(): Promise<CreateGame> {
  const mod = await import("./engine");
  return mod.createGame;
}

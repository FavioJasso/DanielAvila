/**
 * UI state shared between the imperative game engine and the React UI.
 * A tiny external store (no dependency): the engine calls `ui.set(...)`
 * (never per frame — only on state changes), React reads with `useUi`.
 */
import { useSyncExternalStore } from "react";
import type { OverlayId, Phase } from "./contract";

export interface UiState {
  /** `plain` = the semantic HTML version (no 3D). */
  mode: "game" | "plain";
  webgl: "pending" | "ok" | "unavailable" | "lost";
  /** The engine chunk has loaded and the first frame has rendered. */
  engineReady: boolean;
  phase: Phase;
  paused: boolean;
  muted: boolean;
  /** Guided-navigation target door, -1 = none (LOBBY). */
  focusedDoor: number;
  /** Door whose proximity sensor is tripped, -1 = none. Drives the top banner. */
  nearDoor: number;
  /** Avatar is next to the résumé star pedestal. */
  nearStar: boolean;
  /** The open HTML overlay, if any. */
  overlay: OverlayId | null;
  /** Stars earned by visiting overlays (persisted). */
  collected: OverlayId[];
  /** The control scheme used most recently (for HUD hints). */
  controlMode: "guided" | "free";
  /** Coarse pointer → show thumbstick and jump button. */
  touch: boolean;
  reducedMotion: boolean;
  /** Incremented by the engine to trigger the white warp flash. */
  flash: number;
  /** Short HUD message, e.g. "New star!". */
  toast: string | null;
}

const initial: UiState = {
  mode: "game",
  webgl: "pending",
  engineReady: false,
  phase: "title",
  paused: false,
  muted: false,
  focusedDoor: -1,
  nearDoor: -1,
  nearStar: false,
  overlay: null,
  collected: [],
  controlMode: "guided",
  touch: false,
  reducedMotion: false,
  flash: 0,
  toast: null,
};

type Listener = () => void;

let state: UiState = initial;
const listeners = new Set<Listener>();

export const ui = {
  get: (): UiState => state,
  set(patch: Partial<UiState>): void {
    let changed = false;
    for (const k in patch) {
      const key = k as keyof UiState;
      if (!Object.is(state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Test / harness helper. */
  reset(): void {
    state = initial;
    listeners.forEach((l) => l());
  },
};

const getServerSnapshot = (): UiState => initial;

/** `const phase = useUi((s) => s.phase)` — selector must return a stable value. */
export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    ui.subscribe,
    () => selector(state),
    () => selector(getServerSnapshot()),
  );
}

/* ------------------------------------------------------------------ */
/* Persistence + shared actions                                        */
/* ------------------------------------------------------------------ */

const KEY_MUTED = "da64:muted";
const KEY_COLLECTED = "da64:collected";
const ALL: OverlayId[] = [
  "education",
  "skills",
  "career",
  "certifications",
  "about",
  "resume",
];

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — ignore */
  }
}

/** Call once on the client after mount. */
export function hydrateUiFromStorage(): void {
  if (typeof window === "undefined") return;
  const muted = read(KEY_MUTED) === "1";
  let collected: OverlayId[] = [];
  try {
    const raw = JSON.parse(read(KEY_COLLECTED) ?? "[]");
    if (Array.isArray(raw)) collected = ALL.filter((id) => raw.includes(id));
  } catch {
    /* ignore */
  }
  ui.set({ muted, collected });
}

/** Total stars available: five courses + the résumé star. */
export const TOTAL_STARS = ALL.length;

/** Mark an overlay as visited. Returns true if this earned a new star. */
export function collectStar(id: OverlayId): boolean {
  if (state.collected.includes(id)) return false;
  const collected = [...state.collected, id];
  ui.set({ collected });
  write(KEY_COLLECTED, JSON.stringify(collected));
  return true;
}

/** Persist the mute preference (the caller also tells the audio engine). */
export function persistMuted(muted: boolean): void {
  ui.set({ muted });
  write(KEY_MUTED, muted ? "1" : "0");
}

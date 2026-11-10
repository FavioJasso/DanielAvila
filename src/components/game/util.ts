/**
 * Small helpers shared by the game UI components. Client-only functions are
 * safe to import on the server (they only touch `window` when called).
 */
import type { SfxName } from "@/game/contract";
import { getAudio, setMuted } from "@/game/services";
import { ui } from "@/game/store";

/** The plain HTML version's root element (owned by the course module). */
export const PLAIN_ID = "plain-portfolio";
export const PLAIN_HASH = `#${PLAIN_ID}`;

/**
 * True when the URL fragment points at the plain page or something inside
 * it ("#plain-portfolio", "#contact", …). Such a link is a request for that
 * content, so the page opens in plain mode instead of hiding it behind the
 * title screen.
 */
export function hashTargetsPlainPage(): boolean {
  const hash = window.location.hash;
  if (hash.length < 2) return false;
  const plain = document.getElementById(PLAIN_ID);
  if (!plain) return false;
  try {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    return target !== null && plain.contains(target);
  } catch {
    return false; // malformed escape sequence in the fragment
  }
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Coarse primary pointer → show the thumbstick and jump button. */
export function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Focus is somewhere the visitor types text — leave their keys alone. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Focus is on something Enter / Space already activates natively. */
export function isActivatableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button, a[href], summary, [role='button']") !== null
  );
}

/** Play a UI sound through the shared audio engine. */
export function sfx(name: SfxName): void {
  getAudio().play(name);
}

export function toggleMuted(): void {
  setMuted(!ui.get().muted);
}

/**
 * HUD buttons sit on top of a game that listens for Space on `window`. After
 * a mouse / touch click the button would keep focus and the next Space press
 * (meant as "jump") would click it again, so pointer clicks give focus back
 * to the page. Keyboard activation (`detail === 0`) keeps focus where it is.
 */
export function releasePointerFocus(e: { detail: number; currentTarget: HTMLElement }): void {
  if (e.detail !== 0) e.currentTarget.blur();
}

/** Run `fn` once the browser is idle (after first paint). Returns a canceller. */
export function whenIdle(fn: () => void, timeout = 1200): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  // Safari: no requestIdleCallback — wait for a painted frame instead.
  let timer = 0;
  const raf = window.requestAnimationFrame(() => {
    timer = window.setTimeout(fn, 60);
  });
  return () => {
    window.cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
}

"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** Stick deflection below this fraction of the travel reads as "released". */
const DEAD_ZONE = 0.14;
/** How far the knob may travel from the centre, as a fraction of the base radius. */
const TRAVEL = 0.56;

interface ThumbstickProps {
  /** x = right, y = forward (up on screen), each -1..1. (0, 0) = released. */
  onMove(x: number, y: number): void;
  /** HUD is not interactive (paused, warping…): let go of the stick. */
  disabled: boolean;
}

/**
 * Virtual thumbstick. Pointer events with pointer capture, so a drag keeps
 * working when the thumb slides off the base. The knob is moved by writing a
 * transform straight to the DOM — no React state while dragging — and
 * `onMove` only fires when the reported value actually changes.
 */
export function Thumbstick({ onMove, disabled }: ThumbstickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  /** Active drag: pointer id, base centre (client px) and max travel (px). */
  const drag = useRef({ id: -1, cx: 0, cy: 0, max: 1 });
  const last = useRef({ x: 0, y: 0 });

  const report = useCallback(
    (x: number, y: number) => {
      if (x === last.current.x && y === last.current.y) return;
      last.current.x = x;
      last.current.y = y;
      onMove(x, y);
    },
    [onMove],
  );

  const release = useCallback(() => {
    drag.current.id = -1;
    const knob = knobRef.current;
    if (knob) knob.style.transform = "";
    baseRef.current?.removeAttribute("data-active");
    report(0, 0);
  }, [report]);

  const track = (clientX: number, clientY: number) => {
    const d = drag.current;
    let dx = (clientX - d.cx) / d.max;
    let dy = (clientY - d.cy) / d.max;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const knob = knobRef.current;
    if (knob) knob.style.transform = `translate3d(${dx * d.max}px, ${dy * d.max}px, 0)`;

    const mag = Math.min(1, len);
    if (mag < DEAD_ZONE) {
      report(0, 0);
      return;
    }
    // Rescale so the output ramps 0 → 1 from the dead-zone edge to the rim.
    const scale = (mag - DEAD_ZONE) / (1 - DEAD_ZONE) / mag;
    report(Math.round(dx * scale * 100) / 100, Math.round(-dy * scale * 100) / 100);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || drag.current.id !== -1) return;
    const base = e.currentTarget;
    const rect = base.getBoundingClientRect();
    const d = drag.current;
    d.id = e.pointerId;
    d.cx = rect.left + rect.width / 2;
    d.cy = rect.top + rect.height / 2;
    d.max = (rect.width / 2) * TRAVEL;
    base.setPointerCapture(e.pointerId);
    base.setAttribute("data-active", "");
    e.preventDefault();
    track(e.clientX, e.clientY);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== drag.current.id) return;
    track(e.clientX, e.clientY);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== drag.current.id) return;
    release();
  };

  // Let go when the HUD stops being interactive, and on unmount.
  useEffect(() => {
    if (disabled && drag.current.id !== -1) release();
  }, [disabled, release]);
  useEffect(() => release, [release]);

  return (
    <div
      ref={baseRef}
      className="da64-stick"
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={knobRef} className="da64-stick__knob" />
    </div>
  );
}

/** Round JUMP button. Fires on pointer-down so a tap feels immediate. */
export function JumpButton({ onJump }: { onJump(): void }) {
  return (
    <button
      type="button"
      className="da64-jump"
      aria-label="Jump"
      onPointerDown={(e) => {
        e.preventDefault(); // keep focus (and the keyboard's Space) with the game
        onJump();
      }}
      // Keyboard activation only: pointer taps were handled on pointer-down.
      onClick={(e) => {
        if (e.detail === 0) onJump();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      JUMP
    </button>
  );
}

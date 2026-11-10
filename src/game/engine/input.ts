/**
 * Raw input: movement keys, pointer taps / drags / hover on the canvas, the
 * mouse wheel, and the virtual thumbstick fed in through the GameApi.
 *
 * The engine owns WASD, the arrow keys and Space; everything else on the
 * keyboard (Esc, Enter, M …) belongs to the React UI. Gameplay input is only
 * acted on while `handlers.active()` is true (lobby phase, not paused).
 */

export interface InputHandlers {
  /** True while the engine accepts gameplay input (lobby, not paused). */
  active(): boolean;
  /** Any input at all: wake the avatar and the frame loop. */
  onActivity(): void;
  /** A press and release without movement (mouse click or finger tap). */
  onTap(clientX: number, clientY: number): void;
  /** Pointer drag on the canvas, in CSS pixels since the last event. */
  onDrag(dx: number, dy: number): void;
  onDragState(dragging: boolean): void;
  /** One debounced wheel notch: +1 = scrolled down, -1 = scrolled up. */
  onWheelStep(direction: 1 | -1): void;
}

const DEADZONE = 0.12;
/** Pointer travel (CSS px) that turns a press into a drag. */
const DRAG_THRESHOLD_MOUSE = 5;
const DRAG_THRESHOLD_TOUCH = 10;
/** A press held longer than this is not a tap. */
const TAP_MAX_MS = 700;
/** Wheel: scroll distance that counts as one notch, and the lock after it. */
const WHEEL_STEP = 30;
const WHEEL_LOCK_MS = 420;
const WHEEL_GESTURE_GAP_MS = 220;

/** Index of a movement key in the `held` table, or -1. */
function moveIndex(code: string): number {
  switch (code) {
    case "KeyW":
      return 0;
    case "ArrowUp":
      return 1;
    case "KeyS":
      return 2;
    case "ArrowDown":
      return 3;
    case "KeyA":
      return 4;
    case "ArrowLeft":
      return 5;
    case "KeyD":
      return 6;
    case "ArrowRight":
      return 7;
    default:
      return -1;
  }
}

function tagOf(target: EventTarget | null): string {
  return target instanceof Element ? target.tagName : "";
}

/** Typing into a form field must never move the avatar. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Space activates a focused button or link; leave it to the browser. */
function isPressable(target: EventTarget | null): boolean {
  const tag = tagOf(target);
  return tag === "BUTTON" || tag === "A" || tag === "SUMMARY";
}

export class Input {
  /** Move vector for this frame: x = right, y = forward, length <= 1. */
  x = 0;
  y = 0;
  mag = 0;

  /** Mouse position over the canvas, for hover picking. */
  hoverX = 0;
  hoverY = 0;
  hoverInside = false;
  hoverDirty = false;

  private readonly held = new Uint8Array(8);
  private stickX = 0;
  private stickY = 0;
  private jumpQueued = false;

  private pointerId = -1;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private downTime = 0;
  private dragging = false;

  private wheelAcc = 0;
  private wheelLockUntil = 0;
  private wheelLastTime = 0;

  private readonly removers: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly handlers: InputHandlers,
  ) {
    const on = <K extends keyof GlobalEventHandlersEventMap>(
      target: Window | Document | HTMLElement,
      type: K,
      listener: (e: GlobalEventHandlersEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, listener as EventListener, options);
      this.removers.push(() =>
        target.removeEventListener(type, listener as EventListener, options),
      );
    };
    on(window, "keydown", this.onKeyDown);
    on(window, "keyup", this.onKeyUp);
    on(window, "blur", this.releaseAll);
    on(canvas, "pointerdown", this.onPointerDown);
    on(canvas, "pointermove", this.onPointerMove);
    on(canvas, "pointerup", this.onPointerUp);
    on(canvas, "pointercancel", this.onPointerCancel);
    on(canvas, "pointerleave", this.onPointerLeave);
    on(canvas, "wheel", this.onWheel, { passive: false });
    // the canvas handles its own gestures: no scroll / pinch-zoom on it
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";
  }

  private readonly previousTouchAction: string;

  /** Combine keys and stick into the move vector. Call once per frame. */
  sample(): void {
    const h = this.held;
    let x = (h[6] | h[7]) - (h[4] | h[5]) + this.stickX;
    let y = (h[0] | h[1]) - (h[2] | h[3]) + this.stickY;
    let m = Math.hypot(x, y);
    if (m < DEADZONE) {
      x = 0;
      y = 0;
      m = 0;
    } else if (m > 1) {
      x /= m;
      y /= m;
      m = 1;
    }
    this.x = x;
    this.y = y;
    this.mag = m;
  }

  /** True once per jump press. */
  consumeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  setStick(x: number, y: number): void {
    this.stickX = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    this.stickY = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  }

  queueJump(): void {
    this.jumpQueued = true;
  }

  /** Drop every held key and any pending jump (blur, pause, phase change). */
  readonly releaseAll = (): void => {
    this.held.fill(0);
    this.jumpQueued = false;
  };

  /** Forget a queued jump without touching held keys. */
  clearJump(): void {
    this.jumpQueued = false;
  }

  dispose(): void {
    for (const remove of this.removers) remove();
    this.removers.length = 0;
    this.canvas.style.touchAction = this.previousTouchAction;
    this.endPointer();
  }

  /* ---------------------------- keyboard ---------------------------- */

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditable(e.target)) return;
    const idx = moveIndex(e.code);
    if (idx >= 0) {
      // Remember the key in every phase so a direction held through the
      // intro swoop starts moving the moment the lobby becomes playable.
      this.held[idx] = 1;
      if (this.handlers.active()) {
        e.preventDefault(); // arrows would scroll the page
        this.handlers.onActivity();
      }
      return;
    }
    if (e.code === "Space") {
      if (isPressable(e.target) || !this.handlers.active()) return;
      e.preventDefault();
      if (!e.repeat) {
        this.jumpQueued = true;
        this.handlers.onActivity();
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const idx = moveIndex(e.code);
    if (idx >= 0) this.held[idx] = 0;
  };

  /* ---------------------------- pointer ----------------------------- */

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (this.pointerId !== -1) return; // one gesture at a time
    this.pointerId = e.pointerId;
    this.downX = this.lastX = e.clientX;
    this.downY = this.lastY = e.clientY;
    this.downTime = e.timeStamp;
    this.dragging = false;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    this.handlers.onActivity();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (!this.dragging) {
        const threshold =
          e.pointerType === "mouse" ? DRAG_THRESHOLD_MOUSE : DRAG_THRESHOLD_TOUCH;
        if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > threshold) {
          this.dragging = true;
          this.handlers.onDragState(true);
        }
      }
      if (this.dragging && this.handlers.active()) {
        this.handlers.onDrag(dx, dy);
        this.handlers.onActivity();
      }
      return;
    }
    if (e.pointerType === "mouse" && this.pointerId === -1) {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      this.hoverInside = true;
      this.hoverDirty = true;
      this.handlers.onActivity();
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const tap = !this.dragging && e.timeStamp - this.downTime < TAP_MAX_MS;
    this.endPointer();
    if (tap && this.handlers.active()) this.handlers.onTap(e.clientX, e.clientY);
    if (e.pointerType === "mouse") {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      this.hoverDirty = true;
    }
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.endPointer();
  };

  private readonly onPointerLeave = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    this.hoverInside = false;
    this.hoverDirty = true;
    this.handlers.onActivity();
  };

  private endPointer(): void {
    if (this.pointerId === -1) return;
    try {
      this.canvas.releasePointerCapture(this.pointerId);
    } catch {
      /* already released */
    }
    this.pointerId = -1;
    if (this.dragging) {
      this.dragging = false;
      this.handlers.onDragState(false);
    }
  }

  /* ----------------------------- wheel ------------------------------ */

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.handlers.active()) return;
    e.preventDefault();
    const now = e.timeStamp;
    let delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) delta *= 32; // lines
    else if (e.deltaMode === 2) delta *= 400; // pages
    // A pause in the event stream starts a fresh gesture.
    if (now - this.wheelLastTime > WHEEL_GESTURE_GAP_MS) this.wheelAcc = 0;
    this.wheelLastTime = now;
    // Debounce: one door per notch, and a trackpad's inertia tail is ignored.
    if (now < this.wheelLockUntil) return;
    this.wheelAcc += delta;
    if (Math.abs(this.wheelAcc) >= WHEEL_STEP) {
      const direction = this.wheelAcc > 0 ? 1 : -1;
      this.wheelAcc = 0;
      this.wheelLockUntil = now + WHEEL_LOCK_MS;
      this.handlers.onWheelStep(direction);
    }
  };
}

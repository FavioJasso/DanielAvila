/**
 * The scripted moments, written as step lists for the sequence runner:
 * the intro, diving into a painting, the backflip back out, and the star
 * pose at the pedestal.
 *
 * Each `play…` function builds its steps from where the avatar is right now
 * and hands them to `g.seq`. Each also passes an end callback that restores
 * a sane state if the sequence is cancelled half way (see game.ts).
 */
import { DOORS } from "../contract";
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  DOOR_FRAMES,
  EXIT_D,
  ROOM,
  STAND_D,
  STAR_STAND,
} from "../layout";
import { SHOT_EXIT, SHOT_NONE, SHOT_PUSH, SHOT_STAR } from "./camera";
import type { Game } from "./game";
import { angleDelta, clamp, damp, frameD, frameU, frameX, frameZ, lerp } from "./math";
import { call, tween, until, wait, type Step } from "./sequences";
import {
  AUTO_SPEED,
  DIVE_HIT_Y,
  DIVE_IMPACT_DIST,
  DIVE_TAKEOFF_D,
  DIVE_THROUGH,
  DOOR_BLOCK_OPEN,
  EXIT_ARC,
  EXIT_START_Y,
  GRAVITY,
  HOP_HEIGHT,
  HOP_RATE,
  HOP_SHARE,
  INTRO_TIME,
} from "./tuning";

/** How a course is being entered. */
export type EnterMode =
  /** Click or `enterCourse(id)`: run up, three hops, dive. */
  | "walk"
  /** Pause-menu fast travel: cut straight to the overlay. */
  | "instant"
  /** Free roam: the player jumped at the canvas. */
  | "free";

const RESTART = { restart: true } as const;
const SOFT_LAND = { volume: 0.55 } as const;
const DIVE_JUMP = { rate: 1.4 } as const;
const EXIT_JUMP = { rate: 0.85 } as const;
/** The dive aims this far inside the painting's edge. */
const DIVE_MAX_U = ROOM.paintingSize / 2 - 0.45;

/** Time a run along the planned path may take before it is cut short. */
const runBudget = (g: Game): number => (g.nav.path.length() / AUTO_SPEED) * 1.6 + 2.5;

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */

/** PRESS START: the camera swoops in behind the avatar, then the lobby is live. */
export function playIntro(g: Game): void {
  g.seq.play("intro", [wait(g.reducedMotion ? 0.1 : INTRO_TIME)], () => g.finishIntro());
}

/* ------------------------------------------------------------------ */
/* Into a painting                                                     */
/* ------------------------------------------------------------------ */

export function playEnter(g: Game, index: number, mode: EnterMode): void {
  const f = DOOR_FRAMES[index];
  const door = g.world.doors[index];
  const c = g.ctrl;
  const steps: Step[] = [];

  if (mode === "instant") {
    // Fast travel: avatar already "inside", camera cut to the canvas.
    steps.push(
      call(() => {
        c.place(f.enterPoint.x, f.enterPoint.z, f.yawOut);
        g.setAvatarVisible(false);
        g.inPainting = true;
        g.setShot(SHOT_PUSH, index, 0.3, true);
        door.ripple("in");
        g.audio.play("warpIn");
        g.flash();
      }),
      wait(0.18),
    );
  } else if (g.reducedMotion) {
    // Reduced motion: no run-up, no hops, no push-in. Stand in front of the
    // painting for a beat, then go.
    steps.push(
      call(() => {
        c.place(f.enterPoint.x, f.enterPoint.z, f.yawOut);
        g.avatar.play("idle");
        g.cutNext = true;
      }),
      until(() => door.openAmount >= DOOR_BLOCK_OPEN, 1.5),
      wait(0.15),
      call(() => {
        g.impact(index, 0, DIVE_HIT_Y, false);
        g.setAvatarVisible(false);
      }),
      wait(0.2),
      call(() => g.flash()),
      wait(0.1),
    );
  } else {
    const u0 = frameU(f, c.x, c.z);
    const d0 = frameD(f, c.x, c.z);
    // Already standing in the alcove (or the player jumped at the canvas):
    // there is no room for a run-up, so dive from here.
    const diveFromHere =
      mode === "free" || (Math.abs(u0) < ALCOVE_HALF_WIDTH && d0 > DIVE_TAKEOFF_D - 0.7);
    if (!diveFromHere) {
      // Run to the door axis: the stand point, or, when already in front of
      // the door, wherever the avatar is level with (but outside the arch).
      const inFront = Math.abs(u0) < 2.4 && d0 > STAND_D + 0.6;
      const startD = inFront ? Math.min(d0, -0.6) : STAND_D;
      const sx = frameX(f, 0, startD);
      const sz = frameZ(f, 0, startD);
      let budget = 0;
      steps.push(
        call(() => {
          g.nav.plan(c.x, c.z, sx, sz);
          budget = runBudget(g);
        }),
        { update: (dt, t) => g.runPath(dt) || t > budget },
        call(() => {
          g.nav.cancel();
          if (Math.hypot(c.x - sx, c.z - sz) > 0.05) c.place(sx, sz, c.yaw);
          else c.settle();
        }),
        // never hop through a door that is still swinging open
        until(
          () =>
            door.openAmount >= DOOR_BLOCK_OPEN &&
            Math.abs(angleDelta(c.yaw, f.yawOut)) < 0.12,
          3,
          (dt) => {
            c.yaw += angleDelta(c.yaw, f.yawOut) * damp(14, dt);
            g.standStill(dt);
          },
        ),
      );
      // three hops of growing length and height up to the take-off point
      const run = DIVE_TAKEOFF_D - startD;
      const scale = clamp(run / (DIVE_TAKEOFF_D - STAND_D), 0.5, 1);
      let d = startD;
      for (let i = 0; i < 3; i++) {
        const next = i === 2 ? DIVE_TAKEOFF_D : d + run * HOP_SHARE[i];
        steps.push(hop(g, index, d, next, HOP_HEIGHT[i] * scale, HOP_RATE[i]));
        d = next;
      }
    }
    steps.push(dive(g, index), wait(0.12), call(() => g.flash()), wait(0.14));
  }

  steps.push(call(() => g.openCourse(DOORS[index].id)));
  g.seq.play("enter", steps, (completed) => {
    if (!completed) g.abortEnter(index);
  });
}

/** One hop along the door axis from depth `d0` to `d1`. */
function hop(g: Game, index: number, d0: number, d1: number, height: number, rate: number): Step {
  const f = DOOR_FRAMES[index];
  const c = g.ctrl;
  const duration = 2 * Math.sqrt((2 * height) / GRAVITY);
  const sound = { rate };
  let u0 = 0;
  return {
    enter() {
      u0 = frameU(f, c.x, c.z);
      c.yaw = f.yawOut;
      c.grounded = false;
      g.avatar.play("jump", RESTART);
      g.audio.play("jump", sound);
    },
    update(_dt, t) {
      const s = Math.min(1, t / duration);
      const u = u0 * (1 - s);
      const d = lerp(d0, d1, s);
      c.x = frameX(f, u, d);
      c.z = frameZ(f, u, d);
      c.y = 4 * height * s * (1 - s);
      if (s > 0.55) g.avatar.play("fall");
      if (s < 1) return false;
      c.settle();
      g.audio.play("land", SOFT_LAND);
      return true;
    },
  };
}

/**
 * The leap into the canvas from wherever the avatar is. It keeps flying a
 * little way past the canvas plane before it is hidden: the wall and the
 * painting themselves swallow it bit by bit, which reads as sinking in.
 */
function dive(g: Game, index: number): Step {
  const f = DOOR_FRAMES[index];
  const c = g.ctrl;
  let u0 = 0;
  let u1 = 0;
  let d0 = 0;
  let y0 = 0;
  let dist = 1;
  let duration = 0.3;
  let hit = false;
  return {
    enter() {
      u0 = frameU(f, c.x, c.z);
      u1 = clamp(u0, -DIVE_MAX_U, DIVE_MAX_U);
      d0 = frameD(f, c.x, c.z);
      y0 = c.y;
      dist = Math.max(0.2, ALCOVE_BACK - d0);
      duration = clamp(dist / 6.3, 0.2, 0.45);
      hit = false;
      c.vx = c.vy = c.vz = 0;
      c.grounded = false;
      g.avatar.play("dive", RESTART);
      g.audio.play("jump", DIVE_JUMP);
    },
    update(dt, t) {
      const s = t / duration; // 1 = root at the canvas plane
      const rise = Math.min(1, s);
      const d = d0 + dist * s;
      const u = lerp(u0, u1, rise);
      c.x = frameX(f, u, d);
      c.z = frameZ(f, u, d);
      c.y = y0 + (DIVE_HIT_Y - y0) * (2 * rise - rise * rise);
      c.yaw += angleDelta(c.yaw, f.yawOut) * damp(22, dt);
      if (!hit && ALCOVE_BACK - d <= DIVE_IMPACT_DIST) {
        hit = true;
        g.impact(index, u, c.y, true);
      }
      if (d < ALCOVE_BACK + DIVE_THROUGH) return false;
      g.setAvatarVisible(false);
      return true;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Out of a painting                                                   */
/* ------------------------------------------------------------------ */

export function playExit(g: Game, index: number): void {
  const f = DOOR_FRAMES[index];
  const door = g.world.doors[index];
  const c = g.ctrl;
  const reduced = g.reducedMotion;
  const flip = reduced ? 0 : clamp(g.avatar.duration("backflip"), 0.55, 1.1);
  // start behind the canvas so the avatar emerges through it
  const fromD = ALCOVE_BACK + 0.6;
  const steps: Step[] = [
    call(() => {
      door.ripple("out");
      g.audio.play("warpOut");
      // start close on the doorway (reduced motion keeps its one fixed shot)
      if (!reduced) g.setShot(SHOT_EXIT, index, 0.3, true);
    }),
    wait(reduced ? 0.1 : 0.2),
    // after fast travel the door may still be swinging open
    until(() => door.openAmount >= DOOR_BLOCK_OPEN, 1.5),
    call(() => {
      c.place(frameX(f, 0, fromD), frameZ(f, 0, fromD), f.yawIn, EXIT_START_Y);
      g.setAvatarVisible(true);
      g.inPainting = false;
      g.avatar.play("backflip", RESTART);
      g.audio.play("jump", EXIT_JUMP);
      // the camera pulls back to its normal place while the avatar flies out
      g.setShot(SHOT_NONE, index, 0.3, false);
    }),
    tween(flip, (k) => {
      const d = lerp(fromD, EXIT_D, k);
      c.x = frameX(f, 0, d);
      c.z = frameZ(f, 0, d);
      c.y = EXIT_START_Y * (1 - k) + 4 * EXIT_ARC * k * (1 - k);
    }),
    call(() => {
      c.settle();
      g.audio.play("land");
      g.avatar.play("land", RESTART);
      g.shake(0.06);
    }),
    wait(reduced ? 0.05 : Math.min(0.25, g.avatar.duration("land") + 0.05)),
  ];
  // Completed or cancelled, the avatar ends up standing outside the door.
  g.seq.play("exit", steps, () => g.finishExit(index));
}

/* ------------------------------------------------------------------ */
/* Résumé star                                                         */
/* ------------------------------------------------------------------ */

export function playResume(g: Game, instant: boolean): void {
  const c = g.ctrl;
  const quick = instant || g.reducedMotion;
  const steps: Step[] = [];
  if (!instant) {
    let budget = 0;
    steps.push(
      call(() => {
        g.nav.plan(c.x, c.z, STAR_STAND.x, STAR_STAND.z);
        budget = runBudget(g);
      }),
      { update: (dt, t) => g.runPath(dt) || t > budget },
      // turn to face the star
      until(
        () => Math.abs(angleDelta(c.yaw, STAR_STAND.yaw)) < 0.08,
        0.5,
        (dt) => {
          c.yaw += angleDelta(c.yaw, STAR_STAND.yaw) * damp(16, dt);
          g.standStill(dt);
        },
      ),
    );
  }
  steps.push(
    call(() => {
      g.nav.cancel();
      c.place(STAR_STAND.x, STAR_STAND.z, STAR_STAND.yaw);
      g.avatar.play("starPose", RESTART);
      g.world.starBurst();
      g.audio.play("starPose");
      g.setShot(SHOT_STAR, 0, 0.45, instant);
    }),
    wait(quick ? 0.35 : clamp(g.avatar.duration("starPose"), 0.8, 2.2)),
    call(() => g.openCourse("resume")),
  );
  g.seq.play("resume", steps, (completed) => {
    if (!completed) g.abortResume();
  });
}

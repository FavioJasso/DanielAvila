/**
 * Every feel / timing number of the engine in one place.
 * Distances are world units (≈ metres), times are seconds.
 */
import { ALCOVE_BACK, PAINTING_DIVE_RANGE } from "../layout";

/* ---- free-roam movement ---- */
export const RUN_SPEED = 6.5;
/** Guided / scripted runs are a touch faster: the blueprint calls them sprints. */
export const AUTO_SPEED = 7.2;
export const ACCEL = 44;
export const DECEL = 30;
export const AIR_ACCEL = 24;
export const AIR_DECEL = 5;
/** Exponential turn rate towards the move direction (1/s). */
export const TURN_RATE = 14;
export const GRAVITY = 29;
export const JUMP_HEIGHT = 1.6;
export const JUMP_SPEED = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
/** Grace period after leaving the ground during which a jump still works. */
export const COYOTE_TIME = 0.1;
/** A jump pressed this long before landing fires on touchdown. */
export const JUMP_BUFFER = 0.12;
/** Longest horizontal move resolved in one collision pass (must stay < radius). */
export const MAX_SUBSTEP = 0.2;
/** The clock never advances more than this per frame (tab hiccups). */
export const MAX_DT = 0.05;

/* ---- doors ---- */
/** A door leaf blocks the doorway while it is less open than this. */
export const DOOR_BLOCK_OPEN = 0.6;
export const STAR_NEAR_RADIUS = 2.7;
export const STAR_FAR_RADIUS = 3.2;

/* ---- sounds ---- */
/** Ground distance between two footstep sounds. */
export const STEP_LENGTH = 1.9;
export const SNORE_PERIOD = 3.6;

/* ---- phase timing ---- */
export const INTRO_TIME = 1.7;
/** Keep rendering this long after an overlay opens so the ripple can finish. */
export const COURSE_RENDER_TAIL = 1.6;

/* ---- painting entry ---- */
/** Depth (door frame `d`) at which the scripted dive leaves the ground. */
export const DIVE_TAKEOFF_D = ALCOVE_BACK - (PAINTING_DIVE_RANGE - 0.1);
/** Height of the avatar root when it reaches the canvas plane. */
export const DIVE_HIT_Y = 1.4;
/** The ripple fires when the root is this far in front of the canvas. */
export const DIVE_IMPACT_DIST = 1.0;
/** The avatar keeps flying this far behind the canvas before it is hidden. */
export const DIVE_THROUGH = 1.25;
/** Share of the run-up covered by each of the three hops, and their heights. */
export const HOP_SHARE = [0.246, 0.333, 0.421] as const;
export const HOP_HEIGHT = [0.5, 0.9, 1.35] as const;
export const HOP_RATE = [1, 1.12, 1.26] as const;

/* ---- painting exit ---- */
/** Root height when the avatar pops back out of the canvas. */
export const EXIT_START_Y = 1.3;
/** Extra arc height of the backflip. */
export const EXIT_ARC = 1.0;

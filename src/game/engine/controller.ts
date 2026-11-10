/**
 * Character controller: owns the avatar's position, velocity and yaw and
 * keeps it inside the room.
 *
 * Collision is a circle (the avatar's footprint) against the wall segments
 * and the pedestal circle from layout.ts, plus one extra segment per door
 * while that door's leaf is not open enough to walk through.
 *
 * Watertightness rests on three things:
 *  1. horizontal motion is cut into sub-steps shorter than the radius, so
 *     the centre can never jump across a wall in one move;
 *  2. after every sub-step the circle is pushed out of everything it
 *     overlaps, a few times over so corners settle;
 *  3. if the result is still not a legal position the sub-step is undone.
 * Because the position before a sub-step is always legal, the position
 * after it is too.
 */
import type { Circle, Segment } from "../contract";
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_FRAMES,
  DOOR_HALF_WIDTH,
  PLAIN_WALL_BEARINGS_DEG,
  ROOM,
  SPAWN,
  buildColliders,
  doorLeafSegment,
  wallFrame,
} from "../layout";
import { angleDelta, clamp01, damp, frameD, frameU, wrapAngle } from "./math";
import {
  ACCEL,
  AIR_ACCEL,
  AIR_DECEL,
  COYOTE_TIME,
  DECEL,
  GRAVITY,
  JUMP_BUFFER,
  JUMP_SPEED,
  MAX_SUBSTEP,
  TURN_RATE,
} from "./tuning";

const RADIUS = ROOM.avatarRadius;
const RADIUS_SQ = RADIUS * RADIUS;
/** Overlap tolerated by `isValid` (numerical slack of the push-out). */
const SKIN = 2e-3;
const ITERATIONS = 5;
/** Auto-run turn rate; a little calmer than free roam so paths look smooth. */
const AUTO_TURN_RATE = 11;

/** Outward unit normals of the eight octagon walls. */
const WALL_NORMALS = [
  ...DOOR_FRAMES.map((f) => f.dir),
  ...PLAIN_WALL_BEARINGS_DEG.map((b) => wallFrame(b).dir),
];

export class Controller {
  x = SPAWN.x;
  y = 0;
  z = SPAWN.z;
  yaw = SPAWN.yaw;
  vx = 0;
  vy = 0;
  vz = 0;
  grounded = true;

  /* One-frame events, valid after a step. */
  /** Touched the ground this step. */
  landed = false;
  /** Left the ground by jumping this step. */
  jumped = false;
  /** Door whose closed leaf was touched this step, or -1. */
  hitDoor = -1;

  /** Per door: true while the leaf blocks the doorway. */
  readonly leafBlocked: boolean[];

  private readonly segments: Segment[];
  private readonly circles: Circle[];
  private readonly leaves: Segment[];
  private coyote = 0;
  private jumpBuffer = 0;
  /** Position at the start of the current sub-step (always legal). */
  private px = SPAWN.x;
  private pz = SPAWN.z;

  constructor() {
    const colliders = buildColliders();
    this.segments = colliders.segments;
    this.circles = colliders.circles;
    this.leaves = DOOR_FRAMES.map((_, i) => doorLeafSegment(i));
    this.leafBlocked = this.leaves.map(() => true);
  }

  /* ------------------------------------------------------------------ */
  /* Stepping                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Free roam. (`wx`, `wz`) is the wanted world direction (unit length or
   * zero), `mag` the stick deflection 0..1.
   */
  stepFree(wx: number, wz: number, mag: number, jump: boolean, dt: number, speed: number): void {
    this.beginStep(dt);
    const moving = mag > 0;
    const rate = moving
      ? this.grounded
        ? ACCEL
        : AIR_ACCEL
      : this.grounded
        ? DECEL
        : AIR_DECEL;
    this.approachVelocity(wx * mag * speed, wz * mag * speed, rate * dt);
    if (moving) {
      this.yaw = wrapAngle(
        this.yaw + angleDelta(this.yaw, Math.atan2(wx, wz)) * damp(TURN_RATE, dt),
      );
    }
    if (jump) this.jumpBuffer = JUMP_BUFFER;
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumped = true;
    }
    this.integrate(dt);
  }

  /**
   * Guided run along (`dx`, `dz`) (unit). The avatar turns towards the
   * direction and only reaches full speed once it roughly faces it, so a
   * path that starts behind its back begins with a visible turn.
   */
  stepAuto(dx: number, dz: number, speed: number, dt: number): void {
    this.beginStep(dt);
    const diff = angleDelta(this.yaw, Math.atan2(dx, dz));
    this.yaw = wrapAngle(this.yaw + diff * damp(AUTO_TURN_RATE, dt));
    const align = Math.max(0.12, Math.min(1, (Math.cos(diff) + 0.3) / 1.3));
    const v = speed * align;
    this.approachVelocity(dx * v, dz * v, (this.grounded ? ACCEL : AIR_ACCEL) * dt);
    this.integrate(dt);
  }

  /** Put the avatar somewhere (teleports, scripted sequences). */
  place(x: number, z: number, yaw: number, y = 0): void {
    this.x = x;
    this.z = z;
    this.y = Math.max(0, y);
    this.yaw = yaw;
    this.vx = this.vy = this.vz = 0;
    this.grounded = this.y <= 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.landed = this.jumped = false;
    this.hitDoor = -1;
  }

  /** Stand still on the ground where the avatar is (after a scripted move). */
  settle(): void {
    this.y = 0;
    this.vx = this.vy = this.vz = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  /**
   * Make the current position legal: push out of anything overlapped and,
   * if that fails (teleported into solid stone), fall back to the spawn.
   */
  resolve(): void {
    this.px = this.x;
    this.pz = this.z;
    this.collide();
    if (!this.isValid(this.x, this.z)) {
      this.x = SPAWN.x;
      this.z = SPAWN.z;
    }
  }

  /** Legal standing position: inside the room and clear of every collider. */
  isValid(x: number, z: number): boolean {
    return this.inBounds(x, z) && this.clearance(x, z) >= -SKIN;
  }

  /**
   * Smallest gap between the avatar's footprint at (x, z) and any collider;
   * negative when overlapping.
   */
  clearance(x: number, z: number): number {
    let min = Infinity;
    const segs = this.segments;
    for (let i = 0; i < segs.length; i++) {
      const d = distToSegment(x, z, segs[i]) - RADIUS;
      if (d < min) min = d;
    }
    for (let i = 0; i < this.leaves.length; i++) {
      if (!this.leafBlocked[i]) continue;
      const d = distToSegment(x, z, this.leaves[i]) - RADIUS;
      if (d < min) min = d;
    }
    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      const d = Math.hypot(x - c.x, z - c.z) - c.r - RADIUS;
      if (d < min) min = d;
    }
    return min;
  }

  /** Inside the octagon or inside one of the arch + alcove rectangles. */
  inBounds(x: number, z: number): boolean {
    let inside = true;
    for (let i = 0; i < WALL_NORMALS.length; i++) {
      const n = WALL_NORMALS[i];
      if (x * n.x + z * n.z > ROOM.apothem) {
        inside = false;
        break;
      }
    }
    if (inside) return true;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      const d = frameD(f, x, z);
      if (d < 0 || d >= ALCOVE_BACK) continue;
      // the arch is only as wide as the door; the alcove behind it is wider
      const half = d < ARCH_DEPTH ? DOOR_HALF_WIDTH : ALCOVE_HALF_WIDTH;
      if (Math.abs(frameU(f, x, z)) < half) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Internals                                                           */
  /* ------------------------------------------------------------------ */

  private beginStep(dt: number): void {
    this.landed = false;
    this.jumped = false;
    this.hitDoor = -1;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
  }

  /** Move the horizontal velocity towards a target by at most `maxDelta`. */
  private approachVelocity(tx: number, tz: number, maxDelta: number): void {
    const dx = tx - this.vx;
    const dz = tz - this.vz;
    const len = Math.hypot(dx, dz);
    if (len <= maxDelta || len === 0) {
      this.vx = tx;
      this.vz = tz;
    } else {
      this.vx += (dx / len) * maxDelta;
      this.vz += (dz / len) * maxDelta;
    }
  }

  private integrate(dt: number): void {
    // vertical: exact parabola, so the jump height does not depend on dt
    if (this.grounded) {
      this.coyote = COYOTE_TIME;
    } else {
      this.coyote -= dt;
      this.y += this.vy * dt - 0.5 * GRAVITY * dt * dt;
      this.vy -= GRAVITY * dt;
      if (this.y <= 0 && this.vy <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.landed = true;
      }
    }
    // horizontal: sub-steps shorter than the radius, resolved one by one
    const dist = Math.hypot(this.vx, this.vz) * dt;
    if (dist <= 0) return;
    const n = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.px = this.x;
      this.pz = this.z;
      this.x += this.vx * h;
      this.z += this.vz * h;
      this.collide();
      if (!this.isValid(this.x, this.z)) {
        // could not be made legal (only possible in a degenerate squeeze)
        this.x = this.px;
        this.z = this.pz;
        this.vx = 0;
        this.vz = 0;
        break;
      }
    }
  }

  /** Push the circle out of every collider it overlaps; repeat for corners. */
  private collide(): void {
    const segs = this.segments;
    for (let iter = 0; iter < ITERATIONS; iter++) {
      let touched = false;
      for (let i = 0; i < segs.length; i++) {
        if (this.pushOutOfSegment(segs[i])) touched = true;
      }
      for (let i = 0; i < this.leaves.length; i++) {
        if (this.leafBlocked[i] && this.pushOutOfSegment(this.leaves[i])) {
          touched = true;
          this.hitDoor = i;
        }
      }
      for (let i = 0; i < this.circles.length; i++) {
        if (this.pushOutOfCircle(this.circles[i])) touched = true;
      }
      if (!touched) break;
    }
  }

  private pushOutOfSegment(s: Segment): boolean {
    const abx = s.bx - s.ax;
    const abz = s.bz - s.az;
    const len2 = abx * abx + abz * abz;
    const t = len2 > 0 ? clamp01(((this.x - s.ax) * abx + (this.z - s.az) * abz) / len2) : 0;
    const cx = s.ax + abx * t;
    const cz = s.az + abz * t;
    let nx = this.x - cx;
    let nz = this.z - cz;
    const d2 = nx * nx + nz * nz;
    if (d2 >= RADIUS_SQ) return false;
    const d = Math.sqrt(d2);
    if (d > 1e-7) {
      nx /= d;
      nz /= d;
    } else {
      // centre exactly on the wall: leave on the side the step started from
      const len = Math.sqrt(len2) || 1;
      nx = -abz / len;
      nz = abx / len;
      if ((this.px - cx) * nx + (this.pz - cz) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
    }
    this.x = cx + nx * RADIUS;
    this.z = cz + nz * RADIUS;
    this.slide(nx, nz);
    return true;
  }

  private pushOutOfCircle(c: Circle): boolean {
    const r = c.r + RADIUS;
    let nx = this.x - c.x;
    let nz = this.z - c.z;
    const d2 = nx * nx + nz * nz;
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    if (d > 1e-7) {
      nx /= d;
      nz /= d;
    } else {
      nx = 0;
      nz = 1;
    }
    this.x = c.x + nx * r;
    this.z = c.z + nz * r;
    this.slide(nx, nz);
    return true;
  }

  /** Drop the velocity component that points into a surface. */
  private slide(nx: number, nz: number): void {
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) {
      this.vx -= vn * nx;
      this.vz -= vn * nz;
    }
  }
}

function distToSegment(x: number, z: number, s: Segment): number {
  const abx = s.bx - s.ax;
  const abz = s.bz - s.az;
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? clamp01(((x - s.ax) * abx + (z - s.az) * abz) / len2) : 0;
  return Math.hypot(x - (s.ax + abx * t), z - (s.az + abz * t));
}

/**
 * Guided navigation: plan a polyline through the room and follow it.
 *
 * The room is simple enough that no search is needed. The lobby is convex
 * apart from the pedestal in its middle, and every alcove hangs off it
 * through one doorway, so a path is: (out through the doorway) → across the
 * lobby, bending around the pedestal if it is in the way → (in through the
 * doorway). The follower then chases a point a little way ahead on that
 * polyline ("pure pursuit"), which rounds the corners into smooth curves.
 */
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_FRAMES,
  DOOR_HALF_WIDTH,
  PEDESTAL,
  PLAIN_WALL_BEARINGS_DEG,
  ROOM,
  wallFrame,
  type WallFrame,
} from "../layout";
import { clamp, clamp01, frameD, frameU, frameX, frameZ, TAU } from "./math";
import { AUTO_SPEED } from "./tuning";

const R = ROOM.avatarRadius;
/** Sideways range of doorway waypoints (keeps the footprint off the jambs). */
const PORTAL_U = DOOR_HALF_WIDTH - R - 0.2;
/** Doorway waypoints: just outside the wall face, and just inside the alcove. */
const PORTAL_OUT_D = -(R + 0.25);
const PORTAL_IN_D = ARCH_DEPTH + R + 0.14;
/** Radius of the detour circle around the pedestal. */
const DETOUR_R = ROOM.pedestalRadius + R + 0.4;
const MAX_POINTS = 40;
const LOOKAHEAD = 1.1;
/** Intermediate waypoints count as reached within this distance. */
const CORNER_RADIUS = 0.45;

const WALL_NORMALS = [
  ...DOOR_FRAMES.map((f) => f.dir),
  ...PLAIN_WALL_BEARINGS_DEG.map((b) => wallFrame(b).dir),
];

/** Door whose arch or alcove contains the point, or -1 for the lobby. */
export function regionOf(x: number, z: number): number {
  for (let i = 0; i < DOOR_FRAMES.length; i++) {
    const f = DOOR_FRAMES[i];
    const d = frameD(f, x, z);
    if (d > 0 && d < ALCOVE_BACK + 0.5 && Math.abs(frameU(f, x, z)) < ALCOVE_HALF_WIDTH + 0.5) {
      return i;
    }
  }
  return -1;
}

/** Reused result of `clampWalkable`. */
export const walkable = { x: 0, z: 0 };

/**
 * Nearest point to (x, z) where the avatar can stand with `margin` to spare.
 * Writes into `walkable`.
 */
export function clampWalkable(x: number, z: number, margin = 0.06): void {
  const pad = R + margin;
  const region = regionOf(x, z);
  if (region >= 0) {
    const f = DOOR_FRAMES[region];
    let u = frameU(f, x, z);
    let d = clamp(frameD(f, x, z), 0, ALCOVE_BACK - pad);
    // Solid stone flanks the arch: a point there belongs to whichever open
    // space is nearer, the lobby in front or the alcove behind.
    const inArchDepth = d < ARCH_DEPTH + pad;
    if (inArchDepth && Math.abs(u) > DOOR_HALF_WIDTH - pad) {
      if (Math.abs(u) > DOOR_HALF_WIDTH && d < ARCH_DEPTH * 0.5) {
        d = -pad;
        u = clamp(u, -DOOR_HALF_WIDTH - 2, DOOR_HALF_WIDTH + 2);
      } else if (Math.abs(u) > DOOR_HALF_WIDTH) {
        d = ARCH_DEPTH + pad;
      } else {
        u = clamp(u, -(DOOR_HALF_WIDTH - pad), DOOR_HALF_WIDTH - pad);
      }
    }
    if (d >= ARCH_DEPTH + pad) u = clamp(u, -(ALCOVE_HALF_WIDTH - pad), ALCOVE_HALF_WIDTH - pad);
    walkable.x = frameX(f, u, d);
    walkable.z = frameZ(f, u, d);
    return;
  }
  // lobby: inside every wall plane, outside the pedestal
  const limit = ROOM.apothem - pad;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < WALL_NORMALS.length; i++) {
      const n = WALL_NORMALS[i];
      const over = x * n.x + z * n.z - limit;
      if (over > 0) {
        x -= n.x * over;
        z -= n.z * over;
      }
    }
  }
  const px = x - PEDESTAL.x;
  const pz = z - PEDESTAL.z;
  const pr = ROOM.pedestalRadius + pad;
  const pd = Math.hypot(px, pz);
  if (pd < pr) {
    const k = pd > 1e-6 ? pr / pd : 0;
    x = PEDESTAL.x + (pd > 1e-6 ? px * k : 0);
    z = PEDESTAL.z + (pd > 1e-6 ? pz * k : pr);
  }
  walkable.x = x;
  walkable.z = z;
}

/** A polyline with fixed storage, so planning never allocates. */
export class Path {
  readonly xs = new Float64Array(MAX_POINTS);
  readonly zs = new Float64Array(MAX_POINTS);
  count = 0;

  clear(): void {
    this.count = 0;
  }

  push(x: number, z: number): void {
    const n = this.count;
    // drop points that sit on top of the previous one
    if (n > 0 && Math.hypot(x - this.xs[n - 1], z - this.zs[n - 1]) < 1e-4) return;
    if (n >= MAX_POINTS) {
      // out of room: overwrite the last point so the goal is never lost
      this.xs[MAX_POINTS - 1] = x;
      this.zs[MAX_POINTS - 1] = z;
      return;
    }
    this.xs[n] = x;
    this.zs[n] = z;
    this.count = n + 1;
  }

  length(): number {
    let len = 0;
    for (let i = 1; i < this.count; i++) {
      len += Math.hypot(this.xs[i] - this.xs[i - 1], this.zs[i] - this.zs[i - 1]);
    }
    return len;
  }
}

/** Add the doorway waypoints for leaving (or, reversed, entering) an alcove. */
function portalU(f: WallFrame, x: number, z: number): number {
  return clamp(frameU(f, x, z), -PORTAL_U, PORTAL_U);
}

/**
 * Lobby leg from A to B (both in the lobby): straight, unless that would
 * clip the pedestal, in which case hug a circle around it.
 */
function lobbyLeg(path: Path, ax: number, az: number, bx: number, bz: number): void {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  const pax = PEDESTAL.x - ax;
  const paz = PEDESTAL.z - az;
  const t = len2 > 1e-8 ? (pax * abx + paz * abz) / len2 : 0;
  if (t > 0 && t < 1) {
    const cx = ax + abx * t - PEDESTAL.x;
    const cz = az + abz * t - PEDESTAL.z;
    if (Math.hypot(cx, cz) < DETOUR_R - 1e-3) {
      // Which way round? Keep the pedestal on the side it already is.
      const cross = abx * paz - abz * pax;
      const sgn = cross >= 0 ? 1 : -1;
      const dA = Math.hypot(pax, paz);
      const dB = Math.hypot(bx - PEDESTAL.x, bz - PEDESTAL.z);
      // tangent points of A and B on the detour circle (math angles in xz)
      const a1 = Math.atan2(-paz, -pax) + sgn * Math.acos(Math.min(1, DETOUR_R / dA));
      const a2 =
        Math.atan2(bz - PEDESTAL.z, bx - PEDESTAL.x) -
        sgn * Math.acos(Math.min(1, DETOUR_R / dB));
      let sweep = (sgn * (a2 - a1)) % TAU;
      if (sweep < 0) sweep += TAU;
      if (sweep <= Math.PI) {
        const steps = Math.max(1, Math.ceil(sweep / 0.4));
        for (let k = 0; k <= steps; k++) {
          const a = a1 + (sgn * sweep * k) / steps;
          path.push(PEDESTAL.x + Math.cos(a) * DETOUR_R, PEDESTAL.z + Math.sin(a) * DETOUR_R);
        }
      }
    }
  }
  path.push(bx, bz);
}

/**
 * Plan from (fx, fz) to (tx, tz). Both must be legal standing positions
 * (see `clampWalkable`). The first point of the path is the start.
 */
export function planPath(path: Path, fx: number, fz: number, tx: number, tz: number): void {
  path.clear();
  path.push(fx, fz);
  const from = regionOf(fx, fz);
  const to = regionOf(tx, tz);

  if (from >= 0 && from === to) {
    // Same alcove. Only the arch ↔ alcove corner can be in the way.
    const f = DOOR_FRAMES[from];
    const fromInArch = frameD(f, fx, fz) < PORTAL_IN_D;
    const toInArch = frameD(f, tx, tz) < PORTAL_IN_D;
    if (fromInArch !== toInArch) {
      const u = fromInArch ? portalU(f, fx, fz) : portalU(f, tx, tz);
      path.push(frameX(f, u, PORTAL_IN_D), frameZ(f, u, PORTAL_IN_D));
    }
    path.push(tx, tz);
    return;
  }

  let cx = fx;
  let cz = fz;
  if (from >= 0) {
    // out through the doorway
    const f = DOOR_FRAMES[from];
    const u = portalU(f, fx, fz);
    if (frameD(f, fx, fz) > PORTAL_IN_D) {
      path.push(frameX(f, u, PORTAL_IN_D), frameZ(f, u, PORTAL_IN_D));
    }
    cx = frameX(f, u, PORTAL_OUT_D);
    cz = frameZ(f, u, PORTAL_OUT_D);
    path.push(cx, cz);
  }
  if (to >= 0) {
    // across the lobby to the doorway, then in
    const f = DOOR_FRAMES[to];
    const u = portalU(f, tx, tz);
    lobbyLeg(path, cx, cz, frameX(f, u, PORTAL_OUT_D), frameZ(f, u, PORTAL_OUT_D));
    if (frameD(f, tx, tz) > PORTAL_IN_D) {
      path.push(frameX(f, u, PORTAL_IN_D), frameZ(f, u, PORTAL_IN_D));
    }
    path.push(tx, tz);
  } else {
    lobbyLeg(path, cx, cz, tx, tz);
  }
}

export const NAV_RUNNING = 0;
export const NAV_ARRIVED = 1;
export const NAV_STUCK = 2;
export type NavStatus = typeof NAV_RUNNING | typeof NAV_ARRIVED | typeof NAV_STUCK;

/** Follows a planned path; the caller applies the steering it computes. */
export class PathFollower {
  readonly path = new Path();
  active = false;
  /** Steering for this frame (unit direction and wanted speed). */
  dirX = 0;
  dirZ = 1;
  speed = 0;
  /** Distance still to run along the path. */
  remaining = 0;
  /** Where the path ends. */
  endX = 0;
  endZ = 0;

  private seg = 0;
  private best = Infinity;
  private stall = 0;

  /** Plan and start following. */
  plan(fx: number, fz: number, tx: number, tz: number): void {
    planPath(this.path, fx, fz, tx, tz);
    this.endX = tx;
    this.endZ = tz;
    this.seg = 0;
    this.best = Infinity;
    this.stall = 0;
    this.active = true;
  }

  cancel(): void {
    this.active = false;
    this.speed = 0;
  }

  /**
   * Compute steering from the avatar's position. `waiting` pauses the stall
   * timer (e.g. while the avatar is held up by a door that is still opening).
   */
  steer(x: number, z: number, dt: number, waiting: boolean): NavStatus {
    const p = this.path;
    const last = p.count - 1;
    if (!this.active || last < 1) {
      this.active = false;
      return NAV_ARRIVED;
    }
    const xs = p.xs;
    const zs = p.zs;

    // 1. advance past waypoints that are behind us or close enough
    let t = 0;
    for (;;) {
      const ax = xs[this.seg];
      const az = zs[this.seg];
      const bx = xs[this.seg + 1];
      const bz = zs[this.seg + 1];
      const abx = bx - ax;
      const abz = bz - az;
      const len2 = abx * abx + abz * abz;
      t = len2 > 1e-10 ? ((x - ax) * abx + (z - az) * abz) / len2 : 1;
      const isLast = this.seg + 1 >= last;
      if (!isLast && (t >= 1 || Math.hypot(bx - x, bz - z) < CORNER_RADIUS)) {
        this.seg++;
        continue;
      }
      break;
    }
    t = clamp01(t);

    // 2. distance left: to the next waypoint, then the rest of the polyline
    let rem = Math.hypot(xs[this.seg + 1] - x, zs[this.seg + 1] - z);
    for (let k = this.seg + 1; k < last; k++) {
      rem += Math.hypot(xs[k + 1] - xs[k], zs[k + 1] - zs[k]);
    }
    this.remaining = rem;

    // 3. arrived? (the caller snaps the last few millimetres)
    const speed = Math.min(AUTO_SPEED, 2.2 + rem * 9);
    this.speed = speed;
    if (rem <= speed * dt + 0.015) {
      this.active = false;
      this.speed = 0;
      return NAV_ARRIVED;
    }

    // 4. stall watchdog: the path should get shorter all the time
    if (rem < this.best - 0.02) {
      this.best = rem;
      this.stall = 0;
    } else if (!waiting) {
      this.stall += dt;
      if (this.stall > 1.2) {
        this.active = false;
        this.speed = 0;
        return NAV_STUCK;
      }
    }

    // 5. aim at a point LOOKAHEAD further along the polyline
    let k = this.seg;
    let fromX = xs[k] + (xs[k + 1] - xs[k]) * t;
    let fromZ = zs[k] + (zs[k + 1] - zs[k]) * t;
    let budget = Math.min(LOOKAHEAD, rem);
    let aimX = xs[last];
    let aimZ = zs[last];
    for (;;) {
      const bx = xs[k + 1];
      const bz = zs[k + 1];
      const segLen = Math.hypot(bx - fromX, bz - fromZ);
      if (segLen >= budget || k + 1 >= last) {
        const f = segLen > 1e-8 ? Math.min(1, budget / segLen) : 1;
        aimX = fromX + (bx - fromX) * f;
        aimZ = fromZ + (bz - fromZ) * f;
        break;
      }
      budget -= segLen;
      fromX = bx;
      fromZ = bz;
      k++;
    }
    let dx = aimX - x;
    let dz = aimZ - z;
    let len = Math.hypot(dx, dz);
    if (len < 1e-4) {
      dx = xs[last] - x;
      dz = zs[last] - z;
      len = Math.hypot(dx, dz) || 1;
    }
    this.dirX = dx / len;
    this.dirZ = dz / len;
    return NAV_RUNNING;
  }
}

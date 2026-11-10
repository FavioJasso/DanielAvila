/**
 * Room layout — the single source of truth for where things are.
 * Pure maths, no three.js import, so the world, the engine and tests can
 * all share it.
 *
 * The lobby is a regular octagon centred on the origin. Five of its eight
 * walls carry a door (west, north-west, north, north-east, east); the other
 * three (south-west, south, south-east) are decorative.
 *
 * Each door wall, seen from above with "depth" d measured outward from the
 * lobby-side wall face (d = 0) and u measured to the right when facing the
 * wall from the centre:
 *
 *        back wall (d = ALCOVE_BACK)   ← painting hangs here, facing the lobby
 *     ┌───────────────┐
 *     │    alcove     │  half-width ALCOVE_HALF_WIDTH
 *     └───┐       ┌───┘  d = ARCH_DEPTH  ← door leaf (hinged at u = -DOOR_HALF_WIDTH)
 *         │ arch  │      half-width DOOR_HALF_WIDTH
 *  ───────┘       └───────  d = 0  (lobby wall face)
 *            lobby
 */
import type { Circle, Colliders, Segment, Vec2 } from "./contract";

export const ROOM = {
  /** Centre → wall-face distance. */
  apothem: 11,
  wallHeight: 7.5,
  /** Door opening. */
  doorWidth: 2.6,
  doorHeight: 3.6,
  /** Thickness of the stone archway the door is recessed into. */
  archDepth: 1.0,
  /** Alcove behind the door. */
  alcoveWidth: 3.8,
  alcoveDepth: 3.4,
  alcoveHeight: 4.6,
  /** Square painting on the alcove's back wall. */
  paintingSize: 2.4,
  paintingCenterY: 2.05,
  /** Centre pedestal (collider radius) and the star floating above it. */
  pedestalRadius: 0.8,
  starHeight: 2.35,
  /** Round red carpet with the "DA" emblem. */
  carpetRadius: 4.6,
  /** Avatar collision radius. */
  avatarRadius: 0.42,
} as const;

export const DOOR_HALF_WIDTH = ROOM.doorWidth / 2;
export const ALCOVE_HALF_WIDTH = ROOM.alcoveWidth / 2;
export const ARCH_DEPTH = ROOM.archDepth;
export const ALCOVE_BACK = ROOM.archDepth + ROOM.alcoveDepth;
/** Half the length of one octagon wall. */
export const WALL_HALF_LENGTH = ROOM.apothem * Math.tan(Math.PI / 8);

/** Wall bearings in degrees: 0 = north, +90 = east, -90 = west. */
export const DOOR_BEARINGS_DEG = [-90, -45, 0, 45, 90] as const;
export const PLAIN_WALL_BEARINGS_DEG = [135, 180, -135] as const;

/** Where the avatar stands when the game starts (on the carpet emblem). */
export const SPAWN: Vec2 & { yaw: number } = { x: 0, z: 2.8, yaw: Math.PI };
export const PEDESTAL: Vec2 = { x: 0, z: 0 };
/** Where the avatar stands for the star pose (south of the pedestal). */
export const STAR_STAND: Vec2 & { yaw: number } = { x: 0, z: 1.7, yaw: Math.PI };

export interface WallFrame {
  bearingDeg: number;
  /** Unit vector from the room centre towards the wall (outward). */
  dir: Vec2;
  /** Unit vector to the right when facing the wall from the centre. */
  right: Vec2;
  /** Midpoint of the lobby-side wall face. */
  mid: Vec2;
  /** Yaw of something facing the wall (looking outward). */
  yawOut: number;
  /** Yaw of something facing back into the lobby. */
  yawIn: number;
  /** Local (u = right, d = outward depth) → world ground point. */
  at(u: number, d: number): Vec2;
}

export function wallFrame(bearingDeg: number): WallFrame {
  const a = (bearingDeg * Math.PI) / 180;
  const dir = { x: Math.sin(a), z: -Math.cos(a) };
  const right = { x: Math.cos(a), z: Math.sin(a) };
  const mid = { x: dir.x * ROOM.apothem, z: dir.z * ROOM.apothem };
  return {
    bearingDeg,
    dir,
    right,
    mid,
    yawOut: Math.atan2(dir.x, dir.z),
    yawIn: Math.atan2(-dir.x, -dir.z),
    at: (u, d) => ({
      x: mid.x + right.x * u + dir.x * d,
      z: mid.z + right.z * u + dir.z * d,
    }),
  };
}

export interface DoorFrame extends WallFrame {
  index: number;
  /** Hinge of the door leaf (left jamb, at the back of the arch). */
  hinge: Vec2;
  /** Centre of the closed door leaf. */
  doorCenter: Vec2;
  /** Guided-navigation stop: in the lobby, facing the door. */
  standPoint: Vec2;
  /** Inside the alcove, in front of the painting. */
  enterPoint: Vec2;
  /** Where the avatar lands after being ejected, facing the lobby. */
  exitPoint: Vec2;
  /** Centre of the painting (world), which faces back into the lobby. */
  painting: { x: number; y: number; z: number };
}

/** Distance from the wall face (negative = inside the lobby). */
export const STAND_D = -3.4;
export const EXIT_D = -2.4;
export const ENTER_D = ALCOVE_BACK - 1.7;
/** Proximity sensor radii around the door centre. */
export const DOOR_OPEN_RADIUS = 5.2;
export const DOOR_CLOSE_RADIUS = 6.8;
/** Within this distance of the painting plane a jump becomes a dive. */
export const PAINTING_DIVE_RANGE = 2.6;

export function doorFrame(index: number): DoorFrame {
  const f = wallFrame(DOOR_BEARINGS_DEG[index]);
  const p = f.at(0, ALCOVE_BACK - 0.06);
  return {
    ...f,
    index,
    hinge: f.at(-DOOR_HALF_WIDTH, ARCH_DEPTH),
    doorCenter: f.at(0, ARCH_DEPTH),
    standPoint: f.at(0, STAND_D),
    enterPoint: f.at(0, ENTER_D),
    exitPoint: f.at(0, EXIT_D),
    painting: { x: p.x, y: ROOM.paintingCenterY, z: p.z },
  };
}

export const DOOR_FRAMES: readonly DoorFrame[] = DOOR_BEARINGS_DEG.map((_, i) =>
  doorFrame(i),
);

const seg = (a: Vec2, b: Vec2): Segment => ({ ax: a.x, az: a.z, bx: b.x, bz: b.z });

/**
 * Static collision geometry: the octagon with door gaps, the arch jambs and
 * the alcove walls, plus the pedestal circle. Door leaves are dynamic — see
 * `doorLeafSegment`.
 */
export function buildColliders(): Colliders {
  const segments: Segment[] = [];
  const L = WALL_HALF_LENGTH;
  const dw = DOOR_HALF_WIDTH;
  const aw = ALCOVE_HALF_WIDTH;
  for (const f of DOOR_FRAMES) {
    // wall face either side of the opening
    segments.push(seg(f.at(-L, 0), f.at(-dw, 0)));
    segments.push(seg(f.at(dw, 0), f.at(L, 0)));
    // arch jambs
    segments.push(seg(f.at(-dw, 0), f.at(-dw, ARCH_DEPTH)));
    segments.push(seg(f.at(dw, 0), f.at(dw, ARCH_DEPTH)));
    // alcove front shoulders
    segments.push(seg(f.at(-aw, ARCH_DEPTH), f.at(-dw, ARCH_DEPTH)));
    segments.push(seg(f.at(dw, ARCH_DEPTH), f.at(aw, ARCH_DEPTH)));
    // alcove sides and back
    segments.push(seg(f.at(-aw, ARCH_DEPTH), f.at(-aw, ALCOVE_BACK)));
    segments.push(seg(f.at(aw, ARCH_DEPTH), f.at(aw, ALCOVE_BACK)));
    segments.push(seg(f.at(-aw, ALCOVE_BACK), f.at(aw, ALCOVE_BACK)));
  }
  for (const bearing of PLAIN_WALL_BEARINGS_DEG) {
    const f = wallFrame(bearing);
    segments.push(seg(f.at(-L, 0), f.at(L, 0)));
  }
  const circles: Circle[] = [{ x: PEDESTAL.x, z: PEDESTAL.z, r: ROOM.pedestalRadius }];
  return { segments, circles };
}

/** The closed door leaf as a blocker; use while `openAmount` < 0.6. */
export function doorLeafSegment(index: number): Segment {
  const f = DOOR_FRAMES[index];
  return seg(f.at(-DOOR_HALF_WIDTH, ARCH_DEPTH), f.at(DOOR_HALF_WIDTH, ARCH_DEPTH));
}

/** Which door's alcove / arch a ground point is inside, or -1. */
export function alcoveIndexAt(p: Vec2): number {
  for (const f of DOOR_FRAMES) {
    const rx = p.x - f.mid.x;
    const rz = p.z - f.mid.z;
    const d = rx * f.dir.x + rz * f.dir.z;
    const u = rx * f.right.x + rz * f.right.z;
    if (d > 0 && d < ALCOVE_BACK && Math.abs(u) < ALCOVE_HALF_WIDTH) return f.index;
  }
  return -1;
}

/** Depth of a ground point relative to a door's wall face (see diagram). */
export function depthAtDoor(index: number, p: Vec2): { u: number; d: number } {
  const f = DOOR_FRAMES[index];
  const rx = p.x - f.mid.x;
  const rz = p.z - f.mid.z;
  return {
    d: rx * f.dir.x + rz * f.dir.z,
    u: rx * f.right.x + rz * f.right.z,
  };
}

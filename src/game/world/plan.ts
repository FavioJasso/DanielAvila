/**
 * Dimensions of everything the world module adds on top of `layout.ts`
 * (mouldings, arches, torches, signs …). `layout.ts` stays authoritative for
 * the walls, doors, alcoves and paintings; nothing here moves a collider.
 */
import { DOORS } from "../contract";
import {
  ALCOVE_BACK,
  DOOR_FRAMES,
  DOOR_HALF_WIDTH,
  PLAIN_WALL_BEARINGS_DEG,
  ROOM,
  wallFrame,
  type WallFrame,
} from "../layout";
import { hexToRgb, type RGB, type V3 } from "./util";

/** Door arches are true semicircles: the springline sits one radius below the apex. */
export const SPRING_Y = ROOM.doorHeight - DOOR_HALF_WIDTH;
export const ARCH_SEGMENTS = 8;

/** Stone surround (jamb pilasters + voussoir ring) standing proud of the wall. */
export const SURROUND_WIDTH = 0.6;
export const SURROUND_OUT = 0.14;

/** Lobby wall mouldings. */
export const BASE_HEIGHT = 0.5;
export const BASE_OUT = 0.1;
export const DADO_Y0 = SPRING_Y - 0.32;
export const DADO_Y1 = SPRING_Y;
export const DADO_OUT = 0.1;
export const CORNICE_Y0 = 6.85;
/** Painted frieze directly under the cornice (one square texture tile tall). */
export const FRIEZE_Y0 = 6.25;
export const FRIEZE_Y1 = CORNICE_Y0;
export const CORNICE_Y1 = 7.12;
export const CORNICE_OUT0 = 0.14;
export const CORNICE_OUT1 = 0.3;

/** Corner pillars (three faces of an octagonal prism centred on each corner). */
export const PILLAR_RADIUS = 0.44;
export const PILLAR_BASE_RADIUS = 0.56;
export const PILLAR_BASE_HEIGHT = 0.62;
export const PILLAR_CAP_RADIUS = 0.62;
export const PILLAR_CAP_Y = 6.4;

/** The sky ceiling is a shallow dome rising from the wall tops. */
export const DOME_RISE = 2.1;

/** Checkerboard: one 64 px texture tile (2×2 squares) covers this many metres. */
export const CHECKER_TILE = 2.75;

/** The DA emblem lies on the carpet under the spawn point, facing the entrance. */
export const EMBLEM_SIZE = 2.3;

/** Picture frame. */
export const FRAME_WIDTH = 0.17;

/** Grand (decorative) south entrance. */
export const SOUTH_DOOR = {
  halfWidth: 1.7,
  springY: 3.4,
  recess: 0.45,
  surroundWidth: 0.62,
} as const;

/** Door signs. */
export const SIGN_Y = 4.86;
export const SIGN_OUT = 0.32;
export const SIGN_THICKNESS = 0.14;
/** Metres per canvas pixel on a door sign. */
export const SIGN_M_PER_PX = 0.026;
export const EMBLEM_STAR_OUT = 0.42;

/** Door leaf. */
export const LEAF_THICKNESS = 0.14;
export const LEAF_GAP = 0.02;
/** Fully open, the leaf rests just clear of the alcove's side wall (≈100°). */
export const LEAF_OPEN_ANGLE = 1.75;

/** Banners on the two plain diagonal walls. */
export const BANNER = {
  halfWidth: 1.15,
  top: 6.15,
  bottom: 1.95,
  tip: 1.3,
  out: 0.09,
} as const;

export const ALL_BEARINGS_DEG: readonly number[] = [-90, -45, 0, 45, 90, 135, 180, -135];
export const SOUTH_FRAME: WallFrame = wallFrame(180);
export const BANNER_FRAMES: readonly WallFrame[] = PLAIN_WALL_BEARINGS_DEG.filter(
  (b) => b !== 180,
).map((b) => wallFrame(b));

export const DOOR_ACCENTS: readonly RGB[] = DOORS.map((d) => hexToRgb(d.accent));

/** Local wall coordinates (u = right, y = up, d = outward depth) → world. */
export function wallPoint(f: WallFrame, u: number, y: number, d: number): V3 {
  const g = f.at(u, d);
  return [g.x, y, g.z];
}

/* ------------------------------------------------------------------ */
/* Torches                                                             */
/* ------------------------------------------------------------------ */

export interface TorchSpot {
  /** Top centre of the iron cup = base of the flame. */
  x: number;
  y: number;
  z: number;
  /** Point on the wall the bracket is fixed to (same height as the cup's foot). */
  wx: number;
  wz: number;
  /** Alcove index the torch lights, or -1 for the lobby. */
  zone: number;
  size: number;
}

const TORCH_U = 1.635;
const TORCH_Y = 2.52;
const TORCH_OUT = 0.3;

function alcoveTorches(): TorchSpot[] {
  const out: TorchSpot[] = [];
  for (const f of DOOR_FRAMES) {
    for (const side of [-1, 1]) {
      const p = f.at(side * TORCH_U, ALCOVE_BACK - TORCH_OUT);
      const w = f.at(side * TORCH_U, ALCOVE_BACK);
      out.push({ x: p.x, y: TORCH_Y, z: p.z, wx: w.x, wz: w.z, zone: f.index, size: 1 });
    }
  }
  return out;
}

/** Octagon corners, as bearings. */
const CORNER_BEARINGS_DEG: readonly number[] = [
  -112.5, -67.5, -22.5, 22.5, 67.5, 112.5, 157.5, -157.5,
];

export interface Corner {
  /** The corner itself (where two wall faces meet). */
  x: number;
  z: number;
  /** Unit vector from the corner towards the room centre. */
  ix: number;
  iz: number;
  /** Unit tangent (perpendicular to `i`, on the ground plane). */
  tx: number;
  tz: number;
}

export const CORNERS: readonly Corner[] = CORNER_BEARINGS_DEG.map((deg) => {
  const a = (deg * Math.PI) / 180;
  const r = ROOM.apothem / Math.cos(Math.PI / 8);
  const sx = Math.sin(a);
  const sz = -Math.cos(a);
  return { x: sx * r, z: sz * r, ix: -sx, iz: -sz, tx: -sz, tz: sx };
});

const PILLAR_TORCH_Y = 3.3;

function pillarTorches(): TorchSpot[] {
  const face = PILLAR_RADIUS * Math.cos(Math.PI / 8);
  return CORNERS.map((c) => ({
    x: c.x + c.ix * (face + 0.3),
    y: PILLAR_TORCH_Y,
    z: c.z + c.iz * (face + 0.3),
    wx: c.x + c.ix * face,
    wz: c.z + c.iz * face,
    zone: -1,
    size: 1.15,
  }));
}

export const ALCOVE_TORCHES: readonly TorchSpot[] = alcoveTorches();
export const PILLAR_TORCHES: readonly TorchSpot[] = pillarTorches();
export const TORCHES: readonly TorchSpot[] = [...ALCOVE_TORCHES, ...PILLAR_TORCHES];

/* ------------------------------------------------------------------ */
/* Star emblems above the doors                                        */
/* ------------------------------------------------------------------ */

export interface EmblemStar {
  /** Offset along the wall from the door's centre line. */
  u: number;
  y: number;
  radius: number;
}

/** 1 star, 3 stars, one big star, 3 stars, 1 star — straight from `DoorSpec.badge`. */
export function emblemStars(badge: 1 | 3 | "big"): EmblemStar[] {
  if (badge === "big") return [{ u: 0, y: 5.98, radius: 0.66 }];
  if (badge === 3) {
    return [
      { u: -0.88, y: 5.74, radius: 0.36 },
      { u: 0, y: 6.0, radius: 0.4 },
      { u: 0.88, y: 5.74, radius: 0.36 },
    ];
  }
  return [{ u: 0, y: 5.86, radius: 0.46 }];
}

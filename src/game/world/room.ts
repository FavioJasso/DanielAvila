/**
 * The static lobby shell: floor, carpet, walls, mouldings, corner pillars and
 * the sky dome. Every wall face is generated from `layout.ts` (wall frames,
 * door widths, alcove sizes), so the visible walls sit exactly on the
 * colliders the avatar bumps into. Wall faces are single-sided, facing in.
 */
import {
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_FRAMES,
  DOOR_HALF_WIDTH,
  ROOM,
  SPAWN,
  WALL_HALF_LENGTH,
  wallFrame,
  type WallFrame,
} from "../layout";
import { MeshBuilder, type FaceStyle, type UvMap } from "./builder";
import type { Shade } from "./lighting";
import {
  ALL_BEARINGS_DEG,
  ARCH_SEGMENTS,
  BANNER_FRAMES,
  BASE_HEIGHT,
  BASE_OUT,
  CHECKER_TILE,
  CORNERS,
  CORNICE_OUT0,
  CORNICE_OUT1,
  CORNICE_Y0,
  CORNICE_Y1,
  DADO_OUT,
  DADO_Y0,
  DADO_Y1,
  DOME_RISE,
  EMBLEM_SIZE,
  FRIEZE_Y0,
  FRIEZE_Y1,
  PILLAR_BASE_HEIGHT,
  PILLAR_BASE_RADIUS,
  PILLAR_CAP_RADIUS,
  PILLAR_CAP_Y,
  PILLAR_RADIUS,
  SOUTH_DOOR,
  SOUTH_FRAME,
  SPRING_Y,
  SURROUND_OUT,
  SURROUND_WIDTH,
  wallPoint,
  type Corner,
} from "./plan";
import { lerp, type RGB, type V2, type V3 } from "./util";

/** One builder per material = one merged mesh per material. */
export interface Builders {
  floor: MeshBuilder;
  carpet: MeshBuilder;
  gold: MeshBuilder;
  stone: MeshBuilder;
  slab: MeshBuilder;
  plaster: MeshBuilder;
  /** Painted band of blue and gold under the cornice. */
  frieze: MeshBuilder;
  wood: MeshBuilder;
  sky: MeshBuilder;
  banner: MeshBuilder;
  /** Untextured, vertex-coloured bits: iron, glass. */
  flat: MeshBuilder;
  /** Cut-out DA emblems (carpet + banners). */
  emblem: MeshBuilder;
}

export function createBuilders(shade: Shade): Builders {
  const make = () => new MeshBuilder(shade);
  return {
    floor: make(),
    carpet: make(),
    gold: make(),
    stone: make(),
    slab: make(),
    plaster: make(),
    frieze: make(),
    wood: make(),
    sky: make(),
    banner: make(),
    flat: make(),
    emblem: make(),
  };
}

export const UP: V3 = [0, 1, 0];
export const DOWN: V3 = [0, -1, 0];
export const vIn = (f: WallFrame): V3 => [-f.dir.x, 0, -f.dir.z];
export const vOut = (f: WallFrame): V3 => [f.dir.x, 0, f.dir.z];
export const vRight = (f: WallFrame): V3 => [f.right.x, 0, f.right.z];
export const vLeft = (f: WallFrame): V3 => [-f.right.x, 0, -f.right.z];

/** Display-space tints that turn the cream slab texture into each stone. */
export const TINT = {
  // warm-grey dressed stone …
  pillar: [0.775, 0.765, 0.755] as RGB,
  pillarBase: [0.69, 0.685, 0.68] as RGB,
  base: [0.71, 0.7, 0.685] as RGB,
  surroundA: [0.84, 0.825, 0.805] as RGB,
  surroundB: [0.735, 0.72, 0.705] as RGB,
  keystone: [0.94, 0.925, 0.895] as RGB,
  threshold: [0.68, 0.67, 0.655] as RGB,
  // … against cream mouldings
  trim: [0.88, 0.85, 0.8] as RGB,
  cornice: [0.92, 0.89, 0.84] as RGB,
} as const;

const L = WALL_HALF_LENGTH;
const H = ROOM.wallHeight;
const TAN_PI_8 = Math.tan(Math.PI / 8);

const STONE_UV = 2.0;
const PLASTER_UV = 3.0;
const SLAB_UV = 1.0;
const CARPET_UV = 1.6;
const GOLD_UV = 0.8;

const CARPET_Y = 0.024;
const RUNNER_Y = 0.012;
const DECAL_Y = 0.036;

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

export interface ArchPoint {
  u: number;
  y: number;
}

/** Semicircular arch of radius `r` springing at `springY`, left → right. */
export function archProfile(r: number, springY: number, seg = ARCH_SEGMENTS): ArchPoint[] {
  const pts: ArchPoint[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI * (1 - i / seg);
    pts.push({
      u: i === 0 ? -r : i === seg ? r : i * 2 === seg ? 0 : r * Math.cos(a),
      y: i === 0 || i === seg ? springY : springY + r * Math.sin(a),
    });
  }
  return pts;
}

/** A horizontal band of a wall face, with its own material and mapping. */
export interface WallBand {
  /** Cells that end at or below this height belong to the band. */
  top: number;
  builder: MeshBuilder;
  /** Texture coordinates for a point (u along the wall, y up). */
  uv: (u: number, y: number) => V2;
}

/** Uniform world-scaled mapping: `k` metres per texture repeat. */
export const scaledUv =
  (k: number) =>
  (u: number, y: number): V2 => [u / k, y / k];

export interface WallFaceSpec {
  f: WallFrame;
  /** Depth of the plane (0 = the lobby wall face). */
  d: number;
  /** true: faces the room centre. false: faces outward (the alcove side of the door wall). */
  inward: boolean;
  /** Positive-u column edges from the opening (or the centre) out to the wall's end. */
  cols: number[];
  /** Row edges, 0 … top. With an opening they must include its springline and apex and nothing between. */
  rows: number[];
  opening?: { halfW: number; springY: number };
  /** Bottom → top; the last band also takes anything above it. */
  bands: WallBand[];
  tint?: RGB;
}

/**
 * A wall on a regular grid of columns and rows, with an optional arched
 * opening. Columns and rows are shared by every cell so there are no
 * T-junctions (which would sparkle at 480p).
 */
export function wallFace(s: WallFaceSpec): void {
  const { f, d } = s;
  const style: FaceStyle = { facing: s.inward ? vIn(f) : vOut(f), tint: s.tint };
  const P = (u: number, y: number) => wallPoint(f, u, y, d);
  const bandFor = (top: number): WallBand =>
    s.bands.find((band) => top <= band.top + 1e-6) ?? s.bands[s.bands.length - 1];
  const cell = (u0: number, u1: number, y0: number, y1: number) => {
    const band = bandFor(y1);
    band.builder.quad(
      P(u0, y0),
      P(u1, y0),
      P(u1, y1),
      P(u0, y1),
      band.uv(u0, y0),
      band.uv(u1, y0),
      band.uv(u1, y1),
      band.uv(u0, y1),
      style,
    );
  };
  const rows = s.rows;
  if (!s.opening) {
    const edges = [...s.cols.map((c) => -c).reverse(), ...s.cols.filter((c) => c > 0)];
    for (let i = 0; i + 1 < edges.length; i++) {
      for (let j = 0; j + 1 < rows.length; j++) cell(edges[i], edges[i + 1], rows[j], rows[j + 1]);
    }
    return;
  }
  const { halfW, springY } = s.opening;
  const apex = springY + halfW;
  const edges = [halfW, ...s.cols];
  for (const side of [-1, 1]) {
    for (let i = 0; i + 1 < edges.length; i++) {
      const u0 = Math.min(edges[i] * side, edges[i + 1] * side);
      const u1 = Math.max(edges[i] * side, edges[i + 1] * side);
      for (let j = 0; j + 1 < rows.length; j++) cell(u0, u1, rows[j], rows[j + 1]);
    }
  }
  const arch = archProfile(halfW, springY);
  const head = bandFor(apex);
  for (let i = 0; i + 1 < arch.length; i++) {
    const a = arch[i];
    const c = arch[i + 1];
    // between the curve and the apex row (collapses to a triangle at the apex)
    head.builder.quad(
      P(a.u, a.y),
      P(c.u, c.y),
      P(c.u, apex),
      P(a.u, apex),
      head.uv(a.u, a.y),
      head.uv(c.u, c.y),
      head.uv(c.u, apex),
      head.uv(a.u, apex),
      style,
    );
    for (let j = 0; j + 1 < rows.length; j++) {
      if (rows[j] >= apex - 1e-6) cell(a.u, c.u, rows[j], rows[j + 1]);
    }
  }
}

export interface MouldingOpts {
  /** Shorten the front face at either end (mitres, inside corners). */
  trimA?: number;
  trimB?: number;
  top?: boolean;
  bottom?: boolean;
  tint?: RGB;
}

/**
 * A moulding along the ground line A → B, standing `out` proud of the wall
 * towards the unit normal (nx, nz), between heights y0 and y1.
 */
export function moulding(
  b: MeshBuilder,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  nx: number,
  nz: number,
  y0: number,
  y1: number,
  out: number,
  opts: MouldingOpts = {},
): void {
  const len = Math.hypot(bx - ax, bz - az);
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  const ta = opts.trimA ?? 0;
  const tb = opts.trimB ?? 0;
  const style: FaceStyle = { tint: opts.tint, facing: [nx, 0, nz] };
  const seg = Math.max(1, Math.ceil((len - ta - tb) / 2.4));
  // one course of the slab texture (its upper half) across the face
  const v0 = 0.5;
  const v1 = 1;
  const front = (s: number, y: number): V3 => [ax + tx * s + nx * out, y, az + tz * s + nz * out];
  const back = (s: number, y: number): V3 => [ax + tx * s, y, az + tz * s];
  for (let i = 0; i < seg; i++) {
    const s0 = lerp(ta, len - tb, i / seg);
    const s1 = lerp(ta, len - tb, (i + 1) / seg);
    b.quad(
      front(s0, y0),
      front(s1, y0),
      front(s1, y1),
      front(s0, y1),
      [s0 / SLAB_UV, v0],
      [s1 / SLAB_UV, v0],
      [s1 / SLAB_UV, v1],
      [s0 / SLAB_UV, v1],
      style,
    );
    // returns: the wall-side edge runs the full length, the front edge is trimmed
    const w0 = i === 0 ? 0 : s0;
    const w1 = i === seg - 1 ? len : s1;
    if (opts.top) {
      b.quad(
        front(s0, y1),
        front(s1, y1),
        back(w1, y1),
        back(w0, y1),
        [s0 / SLAB_UV, 0.62],
        [s1 / SLAB_UV, 0.62],
        [w1 / SLAB_UV, 0.62 + out / SLAB_UV],
        [w0 / SLAB_UV, 0.62 + out / SLAB_UV],
        { tint: opts.tint, facing: UP },
      );
    }
    if (opts.bottom) {
      b.quad(
        front(s0, y0),
        front(s1, y0),
        back(w1, y0),
        back(w0, y0),
        [s0 / SLAB_UV, 0.62],
        [s1 / SLAB_UV, 0.62],
        [w1 / SLAB_UV, 0.62 + out / SLAB_UV],
        [w0 / SLAB_UV, 0.62 + out / SLAB_UV],
        { tint: opts.tint, facing: DOWN },
      );
    }
  }
}

/** Point on the octagon's boundary at a bearing (radians, 0 = north). */
function octagonEdge(angle: number): [number, number] {
  const step = Math.PI / 4;
  const rel = angle - Math.round(angle / step) * step;
  const r = ROOM.apothem / Math.cos(rel);
  return [Math.sin(angle) * r, -Math.cos(angle) * r];
}

/* ------------------------------------------------------------------ */
/* Floor and carpet                                                    */
/* ------------------------------------------------------------------ */

function buildFloor(b: Builders): void {
  const N = 32;
  const rings = [0.2, 0.42, 0.64, 0.86, 1];
  const uv = (x: number, z: number): V2 => [x / CHECKER_TILE, z / CHECKER_TILE];
  const style: FaceStyle = { facing: UP };
  const pt = (k: number, s: number): V3 => {
    const [x, z] = octagonEdge(((k % N) / N) * Math.PI * 2);
    return [x * s, 0, z * s];
  };
  const T = (p: V3) => uv(p[0], p[2]);
  for (let k = 0; k < N; k++) {
    const a = pt(k, rings[0]);
    const c = pt(k + 1, rings[0]);
    b.floor.tri([0, 0, 0], a, c, uv(0, 0), T(a), T(c), style);
    for (let r = 0; r + 1 < rings.length; r++) {
      const p0 = pt(k, rings[r]);
      const p1 = pt(k + 1, rings[r]);
      const p2 = pt(k + 1, rings[r + 1]);
      const p3 = pt(k, rings[r + 1]);
      b.floor.quad(p0, p1, p2, p3, T(p0), T(p1), T(p2), T(p3), style);
    }
  }
  // under each archway and inside each alcove; the checker stays world-aligned
  for (const f of DOOR_FRAMES) {
    const worldUv =
      (o: V3): UvMap =>
      (a, c) =>
        uv(o[0] + f.right.x * a + f.dir.x * c, o[2] + f.right.z * a + f.dir.z * c);
    const o1 = wallPoint(f, -DOOR_HALF_WIDTH, 0, 0);
    b.floor.plane(o1, vRight(f), ROOM.doorWidth, vOut(f), ARCH_DEPTH, 1, 1, worldUv(o1), style);
    // (laps a little under the alcove walls so no crack can open along them)
    const lap = 0.02;
    const o2 = wallPoint(f, -ALCOVE_HALF_WIDTH - lap, 0, ARCH_DEPTH - lap);
    b.floor.plane(
      o2,
      vRight(f),
      ROOM.alcoveWidth + lap * 2,
      vOut(f),
      ROOM.alcoveDepth + lap * 2,
      3,
      3,
      worldUv(o2),
      style,
    );
    // stone threshold over both joins, with a small lip towards the lobby
    const y = 0.03;
    const d0 = -SURROUND_OUT;
    const d1 = ARCH_DEPTH + 0.08;
    const tint = TINT.threshold;
    b.slab.quad(
      wallPoint(f, -DOOR_HALF_WIDTH, y, d0),
      wallPoint(f, DOOR_HALF_WIDTH, y, d0),
      wallPoint(f, DOOR_HALF_WIDTH, y, d1),
      wallPoint(f, -DOOR_HALF_WIDTH, y, d1),
      [0.04, 0.52],
      [0.04 + ROOM.doorWidth / 2.9, 0.52],
      [0.04 + ROOM.doorWidth / 2.9, 0.96],
      [0.04, 0.96],
      { facing: UP, tint },
    );
    b.slab.quad(
      wallPoint(f, -DOOR_HALF_WIDTH, 0, d0),
      wallPoint(f, DOOR_HALF_WIDTH, 0, d0),
      wallPoint(f, DOOR_HALF_WIDTH, y, d0),
      wallPoint(f, -DOOR_HALF_WIDTH, y, d0),
      [0.04, 0.6],
      [0.9, 0.6],
      [0.9, 0.64],
      [0.04, 0.64],
      { facing: vIn(f), tint },
    );
  }
}

function ringBand(
  b: MeshBuilder,
  r0: number,
  r1: number,
  y: number,
  seg: number,
  uvScale: number,
  tint?: RGB,
): void {
  const style: FaceStyle = { facing: UP, tint };
  const pt = (r: number, k: number): V3 => {
    const a = ((k % seg) / seg) * Math.PI * 2;
    return [Math.sin(a) * r, y, -Math.cos(a) * r];
  };
  const T = (p: V3): V2 => [p[0] / uvScale, p[2] / uvScale];
  for (let k = 0; k < seg; k++) {
    const p0 = pt(r0, k);
    const p1 = pt(r0, k + 1);
    const p2 = pt(r1, k + 1);
    const p3 = pt(r1, k);
    b.quad(p0, p1, p2, p3, T(p0), T(p1), T(p2), T(p3), style);
  }
}

function buildCarpet(b: Builders): void {
  const R = ROOM.carpetRadius;
  const SEG = 24;
  const edgeTint: RGB = [0.8, 0.8, 0.8];
  // from the pedestal's foot outwards: red, a thin gold ring, the red field,
  // the broad gold trim, a darker red border
  ringBand(b.carpet, 0.7, 1.14, CARPET_Y, SEG, CARPET_UV);
  ringBand(b.gold, 1.14, 1.3, CARPET_Y, SEG, GOLD_UV);
  ringBand(b.carpet, 1.3, 2.6, CARPET_Y, SEG, CARPET_UV);
  ringBand(b.carpet, 2.6, R - 0.68, CARPET_Y, SEG, CARPET_UV);
  ringBand(b.gold, R - 0.68, R - 0.34, CARPET_Y, SEG, GOLD_UV);
  ringBand(b.carpet, R - 0.34, R, CARPET_Y, SEG, CARPET_UV, edgeTint);

  // runner from the carpet to the centre door, tucked just under the carpet's rim
  const f = DOOR_FRAMES[2];
  const half = 1.0;
  const trim = 0.17;
  const dStart = -(ROOM.apothem - (R - 0.2));
  const dEnd = -SURROUND_OUT;
  const SEGS = 4;
  const style: FaceStyle = { facing: UP };
  const P = (u: number, d: number) => wallPoint(f, u, RUNNER_Y, d);
  const strip = (mb: MeshBuilder, u0: number, u1: number, scale: number, tint?: RGB) => {
    for (let i = 0; i < SEGS; i++) {
      const d0 = lerp(dStart, dEnd, i / SEGS);
      const d1 = lerp(dStart, dEnd, (i + 1) / SEGS);
      const q = [P(u0, d0), P(u1, d0), P(u1, d1), P(u0, d1)] as const;
      const T = (p: V3): V2 => [p[0] / scale, p[2] / scale];
      mb.quad(q[0], q[1], q[2], q[3], T(q[0]), T(q[1]), T(q[2]), T(q[3]), { ...style, tint });
    }
  };
  strip(b.gold, -half, -half + trim, GOLD_UV);
  strip(b.carpet, -half + trim, half - trim, CARPET_UV);
  strip(b.gold, half - trim, half, GOLD_UV);

  // the DA emblem under the spawn point, reading upright from the entrance
  const h = EMBLEM_SIZE / 2;
  b.emblem.quad(
    [SPAWN.x - h, DECAL_Y, SPAWN.z + h],
    [SPAWN.x + h, DECAL_Y, SPAWN.z + h],
    [SPAWN.x + h, DECAL_Y, SPAWN.z - h],
    [SPAWN.x - h, DECAL_Y, SPAWN.z - h],
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    { facing: UP },
  );
}

/* ------------------------------------------------------------------ */
/* Walls, mouldings, pillars                                           */
/* ------------------------------------------------------------------ */

function buildWalls(b: Builders): void {
  // stone blocks to the dado, plaster above, a painted frieze under the cornice
  const friezeH = FRIEZE_Y1 - FRIEZE_Y0;
  const bands: WallBand[] = [
    { top: SPRING_Y, builder: b.stone, uv: scaledUv(STONE_UV) },
    { top: FRIEZE_Y0, builder: b.plaster, uv: scaledUv(PLASTER_UV) },
    // one tile tall, and centred so a star sits above the middle of each wall
    { top: FRIEZE_Y1, builder: b.frieze, uv: (u, y) => [u / friezeH + 0.5, (y - FRIEZE_Y0) / friezeH] },
    { top: H, builder: b.plaster, uv: scaledUv(PLASTER_UV) },
  ];
  const shared = { d: 0, inward: true, bands };
  const upper = [FRIEZE_Y0, FRIEZE_Y1, H];
  for (const f of DOOR_FRAMES) {
    wallFace({
      ...shared,
      f,
      cols: [3.1, L],
      rows: [0, 1.15, SPRING_Y, ROOM.doorHeight, 4.95, ...upper],
      opening: { halfW: DOOR_HALF_WIDTH, springY: SPRING_Y },
    });
  }
  for (const f of BANNER_FRAMES) {
    wallFace({
      ...shared,
      f,
      cols: [0, 2.28, L],
      rows: [0, 1.15, SPRING_Y, ROOM.doorHeight, 4.95, ...upper],
    });
  }
  const s = SOUTH_DOOR;
  wallFace({
    ...shared,
    f: SOUTH_FRAME,
    cols: [3.1, L],
    rows: [0, 1.15, SPRING_Y, s.springY, s.springY + s.halfWidth, ...upper],
    opening: { halfW: s.halfWidth, springY: s.springY },
  });
}

function buildMouldings(b: Builders): void {
  for (const bearing of ALL_BEARINGS_DEG) {
    const f = wallFrame(bearing);
    const nx = -f.dir.x;
    const nz = -f.dir.z;
    const isDoor = DOOR_FRAMES.some((d) => d.bearingDeg === bearing);
    const isSouth = bearing === 180;
    // base course and dado stop either side of a door surround
    const gap = isDoor
      ? DOOR_HALF_WIDTH + SURROUND_WIDTH
      : isSouth
        ? SOUTH_DOOR.halfWidth + SOUTH_DOOR.surroundWidth
        : 0;
    const runs: [number, number, boolean, boolean][] =
      gap > 0
        ? [
            [-L, -gap, true, false],
            [gap, L, false, true],
          ]
        : [[-L, L, true, true]];
    for (const [u0, u1, mitre0, mitre1] of runs) {
      const A = f.at(u0, 0);
      const B = f.at(u1, 0);
      moulding(b.slab, A.x, A.z, B.x, B.z, nx, nz, 0, BASE_HEIGHT, BASE_OUT, {
        trimA: mitre0 ? BASE_OUT * TAN_PI_8 : 0,
        trimB: mitre1 ? BASE_OUT * TAN_PI_8 : 0,
        top: true,
        tint: TINT.base,
      });
      moulding(b.slab, A.x, A.z, B.x, B.z, nx, nz, DADO_Y0, DADO_Y1, DADO_OUT, {
        trimA: mitre0 ? DADO_OUT * TAN_PI_8 : 0,
        trimB: mitre1 ? DADO_OUT * TAN_PI_8 : 0,
        top: true,
        bottom: true,
        tint: TINT.trim,
      });
    }
    // two-step cornice right round the room
    const A = f.at(-L, 0);
    const B = f.at(L, 0);
    moulding(b.slab, A.x, A.z, B.x, B.z, nx, nz, CORNICE_Y0, CORNICE_Y1, CORNICE_OUT0, {
      trimA: CORNICE_OUT0 * TAN_PI_8,
      trimB: CORNICE_OUT0 * TAN_PI_8,
      bottom: true,
      tint: TINT.trim,
    });
    moulding(b.slab, A.x, A.z, B.x, B.z, nx, nz, CORNICE_Y1, H, CORNICE_OUT1, {
      trimA: CORNICE_OUT1 * TAN_PI_8,
      trimB: CORNICE_OUT1 * TAN_PI_8,
      bottom: true,
      tint: TINT.cornice,
    });
  }
}

/**
 * Corner pillar: the three faces of an octagonal prism (centred on the
 * corner) that lie inside the room. Its outer edges land exactly on the two
 * walls, so nothing pokes out when the camera slips outside.
 */
function buildPillar(b: MeshBuilder, c: Corner): void {
  const ring = (r: number, k: number, y: number): V3 => {
    const a = ((-67.5 + 45 * k) * Math.PI) / 180;
    const ca = Math.cos(a) * r;
    const sa = Math.sin(a) * r;
    return [c.x + ca * c.ix + sa * c.tx, y, c.z + ca * c.iz + sa * c.tz];
  };
  const normal = (k: number): V3 => {
    const a = ((-45 + 45 * k) * Math.PI) / 180;
    return [Math.cos(a) * c.ix + Math.sin(a) * c.tx, 0, Math.cos(a) * c.iz + Math.sin(a) * c.tz];
  };
  const drum = (r: number, y0: number, y1: number, tint: RGB) => {
    for (let k = 0; k < 3; k++) {
      b.quad(
        ring(r, k, y0),
        ring(r, k + 1, y0),
        ring(r, k + 1, y1),
        ring(r, k, y1),
        [0.06, y0 / SLAB_UV],
        [0.44, y0 / SLAB_UV],
        [0.44, y1 / SLAB_UV],
        [0.06, y1 / SLAB_UV],
        { facing: normal(k), tint },
      );
    }
  };
  const ledge = (rIn: number, rOut: number, y: number, facing: V3, tint: RGB) => {
    for (let k = 0; k < 3; k++) {
      b.quad(
        ring(rIn, k, y),
        ring(rIn, k + 1, y),
        ring(rOut, k + 1, y),
        ring(rOut, k, y),
        [0.1, 0.6],
        [0.4, 0.6],
        [0.4, 0.72],
        [0.1, 0.72],
        { facing, tint },
      );
    }
  };
  drum(PILLAR_BASE_RADIUS, 0, PILLAR_BASE_HEIGHT, TINT.pillarBase);
  ledge(PILLAR_RADIUS, PILLAR_BASE_RADIUS, PILLAR_BASE_HEIGHT, UP, TINT.pillarBase);
  const shaft = [PILLAR_BASE_HEIGHT, SPRING_Y, 4.35, PILLAR_CAP_Y];
  for (let i = 0; i + 1 < shaft.length; i++) drum(PILLAR_RADIUS, shaft[i], shaft[i + 1], TINT.pillar);
  ledge(PILLAR_RADIUS, PILLAR_CAP_RADIUS, PILLAR_CAP_Y, DOWN, TINT.trim);
  drum(PILLAR_CAP_RADIUS, PILLAR_CAP_Y, H, TINT.trim);
}

/* ------------------------------------------------------------------ */
/* Sky dome                                                            */
/* ------------------------------------------------------------------ */

/** Metres per repeat of the cloud texture. */
const SKY_UV = 10;

function buildDome(b: Builders): void {
  const N = 16;
  const scales = [1, 0.72, 0.42, 0.16];
  const rot = (25 * Math.PI) / 180;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  // hazy and pale at the rim, deeper blue overhead
  const rim: RGB = [1.22, 1.1, 1.0];
  const zenith: RGB = [0.8, 0.88, 1.0];
  const tintAt = (s: number): RGB => {
    const t = 1 - s * s;
    return [lerp(rim[0], zenith[0], t), lerp(rim[1], zenith[1], t), lerp(rim[2], zenith[2], t)];
  };
  const pt = (k: number, s: number): V3 => {
    const [x, z] = octagonEdge(((k % N) / N) * Math.PI * 2);
    return [x * s, H + DOME_RISE * (1 - s * s), z * s];
  };
  const T = (p: V3): V2 => [(p[0] * cr - p[2] * sr) / SKY_UV, (p[0] * sr + p[2] * cr) / SKY_UV];
  const style: FaceStyle = { facing: DOWN, unlit: true };
  const top: V3 = [0, H + DOME_RISE, 0];
  for (let k = 0; k < N; k++) {
    for (let r = 0; r + 1 < scales.length; r++) {
      const p0 = pt(k, scales[r]);
      const p1 = pt(k + 1, scales[r]);
      const p2 = pt(k + 1, scales[r + 1]);
      const p3 = pt(k, scales[r + 1]);
      const t0 = tintAt(scales[r]);
      const t1 = tintAt(scales[r + 1]);
      b.sky.quad(p0, p1, p2, p3, T(p0), T(p1), T(p2), T(p3), style, [t0, t0, t1, t1]);
    }
    const s = scales[scales.length - 1];
    const a = pt(k, s);
    const c = pt(k + 1, s);
    b.sky.tri(a, c, top, T(a), T(c), T(top), style, [tintAt(s), tintAt(s), zenith]);
  }
}

export function buildRoom(b: Builders): void {
  buildFloor(b);
  buildCarpet(b);
  buildWalls(b);
  buildMouldings(b);
  for (const c of CORNERS) buildPillar(b.slab, c);
  buildDome(b);
}

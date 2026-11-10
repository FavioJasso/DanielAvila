/**
 * Everything that belongs to a door wall beyond the flat wall face: the
 * stone archway (surround, tunnel, keystone), the alcove behind it, the gilt
 * picture frame and the torch brackets. All static, baked and merged.
 */
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_HALF_WIDTH,
  ROOM,
  type DoorFrame,
  type WallFrame,
} from "../layout";
import { type FaceStyle, type MeshBuilder } from "./builder";
import { FRAME_WIDTH, SPRING_Y, SURROUND_OUT, wallPoint, type TorchSpot } from "./plan";
import {
  DOWN,
  TINT,
  UP,
  archProfile,
  moulding,
  scaledUv,
  vIn,
  vLeft,
  vRight,
  wallFace,
  type Builders,
} from "./room";
import type { RGB, V2, V3 } from "./util";

export interface ArchwaySpec {
  f: WallFrame;
  halfW: number;
  springY: number;
  /** Depth at which the tunnel ends (door leaf / recessed doors). */
  back: number;
  /** Width of the jamb pilasters and the voussoir ring. */
  ringW: number;
}

/**
 * Stone archway: jambs and vaulted soffit from the surround's face back to
 * `back`, a ring of alternating voussoirs, impost blocks and a keystone.
 * Each voussoir / quoin maps one clean slab of the texture (half the tile).
 */
export function buildArchway(slab: MeshBuilder, s: ArchwaySpec): void {
  const { f, halfW: hw, springY, back, ringW } = s;
  const out = SURROUND_OUT;
  const P = (u: number, y: number, d: number) => wallPoint(f, u, y, d);
  const inner = archProfile(hw, springY);
  const outer = archProfile(hw + ringW, springY);
  const rows = [0, springY * 0.5, springY];
  const A = TINT.surroundA;
  const B = TINT.surroundB;

  for (const side of [-1, 1]) {
    const u0 = side * hw;
    const u1 = side * (hw + ringW);
    const towardsOpening = side < 0 ? vRight(f) : vLeft(f);
    const awayFromOpening = side < 0 ? vLeft(f) : vRight(f);
    for (let j = 0; j < 2; j++) {
      const y0 = rows[j];
      const y1 = rows[j + 1];
      // tunnel jamb
      slab.quad(
        P(u0, y0, -out),
        P(u0, y0, back),
        P(u0, y1, back),
        P(u0, y1, -out),
        [0, y0],
        [back + out, y0],
        [back + out, y1],
        [0, y1],
        { facing: towardsOpening, tint: A },
      );
      // pilaster front
      slab.quad(
        P(u0, y0, -out),
        P(u1, y0, -out),
        P(u1, y1, -out),
        P(u0, y1, -out),
        [0, y0],
        [0.5, y0],
        [0.5, y1],
        [0, y1],
        { facing: vIn(f), tint: A },
      );
      // pilaster's outer return to the wall
      slab.quad(
        P(u1, y0, -out),
        P(u1, y0, 0),
        P(u1, y1, 0),
        P(u1, y1, -out),
        [0.1, y0],
        [0.1 + out, y0],
        [0.1 + out, y1],
        [0.1, y1],
        { facing: awayFromOpening, tint: A },
      );
    }
    // impost block capping the pilaster at the springline
    const iy = springY - 0.32;
    const io = out + 0.07;
    const tint = TINT.trim;
    slab.quad(
      P(u0, iy, -io),
      P(u1, iy, -io),
      P(u1, springY, -io),
      P(u0, springY, -io),
      [0, 0.5],
      [0.5, 0.5],
      [0.5, 1],
      [0, 1],
      { facing: vIn(f), tint },
    );
    const ledgeUv: [V2, V2, V2, V2] = [
      [0.1, 0.6],
      [0.4, 0.6],
      [0.4, 0.66],
      [0.1, 0.66],
    ];
    for (const [y, facing] of [
      [iy, DOWN],
      [springY, UP],
    ] as const) {
      slab.quad(P(u0, y, -io), P(u1, y, -io), P(u1, y, -out), P(u0, y, -out), ...ledgeUv, {
        facing,
        tint,
      });
    }
    for (const [u, facing] of [
      [u0, towardsOpening],
      [u1, awayFromOpening],
    ] as const) {
      slab.quad(P(u, iy, -io), P(u, iy, -out), P(u, springY, -out), P(u, springY, -io), ...ledgeUv, {
        facing,
        tint,
      });
    }
  }

  for (let i = 0; i + 1 < inner.length; i++) {
    const a = inner[i];
    const c = inner[i + 1];
    const oa = outer[i];
    const oc = outer[i + 1];
    const tint = i % 2 === 0 ? B : A;
    const mu = (a.u + c.u) / 2;
    const my = (a.y + c.y) / 2;
    const toAxis: V3 = [-f.right.x * mu, springY - my, -f.right.z * mu];
    const fromAxis: V3 = [f.right.x * mu, my - springY, f.right.z * mu];
    // soffit
    slab.quad(
      P(a.u, a.y, -out),
      P(c.u, c.y, -out),
      P(c.u, c.y, back),
      P(a.u, a.y, back),
      [0, 0],
      [0.5, 0],
      [0.5, back + out],
      [0, back + out],
      { facing: toAxis, tint },
    );
    // voussoir face
    slab.quad(
      P(a.u, a.y, -out),
      P(c.u, c.y, -out),
      P(oc.u, oc.y, -out),
      P(oa.u, oa.y, -out),
      [0, 0.5],
      [0.5, 0.5],
      [0.5, 1],
      [0, 1],
      { facing: vIn(f), tint },
    );
    // ring's outer return to the wall
    slab.quad(
      P(oa.u, oa.y, -out),
      P(oc.u, oc.y, -out),
      P(oc.u, oc.y, 0),
      P(oa.u, oa.y, 0),
      [0.05, 0.6],
      [0.45, 0.6],
      [0.45, 0.6 + out],
      [0.05, 0.6 + out],
      { facing: fromAxis, tint },
    );
  }

  // keystone: a wedge standing a little prouder than the ring
  const half = (9 * Math.PI) / 180;
  const r0 = hw - 0.03;
  const r1 = hw + ringW;
  const r2 = hw + ringW + 0.16;
  const ko = out + 0.09;
  const K = (r: number, sgn: number, d: number) =>
    P(sgn * r * Math.sin(half), springY + r * Math.cos(half), d);
  const kt = TINT.keystone;
  const patch: [V2, V2, V2, V2] = [
    [0.08, 0.55],
    [0.42, 0.55],
    [0.42, 0.95],
    [0.08, 0.95],
  ];
  slab.quad(K(r0, -1, -ko), K(r0, 1, -ko), K(r2, 1, -ko), K(r2, -1, -ko), ...patch, {
    facing: vIn(f),
    tint: kt,
  });
  slab.quad(K(r0, -1, -ko), K(r0, 1, -ko), K(r0, 1, -out), K(r0, -1, -out), ...patch, {
    facing: DOWN,
    tint: kt,
  });
  slab.quad(K(r2, -1, -ko), K(r2, 1, -ko), K(r2, 1, 0), K(r2, -1, 0), ...patch, {
    facing: UP,
    tint: kt,
  });
  for (const sgn of [-1, 1]) {
    const facing = sgn < 0 ? vLeft(f) : vRight(f);
    slab.quad(K(r0, sgn, -ko), K(r1, sgn, -ko), K(r1, sgn, -out), K(r0, sgn, -out), ...patch, {
      facing,
      tint: kt,
    });
    slab.quad(K(r1, sgn, -ko), K(r2, sgn, -ko), K(r2, sgn, 0), K(r1, sgn, 0), ...patch, {
      facing,
      tint: kt,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Alcove                                                              */
/* ------------------------------------------------------------------ */

const PLASTER_UV = 3.0;
/** Alcove plaster is a touch warmer than the lobby's. */
const ALCOVE_TINT: RGB = [1.0, 0.975, 0.93];
/**
 * Neighbouring alcove faces overlap by this much past their shared corner
 * instead of sharing vertices, so no crack can open where their grids differ.
 * The overlap is outside the alcove volume and never seen.
 */
const LAP = 0.02;

/** A flat grid given explicit edge lists along two axes. */
function gridFace(
  b: MeshBuilder,
  at: (a: number, c: number) => V3,
  aEdges: number[],
  cEdges: number[],
  uvScale: number,
  style: FaceStyle,
): void {
  for (let j = 0; j + 1 < cEdges.length; j++) {
    for (let i = 0; i + 1 < aEdges.length; i++) {
      const a0 = aEdges[i];
      const a1 = aEdges[i + 1];
      const c0 = cEdges[j];
      const c1 = cEdges[j + 1];
      b.quad(
        at(a0, c0),
        at(a1, c0),
        at(a1, c1),
        at(a0, c1),
        [a0 / uvScale, c0 / uvScale],
        [a1 / uvScale, c0 / uvScale],
        [a1 / uvScale, c1 / uvScale],
        [a0 / uvScale, c1 / uvScale],
        style,
      );
    }
  }
}

const linspace = (a: number, b: number, n: number): number[] =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export function buildAlcove(b: Builders, f: DoorFrame): void {
  const AW = ALCOVE_HALF_WIDTH;
  const AH = ROOM.alcoveHeight;
  const tint = ALCOVE_TINT;
  const rows = [0, 1.15, SPRING_Y, ROOM.doorHeight, AH + LAP];
  const depths = linspace(ARCH_DEPTH - LAP, ALCOVE_BACK, 3);
  const widths = linspace(-AW - LAP, AW + LAP, 6);

  // the alcove side of the door wall, with the same arched opening
  wallFace({
    f,
    d: ARCH_DEPTH,
    inward: false,
    cols: [AW],
    rows: [0, 1.15, SPRING_Y, ROOM.doorHeight, AH],
    opening: { halfW: DOOR_HALF_WIDTH, springY: SPRING_Y },
    bands: [{ top: AH, builder: b.plaster, uv: scaledUv(PLASTER_UV) }],
    tint,
  });
  // side walls
  gridFace(b.plaster, (d, y) => wallPoint(f, -AW, y, d), depths, rows, PLASTER_UV, {
    facing: vRight(f),
    tint,
  });
  gridFace(b.plaster, (d, y) => wallPoint(f, AW, y, d), depths, rows, PLASTER_UV, {
    facing: vLeft(f),
    tint,
  });
  // back wall (finer, so the torch light and the painting's glow read)
  gridFace(b.plaster, (u, y) => wallPoint(f, u, y, ALCOVE_BACK), widths, rows, PLASTER_UV, {
    facing: vIn(f),
    tint,
  });
  // ceiling
  gridFace(
    b.plaster,
    (u, d) => wallPoint(f, u, AH, d),
    linspace(-AW - LAP, AW + LAP, 2),
    linspace(ARCH_DEPTH - LAP, ALCOVE_BACK + LAP, 2),
    PLASTER_UV,
    { facing: DOWN, tint },
  );

  // skirting along the three inner walls
  const skirtH = 0.3;
  const skirtOut = 0.05;
  const bl = f.at(-AW, ALCOVE_BACK);
  const br = f.at(AW, ALCOVE_BACK);
  const fl = f.at(-AW, ARCH_DEPTH);
  const fr = f.at(AW, ARCH_DEPTH);
  const opts = { top: true, tint: TINT.base };
  moulding(b.slab, bl.x, bl.z, br.x, br.z, -f.dir.x, -f.dir.z, 0, skirtH, skirtOut, {
    ...opts,
    trimA: skirtOut,
    trimB: skirtOut,
  });
  moulding(b.slab, fl.x, fl.z, bl.x, bl.z, f.right.x, f.right.z, 0, skirtH, skirtOut, {
    ...opts,
    trimB: skirtOut,
  });
  moulding(b.slab, fr.x, fr.z, br.x, br.z, -f.right.x, -f.right.z, 0, skirtH, skirtOut, {
    ...opts,
    trimB: skirtOut,
  });

  buildFrame(b.gold, f);
}

/* ------------------------------------------------------------------ */
/* Picture frame                                                       */
/* ------------------------------------------------------------------ */

/**
 * Gilt frame: a bevel sloping from a raised inner edge down to the outer
 * edge, an inner return to the canvas and an outer return to the wall.
 */
function buildFrame(gold: MeshBuilder, f: DoorFrame): void {
  const half = ROOM.paintingSize / 2;
  const o = half + FRAME_WIDTH;
  const cy = ROOM.paintingCenterY;
  // the canvas hangs where layout.ts puts the painting, a little proud of the wall
  const dCanvas = (f.painting.x - f.mid.x) * f.dir.x + (f.painting.z - f.mid.z) * f.dir.z;
  const dInner = ALCOVE_BACK - 0.16;
  const dOuter = ALCOVE_BACK - 0.08;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const P = (su: number, sy: number, r: number, d: number) => wallPoint(f, su * r, cy + sy * r, d);
  const k = 0.8;
  const len = (2 * o) / k;
  for (let i = 0; i < 4; i++) {
    const [u0, y0] = corners[i];
    const [u1, y1] = corners[(i + 1) % 4];
    const mu = (u0 + u1) / 2;
    const my = (y0 + y1) / 2;
    const toCentre: V3 = [-f.right.x * mu, -my, -f.right.z * mu];
    const fromCentre: V3 = [f.right.x * mu, my, f.right.z * mu];
    gold.quad(
      P(u0, y0, half, dInner),
      P(u1, y1, half, dInner),
      P(u1, y1, o, dOuter),
      P(u0, y0, o, dOuter),
      [0.1, 0],
      [len - 0.1, 0],
      [len, 0.24],
      [0, 0.24],
      { facing: vIn(f) },
    );
    gold.quad(
      P(u0, y0, half, dCanvas),
      P(u1, y1, half, dCanvas),
      P(u1, y1, half, dInner),
      P(u0, y0, half, dInner),
      [0, 0.3],
      [len, 0.3],
      [len, 0.42],
      [0, 0.42],
      { facing: toCentre, tint: [0.8, 0.74, 0.66] },
    );
    gold.quad(
      P(u0, y0, o, dOuter),
      P(u1, y1, o, dOuter),
      P(u1, y1, o, ALCOVE_BACK),
      P(u0, y0, o, ALCOVE_BACK),
      [0, 0.5],
      [len, 0.5],
      [len, 0.6],
      [0, 0.6],
      { facing: fromCentre, tint: [0.82, 0.76, 0.68] },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Torch bracket                                                       */
/* ------------------------------------------------------------------ */

const IRON: RGB = [0.3, 0.3, 0.37];
const EMBER: RGB = [1.0, 0.6, 0.18];
const NO_UV: V2 = [0, 0];

/** Iron cup on a short arm; the flame itself is a sprite (see sprites.ts). */
export function buildTorch(flat: MeshBuilder, t: TorchSpot): void {
  const len = Math.hypot(t.x - t.wx, t.z - t.wz);
  const ax = (t.x - t.wx) / len; // away from the wall
  const az = (t.z - t.wz) / len;
  const sx = -az; // sideways
  const sz = ax;
  const s = t.size;
  const top = 0.115 * s;
  const bot = 0.05 * s;
  const y1 = t.y;
  const y0 = t.y - 0.26 * s;
  const signs: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  const corner = (i: number, r: number, y: number): V3 => {
    const [ca, cs] = signs[i % 4];
    return [t.x + (ax * ca + sx * cs) * r, y, t.z + (az * ca + sz * cs) * r];
  };
  const faceDirs: V3[] = [
    [sx, 0, sz],
    [-ax, 0, -az],
    [-sx, 0, -sz],
    [ax, 0, az],
  ];
  for (let i = 0; i < 4; i++) {
    flat.quad(
      corner(i, bot, y0),
      corner(i + 1, bot, y0),
      corner(i + 1, top, y1),
      corner(i, top, y1),
      NO_UV,
      NO_UV,
      NO_UV,
      NO_UV,
      { tint: IRON, facing: faceDirs[i] },
    );
  }
  // glowing coals
  flat.quad(
    corner(0, top * 0.82, y1 - 0.015),
    corner(1, top * 0.82, y1 - 0.015),
    corner(2, top * 0.82, y1 - 0.015),
    corner(3, top * 0.82, y1 - 0.015),
    NO_UV,
    NO_UV,
    NO_UV,
    NO_UV,
    { tint: EMBER, unlit: true, facing: UP },
  );
  // arm from the wall into the cup
  const w = 0.035 * s;
  const ya = y0 + 0.1 * s;
  const W = (side: number, y: number): V3 => [t.wx + sx * w * side, y, t.wz + sz * w * side];
  const C = (side: number, y: number): V3 => [t.x + sx * w * side, y, t.z + sz * w * side];
  const arm = (a: V3, b: V3, c: V3, d: V3, facing: V3) =>
    flat.quad(a, b, c, d, NO_UV, NO_UV, NO_UV, NO_UV, { tint: IRON, facing });
  arm(W(1, ya + w), C(1, ya + w), C(-1, ya + w), W(-1, ya + w), UP);
  arm(W(1, ya - w), C(1, ya - w), C(-1, ya - w), W(-1, ya - w), DOWN);
  arm(W(1, ya - w), C(1, ya - w), C(1, ya + w), W(1, ya + w), [sx, 0, sz]);
  arm(W(-1, ya - w), C(-1, ya - w), C(-1, ya + w), W(-1, ya + w), [-sx, 0, -sz]);
}

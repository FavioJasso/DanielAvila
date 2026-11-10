/**
 * The three plain walls' decoration: the grand (closed) double door with its
 * fan window on the south wall, and the brand-blue DA banners on the
 * south-west and south-east walls. Static, baked, merged by material.
 */
import * as THREE from "three";
import type { WallFrame } from "../layout";
import type { FaceStyle } from "./builder";
import { buildArchway } from "./archways";
import { BANNER, SOUTH_DOOR, SOUTH_FRAME, SURROUND_OUT, wallPoint } from "./plan";
import { DOWN, TINT, UP, archProfile, vIn, vLeft, vRight, type Builders } from "./room";
import { lerp, type RGB, type V2, type V3 } from "./util";

const NO_UV: V2 = [0, 0];
const IRON: RGB = [0.3, 0.3, 0.37];
/** Overlap used where two surfaces meet without sharing vertices. */
const LAP = 0.03;

/* ------------------------------------------------------------------ */
/* South entrance                                                      */
/* ------------------------------------------------------------------ */

/** Wood tile size on the big doors: 16 planks across, a band every 1.2 m. */
const WOOD_U = 0.85;
const WOOD_V = 1.2;

export function buildSouthEntrance(b: Builders): void {
  const f = SOUTH_FRAME;
  const { halfWidth: hw, springY, recess, surroundWidth } = SOUTH_DOOR;
  const P = (u: number, y: number, d: number) => wallPoint(f, u, y, d);
  const inward = vIn(f);

  buildArchway(b.slab, { f, halfW: hw, springY, back: recess, ringW: surroundWidth });

  // threshold: the floor of the recess, with a lip
  const ty = 0.03;
  b.slab.quad(
    P(-hw, ty, -SURROUND_OUT),
    P(hw, ty, -SURROUND_OUT),
    P(hw, ty, recess),
    P(-hw, ty, recess),
    [0.04, 0.52],
    [0.04 + (hw * 2) / 3.8, 0.52],
    [0.04 + (hw * 2) / 3.8, 0.96],
    [0.04, 0.96],
    { facing: UP, tint: TINT.threshold },
  );
  b.slab.quad(
    P(-hw, 0, -SURROUND_OUT),
    P(hw, 0, -SURROUND_OUT),
    P(hw, ty, -SURROUND_OUT),
    P(-hw, ty, -SURROUND_OUT),
    [0.04, 0.6],
    [0.9, 0.6],
    [0.9, 0.64],
    [0.04, 0.64],
    { facing: inward, tint: TINT.threshold },
  );

  // The two closed leaves: one plank wall, split by the astragal below. It
  // laps a little behind the jambs and up inside the transom so that no crack
  // can open along those joins (their vertices do not line up).
  const doorTop = springY - 0.2;
  const doorTint: RGB = [0.94, 0.88, 0.82];
  const cols = [-hw - LAP, -hw / 2, 0, hw / 2, hw + LAP];
  const rows = [0, doorTop / 2, doorTop + LAP * 2];
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 4; i++) {
      const u0 = cols[i];
      const u1 = cols[i + 1];
      const y0 = rows[j];
      const y1 = rows[j + 1];
      b.wood.quad(
        P(u0, y0, recess),
        P(u1, y0, recess),
        P(u1, y1, recess),
        P(u0, y1, recess),
        [u0 / WOOD_U, y0 / WOOD_V],
        [u1 / WOOD_U, y0 / WOOD_V],
        [u1 / WOOD_U, y1 / WOOD_V],
        [u0 / WOOD_U, y1 / WOOD_V],
        { facing: inward, tint: doorTint },
      );
    }
  }
  // astragal covering the meeting stiles
  const aw = 0.085;
  const ad = recess - 0.06;
  const dark: RGB = [0.7, 0.64, 0.6];
  b.wood.quad(
    P(-aw, 0, ad),
    P(aw, 0, ad),
    P(aw, doorTop, ad),
    P(-aw, doorTop, ad),
    [0.02, 0],
    [0.2, 0],
    [0.2, 0.3],
    [0.02, 0.3],
    { facing: inward, tint: dark },
  );
  for (const side of [-1, 1]) {
    b.wood.quad(
      P(side * aw, 0, ad),
      P(side * aw, 0, recess),
      P(side * aw, doorTop, recess),
      P(side * aw, doorTop, ad),
      [0.02, 0],
      [0.08, 0],
      [0.08, 0.3],
      [0.02, 0.3],
      { facing: side < 0 ? vLeft(f) : vRight(f), tint: dark },
    );
  }
  // transom beam between the doors and the fan window
  const td = recess - 0.1;
  const beamUv = (u: number, v: number): V2 => [0.02 + v * 0.2, u / WOOD_V];
  b.wood.quad(
    P(-hw, doorTop, td),
    P(hw, doorTop, td),
    P(hw, springY, td),
    P(-hw, springY, td),
    beamUv(-hw, 0),
    beamUv(hw, 0),
    beamUv(hw, 1),
    beamUv(-hw, 1),
    { facing: inward, tint: dark },
  );
  for (const [y, facing] of [
    [doorTop, DOWN],
    [springY, UP],
  ] as const) {
    b.wood.quad(
      P(-hw, y, td),
      P(hw, y, td),
      P(hw, y, recess),
      P(-hw, y, recess),
      beamUv(-hw, 0),
      beamUv(hw, 0),
      beamUv(hw, 0.5),
      beamUv(-hw, 0.5),
      { facing, tint: dark },
    );
  }

  // iron ring pulls
  const ringD = recess - 0.035;
  for (const side of [-1, 1]) {
    const cx = side * 0.42;
    const cy = 1.52;
    const style: FaceStyle = { facing: inward, tint: IRON };
    const R = (r: number, k: number): V3 => {
      const a = (k / 8) * Math.PI * 2;
      return P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, ringD);
    };
    for (let k = 0; k < 8; k++) {
      b.flat.quad(R(0.13, k), R(0.13, k + 1), R(0.2, k + 1), R(0.2, k), NO_UV, NO_UV, NO_UV, NO_UV, style);
    }
    // mounting plate above the ring
    b.flat.quad(
      P(cx - 0.07, cy + 0.14, ringD - 0.01),
      P(cx + 0.07, cy + 0.14, ringD - 0.01),
      P(cx + 0.07, cy + 0.3, ringD - 0.01),
      P(cx - 0.07, cy + 0.3, ringD - 0.01),
      NO_UV,
      NO_UV,
      NO_UV,
      NO_UV,
      style,
    );
  }

  // fan window: bright daylight, warm at the hub, sky blue at the rim
  const hub: RGB = [1.0, 0.985, 0.86];
  const mid: RGB = [0.9, 0.97, 1.0];
  const rim: RGB = [0.56, 0.8, 1.0];
  const glass: FaceStyle = { facing: inward, unlit: true };
  const arch = archProfile(hw, springY);
  const C = P(0, springY, recess);
  const at = (i: number, k: number) =>
    P(arch[i].u * k, springY + (arch[i].y - springY) * k, recess);
  for (let i = 0; i + 1 < arch.length; i++) {
    b.flat.tri(C, at(i, 0.55), at(i + 1, 0.55), NO_UV, NO_UV, NO_UV, glass, [hub, mid, mid]);
    b.flat.quad(
      at(i, 0.55),
      at(i + 1, 0.55),
      at(i + 1, 1),
      at(i, 1),
      NO_UV,
      NO_UV,
      NO_UV,
      NO_UV,
      glass,
      [mid, mid, rim, rim],
    );
  }
  // a sliver of glass tucked behind the transom, lapping the fan's lower edge
  b.flat.quad(
    P(-hw - LAP, springY - LAP * 2, recess + 0.006),
    P(hw + LAP, springY - LAP * 2, recess + 0.006),
    P(hw + LAP, springY + LAP, recess + 0.006),
    P(-hw - LAP, springY + LAP, recess + 0.006),
    NO_UV,
    NO_UV,
    NO_UV,
    NO_UV,
    glass,
    [mid, mid, mid, mid],
  );
  // tracery: radial glazing bars, one concentric bar, a gilt hub
  const barD = recess - 0.025;
  const barTint: RGB = [0.34, 0.25, 0.2];
  const bar: FaceStyle = { facing: inward, tint: barTint };
  for (let i = 1; i + 1 < arch.length; i++) {
    const a = Math.PI * (1 - i / (arch.length - 1));
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const w = 0.035;
    const Q = (r: number, side: number) =>
      P(ca * r - sa * w * side, springY + sa * r + ca * w * side, barD);
    b.flat.quad(Q(0.4, -1), Q(hw, -1), Q(hw, 1), Q(0.4, 1), NO_UV, NO_UV, NO_UV, NO_UV, bar);
  }
  for (let i = 0; i + 1 < arch.length; i++) {
    const k0 = 0.6;
    const k1 = 0.645;
    b.flat.quad(
      atBar(arch, i, k0, springY, f, barD),
      atBar(arch, i + 1, k0, springY, f, barD),
      atBar(arch, i + 1, k1, springY, f, barD),
      atBar(arch, i, k1, springY, f, barD),
      NO_UV,
      NO_UV,
      NO_UV,
      NO_UV,
      bar,
    );
  }
  const hubD = recess - 0.04;
  const hubR = 0.44 / hw;
  const HC = P(0, springY, hubD);
  for (let i = 0; i + 1 < arch.length; i++) {
    const p = atBar(arch, i, hubR, springY, f, hubD);
    const q = atBar(arch, i + 1, hubR, springY, f, hubD);
    b.gold.tri(HC, p, q, [0.2, 0.2], [0.2 + arch[i].u * 0.3, 0.5], [0.2 + arch[i + 1].u * 0.3, 0.5], {
      facing: inward,
    });
  }
}

function atBar(
  arch: { u: number; y: number }[],
  i: number,
  k: number,
  springY: number,
  f: WallFrame,
  d: number,
): V3 {
  return wallPoint(f, arch[i].u * k, springY + (arch[i].y - springY) * k, d);
}

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

/** Emblem size on the banner, and the height of its centre. */
const BANNER_EMBLEM = 1.72;

export function buildBanner(b: Builders, f: WallFrame): void {
  const { halfWidth: hw, top, bottom, tip, out } = BANNER;
  const inward = vIn(f);
  const style: FaceStyle = { facing: inward };
  // the cloth folds forward slightly down its centre line
  const dEdge = -out;
  const dMid = -(out + 0.07);
  const P = (u: number, y: number) => wallPoint(f, u, y, lerp(dMid, dEdge, Math.abs(u) / hw));
  const T = (u: number, y: number): V2 => [(u + hw) / (2 * hw), y / 2.1];
  const rows = [bottom, lerp(bottom, top, 1 / 3), lerp(bottom, top, 2 / 3), top];
  for (let j = 0; j + 1 < rows.length; j++) {
    const y0 = rows[j];
    const y1 = rows[j + 1];
    for (const [u0, u1] of [
      [-hw, 0],
      [0, hw],
    ]) {
      b.banner.quad(P(u0, y0), P(u1, y0), P(u1, y1), P(u0, y1), T(u0, y0), T(u1, y0), T(u1, y1), T(u0, y1), style);
    }
  }
  // pointed tail with a gold fringe
  b.banner.tri(P(-hw, bottom), P(0, tip), P(0, bottom), T(-hw, bottom), T(0, tip), T(0, bottom), style);
  b.banner.tri(P(0, bottom), P(0, tip), P(hw, bottom), T(0, bottom), T(0, tip), T(hw, bottom), style);
  const fringe = 0.13;
  for (const side of [-1, 1]) {
    b.gold.quad(
      P(side * hw, bottom),
      P(0, tip),
      P(0, tip - fringe),
      P(side * hw, bottom - fringe),
      [0, 0],
      [1.6, 0],
      [1.6, 0.16],
      [0, 0.16],
      style,
    );
  }

  // gold rod with finials
  const rodY = top + 0.03;
  const rodD = -(out + 0.09);
  const yaw = Math.atan2(-f.right.z, f.right.x);
  const c = f.at(0, rodD);
  const rod = new THREE.CylinderGeometry(0.055, 0.055, hw * 2 + 0.5, 6, 1, true);
  rod.rotateZ(Math.PI / 2);
  rod.rotateY(yaw);
  rod.translate(c.x, rodY, c.z);
  b.gold.addGeometry(rod, {}, (u, v) => [u * 0.5, v * 2]);
  rod.dispose();
  for (const side of [-1, 1]) {
    const e = f.at(side * (hw + 0.25), rodD);
    const finial = new THREE.OctahedronGeometry(0.13, 0);
    finial.translate(e.x, rodY, e.z);
    b.gold.addGeometry(finial, {}, (u, v) => [u * 0.3, v * 0.3]);
    finial.dispose();
  }

  // DA emblem, in two halves so it lies on the folded cloth
  const cy = top - 1.42;
  const h = BANNER_EMBLEM / 2;
  const lift = 0.014;
  const E = (u: number, y: number): V3 => {
    const p = P(u, y);
    return [p[0] + inward[0] * lift, p[1], p[2] + inward[2] * lift];
  };
  for (const [u0, u1] of [
    [-h, 0],
    [0, h],
  ]) {
    b.emblem.quad(
      E(u0, cy - h),
      E(u1, cy - h),
      E(u1, cy + h),
      E(u0, cy + h),
      [(u0 + h) / (2 * h), 0],
      [(u1 + h) / (2 * h), 0],
      [(u1 + h) / (2 * h), 1],
      [(u0 + h) / (2 * h), 1],
      style,
    );
  }
}

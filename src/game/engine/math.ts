/**
 * Small scalar helpers shared by the engine. Everything here is allocation
 * free so it is safe to call from the frame loop.
 */
import type { WallFrame } from "../layout";

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0 at `e0`, 1 at `e1`, smooth in between. Works with e0 > e1 too. */
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Wrap an angle into (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

/** Shortest signed rotation that takes `from` to `to`. */
export const angleDelta = (from: number, to: number): number => wrapAngle(to - from);

/** Frame-rate independent smoothing factor for `x += (target - x) * k`. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/* Door / wall frame maths without the `{x, z}` allocations of `frame.at()`. */

/** World X of the local point (u = right, d = outward depth) of a wall frame. */
export const frameX = (f: WallFrame, u: number, d: number): number =>
  f.mid.x + f.right.x * u + f.dir.x * d;

/** World Z of the local point (u, d) of a wall frame. */
export const frameZ = (f: WallFrame, u: number, d: number): number =>
  f.mid.z + f.right.z * u + f.dir.z * d;

/** Sideways offset of a world point in a wall frame. */
export const frameU = (f: WallFrame, x: number, z: number): number =>
  (x - f.mid.x) * f.right.x + (z - f.mid.z) * f.right.z;

/** Outward depth of a world point in a wall frame (0 = lobby wall face). */
export const frameD = (f: WallFrame, x: number, z: number): number =>
  (x - f.mid.x) * f.dir.x + (z - f.mid.z) * f.dir.z;

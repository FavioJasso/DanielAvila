/**
 * Accumulates triangles for one material and bakes the lighting into vertex
 * colours as they are added. One builder → one BufferGeometry → one draw call,
 * which is how all the static geometry gets merged by material.
 *
 * Geometry is non-indexed (each face owns its vertices) so every face can
 * carry its own flat normal for the bake.
 */
import * as THREE from "three";
import type { Shade } from "./lighting";
import { toLinear, type RGB, type V2, type V3 } from "./util";

const WHITE: RGB = [1, 1, 1];

export interface FaceStyle {
  /** Display-space multiplier applied on top of the baked light. */
  tint?: RGB;
  /** Skip the bake: the vertex colour is exactly `tint`. */
  unlit?: boolean;
  /** Which way the face should look; the winding is flipped if it points away. */
  facing?: V3;
}

/** Maps distances (a along the first edge, b along the second) to a UV. */
export type UvMap = (a: number, b: number) => V2;

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly col: number[] = [];
  private readonly lit: [number, number, number] = [1, 1, 1];

  constructor(private readonly shade: Shade) {}

  get triangles(): number {
    return this.pos.length / 9;
  }

  private vert(
    p: V3,
    t: V2,
    nx: number,
    ny: number,
    nz: number,
    style: FaceStyle,
    own?: RGB,
  ): void {
    const tint = own ?? style.tint ?? WHITE;
    let r = tint[0];
    let g = tint[1];
    let b = tint[2];
    if (!style.unlit) {
      this.shade(p[0], p[1], p[2], nx, ny, nz, this.lit);
      r *= this.lit[0];
      g *= this.lit[1];
      b *= this.lit[2];
    }
    this.pos.push(p[0], p[1], p[2]);
    this.uv.push(t[0], t[1]);
    this.col.push(toLinear(r), toLinear(g), toLinear(b));
  }

  /**
   * Counter-clockwise a → b → c as seen from the front (or see `style.facing`).
   * `tints` gives each corner its own tint (smooth gradients) instead of
   * `style.tint`.
   */
  tri(
    a: V3,
    b: V3,
    c: V3,
    ta: V2,
    tb: V2,
    tc: V2,
    style: FaceStyle = {},
    tints?: readonly [RGB, RGB, RGB],
  ): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return; // degenerate (e.g. a quad collapsed to a triangle)
    nx /= len;
    ny /= len;
    nz /= len;
    const f = style.facing;
    if (f && nx * f[0] + ny * f[1] + nz * f[2] < 0) {
      this.vert(a, ta, -nx, -ny, -nz, style, tints?.[0]);
      this.vert(c, tc, -nx, -ny, -nz, style, tints?.[2]);
      this.vert(b, tb, -nx, -ny, -nz, style, tints?.[1]);
      return;
    }
    this.vert(a, ta, nx, ny, nz, style, tints?.[0]);
    this.vert(b, tb, nx, ny, nz, style, tints?.[1]);
    this.vert(c, tc, nx, ny, nz, style, tints?.[2]);
  }

  /** Counter-clockwise a → b → c → d (or see `style.facing`). */
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    ta: V2,
    tb: V2,
    tc: V2,
    td: V2,
    style: FaceStyle = {},
    tints?: readonly [RGB, RGB, RGB, RGB],
  ): void {
    this.tri(a, b, c, ta, tb, tc, style, tints && [tints[0], tints[1], tints[2]]);
    this.tri(a, c, d, ta, tc, td, style, tints && [tints[0], tints[2], tints[3]]);
  }

  /**
   * A flat rectangle from `o`, `l1` along unit `e1` and `l2` along unit `e2`,
   * split into `seg1` × `seg2` cells so the baked light can vary across it.
   * Faces `e1 × e2` unless `style.facing` says otherwise.
   */
  plane(
    o: V3,
    e1: V3,
    l1: number,
    e2: V3,
    l2: number,
    seg1: number,
    seg2: number,
    uv: UvMap,
    style: FaceStyle = {},
  ): void {
    const at = (i: number, j: number): V3 => {
      const a = (l1 * i) / seg1;
      const b = (l2 * j) / seg2;
      return [o[0] + e1[0] * a + e2[0] * b, o[1] + e1[1] * a + e2[1] * b, o[2] + e1[2] * a + e2[2] * b];
    };
    const tex = (i: number, j: number): V2 => uv((l1 * i) / seg1, (l2 * j) / seg2);
    for (let j = 0; j < seg2; j++) {
      for (let i = 0; i < seg1; i++) {
        this.quad(
          at(i, j),
          at(i + 1, j),
          at(i + 1, j + 1),
          at(i, j + 1),
          tex(i, j),
          tex(i + 1, j),
          tex(i + 1, j + 1),
          tex(i, j + 1),
          style,
        );
      }
    }
  }

  /**
   * Append an existing (already positioned) geometry, keeping its winding.
   * `uv` can remap the source UVs, e.g. into a clean patch of the texture.
   */
  addGeometry(source: THREE.BufferGeometry, style: FaceStyle = {}, uv?: (u: number, v: number) => V2): void {
    const geo = source.index ? source.toNonIndexed() : source;
    const p = geo.getAttribute("position");
    const t = geo.getAttribute("uv");
    const P = (i: number): V3 => [p.getX(i), p.getY(i), p.getZ(i)];
    const T = (i: number): V2 => {
      if (!t) return [0, 0];
      return uv ? uv(t.getX(i), t.getY(i)) : [t.getX(i), t.getY(i)];
    };
    for (let i = 0; i + 2 < p.count; i += 3) {
      this.tri(P(i), P(i + 1), P(i + 2), T(i), T(i + 1), T(i + 2), style);
    }
    if (geo !== source) geo.dispose();
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

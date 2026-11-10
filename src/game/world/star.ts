/** A plain, faceless, low-poly five-point star. */
import * as THREE from "three";

/**
 * Five-point star lying in the XY plane, facing ±Z: ten rim vertices, a raised
 * centre on each side and a flat rim band of thickness `2 * rim` round the
 * edge, so the star keeps some body when it turns edge-on (a zero-thickness
 * rim collapses to a thin gold diamond). 40 flat triangles in all.
 */
export function createStarGeometry(outer = 1, inner = 0.48, depth = 0.44, rim = 0.13): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5; // first point straight up, then counter-clockwise
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    uv.push(0.5 + x * 0.5, 0.5 + y * 0.5);
  };
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 10];
    // front facet (counter-clockwise seen from +Z)
    push(ax, ay, rim);
    push(bx, by, rim);
    push(0, 0, depth);
    // back facet
    push(bx, by, -rim);
    push(ax, ay, -rim);
    push(0, 0, -depth);
    // rim band (outward facing)
    push(ax, ay, -rim);
    push(bx, by, -rim);
    push(bx, by, rim);
    push(ax, ay, -rim);
    push(bx, by, rim);
    push(ax, ay, rim);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** How much the spin lingers face-on (0 = uniform spin, < 1). */
const LINGER = 0.72;

/**
 * Eased spin angle for a star turning about Y. The angle still advances one
 * full turn per 2π of `phase`, but slows to (1 − LINGER) of its speed while the
 * star faces the viewer (front or back) and whips through the edge-on moments,
 * so a spinning star reads as a star in almost every frame.
 */
export function starSpin(phase: number): number {
  return phase - 0.5 * LINGER * Math.sin(2 * phase);
}

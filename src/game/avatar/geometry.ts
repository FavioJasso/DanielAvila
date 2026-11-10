/**
 * Daniel 64 — hand-built low-poly geometry.
 *
 * Every segment is assembled from "lofts" (stacked polygon rings joined by
 * quads) plus a few fans and pyramids, emitted as non-indexed triangles so
 * each facet shades flat. Untextured faces carry vertex colours; the face and
 * the blazer front carry UVs for the two 64×64 canvas textures.
 *
 * Coordinates are local to the segment's joint (see rig.ts): limbs hang down
 * the -Y axis from their pivot, the model faces +Z and its left side is +X.
 */
import * as THREE from "three";
import { PAL } from "./palette";
import { DIM } from "./rig";

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
type UV = readonly [number, number];
type Ring = readonly V3[];

const TAU = Math.PI * 2;
const scratch = new THREE.Color();

/** sRGB hex → linear RGB (what a colour attribute holds), scaled by `k`. */
function rgb(hex: string, k = 1): RGB {
  scratch.set(hex);
  return [scratch.r * k, scratch.g * k, scratch.b * k];
}

const mirror = (p: V3): V3 => [-p[0], p[1], p[2]];

/* ------------------------------------------------------------------ */
/* Triangle soup builder                                               */
/* ------------------------------------------------------------------ */

class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly uvs: number[] = [];

  /** With `uvOf` the mesh is textured (UVs, no colours); without, vertex-coloured. */
  constructor(private readonly uvOf: ((p: V3) => UV) | null = null) {}

  /** Counter-clockwise seen from outside. */
  tri(a: V3, b: V3, c: V3, color: RGB = WHITE): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    if (this.uvOf) {
      const ua = this.uvOf(a);
      const ub = this.uvOf(b);
      const uc = this.uvOf(c);
      this.uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    } else {
      for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2]);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    if (this.uvOf) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    else g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); // non-indexed → one normal per facet
    g.computeBoundingSphere();
    return g;
  }
}

const WHITE: RGB = [1, 1, 1];

/**
 * `n` points around the Y axis at height `y`. Point k sits at angle
 * `phase + k·2π/n`, measured from +Z (front) towards +X (the avatar's left).
 * With `phase = π/n` the ring has a flat facet facing forward and is
 * mirror-symmetric (point k ↔ point n-1-k).
 */
function ring(n: number, y: number, rx: number, rz: number, phase: number, cz = 0): V3[] {
  const out: V3[] = [];
  for (let k = 0; k < n; k++) {
    const a = phase + (k / n) * TAU;
    out.push([Math.sin(a) * rx, y, cz + Math.cos(a) * rz]);
  }
  return out;
}

type QuadPaint = (band: number, side: number) => { to: MeshBuilder; color?: RGB } | null;
type FanPaint = (side: number) => { to: MeshBuilder; color?: RGB } | null;

/**
 * Join consecutive rings (listed from the bottom / inside to the top /
 * outside) with quads. `paint` routes each quad to a builder and colour, or
 * returns null to leave it out. The quad diagonal is mirrored on the right
 * half so the silhouette stays left/right symmetric.
 */
function loft(rings: readonly Ring[], paint: QuadPaint): void {
  for (let i = 0; i < rings.length - 1; i++) {
    const lo = rings[i];
    const hi = rings[i + 1];
    const n = lo.length;
    for (let s = 0; s < n; s++) {
      const p = paint(i, s);
      if (!p) continue;
      const t = (s + 1) % n;
      const a = lo[s];
      const b = lo[t];
      const c = hi[t];
      const d = hi[s];
      if (s >= n / 2 && s < n - 1) {
        p.to.tri(a, b, d, p.color);
        p.to.tri(b, c, d, p.color);
      } else {
        p.to.tri(a, b, c, p.color);
        p.to.tri(a, c, d, p.color);
      }
    }
  }
}

/** Close the top of a ring with a fan to `tip`. */
function fanUp(r: Ring, tip: V3, paint: FanPaint): void {
  for (let s = 0; s < r.length; s++) {
    const p = paint(s);
    if (p) p.to.tri(tip, r[s], r[(s + 1) % r.length], p.color);
  }
}

/** Close the bottom of a ring with a fan to `tip`. */
function fanDown(r: Ring, tip: V3, paint: FanPaint): void {
  for (let s = 0; s < r.length; s++) {
    const p = paint(s);
    if (p) p.to.tri(tip, r[(s + 1) % r.length], r[s], p.color);
  }
}

/** Flat cap under a planar ring (n - 2 triangles). */
function capDown(r: Ring, to: MeshBuilder, color: RGB): void {
  for (let i = 1; i < r.length - 1; i++) to.tri(r[0], r[i + 1], r[i], color);
}

/** A small pyramid; every face is wound to point away from the solid's centre. */
function pyramid(to: MeshBuilder, base: readonly V3[], apex: V3, colors: readonly RGB[]): void {
  const n = base.length;
  const g = [apex[0], apex[1], apex[2]];
  for (const p of base) {
    g[0] += p[0];
    g[1] += p[1];
    g[2] += p[2];
  }
  for (let i = 0; i < 3; i++) g[i] /= n + 1;
  for (let i = 0; i < n; i++) {
    const a = base[i];
    const b = base[(i + 1) % n];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = apex[0] - a[0];
    const vy = apex[1] - a[1];
    const vz = apex[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const outward = nx * (a[0] - g[0]) + ny * (a[1] - g[1]) + nz * (a[2] - g[2]) > 0;
    const color = colors[i % colors.length];
    if (outward) to.tri(a, b, apex, color);
    else to.tri(b, a, apex, color);
  }
}

/* ------------------------------------------------------------------ */
/* Texture projections                                                 */
/* ------------------------------------------------------------------ */

/** The face texture is projected straight on (along Z) onto the front of the skull. */
export const FACE_UV = { halfW: 0.185, y0: 0.032, y1: 0.39 } as const;
const faceUv = (p: V3): UV => [
  0.5 + p[0] / (2 * FACE_UV.halfW),
  (p[1] - FACE_UV.y0) / (FACE_UV.y1 - FACE_UV.y0),
];

/** Same for the blazer front, from the hem to the collar. */
export const BLAZER_UV = { halfW: 0.25, y0: -0.14, y1: 0.475 } as const;
const blazerUv = (p: V3): UV => [
  0.5 + p[0] / (2 * BLAZER_UV.halfW),
  (p[1] - BLAZER_UV.y0) / (BLAZER_UV.y1 - BLAZER_UV.y0),
];

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

const P8 = Math.PI / 8;
const P6 = Math.PI / 6;
const P12 = Math.PI / 12;

/** Octagon sides that face forward: front-right, front, front-left. */
const isFront8 = (s: number): boolean => s === 6 || s === 7 || s === 0;

/**
 * Head: the front of the skull (textured face), a nose, and one closed hair
 * shell around the top, sides and back. Where the hair should leave the face
 * uncovered its vertices are simply tucked inside the skull, so the hairline
 * is the intersection of the two solids (centre parting, curtains over the
 * temples, hair over the ears down to the neck).
 */
function buildHead(solid: MeshBuilder, face: MeshBuilder): void {
  const skin = rgb(PAL.skin);
  const skinShade = rgb(PAL.skinShade);
  const skinDark = rgb(PAL.skinDark);

  /* skull — only the columns that can ever be seen */
  const skull: Ring[] = [
    ring(8, 0.07, 0.108, 0.118, P8, 0.012),
    ring(8, 0.14, 0.178, 0.178, P8, 0.004),
    ring(8, 0.225, 0.2, 0.196, P8),
    ring(8, 0.315, 0.2, 0.196, P8),
    ring(8, 0.39, 0.166, 0.166, P8),
  ];
  const skullPaint = (s: number) =>
    isFront8(s) ? { to: face } : s === 1 || s === 5 ? { to: solid, color: skinShade } : null;
  loft(skull, (_band, s) => skullPaint(s));
  fanDown(skull[0], [0, FACE_UV.y0, 0.03], skullPaint);

  /* nose */
  pyramid(
    solid,
    [
      [0, 0.246, 0.17],
      [0.036, 0.172, 0.16],
      [0, 0.156, 0.165],
      [-0.036, 0.172, 0.16],
    ],
    [0, 0.176, 0.218],
    [skin, skinDark, skinDark, skinShade],
  );

  /* hair */
  const hair = rgb(PAL.hair);
  // alternate locks a shade lighter: the follow camera mostly sees the back
  // of his head, which would otherwise read as one flat black slab
  // (kept near-black: his hair is black, not brown)
  const hairAlt = rgb(PAL.hair, 1.35);
  const hairHi = rgb(PAL.hairHi);
  const hairDark = rgb(PAL.hairDark);

  /** Dodecagon ring; `front` / `frontSide` override the ±15° and ±45° points. */
  const hairRing = (
    y: number,
    rx: number,
    rz: number,
    cz: number,
    front?: V3,
    frontSide?: V3,
  ): V3[] => {
    const r = ring(12, y, rx, rz, P12, cz);
    if (front) {
      r[0] = front;
      r[11] = mirror(front);
    }
    if (frontSide) {
      r[1] = frontSide;
      r[10] = mirror(frontSide);
    }
    return r;
  };
  /** Push the free-hanging points in and out alternately for a wavy outline. */
  const wave = (r: V3[], amount: number, dyOdd = 0, dyEven = 0): V3[] =>
    r.map((p, k) => {
      if (k < 2 || k > 9) return p; // the face opening
      const odd = Math.min(k, 11 - k) % 2 === 1;
      const f = 1 + (odd ? amount : -amount);
      return [p[0] * f, p[1] + (odd ? dyOdd : dyEven), p[2] * f] as V3;
    });

  const crown = ring(12, 0.466, 0.13, 0.135, P12, -0.01).map((p, k): V3 => {
    // swept back with some lift over the forehead, settling towards the back
    const front = k === 0 || k === 11;
    const frontSide = k === 1 || k === 10;
    const back = k === 5 || k === 6;
    return [p[0], front ? 0.482 : frontSide ? 0.476 : back ? 0.46 : 0.468, p[2]];
  });
  const hairRings: Ring[] = [
    // tucks back under to the neck so the shell is closed from below
    ring(12, 0.045, 0.07, 0.07, P12),
    // the ends: reach the neck, flick out
    wave(hairRing(0, 0.25, 0.228, -0.022, [0.03, 0.03, 0.04], [0.075, 0.03, 0.04]), 0.035, -0.014, 0.016),
    wave(hairRing(0.09, 0.242, 0.228, -0.02, [0.035, 0.09, 0.06], [0.09, 0.09, 0.06]), -0.02),
    wave(hairRing(0.2, 0.252, 0.238, -0.018, [0.04, 0.2, 0.09], [0.105, 0.2, 0.085]), 0.015),
    // temples: the ±45° points stay outside the skull → curtains
    hairRing(0.315, 0.246, 0.236, -0.015, [0.04, 0.33, 0.115], [0.16, 0.34, 0.146]),
    hairRing(0.405, 0.212, 0.205, -0.012),
    crown,
  ];
  loft(hairRings, (band, s) => {
    const centre = s === 11;
    const nearCentre = centre || s === 0 || s === 10;
    // quads whose four corners are all inside the skull / neck
    if (band <= 2 && nearCentre) return null;
    if (band === 3 && centre) return null;
    if (band === 0) return { to: solid, color: hairDark };
    // tone by column so it reads as locks falling from the parting
    const lock = Math.min(s, 10 - s) % 2 === 0;
    // the crown catches the light; flat shading alone separates its facets
    if (band === 5) return { to: solid, color: hairHi };
    return { to: solid, color: lock ? hair : hairAlt };
  });
  fanUp(crown, [0, 0.478, -0.01], () => ({ to: solid, color: hairHi }));
}

/** Blazer: hem, waist, chest, shoulders, collar; plus shirt collar and neck. */
function buildTorso(solid: MeshBuilder, front: MeshBuilder): void {
  const navy = rgb(PAL.navy);
  const navyDark = rgb(PAL.navyDark);
  const rings: Ring[] = [
    ring(8, -0.14, 0.25, 0.2, P8),
    ring(8, 0.04, 0.228, 0.188, P8, 0.004),
    ring(8, 0.26, 0.262, 0.205, P8, 0.008),
    ring(8, 0.415, 0.268, 0.172, P8),
    ring(8, 0.475, 0.115, 0.105, P8),
  ];
  loft(rings, (band, s) => {
    if (isFront8(s)) return { to: front };
    // baked shading: the back and the skirt of the jacket sit a little darker
    const k = (s === 3 ? 0.86 : s === 2 || s === 4 ? 0.92 : 1) * (band === 0 ? 0.92 : 1);
    return { to: solid, color: [navy[0] * k, navy[1] * k, navy[2] * k] };
  });
  capDown(rings[0], solid, navyDark);

  // shirt collar: a short light band standing above the blazer collar
  const shirt = rgb(PAL.shirtWhite);
  const shirtShade = rgb(PAL.shirt);
  loft([ring(6, 0.458, 0.128, 0.118, P6), ring(6, 0.506, 0.1, 0.096, P6)], (_b, s) => ({
    to: solid,
    color: s === 5 ? shirt : shirtShade,
  }));
  // neck
  const neck = rgb(PAL.skinShade);
  const neckDark = rgb(PAL.skinDark);
  loft([ring(6, 0.46, 0.088, 0.088, P6), ring(6, 0.548, 0.086, 0.086, P6)], (_b, s) => ({
    to: solid,
    color: s === 5 ? neckDark : neck,
  }));
}

/** Trouser seat; its top disappears under the blazer hem. */
function buildPelvis(solid: MeshBuilder): void {
  const cloth = rgb(PAL.trouser);
  const shade = rgb(PAL.trouserShade);
  const rings: Ring[] = [
    ring(6, -0.125, 0.165, 0.13, P6),
    ring(6, -0.03, 0.215, 0.165, P6),
    ring(6, 0.09, 0.205, 0.155, P6),
  ];
  loft(rings, (band, s) => ({ to: solid, color: band === 0 || s === 2 ? shade : cloth }));
  fanDown(rings[0], [0, -0.16, 0], () => ({ to: solid, color: shade }));
}

/** A tapered six-sided limb with a domed joint at each end. */
function buildLimb(
  solid: MeshBuilder,
  length: number,
  top: { rx: number; rz: number; dome: number },
  bottom: { rx: number; rz: number; dome: number },
  color: (side: number) => RGB,
  endColor: RGB,
): void {
  const rings: Ring[] = [ring(6, -length, bottom.rx, bottom.rz, P6), ring(6, 0, top.rx, top.rz, P6)];
  loft(rings, (_b, s) => ({ to: solid, color: color(s) }));
  fanUp(rings[1], [0, top.dome, 0], (s) => ({ to: solid, color: color(s) }));
  fanDown(rings[0], [0, -length - bottom.dome, 0], () => ({ to: solid, color: endColor }));
}

/** Sleeve, shirt cuff and mitten hand (palm towards the body, thumb forward). */
function buildForearm(solid: MeshBuilder): void {
  const navy = rgb(PAL.navy);
  const navyShade = rgb(PAL.navy, 0.88);
  const cuff = rgb(PAL.shirtWhite);
  const skin = rgb(PAL.skin);
  const skinShade = rgb(PAL.skinShade);
  const rings: Ring[] = [
    ring(6, -0.325, 0.058, 0.082, P6), // fingertips
    ring(6, -0.245, 0.074, 0.106, P6), // knuckles: the widest part of the mitten
    ring(6, -0.17, 0.062, 0.07, P6), // wrist
    ring(6, -0.15, 0.088, 0.09, P6), // sleeve end
    ring(6, 0, 0.086, 0.088, P6), // elbow
  ];
  const sleeve = (s: number): RGB => (s === 2 || s === 3 ? navyShade : navy);
  const hand = (s: number): RGB => (s === 2 || s === 3 ? skinShade : skin);
  loft(rings, (band, s) => ({
    to: solid,
    color: band <= 1 ? hand(s) : band === 2 ? cuff : sleeve(s),
  }));
  fanUp(rings[4], [0, 0.04, 0], (s) => ({ to: solid, color: sleeve(s) }));
  fanDown(rings[0], [0, -0.352, 0], () => ({ to: solid, color: skinShade }));
  // thumb: a short, broad nub (a long thin one reads as a spike side-on)
  pyramid(
    solid,
    [
      [0.038, -0.185, 0.055],
      [-0.038, -0.185, 0.055],
      [0, -0.272, 0.07],
    ],
    [0, -0.238, 0.132],
    [skin, skinShade, skinShade],
  );
}

/** Big rounded shoe; origin at the ankle, sole 0.1 below it, toe towards +Z. */
function buildShoe(solid: MeshBuilder): void {
  const shoe = rgb(PAL.shoe);
  const shoeHi = rgb(PAL.shoeHi);
  const sole = rgb(PAL.sole);
  /** toe, toe-left, mid-left, heel-left, heel → mirrored to an 8-point outline */
  const outline = (pts: readonly V3[]): V3[] => {
    // drawn at 1:1 around the ankle, then blown up: the shoes are meant to be big
    const p = pts.map((v): V3 => [v[0] * 1.1, v[1] < 0 ? v[1] : v[1] * 1.25, v[2] * 1.18 + 0.012]);
    return [p[0], p[1], p[2], p[3], p[4], mirror(p[3]), mirror(p[2]), mirror(p[1])];
  };
  const rings: Ring[] = [
    outline([
      [0, -0.1, 0.215],
      [0.078, -0.1, 0.165],
      [0.098, -0.1, 0.02],
      [0.07, -0.1, -0.105],
      [0, -0.1, -0.128],
    ]),
    outline([
      [0, -0.05, 0.245],
      [0.092, -0.05, 0.185],
      [0.112, -0.05, 0.02],
      [0.082, -0.05, -0.12],
      [0, -0.05, -0.145],
    ]),
    outline([
      [0, -0.03, 0.2],
      [0.07, -0.018, 0.14],
      [0.09, 0.03, 0.02],
      [0.072, 0.045, -0.095],
      [0, 0.045, -0.118],
    ]),
  ];
  const isToe = (s: number): boolean => s === 0 || s === 7;
  loft(rings, (band, s) => ({ to: solid, color: band === 0 ? sole : isToe(s) ? shoeHi : shoe }));
  fanUp(rings[2], [0, 0.07, -0.01], (s) => ({ to: solid, color: isToe(s) ? shoeHi : shoe }));
  capDown(rings[0], solid, sole);
}

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

export interface AvatarGeometry {
  pelvis: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  /** Textured with the blazer texture. */
  torsoFront: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  /** Textured with the face texture. */
  face: THREE.BufferGeometry;
  /** Limb geometry is symmetric, so both sides share it. */
  upperArm: THREE.BufferGeometry;
  forearm: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
  shoe: THREE.BufferGeometry;
}

/** Marker positions in the local space of the segment named in the comment. */
export const MARKERS = {
  /** forearm: centre of the mitten */
  hand: [0, -0.26, 0] as V3,
  /** foot: under the ball of the foot */
  sole: [0, -DIM.ankle, 0.06] as V3,
  /** head: where the Zzz drift up from */
  mouth: [0.04, 0.4, 0.16] as V3,
} as const;

export function buildGeometry(): AvatarGeometry {
  const navy = rgb(PAL.navy);
  const navyShade = rgb(PAL.navy, 0.88);
  const cloth = rgb(PAL.trouser);
  const clothShade = rgb(PAL.trouserShade);
  const sleeve = (s: number): RGB => (s === 2 || s === 3 ? navyShade : navy);
  const trouser = (s: number): RGB => (s === 2 || s === 3 ? clothShade : cloth);

  const head = new MeshBuilder();
  const face = new MeshBuilder(faceUv);
  buildHead(head, face);

  const torso = new MeshBuilder();
  const torsoFront = new MeshBuilder(blazerUv);
  buildTorso(torso, torsoFront);

  const pelvis = new MeshBuilder();
  buildPelvis(pelvis);

  const upperArm = new MeshBuilder();
  buildLimb(
    upperArm,
    DIM.upperArm,
    { rx: 0.1, rz: 0.102, dome: 0.08 },
    { rx: 0.085, rz: 0.087, dome: 0.04 },
    sleeve,
    navyShade,
  );

  const forearm = new MeshBuilder();
  buildForearm(forearm);

  const thigh = new MeshBuilder();
  buildLimb(
    thigh,
    DIM.thigh,
    { rx: 0.126, rz: 0.13, dome: 0.07 },
    { rx: 0.11, rz: 0.112, dome: 0.05 },
    trouser,
    clothShade,
  );

  const shin = new MeshBuilder();
  buildLimb(
    shin,
    DIM.shin - 0.03, // the trouser leg ends inside the shoe
    { rx: 0.11, rz: 0.112, dome: 0.05 },
    { rx: 0.104, rz: 0.108, dome: 0.02 },
    trouser,
    clothShade,
  );

  const shoe = new MeshBuilder();
  buildShoe(shoe);

  return {
    pelvis: pelvis.build(),
    torso: torso.build(),
    torsoFront: torsoFront.build(),
    head: head.build(),
    face: face.build(),
    upperArm: upperArm.build(),
    forearm: forearm.build(),
    thigh: thigh.build(),
    shin: shin.build(),
    shoe: shoe.build(),
  };
}

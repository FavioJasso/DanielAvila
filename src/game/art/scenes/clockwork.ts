/**
 * Course 3 — "Clockwork Network": big meshing brass gears turning in front
 * of a furnace glow, a crenellated brick firewall with a padlock, mission
 * pennants along the battlements and network nodes linked by lines in the
 * dark above. Ambers, brass and deep red.
 *
 * Composition: the big wheel rises from behind the wall like a sun (its
 * lowest teeth are hidden, so nothing merely grazes the battlements), a
 * second wheel meshes with it at the upper right, a small one at the upper
 * left, and the network runs along the dark top of the picture. The flags
 * stand in the clear pockets beside the big wheel.
 */
import { CLEAR, KEEP, Pix, type Color } from "../pixel";

const C = {
  ink: 0x1c080c,
  bg0: 0x321016,
  bg1: 0x52161a,
  bg2: 0x7c2418,
  bg3: 0xb04a16,
  bg4: 0xe8861c,
  bg5: 0xffc040,
  brickD: 0x561620,
  brick: 0x8a2a28,
  brickL: 0xb8483a,
  brassD: 0x7e4c12,
  brass: 0xc88e28,
  brassL: 0xf2c248,
  brassHi: 0xfff0a4,
  cream: 0xfff2cc,
  creamD: 0xe0b888,
  flag: 0xe9482c,
  flagD: 0xa82a22,
} as const;

export const CLOCKWORK_PALETTE: readonly Color[] = [C.ink, C.brick, C.bg4, C.brassL, C.cream];

const TAU = Math.PI * 2;
const frac = (v: number): number => v - Math.floor(v);

/** First row of the wall proper; the merlons stand on top of it. */
const WALL_Y = 49;
const MERLON_Y = 45;
/** Merlons are 4 px wide every 9 px, which leaves the same margin at both ends. */
const MERLON_X0 = 3;
const MERLON_PITCH = 9;

/**
 * Height above the wall (in rows) at which each band of the furnace glow
 * ends, brightest first. The bright bands are thin so the brass wheels sit
 * mostly on dark red, where they read best.
 */
const GLOW_EDGES = [4, 9, 15, 23, 33] as const;

/** Position along the glow colours for a height `t` above the wall. */
function glowBand(t: number): number {
  let lo = 0;
  for (let i = 0; i < GLOW_EDGES.length; i++) {
    const hi = GLOW_EDGES[i];
    // band i spans [lo, hi) and maps to i - 0.5 … i + 0.5 (see Pix.grad)
    if (t < hi) return i - 0.5 + Math.max(0, t - lo) / (hi - lo);
    lo = hi;
  }
  return GLOW_EDGES.length;
}

interface GearSpec {
  cx: number;
  cy: number;
  /** Tip radius. */
  r: number;
  teeth: number;
  /** Tooth height. */
  depth: number;
  /** Width of the solid rim inside the teeth. */
  rim: number;
  hub: number;
  /** Number of spokes; the web between them is cut away. */
  spokes: number;
  /** Angle of the first spoke. */
  spokeAngle: number;
  /**
   * Rotation of the teeth: a tooth is centred wherever
   * `(angle + phase) * teeth / TAU` has fractional part 0.25.
   */
  phase: number;
}

/** Tooth phase that puts one tooth at `angle` (radians). */
const toothAt = (angle: number, teeth: number): number => (0.25 * TAU) / teeth - angle;

function gear(p: Pix, s: GearSpec): void {
  const g = new Pix();
  const root = s.r - s.depth;
  const webOuter = root - s.rim;
  const size = Math.ceil(s.r) * 2 + 4;
  g.each(Math.floor(s.cx - s.r) - 2, Math.floor(s.cy - s.r) - 2, size, size, (x, y) => {
    const dx = x + 0.5 - s.cx;
    const dy = y + 0.5 - s.cy;
    const r = Math.hypot(dx, dy);
    if (r > s.r) return KEEP;
    const a = Math.atan2(dy, dx);
    if (r > root) {
      // trapezoid teeth: a little narrower at the tip than at the root
      const f = frac(((a + s.phase) * s.teeth) / TAU);
      const half = 0.25 - (0.06 * (r - root)) / s.depth;
      if (Math.abs(f - 0.25) > half) return KEEP;
    }
    // +1 where the surface faces the light (upper left), -1 facing away
    const lit = -(dx * 0.6 + dy * 0.8) / Math.max(r, 0.001);
    if (r <= 1.1) return C.ink;
    if (r <= s.hub) return lit > 0.25 ? C.brassHi : lit < -0.45 ? C.brass : C.brassL;
    if (r <= s.hub + 1) return C.brassD;
    if (r < webOuter) {
      if (r > s.hub + 1.6 && r < webOuter - 0.6) {
        const f = frac(((a - s.spokeAngle) * s.spokes) / TAU);
        if (f > 0.2 && f < 0.8) return KEEP; // window between two spokes
      }
      return C.brass;
    }
    // a groove just inside the rim catches light the other way round
    if (r < webOuter + 1) return lit > 0 ? C.brassD : C.brassL;
    return lit > 0.35 ? C.brassL : lit < -0.3 ? C.brassD : C.brass;
  });
  g.outline(C.ink);
  p.blit(g);
}

/**
 * A swallow-tailed mission flag on a pole. `x` is the pole, `yTop` the top
 * row of the cloth, `yBase` the last row of the pole; the cloth is `len`
 * pixels long and streams to the right.
 */
function flag(p: Pix, x: number, yTop: number, yBase: number, len: number): void {
  const f = new Pix();
  f.vline(x, yTop, yBase - yTop + 1, C.cream);
  f.set(x, yTop - 1, C.brassL);
  // five rows; the middle one is two pixels shorter (the swallow tail)
  for (let j = 0; j < 5; j++) {
    const n = len - (2 - Math.abs(j - 2));
    f.hline(x + 1, yTop + j, n, j >= 3 ? C.flagD : C.flag);
  }
  // a small gold mark
  f.rect(x + 2, yTop + 1, 2, 2, C.brassHi);
  f.outline(C.ink);
  p.blit(f);
}

export function drawClockwork(p: Pix): void {
  /* --- furnace glow rising from behind the wall ------------------ */
  p.grad(
    0,
    0,
    64,
    64,
    [C.bg5, C.bg4, C.bg3, C.bg2, C.bg1, C.bg0],
    // the glow is a low dome: it reaches highest in the middle
    (x, y) => glowBand(WALL_Y - y + Math.abs(x + 0.5 - 32) / 7),
    4,
  );

  /* --- network: nodes linked by lines ---------------------------- */
  const nodes: readonly (readonly [number, number])[] = [
    [4, 6],
    [13, 3],
    [22, 7],
    [30, 3],
    [29, 11],
    [38, 6],
    [48, 3],
    [59, 5],
  ];
  const links: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 5],
    [4, 5],
    [5, 6],
    [6, 7],
  ];
  for (const [a, b] of links) {
    p.line(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], C.bg4);
  }
  // loose ends run off the canvas
  p.line(4, 6, 1, 10, C.bg4);
  p.line(59, 5, 62, 9, C.bg4);
  for (const [nx, ny] of nodes) {
    const n = new Pix();
    n.rect(nx - 1, ny - 1, 3, 3, C.cream);
    n.set(nx + 1, ny + 1, C.creamD);
    n.outline(C.ink);
    p.blit(n);
  }

  /* --- gear train ------------------------------------------------- */
  // Every wheel is centred on a pixel corner so it keeps a clean mirror
  // symmetry. Tooth counts follow the radii (the teeth are the same size
  // on all three, as on real meshing gears) and each wheel is turned so a
  // tooth of one sits in a gap of the next along the line of centres.
  const big: GearSpec = {
    cx: 28,
    cy: 33,
    r: 17,
    teeth: 16,
    depth: 2.8,
    rim: 2.4,
    hub: 3.5,
    // six slim spokes, one pointing straight up: four broad windows made the
    // big wheel read as a ship's wheel or a cross rather than a gear
    spokes: 6,
    spokeAngle: -TAU / 4,
    phase: toothAt(0, 16),
  };
  const medium: GearSpec = {
    cx: 51,
    cy: 23,
    r: 10.5,
    teeth: 8,
    depth: 2.6,
    rim: 1.4,
    hub: 2,
    spokes: 4,
    spokeAngle: 0,
    phase: toothAt(0, 8),
  };
  const small: GearSpec = {
    cx: 12,
    cy: 17,
    r: 7.5,
    teeth: 8,
    depth: 2.2,
    rim: 1.4,
    hub: 1.8,
    spokes: 0,
    spokeAngle: 0,
    phase: toothAt(TAU / 16, 8),
  };
  gear(p, small);
  gear(p, medium);
  gear(p, big);

  /* --- brick firewall -------------------------------------------- */
  const w = new Pix();
  w.rect(0, WALL_Y, 64, 64 - WALL_Y, C.brick);
  for (let x = MERLON_X0; x < 64; x += MERLON_PITCH) {
    w.rect(x, MERLON_Y, 4, WALL_Y - MERLON_Y, C.brick);
  }
  w.each(0, MERLON_Y, 64, 64 - MERLON_Y, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    // capstones along the top of the merlons and of the wall catch the light
    if (y === MERLON_Y || (y === WALL_Y && w.get(x, y - 1) === CLEAR)) return C.brickL;
    const row = Math.floor((y - MERLON_Y - 1) / 3);
    const m = (y - MERLON_Y - 1) % 3;
    if (m === 2) return C.brickD; // mortar course
    const shift = (row % 2) * 3;
    if ((x + shift) % 6 === 0) return C.brickD; // joint
    // a few paler bricks break up the bond
    const col = Math.floor((x + shift) / 6);
    return row > 1 && (row * 5 + col * 3) % 7 === 0 ? C.brickL : KEEP;
  });
  w.outline(C.ink);
  p.blit(w);

  // padlock on the wall
  const l = new Pix();
  l.rect(28, 54, 8, 6, C.brass);
  l.hline(28, 54, 8, C.brassL);
  l.vline(35, 55, 5, C.brassD);
  l.hline(28, 59, 8, C.brassD);
  l.rect(31, 56, 2, 2, C.ink);
  l.rect(29, 51, 6, 1, C.brassL);
  l.vline(29, 52, 2, C.brassL);
  l.vline(34, 52, 2, C.brass);
  l.outline(C.ink);
  p.blit(l);

  /* --- mission pennants, one per merlon, all streaming the same way -- */
  flag(p, 4, 35, MERLON_Y - 1, 4);
  flag(p, 48, 37, MERLON_Y - 1, 5);
  flag(p, 57, 40, MERLON_Y - 1, 4);

  p.border(C.ink);
}

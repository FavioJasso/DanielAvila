/**
 * Course 5 — "Sunset Courtyard": a quiet castle garden at dusk. A low sun
 * sinks behind the battlements between two towers; clipped hedges, a small
 * fountain and a bench throw long shadows towards the viewer. Oranges,
 * pinks and plum.
 */
import { CLEAR, KEEP, Pix, type Color } from "../pixel";

const C = {
  ink: 0x2a1238,
  skyTop: 0x4b2c7c,
  sky1: 0x8c3c8e,
  sky2: 0xd4527a,
  sky3: 0xf5843c,
  sky4: 0xffc24c,
  sun: 0xfff4b4,
  castleD: 0x3b1c52,
  castle: 0x6a2f6c,
  hedgeD: 0x1f3b36,
  hedge: 0x3a6e3e,
  lawnD: 0x3e5c3a,
  lawn: 0x6a9040,
  lawnL: 0xa9bb4c,
  pathD: 0xb86a52,
  path: 0xf0ae72,
  stoneD: 0x7a4466,
  water: 0x5aa6b8,
  waterL: 0xe8fbff,
  wood: 0x6b3430,
} as const;

export const COURTYARD_PALETTE: readonly Color[] = [C.ink, C.sky1, C.sky2, C.sky3, C.sky4];

/** Everything the low sun lights turns one step darker inside a shadow. */
const SHADOW: ReadonlyMap<Color, Color> = new Map<Color, Color>([
  [C.lawnL, C.lawn],
  [C.lawn, C.lawnD],
  [C.path, C.pathD],
]);

/** Darken the ground inside a polygon (a cast shadow). */
function castShadow(p: Pix, pts: readonly number[]): void {
  const mask = new Pix();
  mask.poly(pts, 1);
  p.remap(0, 0, 64, 64, SHADOW, (x, y) => mask.get(x, y) !== CLEAR);
}

/** A battlemented tower in silhouette, rim-lit on the side facing the sun. */
function tower(p: Pix, x: number, top: number, w: number, litSide: 1 | -1): void {
  const t = new Pix();
  t.rect(x, top + 2, w, 40 - top, C.castleD);
  t.rect(x - 1, top + 2, w + 2, 3, C.castleD);
  for (const mx of [x - 1, x + (w >> 1) - 1, x + w - 1]) t.rect(mx, top, 2, 2, C.castleD);
  // the face turned towards the sun is a shade lighter, its edge glows
  const edge = litSide === 1 ? x + w - 1 : x;
  t.each(x - 1, top, w + 2, 42 - top, (i, _j, cur) => {
    if (cur === CLEAR) return KEEP;
    const d = (edge - i) * litSide;
    return d === 0 ? C.sky2 : d === 1 ? C.castle : KEEP;
  });
  t.outline(C.ink);
  p.blit(t);
}

export function drawCourtyard(p: Pix): void {
  /* --- sky and sun ------------------------------------------------ */
  p.grad(0, 0, 64, 40, [C.skyTop, C.sky1, C.sky2, C.sky3], (_x, y) => (y - 1) / 8.5);
  const sx = 32;
  const sy = 30;
  p.dither(12, 12, 40, 28, C.sky4, (x, y) => 1.9 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / 7.2);
  p.disc(sx, sy, 6.5, C.sun);

  // thin clouds, lit from underneath
  const streak = (x: number, y: number, len: number, top: Color, under: Color): void => {
    p.hline(x + 2, y, len - 5, top);
    p.hline(x, y + 1, len, under);
  };
  streak(5, 7, 15, C.sky1, C.sky2);
  streak(38, 4, 13, C.sky1, C.sky2);
  streak(42, 13, 17, C.sky2, C.sky3);
  streak(2, 16, 12, C.sky2, C.sky3);
  streak(22, 11, 9, C.sky1, C.sky2);

  /* --- battlements and towers ------------------------------------ */
  const wall = new Pix();
  wall.rect(0, 34, 64, 6, C.castleD);
  for (let x = 1; x < 64; x += 4) wall.rect(x, 32, 2, 2, C.castleD);
  wall.outline(C.ink);
  p.blit(wall);
  tower(p, 7, 13, 9, 1);
  tower(p, 48, 18, 10, -1);
  // lit windows
  for (const [wx, wy] of [
    [11, 20],
    [11, 27],
    [52, 25],
  ] as const) {
    p.rect(wx, wy, 2, 3, C.sky4);
    p.set(wx, wy, C.sun);
  }
  // two birds heading home
  for (const [bx, by] of [
    [33, 14],
    [37, 12],
  ] as const) {
    p.set(bx, by, C.castleD);
    p.set(bx + 1, by + 1, C.castleD);
    p.set(bx + 2, by, C.castleD);
  }
  // pennant on the taller tower
  p.vline(11, 8, 5, C.ink);
  p.rect(12, 8, 4, 2, C.sky2);
  p.rect(12, 10, 2, 1, C.sky1);

  // two cypresses in front of the wall
  for (const cx of [22.5, 41.5]) {
    const t = new Pix();
    t.ellipse(cx, 33.5, 2.3, 6.5, C.hedgeD);
    const toSun = cx < sx ? 1 : -1;
    t.each(Math.floor(cx) - 3, 27, 7, 14, (i, j, cur) =>
      cur !== CLEAR && t.get(i + toSun, j) === CLEAR && j < 37 ? C.hedge : KEEP,
    );
    t.outline(C.ink);
    p.blit(t);
  }

  /* --- lawn -------------------------------------------------------- */
  p.grad(
    1,
    40,
    62,
    23,
    [C.lawnL, C.lawn],
    (x, y) => Math.abs(x + 0.5 - sx) / 15 + (y - 40) / 50 - 0.35,
    5,
  );
  p.hline(1, 40, 62, C.lawnD);
  p.hline(1, 41, 62, C.lawnD);

  // paved circle round the fountain and the path leading to it
  p.ellipse(32, 48.5, 14, 4.6, C.path);
  p.poly([28.5, 50, 35.5, 50, 42, 63, 22, 63], C.path);

  /* --- long shadows, falling towards the viewer ------------------- */
  castShadow(p, [2, 49, 20, 49, 17, 54, 0, 54]);
  castShadow(p, [44, 49, 62, 49, 64, 54, 47, 54]);
  castShadow(p, [23, 50, 41, 50, 44, 56, 20, 56]);
  castShadow(p, [45, 60, 60, 60, 63, 63, 47, 63]);

  /* --- box hedges --------------------------------------------------- */
  for (const hx of [2, 45]) {
    const h = new Pix();
    h.rect(hx, 42, 17, 7, C.hedgeD);
    h.rect(hx, 42, 17, 2, C.hedge);
    h.hline(hx, 42, 17, C.lawnL);
    h.each(hx, 44, 17, 5, (x, y) => ((x * 7 + y * 13 + ((x * y) % 5)) % 9 === 0 ? C.hedge : KEEP));
    // rounded shoulders
    h.set(hx, 42, CLEAR);
    h.set(hx + 16, 42, CLEAR);
    h.outline(C.ink);
    p.blit(h);
  }
  // flowers along the hedge feet
  for (const fx of [4, 9, 15, 48, 54, 59]) {
    p.set(fx, 49, fx % 2 === 0 ? C.sky2 : C.sun);
  }

  /* --- fountain ------------------------------------------------------ */
  const f = new Pix();
  f.ellipse(32, 49, 9, 3, C.stoneD);
  f.rect(23, 47, 18, 2, C.stoneD);
  f.ellipse(32, 47, 9, 3, C.path);
  f.ellipse(32, 47, 7.4, 2, C.water);
  f.hline(27, 46, 4, C.sky4);
  f.hline(33, 47, 4, C.waterL);
  // pedestal, upper bowl and spout
  f.rect(31, 41, 2, 6, C.stoneD);
  f.rect(29, 41, 6, 1, C.path);
  f.rect(30, 42, 4, 1, C.stoneD);
  f.rect(31, 38, 2, 3, C.stoneD);
  f.outline(C.ink);
  // water: a jet and two falling arcs
  f.rect(31, 36, 2, 2, C.waterL);
  for (const s of [-1, 1]) {
    const bx = s === -1 ? 29 : 34;
    f.set(bx, 40, C.waterL);
    f.set(bx + s, 41, C.waterL);
    f.set(bx + s * 2, 42, C.waterL);
    f.set(bx + s * 2, 43, C.waterL);
    f.set(bx + s * 2, 45, C.waterL);
  }
  p.blit(f);

  /* --- bench --------------------------------------------------------- */
  const b = new Pix();
  b.rect(45, 51, 13, 1, C.sky3);
  b.rect(45, 53, 13, 1, C.wood);
  b.vline(45, 50, 6, C.wood);
  b.vline(57, 50, 6, C.wood);
  b.rect(44, 55, 15, 1, C.sky3);
  b.rect(44, 56, 15, 1, C.wood);
  b.vline(45, 57, 3, C.wood);
  b.vline(57, 57, 3, C.wood);
  b.outline(C.ink);
  p.blit(b);

  /* --- a shrub in the near corner ------------------------------------ */
  const s = new Pix();
  s.disc(4, 61, 6, C.hedgeD);
  s.disc(11, 62, 5, C.hedgeD);
  s.disc(16, 64, 3.5, C.hedgeD);
  s.each(0, 54, 20, 10, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    if (s.get(x, y - 1) === CLEAR) return C.lawnL;
    return s.get(x, y - 2) === CLEAR || (x * 5 + y * 3) % 9 === 0 ? C.hedge : KEEP;
  });
  s.outline(C.ink);
  p.blit(s);
  p.set(3, 59, C.sky2);
  p.set(8, 61, C.sun);
  p.set(12, 60, C.sky2);

  p.border(C.ink);
}

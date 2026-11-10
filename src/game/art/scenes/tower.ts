/**
 * Course 4 — "Skyward Star Tower": a sunlit stone tower rising out of a sea
 * of clouds into a bright sky, ringed by floating gold five-point stars.
 * Sky blues, white and gold.
 */
import { cloud, sparkle, starSprite, type StarColors } from "../motifs";
import { CLEAR, KEEP, Pix, type Color } from "../pixel";

const C = {
  ink: 0x1c2c62,
  skyTop: 0x2f7ae0,
  sky1: 0x52a0f2,
  sky2: 0x86c6fa,
  sky3: 0xbde3ff,
  white: 0xffffff,
  cloudS: 0xcfe8fb,
  cloudD: 0x9bc4ea,
  stoneL: 0xfbf3dc,
  stone: 0xdcd0b4,
  stoneD: 0xa99f8a,
  window: 0x2b458f,
  gold: 0xffc93c,
  goldHi: 0xfff3a6,
  goldD: 0xe08a00,
} as const;

export const TOWER_PALETTE: readonly Color[] = [C.ink, C.skyTop, C.sky2, C.white, C.gold];

const STAR: StarColors = { outline: C.ink, gold: C.gold, hi: C.goldHi, shade: C.goldD };

/**
 * The ring of stars, as seen slightly from above: [x, y, face size]. The
 * first three sit behind the tower (smaller, higher), the rest in front.
 */
const BACK_STARS: readonly (readonly [number, number, 5 | 7 | 9])[] = [
  [17, 23, 5],
  [47, 23, 5],
];
const FRONT_STARS: readonly (readonly [number, number, 5 | 7 | 9])[] = [
  [7, 31, 7],
  [57, 31, 7],
  [19.5, 41, 9],
  [44.5, 41, 9],
];

/**
 * One bank of the cloud sea. `puffs` are [centre x, centre y, radius] discs,
 * listed back to front (a later puff overlaps an earlier one). Each puff is
 * lit from the upper left: a `light` body with a `shade` crescent along its
 * lower right rim, which is what separates it from the puff beside it.
 * `crescent` is its thickness in pixels. Everything from `baseY` down is
 * solid `light`. `rim` (optional) brightens the top edge of the bank.
 */
function cloudBank(
  puffs: readonly (readonly [number, number, number])[],
  baseY: number,
  crescent: number,
  light: Color,
  shade: Color,
  rim?: Color,
): Pix {
  const bank = new Pix();
  for (const [x, y, r] of puffs) {
    bank.disc(x, y, r, shade);
    bank.disc(x - crescent * 0.6, y - crescent, r - crescent, light);
  }
  bank.rect(0, baseY, 64, 64 - baseY, light);
  if (rim !== undefined) {
    bank.each(0, 0, 64, 64, (i, j, cur) =>
      cur !== CLEAR && bank.get(i, j - 1) === CLEAR ? rim : KEEP,
    );
  }
  return bank;
}

export function drawTower(p: Pix): void {
  /* --- sky -------------------------------------------------------- */
  p.grad(0, 0, 64, 64, [C.skyTop, C.sky1, C.sky2, C.sky3], (_x, y) => (y - 3) / 13);
  cloud(p, 3, 11, [[2, 1.6], [5, 2.6], [9, 2], [12, 1.4]], C.white, C.cloudS);
  cloud(p, 46, 9, [[2, 1.4], [5, 2.2], [9, 2.8], [12, 1.6]], C.white, C.cloudS);

  for (const [x, y, size] of BACK_STARS) starSprite(p, x, y, size, STAR);

  /* --- the tower -------------------------------------------------- */
  const t = new Pix();
  // shaft, widening a little towards the clouds
  t.poly([26, 23, 38, 23, 39.5, 58, 24.5, 58], C.stone);
  // corbelled platform, parapet and merlons
  t.rect(24, 21, 16, 2, C.stone);
  t.rect(23, 18, 18, 3, C.stone);
  for (let x = 23; x <= 39; x += 4) t.rect(x, 16, 2, 2, C.stone);
  // turret
  t.rect(28, 12, 8, 6, C.stone);
  // sun on the left, shade on the right
  t.each(20, 10, 24, 50, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    let l = x;
    while (t.get(l - 1, y) !== CLEAR) l--;
    let r = x;
    while (t.get(r + 1, y) !== CLEAR) r++;
    // fixed-width bands so the taper does not make the shading wobble
    const band = r - l > 13 ? 4 : 3;
    return x - l < band ? C.stoneL : r - x < band ? C.stoneD : KEEP;
  });
  // courses: a lit lip on the parapet, shadow under the platform
  t.hline(23, 18, 18, C.stoneL);
  t.hline(24, 22, 16, C.stoneD);
  t.hline(26, 23, 12, C.stoneD);
  t.hline(26, 35, 12, C.stoneD);
  t.hline(26, 34, 12, C.stoneL);
  // a few masonry marks
  const marks: readonly (readonly [number, number])[] = [
    [28, 26],
    [29, 37],
    [33, 47],
    [29, 49],
    [32, 52],
  ];
  for (const [mx, my] of marks) t.hline(mx, my, 2, C.stoneD);
  // roof: a gold cone with a blue pennant
  const roof = new Pix();
  roof.poly([26, 12, 38, 12, 32, 5.4], C.gold);
  roof.each(26, 5, 12, 7, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    const half = ((y + 0.5 - 5.4) / 6.6) * 6;
    const u = (x + 0.5 - 32) / Math.max(half, 0.5);
    return u < -0.35 ? C.goldHi : u > 0.3 ? C.goldD : KEEP;
  });
  t.blit(roof);
  t.outline(C.ink);
  t.hline(27, 12, 10, C.ink); // eaves
  p.blit(t);
  // a gold pennant streaming from the finial
  p.vline(32, 2, 3, C.ink);
  p.hline(33, 2, 5, C.gold);
  p.hline(33, 3, 3, C.goldD);
  // windows
  p.rect(31, 14, 2, 3, C.window);
  for (const wy of [26, 39]) {
    p.rect(31, wy, 2, 5, C.window);
    p.hline(31, wy - 1, 2, C.ink);
    p.hline(30, wy + 5, 4, C.stoneL);
  }

  /* --- cloud sea --------------------------------------------------- */
  // Far bank: pale blue billows with a sunlit white rim.
  const far = cloudBank(
    [
      [58, 52, 7],
      [42, 55, 5],
      [22, 55, 5],
      [6, 52, 7],
      [50, 54, 5],
      [32, 53, 4.5],
      [14, 54, 5],
    ],
    56,
    1.3,
    C.cloudS,
    C.cloudD,
    C.white,
  );
  // Near bank: bright white billows shaded with the pale blue.
  const near = cloudBank(
    [
      [63, 59, 6],
      [46, 59, 6.5],
      [28, 59, 6],
      [10, 59, 6],
      [55, 60, 6],
      [37, 61, 6],
      [19, 61, 6.5],
      [1, 60, 6.5],
    ],
    62,
    1.9,
    C.white,
    C.cloudS,
  );
  // the near bank throws a soft contact shadow on the far one
  far.each(0, 0, 64, 64, (i, j, cur) =>
    cur !== CLEAR && near.get(i, j) === CLEAR && near.get(i, j + 1) !== CLEAR ? C.cloudD : KEEP,
  );
  p.blit(far);
  p.blit(near);

  /* --- front half of the ring ------------------------------------- */
  for (const [x, y, size] of FRONT_STARS) starSprite(p, x, y, size, STAR);
  sparkle(p, 13, 17, C.white, C.sky3);
  sparkle(p, 51, 37, C.white, C.sky3);
  sparkle(p, 11, 44, C.white, C.sky3);
  sparkle(p, 56, 19, C.white, C.sky3);
  p.set(24, 30, C.white);
  p.set(42, 32, C.white);

  p.border(C.ink);
}

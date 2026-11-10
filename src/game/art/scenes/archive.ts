/**
 * Course 1 — "The Royal Archive": a fortress library seen across its
 * courtyard. Parchment walls, slate-blue roofs, tall arches full of warm
 * light and bookshelves, brand-blue banners. Cool blues + parchment.
 */
import { archOpening, cloud } from "../motifs";
import { CLEAR, KEEP, Pix, mulberry32, type Color } from "../pixel";

const C = {
  ink: 0x141a3c,
  navy: 0x24386f,
  blue: 0x3558a8,
  azure: 0x4f80d6,
  sky: 0x86b4ec,
  haze: 0xbddbf7,
  white: 0xf4f9ff,
  wallD: 0xa98c58,
  wall: 0xd8be86,
  wallL: 0xf1e2b4,
  glowD: 0xee9c36,
  glow: 0xffd265,
  glowHi: 0xfff2ae,
  wood: 0x6f4226,
  red: 0xc0483c,
  green: 0x4c986a,
  greenD: 0x2b6649,
  greenL: 0x86c27a,
  stone: 0x9cafd3,
  stoneD: 0x7387b6,
} as const;

export const ARCHIVE_PALETTE: readonly Color[] = [C.ink, C.blue, C.sky, C.wallL, C.glow];

const TOWERS = [4, 52] as const;
const BOOKS: readonly Color[] = [C.red, C.azure, C.navy, C.wallL, C.green, C.glowD];

export function drawArchive(p: Pix): void {
  const rnd = mulberry32(0x0a5c1e);

  /* --- sky ------------------------------------------------------- */
  p.grad(0, 0, 64, 47, [C.blue, C.azure, C.sky, C.haze], (_x, y) => (y + 1) / 9);
  cloud(p, 15, 11, [[2, 1.5], [5, 2.6], [9, 2.2], [12, 1.4]], C.white, C.haze);
  cloud(p, 36, 8, [[2, 1.4], [5, 2.2], [9, 2.8], [13, 1.8]], C.white, C.haze);

  /* --- the building, on its own layer so it gets one clean outline -- */
  const b = new Pix();

  // Hall: slate roof, cornice, parchment wall, plinth.
  b.poly([15, 15, 49, 15, 54, 22, 10, 22], C.blue);
  b.each(10, 15, 44, 7, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    if (y === 15) return C.azure;
    // staggered slate courses
    return y % 2 === 1 && (x + y) % 4 === 0 ? C.navy : KEEP;
  });
  b.rect(12, 23, 40, 24, C.wall);
  b.hline(10, 22, 44, C.wallL);
  b.hline(12, 23, 40, C.wallD);
  b.rect(12, 45, 40, 2, C.wallD);

  // Gabled frontispiece over the door (own layer: it needs an ink edge
  // against the roof behind it, not just against the sky).
  const g = new Pix();
  g.poly([23, 23, 41, 23, 32, 9], C.wall);
  g.each(23, 9, 18, 14, (x, y, cur) =>
    cur !== CLEAR && g.get(x - 1, y) === CLEAR ? C.wallL : KEEP,
  );
  g.outline(C.ink);
  g.rect(22, 22, 20, 2, CLEAR);
  b.blit(g);
  b.hline(24, 22, 16, C.wallL);

  // Towers with cone roofs and pennants.
  for (const tx of TOWERS) {
    b.rect(tx, 19, 8, 28, C.wall);
    b.rect(tx, 19, 2, 28, C.wallL);
    b.rect(tx + 6, 19, 2, 28, C.wallD);
    b.rect(tx - 1, 16, 10, 3, C.wallL);
    b.hline(tx - 1, 18, 10, C.wallD);
    b.rect(tx, 45, 8, 2, C.wallD);
    const ax = tx + 4;
    b.poly([tx - 1, 16, tx + 9, 16, ax, 6], C.blue);
    b.each(tx - 1, 6, 10, 10, (x, y, cur) => {
      if (cur !== C.blue) return KEEP;
      const half = ((y + 0.5 - 6) / 10) * 5;
      const u = (x + 0.5 - ax) / Math.max(half, 0.5);
      return u < -0.3 ? C.azure : u > 0.35 ? C.navy : KEEP;
    });
    b.vline(ax, 3, 3, C.wood);
    b.rect(ax + 1, 3, 3, 2, C.red);
  }

  // Sparse masonry marks so the walls are not flat.
  for (let i = 0; i < 14; i++) {
    const x = 13 + Math.floor(rnd() * 36);
    const y = 25 + Math.floor(rnd() * 19);
    b.hline(x, y, 2, rnd() < 0.5 ? C.wallL : C.wallD);
  }

  b.outline(C.ink);
  p.blit(b);

  /* --- openings -------------------------------------------------- */
  // Warm light bleeding onto the wall around an opening.
  const halo = (x0: number, yTop: number, w: number, yBottom: number): void => {
    archOpening(p, x0 - 1, yTop - 1, w + 2, yBottom, () => KEEP, C.wallL);
  };

  const shelfWindow = (x0: number): void => {
    // Pre-roll the books so the layout does not depend on draw order.
    const books: Color[][] = [];
    for (let s = 0; s < 4; s++) {
      const row: Color[] = [];
      let c: Color = C.red;
      for (let i = 0; i < 8; i++) {
        if (i === 0 || rnd() < 0.7) c = BOOKS[Math.floor(rnd() * BOOKS.length)];
        row.push(rnd() < 0.12 ? C.glow : c);
      }
      books.push(row);
    }
    halo(x0, 26, 8, 43);
    archOpening(
      p,
      x0,
      26,
      8,
      43,
      (x, y) => {
        if (y < 29) return C.glowHi;
        if (y === 29) return C.wood;
        const k = y - 30;
        if (k >= 12) return books[3][x - x0];
        const m = k & 3;
        if (m === 0) return C.glow;
        if (m === 3) return C.wood;
        return books[k >> 2][x - x0];
      },
      C.ink,
    );
    p.hline(x0 - 1, 44, 10, C.wallL);
  };
  shelfWindow(14);
  shelfWindow(42);

  // Round window in the gable and slit windows in the towers.
  p.disc(32, 17, 3.2, C.ink);
  p.disc(32, 17, 2.2, C.glowHi);
  p.vline(31, 15, 4, C.glow);
  p.vline(32, 15, 4, C.glow);
  p.hline(30, 16, 4, C.glow);
  p.hline(30, 17, 4, C.glow);
  p.rect(31, 16, 2, 2, C.glowHi);
  for (const tx of TOWERS) {
    archOpening(p, tx + 3, 22, 2, 27, () => C.glow, C.ink);
  }

  // Grand doorway: an aisle of bookcases receding into the light.
  halo(27, 27, 10, 46);
  archOpening(
    p,
    27,
    27,
    10,
    46,
    (x, y) => {
      const d = Math.abs(x + 0.5 - 32);
      if (d > 3) {
        // bookcases in shadow either side of the aisle
        if (y <= 30) return C.glowD;
        return (y - 31) % 3 === 2 ? C.wood : C.glowD;
      }
      return d < 2 ? C.glowHi : C.glow;
    },
    C.ink,
  );

  // Brand-blue banners: a pair by the door, a long one on each tower.
  const banner = (bx: number, y: number, len: number): void => {
    p.hline(bx - 1, y, 5, C.wood);
    p.rect(bx, y + 1, 3, len, C.azure);
    p.vline(bx + 2, y + 1, len, C.blue);
    p.hline(bx, y + 2, 3, C.glow);
    p.set(bx + 1, y + 5, C.glow);
    p.set(bx, y + len + 1, C.azure);
    p.set(bx + 2, y + len + 1, C.blue);
  };
  banner(23, 25, 11);
  banner(38, 25, 11);
  for (const tx of TOWERS) banner(tx + 2, 30, 9);

  /* --- courtyard ------------------------------------------------- */
  const vx = 32;
  const vy = 41;
  const rows = [47, 50, 53, 57, 62];
  p.each(1, 47, 62, 16, (x, y) => {
    const u = (x + 0.5 - vx) / (y + 0.5 - vy);
    const un = (x + 1.5 - vx) / (y + 0.5 - vy);
    let band = 0;
    while (band < rows.length - 1 && y >= rows[band + 1]) band++;
    const off = band % 2 === 0 ? 0 : 0.35;
    const joint =
      y === rows[band] || Math.floor(u / 0.7 + off) !== Math.floor(un / 0.7 + off);
    const a = Math.abs(u);
    if (a < 0.72) {
      // parchment path with darker kerbs
      if (a > 0.6) return C.wall;
      return joint ? C.wall : C.wallL;
    }
    return joint ? C.stoneD : C.stone;
  });
  // door steps
  p.hline(25, 47, 14, C.wallL);
  p.hline(24, 48, 16, C.wall);
  p.hline(24, 49, 16, C.wallD);
  // light spilling from the doorway onto the path, and from the windows
  p.dither(27, 50, 10, 5, C.glowHi, (_x, y) => 0.8 - (y - 50) * 0.17);
  for (const wx of [13, 41]) {
    p.dither(wx, 47, 10, 3, C.haze, (_x, y) => 0.7 - (y - 47) * 0.22);
  }

  // Lamp posts either side of the path.
  for (const lx of [20, 43]) {
    p.sprite(lx - 1, 49, [".o.", "ogo", "oho", ".o.", ".o.", ".o.", ".o.", "ooo"], {
      o: C.ink,
      g: C.glow,
      h: C.glowHi,
    });
  }

  // Potted topiaries, rim-lit by the windows.
  for (const tx of [7, 57]) {
    const t = new Pix();
    const inward = tx < 32 ? 1 : -1;
    t.disc(tx, 53, 3.6, C.green);
    t.each(tx - 4, 49, 8, 8, (x, y, cur) => {
      if (cur === CLEAR) return KEEP;
      const lit = (x + 0.5 - tx) * inward;
      if (lit > 1 && y <= 51) return C.greenL;
      return lit < -1.2 || y >= 55 ? C.greenD : KEEP;
    });
    t.rect(tx - 1, 57, 2, 1, C.wood);
    t.rect(tx - 3, 58, 6, 3, C.red);
    t.hline(tx - 3, 58, 6, C.glowD);
    t.outline(C.ink);
    p.blit(t);
  }

  p.border(C.ink);
}

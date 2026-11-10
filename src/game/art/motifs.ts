/**
 * Small reusable motifs for the paintings: arched openings, puffy clouds and
 * hand-drawn five-point stars. Keeping them here gives the five scenes the
 * same pixel vocabulary (same arches, same cloud shapes, same stars).
 */
import { CLEAR, KEEP, Pix, type Color } from "./pixel";

/**
 * A round-headed opening `w` pixels wide whose apex is on row `yTop` and
 * whose last row is `yBottom`. `fill` colours the inside; every pixel that
 * touches the inside from outside gets the `frame` colour (pass `KEEP` for
 * no frame).
 */
export function archOpening(
  p: Pix,
  x0: number,
  yTop: number,
  w: number,
  yBottom: number,
  fill: (x: number, y: number) => Color,
  frame: Color,
): void {
  const r = w / 2;
  const cx = x0 + r;
  const cy = yTop + r;
  const inside = (x: number, y: number): boolean => {
    if (x < x0 || x >= x0 + w || y < yTop || y > yBottom) return false;
    if (y + 0.5 >= cy) return true;
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= r * r;
  };
  p.each(x0 - 1, yTop - 1, w + 2, yBottom - yTop + 3, (x, y) => {
    if (inside(x, y)) return fill(x, y);
    if (frame === KEEP) return KEEP;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (inside(x + i, y + j)) return frame;
      }
    }
    return KEEP;
  });
}

/**
 * A flat-bottomed cumulus built from overlapping discs. `x`, `y` is the
 * left end of its base line; `humps` lists [offsetX, radius] pairs.
 */
export function cloud(
  p: Pix,
  x: number,
  y: number,
  humps: readonly (readonly [number, number])[],
  light: Color,
  shade: Color,
): void {
  const layer = new Pix(p.w, p.h);
  for (const [ox, r] of humps) layer.disc(x + ox, y - r * 0.55, r, light);
  // Flatten the base and give it a shaded underside.
  layer.each(0, 0, p.w, p.h, (i, j, cur) => {
    if (cur === CLEAR) return KEEP;
    if (j > y) return CLEAR;
    return j === y || (j === y - 1 && (i + j) % 2 === 0) ? shade : KEEP;
  });
  p.blit(layer);
}

/** Colours of a pixel star: outline, gold face, highlight, shade. */
export interface StarColors {
  outline: Color;
  gold: Color;
  hi: Color;
  shade: Color;
}

/**
 * Hand-placed five-point stars (h = highlight, g = gold, s = shade), lit
 * from the upper left like everything else in the set. `starSprite` adds
 * the 1 px outline, so the drawn size is two pixels larger than the key.
 */
const STAR_ROWS: Readonly<Record<5 | 7 | 9, readonly string[]>> = {
  5: ["..h..", "..g..", "hgggs", ".ggs.", ".g.s."],
  7: ["...h...", "...g...", "hhggggs", ".hgggs.", "..ggs..", ".gg.ss.", ".g...s."],
  9: [
    "....h....",
    "...hgg...",
    "...hgg...",
    "hhhgggggs",
    ".hgggggs.",
    "..ggggs..",
    "..gggss..",
    ".ggg.sss.",
    ".gg...ss.",
  ],
};

/** Stamp an outlined star of the given face size centred on (cx, cy). */
export function starSprite(p: Pix, cx: number, cy: number, size: 5 | 7 | 9, c: StarColors): void {
  const rows = STAR_ROWS[size];
  const layer = new Pix(size + 2, rows.length + 2);
  layer.sprite(1, 1, rows, { h: c.hi, g: c.gold, s: c.shade });
  layer.outline(c.outline);
  p.blit(layer, Math.round(cx - (size + 2) / 2), Math.round(cy - (rows.length + 2) / 2));
}

/** A tiny four-armed sparkle. */
export function sparkle(p: Pix, x: number, y: number, core: Color, arm: Color): void {
  p.set(x, y, core);
  p.set(x - 1, y, arm);
  p.set(x + 1, y, arm);
  p.set(x, y - 1, arm);
  p.set(x, y + 1, arm);
}

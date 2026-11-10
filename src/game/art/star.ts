/**
 * The plain gold five-point star (deliberately no face), in the same pixel
 * style as the paintings and the emblem: flat gold, a bevel lit from the
 * upper left, a dark outline. Canvas-2D only.
 */
import { CLEAR, KEEP, Pix, cleanSize, rgbaToCanvas, starPoints, type Color } from "./pixel";

export const STAR_GOLD = {
  ink: 0x0a0f2c,
  hi: 0xfff0a0,
  gold: 0xffc93c,
  deep: 0xe08a00,
} as const;

/** Logical side length (pixels) of the standard star. */
export const STAR_GRID = 32;
/** Logical side length of the simplified star used below 32 px. */
export const STAR_GRID_SMALL = 16;

/**
 * Fill a five-point star and bevel it: pixels near an edge that faces the
 * light (upper left) become `hi`, pixels near an edge that faces away become
 * `deep`. `bevel` is the band width in pixels. Leaves the rest of the buffer
 * untouched and adds no outline.
 */
export function bevelStar(
  p: Pix,
  cx: number,
  cy: number,
  R: number,
  r: number,
  bevel: number,
  c: { hi: Color; gold: Color; deep: Color },
): void {
  const s = new Pix(p.w, p.h);
  s.poly(starPoints(cx, cy, R, r), c.gold);
  const inside = (x: number, y: number): boolean => s.get(x, y) !== CLEAR;
  const out = new Pix(p.w, p.h);
  out.blit(s);
  out.each(0, 0, p.w, p.h, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    for (let k = 1; k <= bevel; k++) {
      if (!inside(x + k, y + k) || !inside(x, y + k)) return c.deep;
    }
    for (let k = 1; k <= bevel; k++) {
      if (!inside(x - k, y - k) || !inside(x, y - k)) return c.hi;
    }
    return KEEP;
  });
  p.blit(out);
}

/** Hand-placed 12×11 star for the 16-pixel grid (h = highlight, g = gold, s = shade). */
const SMALL_STAR: readonly string[] = [
  ".....hg.....",
  ".....hg.....",
  "....hhgg....",
  "hhhhhggggggs",
  ".hgggggggss.",
  "..ggggggss..",
  "...ggggss...",
  "..ggggggss..",
  "..ggg..sss..",
  ".ggg....sss.",
  ".gg......ss.",
];

/**
 * Paint the star at logical resolution (transparent background). Pure.
 * `grid` 32 is the standard drawing; 16 is a simplified one for tiny icons,
 * where halving the big star would drop pixels from its outline.
 */
export function renderStar(grid: 16 | 32 = STAR_GRID): Pix {
  const p = new Pix(grid);
  if (grid === STAR_GRID_SMALL) {
    p.sprite(2, 2, SMALL_STAR, { h: STAR_GOLD.hi, g: STAR_GOLD.gold, s: STAR_GOLD.deep });
  } else {
    bevelStar(p, 16, 17.3, 14.6, 6.6, 2, STAR_GOLD);
    // a small glint on the upper-left facet
    p.rect(11, 12, 2, 1, STAR_GOLD.hi);
    p.rect(10, 13, 1, 2, STAR_GOLD.hi);
  }
  p.outline(STAR_GOLD.ink, true);
  return p;
}

const cache = new Map<number, Uint8ClampedArray>();

/**
 * A fresh square canvas (transparent background) with the gold star.
 * Multiples of 32 keep every logical pixel square; below 32 px a simpler
 * 16-pixel drawing is used (crisp at 16).
 */
export function createStarCanvas(size = 64): HTMLCanvasElement {
  const px = cleanSize(size, 64);
  const grid = px < STAR_GRID ? STAR_GRID_SMALL : STAR_GRID;
  let bytes = cache.get(grid);
  if (!bytes) {
    bytes = renderStar(grid).toRGBA();
    cache.set(grid, bytes);
  }
  return rgbaToCanvas(bytes, grid, grid, px);
}

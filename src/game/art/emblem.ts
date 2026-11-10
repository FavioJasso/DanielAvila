/**
 * Daniel's "DA" crest — original pixel art, drawn procedurally.
 *
 * A round seal: a bevelled gold ring around a navy field, chunky block
 * letters "DA" in gold with a hard extrusion, and a gold five-point star
 * crowning the ring. Everything carries a dark outline, so it reads on the
 * red carpet, on the brand-blue banners and on light UI alike. The
 * background is transparent.
 *
 * Drawn once on a 64×64 logical grid and scaled with exact nearest-neighbour
 * sampling (crisp at 64, 128, 256 …). Canvas-2D only — safe for the
 * first-paint bundle; nothing touches the DOM until `createEmblemCanvas` is
 * called.
 */
import type { CreateEmblemCanvas } from "../contract";
import { CLEAR, GRID, KEEP, Pix, cleanSize, rgbaToCanvas } from "./pixel";
import { bevelStar } from "./star";

export { createStarCanvas } from "./star";

const C = {
  ink: 0x0a0f2c,
  hi: 0xfff0a0,
  gold: 0xffc93c,
  deep: 0xe08a00,
  bronze: 0x9a5208,
  fieldD: 0x121a52,
  field: 0x1c2a78,
  fieldL: 0x2a3c9c,
} as const;

/** Block capitals, 13×18, 4 px strokes, chamfered corners. */
const LETTER_D: readonly string[] = [
  "##########...",
  "###########..",
  "############.",
  "#############",
  "####....#####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####....#####",
  "#############",
  "############.",
  "###########..",
  "##########...",
];
const LETTER_A: readonly string[] = [
  "...#######...",
  "..#########..",
  ".###########.",
  "#############",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "#############",
  "#############",
  "#############",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
  "####.....####",
];

/** Centre and radii of the seal. */
const CX = 32;
const CY = 36;
const R_OUTER = 26;
const R_FIELD = 20.5;

/** Paint the crest at logical resolution (transparent background). Pure. */
export function renderEmblem(): Pix {
  const p = new Pix(GRID);

  /* --- ring: a raised gold band lit from the upper left ----------- */
  p.disc(CX, CY, R_OUTER, C.gold);
  p.each(0, 0, GRID, GRID, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    const dx = x + 0.5 - CX;
    const dy = y + 0.5 - CY;
    const r = Math.hypot(dx, dy);
    const lit = -(dx * 0.6 + dy * 0.8) / Math.max(r, 0.001);
    if (r > R_OUTER - 1.6) return lit > 0.25 ? C.hi : lit < -0.25 ? C.deep : KEEP;
    if (r < R_FIELD + 2.6) return lit > 0.25 ? C.deep : lit < -0.25 ? C.hi : KEEP;
    return KEEP;
  });

  /* --- field ------------------------------------------------------- */
  p.disc(CX, CY, R_FIELD + 1, C.ink);
  // a coin: a darker channel inside the rim, a thin raised ring, a flat
  // navy face (no dithering here — the crest has to stay clean when small)
  p.disc(CX, CY, R_FIELD, C.fieldD);
  p.disc(CX, CY, 18.7, C.deep);
  p.disc(CX, CY, 17.25, C.field);
  // the upper lip of the face catches a little light
  p.each(CX - 18, CY - 18, 36, 12, (x, y, cur) => {
    if (cur !== C.field) return KEEP;
    const r = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    return r > 15.6 && y + 0.5 < CY - 9 ? C.fieldL : KEEP;
  });

  p.outline(C.ink, true);

  /* --- letters: gold face, lit top edges, hard extrusion ---------- */
  const face = new Pix(GRID);
  face.sprite(18, 26, LETTER_D, { "#": C.gold });
  face.sprite(33, 26, LETTER_A, { "#": C.gold });
  const letters = new Pix(GRID);
  letters.blit(face, 0, 2);
  letters.each(0, 0, GRID, GRID, (_x, _y, cur) => (cur === CLEAR ? KEEP : C.bronze));
  letters.blit(face, 0, 1);
  letters.each(0, 0, GRID, GRID, (_x, _y, cur) => (cur === C.gold ? C.deep : KEEP));
  letters.blit(face);
  letters.each(0, 0, GRID, GRID, (x, y, cur) => {
    if (cur !== C.gold || face.get(x, y) === CLEAR) return KEEP;
    if (face.get(x, y - 1) === CLEAR) return C.hi;
    return face.get(x - 1, y) === CLEAR && face.get(x, y - 2) !== CLEAR ? C.hi : KEEP;
  });
  letters.outline(C.ink, true);
  p.blit(letters);

  /* --- the star that crowns the ring ------------------------------- */
  const star = new Pix(GRID);
  bevelStar(star, CX, 9.4, 7.7, 3.6, 1, C);
  star.outline(C.ink, true);
  p.blit(star);

  return p;
}

let cache: Uint8ClampedArray | null = null;

/**
 * A fresh square canvas with the "DA" crest on a transparent background.
 * Display it with nearest-neighbour filtering; sizes that are a multiple of
 * 64 keep every logical pixel perfectly square.
 */
export const createEmblemCanvas: CreateEmblemCanvas = (size = 128) => {
  if (!cache) cache = renderEmblem().toRGBA();
  return rgbaToCanvas(cache, GRID, GRID, cleanSize(size, 128));
};

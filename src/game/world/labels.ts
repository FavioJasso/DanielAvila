/**
 * Label textures for the door signs and the pedestal signpost, drawn with an
 * original 5×7 bitmap face so they are identical on every device (no web-font
 * timing, no OS font differences) and stay crisp under nearest filtering.
 */

/** Rows top → bottom; "#" = ink. Glyphs may be narrower than 5 px. */
const GLYPHS: Record<string, readonly string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "&": [".##..", "#..#.", "#..#.", ".##..", "#.#.#", "#..#.", ".##.#"],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

const GLYPH_ROWS = 7;
const BLANK = GLYPHS[" "];

const glyphOf = (ch: string): readonly string[] => GLYPHS[ch.toUpperCase()] ?? BLANK;

/** Width in font pixels, including the 1 px gap between glyphs. */
export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += glyphOf(ch)[0].length + 1;
  return Math.max(0, w - 1);
}

/**
 * Stamp `text` with its top-left at (x, y); each font pixel becomes a
 * `scale`×`scale` block. `fill` may vary per glyph row (0 = top row).
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  fill: string | ((row: number) => string),
): void {
  let cx = x;
  for (const ch of text) {
    const g = glyphOf(ch);
    for (let row = 0; row < GLYPH_ROWS; row++) {
      ctx.fillStyle = typeof fill === "string" ? fill : fill(row);
      const line = g[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === "#") ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
      }
    }
    cx += (g[0].length + 1) * scale;
  }
}

/** Mix a "#rrggbb" colour towards white. */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Canvas pixels per font pixel on the door signs. */
const SIGN_SCALE = 2;
const SIGN_PAD_X = 12;
/** Every door sign canvas is this tall; its width follows the label. */
export const SIGN_HEIGHT_PX = 34;

/**
 * A door sign: navy panel, gold rim, the label in the door's accent colour
 * with a dark outline and a hard drop shadow. The canvas is exactly as wide
 * as the label needs, so every sign has the same letter size in the world.
 */
export function createSignCanvas(label: string, accent: string): HTMLCanvasElement {
  const tw = textWidth(label) * SIGN_SCALE;
  const W = tw + SIGN_PAD_X * 2;
  const H = SIGN_HEIGHT_PX;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // panel: night navy, a lighter band along the top like a lit bevel
  ctx.fillStyle = "#131b4d";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1d2a72";
  ctx.fillRect(0, 0, W, 9);
  ctx.fillStyle = "#0d133a";
  ctx.fillRect(0, H - 8, W, 8);
  // rim: gold with a deep-gold lower edge and an ink keyline inside it
  ctx.fillStyle = "#ffc93c";
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);
  ctx.fillStyle = "#e08a00";
  ctx.fillRect(0, H - 3, W, 3);
  ctx.fillRect(W - 1, 0, 1, H);
  ctx.fillStyle = "#fff0b0";
  ctx.fillRect(0, 0, W, 1);
  ctx.fillStyle = "#0a0f2c";
  ctx.fillRect(3, 3, W - 6, 1);
  ctx.fillRect(3, H - 4, W - 6, 1);
  ctx.fillRect(3, 3, 1, H - 6);
  ctx.fillRect(W - 4, 3, 1, H - 6);
  // corner studs
  ctx.fillStyle = "#ffc93c";
  for (const [sx, sy] of [
    [6, 6],
    [W - 8, 6],
    [6, H - 8],
    [W - 8, H - 8],
  ]) {
    ctx.fillRect(sx, sy, 2, 2);
  }

  const tx = SIGN_PAD_X;
  const ty = Math.round((H - GLYPH_ROWS * SIGN_SCALE) / 2);
  // hard drop shadow, then a one-pixel outline all round, then the face
  drawText(ctx, label, tx + 2, ty + 2, SIGN_SCALE, "#05081c");
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (ox !== 0 || oy !== 0) drawText(ctx, label, tx + ox, ty + oy, SIGN_SCALE, "#0a0f2c");
    }
  }
  const top = lighten(accent, 0.45);
  const mid = lighten(accent, 0.12);
  drawText(ctx, label, tx, ty, SIGN_SCALE, (row) => (row < 2 ? top : row < 5 ? mid : accent));
  return canvas;
}

/** Pedestal signpost canvas layout (pixels). */
export const POST_SIGN = {
  width: 84,
  /** Rows 0 … faceHeight-1 are the lettered board face. */
  faceHeight: 32,
  /** Rows below the face are plain wood for the post and the board's edges. */
  height: 44,
} as const;

/** Wooden board reading `text` in dark painted letters. */
export function createPostSignCanvas(text: string): HTMLCanvasElement {
  const { width: W, faceHeight: FH, height: H } = POST_SIGN;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // deterministic grain: a tiny LCG is plenty here
  let seed = 909;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < H; y++) {
    const plank = y < FH ? (y >> 4) & 1 : 2;
    const tone = plank === 0 ? 1.0 : plank === 1 ? 0.93 : 0.82;
    for (let x = 0; x < W; x++) {
      let k = tone * (0.94 + rnd() * 0.1);
      if (((x * 7 + plank * 13 + ((y / 3) | 0) * 5) % 19) < 2) k *= 0.9; // grain streak
      if (y < FH && (y & 15) === 15) k *= 0.7; // gap between the two planks
      if (y < FH && (y & 15) === 0) k *= 1.1;
      ctx.fillStyle = `rgb(${Math.round(190 * k)},${Math.round(132 * k)},${Math.round(74 * k)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // dark frame line round the face
  ctx.fillStyle = "#5a351a";
  ctx.fillRect(0, 0, W, 1);
  ctx.fillRect(0, FH - 1, W, 1);
  ctx.fillRect(0, 0, 1, FH);
  ctx.fillRect(W - 1, 0, 1, FH);
  // nails
  ctx.fillStyle = "#3b3b48";
  for (const [nx, ny] of [
    [3, 3],
    [W - 5, 3],
    [3, FH - 5],
    [W - 5, FH - 5],
  ]) {
    ctx.fillRect(nx, ny, 2, 2);
  }
  const scale = 2;
  const tx = Math.round((W - textWidth(text) * scale) / 2);
  const ty = Math.round((FH - GLYPH_ROWS * scale) / 2);
  drawText(ctx, text, tx + 1, ty + 1, scale, "#e2b072"); // carved highlight
  drawText(ctx, text, tx, ty, scale, "#3a2110");
  return canvas;
}

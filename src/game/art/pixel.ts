/**
 * Tiny pixel-art toolkit shared by the paintings, the emblem and the star.
 *
 * Everything is drawn into a `Pix` — a small indexed-by-position colour
 * buffer (default 64×64 logical pixels) — with hard-edged primitives and
 * ordered (Bayer) dithering, then blown up to the requested size with exact
 * nearest-neighbour sampling so every logical pixel stays a crisp square.
 *
 * Pure TypeScript on typed arrays: no three.js, no image files, no
 * dependencies. The only DOM access is inside `pixToCanvas`, at call time, so
 * importing this module is safe in the first-paint bundle and during SSR.
 *
 * Coordinates
 * - `set`, `rect`, `hline`, `vline`, `line`, `sprite` take integer pixel
 *   indices (pixel x covers the span [x, x + 1)).
 * - `disc`, `ellipse`, `ring`, `poly` take continuous coordinates and fill
 *   every pixel whose centre (x + 0.5, y + 0.5) is inside the shape, so a
 *   disc with an even diameter is centred on an integer and one with an odd
 *   diameter on a half.
 */

/** Packed 0xRRGGBB colour. */
export type Color = number;
/** A transparent pixel. */
export const CLEAR: Color = -1;
/** Returned from an `each` callback to leave the pixel untouched. */
export const KEEP: Color = -2;
/** Logical resolution shared by every painting and the emblem. */
export const GRID = 64;

/** 0xRRGGBB → "#rrggbb". */
export const hex = (c: Color): string => "#" + c.toString(16).padStart(6, "0");

/** Small, fast, well-distributed seeded PRNG (mulberry32). Returns 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in (0, 1) for a pixel. */
export const bayer = (x: number, y: number): number =>
  (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export type SpriteLegend = Readonly<Record<string, Color>>;

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly d: Int32Array;

  constructor(w: number = GRID, h: number = w, fill: Color = CLEAR) {
    this.w = w;
    this.h = h;
    this.d = new Int32Array(w * h).fill(fill);
  }

  /** Colour at a pixel, `CLEAR` outside the buffer. */
  get(x: number, y: number): Color {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? CLEAR : this.d[y * this.w + x];
  }

  set(x: number, y: number, c: Color): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) this.d[j * this.w + i] = c;
    }
  }

  hline(x: number, y: number, n: number, c: Color): void {
    this.rect(x, y, n, 1, c);
  }

  vline(x: number, y: number, n: number, c: Color): void {
    this.rect(x, y, 1, n, c);
  }

  /** Bresenham line between two pixels, both ends included. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Visit every pixel of a rectangle. The callback gets the pixel and its
   * current colour and returns the new colour, or `KEEP`.
   */
  each(
    x: number,
    y: number,
    w: number,
    h: number,
    fn: (x: number, y: number, cur: Color) => Color,
  ): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let j = y0; j < y1; j++) {
      for (let i = x0; i < x1; i++) {
        const k = j * this.w + i;
        const c = fn(i, j, this.d[k]);
        if (c !== KEEP) this.d[k] = c;
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): void {
    if (rx <= 0 || ry <= 0) return;
    this.each(
      Math.floor(cx - rx),
      Math.floor(cy - ry),
      Math.ceil(rx * 2) + 2,
      Math.ceil(ry * 2) + 2,
      (x, y) => {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        return dx * dx + dy * dy <= 1 ? c : KEEP;
      },
    );
  }

  disc(cx: number, cy: number, r: number, c: Color): void {
    this.ellipse(cx, cy, r, r, c);
  }

  /** Annulus: pixels with rInner < distance <= rOuter. */
  ring(cx: number, cy: number, rOuter: number, rInner: number, c: Color): void {
    const o2 = rOuter * rOuter;
    const i2 = rInner * rInner;
    this.each(
      Math.floor(cx - rOuter),
      Math.floor(cy - rOuter),
      Math.ceil(rOuter * 2) + 2,
      Math.ceil(rOuter * 2) + 2,
      (x, y) => {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const q = dx * dx + dy * dy;
        return q <= o2 && q > i2 ? c : KEEP;
      },
    );
  }

  /**
   * Even-odd scanline fill of a polygon given as a flat [x0, y0, x1, y1, …]
   * list in continuous coordinates.
   */
  poly(pts: readonly number[], c: Color): void {
    const n = pts.length >> 1;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, pts[i * 2 + 1]);
      maxY = Math.max(maxY, pts[i * 2 + 1]);
    }
    const y0 = Math.max(0, Math.ceil(minY - 0.5));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY - 0.5) - 1);
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ay = pts[i * 2 + 1];
        const by = pts[j * 2 + 1];
        if (ay <= yc === by <= yc) continue;
        const ax = pts[i * 2];
        const bx = pts[j * 2];
        xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
        const xb = Math.min(this.w, Math.ceil(xs[k + 1] - 0.5));
        for (let x = xa; x < xb; x++) this.d[y * this.w + x] = c;
      }
    }
  }

  /**
   * Ordered-dither a colour over whatever is already in the rectangle.
   * `amount` is the coverage 0..1 (a number, or a per-pixel function).
   * Transparent pixels stay transparent.
   */
  dither(
    x: number,
    y: number,
    w: number,
    h: number,
    c: Color,
    amount: number | ((x: number, y: number) => number),
  ): void {
    const fn = typeof amount === "number" ? () => amount : amount;
    this.each(x, y, w, h, (i, j, cur) =>
      cur !== CLEAR && fn(i, j) > bayer(i, j) ? c : KEEP,
    );
  }

  /**
   * Banded gradient with dithered seams. `value(x, y)` maps a pixel to a
   * position along `colors` (0 = first colour, colors.length - 1 = last).
   * Return `NaN` to leave a pixel untouched. `hard` narrows the dithered seam
   * between two neighbouring bands: 1 = dither everywhere (noisy), 3 = only
   * the middle third of each step.
   */
  grad(
    x: number,
    y: number,
    w: number,
    h: number,
    colors: readonly Color[],
    value: (x: number, y: number) => number,
    hard = 3,
  ): void {
    const last = colors.length - 1;
    this.each(x, y, w, h, (i, j) => {
      const raw = value(i, j);
      if (Number.isNaN(raw)) return KEEP;
      const v = Math.min(last, Math.max(0, raw));
      const lo = Math.min(last, Math.floor(v));
      const t = (v - lo - 0.5) * hard + 0.5;
      return t > bayer(i, j) && lo < last ? colors[lo + 1] : colors[lo];
    });
  }

  /**
   * Stamp a hand-drawn sprite. Each string is one row; each character is
   * looked up in `legend`; characters that are not in it are skipped.
   */
  sprite(x: number, y: number, rows: readonly string[], legend: SpriteLegend): void {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const c = legend[row[i]];
        if (c !== undefined) this.set(x + i, y + j, c);
      }
    }
  }

  /**
   * Draw a 1 px outline around everything opaque: every transparent pixel
   * that touches an opaque one (4-neighbours, or 8 with `corners`) is set.
   */
  outline(c: Color, corners = false): void {
    const src = this.d.slice();
    const at = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x] !== CLEAR;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== CLEAR) continue;
        const edge = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        const diag =
          corners &&
          (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1));
        if (edge || diag) this.d[y * this.w + x] = c;
      }
    }
  }

  /** Composite another buffer on top (its transparent pixels are skipped). */
  blit(src: Pix, dx = 0, dy = 0): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c !== CLEAR) this.set(x + dx, y + dy, c);
      }
    }
  }

  /** Swap colours inside a rectangle (used for cast shadows and reflections). */
  remap(
    x: number,
    y: number,
    w: number,
    h: number,
    map: ReadonlyMap<Color, Color>,
    where?: (x: number, y: number) => boolean,
  ): void {
    this.each(x, y, w, h, (i, j, cur) => {
      if (where && !where(i, j)) return KEEP;
      const to = map.get(cur);
      return to === undefined ? KEEP : to;
    });
  }

  /** 1 px frame around the whole buffer. */
  border(c: Color): void {
    this.hline(0, 0, this.w, c);
    this.hline(0, this.h - 1, this.w, c);
    this.vline(0, 0, this.h, c);
    this.vline(this.w - 1, 0, this.h, c);
  }

  /** Straight (non-premultiplied) RGBA bytes, row-major. */
  toRGBA(): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c === CLEAR) continue;
      const k = i * 4;
      out[k] = (c >> 16) & 255;
      out[k + 1] = (c >> 8) & 255;
      out[k + 2] = c & 255;
      out[k + 3] = 255;
    }
    return out;
  }
}

/**
 * Vertices of a five-point star as a flat list for `Pix.poly`: outer radius
 * `R`, inner radius `r`, one point straight up.
 */
export function starPoints(cx: number, cy: number, R: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return pts;
}

/**
 * Nearest-neighbour upscale of RGBA bytes (`w`×`h`) to `size`×`size`.
 * Done by hand rather than with `drawImage` so the result is exact and
 * identical in every browser.
 */
export function scaleRGBA(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  size: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
  const o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / size));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(w - 1, Math.floor(((x + 0.5) * w) / size));
      o32[y * size + x] = s32[sy * w + sx];
    }
  }
  return out;
}

/** Clamp a requested canvas size to something sane. */
export function cleanSize(size: number, fallback: number): number {
  return Number.isFinite(size) && size >= 1 ? Math.min(4096, Math.round(size)) : fallback;
}

/**
 * A fresh `size`×`size` canvas holding the RGBA bytes of a `w`×`h` logical
 * image, scaled with nearest-neighbour. Client only (needs `document`).
 */
export function rgbaToCanvas(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  size: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  image.data.set(size === w && size === h ? rgba : scaleRGBA(rgba, w, h, size));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

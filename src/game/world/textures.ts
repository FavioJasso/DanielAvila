/**
 * Procedural textures. Every surface texture is drawn pixel by pixel on a
 * 64×64 canvas (deterministic, no image files) and sampled with
 * nearest-neighbour filtering so texels stay crisp, cartridge style.
 *
 * Colours here are the "albedo"; all shading comes from baked vertex colours
 * (see lighting.ts), so the textures are kept bright and fairly low contrast
 * inside each block / tile — that also keeps nearest-filter shimmer down when
 * the far side of the room is minified.
 */
import * as THREE from "three";
import { clamp, lerp, mulberry32 } from "./util";

const S = 64;

/** RGBA pixel buffer with wrap-around writes (so motifs can cross the seam). */
class Raster {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  private offset(x: number, y: number): number {
    const xx = ((x % this.w) + this.w) % this.w;
    const yy = ((y % this.h) + this.h) % this.h;
    return (yy * this.w + xx) * 4;
  }
  set(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    const o = this.offset(x, y);
    this.data[o] = r;
    this.data[o + 1] = g;
    this.data[o + 2] = b;
    this.data[o + 3] = a;
  }
  /** Multiply the colour already at (x, y). */
  mul(x: number, y: number, k: number): void {
    const o = this.offset(x, y);
    this.data[o] *= k;
    this.data[o + 1] *= k;
    this.data[o + 2] *= k;
  }
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const img = ctx.createImageData(this.w, this.h);
      img.data.set(this.data);
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  }
}

/** Smooth value noise that tiles every `period` lattice cells. */
function periodicNoise(period: number, seed: number): (x: number, y: number) => number {
  const rnd = mulberry32(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (ix: number, iy: number) =>
    g[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)];
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return lerp(
      lerp(at(x0, y0), at(x0 + 1, y0), sx),
      lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx),
      sy,
    );
  };
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

/** Cream ashlar: four 16 px courses of 32 px blocks in running bond. */
function stoneCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(101);
  const blotch = periodicNoise(8, 7);
  const tone: number[] = [];
  const warm: number[] = [];
  for (let i = 0; i < 8; i++) {
    tone.push(0.93 + rnd() * 0.1);
    warm.push(rnd() - 0.5);
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const course = y >> 4;
      const xx = (x + (course & 1) * 16) & 63;
      const block = course * 2 + (xx >> 5);
      const lx = xx & 31;
      const ly = y & 15;
      if (lx === 0 || ly === 0) {
        R.set(x, y, 172, 158, 136); // mortar joint
        continue;
      }
      let k = tone[block] * (0.97 + blotch(x / 8, y / 8) * 0.06);
      if (ly === 1 || lx === 1) k *= 1.06; // lit top / left arris
      else if (ly === 15 || lx === 31) k *= 0.88; // shaded bottom / right arris
      else {
        const p = rnd();
        if (p < 0.05) k *= 0.93;
        else if (p < 0.08) k *= 1.04;
      }
      R.set(x, y, (230 + warm[block] * 10) * k, 218 * k, (194 - warm[block] * 12) * k);
    }
  }
  return R.toCanvas();
}

/** Dressed stone for trim, pillars and arches: two 32 px courses of long slabs. */
function slabCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(202);
  const blotch = periodicNoise(4, 19);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const course = y >> 5;
      const lx = (x + course * 32) & 63;
      const ly = y & 31;
      if (lx === 0 || ly === 0) {
        R.set(x, y, 170, 160, 144);
        continue;
      }
      let k = 0.96 + blotch(x / 16, y / 16) * 0.08;
      if (ly === 1) k *= 1.07;
      else if (ly === 31) k *= 0.86;
      else if (lx === 1) k *= 1.04;
      else if (lx === 63) k *= 0.9;
      else if (rnd() < 0.04) k *= 0.94;
      R.set(x, y, 222 * k, 212 * k, 194 * k);
    }
  }
  // chisel marks: short diagonal nicks
  for (let i = 0; i < 26; i++) {
    const cx = 3 + Math.floor(rnd() * 58);
    const cy = 3 + Math.floor(rnd() * 26) + (i & 1) * 32;
    for (let j = 0; j < 3; j++) R.mul(cx + j, cy + j, 0.9);
  }
  return R.toCanvas();
}

/** Warm cream plaster with soft mottling. */
function plasterCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(303);
  const blotch = periodicNoise(4, 31);
  const fine = periodicNoise(16, 37);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let k = 0.95 + blotch(x / 16, y / 16) * 0.06 + fine(x / 4, y / 4) * 0.03;
      const p = rnd();
      if (p < 0.03) k -= 0.02;
      else if (p < 0.055) k += 0.015;
      R.set(x, y, 246 * k, 235 * k, 210 * k);
    }
  }
  // a few faint trowel streaks
  for (let i = 0; i < 7; i++) {
    const sy = Math.floor(rnd() * S);
    const sx = Math.floor(rnd() * S);
    const len = 6 + Math.floor(rnd() * 12);
    for (let j = 0; j < len; j++) R.mul(sx + j, sy + ((j / 7) | 0), 0.965);
  }
  return R.toCanvas();
}

/**
 * Vertical planks (16 px each) with one riveted iron band per tile
 * (rows 20–29). Doors map the tile 1.3 m wide × 1.2 m tall; band-free props
 * keep their V range clear of the band rows.
 */
function woodCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(404);
  const grain = periodicNoise(16, 41);
  const plankTone = [1.0, 0.89, 1.07, 0.95];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const plank = x >> 4;
      const lx = x & 15;
      // long vertical streaks: stretch the noise along Y
      let k = plankTone[plank] * (0.9 + grain(x / 2 + plank * 5, y / 16) * 0.2);
      if (lx === 0) k *= 1.12;
      else if (lx === 15) k *= 0.58;
      else if (rnd() < 0.05) k *= 0.9;
      R.set(x, y, 158 * k, 99 * k, 52 * k);
    }
  }
  // knots
  const knots: [number, number][] = [
    [6, 50],
    [39, 8],
    [54, 44],
  ];
  for (const [kx, ky] of knots) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const d = Math.abs(dx) + Math.abs(dy) * 0.6;
        if (d < 1.9) R.mul(kx + dx, ky + dy, d < 0.7 ? 0.6 : 0.8);
      }
    }
  }
  // iron band with rivets
  for (let x = 0; x < S; x++) {
    for (let y = 20; y <= 29; y++) {
      const edge = y === 20 ? 1.55 : y === 29 ? 0.55 : y === 21 ? 1.15 : 1;
      const n = 0.95 + rnd() * 0.1;
      R.set(x, y, 66 * edge * n, 68 * edge * n, 82 * edge * n);
    }
    R.mul(x, 30, 0.66); // band's shadow on the wood
    R.mul(x, 31, 0.86);
  }
  for (let px = 7; px < S; px += 16) {
    R.set(px, 24, 168, 172, 188);
    R.set(px + 1, 24, 126, 130, 146);
    R.set(px, 25, 126, 130, 146);
    R.set(px + 1, 25, 34, 34, 44);
  }
  return R.toCanvas();
}

/** 2×2 marble tiles: ivory and charcoal, soft veins, bevelled edges. */
function checkerCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(505);
  const vein = periodicNoise(8, 53);
  const blotch = periodicNoise(4, 59);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const light = (((x >> 5) + (y >> 5)) & 1) === 0;
      const lx = x & 31;
      const ly = y & 31;
      const v = vein(x / 8 + 0.37, y / 8 + 0.11);
      const veined = Math.abs(v - 0.5) < 0.028;
      let k = 0.97 + blotch(x / 16, y / 16) * 0.06;
      const edge = lx === 0 || ly === 0 || lx === 31 || ly === 31;
      if (light) {
        if (veined) k *= 0.9;
        if (edge) k *= 0.88;
        else if (rnd() < 0.03) k *= 0.96;
        R.set(x, y, 240 * k, 233 * k, 216 * k);
      } else {
        if (veined) k *= 1.45;
        if (edge) k *= 1.35;
        else if (rnd() < 0.03) k *= 1.15;
        R.set(x, y, 44 * k, 44 * k, 60 * k);
      }
    }
  }
  return R.toCanvas();
}

/** Red carpet: diagonal twill with a small diamond repeat. */
function carpetCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const blotch = periodicNoise(4, 61);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let k = 0.95 + blotch(x / 16, y / 16) * 0.08;
      if (((x + y) & 3) === 0) k *= 1.1;
      else if (((x - y) & 3) === 2) k *= 0.9;
      const dx = Math.abs((x & 15) - 8);
      const dy = Math.abs((y & 15) - 8);
      if (dx + dy <= 2) k *= dx + dy === 2 ? 0.82 : 1.28;
      R.set(x, y, 190 * k, 36 * k, 46 * k);
    }
  }
  return R.toCanvas();
}

/** Polished gold: diagonal bands of highlight and shade with a little dither. */
function goldCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(707);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const s = ((x + y * 2) & 31) / 32;
      const dither = ((x ^ y) & 1) === 0;
      let r = 250;
      let g = 194;
      let b = 52;
      if (s < 0.08 || (s < 0.14 && dither)) {
        r = 255;
        g = 240;
        b = 156;
      } else if (s > 0.62 && (s < 0.8 || dither)) {
        r = 222;
        g = 150;
        b = 26;
      }
      const k = 0.97 + rnd() * 0.06;
      R.set(x, y, r * k, g * k, b * k);
    }
  }
  return R.toCanvas();
}

/** Painted sky: flat blue with chunky two-tone clouds. Tiles in both axes. */
function skyCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const n1 = periodicNoise(4, 71);
  const n2 = periodicNoise(8, 73);
  const n3 = periodicNoise(16, 79);
  const T = 0.54;
  const wrap = (v: number) => ((v % S) + S) % S;
  const field = new Float32Array(S * S);
  const cloud = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = n1(x / 16, y / 16) * 0.58 + n2(x / 8, y / 8) * 0.3 + n3(x / 4, y / 4) * 0.12;
      field[y * S + x] = n;
      cloud[y * S + x] = n > T ? 1 : 0;
    }
  }
  // tidy the silhouette: fill small holes inside clouds, drop stray wisps
  // (flood-fill each connected patch and flip the ones below a minimum size)
  const flipSmall = (value: number, minSize: number) => {
    const seen = new Uint8Array(S * S);
    const steps = [1, 0, -1, 0, 0, 1, 0, -1];
    for (let start = 0; start < S * S; start++) {
      if (seen[start] || cloud[start] !== value) continue;
      const patch = [start];
      seen[start] = 1;
      for (let head = 0; head < patch.length; head++) {
        const x = patch[head] % S;
        const y = (patch[head] / S) | 0;
        for (let k = 0; k < 8; k += 2) {
          const j = wrap(y + steps[k + 1]) * S + wrap(x + steps[k]);
          if (!seen[j] && cloud[j] === value) {
            seen[j] = 1;
            patch.push(j);
          }
        }
      }
      if (patch.length < minSize) for (const i of patch) cloud[i] = 1 - value;
    }
  };
  flipSmall(0, 40);
  flipSmall(1, 16);
  const isCloud = (x: number, y: number) => cloud[wrap(y) * S + wrap(x)] === 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = field[y * S + x];
      if (isCloud(x, y)) {
        // shade the side of each cloud that faces +Y (its "underside")
        const under = !isCloud(x, y + 2) || !isCloud(x, y + 3);
        if (under) R.set(x, y, 190, 214, 246);
        else if (n > T + 0.07) R.set(x, y, 255, 255, 255);
        else R.set(x, y, 232, 242, 255);
      } else if (
        isCloud(x + 1, y) ||
        isCloud(x - 1, y) ||
        isCloud(x, y + 1) ||
        isCloud(x, y - 1) ||
        isCloud(x + 2, y) ||
        isCloud(x - 2, y) ||
        isCloud(x, y - 2)
      ) {
        R.set(x, y, 138, 196, 255); // soft halo
      } else {
        const k = 0.97 + n2(x / 8 + 3, y / 8 + 5) * 0.06;
        R.set(x, y, 92 * k, 164 * k, 255);
      }
    }
  }
  return R.toCanvas();
}

/** Brand-blue banner cloth (#3970EB): soft folds, gold selvedge left and right. */
function bannerCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (x < 3 || x > 60) {
        const k = ((x + y) & 3) === 0 ? 1.08 : 0.98;
        R.set(x, y, 246 * k, 196 * k, 64 * k);
        continue;
      }
      if (x === 3 || x === 60) {
        R.set(x, y, 26, 54, 140);
        continue;
      }
      let k = 0.94 + 0.1 * Math.sin((x / S) * Math.PI * 6 + 0.8);
      if (((x + y) & 1) === 0) k *= 0.97;
      if ((y & 7) === 0) k *= 0.96;
      R.set(x, y, clamp(57 * k, 0, 255), clamp(112 * k, 0, 255), clamp(235 * k, 0, 255));
    }
  }
  return R.toCanvas();
}

/** Is (px, py) inside a five-point star centred on (cx, cy)? */
function inStar(px: number, py: number, cx: number, cy: number, outer: number, inner: number): boolean {
  let inside = false;
  let jx = 0;
  let jy = 0;
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5; // first point straight up (canvas y grows downward)
    const ix = cx + Math.cos(a) * r;
    const iy = cy + Math.sin(a) * r;
    if (i > 0 && iy > py !== jy > py && px < ((jx - ix) * (py - iy)) / (jy - iy) + ix) inside = !inside;
    jx = ix;
    jy = iy;
  }
  return inside;
}

/**
 * Painted frieze: a royal-blue band between gold borders, one gold star per
 * tile with a small diamond on the seam between tiles.
 */
function friezeCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const star = (x: number, y: number) => inStar(x + 0.5, y + 0.5, 32, 33, 15.5, 6.6);
  const diamond = (x: number, y: number) => {
    const dx = Math.min(x, S - x); // centred on the tile seam
    return dx + Math.abs(y - 32) <= 5;
  };
  const motif = (x: number, y: number) => star(x, y) || diamond(x, y);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (y < 4 || y > 59) {
        // gold borders: highlight on the upper edge, deep gold on the lower
        const edge = y < 4 ? y : y - 60;
        if (edge === 0) R.set(x, y, 255, 236, 150);
        else if (edge === 3) R.set(x, y, 206, 136, 22);
        else R.set(x, y, 248, ((x + y) & 3) === 0 ? 210 : 198, 62);
        continue;
      }
      if (motif(x, y)) {
        // lit from the upper left
        const lit = star(x, y) ? x - 32 + (y - 33) : Math.min(x, S - x) * (x < 32 ? 1 : -1) + (y - 32);
        if (lit < -7) R.set(x, y, 255, 238, 150);
        else if (lit > 8) R.set(x, y, 226, 150, 30);
        else R.set(x, y, 255, 204, 60);
        continue;
      }
      // dark keyline round each motif so the gold pops off the blue
      const keyline = motif(x + 1, y) || motif(x - 1, y) || motif(x, y + 1) || motif(x, y - 1);
      if (keyline) {
        R.set(x, y, 20, 42, 122);
        continue;
      }
      let k = ((x + y) & 1) === 0 ? 1 : 0.955;
      if (y < 7 || y > 56) k *= 0.78; // shadow under the borders
      R.set(x, y, 46 * k, 92 * k, 212 * k);
    }
  }
  return R.toCanvas();
}

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

/** 2×2 sheet of 32 px pixel-art flame frames (cut-out alpha). */
function flameCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  const rnd = mulberry32(808);
  for (let frame = 0; frame < 4; frame++) {
    const ox = (frame & 1) * 32;
    const oy = (frame >> 1) * 32;
    const lean = (rnd() - 0.5) * 7;
    const wob = rnd() * Math.PI * 2;
    const tall = 0.86 + rnd() * 0.14;
    for (let py = 0; py < 32; py++) {
      // t = 0 at the base of the flame, 1 at the tip
      const t = (31 - py) / (31 * tall);
      if (t > 1) continue;
      const cx = 15.5 + lean * t * t + Math.sin(t * 7 + wob) * 1.6 * t;
      const half = 9.5 * Math.pow(1 - t, 0.85) * Math.min(1, 0.45 + t * 5);
      for (let px = 0; px < 32; px++) {
        const d = Math.abs(px - cx) / Math.max(half, 0.001);
        if (d > 1) continue;
        const heat = (1 - d) * (1 - t * 0.9);
        let r = 226;
        let g = 74;
        let b = 26;
        if (heat > 0.58) {
          r = 255;
          g = 246;
          b = 178;
        } else if (heat > 0.36) {
          r = 255;
          g = 200;
          b = 48;
        } else if (heat > 0.16) {
          r = 250;
          g = 134;
          b = 26;
        }
        R.set(ox + px, oy + py, r, g, b, 255);
      }
    }
    // a couple of loose embers above the tip
    for (let i = 0; i < 2; i++) {
      const ex = 10 + Math.floor(rnd() * 12);
      const ey = 1 + Math.floor(rnd() * 5);
      R.set(ox + ex, oy + ey, 255, 170, 40, 255);
    }
  }
  return R.toCanvas();
}

/**
 * Opacity masks for the wall glows. It is the one texture sampled with linear
 * filtering: a mask, not a surface.
 *  - red:   soft radial falloff (torch light, star shine)
 *  - green: rounded-rectangle halo that stays full up to the picture frame's
 *           outline and fades out by the alcove walls, so the light visibly
 *           spills round the frame instead of hiding behind the canvas
 */
const HALO_RECT = { halfU: 0.7, halfV: 0.64, fade: 0.32 } as const;

function glowCanvas(): HTMLCanvasElement {
  const R = new Raster(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x - 31.5) / 31.5;
      const ny = (y - 31.5) / 31.5;
      const d = Math.hypot(nx, ny);
      const radial = Math.pow(clamp(1 - d, 0, 1), 1.15) * 255;
      const ox = Math.max(0, Math.abs(nx) - HALO_RECT.halfU);
      const oy = Math.max(0, Math.abs(ny) - HALO_RECT.halfV);
      const rect = Math.pow(clamp(1 - Math.hypot(ox, oy) / HALO_RECT.fade, 0, 1), 1.6) * 255;
      R.set(x, y, radial, rect, 0, 255);
    }
  }
  return R.toCanvas();
}

/** Four-point twinkle: cream core, gold arms tapering to amber tips (cut-out alpha). */
function sparkleCanvas(): HTMLCanvasElement {
  const N = 16;
  const R = new Raster(N, N);
  for (let y = 1; y < N; y++) {
    for (let x = 1; x < N; x++) {
      const dx = Math.abs(x - 8);
      const dy = Math.abs(y - 8);
      // hyperbolic outline: long thin arms on the axes, a small full centre
      if (dx * dy >= 3.6) continue;
      const r = Math.max(dx, dy);
      if (r <= 1) R.set(x, y, 255, 255, 236);
      else if (r <= 4) R.set(x, y, 255, 222, 76);
      else R.set(x, y, 246, 164, 30);
    }
  }
  return R.toCanvas();
}

/* ------------------------------------------------------------------ */
/* Texture set                                                         */
/* ------------------------------------------------------------------ */

/**
 * Wrap a canvas as a nearest-filtered texture. Colour textures are sRGB;
 * pass `data = true` for masks that should be read as stored.
 */
export function pixelTexture(canvas: HTMLCanvasElement, repeat = true, data = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  return t;
}

function softMask(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = pixelTexture(canvas, false, true);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  return t;
}

export interface TextureSet {
  stone: THREE.CanvasTexture;
  slab: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  frieze: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  checker: THREE.CanvasTexture;
  carpet: THREE.CanvasTexture;
  gold: THREE.CanvasTexture;
  sky: THREE.CanvasTexture;
  banner: THREE.CanvasTexture;
  flame: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  sparkle: THREE.CanvasTexture;
}

export function createTextures(): TextureSet {
  return {
    stone: pixelTexture(stoneCanvas()),
    slab: pixelTexture(slabCanvas()),
    plaster: pixelTexture(plasterCanvas()),
    frieze: pixelTexture(friezeCanvas()),
    wood: pixelTexture(woodCanvas()),
    checker: pixelTexture(checkerCanvas()),
    carpet: pixelTexture(carpetCanvas()),
    gold: pixelTexture(goldCanvas()),
    sky: pixelTexture(skyCanvas()),
    banner: pixelTexture(bannerCanvas()),
    flame: pixelTexture(flameCanvas(), false),
    glow: softMask(glowCanvas()),
    sparkle: pixelTexture(sparkleCanvas(), false),
  };
}

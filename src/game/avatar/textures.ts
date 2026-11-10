/**
 * Daniel 64 — canvas textures, drawn pixel by pixel in code.
 *
 * - face (64×64, two frames: eyes open / eyes closed)
 * - blazer front (64×64: shirt, collar, lapels, buttons, pockets)
 * - effects atlas (64×64, four 32×32 cells: dust puff, "Z", sparkle, glint)
 *
 * Canvas x runs to the avatar's left (it is drawn as you see him from the
 * front), canvas y runs down. Everything is exaggerated on purpose: in the
 * game the whole head is only ~25 screen pixels tall.
 */
import * as THREE from "three";
import { PAL } from "./palette";

const SIZE = 64;

class Pix {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("avatar: 2D canvas is unavailable");
    this.ctx = ctx;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  px(x: number, y: number, color: string): void {
    this.rect(x, y, 1, 1, color);
  }
  /** A pixel and its mirror image about the vertical centre line. */
  sym(x: number, y: number, color: string): void {
    this.px(x, y, color);
    this.px(SIZE - 1 - x, y, color);
  }
  /** Filled ellipse, pixel-exact. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color);
      }
    }
  }
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/* ------------------------------------------------------------------ */
/* Face                                                                */
/* ------------------------------------------------------------------ */

const MID = (SIZE - 1) / 2; // 31.5

/**
 * Painted hair: swept back off the forehead (as in his photo), the hairline
 * curving down into the temples, and the hair hugging both edges of the face.
 */
function isHair(x: number, y: number): boolean {
  const dx = Math.abs(x - MID);
  const hairline = 3 + Math.round(8 * Math.pow(Math.max(0, (dx - 11) / 17), 1.4));
  if (y <= hairline && y <= 10) return true;
  const side = y < 11 ? 0 : y < 34 ? 8 - (y - 11) * 0.17 : 4;
  return dx > MID - side;
}

function paintFace(eyesClosed: boolean): HTMLCanvasElement {
  const p = new Pix();
  p.rect(0, 0, SIZE, SIZE, PAL.skin);

  // soft shading: the sides of the face and the taper of the jaw
  for (let y = 0; y < SIZE; y++) {
    const edge = 26 - Math.max(0, y - 44) * 0.5;
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.abs(x - MID);
      if (dx > edge) p.px(x, y, PAL.skinShade);
    }
  }
  // forehead light, cheeks
  p.ellipse(MID, 10.5, 9, 3.5, PAL.skinHi);
  p.ellipse(12.5, 35.5, 4.2, 2.6, PAL.blush);
  p.ellipse(SIZE - 1 - 12.5, 35.5, 4.2, 2.6, PAL.blush);

  // hair
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isHair(x, y)) continue;
      const strand = (x + (y >> 1)) % 9 === 0;
      p.px(x, y, strand ? PAL.hairHi : PAL.hair);
    }
  }

  // brows: thick, gently arched, outer ends a touch lower (calm, not stern);
  // kept well clear of the eyes so the two do not merge at game resolution
  for (let i = 0; i < 14; i++) {
    const x = 27 - i;
    const top = i < 2 ? 16 : i < 9 ? 15 : i < 12 ? 16 : 17;
    const thick = i < 10 ? 3 : 2;
    for (let k = 0; k < thick; k++) p.sym(x, top + k, PAL.hairDark);
  }

  // eyes, drawn for the left of the canvas and mirrored. Big and simple:
  // white | iris | white under a flat upper lid that hides the top of the
  // iris, so he looks relaxed rather than startled.
  if (!eyesClosed) {
    for (let y = 23; y <= 30; y++) {
      const inset = y === 30 ? 3 : y === 29 ? 1 : 0;
      for (let x = 14 + inset; x <= 25 - inset; x++) p.sym(x, y, PAL.eyeWhite);
      const irisInset = y === 30 ? 1 : 0;
      for (let x = 17 + irisInset; x <= 22 - irisInset; x++) p.sym(x, y, PAL.iris);
    }
    for (let y = 25; y <= 28; y++) for (let x = 18; x <= 21; x++) p.sym(x, y, PAL.pupil);
    // catch-lights on the same side of both eyes
    p.rect(18, 24, 2, 2, PAL.eyeWhite);
    p.rect(42, 24, 2, 2, PAL.eyeWhite);
    // upper lid, with a tick at each corner
    for (let x = 13; x <= 26; x++) p.sym(x, 22, PAL.hairDark);
    p.sym(13, 23, PAL.hairDark);
    p.sym(26, 23, PAL.hairDark);
    p.sym(12, 21, PAL.hairDark);
  } else {
    // closed: a relaxed downward arc with a shaded lid above it
    for (let x = 14; x <= 25; x++) {
      const d = Math.abs(x - 19.5);
      const y = 28 - (d > 3.2 ? 1 : 0) - (d > 5 ? 1 : 0);
      p.sym(x, y - 2, PAL.skinShade);
      p.sym(x, y, PAL.hairDark);
      p.sym(x, y + 1, PAL.hairDark);
    }
  }

  // nose: mostly geometry; the texture adds the shaded side and nostrils
  p.rect(34, 29, 2, 8, PAL.skinShade);
  p.rect(28, 38, 2, 2, PAL.skinDark);
  p.rect(34, 38, 2, 2, PAL.skinDark);
  p.rect(29, 40, 6, 1, PAL.skinShade);

  // moustache: a trim band along the upper lip (as in his photo), the ends
  // turning down a touch, thinner under the nose
  for (let x = 20; x <= 43; x++) {
    const d = Math.abs(x - MID);
    const top = 42 + (d < 1 ? 1 : 0) + (d > 7 ? 1 : 0) + (d > 10 ? 1 : 0);
    const thick = d < 1 ? 2 : d > 10 ? 2 : 3;
    for (let k = 0; k < thick; k++) {
      p.px(x, top + k, k === 0 && x % 3 === 0 ? PAL.hairHi : PAL.hair);
    }
  }

  // mouth: short, friendly, corners up
  p.rect(27, 48, 10, 1, PAL.mouth);
  p.sym(26, 47, PAL.mouth);
  p.rect(28, 49, 8, 2, PAL.lip);

  // light chin beard: stubble dither, denser on the chin itself
  for (let y = 51; y < SIZE; y++) {
    for (let x = 12; x <= 51; x++) {
      const ax = (x - MID) / 11.5;
      const ay = (y - 57.5) / 6;
      if (ax * ax + ay * ay > 1) continue;
      const bx = (x - MID) / 7;
      const by = (y - 58.5) / 4;
      const dense = bx * bx + by * by <= 1;
      if (dense) p.px(x, y, (x + y) % 2 === 0 || x % 2 === 0 ? PAL.beardDark : PAL.beard);
      else if ((x + y) % 2 === 0) p.px(x, y, PAL.beard);
    }
  }
  p.rect(30, 51, 4, 2, PAL.beardDark); // soul patch

  return p.canvas;
}

/* ------------------------------------------------------------------ */
/* Blazer front                                                        */
/* ------------------------------------------------------------------ */

function paintBlazer(): HTMLCanvasElement {
  const p = new Pix();
  p.rect(0, 0, SIZE, SIZE, PAL.navy);

  const V_END = 31; // row where the lapels meet
  const halfV = (y: number): number => 10.5 * (1 - y / V_END) + 0.5;

  for (let y = 0; y < V_END; y++) {
    const h = halfV(y);
    const lapel = 7 - y * 0.13;
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.abs(x - MID);
      if (dx <= h) {
        // shirt, with a white collar along the top of the V
        const collar = y < 9 && dx > h - (5 - y * 0.45);
        p.px(x, y, collar ? PAL.shirtWhite : PAL.shirt);
      } else if (dx <= h + lapel) {
        // lapel: lighter navy, dark seam on its outer edge
        p.px(x, y, dx > h + lapel - 1 ? PAL.navyDark : PAL.navyHi);
      }
    }
  }
  // placket and shirt buttons
  p.rect(31, 6, 2, V_END - 9, PAL.shirtShade);
  p.rect(31, 11, 2, 2, PAL.shirtWhite);
  p.rect(31, 19, 2, 2, PAL.shirtWhite);
  // collar shadow under the chin
  p.rect(29, 0, 6, 3, PAL.shirtShade);
  // lapel notches
  for (let i = 0; i < 5; i++) {
    p.sym(Math.round(MID - halfV(10) - 2 - i), 10 + (i >> 1), PAL.navyDark);
  }

  // front closure, gold buttons
  p.rect(32, V_END, 1, SIZE - V_END, PAL.navyDark);
  p.rect(31, V_END, 1, SIZE - V_END - 6, PAL.navyHi);
  for (const y of [36, 45]) {
    p.rect(28, y, 3, 3, PAL.gold);
    p.px(30, y + 2, PAL.navyDark);
    p.px(28, y, PAL.shirtWhite);
  }
  // the hem parts at the bottom
  for (let y = 57; y < SIZE; y++) {
    const w = Math.round((y - 56) * 0.7);
    p.rect(32 - w, y, w * 2 + 1, 1, PAL.navyDark);
  }

  // chest pocket with a brand-blue pocket square (on his left = canvas right)
  p.rect(43, 22, 10, 1, PAL.navyHi);
  p.rect(43, 23, 10, 1, PAL.navyDark);
  p.rect(46, 19, 4, 3, PAL.brand);
  p.px(47, 18, PAL.brand);
  // hip pocket flaps
  for (const x of [6, 44]) {
    p.rect(x, 47, 14, 1, PAL.navyHi);
    p.rect(x, 48, 14, 1, PAL.navyDark);
  }
  return p.canvas;
}

/* ------------------------------------------------------------------ */
/* Effects atlas                                                       */
/* ------------------------------------------------------------------ */

/** Cell indices in the effects atlas (2×2 cells, row 0 = top of the canvas). */
export const FX_CELL = { dust: 0, z: 1, sparkle: 2, glint: 3 } as const;

const Z_GLYPH = [
  "..............",
  ".############.",
  ".############.",
  ".############.",
  "........####..",
  ".......####...",
  "......####....",
  ".....####.....",
  "....####......",
  "...####.......",
  "..####........",
  ".############.",
  ".############.",
  ".############.",
];

function paintEffects(): HTMLCanvasElement {
  const p = new Pix();
  // every cell is drawn on a 16×16 grid of 2×2 texel blocks: chunky on purpose
  const block = (cell: number, x: number, y: number, color: string): void => {
    const ox = (cell % 2) * 32;
    const oy = Math.floor(cell / 2) * 32;
    p.rect(ox + x * 2, oy + y * 2, 2, 2, color);
  };

  // dust puff: a lumpy white cloud with a grey underside
  const lumps = [
    [8, 9, 5.6],
    [4.4, 10, 3.6],
    [11.6, 10.4, 3.6],
    [6.6, 5.6, 3.8],
    [10.4, 6.4, 3],
  ];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const inside = lumps.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      if (inside) block(FX_CELL.dust, x, y, y > 11 ? "#cfc8bd" : y > 9 ? "#ece7df" : "#ffffff");
    }
  }

  // "Z": white with a navy outline so it reads against light walls
  const filled = (x: number, y: number): boolean => Z_GLYPH[y - 1]?.[x - 1] === "#";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (filled(x, y)) {
        block(FX_CELL.z, x, y, "#ffffff");
        continue;
      }
      let edge = false;
      for (let j = -1; j <= 1 && !edge; j++) {
        for (let i = -1; i <= 1; i++) {
          if (filled(x + i, y + j)) {
            edge = true;
            break;
          }
        }
      }
      if (edge) block(FX_CELL.z, x, y, PAL.navy);
    }
  }

  // sparkle: a four-point star; glint: a small diamond
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7.5);
      const dy = Math.abs(y - 7.5);
      if (dx * dy < 2.6 && dx + dy < 8.6) {
        block(FX_CELL.sparkle, x, y, dx + dy < 2.6 ? "#fffbe6" : dx + dy < 5 ? "#ffe066" : "#f5b921");
      }
      if (dx + dy < 3.6) block(FX_CELL.glint, x, y, dx + dy < 1.6 ? "#ffffff" : "#ffe680");
    }
  }
  return p.canvas;
}

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

export interface AvatarTextures {
  faceOpen: THREE.CanvasTexture;
  faceClosed: THREE.CanvasTexture;
  blazer: THREE.CanvasTexture;
  effects: THREE.CanvasTexture;
}

export function buildTextures(): AvatarTextures {
  return {
    faceOpen: toTexture(paintFace(false)),
    faceClosed: toTexture(paintFace(true)),
    blazer: toTexture(paintBlazer()),
    effects: toTexture(paintEffects()),
  };
}

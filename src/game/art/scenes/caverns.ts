/**
 * Course 2 — "Deep Rack Caverns": an underground cavern lined with server
 * racks that recede towards a teal glow, cables slung between them, and two
 * chunky terminals in the foreground. Near-black rock with luminous green
 * and teal accents.
 */
import { CLEAR, KEEP, Pix, mulberry32, type Color } from "../pixel";

const C = {
  ink: 0x03080d,
  rock0: 0x08151c,
  rock1: 0x0f2530,
  rock2: 0x1b3d48,
  rock3: 0x3a787a,
  haze0: 0x0f4248,
  haze1: 0x187264,
  haze2: 0x2fae8e,
  core: 0x96f2c8,
  rackD: 0x0a121b,
  rack: 0x1a2a38,
  rackL: 0x3a566a,
  greenDD: 0x0b4a30,
  greenD: 0x1f9e58,
  green: 0x58f58c,
  teal: 0x35d6a4,
  white: 0xd8fff0,
  amber: 0xffc24a,
  red: 0xff5a4a,
  caseD: 0x33474f,
  case: 0x5f7c84,
  caseL: 0x9cbcbc,
} as const;

export const CAVERNS_PALETTE: readonly Color[] = [C.ink, C.rock1, C.rock3, C.teal, C.green];

/** Vanishing point of the rack aisle; the glow sits just above it. */
const VX = 32;
const VY = 30;
const GLOW_Y = 23;

/** The colours of the far glow — anything drawn over them is a silhouette. */
const isGlow = (c: Color): boolean =>
  c === C.white || c === C.core || c === C.haze2 || c === C.haze1 || c === C.haze0;

/** A rack cabinet: front face with unit rows and status lights. */
function rack(p: Pix, rnd: () => number, x: number, y: number, w: number, h: number): void {
  const r = new Pix();
  r.rect(x, y, w, h, C.rackD);
  r.hline(x, y, w, C.rackL);
  r.vline(x, y + 1, h - 1, C.rack);
  r.vline(x + w - 1, y + 1, h - 1, C.rack);
  const inner = w - 2;
  for (let uy = y + 2; uy < y + h - 1; uy += 3) {
    if (uy + 2 < y + h) r.hline(x + 1, uy + 2, inner, C.rack);
    if (inner < 3) {
      // far-away cabinet: one light per unit
      r.set(x + 1 + (((uy - y) / 3) & 1) * (inner - 1), uy, rnd() < 0.7 ? C.green : C.teal);
      continue;
    }
    // status light, then a short run of activity lights
    const roll = rnd();
    r.set(x + 2, uy, roll < 0.72 ? C.green : roll < 0.9 ? C.amber : C.red);
    for (let i = 4; i < inner; i += 2) {
      const a = rnd();
      if (a < 0.4) r.set(x + i, uy, C.teal);
      else if (a < 0.7) r.set(x + i, uy, C.greenD);
    }
  }
  r.outline(C.ink);
  p.blit(r);
}

/**
 * A cable sagging between two points: a dark silhouette where it crosses
 * the glow, a dull highlight where it hangs in front of rock.
 */
function cable(p: Pix, x0: number, y0: number, x1: number, y1: number, sag: number): void {
  const steps = (Math.abs(x1 - x0) + Math.abs(y1 - y0)) * 2 + 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
    p.set(x, y, isGlow(p.get(x, y)) ? C.ink : C.rock3);
  }
}

/** A chunky CRT terminal with its keyboard. `icon` draws the screen content. */
function terminal(
  p: Pix,
  x: number,
  y: number,
  w: number,
  h: number,
  icon: (s: Pix, sx: number, sy: number, sw: number, sh: number) => void,
): void {
  const t = new Pix();
  // casing
  t.rect(x, y, w, h, C.case);
  t.hline(x, y, w, C.caseL);
  t.vline(x, y, h, C.caseL);
  t.vline(x + w - 1, y, h, C.caseD);
  t.hline(x, y + h - 1, w, C.caseD);
  // screen
  const sx = x + 2;
  const sy = y + 2;
  const sw = w - 6;
  const sh = h - 4;
  t.rect(sx - 1, sy - 1, sw + 2, sh + 2, C.ink);
  t.rect(sx, sy, sw, sh, C.greenDD);
  icon(t, sx, sy, sw, sh);
  t.set(sx, sy, C.greenD);
  // side panel: power light and vents
  t.set(x + w - 3, y + 2, C.amber);
  for (let j = y + 4; j < y + h - 2; j += 2) t.set(x + w - 3, j, C.caseD);
  // neck and keyboard
  t.rect(x + 3, y + h, w - 6, 1, C.caseD);
  t.rect(x - 1, y + h + 1, w + 2, 3, C.case);
  t.hline(x - 1, y + h + 1, w + 2, C.caseL);
  t.hline(x - 1, y + h + 3, w + 2, C.caseD);
  for (let i = x; i < x + w; i += 2) t.set(i, y + h + 2, C.caseL);
  t.outline(C.ink);
  p.blit(t);
}

export function drawCaverns(p: Pix): void {
  const rnd = mulberry32(0xdeeb0c);

  /* --- depth: a teal glow at the far end of the cavern ----------- */
  p.grad(
    0,
    0,
    64,
    64,
    [C.haze2, C.haze1, C.haze0, C.rock1],
    (x, y) => Math.hypot((x + 0.5 - VX) / 1.2, y + 0.5 - GLOW_Y) / 4.8 - 0.75,
    3.5,
  );
  // the bright heart of the glow: a clean lozenge, not a dithered blob
  p.ellipse(VX, GLOW_Y + 0.5, 4.5, 3, C.core);
  p.ellipse(VX, GLOW_Y, 2.5, 1.5, C.white);

  /* --- cave mouth: rough rock closing in around the glow --------- */
  p.each(0, 0, 64, 64, (x, y) => {
    const dx = x + 0.5 - VX;
    const dy = y + 0.5 - (GLOW_Y + 1);
    const a = Math.atan2(dy, dx);
    const wobble = 1 + 0.06 * Math.sin(a * 7 + 0.6) + 0.04 * Math.sin(a * 13 + 2.1);
    const d = Math.hypot(dx / 19, dy / 17) / wobble;
    if (d < 1) return KEEP;
    if (d < 1.1) return C.rock2; // lip catching the light
    return d < 1.7 ? C.rock1 : C.rock0;
  });

  /* --- floor: wet rock, the glow reflected down the aisle -------- */
  p.each(1, VY, 62, 64 - VY, (x, y) => {
    const dx = Math.abs(x + 0.5 - VX);
    if (y + 0.5 < VY + dx * 0.8) return KEEP;
    // two seams converging on the vanishing point
    const seam = Math.abs(dx - (y + 0.5 - VY) * 0.42) < 0.5;
    return seam ? C.rock2 : C.rock1;
  });
  // streaks of reflected light, widest and brightest at the far end
  const streaks: readonly (readonly [number, number, Color])[] = [
    [0, 4, C.core],
    [1, 6, C.haze2],
    [2, 4, C.haze2],
    [3, 5, C.haze1],
    [5, 4, C.haze1],
    [6, 2, C.haze2],
    [8, 3, C.haze1],
    [10, 4, C.haze0],
    [12, 2, C.haze1],
    [15, 3, C.haze0],
    [18, 2, C.haze0],
    [22, 1, C.haze0],
  ];
  for (const [dy, half, c] of streaks) p.hline(VX - half, VY + dy, half * 2, c);

  /* --- racks in perspective, far to near ------------------------- */
  const aisle: readonly (readonly [number, number])[] = [
    [24, 4],
    [15, 8],
    [3, 11],
  ];
  for (const [x, w] of aisle) {
    const depth = VX - (x + w / 2);
    const top = Math.round(VY - depth * 0.62);
    const bottom = Math.round(VY + depth * 0.8);
    rack(p, rnd, x, top, w, bottom - top + 1);
    rack(p, rnd, 64 - x - w, top, w, bottom - top + 1);
    // light strip along the foot of each cabinet
    p.hline(x, bottom + 2, w, C.teal);
    p.hline(64 - x - w, bottom + 2, w, C.teal);
  }

  /* --- cables slung between the racks ---------------------------- */
  cable(p, 13, 15, 15, 22, 2);
  cable(p, 50, 15, 48, 22, 2);
  cable(p, 20, 8, 18, 22, 1);
  cable(p, 44, 9, 45, 22, -1);

  /* --- ceiling and stalactites ----------------------------------- */
  const s = new Pix();
  s.rect(0, 0, 64, 4, C.rock1);
  const spikes: readonly (readonly [number, number, number])[] = [
    [0, 7, 13],
    [8, 3, 4],
    [12, 5, 9],
    [19, 3, 3],
    [24, 4, 6],
    [31, 3, 3],
    [36, 4, 5],
    [42, 3, 3],
    [46, 5, 10],
    [53, 3, 4],
    [57, 7, 14],
  ];
  for (const [sx, sw, len] of spikes) {
    s.poly([sx, 3, sx + sw, 3, sx + sw / 2, 3 + len], C.rock1);
    // the flank of each spike that faces the glow is lit
    const towardGlow = sx + sw / 2 < VX ? 1 : -1;
    s.each(sx, 4, sw, len + 1, (x, _y, cur) => {
      if (cur === CLEAR) return KEEP;
      const u = ((x + 0.5 - (sx + sw / 2)) / sw) * towardGlow;
      return u > 0.15 ? C.rock3 : u > -0.2 ? C.rock2 : KEEP;
    });
  }
  s.each(0, 0, 64, 4, (x, y, cur) => {
    if (cur === CLEAR) return KEEP;
    if (y <= 1) return C.rock0;
    return y === 3 && (x * 5) % 7 < 3 ? C.rock2 : KEEP;
  });
  s.outline(C.ink);
  p.blit(s);
  // drips
  p.set(14, 15, C.teal);
  p.set(48, 16, C.teal);
  // two loops of cable hanging from the roof in front of the glow
  cable(p, 21, 5, 30, 5, 5);
  cable(p, 33, 5, 43, 5, 6);

  /* --- foreground terminals on rock ledges ----------------------- */
  const ledge = (x: number, y: number, w: number): void => {
    const l = new Pix();
    l.poly([x, y, x + w, y, x + w + 2, 63, x - 2, 63], C.rock1);
    l.hline(x, y, w, C.rock3);
    l.hline(x, y + 1, w, C.rock2);
    l.outline(C.ink);
    p.blit(l);
  };
  ledge(4, 57, 22);
  ledge(40, 59, 19);

  terminal(p, 7, 40, 18, 13, (t, sx, sy, sw, sh) => {
    // command prompt: chevron + block cursor
    t.set(sx + 1, sy + 2, C.green);
    t.set(sx + 2, sy + 3, C.green);
    t.set(sx + 3, sy + 4, C.green);
    t.set(sx + 2, sy + 5, C.green);
    t.set(sx + 1, sy + 6, C.green);
    t.rect(sx + 5, sy + 5, 3, 2, C.white);
    t.hline(sx + 1, sy + sh - 1, sw - 2, C.greenD);
  });
  terminal(p, 43, 46, 14, 10, (t, sx, sy, _sw, sh) => {
    // activity bars
    [2, 4, 3, 5].forEach((b, i) => {
      t.rect(sx + 1 + i * 2, sy + sh - b, 1, b, i % 2 === 0 ? C.teal : C.green);
    });
  });
  // screen light pooling on the ledges
  p.hline(8, 57, 16, C.greenD);
  p.hline(44, 59, 12, C.greenD);

  p.border(C.ink);
}

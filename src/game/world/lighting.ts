/**
 * Baked lighting. There are no shadow maps and (for the room itself) no
 * real-time lights: every static vertex gets a colour computed once here and
 * multiplied with its texture, the way a 1996 cartridge lit a room.
 *
 * The model is deliberately simple and art-directed, in display space:
 *   ambient (sky above, warm bounce below) + a touch of "sun" by facing
 *   × contact occlusion (floor near walls, walls near the floor and corners,
 *     edges inside each alcove, deeper = dimmer)
 *   + warm pools from the torches, the pedestal star, each painting's accent,
 *     the doorways and the south fan window.
 */
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_BEARINGS_DEG,
  DOOR_FRAMES,
  DOOR_HALF_WIDTH,
  ROOM,
  wallFrame,
} from "../layout";
import { ALL_BEARINGS_DEG, DOOR_ACCENTS, SOUTH_DOOR, TORCHES } from "./plan";
import { clamp, lerp, mixRgb, smoothstep, type RGB } from "./util";

/** Writes the display-space light at a point with the given face normal. */
export type Shade = (
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  out: [number, number, number],
) => void;

interface PointLight {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  radius: number;
  /** -1 lights the lobby; 0–4 lights only that door's arch and alcove. */
  zone: number;
}

interface WallPlane {
  dx: number;
  dz: number;
  rx: number;
  rz: number;
  /** Half-width of the opening in this wall (0 = solid). */
  gap: number;
}

const TORCH_COLOR: RGB = [1.0, 0.7, 0.36];
const WARM_WHITE: RGB = [1.0, 0.9, 0.72];

// Same direction as the real-time directional light the avatar is lit by.
const SUN_LEN = Math.hypot(4, 10, 6);
const SUN_X = 4 / SUN_LEN;
const SUN_Y = 10 / SUN_LEN;
const SUN_Z = 6 / SUN_LEN;

export function createBakedLighting(): Shade {
  const walls: WallPlane[] = ALL_BEARINGS_DEG.map((bearing) => {
    const f = wallFrame(bearing);
    const isDoor = (DOOR_BEARINGS_DEG as readonly number[]).includes(bearing);
    return {
      dx: f.dir.x,
      dz: f.dir.z,
      rx: f.right.x,
      rz: f.right.z,
      gap: isDoor ? DOOR_HALF_WIDTH : 0,
    };
  });

  const lights: PointLight[] = [];
  const add = (x: number, y: number, z: number, c: RGB, k: number, radius: number, zone: number) =>
    lights.push({ x, y, z, r: c[0] * k, g: c[1] * k, b: c[2] * k, radius, zone });

  for (const t of TORCHES) {
    if (t.zone >= 0) add(t.x, t.y + 0.25, t.z, TORCH_COLOR, 0.52, 4.6, t.zone);
    else add(t.x, t.y + 0.25, t.z, TORCH_COLOR, 0.42, 4.8, -1);
  }
  for (const f of DOOR_FRAMES) {
    const accent = DOOR_ACCENTS[f.index];
    // the painting tints its alcove
    const p = f.at(0, ALCOVE_BACK - 0.55);
    add(p.x, ROOM.paintingCenterY, p.z, accent, 0.24, 3.4, f.index);
    // light spilling out of each doorway onto the lobby floor
    const s = f.at(0, -1.1);
    add(s.x, 1.3, s.z, mixRgb(WARM_WHITE, accent, 0.35), 0.26, 5.2, -1);
  }
  // the résumé star throws a gold pool over the carpet
  add(0, ROOM.starHeight + 0.2, 0, [1.0, 0.82, 0.42], 0.36, 8.5, -1);
  // daylight through the fan window above the south entrance
  add(0, SOUTH_DOOR.springY + 0.6, ROOM.apothem - 0.9, [0.86, 0.94, 1.0], 0.34, 8.5, -1);

  return (px, py, pz, nx, ny, nz, out) => {
    // Which arch / alcove is this point inside, if any?
    let zone = -1;
    let zu = 0;
    let zd = 0;
    let znu = 0;
    let znd = 0;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      const rx = px - f.mid.x;
      const rz = pz - f.mid.z;
      const d = rx * f.dir.x + rz * f.dir.z;
      if (d <= 0.02 || d > ALCOVE_BACK + 0.2) continue;
      const u = rx * f.right.x + rz * f.right.z;
      if (Math.abs(u) > ALCOVE_HALF_WIDTH + 0.2) continue;
      zone = i;
      zu = u;
      zd = d;
      znu = nx * f.right.x + nz * f.right.z;
      znd = nx * f.dir.x + nz * f.dir.z;
      break;
    }

    // ambient: cool-white from above, warm bounce from below
    const up = ny * 0.5 + 0.5;
    let r = lerp(0.8, 1.0, up);
    let g = lerp(0.765, 0.99, up);
    let b = lerp(0.71, 0.955, up);
    let occ = 1;

    if (zone < 0) {
      const ndl = Math.max(0, nx * SUN_X + ny * SUN_Y + nz * SUN_Z);
      r += 0.13 * ndl;
      g += 0.125 * ndl;
      b += 0.11 * ndl;
      if (ny > 0.7) {
        if (py < 0.2) {
          // floor: darker towards the walls (not across an open doorway) and
          // around the foot of the pedestal
          let m = 99;
          for (const w of walls) {
            let dist = Math.max(0, ROOM.apothem - (px * w.dx + pz * w.dz));
            if (w.gap > 0) {
              const u = Math.abs(px * w.rx + pz * w.rz);
              if (u < w.gap) dist = Math.hypot(dist, w.gap - u);
            }
            if (dist < m) m = dist;
          }
          occ = lerp(0.6, 1, smoothstep(0, 2.8, m));
          occ *= lerp(0.62, 1, smoothstep(0.7, 1.8, Math.hypot(px, pz)));
        } else {
          occ = 1.04; // ledges catch the light
        }
      } else if (ny > -0.7) {
        // upright faces: contact shadow at the floor and in the room's corners
        occ = lerp(0.72, 1, smoothstep(0, 1.9, py));
        let m = 99;
        for (const w of walls) {
          if (-(nx * w.dx + nz * w.dz) > 0.8) continue; // the face lies on this wall
          const dist = Math.max(0, ROOM.apothem - (px * w.dx + pz * w.dz));
          if (dist < m) m = dist;
        }
        occ *= lerp(0.8, 1, smoothstep(0, 1.5, m));
      } else {
        occ = 0.94;
      }
    } else {
      // inside an arch tunnel or an alcove: distance to the nearest surface
      // other than the one this face lies on
      const tunnel = zd < ARCH_DEPTH - 0.01;
      const halfW = tunnel ? DOOR_HALF_WIDTH : ALCOVE_HALF_WIDTH;
      const top = tunnel ? ROOM.doorHeight : ROOM.alcoveHeight;
      let m = 99;
      if (ny < 0.7) m = Math.min(m, py);
      if (ny > -0.7) m = Math.min(m, (top - py) * 1.5);
      if (Math.abs(znu) < 0.7) m = Math.min(m, halfW - Math.abs(zu));
      if (znd > -0.7) m = Math.min(m, ALCOVE_BACK - zd);
      if (!tunnel && znd < 0.7 && Math.abs(zu) > DOOR_HALF_WIDTH) m = Math.min(m, zd - ARCH_DEPTH);
      if (m < 0) m = 0;
      occ = lerp(0.7, 1, smoothstep(0, 1.1, m)) * lerp(0.96, 0.82, smoothstep(0, ALCOVE_BACK, zd));
    }

    r *= occ;
    g *= occ;
    b *= occ;

    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      if (L.zone !== zone) continue;
      const lx = L.x - px;
      const ly = L.y - py;
      const lz = L.z - pz;
      const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (dist >= L.radius) continue;
      const a = 1 - dist / L.radius;
      const ndl = dist > 1e-4 ? (nx * lx + ny * ly + nz * lz) / dist : 1;
      const k = a * a * clamp((ndl + 0.4) / 1.4, 0, 1);
      r += L.r * k;
      g += L.g * k;
      b += L.b * k;
    }

    out[0] = Math.min(r, 1.45);
    out[1] = Math.min(g, 1.45);
    out[2] = Math.min(b, 1.45);
  };
}

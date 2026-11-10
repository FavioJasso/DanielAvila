/**
 * The moving parts of each door: the hinged leaf, the painting with its
 * ripple material, the floating sign and the spinning star emblems. Each door
 * exposes the contract's `DoorHandle` plus an allocation-free `update`.
 */
import * as THREE from "three";
import { DOORS, type DoorHandle, type DoorSpec, type HitTag } from "../contract";
import { ARCH_DEPTH, ALCOVE_HALF_WIDTH, DOOR_FRAMES, DOOR_HALF_WIDTH, ROOM } from "../layout";
import { createPaintingCanvas } from "../services";
import { MeshBuilder } from "./builder";
import { SIGN_HEIGHT_PX, createSignCanvas } from "./labels";
import type { Shade } from "./lighting";
import { Ripple, createPaintingMaterial, type PaintingUniforms } from "./painting";
import {
  EMBLEM_STAR_OUT,
  LEAF_GAP,
  LEAF_OPEN_ANGLE,
  LEAF_THICKNESS,
  SIGN_M_PER_PX,
  SIGN_OUT,
  SIGN_THICKNESS,
  SIGN_Y,
  SPRING_Y,
  SURROUND_OUT,
  SURROUND_WIDTH,
  emblemStars,
} from "./plan";
import { archProfile } from "./room";
import { starSpin } from "./star";
import { pixelTexture } from "./textures";
import { lerp, smoothstep, toLinear, type V2, type V3 } from "./util";

/* ------------------------------------------------------------------ */
/* Leaf geometry (shared by all five doors)                            */
/* ------------------------------------------------------------------ */

/**
 * The leaf carries only a local bake (darker towards the floor, edges in
 * shade); its overall light level follows the swing, see `Door.update`.
 */
const leafShade: Shade = (_px, py, _pz, _nx, ny, nz, out) => {
  const face = nz > 0.5 ? 1 : nz < -0.5 ? 0.95 : ny > 0.5 ? 0.9 : 0.72;
  const k = lerp(0.76, 1, smoothstep(0, 1.5, py)) * face;
  out[0] = k;
  out[1] = k;
  out[2] = k;
};

/** A plain patch of the wood texture's iron band (no rivet). */
const IRON_UV: V2 = [0.19, 0.6];

/**
 * Arch-topped plank door in hinge space: x runs from the hinge along the
 * closed leaf, y is up, +z faces the lobby. Planks are 0.325 m wide with an
 * iron band every 1.2 m; a ring pull sits on each face.
 */
export function createLeafGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder(leafShade);
  const W = ROOM.doorWidth;
  const x0 = LEAF_GAP;
  const x1 = W - LEAF_GAP;
  const cx = W / 2;
  const yb = 0.045;
  const zf = LEAF_THICKNESS / 2;
  const T = (x: number, y: number): V2 => [x / 1.3, y / 1.2];
  const arch = archProfile(DOOR_HALF_WIDTH - LEAF_GAP, SPRING_Y);
  const xs = [x0, cx, x1];
  const ys = [yb, SPRING_Y / 2, SPRING_Y];

  for (const z of [zf, -zf]) {
    const style = { facing: [0, 0, Math.sign(z)] as V3 };
    const P = (x: number, y: number): V3 => [x, y, z];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        b.quad(
          P(xs[i], ys[j]),
          P(xs[i + 1], ys[j]),
          P(xs[i + 1], ys[j + 1]),
          P(xs[i], ys[j + 1]),
          T(xs[i], ys[j]),
          T(xs[i + 1], ys[j]),
          T(xs[i + 1], ys[j + 1]),
          T(xs[i], ys[j + 1]),
          style,
        );
      }
    }
    // arched head: a fan from the middle of the springline
    for (let i = 0; i + 1 < arch.length; i++) {
      const a = arch[i];
      const c = arch[i + 1];
      b.tri(
        P(cx, SPRING_Y),
        P(cx + a.u, a.y),
        P(cx + c.u, c.y),
        T(cx, SPRING_Y),
        T(cx + a.u, a.y),
        T(cx + c.u, c.y),
        style,
      );
    }
    // ring pull near the latch edge
    const hx = W - 0.46;
    const hy = 1.32;
    const hz = z + Math.sign(z) * 0.018;
    const iron = { ...style, tint: [1.55, 1.55, 1.6] as const };
    const R = (r: number, k: number): V3 => {
      const ang = (k / 8) * Math.PI * 2;
      return [hx + Math.cos(ang) * r, hy + Math.sin(ang) * r, hz];
    };
    for (let k = 0; k < 8; k++) {
      b.quad(R(0.085, k), R(0.085, k + 1), R(0.14, k + 1), R(0.14, k), IRON_UV, IRON_UV, IRON_UV, IRON_UV, iron);
    }
    b.quad(
      [hx - 0.045, hy + 0.1, hz],
      [hx + 0.045, hy + 0.1, hz],
      [hx + 0.045, hy + 0.21, hz],
      [hx - 0.045, hy + 0.21, hz],
      IRON_UV,
      IRON_UV,
      IRON_UV,
      IRON_UV,
      iron,
    );
  }

  // edges: hinge side, latch side and the arched top (the bottom is never seen)
  const E = (along: number, across: number): V2 => [0.03 + across * 0.09, along / 1.2];
  for (const [x, nx] of [
    [x0, -1],
    [x1, 1],
  ]) {
    b.quad(
      [x, yb, -zf],
      [x, yb, zf],
      [x, SPRING_Y, zf],
      [x, SPRING_Y, -zf],
      E(yb, 0),
      E(yb, 1),
      E(SPRING_Y, 1),
      E(SPRING_Y, 0),
      { facing: [nx, 0, 0] },
    );
  }
  let run = SPRING_Y;
  for (let i = 0; i + 1 < arch.length; i++) {
    const a = arch[i];
    const c = arch[i + 1];
    const len = Math.hypot(c.u - a.u, c.y - a.y);
    b.quad(
      [cx + a.u, a.y, -zf],
      [cx + a.u, a.y, zf],
      [cx + c.u, c.y, zf],
      [cx + c.u, c.y, -zf],
      E(run, 0),
      E(run, 1),
      E(run + len, 1),
      E(run + len, 0),
      { facing: [(a.u + c.u) / 2, (a.y + c.y) / 2 - SPRING_Y, 0] },
    );
    run += len;
  }
  return b.build();
}

/* ------------------------------------------------------------------ */
/* Door                                                                */
/* ------------------------------------------------------------------ */

export interface Door extends DoorHandle {
  update(dt: number, time: number): void;
}

export interface DoorDeps {
  /** The room's baked light, sampled for the leaf's closed and open poses. */
  shade: Shade;
  wood: THREE.Texture;
  leafGeometry: THREE.BufferGeometry;
  paintingGeometry: THREE.BufferGeometry;
  starGeometry: THREE.BufferGeometry;
  starMaterial: THREE.Material;
  /** Shared per-door halo levels (see sprites.ts → Glows.door). */
  haloLevels: Float32Array;
  /** Shared material for the invisible, raycast-only arch click targets (DoubleSide). */
  proxyMaterial: THREE.Material;
  reducedMotion: boolean;
  /** Registers something for `world.dispose()`. */
  track<T extends { dispose(): void }>(resource: T): T;
}

export interface DoorParts {
  door: Door;
  /** Add these to the world root. */
  objects: THREE.Object3D[];
  pickables: THREE.Object3D[];
}

const tag = <T extends THREE.Object3D>(o: T, hit: HitTag): T => {
  o.userData.hit = hit;
  return o;
};

/** Critically damped spring rate for the swing (rad/s): ≈0.6 open after 0.22 s. */
const SWING_RATE = 9;

export function createDoor(index: number, deps: DoorDeps): DoorParts {
  const spec: DoorSpec = DOORS[index];
  const f = DOOR_FRAMES[index];
  const bearing = (f.bearingDeg * Math.PI) / 180;
  const hit = { index };

  /* --- leaf ---------------------------------------------------------- */
  const pivot = new THREE.Group();
  pivot.name = `door-${index}`;
  pivot.position.set(f.hinge.x, 0, f.hinge.z);
  pivot.rotation.y = -bearing;
  const leafMaterial = deps.track(
    new THREE.MeshBasicMaterial({ map: deps.wood, vertexColors: true, toneMapped: false }),
  );
  const leaf = tag(new THREE.Mesh(deps.leafGeometry, leafMaterial), { kind: "door", ...hit });
  leaf.name = `door-leaf-${index}`;
  pivot.add(leaf);

  // Light on the leaf when shut (in the arch, facing the lobby) and when open
  // (flat against the alcove's side wall), in linear space for material.color.
  const lit: [number, number, number] = [0, 0, 0];
  const shut = f.at(0, ARCH_DEPTH - LEAF_THICKNESS);
  deps.shade(shut.x, 1.7, shut.z, -f.dir.x, 0, -f.dir.z, lit);
  const shutR = toLinear(lit[0]);
  const shutG = toLinear(lit[1]);
  const shutB = toLinear(lit[2]);
  const open = f.at(-ALCOVE_HALF_WIDTH + 0.2, ARCH_DEPTH + 1.3);
  deps.shade(open.x, 1.7, open.z, f.right.x, 0, f.right.z, lit);
  const openR = toLinear(lit[0]);
  const openG = toLinear(lit[1]);
  const openB = toLinear(lit[2]);

  /* --- painting ------------------------------------------------------ */
  const paintingTexture = deps.track(pixelTexture(createPaintingCanvas(spec.id), false));
  const paintingMaterial = deps.track(createPaintingMaterial(paintingTexture, spec.accent));
  const uniforms = paintingMaterial.uniforms as PaintingUniforms;
  const painting = tag(new THREE.Mesh(deps.paintingGeometry, paintingMaterial), {
    kind: "painting",
    ...hit,
  });
  painting.name = `painting-${index}`;
  painting.position.set(f.painting.x, f.painting.y, f.painting.z);
  painting.rotation.y = f.yawIn;
  const ripple = new Ripple(uniforms, deps.reducedMotion);

  /* --- sign + star emblems (one pickable group) ---------------------- */
  const crest = tag(new THREE.Group(), { kind: "sign", ...hit });
  crest.name = `crest-${index}`;

  const signCanvas = createSignCanvas(spec.label, spec.accent);
  const signTexture = deps.track(pixelTexture(signCanvas, false));
  const signW = signCanvas.width * SIGN_M_PER_PX;
  const signH = SIGN_HEIGHT_PX * SIGN_M_PER_PX;
  const signGeometry = deps.track(new THREE.BoxGeometry(signW, signH, SIGN_THICKNESS));
  {
    // Only the front (+Z, vertices 16–19) shows the label; every other face
    // samples a single texel of the gold rim.
    const uv = signGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      if (i < 16 || i >= 20) uv.setXY(i, 0.5, 1 - 1.5 / SIGN_HEIGHT_PX);
    }
  }
  const signMaterial = deps.track(new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }));
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.name = `sign-${index}`;
  const sp = f.at(0, -SIGN_OUT);
  sign.position.set(sp.x, SIGN_Y, sp.z);
  sign.rotation.y = f.yawIn;
  crest.add(sign);

  const stars: THREE.Mesh[] = [];
  const starBaseY: number[] = [];
  for (const e of emblemStars(spec.badge)) {
    const star = new THREE.Mesh(deps.starGeometry, deps.starMaterial);
    const p = f.at(e.u, -EMBLEM_STAR_OUT);
    star.position.set(p.x, e.y, p.z);
    star.scale.setScalar(e.radius);
    star.rotation.y = f.yawIn;
    crest.add(star);
    stars.push(star);
    starBaseY.push(e.y);
  }

  /* --- click target for the stone archway ---------------------------- */
  // The surround is merged into the static shell, which is not pickable, so an
  // invisible copy of its face (jambs + voussoir ring, not the opening) makes
  // a click on the stonework count as a click on the door.
  const archHit = tag(
    new THREE.Mesh(deps.track(createArchProxyGeometry(index)), deps.proxyMaterial),
    { kind: "door", ...hit },
  );
  archHit.name = `arch-${index}`;
  archHit.visible = false; // raycast only, never drawn

  /* --- state --------------------------------------------------------- */
  let target = 0;
  let amount = 0;
  let velocity = 0;
  let glowTarget = 0;
  let glow = 0;
  const bob = deps.reducedMotion ? 0.015 : 0.06;
  const spin = deps.reducedMotion ? 0.25 : 0.9;

  const door: Door = {
    spec,
    get openAmount() {
      return amount;
    },
    setOpen(o) {
      target = o ? 1 : 0;
    },
    ripple(direction, uv) {
      const u = uv && Number.isFinite(uv.u) ? uv.u : 0.5;
      const v = uv && Number.isFinite(uv.v) ? uv.v : 0.5;
      ripple.start(direction === "out" ? "out" : "in", u, v);
    },
    setGlow(a) {
      glowTarget = !(a > 0) ? 0 : a > 1 ? 1 : a; // NaN → 0
    },
    update(dt, time) {
      // swing: critically damped spring, integrated exactly (stable at any dt)
      if (amount !== target || velocity !== 0) {
        const x = amount - target;
        const e = Math.exp(-SWING_RATE * dt);
        const j = (velocity + SWING_RATE * x) * dt;
        amount = target + (x + j) * e;
        velocity = (velocity - SWING_RATE * j) * e;
        if (Math.abs(amount - target) < 0.0015 && Math.abs(velocity) < 0.02) {
          amount = target;
          velocity = 0;
        }
        if (amount < 0) amount = 0;
        else if (amount > 1) amount = 1;
        pivot.rotation.y = -bearing + amount * LEAF_OPEN_ANGLE;
        leafMaterial.color.setRGB(
          lerp(shutR, openR, amount),
          lerp(shutG, openG, amount),
          lerp(shutB, openB, amount),
        );
      }

      ripple.update(dt);
      glow += (glowTarget - glow) * (1 - Math.exp(-dt * 7));
      if (Math.abs(glowTarget - glow) < 0.002) glow = glowTarget;
      uniforms.uGlow.value = glow;
      // halo behind the frame: a soft resting glow that breathes, swells with
      // focus and flares with the ripple
      deps.haloLevels[index] =
        0.42 + 0.05 * Math.sin(time * 1.7 + index * 1.3) + 0.6 * glow + 0.9 * ripple.flash;

      sign.position.y = SIGN_Y + Math.sin(time * 1.5 + index * 1.3) * bob;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.rotation.y = f.yawIn + starSpin(time * spin + i * 0.9 + index * 0.5);
        s.position.y = starBaseY[i] + Math.sin(time * 1.9 + i * 1.7 + index) * bob * 0.7;
      }
    },
  };
  leafMaterial.color.setRGB(shutR, shutG, shutB);

  return {
    door,
    objects: [pivot, painting, crest, archHit],
    pickables: [leaf, painting, crest, archHit],
  };
}

/** World-space face of door `index`'s stone surround, just in front of the stone. */
function createArchProxyGeometry(index: number): THREE.BufferGeometry {
  const f = DOOR_FRAMES[index];
  const hw = DOOR_HALF_WIDTH;
  const ow = hw + SURROUND_WIDTH;
  const d = -SURROUND_OUT - 0.005;
  const pos: number[] = [];
  const P = (u: number, y: number) => {
    const p = f.at(u, d);
    pos.push(p.x, y, p.z);
  };
  const quad = (u0: number, y0: number, u1: number, y1: number, u2: number, y2: number, u3: number, y3: number) => {
    P(u0, y0);
    P(u1, y1);
    P(u2, y2);
    P(u0, y0);
    P(u2, y2);
    P(u3, y3);
  };
  for (const s of [-1, 1]) quad(s * hw, 0, s * ow, 0, s * ow, SPRING_Y, s * hw, SPRING_Y);
  const inner = archProfile(hw, SPRING_Y);
  const outer = archProfile(ow, SPRING_Y);
  for (let i = 0; i + 1 < inner.length; i++) {
    quad(inner[i].u, inner[i].y, inner[i + 1].u, inner[i + 1].y, outer[i + 1].u, outer[i + 1].y, outer[i].u, outer[i].y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

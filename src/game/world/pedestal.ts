/**
 * The centre pedestal: a stone plinth, a small wooden signpost reading
 * RESUME, and the gold star turning above it. Everything stays inside the
 * pedestal's collider circle (plus the avatar's own radius).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { HitTag } from "../contract";
import { PEDESTAL, ROOM } from "../layout";
import { MeshBuilder } from "./builder";
import { POST_SIGN, createPostSignCanvas } from "./labels";
import type { Shade } from "./lighting";
import { TINT } from "./room";
import { starSpin } from "./star";
import { pixelTexture } from "./textures";
import { toLinear } from "./util";

export interface Pedestal {
  /** Tagged `{ kind: "star" }`; contains the plinth, the signpost and the star. */
  group: THREE.Group;
  star: THREE.Mesh;
  update(dt: number, time: number): void;
  /** Kick the star's celebratory pulse. */
  burst(): void;
}

export interface PedestalDeps {
  shade: Shade;
  slabMaterial: THREE.Material;
  starGeometry: THREE.BufferGeometry;
  starMaterial: THREE.Material;
  reducedMotion: boolean;
  track<T extends { dispose(): void }>(resource: T): T;
}

const STAR_RADIUS = 0.56;
const PLINTH_TOP = 1.14;

function plinthGeometry(shade: Shade): THREE.BufferGeometry {
  const b = new MeshBuilder(shade);
  // an octagon turned so a flat face (not a corner) looks towards the entrance
  const SIDES = 8;
  // each of the eight faces shows half a slab tile, one course tall
  const band =
    (courses: number) =>
    (u: number, v: number): [number, number] => [u * 4, 0.5 + v * 0.5 * courses];
  const patch = (u: number, v: number): [number, number] => [0.08 + u * 0.34, 0.56 + v * 0.38];
  const drum = (r0: number, r1: number, y0: number, y1: number, courses: number, tint: typeof TINT.base) => {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, SIDES, 1, true, Math.PI / 8);
    g.translate(PEDESTAL.x, (y0 + y1) / 2, PEDESTAL.z);
    b.addGeometry(g, { tint }, band(courses));
    g.dispose();
  };
  const lid = (r: number, y: number, tint: typeof TINT.base) => {
    const g = new THREE.CircleGeometry(r, SIDES, Math.PI / 8);
    g.rotateX(-Math.PI / 2);
    g.translate(PEDESTAL.x, y, PEDESTAL.z);
    b.addGeometry(g, { tint }, patch);
    g.dispose();
  };
  const R = ROOM.pedestalRadius;
  drum(R, R - 0.02, 0, 0.16, 1, TINT.base); // step
  lid(R - 0.02, 0.16, TINT.base);
  drum(0.54, 0.47, 0.16, 0.98, 2, TINT.pillar); // shaft
  drum(0.6, 0.64, 0.98, PLINTH_TOP, 1, TINT.trim); // cap
  lid(0.64, PLINTH_TOP, TINT.keystone);
  // underside of the cap's overhang, for cameras below it
  const soffit = new THREE.RingGeometry(0.47, 0.6, SIDES, 1, Math.PI / 8);
  soffit.rotateX(Math.PI / 2);
  soffit.translate(PEDESTAL.x, 0.98, PEDESTAL.z);
  b.addGeometry(soffit, { tint: TINT.pillarBase }, patch);
  soffit.dispose();
  return b.build();
}

/**
 * Board + post as one geometry sharing the signpost canvas: the board's
 * front shows the lettered face, everything else samples the plain wood
 * strip along the bottom of the canvas.
 */
function signpostGeometry(): THREE.BufferGeometry {
  const faceV = 1 - POST_SIGN.faceHeight / POST_SIGN.height;
  const remap = (g: THREE.BoxGeometry, lettered: boolean) => {
    const uv = g.getAttribute("uv");
    const color = new Float32Array(uv.count * 3);
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (four vertices each)
    const shade = [0.74, 0.74, 1.0, 0.55, 1.0, 0.6].map(toLinear);
    for (let i = 0; i < uv.count; i++) {
      const face = i >> 2;
      if (lettered && face === 4) uv.setXY(i, uv.getX(i), faceV + uv.getY(i) * (1 - faceV));
      else uv.setXY(i, 0.08 + uv.getX(i) * 0.84, 0.02 + uv.getY(i) * (faceV - 0.05));
      color.fill(shade[face], i * 3, i * 3 + 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(color, 3));
  };
  const board = new THREE.BoxGeometry(0.92, 0.36, 0.06);
  remap(board, true);
  board.rotateX(-0.14); // tipped back a little, like a hand-planted sign
  board.translate(PEDESTAL.x, 0.84, PEDESTAL.z + 0.775);
  const post = new THREE.BoxGeometry(0.09, 0.84, 0.07);
  remap(post, false);
  post.rotateX(-0.14);
  post.translate(PEDESTAL.x, 0.42, PEDESTAL.z + 0.79);
  const merged = mergeGeometries([board, post]);
  board.dispose();
  post.dispose();
  return merged;
}

export function createPedestal(deps: PedestalDeps): Pedestal {
  const hit: HitTag = { kind: "star" };
  const group = new THREE.Group();
  group.name = "pedestal";
  group.userData.hit = hit;

  const plinth = new THREE.Mesh(deps.track(plinthGeometry(deps.shade)), deps.slabMaterial);
  plinth.name = "plinth";
  group.add(plinth);

  const signTexture = deps.track(pixelTexture(createPostSignCanvas("RESUME"), false));
  const signMaterial = deps.track(
    new THREE.MeshBasicMaterial({ map: signTexture, vertexColors: true, toneMapped: false }),
  );
  const signpost = new THREE.Mesh(deps.track(signpostGeometry()), signMaterial);
  signpost.name = "signpost";
  group.add(signpost);

  const star = new THREE.Mesh(deps.starGeometry, deps.starMaterial);
  star.name = "resume-star";
  star.position.set(PEDESTAL.x, ROOM.starHeight, PEDESTAL.z);
  star.scale.setScalar(STAR_RADIUS);
  group.add(star);

  let pulse = 0;
  const spin = deps.reducedMotion ? 0.5 : 1.6;
  const bob = deps.reducedMotion ? 0.02 : 0.08;
  return {
    group,
    star,
    burst() {
      pulse = 1;
    },
    update(dt, time) {
      pulse = Math.max(0, pulse - dt * 1.4);
      // the burst adds a quick extra whirl and a swell that eases back
      const kick = pulse * pulse;
      star.rotation.y = starSpin(time * spin) + (deps.reducedMotion ? 0 : kick * 5);
      star.position.y = ROOM.starHeight + Math.sin(time * 2) * bob + kick * 0.18;
      star.scale.setScalar(STAR_RADIUS * (1 + kick * 0.55));
    },
  };
}

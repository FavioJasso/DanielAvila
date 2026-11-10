/**
 * Click / tap picking: raycast the world's pickables and resolve the HitTag.
 *
 * Walls are not pickable, so a ray can reach something the player cannot
 * actually see (a painting through the side of its alcove, the floor beyond
 * a wall). The layout knows where every wall is, so a hit only counts if the
 * line from the camera to it crosses no wall on the ground plan and, when it
 * goes through a doorway, passes under the lintel.
 */
import * as THREE from "three";
import type { HitKind, HitTag, Segment } from "../contract";
import { ALCOVE_BACK, ALCOVE_HALF_WIDTH, DOOR_FRAMES, ROOM, buildColliders } from "../layout";
import { frameD, frameU } from "./math";

export interface PickResult {
  kind: HitKind;
  /** Door index for door / painting / sign hits, otherwise -1. */
  index: number;
  x: number;
  y: number;
  z: number;
}

/** The hit point is pulled this far towards the camera before the wall test. */
const PULL_BACK = 0.25;

export class Picker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hits: THREE.Intersection[] = [];
  private readonly result: PickResult = { kind: "floor", index: -1, x: 0, y: 0, z: 0 };
  private readonly walls: Segment[] = buildColliders().segments;

  constructor() {
    this.raycaster.far = 90;
  }

  /**
   * What is under the client-space point, or null. The returned object is
   * reused by the next call.
   */
  pick(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    pickables: THREE.Object3D[],
  ): PickResult | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.hits;
    hits.length = 0;
    this.raycaster.intersectObjects(pickables, true, hits);
    if (hits.length === 0) return null;

    // Nearest surface wins. An untagged pickable is simply an occluder.
    const hit = hits[0];
    const tag = findTag(hit.object);
    hits.length = 0; // do not keep scene objects alive through the array
    if (!tag) return null;
    const p = hit.point;
    if (this.behindWall(camera.position, p)) return null;
    const out = this.result;
    out.kind = tag.kind;
    out.index = tag.index ?? -1;
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    return out;
  }

  private behindWall(eye: THREE.Vector3, p: THREE.Vector3): boolean {
    const ex = p.x - eye.x;
    const ez = p.z - eye.z;
    const len = Math.hypot(ex, ez);
    if (len > PULL_BACK + 0.05) {
      const k = (len - PULL_BACK) / len;
      const qx = eye.x + ex * k;
      const qz = eye.z + ez * k;
      const walls = this.walls;
      for (let i = 0; i < walls.length; i++) {
        const s = walls[i];
        if (segmentsCross(eye.x, eye.z, qx, qz, s.ax, s.az, s.bx, s.bz)) return true;
      }
    }
    // through a doorway: the ray must clear the lintel at the wall face
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      const hitD = frameD(f, p.x, p.z);
      if (hitD < 0.05 || hitD > ALCOVE_BACK + 0.3) continue;
      if (Math.abs(frameU(f, p.x, p.z)) > ALCOVE_HALF_WIDTH + 0.2) continue;
      const eyeD = frameD(f, eye.x, eye.z);
      if (eyeD >= 0) continue;
      const t = -eyeD / (hitD - eyeD);
      if (eye.y + (p.y - eye.y) * t > ROOM.doorHeight) return true;
    }
    return false;
  }
}

function findTag(object: THREE.Object3D | null): HitTag | null {
  for (let o = object; o; o = o.parent) {
    const tag = o.userData.hit as HitTag | undefined;
    if (tag && typeof tag.kind === "string") return tag;
  }
  return null;
}

/** Proper intersection test of segments P1P2 and P3P4 on the ground plane. */
function segmentsCross(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  x3: number,
  z3: number,
  x4: number,
  z4: number,
): boolean {
  const d1 = (x4 - x3) * (z1 - z3) - (z4 - z3) * (x1 - x3);
  const d2 = (x4 - x3) * (z2 - z3) - (z4 - z3) * (x2 - x3);
  if (d1 * d2 >= 0) return false;
  const d3 = (x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1);
  const d4 = (x2 - x1) * (z4 - z1) - (z2 - z1) * (x4 - x1);
  return d3 * d4 < 0;
}

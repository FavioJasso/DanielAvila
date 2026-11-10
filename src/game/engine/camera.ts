/**
 * Camera rig. Every shot is expressed as a wanted pose (position, look-at
 * target, field of view); the rig glides towards it with a critically damped
 * spring, or cuts. That one mechanism covers the title orbit, the intro
 * swoop, the follow camera, the door framing shot and the dive push-in, and
 * makes every transition between them smooth for free.
 *
 * The camera never leaves the lobby octagon in normal play, so it can never
 * see the outside of the room: in the follow shot it sits between the avatar
 * and the middle of the room, and when the avatar walks into an alcove it
 * stays in the lobby on that door's axis and looks in through the doorway.
 */
import * as THREE from "three";
import {
  ALCOVE_BACK,
  ARCH_DEPTH,
  DOOR_FRAMES,
  PEDESTAL,
  PLAIN_WALL_BEARINGS_DEG,
  ROOM,
  STAND_D,
  wallFrame,
} from "../layout";
import {
  angleDelta,
  clamp,
  damp,
  frameD,
  frameU,
  frameX,
  frameZ,
  lerp,
  smoothstep,
  wrapAngle,
} from "./math";

/** Pose layout in the Float64Arrays below. */
const PX = 0;
const PY = 1;
const PZ = 2;
const TX = 3;
const TY = 4;
const TZ = 5;
const FOV = 6;
const N = 7;

/**
 * The follow camera looks along the line from this point through the avatar.
 * It lies south of the spawn point, so in most of the room the camera is
 * behind the avatar looking north towards the doors (fanning out to the
 * sides), while an avatar that walks down to the south wall gets a camera
 * that turns to show that wall instead of being crushed against it.
 */
const PIVOT_X = 0;
const PIVOT_Z = 7;
/** The follow direction turns no faster than this (rad/s): no whip pans. */
const FOLLOW_TURN_MAX = 2.6;
const FOLLOW_TURN_RATE = 7;
/** Camera stays this far inside the lobby walls. */
const WALL_MARGIN = 0.8;
/** Depth of the push-in shot: just in front of the canvas. */
const PUSH_D = ALCOVE_BACK - 0.95;
/** Sight line keeps this clear of the pedestal and its star. */
const PEDESTAL_CLEAR = 1.6;
/** The eye stays at least this far (on the ground plan) from the star. */
const PEDESTAL_KEEP_OUT = 1.9;
/** Highest the eye may go: well under the top of the walls. */
const CEILING_Y = ROOM.wallHeight - 1.4;
/** Hard limit for the eye whatever the spring or the shake does. */
const EYE_MAX_Y = ROOM.wallHeight - 0.6;

const WALL_NORMALS = [
  ...DOOR_FRAMES.map((f) => f.dir),
  ...PLAIN_WALL_BEARINGS_DEG.map((b) => wallFrame(b).dir),
];

export const SHOT_NONE = 0;
/** Close on the painting: the dive push-in and the fast-travel cut. */
export const SHOT_PUSH = 1;
/** In front of the doorway looking in: where the exit shot starts. */
export const SHOT_EXIT = 2;
/** Front three-quarter view of the avatar and the pedestal star. */
export const SHOT_STAR = 3;
export type ShotKind =
  | typeof SHOT_NONE
  | typeof SHOT_PUSH
  | typeof SHOT_EXIT
  | typeof SHOT_STAR;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.2, 90);

  /** User orbit (canvas drag), radians. Applied to the follow shot only. */
  orbitYaw = 0;
  orbitPitch = 0;

  /** Unit ground direction the camera looks along (movement is relative to it). */
  forwardX = 0;
  forwardZ = -1;

  private readonly cur = new Float64Array(N);
  private readonly vel = new Float64Array(N);
  private readonly des = new Float64Array(N);
  private readonly look = new THREE.Vector3();
  /** 0 on wide screens → 1 on tall phone screens. */
  private portrait = 0;
  /** Bearing (0 = north, clockwise) the follow shot currently looks along. */
  private followYaw = 0;
  private followReady = false;
  /** Smoothed share of the avatar's jump height the camera follows. */
  private lift = 0;
  private dodgeSide = 1;
  private shakeAmp = 0;
  private shakeTime = 0;
  private started = false;

  setAspect(aspect: number): void {
    this.portrait = 1 - smoothstep(0.55, 1.3, aspect);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  get x(): number {
    return this.cur[PX];
  }
  get y(): number {
    return this.cur[PY];
  }
  get z(): number {
    return this.cur[PZ];
  }

  /* ------------------------------------------------------------------ */
  /* Shots — each writes the wanted pose                                 */
  /* ------------------------------------------------------------------ */

  /** Slow orbit of the lobby around the pedestal star. */
  aimTitle(time: number): void {
    const d = this.des;
    const p = this.portrait;
    const a = 0.55 + time * 0.14;
    const r = lerp(7.6, 8.6, p);
    d[PX] = Math.sin(a) * r;
    d[PY] = lerp(4.3, 5.0, p) + Math.sin(time * 0.33) * 0.25;
    d[PZ] = Math.cos(a) * r;
    d[TX] = PEDESTAL.x;
    d[TY] = 2.1;
    d[TZ] = PEDESTAL.z;
    d[FOV] = lerp(56, 80, p);
  }

  /** Third-person follow of the avatar at (ax, ay, az). */
  aimFollow(ax: number, ay: number, az: number, dt: number): void {
    const d = this.des;
    const p = this.portrait;
    const dist = lerp(6.2, 7.4, p);
    const height = lerp(3.0, 3.9, p);
    this.lift += (ay * 0.55 - this.lift) * damp(7, dt);

    // 1. look direction on the ground: away from the pivot …
    let vx = ax - PIVOT_X;
    let vz = az - PIVOT_Z;
    let len = Math.hypot(vx, vz);
    if (len < 0.3) {
      // standing on the pivot: keep looking the way we were
      vx = Math.sin(this.followYaw);
      vz = -Math.cos(this.followYaw);
    } else {
      vx /= len;
      vz /= len;
    }

    // 2. … turning to face a door squarely as the avatar gets near it
    let weight = 0;
    let sx = 0;
    let sz = 0;
    let alcove = -1;
    let inAlcove = 0;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      const u = frameU(f, ax, az);
      const dd = frameD(f, ax, az);
      const w = 1 - smoothstep(3.6, 7.0, Math.hypot(u, dd - ARCH_DEPTH));
      if (w > 0) {
        sx += f.dir.x * w;
        sz += f.dir.z * w;
        weight += w;
      }
      if (Math.abs(u) < 2.6 && dd > -2.4) {
        const s = smoothstep(-2.4, 0.2, dd);
        if (s > inAlcove) {
          inAlcove = s;
          alcove = i;
        }
      }
    }
    if (weight > 0) {
      const k = Math.min(1, weight);
      vx = vx * (1 - k) + (sx / weight) * k;
      vz = vz * (1 - k) + (sz / weight) * k;
    }
    if (alcove >= 0) {
      const f = DOOR_FRAMES[alcove];
      vx = lerp(vx, f.dir.x, inAlcove);
      vz = lerp(vz, f.dir.z, inAlcove);
    }

    // The direction eases round at a limited rate, so passing the pivot
    // (or brushing past a door) turns the camera instead of snapping it.
    const wantYaw = Math.atan2(vx, -vz);
    if (!this.followReady) {
      this.followReady = true;
      this.followYaw = wantYaw;
    } else {
      const turn = angleDelta(this.followYaw, wantYaw) * damp(FOLLOW_TURN_RATE, dt);
      const maxTurn = FOLLOW_TURN_MAX * dt;
      this.followYaw = wrapAngle(this.followYaw + clamp(turn, -maxTurn, maxTurn));
    }
    vx = Math.sin(this.followYaw);
    vz = -Math.cos(this.followYaw);

    // 3. user orbit (not while looking into an alcove: it must stay on axis)
    const orbit = this.orbitYaw * (1 - inAlcove);
    if (orbit !== 0) {
      const c = Math.cos(orbit);
      const s = Math.sin(orbit);
      const rx = vx * c - vz * s;
      vz = vx * s + vz * c;
      vx = rx;
    }

    // 4. camera on the ground plane, behind the avatar
    let cx = ax - vx * dist;
    let cz = az - vz * dist;

    // 5. alcove: slide onto the door's axis and stay out in the lobby, so
    //    the view goes through the doorway instead of through a jamb
    if (alcove >= 0) {
      const f = DOOR_FRAMES[alcove];
      let cu = frameU(f, cx, cz);
      let cd = frameD(f, cx, cz);
      cu *= 1 - 0.9 * inAlcove;
      const maxD = -1.8;
      if (cd > maxD) cd -= (cd - maxD) * inAlcove;
      cx = frameX(f, cu, cd);
      cz = frameZ(f, cu, cd);
    }

    // 6. step sideways if the pedestal and its star are in the line of sight
    {
      let lx = ax - cx;
      let lz = az - cz;
      const sight = Math.hypot(lx, lz) || 1;
      lx /= sight;
      lz /= sight;
      const relX = PEDESTAL.x - cx;
      const relZ = PEDESTAL.z - cz;
      const along = relX * lx + relZ * lz;
      const side = relX * -lz + relZ * lx;
      if (along > -0.6 && along < sight - 0.5) {
        if (Math.abs(side) > 0.25) this.dodgeSide = side > 0 ? 1 : -1;
        const need = PEDESTAL_CLEAR - Math.abs(side);
        if (need > 0) {
          // fade in and out along the sight line so the dodge never pops
          const fade =
            smoothstep(-0.6, 0.4, along) * (1 - smoothstep(sight - 1.7, sight - 0.5, along));
          const move =
            Math.min((need * sight) / Math.max(1.2, sight - along), dist * 0.7) * fade;
          cx -= this.dodgeSide * -lz * move;
          cz -= this.dodgeSide * lx * move;
          // keep the distance to the avatar
          const ex = cx - ax;
          const ez = cz - az;
          const el = Math.hypot(ex, ez) || 1;
          cx = ax + (ex / el) * sight;
          cz = az + (ez / el) * sight;
        }
      }
    }

    // 7. never leave the lobby
    const limit = ROOM.apothem - WALL_MARGIN;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < WALL_NORMALS.length; i++) {
        const n = WALL_NORMALS[i];
        const over = cx * n.x + cz * n.z - limit;
        if (over > 0) {
          cx -= n.x * over;
          cz -= n.z * over;
        }
      }
    }

    // 8. squeezed against a wall → rise and look down instead
    let lx = ax - cx;
    let lz = az - cz;
    const real = Math.hypot(lx, lz) || 1;
    lx /= real;
    lz /= real;
    const squeeze = Math.max(0, dist - real);
    const ahead = lerp(1.5, 0.3, Math.min(1, squeeze / 3));
    d[PX] = cx;
    // Rising while squeezed, a dragged-up pitch and a jump all add height;
    // together they must not lift the eye to the top of the walls.
    // A squeezed camera already looks down steeply, so the dragged pitch
    // fades out as it is pushed in.
    const pitchLift = this.orbitPitch * 4 * (1 - Math.min(1, squeeze / 3));
    d[PY] = Math.min(
      CEILING_Y,
      this.lift + height + Math.min(squeeze * 0.55, 1.8) + pitchLift,
    );
    d[PZ] = cz;
    d[TX] = ax + lx * ahead;
    d[TY] = this.lift + 1.3 - squeeze * 0.12;
    d[TZ] = az + lz * ahead;
    d[FOV] = lerp(52, 74, p);
  }

  /**
   * Blend the wanted pose towards the guided door shot: behind the stand
   * point, over the avatar's right shoulder, the doorway and the painting
   * filling the middle of the frame. `amount` 0..1.
   */
  blendDoorShot(index: number, amount: number): void {
    if (amount <= 0) return;
    const f = DOOR_FRAMES[index];
    const d = this.des;
    const p = this.portrait;
    // Far enough back to show the avatar from the knees up beside the
    // doorway, with the floating sign and the painting both in frame.
    const back = STAND_D - lerp(4.7, 5.4, p);
    const side = lerp(1.25, 0.8, p);
    const k = amount >= 1 ? 1 : amount;
    d[PX] = lerp(d[PX], frameX(f, side, back), k);
    d[PY] = lerp(d[PY], lerp(2.75, 3.0, p), k);
    d[PZ] = lerp(d[PZ], frameZ(f, side, back), k);
    d[TX] = lerp(d[TX], frameX(f, -0.15, 0.8), k);
    d[TY] = lerp(d[TY], lerp(2.3, 2.35, p), k);
    d[TZ] = lerp(d[TZ], frameZ(f, -0.15, 0.8), k);
    d[FOV] = lerp(d[FOV], lerp(57, 70, p), k);
  }

  /** How strongly the door shot applies for an avatar at (ax, az). */
  doorShotAmount(index: number, ax: number, az: number): number {
    const f = DOOR_FRAMES[index];
    const u = frameU(f, ax, az);
    // only the distance still to go counts: past the stand point is "there"
    const short = Math.min(0, frameD(f, ax, az) - STAND_D);
    return 1 - smoothstep(1.2, 5.5, Math.hypot(u, short));
  }

  /** A fixed scripted shot. */
  aimShot(kind: ShotKind, index: number): void {
    const d = this.des;
    const p = this.portrait;
    if (kind === SHOT_STAR) {
      // avatar on one side, star on the other, seen from beside the pedestal
      d[PX] = lerp(3.3, 3.9, p);
      d[PY] = lerp(1.35, 1.5, p);
      d[PZ] = lerp(-1.1, -1.3, p);
      d[TX] = 0.1;
      d[TY] = 1.75;
      d[TZ] = 0.75;
      d[FOV] = lerp(50, 74, p);
      return;
    }
    const f = DOOR_FRAMES[index];
    if (kind === SHOT_PUSH) {
      // So close that the canvas fills the screen for the white flash, and
      // beyond the arc the door leaf sweeps while it swings open (fast
      // travel cuts here before the door has finished opening).
      d[PX] = frameX(f, 0, PUSH_D);
      d[PY] = ROOM.paintingCenterY;
      d[PZ] = frameZ(f, 0, PUSH_D);
      d[TX] = f.painting.x;
      d[TY] = f.painting.y;
      d[TZ] = f.painting.z;
      d[FOV] = lerp(50, 72, p);
    } else {
      d[PX] = frameX(f, 0.9, -1.3);
      d[PY] = 2.3;
      d[PZ] = frameZ(f, 0.9, -1.3);
      d[TX] = frameX(f, 0, ALCOVE_BACK);
      d[TY] = 1.9;
      d[TZ] = frameZ(f, 0, ALCOVE_BACK);
      d[FOV] = lerp(54, 74, p);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Motion                                                              */
  /* ------------------------------------------------------------------ */

  /** Start a short decaying shake (dive impact, hard landing). */
  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  /**
   * Forget the follow direction, so the next follow shot starts from where
   * the avatar is now (after a teleport or a cut) instead of turning to it.
   */
  resetFollow(): void {
    this.followReady = false;
  }

  /** Jump straight to the wanted pose. */
  cut(): void {
    this.cur.set(this.des);
    this.vel.fill(0);
    this.started = true;
    this.keepOffPedestal();
    this.apply(0);
  }

  /**
   * Glide towards the wanted pose. `smoothTime` is roughly the time to get
   * most of the way there; 0 means follow rigidly.
   */
  update(dt: number, smoothTime: number): void {
    if (!this.started || smoothTime <= 0 || dt <= 0) {
      if (!this.started || smoothTime <= 0) {
        this.cur.set(this.des);
        this.vel.fill(0);
        this.started = true;
      }
      this.apply(dt);
      return;
    }
    // critically damped spring (the classic "smooth damp")
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const cur = this.cur;
    const vel = this.vel;
    const des = this.des;
    for (let i = 0; i < N; i++) {
      const change = cur[i] - des[i];
      const temp = (vel[i] + omega * change) * dt;
      vel[i] = (vel[i] - omega * temp) * decay;
      cur[i] = des[i] + (change + temp) * decay;
    }
    this.keepOffPedestal();
    this.apply(dt);
  }

  /**
   * The eye never passes over the pedestal: a travelling shot that cuts
   * across the middle of the room slides round the star instead of
   * flying through it.
   */
  private keepOffPedestal(): void {
    const cur = this.cur;
    const vel = this.vel;
    const rx = cur[PX] - PEDESTAL.x;
    const rz = cur[PZ] - PEDESTAL.z;
    const r = Math.hypot(rx, rz);
    if (r >= PEDESTAL_KEEP_OUT) return;
    let nx = 1;
    let nz = 0;
    if (r > 1e-5) {
      nx = rx / r;
      nz = rz / r;
    }
    cur[PX] = PEDESTAL.x + nx * PEDESTAL_KEEP_OUT;
    cur[PZ] = PEDESTAL.z + nz * PEDESTAL_KEEP_OUT;
    const vn = vel[PX] * nx + vel[PZ] * nz;
    if (vn < 0) {
      vel[PX] -= vn * nx;
      vel[PZ] -= vn * nz;
    }
  }

  private apply(dt: number): void {
    const c = this.cur;
    const cam = this.camera;
    let ox = 0;
    let oy = 0;
    if (this.shakeAmp > 0.001) {
      this.shakeTime += dt;
      ox = Math.sin(this.shakeTime * 53) * this.shakeAmp;
      oy = Math.sin(this.shakeTime * 71 + 1.3) * this.shakeAmp;
      this.shakeAmp *= Math.exp(-dt * 9);
    } else {
      this.shakeAmp = 0;
    }
    // keep the eye above the floor whatever the spring does
    cam.position.set(c[PX] + ox, clamp(c[PY] + oy, 0.4, EYE_MAX_Y), c[PZ]);
    this.look.set(c[TX], c[TY] + oy * 0.5, c[TZ]);
    cam.lookAt(this.look);
    const fov = clamp(c[FOV], 20, 100);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const fx = c[TX] - c[PX];
    const fz = c[TZ] - c[PZ];
    const fl = Math.hypot(fx, fz);
    if (fl > 1e-4) {
      this.forwardX = fx / fl;
      this.forwardZ = fz / fl;
    }
  }
}

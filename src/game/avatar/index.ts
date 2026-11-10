/**
 * Daniel 64 — the player avatar.
 *
 * A 671-triangle flat-shaded puppet (model.ts, geometry.ts, textures.ts)
 * driven by procedural pose functions (poses.ts, rig.ts), with a blob
 * shadow, dust puffs, sleepy "Z"s and sparkles in world space (effects.ts).
 * 15 draw calls for the figure, one for the shadow, one for all particles.
 *
 * Contract notes (see src/game/contract.ts):
 * - the engine owns `root.position` and `root.rotation.y`; this module only
 *   moves children of `root`, and reads the root transform to place effects;
 * - `play()` of the current animation is a no-op unless `restart` is set;
 * - one-shots run for `duration(name)` seconds and then hold their last pose;
 * - `update()` allocates nothing.
 */
import * as THREE from "three";
import type { Avatar, AvatarAnim, CreateAvatar } from "../contract";
import { createParticles, createShadow } from "./effects";
import { buildModel, countTriangles } from "./model";
import {
  DURATIONS,
  FOOTFALL_PHASE,
  SLEEP_AT,
  STAR_STRIKE_AT,
  glanceAt,
  poseBackflip,
  poseDive,
  poseFall,
  poseIdle,
  poseJump,
  poseLand,
  posePush,
  poseRun,
  poseStar,
  runRate,
  smooth,
} from "./poses";
import { applyPose, DIM, J, POSE_SIZE, WRAPPED_CHANNELS } from "./rig";
import { FX_CELL } from "./textures";

export { countTriangles };

const TAU = Math.PI * 2;

/** Cross-fade into each animation, in seconds. */
const BLEND_IN: Record<AvatarAnim, number> = {
  idle: 0.15,
  run: 0.12,
  jump: 0.1,
  fall: 0.15,
  land: 0.08,
  push: 0.1,
  dive: 0.1,
  backflip: 0.1,
  starPose: 0.12,
};
/** Getting up off the floor takes a little longer than any other change. */
const BLEND_FROM_SEAT = 0.3;
const SIT_DOWN_TIME = 1.1;
const STAND_UP_TIME = 0.5;
const PARTICLE_CAPACITY = 32;

const wrapAngle = (a: number): number => a - TAU * Math.round(a / TAU);
/** True when `at` (mod 2π) lies in the phase interval (from, to]. */
const crossed = (from: number, to: number, at: number): boolean =>
  Math.floor((to - at) / TAU) > Math.floor((from - at) / TAU);

export const createAvatar: CreateAvatar = (opts) => {
  const model = buildModel();
  const { root, rig } = model;
  const shadow = createShadow();
  const particles = createParticles(model.textures.effects, PARTICLE_CAPACITY);
  const effects = new THREE.Group();
  effects.name = "daniel-64-effects";
  effects.add(shadow.mesh, particles.mesh);

  const reduced = opts.reducedMotion;
  /** Bounce / squash amplitude. */
  const amp = reduced ? 0.35 : 1;
  const dustPerStep = reduced || opts.quality === "low" ? 1 : 2;

  let anim: AvatarAnim = "idle";
  /** Seconds since the current animation started. */
  let animT = 0;
  /** Seconds of uninterrupted idle; drives the glance and the nap. */
  let idleT = 0;
  /** Free-running clock for breathing and blinking. */
  let clock = 0;
  let speed = 0;
  let speedNow = 0;
  let runPhase = 0;
  let steps = 0;
  /** 0 = standing … 1 = seated (linear; eased when applied). */
  let sit = 0;
  let glance = 0;
  let blendT = 0;
  let blendDur = 0;
  let eyesClosed = false;
  let zTimer = 0;
  let zCount = 0;
  /** How many of the star-pose sparkle bursts have fired. */
  let starStage = 0;
  let landPuffs = false;
  let jumpPuffs = false;

  // deterministic noise so the effects are repeatable in screenshots
  let seed = 0x9e3779b9;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const from = new Float32Array(POSE_SIZE);
  const target = new Float32Array(POSE_SIZE);
  const shown = new Float32Array(POSE_SIZE);
  const at = new THREE.Vector3();

  poseIdle(shown, 0, 0, 0, amp);
  applyPose(rig, shown);

  /* ---------------- effects ---------------- */

  const spec = particles.spec;

  function dustAt(x: number, z: number, vx: number, vz: number, size: number): void {
    spec.cell = FX_CELL.dust;
    spec.x = x;
    spec.y = 0.07;
    spec.z = z;
    spec.vx = vx;
    spec.vy = 0.3 + rand() * 0.25;
    spec.vz = vz;
    spec.life = 0.34 + rand() * 0.14;
    spec.size0 = size * 0.4;
    spec.size1 = size;
    spec.rot = rand() * TAU;
    spec.spin = (rand() - 0.5) * 3;
    // mostly opaque, fading only at the very end: a long translucent fade turns
    // the white puffs pink on the red carpet
    spec.alpha = 1;
    spec.fadeIn = 0.05;
    spec.fadeOut = 0.3;
    spec.drag = 2.6;
    spec.wobble = 0;
    particles.spawn();
  }

  /** Kick up dust behind the foot that just landed. */
  function footfall(sole: THREE.Object3D): void {
    steps++;
    if (reduced && steps % 2 === 0) return;
    sole.getWorldPosition(at);
    const yaw = root.rotation.y;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const back = 0.5 + 0.7 * speedNow;
    for (let i = 0; i < dustPerStep; i++) {
      const side = (rand() - 0.5) * 0.7;
      dustAt(
        at.x - fx * 0.05 * i,
        at.z - fz * 0.05 * i,
        -fx * back + fz * side,
        -fz * back - fx * side,
        (0.24 + 0.1 * speedNow) * (i === 0 ? 1 : 0.7),
      );
    }
  }

  /** A ring of puffs around the feet (landing, take-off). */
  function puffRing(count: number, size: number, push: number): void {
    const x = root.position.x;
    const z = root.position.z;
    const start = root.rotation.y + rand() * TAU;
    for (let i = 0; i < count; i++) {
      const a = start + (i / count) * TAU;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      dustAt(x + sx * 0.2, z + sz * 0.2, sx * push, sz * push, size);
    }
  }

  function spawnZ(): void {
    rig.mouth.getWorldPosition(at);
    const yaw = root.rotation.y;
    // drift up and towards his left
    const lx = Math.cos(yaw);
    const lz = -Math.sin(yaw);
    spec.cell = FX_CELL.z;
    spec.x = at.x + lx * 0.1;
    spec.y = at.y + 0.08;
    spec.z = at.z + lz * 0.1;
    spec.vx = lx * 0.13;
    spec.vy = 0.3;
    spec.vz = lz * 0.13;
    spec.life = 2.6;
    spec.size0 = 0.12;
    spec.size1 = 0.34;
    spec.rot = zCount % 2 === 0 ? -0.3 : -0.1;
    spec.spin = 0.1;
    spec.alpha = 1;
    spec.fadeIn = 0.08;
    spec.fadeOut = 0.35;
    spec.drag = 0.12;
    spec.wobble = reduced ? 0 : 0.07;
    spec.wx = lx;
    spec.wz = lz;
    zCount++;
    particles.spawn();
  }

  /** Sparkles fanning out above the raised hand. */
  function sparkle(count: number, power: number): void {
    rig.handR.getWorldPosition(at);
    const yaw = root.rotation.y;
    const lx = Math.cos(yaw);
    const lz = -Math.sin(yaw);
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? (rand() - 0.5) * 2 : (i / (count - 1) - 0.5) * 2.6;
      const out = Math.sin(a) * power;
      const depth = (rand() - 0.5) * 0.5 * power;
      spec.cell = i % 3 === 2 ? FX_CELL.glint : FX_CELL.sparkle;
      spec.x = at.x;
      spec.y = at.y + 0.1;
      spec.z = at.z;
      spec.vx = lx * out - lz * depth;
      spec.vy = (0.5 + Math.cos(a) * 0.9) * power;
      spec.vz = lz * out + lx * depth;
      spec.life = 0.55 + rand() * 0.3;
      spec.size0 = 0.34;
      spec.size1 = 0.08;
      spec.rot = rand() * TAU;
      spec.spin = 3.5;
      spec.alpha = 1;
      spec.fadeIn = 0;
      spec.fadeOut = 0.35;
      spec.drag = 2.4;
      spec.wobble = 0;
      particles.spawn();
    }
  }

  /* ---------------- public ---------------- */

  const avatar: Avatar = {
    root,
    effects,
    height: DIM.height,
    get anim() {
      return anim;
    },
    get sleeping() {
      return anim === "idle" && idleT >= SLEEP_AT;
    },
    play(next, playOpts) {
      if (next === anim && !playOpts?.restart) return;
      // blend from whatever is on screen right now; full turns left over from
      // a flip or a spin are unwound first so the blend takes the short way
      from.set(shown);
      for (let i = 0; i < WRAPPED_CHANNELS.length; i++) {
        const c = WRAPPED_CHANNELS[i];
        from[c] = wrapAngle(from[c]);
      }
      blendDur = sit > 0.5 ? BLEND_FROM_SEAT : BLEND_IN[next];
      blendT = 0;
      if (sit > 0) particles.hurry(FX_CELL.z, 0.3);
      anim = next;
      animT = 0;
      idleT = 0;
      sit = 0;
      starStage = 0;
      landPuffs = next === "land";
      jumpPuffs = next === "jump";
    },
    setMoveSpeed(v) {
      speed = v < 0 ? 0 : v > 1 ? 1 : v;
    },
    wake() {
      idleT = 0;
      if (sit > 0) particles.hurry(FX_CELL.z, 0.3);
    },
    duration: (name) => DURATIONS[name],
    update(frameDt) {
      const dt = frameDt > 0 ? (frameDt > 0.1 ? 0.1 : frameDt) : 0;
      clock += dt;
      animT += dt;
      const idle = anim === "idle";
      if (idle) idleT += dt;

      // idle sub-states ease in and out on their own, so wake() never pops
      if (idle && idleT >= SLEEP_AT) sit = Math.min(1, sit + dt / SIT_DOWN_TIME);
      else if (sit > 0) sit = Math.max(0, sit - dt / STAND_UP_TIME);
      glance += ((idle ? glanceAt(idleT) : 0) - glance) * Math.min(1, dt * 14);
      speedNow += (speed - speedNow) * Math.min(1, dt * 10);

      const phaseBefore = runPhase;
      switch (anim) {
        case "idle":
          poseIdle(target, clock, glance, smooth(sit), amp);
          break;
        case "run":
          runPhase += dt * TAU * runRate(speedNow);
          poseRun(target, runPhase, speedNow, amp);
          break;
        case "jump":
          poseJump(target, animT, amp);
          break;
        case "fall":
          poseFall(target, animT, amp);
          break;
        case "land":
          poseLand(target, Math.min(animT, DURATIONS.land), amp);
          break;
        case "push":
          posePush(target, Math.min(animT, DURATIONS.push));
          break;
        case "dive":
          poseDive(target, Math.min(animT, DURATIONS.dive));
          break;
        case "backflip":
          poseBackflip(target, Math.min(animT, DURATIONS.backflip));
          break;
        case "starPose":
          poseStar(target, Math.min(animT, DURATIONS.starPose), amp, !reduced);
          break;
      }

      if (blendT < blendDur) {
        blendT += dt;
        const w = smooth(blendT / blendDur);
        for (let i = 0; i < POSE_SIZE; i++) shown[i] = from[i] + (target[i] - from[i]) * w;
      } else {
        shown.set(target);
      }
      applyPose(rig, shown);

      // eyes: irregular blinks from two out-of-step cycles; shut while dozing
      const closed = clock % 3.7 < 0.12 || (clock + 1.3) % 6.1 < 0.12 || sit > 0.6;
      if (closed !== eyesClosed) {
        eyesClosed = closed;
        model.faceMaterial.map = closed ? model.textures.faceClosed : model.textures.faceOpen;
      }

      const visible = root.visible;
      const grounded = root.position.y < 0.05;

      if (anim === "run" && visible && grounded && speedNow > 0.3) {
        if (crossed(phaseBefore, runPhase, FOOTFALL_PHASE)) footfall(rig.soleL);
        if (crossed(phaseBefore + Math.PI, runPhase + Math.PI, FOOTFALL_PHASE)) footfall(rig.soleR);
      }
      if (landPuffs) {
        landPuffs = false;
        if (visible && root.position.y < 0.3) puffRing(reduced ? 2 : 4, 0.3, 1.1);
      }
      if (jumpPuffs) {
        jumpPuffs = false;
        if (visible && root.position.y < 0.3 && !reduced) puffRing(2, 0.24, 0.7);
      }

      if (idle && sit >= 1 && visible) {
        zTimer -= dt;
        if (zTimer <= 0) {
          zTimer = reduced ? 2.4 : 1.15;
          spawnZ();
        }
      } else {
        zTimer = 0.3;
        zCount = 0;
      }

      if (anim === "starPose" && visible) {
        if (starStage === 0 && animT >= STAR_STRIKE_AT) {
          starStage = 1;
          sparkle(reduced ? 3 : 7, 1.5);
        } else if (starStage === 1 && animT >= STAR_STRIKE_AT + 0.24) {
          starStage = 2;
          if (!reduced) sparkle(1, 1);
        } else if (starStage === 2 && animT >= STAR_STRIKE_AT + 0.46) {
          starStage = 3;
          if (!reduced) sparkle(1, 0.8);
        }
      }

      particles.update(dt);

      // blob shadow: stays on the floor, shrinks and fades with height
      const hop = shown[J.hipY] > 0 ? shown[J.hipY] : 0;
      shadow.mesh.visible = visible;
      shadow.set(root.position.x, root.position.z, root.position.y + hop, 1 + 0.2 * smooth(sit));
    },
    dispose() {
      effects.remove(shadow.mesh, particles.mesh);
      shadow.dispose();
      particles.dispose();
      model.dispose();
    },
  };
  return avatar;
};

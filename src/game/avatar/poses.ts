/**
 * Daniel 64 — procedural animation.
 *
 * Every animation is a pure "pose function": given a time (and a few knobs)
 * it writes joint channels into a Float32Array. Nothing here allocates, so
 * the functions can run every frame. Blending between animations happens in
 * index.ts; smooth motion *inside* an animation is the pose function's job.
 *
 * Sign conventions are documented in rig.ts.
 */
import type { AvatarAnim } from "../contract";
import { DIM, J } from "./rig";

const PI = Math.PI;
const TAU = PI * 2;
const LEG = DIM.thigh + DIM.shin;

/** Length of the one-shots, in seconds (0 for looping / held states). */
export const DURATIONS: Record<AvatarAnim, number> = {
  idle: 0,
  run: 0,
  jump: 0,
  fall: 0,
  land: 0.2,
  push: 0.45,
  dive: 0.6,
  backflip: 0.8,
  starPose: 1.6,
};

/** Idle sub-state timing (seconds of continuous idle). */
export const GLANCE_AT = 5;
export const GLANCE_EVERY = 6;
export const SLEEP_AT = 20;
/** When in `starPose` the sparkles fire. */
export const STAR_STRIKE_AT = 0.86;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Smoothstep on an already-normalised value. */
export const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
/** 0 → 1 with a small overshoot, for snappy "strike a pose" moves. */
const easeOutBack = (x: number): number => {
  const t = clamp01(x) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};
/** 0 → 1 → 0 over x ∈ [0, 1]. */
const bump = (x: number): number => Math.sin(PI * clamp01(x));

/** Move channel `i` a fraction `w` of the way to `v`. */
function mix(p: Float32Array, i: number, v: number, w: number): void {
  p[i] += (v - p[i]) * w;
}

/** Relaxed standing pose: the base every animation starts from. */
function stand(p: Float32Array): void {
  p.fill(0);
  p[J.armLZ] = 0.16;
  p[J.armRZ] = -0.16;
  p[J.elbowL] = -0.2;
  p[J.elbowR] = -0.2;
}

/**
 * Bend both knees by `a` radians while the feet stay flat and under the hips
 * (thigh forward a, knee 2a, foot back a; the hips drop to match).
 */
function crouch(p: Float32Array, a: number): void {
  p[J.legLX] -= a;
  p[J.legRX] -= a;
  p[J.kneeL] += 2 * a;
  p[J.kneeR] += 2 * a;
  p[J.footL] -= a;
  p[J.footR] -= a;
  p[J.hipY] -= LEG * (1 - Math.cos(a));
}

/**
 * Two-bone IK in the leg's swing plane, used where a foot has to stay planted.
 * `dz`, `dy`: ankle position relative to the hip joint (forward, up).
 * `footPitch`: world pitch of the foot (0 = flat, negative = toes up).
 * `basePitch`: pitch already applied to the hips.
 */
function legIK(
  p: Float32Array,
  iSwing: number,
  iKnee: number,
  iFoot: number,
  dz: number,
  dy: number,
  footPitch: number,
  basePitch: number,
): void {
  const l1 = DIM.thigh;
  const l2 = DIM.shin;
  const d = clamp(Math.hypot(dz, dy), 0.06, l1 + l2 - 1e-4);
  const flex = PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  const toAnkle = Math.atan2(dz, -dy); // from straight down, forward positive
  const thigh = toAnkle + Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  p[iSwing] = -thigh - basePitch;
  p[iKnee] = flex;
  p[iFoot] = footPitch - (flex - thigh);
}

/* ------------------------------------------------------------------ */
/* Idle: breathe, glance, sit, sleep                                   */
/* ------------------------------------------------------------------ */

/**
 * Glance target for a given idle time: 0 = ahead, +1 = to his left,
 * -1 = to his right. Starts at 5 s, repeats every 6 s, stops for sleep.
 */
export function glanceAt(idleT: number): number {
  if (idleT < GLANCE_AT || idleT >= SLEEP_AT) return 0;
  const u = (idleT - GLANCE_AT) % GLANCE_EVERY;
  if (u < 0.45) return smooth(u / 0.45);
  if (u < 1.15) return 1;
  if (u < 1.85) return 1 - 2 * smooth((u - 1.15) / 0.7);
  if (u < 2.55) return -1;
  if (u < 3) return -1 + smooth((u - 2.55) / 0.45);
  return 0;
}

/** Seated pose: hip-joint height, ankle reach and ankle height. */
const SIT = { hip: 0.125, ankleZ: 0.46, ankleY: 0.14, footPitch: -0.35 } as const;

/**
 * @param breathT  free-running clock for the breathing cycle
 * @param glance   -1..1 (already smoothed by the caller)
 * @param sit      0 = standing … 1 = seated (already eased)
 * @param amp      motion amplitude (1, or less for reduced motion)
 */
export function poseIdle(
  p: Float32Array,
  breathT: number,
  glance: number,
  sit: number,
  amp: number,
): void {
  stand(p);
  const b = Math.sin((breathT * TAU) / 2.7);
  const sway = Math.sin((breathT * TAU) / 7.3) * amp;

  // standing: breathing bounce (soft knees plus a hint of squash and
  // stretch, big enough to survive the low render resolution), slow weight shift
  crouch(p, 0.06 + 0.08 * (0.5 - 0.5 * b) * amp);
  p[J.squash] = 0.008 * b * amp;
  p[J.spineX] = 0.02 + 0.02 * b * amp;
  p[J.headX] = -0.02 * b * amp;
  p[J.armLZ] += 0.03 * b * amp;
  p[J.armRZ] -= 0.03 * b * amp;
  p[J.elbowL] -= 0.04 * b * amp;
  p[J.elbowR] -= 0.04 * b * amp;
  const shift = 0.014 * sway;
  p[J.hipX] = shift;
  p[J.legLZ] = -shift / LEG;
  p[J.legRZ] = -shift / LEG;
  p[J.spineZ] = -0.02 * sway;
  p[J.headZ] = 0.012 * sway;

  // glance: mostly the head, the shoulders follow a little
  p[J.headY] = 0.62 * glance;
  p[J.spineY] = 0.1 * glance;
  p[J.headZ] += 0.05 * glance;
  p[J.headX] -= 0.04 * Math.abs(glance);

  if (sit <= 0) return;

  // sitting down: squat while the feet slide forward (IK keeps them on the
  // floor), then settle on the ground and nod off
  const s = sit;
  const slow = Math.sin((breathT * TAU) / 3.6);
  const lean = -0.08 * s;
  const hipJoint = lerp(DIM.hipY + DIM.hipJointY + p[J.hipY], SIT.hip, s);
  const ankleY = lerp(DIM.ankle, SIT.ankleY, s);
  const ankleZ = SIT.ankleZ * smooth(s * 1.15);
  const hipZ = -0.1 * s;
  p[J.hipY] = hipJoint - (DIM.hipY + DIM.hipJointY);
  p[J.hipZ] = hipZ;
  p[J.pitch] = lean;
  legIK(p, J.legLX, J.kneeL, J.footL, ankleZ - hipZ, ankleY - hipJoint, SIT.footPitch * s, lean);
  legIK(p, J.legRX, J.kneeR, J.footR, ankleZ - hipZ, ankleY - hipJoint, SIT.footPitch * s, lean);
  p[J.legLY] = 0.2 * s;
  p[J.legRY] = -0.2 * s;
  p[J.legLZ] *= 1 - s;
  p[J.legRZ] *= 1 - s;
  p[J.hipX] *= 1 - s;
  mix(p, J.spineX, 0.36 + 0.045 * slow, s);
  mix(p, J.spineY, 0, s);
  mix(p, J.spineZ, 0.03, s);
  mix(p, J.headX, 0.5 + 0.07 * Math.sin((breathT * TAU) / 3.6 - 0.7), s);
  mix(p, J.headY, 0, s);
  mix(p, J.headZ, 0.1, s);
  // hands resting on the knees
  mix(p, J.armLX, -0.85 - 0.03 * slow, s);
  mix(p, J.armRX, -0.85 - 0.03 * slow, s);
  mix(p, J.armLZ, 0.1, s);
  mix(p, J.armRZ, -0.1, s);
  mix(p, J.elbowL, -0.55, s);
  mix(p, J.elbowR, -0.55, s);
  // a little bounce as he lands on the floor
  p[J.squash] = p[J.squash] * (1 - s) - 0.05 * bump((s - 0.72) / 0.28) * amp;
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

/** Phase of the run cycle at which a foot hits the ground (0..2π). */
export const FOOTFALL_PHASE = 2.25;

/** Cycles per second for a given 0..1 move speed. */
export const runRate = (speed: number): number => 1.45 + 1.55 * speed;

function runLeg(
  p: Float32Array,
  iSwing: number,
  iKnee: number,
  iFoot: number,
  q: number,
  stride: number,
  speed: number,
  lean: number,
): void {
  const sq = Math.sin(q);
  // q = π/2: leg fully forward; 3π/2: fully back; the heel kicks up between
  // toe-off and mid-swing
  const recover = Math.pow(0.5 + 0.5 * Math.cos(q + 0.55), 1.6);
  p[iSwing] = -lean * 0.9 - (0.15 + 0.85 * stride) * sq * (sq > 0 ? 1 : 0.8);
  p[iKnee] = 0.12 + (0.5 + 1.3 * speed) * recover;
  p[iFoot] = (0.55 * recover - 0.3 * Math.max(0, sq)) * stride;
}

/**
 * @param phase  accumulated cycle phase in radians (left leg leads at π/2)
 * @param speed  0..1 move speed (already smoothed)
 * @param amp    bounce amplitude (1, or less for reduced motion)
 */
export function poseRun(p: Float32Array, phase: number, speed: number, amp: number): void {
  stand(p);
  const stride = 0.25 + 0.75 * speed;
  const sp = Math.sin(phase);
  const cp = Math.cos(phase);
  const lean = 0.06 + 0.22 * speed;
  /** 0 = pumping jog arms, 1 = arms held out like wings. */
  const wing = smooth((speed - 0.4) / 0.4);

  p[J.pitch] = lean;
  p[J.spineX] = 0.04 + 0.1 * speed;
  p[J.headX] = -(lean + 0.04 + 0.1 * speed) * 0.75;
  // lowest at mid-stance (phase 0 and π), highest in flight
  p[J.hipY] = -0.03 * speed + (0.012 + 0.05 * speed) * amp * (0.5 - 0.5 * Math.cos(2 * phase));
  p[J.yaw] = -0.09 * sp * stride;
  p[J.spineY] = 0.26 * sp * stride * (1 - 0.45 * wing);
  p[J.headY] = -0.15 * sp * stride * (1 - 0.45 * wing);
  p[J.roll] = 0.04 * cp * stride;
  p[J.spineZ] = -0.05 * cp * stride;

  runLeg(p, J.legLX, J.kneeL, J.footL, phase, stride, speed, lean);
  runLeg(p, J.legRX, J.kneeR, J.footR, phase + PI, stride, speed, lean);

  // arms: opposite to the legs when jogging; out and swept back when sprinting
  const pump = 0.85 * stride * sp;
  const jogElbow = -(0.9 + 0.5 * speed);
  p[J.armLX] = lerp(pump, 0.5 + 0.1 * sp, wing);
  p[J.armRX] = lerp(-pump, 0.5 - 0.1 * sp, wing);
  p[J.armLZ] = lerp(0.2, 1.12 + 0.1 * cp, wing);
  p[J.armRZ] = -lerp(0.2, 1.12 - 0.1 * cp, wing);
  p[J.elbowL] = lerp(jogElbow, -0.22, wing);
  p[J.elbowR] = lerp(jogElbow, -0.22, wing);
}

/* ------------------------------------------------------------------ */
/* Airborne                                                            */
/* ------------------------------------------------------------------ */

/** Rising: arms thrown up, legs tucked a little. */
export function poseJump(p: Float32Array, t: number, amp: number): void {
  stand(p);
  const launch = 1 - smooth(t / 0.22);
  p[J.squash] = 0.02 + 0.1 * launch * amp;
  p[J.pitch] = -0.05;
  p[J.spineX] = -0.1;
  p[J.headX] = -0.22;
  p[J.armLX] = -2.75;
  p[J.armLZ] = -0.28;
  p[J.elbowL] = -0.2;
  p[J.armRX] = -2.45;
  p[J.armRZ] = 0.36;
  p[J.elbowR] = -0.5;
  p[J.legLX] = -0.85;
  p[J.kneeL] = 1.35;
  p[J.footL] = 0.35;
  p[J.legRX] = 0.12;
  p[J.kneeR] = 0.75;
  p[J.footR] = 0.55;
}

/** Falling: arms flung up and out (with a little flutter), legs trailing. */
export function poseFall(p: Float32Array, t: number, amp: number): void {
  stand(p);
  const flap = Math.sin(t * 13) * 0.12 * amp;
  p[J.pitch] = 0.14;
  p[J.spineX] = 0.1;
  p[J.headX] = 0.12;
  p[J.armLZ] = 2.2 + flap;
  p[J.armRZ] = -(1.95 - flap);
  p[J.armLX] = -0.25;
  p[J.armRX] = -0.35;
  p[J.elbowL] = -0.5;
  p[J.elbowR] = -0.75;
  p[J.legLX] = 0.32;
  p[J.legLZ] = 0.16;
  p[J.kneeL] = 0.75;
  p[J.footL] = 0.55;
  p[J.legRX] = -0.22;
  p[J.legRZ] = -0.2;
  p[J.kneeR] = 0.5;
  p[J.footR] = 0.45;
}

/** Touch-down: a quick squash (deepest at 0.07 s) that recovers to standing. */
export function poseLand(p: Float32Array, t: number, amp: number): void {
  stand(p);
  const k = (t < 0.07 ? easeOut(t / 0.07) : 1 - smooth((t - 0.07) / 0.13)) * (0.45 + 0.55 * amp);
  crouch(p, 0.62 * k);
  p[J.squash] = -0.14 * k;
  p[J.spineX] = 0.28 * k;
  p[J.headX] = -0.12 * k;
  p[J.armLZ] += 0.75 * k;
  p[J.armRZ] -= 0.75 * k;
  p[J.armLX] = 0.2 * k;
  p[J.armRX] = 0.2 * k;
  p[J.elbowL] -= 0.35 * k;
  p[J.elbowR] -= 0.35 * k;
}

/* ------------------------------------------------------------------ */
/* One-shots                                                           */
/* ------------------------------------------------------------------ */

const PUSH_TWIST = -1.0;

/** Both hands reach forward, then the body leans in behind them. */
export function posePush(p: Float32Array, t: number): void {
  stand(p);
  const reach = easeOut(t / 0.16);
  const press = smooth((t - 0.12) / 0.33);
  const lean = 0.1 * reach + 0.14 * press;
  p[J.pitch] = lean;
  p[J.spineX] = 0.1 * reach + 0.14 * press;
  p[J.headX] = -0.16 * (reach + press);
  p[J.hipZ] = 0.05 * press;
  p[J.hipY] = -0.06 * reach;

  // the arms end up level with the floor once the body has leaned in
  const arm = -(1.5 * reach + 0.42 * press);
  const elbow = -(0.2 + reach * (1 - press));
  p[J.armLX] = arm;
  p[J.armRX] = arm;
  p[J.armLZ] = 0.16 - 0.07 * reach;
  p[J.armRZ] = -(0.16 - 0.07 * reach);
  p[J.elbowL] = elbow;
  p[J.elbowR] = elbow;
  // turn the mittens palm-forward-and-down (thumbs in) so they press flat on
  // the door instead of reading as two raised fists
  p[J.armLY] = PUSH_TWIST * reach;
  p[J.armRY] = -PUSH_TWIST * reach;

  // braced stance: left foot planted ahead, right foot back on its toes
  const toHip = -(LEG + p[J.hipY]);
  legIK(p, J.legLX, J.kneeL, J.footL, 0.2 * reach - p[J.hipZ], toHip, 0, lean);
  legIK(p, J.legRX, J.kneeR, J.footR, -0.24 * reach - p[J.hipZ], toHip + 0.04 * reach, 0.35 * reach, lean);
}

/** Head-first: the pose is reached in 0.2 s, then the nose keeps dipping. */
export function poseDive(p: Float32Array, t: number): void {
  stand(p);
  const d = easeOut(t / 0.2);
  const dip = smooth((t - 0.2) / 0.4);
  p[J.pitch] = 1.2 * d + 0.25 * dip;
  p[J.hipY] = 0.12 * d;
  p[J.spineX] = -0.14 * d;
  p[J.headX] = -0.6 * d;
  p[J.squash] = 0.05 * d;
  p[J.armLX] = -2.95 * d;
  p[J.armRX] = -2.95 * d;
  p[J.armLZ] = lerp(0.16, -0.14, d);
  p[J.armRZ] = -lerp(0.16, -0.14, d);
  p[J.elbowL] = lerp(-0.2, -0.06, d);
  p[J.elbowR] = lerp(-0.2, -0.06, d);
  p[J.legLX] = 0.16 * d;
  p[J.legRX] = 0.04 * d;
  p[J.kneeL] = 0.1 * d;
  p[J.kneeR] = 0.22 * d;
  p[J.footL] = 0.85 * d;
  p[J.footR] = 0.85 * d;
}

/** A full backward somersault with a tuck, opening out upright at the end. */
export function poseBackflip(p: Float32Array, t: number): void {
  stand(p);
  const u = clamp01(t / DURATIONS.backflip);
  const turn = 0.35 * u + 0.65 * smooth(u);
  const tuck = Math.pow(Math.sin(PI * u), 0.75);
  const launch = 1 - smooth(u / 0.3);
  const open = smooth((u - 0.7) / 0.3);

  p[J.pitch] = -TAU * turn;
  p[J.hipY] = 0.12 * tuck;
  p[J.spineX] = 0.5 * tuck - 0.15 * launch;
  p[J.headX] = 0.35 * tuck - 0.4 * launch;
  p[J.legLX] = -1.75 * tuck - 0.12 * open;
  p[J.kneeL] = 2.1 * tuck + 0.25 * open;
  p[J.footL] = 0.5 * tuck - 0.1 * open;
  p[J.legRX] = -1.55 * tuck - 0.12 * open;
  p[J.kneeR] = 1.95 * tuck + 0.25 * open;
  p[J.footR] = 0.5 * tuck - 0.1 * open;
  // arms: thrown up to start the turn, hug the knees, spread to land
  const hug = tuck * (1 - launch);
  const armX = -2.6 * launch - 0.95 * hug;
  p[J.armLX] = armX;
  p[J.armRX] = armX;
  p[J.armLZ] = lerp(0.16 - 0.4 * launch, 0.95, open);
  p[J.armRZ] = -lerp(0.16 - 0.4 * launch, 0.95, open);
  p[J.elbowL] = -0.2 - 1.2 * hug;
  p[J.elbowR] = -0.2 - 1.2 * hug;
}

/**
 * Victory: wind up, hop with a full spin, land, then punch one arm to the
 * sky with the other fist on the hip. Held from 1.0 s.
 * @param spin  false under reduced motion (hop without the spin)
 */
export function poseStar(p: Float32Array, t: number, amp: number, spin: boolean): void {
  stand(p);
  const T_HOP = 0.12;
  const T_LAND = 0.62;
  const windUp = t < T_HOP ? smooth(t / T_HOP) : 1 - smooth((t - T_HOP) / 0.1);
  const u = clamp01((t - T_HOP) / (T_LAND - T_HOP));
  const hop = 4 * u * (1 - u);
  const touchDown = t < T_LAND ? 0 : bump((t - T_LAND) / 0.2);
  const strike = easeOutBack((t - 0.68) / 0.3);
  const held = clamp01(strike);

  crouch(p, 0.5 * windUp + 0.4 * touchDown * (0.5 + 0.5 * amp));
  p[J.hipY] += 0.42 * amp * hop;
  p[J.yaw] = spin ? TAU * smooth(u) : 0;
  p[J.squash] = 0.05 * hop * amp - 0.1 * touchDown * amp + 0.05 * bump((t - 0.72) / 0.3) * amp;

  // airborne: knees up, arms pulled in tight
  p[J.legLX] -= 0.7 * hop;
  p[J.kneeL] += 1.3 * hop;
  p[J.footL] += 0.4 * hop;
  p[J.legRX] -= 0.45 * hop;
  p[J.kneeR] += 1.0 * hop;
  p[J.footR] += 0.4 * hop;
  const hug = smooth(hop * 1.6);
  p[J.armLX] = 0.5 * windUp - 0.5 * hug;
  p[J.armRX] = 0.5 * windUp - 0.5 * hug;
  p[J.armLZ] += 0.12 * hug;
  p[J.armRZ] -= 0.12 * hug;
  p[J.elbowL] -= 1.7 * hug;
  p[J.elbowR] -= 1.7 * hug;

  // the pose: right arm straight up, left fist on the hip, chest out
  mix(p, J.armRZ, -2.92, strike);
  mix(p, J.armRX, -0.1, strike);
  mix(p, J.elbowR, -0.05, strike);
  mix(p, J.armLZ, 0.72, strike);
  mix(p, J.armLX, 0.22, strike);
  mix(p, J.armLY, -1.2, strike);
  mix(p, J.elbowL, -1.8, strike);
  p[J.legLZ] += 0.17 * held;
  p[J.legRZ] -= 0.17 * held;
  p[J.hipY] -= LEG * (1 - Math.cos(0.17)) * held;
  p[J.spineX] -= 0.1 * held;
  p[J.spineZ] += 0.05 * held;
  p[J.headX] -= 0.2 * held;
  p[J.headZ] -= 0.07 * held;
}

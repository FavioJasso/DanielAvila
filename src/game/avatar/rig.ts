/**
 * Daniel 64 — rig definition.
 *
 * The avatar is a segmented puppet: nested Groups, one rigid mesh per segment,
 * no skinning. A pose is a flat Float32Array of joint channels (see `J`); the
 * animation code only ever writes numbers into such arrays, and `applyPose`
 * copies one onto the Groups.
 *
 * Sign conventions (three.js right-handed, model faces +Z, its left is +X):
 * - rotation about X: positive tips "up" vectors towards +Z. For the torso or
 *   head that means leaning / nodding FORWARD; for a limb that hangs down it
 *   means swinging BACKWARD (so a leg kicking forward is negative).
 * - knees flex with positive X, elbows flex with negative X.
 * - rotation about Z: positive lifts the LEFT arm / leg outwards (abduction);
 *   the right side uses the mirrored sign.
 * - rotation about Y: positive turns towards the avatar's left.
 */
import type * as THREE from "three";

/** Proportions, in units (1 unit ≈ 1 m). Feet are at y = 0. */
export const DIM = {
  height: 1.75,
  /** Hips group origin above the floor. */
  hipY: 0.645,
  /** Leg pivots, relative to the hips group. */
  hipJointX: 0.125,
  hipJointY: -0.04,
  thigh: 0.25,
  shin: 0.255,
  /** Ankle pivot above the sole. */
  ankle: 0.1,
  /** Torso (waist) pivot, relative to the hips group. */
  waistY: 0.08,
  /** Shoulder pivots, relative to the torso group. */
  shoulderX: 0.285,
  shoulderY: 0.385,
  upperArm: 0.225,
  /** Neck pivot, relative to the torso group. */
  neckY: 0.493,
  /** The head geometry is modelled at 1:1 and scaled up: big mascot head. */
  headScale: 1.12,
} as const;

/** Pose channels. */
export const J = {
  /** Whole-body offset of the hips from the rest position. */
  hipX: 0,
  hipY: 1,
  hipZ: 2,
  /** Whole-body rotation about the hips (YXZ: yaw, then pitch, then roll). */
  pitch: 3,
  yaw: 4,
  roll: 5,
  /** Squash (< 0) and stretch (> 0) of the whole figure, anchored at the feet. */
  squash: 6,
  spineX: 7,
  spineY: 8,
  spineZ: 9,
  headX: 10,
  headY: 11,
  headZ: 12,
  /** Arms are ZXY: lift sideways (Z), swing (X), then twist along the arm (Y). */
  armLX: 13,
  armLY: 14,
  armLZ: 15,
  elbowL: 16,
  armRX: 17,
  armRY: 18,
  armRZ: 19,
  elbowR: 20,
  /** Legs are YXZ: turn out (Y), swing (X), then spread (Z). */
  legLX: 21,
  legLY: 22,
  legLZ: 23,
  kneeL: 24,
  footL: 25,
  legRX: 26,
  legRY: 27,
  legRZ: 28,
  kneeR: 29,
  footR: 30,
} as const;

export const POSE_SIZE = 31;

/** Channels that are full-turn angles and must be wrapped before blending. */
export const WRAPPED_CHANNELS: readonly number[] = [J.pitch, J.yaw, J.roll];

export interface Rig {
  /** Child of the avatar root; carries squash and stretch. */
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  foreL: THREE.Group;
  armR: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  shinL: THREE.Group;
  footL: THREE.Group;
  legR: THREE.Group;
  shinR: THREE.Group;
  footR: THREE.Group;
  /** Markers used to place world-space effects. */
  handR: THREE.Object3D;
  mouth: THREE.Object3D;
  soleL: THREE.Object3D;
  soleR: THREE.Object3D;
}

/** Copy a pose onto the rig. Allocation-free. */
export function applyPose(r: Rig, p: Float32Array): void {
  const s = 1 + p[J.squash];
  const k = 1 / Math.sqrt(s); // keep the volume roughly constant
  r.body.scale.set(k, s, k);

  r.hips.position.set(p[J.hipX], DIM.hipY + p[J.hipY], p[J.hipZ]);
  r.hips.rotation.set(p[J.pitch], p[J.yaw], p[J.roll]);
  r.torso.rotation.set(p[J.spineX], p[J.spineY], p[J.spineZ]);
  r.head.rotation.set(p[J.headX], p[J.headY], p[J.headZ]);

  r.armL.rotation.set(p[J.armLX], p[J.armLY], p[J.armLZ]);
  r.foreL.rotation.x = p[J.elbowL];
  r.armR.rotation.set(p[J.armRX], p[J.armRY], p[J.armRZ]);
  r.foreR.rotation.x = p[J.elbowR];

  r.legL.rotation.set(p[J.legLX], p[J.legLY], p[J.legLZ]);
  r.shinL.rotation.x = p[J.kneeL];
  r.footL.rotation.x = p[J.footL];
  r.legR.rotation.set(p[J.legRX], p[J.legRY], p[J.legRZ]);
  r.shinR.rotation.x = p[J.kneeR];
  r.footR.rotation.x = p[J.footR];
}

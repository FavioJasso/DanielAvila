/**
 * STUB avatar: a capsule with a nose so facing is visible. Tracks animation
 * state and one-shot timing exactly like the real one must. Replaced by
 * src/game/avatar.
 */
import * as THREE from "three";
import type { Avatar, AvatarAnim, CreateAvatar } from "../contract";

const DURATIONS: Record<AvatarAnim, number> = {
  idle: 0,
  run: 0,
  jump: 0,
  fall: 0,
  land: 0.18,
  push: 0.45,
  dive: 0.6,
  backflip: 0.8,
  starPose: 1.6,
};

export const createAvatar: CreateAvatar = () => {
  const root = new THREE.Group();
  root.name = "stub-avatar";
  const effects = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const capGeo = new THREE.CapsuleGeometry(0.34, 1.05, 2, 8);
  const capMat = new THREE.MeshLambertMaterial({ color: 0x2b3f8f, flatShading: true });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.875;
  body.add(cap);
  const noseGeo = new THREE.BoxGeometry(0.16, 0.16, 0.3);
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xffc93c });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 1.45, 0.38);
  body.add(nose);

  const shadowGeo = new THREE.CircleGeometry(0.45, 12);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  effects.add(shadow);

  let anim: AvatarAnim = "idle";
  let animT = 0;
  let idleT = 0;
  let speed = 0;

  const avatar: Avatar = {
    root,
    effects,
    height: 1.75,
    get anim() {
      return anim;
    },
    get sleeping() {
      return anim === "idle" && idleT > 20;
    },
    play(next, opts) {
      if (next === anim && !opts?.restart) return;
      anim = next;
      animT = 0;
      idleT = 0;
    },
    setMoveSpeed(v) {
      speed = v;
    },
    wake() {
      idleT = 0;
    },
    duration: (a) => DURATIONS[a],
    update(dt, time) {
      animT += dt;
      if (anim === "idle") idleT += dt;
      body.rotation.set(0, 0, 0);
      body.position.y = 0;
      body.scale.set(1, 1, 1);
      if (anim === "idle") {
        const asleep = idleT > 20;
        body.position.y = asleep ? -0.5 : Math.sin(time * 3) * 0.02;
        if (!asleep && idleT > 5) body.rotation.y = Math.sin((idleT - 5) * 2) * 0.5;
      } else if (anim === "run") {
        body.position.y = Math.abs(Math.sin(time * 14)) * 0.08 * speed;
        body.rotation.x = 0.25 * speed;
      } else if (anim === "jump") {
        body.scale.set(0.9, 1.12, 0.9);
      } else if (anim === "fall") {
        body.scale.set(1.05, 0.95, 1.05);
      } else if (anim === "land") {
        body.scale.set(1.15, 0.8, 1.15);
      } else if (anim === "push") {
        body.rotation.x = 0.35;
      } else if (anim === "dive") {
        body.rotation.x = Math.min(1, animT / 0.25) * 1.4;
      } else if (anim === "backflip") {
        body.position.y = 0.875;
        body.rotation.x = -Math.min(1, animT / DURATIONS.backflip) * Math.PI * 2;
        body.position.y = 0;
      } else if (anim === "starPose") {
        body.position.y = Math.abs(Math.sin(Math.min(animT, 0.6) * 5)) * 0.4;
        body.rotation.y = Math.min(animT, 0.6) * 10;
      }
      shadow.position.set(root.position.x, 0.02, root.position.z);
      const k = Math.max(0.4, 1 - root.position.y * 0.25);
      shadow.scale.set(k, 1, k);
    },
    dispose() {
      capGeo.dispose();
      capMat.dispose();
      noseGeo.dispose();
      noseMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
    },
  };
  return avatar;
};

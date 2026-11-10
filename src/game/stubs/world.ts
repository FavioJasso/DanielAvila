/**
 * STUB world: a whitebox octagon built straight from the layout colliders.
 * Good enough to develop the engine against. Replaced by src/game/world.
 */
import * as THREE from "three";
import {
  DOORS,
  type CreateWorld,
  type DoorHandle,
  type HitTag,
  type World,
} from "../contract";
import { ALCOVE_BACK, DOOR_FRAMES, PEDESTAL, ROOM, buildColliders } from "../layout";
import { createPaintingCanvas } from "../services";

const tag = (o: THREE.Object3D, hit: HitTag) => {
  o.userData.hit = hit;
  return o;
};

export const createWorld: CreateWorld = () => {
  const root = new THREE.Group();
  root.name = "stub-world";
  const pickables: THREE.Object3D[] = [];
  const disposables: { dispose(): void }[] = [];
  const mat = (color: number) => {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    disposables.push(m);
    return m;
  };

  // floor
  const R = ROOM.apothem / Math.cos(Math.PI / 8) + 6;
  const floorGeo = new THREE.CircleGeometry(R, 8, Math.PI / 8);
  floorGeo.rotateX(-Math.PI / 2);
  disposables.push(floorGeo);
  const floor = new THREE.Mesh(floorGeo, mat(0x8d94a8));
  root.add(tag(floor, { kind: "floor" }));
  pickables.push(floor);

  // carpet
  const carpetGeo = new THREE.CircleGeometry(ROOM.carpetRadius, 24);
  carpetGeo.rotateX(-Math.PI / 2);
  disposables.push(carpetGeo);
  const carpet = new THREE.Mesh(carpetGeo, mat(0xb8323a));
  carpet.position.y = 0.01;
  root.add(carpet);

  // walls straight from the colliders
  const wallMat = mat(0xcfc7b4);
  for (const s of buildColliders().segments) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const len = Math.hypot(dx, dz);
    const geo = new THREE.BoxGeometry(len, ROOM.wallHeight, 0.2);
    disposables.push(geo);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set((s.ax + s.bx) / 2, ROOM.wallHeight / 2, (s.az + s.bz) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    root.add(wall);
  }

  // doors, paintings, signs
  const doorMat = mat(0x7a4a22);
  const doors: (DoorHandle & { tick(dt: number): void })[] = DOOR_FRAMES.map((f, i) => {
    const spec = DOORS[i];
    const bearing = (f.bearingDeg * Math.PI) / 180;

    const pivot = new THREE.Group();
    pivot.position.set(f.hinge.x, 0, f.hinge.z);
    pivot.rotation.y = -bearing;
    const leafGeo = new THREE.BoxGeometry(ROOM.doorWidth, ROOM.doorHeight, 0.15);
    disposables.push(leafGeo);
    const leaf = new THREE.Mesh(leafGeo, doorMat);
    leaf.position.set(ROOM.doorWidth / 2, ROOM.doorHeight / 2, 0);
    pivot.add(tag(leaf, { kind: "door", index: i }));
    root.add(pivot);
    pickables.push(leaf);

    const tex = new THREE.CanvasTexture(createPaintingCanvas(spec.id));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pGeo = new THREE.PlaneGeometry(ROOM.paintingSize, ROOM.paintingSize);
    const pMat = new THREE.MeshBasicMaterial({ map: tex });
    disposables.push(tex, pGeo, pMat);
    const painting = new THREE.Mesh(pGeo, pMat);
    // the stub's walls are 0.2 thick boxes, so pull the canvas clear of them
    const pp = f.at(0, ALCOVE_BACK - 0.14);
    painting.position.set(pp.x, f.painting.y, pp.z);
    painting.rotation.y = f.yawIn;
    root.add(tag(painting, { kind: "painting", index: i }));
    pickables.push(painting);

    const signGeo = new THREE.BoxGeometry(2.2, 0.5, 0.1);
    disposables.push(signGeo);
    const sign = new THREE.Mesh(signGeo, mat(new THREE.Color(spec.accent).getHex()));
    const sp = f.at(0, -0.15);
    sign.position.set(sp.x, ROOM.doorHeight + 0.9, sp.z);
    sign.rotation.y = f.yawIn;
    root.add(tag(sign, { kind: "sign", index: i }));
    pickables.push(sign);

    let target = 0;
    let open = 0;
    let rippleT = 0;
    let glow = 0;
    return {
      spec,
      get openAmount() {
        return open;
      },
      setOpen(o) {
        target = o ? 1 : 0;
      },
      ripple() {
        rippleT = 1;
      },
      setGlow(a) {
        glow = a;
      },
      tick(dt) {
        open += (target - open) * Math.min(1, dt * 5);
        if (Math.abs(target - open) < 0.002) open = target;
        pivot.rotation.y = -bearing + open * 1.75;
        rippleT = Math.max(0, rippleT - dt);
        const s = 1 + Math.sin(rippleT * 30) * 0.06 * rippleT;
        painting.scale.set(s, s, 1);
        pMat.color.setScalar(1 + glow * 0.25);
      },
    };
  });

  // pedestal + star
  const pedGeo = new THREE.CylinderGeometry(0.55, 0.7, 1.0, 8);
  disposables.push(pedGeo);
  const ped = new THREE.Mesh(pedGeo, mat(0xa9a394));
  ped.position.set(PEDESTAL.x, 0.5, PEDESTAL.z);
  root.add(tag(ped, { kind: "star" }));
  const starGeo = new THREE.OctahedronGeometry(0.45);
  disposables.push(starGeo);
  const star = new THREE.Mesh(starGeo, mat(0xffc93c));
  star.position.set(PEDESTAL.x, ROOM.starHeight, PEDESTAL.z);
  root.add(tag(star, { kind: "star" }));
  pickables.push(ped, star);

  root.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sun.position.set(4, 10, 6);
  root.add(sun);

  let burst = 0;
  const world: World = {
    root,
    doors,
    pickables,
    applyEnvironment(scene) {
      scene.background = new THREE.Color(0x6fa8ff);
      scene.fog = null;
    },
    starBurst() {
      burst = 1;
    },
    update(dt, time) {
      for (const d of doors) d.tick(dt);
      star.rotation.y = time * 1.6;
      star.position.y = ROOM.starHeight + Math.sin(time * 2) * 0.08;
      burst = Math.max(0, burst - dt * 1.5);
      star.scale.setScalar(1 + burst * 0.8);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
  return world;
};

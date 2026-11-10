/**
 * Daniel 64 — assembles geometry, textures and materials into the segmented
 * rig (nested Groups, one rigid mesh per segment, joints overlapping).
 */
import * as THREE from "three";
import { buildGeometry, MARKERS, type AvatarGeometry, type V3 } from "./geometry";
import { buildTextures, type AvatarTextures } from "./textures";
import { DIM, type Rig } from "./rig";

export interface AvatarModel {
  root: THREE.Group;
  rig: Rig;
  textures: AvatarTextures;
  /** Swap `.map` between `textures.faceOpen` and `textures.faceClosed` to blink. */
  faceMaterial: THREE.MeshLambertMaterial;
  dispose(): void;
}

function group(name: string, parent: THREE.Object3D, x: number, y: number, z: number, order?: THREE.EulerOrder): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  if (order) g.rotation.order = order;
  parent.add(g);
  return g;
}

function marker(parent: THREE.Object3D, at: V3): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(at[0], at[1], at[2]);
  parent.add(o);
  return o;
}

export function buildModel(): AvatarModel {
  const geo: AvatarGeometry = buildGeometry();
  const textures = buildTextures();

  // Three materials for the whole character: vertex colours, face, blazer.
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const faceMaterial = new THREE.MeshLambertMaterial({ map: textures.faceOpen, flatShading: true });
  const blazer = new THREE.MeshLambertMaterial({ map: textures.blazer, flatShading: true });

  const part = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, name: string): THREE.Mesh => {
    const mesh = new THREE.Mesh(g, m);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  root.name = "daniel-64";

  const body = group("body", root, 0, 0, 0);
  const hips = group("hips", body, 0, DIM.hipY, 0, "YXZ");
  part(hips, geo.pelvis, solid, "pelvis");

  const torso = group("torso", hips, 0, DIM.waistY, 0, "YXZ");
  part(torso, geo.torso, solid, "blazer");
  part(torso, geo.torsoFront, blazer, "blazer-front");

  const head = group("head", torso, 0, DIM.neckY, 0, "YXZ");
  head.scale.setScalar(DIM.headScale);
  part(head, geo.head, solid, "head");
  part(head, geo.face, faceMaterial, "face");

  const arm = (side: 1 | -1): { upper: THREE.Group; fore: THREE.Group } => {
    const tag = side === 1 ? "L" : "R";
    const upper = group(`arm${tag}`, torso, side * DIM.shoulderX, DIM.shoulderY, 0, "ZXY");
    part(upper, geo.upperArm, solid, `upper-arm${tag}`);
    const fore = group(`fore${tag}`, upper, 0, -DIM.upperArm, 0);
    part(fore, geo.forearm, solid, `forearm${tag}`);
    return { upper, fore };
  };
  const leg = (side: 1 | -1): { upper: THREE.Group; shin: THREE.Group; foot: THREE.Group } => {
    const tag = side === 1 ? "L" : "R";
    const upper = group(`leg${tag}`, hips, side * DIM.hipJointX, DIM.hipJointY, 0, "YXZ");
    part(upper, geo.thigh, solid, `thigh${tag}`);
    const shin = group(`shin${tag}`, upper, 0, -DIM.thigh, 0);
    part(shin, geo.shin, solid, `shin${tag}`);
    const foot = group(`foot${tag}`, shin, 0, -DIM.shin, 0);
    part(foot, geo.shoe, solid, `shoe${tag}`);
    return { upper, shin, foot };
  };

  const aL = arm(1);
  const aR = arm(-1);
  const lL = leg(1);
  const lR = leg(-1);

  const rig: Rig = {
    body,
    hips,
    torso,
    head,
    armL: aL.upper,
    foreL: aL.fore,
    armR: aR.upper,
    foreR: aR.fore,
    legL: lL.upper,
    shinL: lL.shin,
    footL: lL.foot,
    legR: lR.upper,
    shinR: lR.shin,
    footR: lR.foot,
    handR: marker(aR.fore, MARKERS.hand),
    mouth: marker(head, MARKERS.mouth),
    soleL: marker(lL.foot, MARKERS.sole),
    soleR: marker(lR.foot, MARKERS.sole),
  };

  return {
    root,
    rig,
    textures,
    faceMaterial,
    dispose() {
      for (const g of Object.values(geo) as THREE.BufferGeometry[]) g.dispose();
      for (const t of Object.values(textures) as THREE.Texture[]) t.dispose();
      solid.dispose();
      faceMaterial.dispose();
      blazer.dispose();
    },
  };
}

/** Triangles in every mesh under `object` (the model, not the effects). */
export function countTriangles(object: THREE.Object3D): number {
  let n = 0;
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return n;
}

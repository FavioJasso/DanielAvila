/**
 * DANIEL AVILA 64 — the Keep's foyer.
 *
 * An octagonal castle lobby generated entirely in code: procedural 64×64
 * textures, geometry built from `layout.ts`, lighting baked into vertex
 * colours, and a handful of animated parts (door leaves, painting ripples,
 * signs, stars, flames, the sky). Static geometry is merged into one mesh
 * per material.
 *
 * Real-time lights exist only for the avatar and the gold stars (the room
 * itself is unlit `MeshBasicMaterial` × baked vertex colour). They match the
 * stub world's lights exactly so the avatar looks the same in both.
 */
import * as THREE from "three";
import { DOORS, type CreateWorld, type HitTag, type World } from "../contract";
import { ALCOVE_BACK, ARCH_DEPTH, DOOR_FRAMES, DOOR_HALF_WIDTH, PEDESTAL, ROOM } from "../layout";
import { createEmblemCanvas } from "../services";
import { buildAlcove, buildArchway, buildTorch } from "./archways";
import type { MeshBuilder } from "./builder";
import { createDoor, createLeafGeometry, type Door } from "./doors";
import { createBakedLighting } from "./lighting";
import { createPedestal } from "./pedestal";
import {
  ALCOVE_TORCHES,
  BANNER_FRAMES,
  DOOR_ACCENTS,
  PILLAR_TORCHES,
  SPRING_Y,
  SURROUND_WIDTH,
  TORCHES,
  emblemStars,
} from "./plan";
import { buildRoom, createBuilders } from "./room";
import { buildBanner, buildSouthEntrance } from "./south";
import { createFlames, createGlows, createSparkles, type GlowQuad } from "./sprites";
import { createStarGeometry } from "./star";
import { createTextures, pixelTexture } from "./textures";
import { mixRgb, type RGB, type V3 } from "./util";

/** Backdrop seen only if the camera slips outside the walls (the UI's ink navy). */
const BACKDROP = 0x0a0f2c;

/** Cloud drift, in texture repeats per second (one repeat = 10 m). */
const SKY_DRIFT_X = 0.0065;
const SKY_DRIFT_Y = 0.0022;

/** Seconds after which the GPU-side animation clocks wrap round. */
const SHADER_CLOCK_WRAP = 3600;

const UP: V3 = [0, 1, 0];
const WHITE: RGB = [1, 1, 1];

/** Soft colour washes on the walls: painting halos, star shine, torch light. */
function glowQuads(quality: "low" | "high"): GlowQuad[] {
  const quads: GlowQuad[] = [];
  for (const f of DOOR_FRAMES) {
    const right: V3 = [f.right.x, 0, f.right.z];
    // halo behind the frame; its level follows setGlow() and the ripple
    const h = f.at(0, ALCOVE_BACK - 0.02);
    quads.push({
      center: [h.x, ROOM.paintingCenterY, h.z],
      right,
      up: UP,
      width: ROOM.alcoveWidth,
      height: 4.1,
      color: mixRgb(DOOR_ACCENTS[f.index], WHITE, 0.25),
      opacity: 0.85,
      door: f.index,
      flicker: -1,
    });
    // shine on the wall behind each star emblem
    for (const e of emblemStars(DOORS[f.index].badge)) {
      const s = f.at(e.u, -0.02);
      quads.push({
        center: [s.x, e.y, s.z],
        right,
        up: UP,
        width: e.radius * 4.2,
        height: e.radius * 4.2,
        color: [1.0, 0.86, 0.42],
        opacity: 0.6,
        door: -1,
        flicker: -1,
      });
    }
  }
  // flickering torch light on the alcove's back wall
  ALCOVE_TORCHES.forEach((t, i) => {
    const f = DOOR_FRAMES[t.zone];
    quads.push({
      center: [t.wx - f.dir.x * 0.015, t.y + 0.28, t.wz - f.dir.z * 0.015],
      right: [f.right.x, 0, f.right.z],
      up: UP,
      width: 1.5,
      height: 1.7,
      color: [1.0, 0.72, 0.3],
      opacity: 0.55,
      door: -1,
      flicker: (i * 0.37) % 1,
    });
  });
  if (quality === "high") {
    // … and a narrow lick of it up each corner pillar
    PILLAR_TORCHES.forEach((t, i) => {
      const len = Math.hypot(t.x - t.wx, t.z - t.wz);
      const nx = (t.x - t.wx) / len;
      const nz = (t.z - t.wz) / len;
      quads.push({
        center: [t.wx + nx * 0.012, t.y + 0.32, t.wz + nz * 0.012],
        right: [nz, 0, -nx], // so that right × up faces out of the pillar
        up: UP,
        width: 0.33,
        height: 1.5,
        color: [1.0, 0.74, 0.32],
        opacity: 0.5,
        door: -1,
        flicker: (0.5 + i * 0.29) % 1,
      });
    });
  }
  return quads;
}

export const createWorld: CreateWorld = (opts) => {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };

  const root = new THREE.Group();
  root.name = "keep";
  const pickables: THREE.Object3D[] = [];

  const tex = createTextures();
  for (const t of Object.values(tex)) track(t);
  const emblemTexture = track(pixelTexture(createEmblemCanvas(128), false));

  /* --- static shell: bake + merge by material ------------------------ */
  const shade = createBakedLighting();
  const b = createBuilders(shade);
  buildRoom(b);
  for (const f of DOOR_FRAMES) {
    buildArchway(b.slab, {
      f,
      halfW: DOOR_HALF_WIDTH,
      springY: SPRING_Y,
      back: ARCH_DEPTH,
      ringW: SURROUND_WIDTH,
    });
    buildAlcove(b, f);
  }
  buildSouthEntrance(b);
  for (const f of BANNER_FRAMES) buildBanner(b, f);
  for (const t of TORCHES) buildTorch(b.flat, t);

  const baked = (map: THREE.Texture | null, extra: THREE.MeshBasicMaterialParameters = {}) =>
    track(new THREE.MeshBasicMaterial({ map, vertexColors: true, toneMapped: false, ...extra }));
  // things lying on another surface are nudged towards the camera in depth
  const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const slabMaterial = baked(tex.slab);

  const addStatic = (name: string, builder: MeshBuilder, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(track(builder.build()), material);
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    return mesh;
  };

  const floor = addStatic("floor", b.floor, baked(tex.checker));
  const floorHit: HitTag = { kind: "floor" };
  floor.userData.hit = floorHit;
  pickables.push(floor);
  addStatic("walls-stone", b.stone, baked(tex.stone));
  addStatic("walls-plaster", b.plaster, baked(tex.plaster));
  addStatic("frieze", b.frieze, baked(tex.frieze));
  addStatic("stonework", b.slab, slabMaterial);
  addStatic("carpet", b.carpet, baked(tex.carpet, decal));
  addStatic("gold", b.gold, baked(tex.gold, decal));
  addStatic("woodwork", b.wood, baked(tex.wood));
  addStatic("banners", b.banner, baked(tex.banner));
  addStatic("ironwork-glass", b.flat, baked(null));
  addStatic(
    "emblems",
    b.emblem,
    baked(emblemTexture, { alphaTest: 0.5, ...decal, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  addStatic("sky", b.sky, baked(tex.sky));

  /* --- lights (for the avatar and the gold stars) --------------------- */
  const hemi = track(new THREE.HemisphereLight(0xffffff, 0x554433, 1.6));
  const sun = track(new THREE.DirectionalLight(0xfff0d0, 1.4));
  sun.position.set(4, 10, 6);
  root.add(hemi, sun);

  /* --- stars, doors, pedestal ---------------------------------------- */
  const starGeometry = track(createStarGeometry());
  const starMaterial = track(
    new THREE.MeshLambertMaterial({ color: 0xffc531, emissive: 0x8a4a00, flatShading: true }),
  );

  const glows = createGlows(glowQuads(opts.quality), tex.glow);
  track(glows.mesh.geometry);
  track(glows.material);
  glows.mesh.matrixAutoUpdate = false;
  root.add(glows.mesh);

  const proxyMaterial = track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const leafGeometry = track(createLeafGeometry());
  const paintingGeometry = track(new THREE.PlaneGeometry(ROOM.paintingSize, ROOM.paintingSize));
  const doors: Door[] = [];
  for (let i = 0; i < DOOR_FRAMES.length; i++) {
    const parts = createDoor(i, {
      shade,
      wood: tex.wood,
      leafGeometry,
      paintingGeometry,
      starGeometry,
      starMaterial,
      haloLevels: glows.door,
      proxyMaterial,
      reducedMotion: opts.reducedMotion,
      track,
    });
    doors.push(parts.door);
    root.add(...parts.objects);
    pickables.push(...parts.pickables);
  }

  const pedestal = createPedestal({
    shade,
    slabMaterial,
    starGeometry,
    starMaterial,
    reducedMotion: opts.reducedMotion,
    track,
  });
  root.add(pedestal.group);
  pickables.push(pedestal.group);

  /* --- sprites -------------------------------------------------------- */
  const flames = createFlames(TORCHES, tex.flame);
  track(flames.mesh.geometry);
  track(flames.material);
  flames.mesh.matrixAutoUpdate = false;
  root.add(flames.mesh);

  const low = opts.quality === "low";
  const sparkles = createSparkles(
    [PEDESTAL.x, ROOM.starHeight, PEDESTAL.z],
    tex.sparkle,
    low ? 3 : 6,
    low ? 12 : 22,
    opts.reducedMotion,
  );
  track(sparkles.mesh.geometry);
  track(sparkles.material);
  sparkles.mesh.matrixAutoUpdate = false;
  root.add(sparkles.mesh);

  root.updateMatrixWorld(true);

  const background = new THREE.Color(BACKDROP);
  const flameTime = flames.material.uniforms.uTime;
  const glowTime = glows.material.uniforms.uTime;
  // reduced motion: keep the fire and the clouds alive, just much calmer
  const fxRate = opts.reducedMotion ? 0.35 : 1;
  const sky = tex.sky;

  const world: World = {
    root,
    doors,
    pickables,
    applyEnvironment(scene) {
      scene.background = background;
      scene.fog = null;
    },
    starBurst() {
      pedestal.burst();
      sparkles.burst();
    },
    update(dt, time) {
      for (let i = 0; i < doors.length; i++) doors[i].update(dt, time);
      pedestal.update(dt, time);
      sparkles.update(dt, time);
      const t = time * fxRate;
      // shader clocks wrap hourly so float32 precision never makes the fire stutter
      const shaderT = t % SHADER_CLOCK_WRAP;
      flameTime.value = shaderT;
      glowTime.value = shaderT;
      sky.offset.set((t * SKY_DRIFT_X) % 1, (t * SKY_DRIFT_Y) % 1);
    },
    dispose() {
      for (let i = 0; i < disposables.length; i++) disposables[i].dispose();
      disposables.length = 0;
      pickables.length = 0;
      root.clear();
    },
  };
  return world;
};

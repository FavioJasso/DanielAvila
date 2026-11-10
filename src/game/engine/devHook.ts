/**
 * Development-only `window.__da64`, for scripted checks from the console or
 * the headless screenshot driver. Never installed in production builds.
 *
 *   __da64.api                      the GameApi
 *   __da64.state()                  snapshot of the engine (see below)
 *   __da64.store()                  the UI store as the React layer sees it
 *   __da64.gpu()                    live three.js resource counters
 *   __da64.teleport(x, z, yaw?)     put the avatar somewhere legal
 *   __da64.screenOf(kind, index?)   viewport pixel of a pickable, for clicks
 *   __da64.project(x, y, z)         viewport pixel of any world point
 *   __da64.lockDoors(on)            keep every door shut (closed-leaf tests)
 *   __da64.fuzzCollision(n, seed?)  hammer the controller with random moves
 */
import * as THREE from "three";
import type { GameApi, HitKind, HitTag } from "../contract";
import { DOOR_FRAMES, SPAWN } from "../layout";
import { Controller } from "./controller";
import type { Game } from "./game";
import { ui, type UiState } from "../store";
import type { PickResult } from "./picking";
import type { View } from "./renderer";
import { MAX_DT, RUN_SPEED } from "./tuning";

interface ScreenPoint {
  x: number;
  y: number;
  /** In front of the camera and inside the canvas. */
  visible: boolean;
}

export interface DevHook {
  api: GameApi;
  state(): Record<string, unknown>;
  store(): UiState;
  /** The renderer's live `info.memory` (geometries / textures on the GPU). */
  gpu(): { geometries: number; textures: number };
  teleport(x: number, z: number, yaw?: number): void;
  screenOf(kind: HitKind, index?: number): ScreenPoint | null;
  project(x: number, y: number, z: number): ScreenPoint;
  /** What a click at this viewport pixel would hit (same test as a real tap). */
  pick(x: number, y: number): PickResult | null;
  lockDoors(on: boolean): void;
  fuzzCollision(steps: number, seed?: number): Record<string, unknown>;
}

type DevWindow = Window & { __da64?: DevHook };

const round = (v: number): number => Math.round(v * 1000) / 1000;

export function installDevHook(g: Game, view: View): () => void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return () => {};
  }
  const scratch = new THREE.Vector3();
  const box = new THREE.Box3();

  const project = (x: number, y: number, z: number): ScreenPoint => {
    g.rig.camera.updateMatrixWorld();
    scratch.set(x, y, z).project(g.rig.camera);
    const rect = g.canvas.getBoundingClientRect();
    const px = rect.left + ((scratch.x + 1) / 2) * rect.width;
    const py = rect.top + ((1 - scratch.y) / 2) * rect.height;
    return {
      x: Math.round(px),
      y: Math.round(py),
      visible: scratch.z < 1 && Math.abs(scratch.x) <= 1 && Math.abs(scratch.y) <= 1,
    };
  };

  const hook: DevHook = {
    api: g.api,

    state() {
      const c = g.ctrl;
      const info = view.renderer.info.render;
      return {
        phase: g.phase,
        paused: g.paused,
        time: round(g.time),
        frames: g.frames,
        pos: { x: round(c.x), y: round(c.y), z: round(c.z) },
        yaw: round(c.yaw),
        vel: { x: round(c.vx), y: round(c.vy), z: round(c.vz) },
        grounded: c.grounded,
        /** Legal standing position (inside the room, clear of every collider). */
        valid: c.isValid(c.x, c.z),
        clearance: round(c.clearance(c.x, c.z)),
        anim: g.avatar.anim,
        avatarVisible: g.avatar.root.visible,
        controlMode: g.controlMode,
        focusedDoor: g.focusedDoor,
        nearDoor: g.doors.near,
        nearStar: g.doors.nearStar,
        doors: g.world.doors.map((d) => round(d.openAmount)),
        navActive: g.nav.active,
        sequence: g.seq.active,
        overlay: g.overlay,
        cam: { x: round(g.rig.x), y: round(g.rig.y), z: round(g.rig.z) },
        fov: round(g.rig.camera.fov),
        internal: { width: view.width, height: view.height },
        drawCalls: info.calls,
        triangles: info.triangles,
        cursor: g.canvas.style.cursor,
      };
    },

    store: () => ui.get(),

    gpu: () => view.renderer.info.memory,

    teleport(x, z, yaw) {
      g.nav.cancel();
      g.ctrl.place(x, z, yaw ?? g.ctrl.yaw);
      g.ctrl.resolve();
      g.cutNext = true;
      g.wake();
    },

    screenOf(kind, index) {
      // the n-th pickable tagged with this kind (and door index, if it has one)
      let seen = 0;
      let found: THREE.Object3D | null = null;
      for (const root of g.world.pickables) {
        root.traverse((o) => {
          if (found) return;
          const tag = o.userData.hit as HitTag | undefined;
          if (!tag || tag.kind !== kind) return;
          if (tag.index === undefined) {
            if (seen++ === (index ?? 0)) found = o;
          } else if (tag.index === (index ?? 0)) {
            found = o;
          }
        });
        if (found) break;
      }
      if (!found) return null;
      box.setFromObject(found);
      box.getCenter(scratch);
      const centre = project(scratch.x, scratch.y, scratch.z);
      // The box centre can fall in a gap (three crest stars, the air between
      // the pedestal and its star). Prefer a pixel a real click would resolve
      // to this very target: scan the projected box, nearest the centre first.
      const matches = (x: number, y: number): boolean => {
        const hit = g.picker.pick(x, y, g.canvas, g.rig.camera, g.world.pickables);
        return (
          hit !== null && hit.kind === kind && (index === undefined || hit.index === index || hit.index === -1)
        );
      };
      if (matches(centre.x, centre.y)) return centre;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let k = 0; k < 8; k++) {
        const p = project(
          k & 1 ? box.max.x : box.min.x,
          k & 2 ? box.max.y : box.min.y,
          k & 4 ? box.max.z : box.min.z,
        );
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
      const rect = g.canvas.getBoundingClientRect();
      x0 = Math.max(x0, rect.left + 1);
      y0 = Math.max(y0, rect.top + 1);
      x1 = Math.min(x1, rect.right - 1);
      y1 = Math.min(y1, rect.bottom - 1);
      let best: ScreenPoint | null = null;
      let bestDist = Infinity;
      const stepX = Math.max(2, (x1 - x0) / 24);
      const stepY = Math.max(2, (y1 - y0) / 24);
      for (let y = y0; y <= y1; y += stepY) {
        for (let x = x0; x <= x1; x += stepX) {
          const dist = Math.hypot(x - centre.x, y - centre.y);
          if (dist < bestDist && matches(x, y)) {
            bestDist = dist;
            best = { x: Math.round(x), y: Math.round(y), visible: true };
          }
        }
      }
      return best ?? { ...centre, visible: false };
    },

    project,

    pick(x, y) {
      const hit = g.picker.pick(x, y, g.canvas, g.rig.camera, g.world.pickables);
      return hit ? { ...hit } : null;
    },

    lockDoors(on) {
      g.doors.locked = on;
      g.wake();
    },

    /**
     * Drives a private controller with random directions, speeds, jumps,
     * frame times and door states and reports the worst thing that happened.
     * A watertight controller reports `escapes: 0`.
     */
    fuzzCollision(steps, seed = 1) {
      let s = seed >>> 0 || 1;
      const rnd = (): number => {
        // xorshift32
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
      };
      const c = new Controller();
      c.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
      let escapes = 0;
      let minClearance = Infinity;
      let maxRadius = 0;
      let alcoveVisits = 0;
      let leafHits = 0;
      let dirX = 0;
      let dirZ = 1;
      let hold = 0;
      for (let i = 0; i < steps; i++) {
        if (hold-- <= 0) {
          const a = rnd() * Math.PI * 2;
          dirX = Math.sin(a);
          dirZ = Math.cos(a);
          hold = Math.floor(rnd() * 90);
          // doors flap open and shut at random, but never onto the avatar
          for (let k = 0; k < c.leafBlocked.length; k++) {
            const next = rnd() < 0.4;
            if (next) {
              c.leafBlocked[k] = true;
              if (!c.isValid(c.x, c.z)) c.leafBlocked[k] = false;
            } else {
              c.leafBlocked[k] = false;
            }
          }
        }
        // frame times from tiny to the clamp, speeds up to twice a sprint
        const dt = 0.001 + rnd() * (MAX_DT - 0.001);
        const speed = RUN_SPEED * (0.5 + rnd() * 1.5);
        c.stepFree(dirX, dirZ, 1, rnd() < 0.02, dt, speed);
        if (c.hitDoor >= 0) leafHits++;
        const clearance = c.clearance(c.x, c.z);
        if (clearance < minClearance) minClearance = clearance;
        const radius = Math.hypot(c.x, c.z);
        if (radius > maxRadius) maxRadius = radius;
        if (radius > 11.2) alcoveVisits++;
        if (!c.isValid(c.x, c.z)) escapes++;
      }
      return {
        steps,
        escapes,
        minClearance: round(minClearance),
        maxRadius: round(maxRadius),
        /** Steps spent beyond the lobby walls, i.e. inside arches / alcoves. */
        alcoveSteps: alcoveVisits,
        leafHits,
        farthestAllowed: round(
          Math.hypot(DOOR_FRAMES[0].painting.x, DOOR_FRAMES[0].painting.z) + 2,
        ),
      };
    },
  };

  (window as DevWindow).__da64 = hook;
  return () => {
    const w = window as DevWindow;
    if (w.__da64 === hook) delete w.__da64;
  };
}

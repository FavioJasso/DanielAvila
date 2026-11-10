"use client";

/**
 * Dev harness for the avatar module (src/game/avatar).
 *
 * Live:   /dev/avatar                       turntable + buttons for every animation
 * Stills: /dev/avatar?anim=run&speed=1&t=1.2&view=side&zoom=1
 *           anim   idle | run | jump | fall | land | push | dive | backflip | starPose
 *           speed  0..1 (run intensity)
 *           t      seconds to simulate, then freeze (omit for live playback)
 *           view   front | side | back | three-quarter | top   (omit: turntable)
 *           zoom   camera zoom factor (1 = the figure fills ~2/3 of the height)
 *           focus  head — frame the face instead of the whole figure
 *           pre    lead-in before `anim`, e.g. pre=fall:0.3
 *           res    internal render height in px, upscaled with pixelated
 *                  filtering (res=480&zoom=0.32 mimics the in-game size)
 *           rm=1   reduced motion (default: the OS prefers-reduced-motion setting; rm=0 forces it off)
 *           bg=<hex>   background colour
 *           world=1  stand in the active world module instead of the plain floor
 *                    (yaw=<rad> sets his facing; cam=follow puts the camera behind him)
 *           fog=1    add scene fog (checks the effects shader against it)
 * Sheet:  /dev/avatar?sheet=1               every animation at several moments
 * Turn:   /dev/avatar?turn=1&anim=idle&t=1  one pose from every side, plus the head
 *
 * window.__avatar = { triangles, avatar, step(seconds), info() }
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Avatar, AvatarAnim } from "@/game/contract";
import { countTriangles, createAvatar } from "@/game/avatar";
import { SPAWN } from "@/game/layout";
import { createWorld } from "@/game/modules";

const ANIMS: readonly AvatarAnim[] = [
  "idle",
  "run",
  "jump",
  "fall",
  "land",
  "push",
  "dive",
  "backflip",
  "starPose",
];

type ViewName = "front" | "side" | "back" | "three-quarter" | "top";
const VIEWS: Record<ViewName, readonly [number, number, number]> = {
  front: [0, 0.1, 1],
  side: [-1, 0.1, 0],
  back: [0, 0.1, -1],
  "three-quarter": [-0.68, 0.28, 1],
  top: [0, 1, 0.06],
};

/** Engine-like top speed, units per second, at move speed 1. */
const RUN_SPEED = 6;

interface AvatarDebug {
  triangles: number;
  avatar: Avatar;
  step(seconds: number): void;
  info(): Record<string, unknown>;
}
declare global {
  interface Window {
    __avatar?: AvatarDebug;
  }
}

/* ------------------------------------------------------------------ */
/* A puppet master standing in for the engine                          */
/* ------------------------------------------------------------------ */

interface Actor {
  avatar: Avatar;
  anim: AvatarAnim;
  speed: number;
  /** Seconds since `anim` started. */
  t: number;
  clock: number;
  /** Run in a circle (live preview) instead of a straight line. */
  circle: boolean;
}

function makeActor(reducedMotion: boolean): Actor {
  const avatar = createAvatar({ quality: "high", reducedMotion });
  return { avatar, anim: "idle", speed: 0, t: 0, clock: 0, circle: false };
}

function playOn(actor: Actor, anim: AvatarAnim, speed: number): void {
  actor.anim = anim;
  actor.speed = speed;
  actor.t = 0;
  actor.avatar.setMoveSpeed(speed);
  actor.avatar.play(anim, { restart: true });
}

/** Move the root the way the engine roughly would for each animation. */
function moveRoot(actor: Actor, dt: number): void {
  const root = actor.avatar.root;
  const t = actor.t;
  switch (actor.anim) {
    case "run": {
      const v = actor.speed * RUN_SPEED;
      if (actor.circle) root.rotation.y += (v / 3.2) * dt;
      root.position.x += Math.sin(root.rotation.y) * v * dt;
      root.position.z += Math.cos(root.rotation.y) * v * dt;
      root.position.y = 0;
      break;
    }
    case "jump":
      root.position.y = Math.min(1.1, 0.12 + 2.6 * t);
      break;
    case "fall":
      root.position.y = Math.max(0.3, 1.3 - 2.4 * t);
      break;
    case "dive": {
      const u = Math.min(1, t / 0.6);
      root.position.y = 0.5 + 0.55 * Math.sin(Math.PI * u * 0.85);
      if (u < 1) root.position.z += 4 * dt;
      break;
    }
    case "backflip": {
      const u = Math.min(1, t / 0.8);
      root.position.y = 1.2 * 4 * u * (1 - u);
      break;
    }
    default:
      root.position.y = 0;
  }
}

function advance(actor: Actor, seconds: number): void {
  if (!(seconds > 0)) return;
  const n = Math.max(1, Math.round(seconds * 120));
  const dt = seconds / n;
  for (let i = 0; i < n; i++) {
    actor.t += dt;
    actor.clock += dt;
    moveRoot(actor, dt);
    actor.avatar.update(dt, actor.clock);
  }
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

interface Stage {
  scene: THREE.Scene;
  dispose(): void;
}

function buildStage(background: THREE.ColorRepresentation, useWorld: boolean): Stage {
  const scene = new THREE.Scene();
  if (useWorld) {
    const world = createWorld({ quality: "high", reducedMotion: false });
    world.applyEnvironment(scene);
    world.doors.forEach((d) => d.setOpen(true));
    scene.add(world.root);
    return { scene, dispose: () => world.dispose() };
  }
  scene.background = new THREE.Color(background);
  // neutral two-tone floor, 1 m squares
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8f97a6";
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = "#7c8494";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  const floorGeo = new THREE.PlaneGeometry(120, 120);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshLambertMaterial({ map: tex });
  scene.add(new THREE.Mesh(floorGeo, floorMat));
  // the same rig of lights the placeholder world uses
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sun.position.set(-3, 7, 5);
  scene.add(sun);
  return {
    scene,
    dispose() {
      floorGeo.dispose();
      floorMat.dispose();
      tex.dispose();
    },
  };
}

const lookTarget = new THREE.Vector3();

/** World position of the middle of the head (wherever the pose has put it). */
function headPosition(root: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  const head = root.getObjectByName("head");
  if (!head) return out.copy(root.position).setY(root.position.y + 1.5);
  head.updateWorldMatrix(true, false);
  return out.set(0, 0.24, 0).applyMatrix4(head.matrixWorld);
}

function aimCamera(
  camera: THREE.PerspectiveCamera,
  dir: readonly [number, number, number],
  distance: number,
  x: number,
  y: number,
  z: number,
): void {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  camera.position.set(
    x + (dir[0] / len) * distance,
    y + (dir[1] / len) * distance,
    z + (dir[2] / len) * distance,
  );
  lookTarget.set(x, y, z);
  camera.lookAt(lookTarget);
}

/* ------------------------------------------------------------------ */
/* Contact sheet                                                       */
/* ------------------------------------------------------------------ */

interface Shot {
  anim: AvatarAnim;
  t: number;
  speed?: number;
  pre?: readonly [AvatarAnim, number];
  /** wake() after `t`, then simulate this many more seconds. */
  wakeFor?: number;
  note?: string;
  /** Overrides the row's view. */
  view?: ViewName;
  /** Frame the head instead of the whole figure. */
  head?: boolean;
}
interface SheetRow {
  title: string;
  view: ViewName;
  shots: Shot[];
}

const at = (anim: AvatarAnim, times: number[], extra: Partial<Shot> = {}): Shot[] =>
  times.map((t) => ({ anim, t, ...extra }));

const SHEET: SheetRow[] = [
  {
    title: "idle",
    view: "three-quarter",
    shots: [
      { anim: "idle", t: 0.7, note: "breathing" },
      { anim: "idle", t: 5.9, note: "glance left" },
      { anim: "idle", t: 7.3, note: "glance right" },
      { anim: "idle", t: 20.55, note: "sitting down" },
      { anim: "idle", t: 24.6, note: "asleep" },
      { anim: "idle", t: 24.6, wakeFor: 0.22, note: "wake +0.22s" },
      { anim: "idle", t: 24.6, wakeFor: 0.7, note: "wake +0.7s" },
    ],
  },
  { title: "run 1.0", view: "side", shots: at("run", [1, 1.055, 1.11, 1.165, 1.22, 1.275, 1.33], { speed: 1 }) },
  { title: "run 0.4", view: "side", shots: at("run", [1, 1.08, 1.16, 1.24, 1.32, 1.4], { speed: 0.4 }) },
  {
    title: "jump · fall",
    view: "three-quarter",
    shots: [...at("jump", [0.04, 0.2, 0.4]), ...at("fall", [0.1, 0.3, 0.42])],
  },
  { title: "land", view: "three-quarter", shots: at("land", [0.02, 0.06, 0.1, 0.15, 0.2], { pre: ["fall", 0.4] }) },
  { title: "push", view: "side", shots: at("push", [0.04, 0.1, 0.18, 0.3, 0.45]) },
  { title: "dive", view: "side", shots: at("dive", [0.04, 0.1, 0.2, 0.4, 0.6]) },
  { title: "backflip", view: "side", shots: at("backflip", [0.06, 0.18, 0.3, 0.4, 0.5, 0.62, 0.72, 0.8]) },
  { title: "starPose", view: "three-quarter", shots: at("starPose", [0.1, 0.25, 0.37, 0.5, 0.66, 0.8, 0.95, 1.6]) },
];

function shotLabel(s: Shot): string {
  return s.note ?? `${s.anim} ${s.t.toFixed(2)}s`;
}

/** One pose seen from every side, and the head again up close. */
function turnaround(anim: AvatarAnim, t: number, speed: number): SheetRow[] {
  const views: ViewName[] = ["front", "three-quarter", "side", "back"];
  const shot = (view: ViewName, head: boolean): Shot => ({
    anim,
    t,
    speed,
    view,
    head,
    note: `${head ? "head" : anim} · ${view}`,
  });
  return [
    { title: "body", view: "front", shots: views.map((v) => shot(v, false)) },
    { title: "head", view: "front", shots: views.map((v) => shot(v, true)) },
  ];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface Hud {
  anim: AvatarAnim;
  triangles: number;
  sleeping: boolean;
  live: boolean;
}

export default function AvatarHarnessPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ anim: "idle" as AvatarAnim, speed: 1, spin: true, dirty: false });
  const [hud, setHud] = useState<Hud | null>(null);
  const [labels, setLabels] = useState<{ text: string; left: string; top: string }[]>([]);
  const [speedUi, setSpeedUi] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const q = new URLSearchParams(window.location.search);
    const num = (k: string, d: number): number => {
      const v = Number(q.get(k));
      return q.has(k) && Number.isFinite(v) ? v : d;
    };
    const turn = q.has("turn");
    const sheet = q.has("sheet") || turn;
    // ?rm=1 forces it; otherwise follow the OS setting like the real game does
    const reducedMotion =
      q.get("rm") === "1" ||
      (q.get("rm") !== "0" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const animParam = (ANIMS as readonly string[]).includes(q.get("anim") ?? "")
      ? (q.get("anim") as AvatarAnim)
      : "idle";
    const speed = Math.min(1, Math.max(0, num("speed", 1)));
    const still = q.has("t");
    const viewParam = q.get("view") as ViewName | null;
    const view = viewParam && viewParam in VIEWS ? viewParam : null;
    const zoom = Math.max(0.05, num("zoom", 1));
    const focusHead = q.get("focus") === "head";
    const res = num("res", 0);
    const useWorld = q.get("world") === "1";
    const followCam = q.get("cam") === "follow";
    const bg = `#${(q.get("bg") ?? "8d99ad").replace("#", "")}`;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(1);
    const stage = buildStage(bg, useWorld);
    const { scene } = stage;
    if (q.get("fog") === "1") scene.fog = new THREE.Fog(bg, 3, 14);
    const camera = new THREE.PerspectiveCamera(useWorld ? 55 : 35, 16 / 9, 0.1, 300);

    let width = 1;
    let height = 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      height = res > 0 ? Math.round(res) : h;
      width = res > 0 ? Math.round((res * w) / h) : w;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    let raf = 0;
    let disposed = false;
    const actors: Actor[] = [];
    let cleanupExtra = () => {};

    if (sheet) {
      /* ---------- contact sheet: one avatar per cell ---------- */
      const layout = turn ? turnaround(animParam, num("t", 0.5), speed) : SHEET;
      const cols = Math.max(...layout.map((r) => r.shots.length));
      const rows = layout.length;
      const cells: { actor: Actor; row: number; col: number; view: ViewName; head: boolean }[] = [];
      const texts: { text: string; left: string; top: string }[] = [];
      layout.forEach((row, r) => {
        row.shots.forEach((s, c) => {
          const actor = makeActor(reducedMotion);
          actors.push(actor);
          scene.add(actor.avatar.root, actor.avatar.effects);
          if (s.pre) {
            playOn(actor, s.pre[0], s.speed ?? 1);
            advance(actor, s.pre[1]);
          }
          playOn(actor, s.anim, s.speed ?? 1);
          advance(actor, s.t);
          if (s.wakeFor) {
            actor.avatar.wake();
            advance(actor, s.wakeFor);
          }
          cells.push({ actor, row: r, col: c, view: s.view ?? row.view, head: !!s.head });
          texts.push({
            text: c === 0 && !turn ? `${row.title.toUpperCase()} — ${shotLabel(s)}` : shotLabel(s),
            left: `${(c / cols) * 100}%`,
            top: `${(r / rows) * 100}%`,
          });
        });
      });
      setLabels(texts);
      const tris = countTriangles(actors[0].avatar.root);
      window.__avatar = {
        triangles: tris,
        avatar: actors[0].avatar,
        step: () => {},
        info: () => ({ triangles: tris, cells: cells.length }),
      };

      const draw = () => {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
        renderer.clear();
        renderer.setScissorTest(true);
        const cw = width / cols;
        const ch = height / rows;
        camera.aspect = cw / ch;
        camera.fov = 30;
        camera.updateProjectionMatrix();
        for (const a of actors) {
          a.avatar.root.visible = false;
          a.avatar.effects.visible = false;
        }
        for (const cell of cells) {
          const { root, effects } = cell.actor.avatar;
          root.visible = true;
          effects.visible = true;
          const x = Math.floor(cell.col * cw);
          const y = Math.floor(height - (cell.row + 1) * ch);
          renderer.setViewport(x, y, Math.ceil(cw), Math.ceil(ch));
          renderer.setScissor(x, y, Math.ceil(cw), Math.ceil(ch));
          if (cell.head) {
            headPosition(root, lookTarget);
            aimCamera(camera, VIEWS[cell.view], 1.75 / zoom, lookTarget.x, lookTarget.y, lookTarget.z);
          } else {
            aimCamera(
              camera,
              VIEWS[cell.view],
              (turn ? 4.6 : 5.4) / zoom,
              root.position.x,
              0.95 + root.position.y * 0.55,
              root.position.z,
            );
          }
          renderer.render(scene, camera);
          root.visible = false;
          effects.visible = false;
        }
        renderer.setScissorTest(false);
      };
      const onResize = () => {
        resize();
        draw();
      };
      window.addEventListener("resize", onResize);
      draw();
      // a second pass once the canvas textures are certainly uploaded
      raf = requestAnimationFrame(draw);
      cleanupExtra = () => window.removeEventListener("resize", onResize);
    } else {
      /* ---------- single avatar: still or live ---------- */
      const actor = makeActor(reducedMotion);
      actors.push(actor);
      const { avatar } = actor;
      scene.add(avatar.root, avatar.effects);
      if (useWorld) {
        avatar.root.position.set(SPAWN.x, 0, SPAWN.z);
        avatar.root.rotation.y = num("yaw", 0);
      }
      const triangles = countTriangles(avatar.root);
      const ctl = controls.current;
      ctl.anim = animParam;
      ctl.speed = speed;
      ctl.spin = !view;
      setSpeedUi(speed);

      const pre = q.get("pre")?.split(":");
      if (pre && (ANIMS as readonly string[]).includes(pre[0])) {
        playOn(actor, pre[0] as AvatarAnim, speed);
        advance(actor, Number(pre[1]) || 0);
      }
      playOn(actor, animParam, speed);
      if (still) advance(actor, num("t", 0));
      else actor.circle = true;

      let orbit = -0.6;
      const frame = () => {
        const root = avatar.root;
        if (useWorld && followCam) {
          // the in-game follow camera: behind him, wherever he is facing
          const yaw = root.rotation.y;
          camera.position.set(root.position.x - Math.sin(yaw) * 5.2, 2.9, root.position.z - Math.cos(yaw) * 5.2);
          lookTarget.set(root.position.x, 1.1, root.position.z);
          camera.lookAt(lookTarget);
        } else if (useWorld) {
          // a fixed camera south of him (looking north)
          camera.position.set(root.position.x, 3.1, root.position.z + 6.6);
          lookTarget.set(root.position.x, 1.1, root.position.z);
          camera.lookAt(lookTarget);
        } else {
          const dir: readonly [number, number, number] = view
            ? VIEWS[view]
            : [Math.sin(orbit), 0.22, Math.cos(orbit)];
          if (focusHead) {
            headPosition(root, lookTarget);
            aimCamera(camera, dir, 1.25 / zoom, lookTarget.x, lookTarget.y, lookTarget.z);
          } else {
            const ty = 0.92 + root.position.y * 0.6;
            const dist = (4.4 + root.position.y * 1.2) / zoom;
            aimCamera(camera, dir, dist, root.position.x, ty, root.position.z);
          }
        }
        renderer.render(scene, camera);
      };

      window.__avatar = {
        triangles,
        avatar,
        step(seconds: number) {
          advance(actor, seconds);
          frame();
        },
        info: () => ({
          triangles,
          anim: avatar.anim,
          sleeping: avatar.sleeping,
          height: avatar.height,
          rootY: avatar.root.position.y,
          drawCalls: renderer.info.render.calls,
          sceneTriangles: renderer.info.render.triangles,
          gpu: { ...renderer.info.memory },
          particlesVisible: avatar.effects.children[1]?.visible ?? false,
          durations: Object.fromEntries(ANIMS.map((a) => [a, avatar.duration(a)])),
        }),
      };

      const hudNow = (): Hud => ({ anim: avatar.anim, triangles, sleeping: avatar.sleeping, live: !still });
      setHud(hudNow());
      const hudTimer = window.setInterval(() => setHud(hudNow()), 250);

      /** How long a one-shot is shown before the live preview replays it. */
      const LOOP: Partial<Record<AvatarAnim, number>> = {
        jump: 0.45,
        fall: 0.45,
        land: 1.1,
        push: 1.4,
        dive: 1.3,
        backflip: 1.7,
        starPose: 3.4,
      };
      /** Live preview: fall first, then land, so the squash has something to absorb. */
      let landing = false;
      const start = (anim: AvatarAnim) => {
        avatar.root.position.y = 0;
        if (anim === "land") {
          landing = true;
          playOn(actor, "fall", ctl.speed);
        } else {
          landing = false;
          playOn(actor, anim, ctl.speed);
        }
      };

      let last = performance.now();
      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!still) {
          if (ctl.dirty) {
            ctl.dirty = false;
            avatar.wake();
            start(ctl.anim);
          }
          actor.speed = ctl.speed;
          avatar.setMoveSpeed(ctl.speed);
          if (landing && actor.anim === "fall" && actor.t > 0.4) playOn(actor, "land", ctl.speed);
          const period = LOOP[ctl.anim];
          if (period && actor.t > period && !(landing && actor.anim === "fall")) start(ctl.anim);
          actor.t += dt;
          actor.clock += dt;
          moveRoot(actor, dt);
          avatar.update(dt, actor.clock);
          if (ctl.spin) orbit += dt * 0.5;
        }
        frame();
        raf = requestAnimationFrame(loop);
      };
      if (!still && animParam === "land") start("land");
      raf = requestAnimationFrame(loop);
      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      cleanupExtra = () => {
        window.removeEventListener("resize", onResize);
        window.clearInterval(hudTimer);
      };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupExtra();
      for (const a of actors) a.avatar.dispose();
      stage.dispose();
      renderer.dispose();
      delete window.__avatar;
    };
  }, []);

  const pick = (anim: AvatarAnim) => {
    controls.current.anim = anim;
    controls.current.dirty = true;
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
          imageRendering: "pixelated",
        }}
      />
      {labels.map((l, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            left: l.left,
            top: l.top,
            padding: "3px 6px",
            font: "600 11px/1.2 ui-monospace, Menlo, monospace",
            color: "#fff",
            background: "rgba(16,22,40,0.72)",
            pointerEvents: "none",
          }}
        >
          {l.text}
        </div>
      ))}
      {hud?.live && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            right: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            font: "600 12px/1 ui-monospace, Menlo, monospace",
            color: "#fff",
          }}
        >
          {ANIMS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => pick(a)}
              style={{
                minHeight: 44,
                padding: "0 12px",
                border: "2px solid #ffd84a",
                borderRadius: 8,
                background: hud.anim === a ? "#ffd84a" : "#172554",
                color: hud.anim === a ? "#172554" : "#fff",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
            speed {speedUi.toFixed(2)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={speedUi}
              onChange={(e) => {
                const v = Number(e.target.value);
                controls.current.speed = v;
                setSpeedUi(v);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              controls.current.spin = !controls.current.spin;
            }}
            style={{
              minHeight: 44,
              padding: "0 12px",
              border: "2px solid #fff",
              borderRadius: 8,
              background: "#172554",
              color: "#fff",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            turntable
          </button>
          <span style={{ padding: "6px 8px", background: "rgba(16,22,40,0.72)", borderRadius: 6 }}>
            {hud.triangles} triangles · {hud.anim}
            {hud.sleeping ? " · sleeping" : ""}
          </span>
        </div>
      )}
    </>
  );
}

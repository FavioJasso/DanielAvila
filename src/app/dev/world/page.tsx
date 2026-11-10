"use client";

/**
 * Dev harness for the 3D world module (src/game/world). Renders the world on
 * its own, at the engine's retro resolution, from fixed camera presets.
 *
 *   ?view=top | lobby | spawn | door0..door4 | alcove0..alcove4 | pedestal |
 *         ceiling | south | banner0 | banner1 | arch0..arch4 | corner | orbit
 *   ?open=1                  all doors open
 *   ?ripple=in|out&at=0.4    fire every painting's ripple and freeze it `at` seconds in
 *   ?glow=1                  focus highlight on every painting (0..1)
 *   ?burst=0.3               fire starBurst() and freeze `burst` seconds in
 *   ?t=2.5                   freeze the clock at t seconds (deterministic stills)
 *   ?debug=colliders         draw layout.ts collider segments as bright lines
 *   ?res=480|full            internal render height (default 480, 360 on touch)
 *   ?rm=1                    reducedMotion
 *   ?quality=low
 *   ?cam=x,y,z&look=x,y,z    free camera
 *   ?zoom=4&center=x,z       magnify the plan view (view=top) about a ground point
 *   ?bg=ff00ff               backdrop colour, for the hole check below
 *
 * window.__world = { info, world, setView, setCamera, setOpen, checkWalls, probePainting,
 *                    pick, holes, disposeTest, allocTest }
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DOORS, type HitTag, type World } from "@/game/contract";
import { ARCH_DEPTH, DOOR_FRAMES, ROOM, buildColliders, wallFrame } from "@/game/layout";
import { createPaintingCanvas } from "@/game/services";
import { createWorld } from "@/game/world";

interface View {
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  /** Orthographic half-height; set for the plan view. */
  ortho?: number;
}

const VIEW_NAMES = [
  "top",
  "lobby",
  "spawn",
  "door0",
  "door1",
  "door2",
  "door3",
  "door4",
  "alcove0",
  "alcove1",
  "alcove2",
  "alcove3",
  "alcove4",
  "pedestal",
  "ceiling",
  "south",
];

function viewFor(name: string): View {
  const num = Number(name.replace(/^\D+/, ""));
  if (name === "top") {
    const q = new URLSearchParams(window.location.search);
    const zoom = Number(q.get("zoom")) || 1;
    const c = (q.get("center") ?? "0,0").split(",").map(Number);
    const cx = Number.isFinite(c[0]) ? c[0] : 0;
    const cz = Number.isFinite(c[1]) ? c[1] : 0;
    return { pos: [cx, 40, cz], look: [cx, 0, cz], ortho: 17.5 / zoom };
  }
  if (name === "spawn") return { pos: [0, 3.1, 8.3], look: [0, 2.2, -5] };
  if (name === "pedestal") return { pos: [2.5, 2.3, 4.7], look: [0, 1.45, 0], fov: 45 };
  if (name === "ceiling") return { pos: [0, 1.6, 5.5], look: [0, 9.2, -1.5], fov: 70 };
  if (name === "south") return { pos: [0, 3.2, -5.5], look: [0, 3.1, 11] };
  if (name === "corner") return { pos: [-2, 2.2, -3], look: [-4.55, 2.6, -11], fov: 50 };
  if (name.startsWith("door") && DOOR_FRAMES[num]) {
    const f = DOOR_FRAMES[num];
    // whole door bay: floor, arch, sign and star emblems; the painting shows through when open
    const p = f.at(0.9, -7.6);
    const l = f.at(0, 1.5);
    return { pos: [p.x, 2.3, p.z], look: [l.x, 3.55, l.z], fov: 52 };
  }
  if (name.startsWith("alcove") && DOOR_FRAMES[num]) {
    const f = DOOR_FRAMES[num];
    const p = f.at(0, ARCH_DEPTH + 0.2);
    return { pos: [p.x, 1.95, p.z], look: [f.painting.x, 2.1, f.painting.z], fov: 62 };
  }
  if (name.startsWith("arch") && DOOR_FRAMES[num]) {
    const f = DOOR_FRAMES[num];
    const p = f.at(2.9, -4.6);
    const l = f.at(0, 0.4);
    return { pos: [p.x, 1.9, p.z], look: [l.x, 2.9, l.z], fov: 60 };
  }
  if (name.startsWith("banner")) {
    const f = wallFrame(num === 1 ? -135 : 135);
    const p = f.at(0.8, -7);
    const l = f.at(0, 0);
    return { pos: [p.x, 3.2, p.z], look: [l.x, 3.8, l.z] };
  }
  return { pos: [0, 5.5, 10.2], look: [0, 2.2, -6] };
}

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const parseVec = (s: string | null): [number, number, number] | null => {
  if (!s) return null;
  const v = s.split(",").map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? [v[0], v[1], v[2]] : null;
};

interface Harness {
  info: { triangles: number; calls: number; geometries: number; textures: number; programs: number };
  world: World;
  setView(name: string): void;
  /** Free camera for scripted sweeps. */
  setCamera(pos: [number, number, number], look: [number, number, number], fov?: number): void;
  setOpen(open: boolean): void;
  /** Max ground distance from wall vertices (below the arch springline) to the nearest collider segment. */
  checkWalls(): { vertices: number; maxDistance: number; unmatchedColliderEnds: number };
  /** Rendered pixel vs. source canvas pixel at a texel centre of painting `index`. */
  probePainting(index: number, tx?: number, ty?: number): { rendered: number[]; canvas: number[] } | null;
  /** What a click at viewport fraction (x, y) hits, resolved the way the engine does. */
  pick(x: number, y: number): { hit: HitTag | null; object: string; distance: number } | null;
  /**
   * Pixels of the current view that show the backdrop. From any camera inside
   * the room this must be 0: a non-zero count means a gap or a crack.
   */
  holes(): { pixels: number; backdrop: number; where: [number, number][] };
  /** Build a second world, draw it, dispose it: GPU resources before / during / after. */
  disposeTest(): Record<"before" | "during" | "after", { geometries: number; textures: number }>;
  /** Heap growth (bytes) over `frames` world.update calls with doors, ripples and a burst running. */
  allocTest(frames?: number): { frames: number; heapDelta: number | null };
}

declare global {
  interface Window {
    __world?: Harness;
  }
}

export default function WorldHarnessPage() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const q = new URLSearchParams(window.location.search);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion =
      q.get("rm") === "1" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    const scene = new THREE.Scene();
    const persp = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 200);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    let camera: THREE.Camera = persp;
    let view: View = viewFor("lobby");
    let orbit = false;

    const world = createWorld({
      quality: q.get("quality") === "low" ? "low" : "high",
      reducedMotion,
    });
    world.applyEnvironment(scene);
    const bg = q.get("bg");
    if (bg && /^[0-9a-f]{6}$/i.test(bg)) scene.background = new THREE.Color(`#${bg}`);
    scene.add(world.root);

    /* ---- collider overlay ------------------------------------------- */
    const colliders = buildColliders();
    let overlay: THREE.Group | null = null;
    if (q.get("debug") === "colliders") {
      overlay = new THREE.Group();
      const pts: number[] = [];
      for (const s of colliders.segments) pts.push(s.ax, 0.08, s.az, s.bx, 0.08, s.bz);
      for (const c of colliders.circles) {
        for (let i = 0; i < 24; i++) {
          const a0 = (i / 24) * Math.PI * 2;
          const a1 = ((i + 1) / 24) * Math.PI * 2;
          pts.push(c.x + Math.cos(a0) * c.r, 0.08, c.z + Math.sin(a0) * c.r);
          pts.push(c.x + Math.cos(a1) * c.r, 0.08, c.z + Math.sin(a1) * c.r);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false, toneMapped: false }),
      );
      lines.renderOrder = 999;
      overlay.add(lines);
      scene.add(overlay);
    }

    /* ---- camera ------------------------------------------------------ */
    const applyView = () => {
      const aspect = window.innerWidth / window.innerHeight;
      if (view.ortho) {
        // fit the whole room whatever the aspect
        const half = aspect >= 1 ? view.ortho : view.ortho / aspect;
        ortho.left = -half * aspect;
        ortho.right = half * aspect;
        ortho.top = half;
        ortho.bottom = -half;
        ortho.position.set(...view.pos);
        ortho.up.set(0, 0, -1); // north at the top of the screen
        ortho.lookAt(...view.look);
        ortho.updateProjectionMatrix();
        camera = ortho;
      } else {
        persp.fov = view.fov ?? 55;
        persp.aspect = aspect;
        persp.position.set(...view.pos);
        persp.up.set(0, 1, 0);
        persp.lookAt(...view.look);
        persp.updateProjectionMatrix();
        camera = persp;
      }
    };
    const setView = (name: string) => {
      orbit = name === "orbit";
      view = viewFor(name);
      const cam = parseVec(q.get("cam"));
      const look = parseVec(q.get("look"));
      if (cam && name === (q.get("view") ?? "lobby")) view = { ...view, pos: cam, look: look ?? view.look, ortho: undefined };
      applyView();
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const res = q.get("res");
      let ih = res === "full" ? h : Number(res) || (touch ? 360 : 480);
      ih = Math.min(ih, h);
      let iw = Math.round((ih * w) / h);
      if (iw < 320 && res !== "full") {
        // portrait phones: keep at least 320 px across
        iw = 320;
        ih = Math.round((iw * h) / w);
      }
      renderer.setPixelRatio(1);
      renderer.setSize(iw, ih, false);
      applyView();
    };
    setView(q.get("view") ?? "lobby");
    resize();
    window.addEventListener("resize", resize);

    /* ---- scripted state --------------------------------------------- */
    if (q.get("open") === "1") world.doors.forEach((d) => d.setOpen(true));
    const glowParam = Number(q.get("glow") ?? "0");
    if (glowParam > 0) world.doors.forEach((d) => d.setGlow(Math.min(1, glowParam)));
    const rippleDir = q.get("ripple");
    const freezeRipple = Number(q.get("at") ?? "0.35");
    const burstAt = q.get("burst");
    const freezeT = q.get("t");

    // settle doors / glow so stills do not catch them mid-ease
    let clock = 0;
    const step = (seconds: number) => {
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) {
        clock += seconds / n;
        world.update(seconds / n, clock);
      }
    };
    step(2);
    let frozen = false;
    if (rippleDir === "in" || rippleDir === "out") {
      const uv = parseVec(`${q.get("uv") ?? "0.5,0.5"},0`);
      world.doors.forEach((d) => d.ripple(rippleDir, uv ? { u: uv[0], v: uv[1] } : undefined));
      step(freezeRipple);
      frozen = true;
    }
    if (burstAt !== null) {
      world.starBurst();
      step(Number(burstAt) || 0.3);
      frozen = true;
    }
    if (freezeT !== null) {
      step(Math.max(0.001, Number(freezeT) - clock));
      frozen = true;
    }

    /* ---- checks exposed to the screenshot driver --------------------- */
    const info: Harness["info"] = { triangles: 0, calls: 0, geometries: 0, textures: 0, programs: 0 };
    const v = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick: Harness["pick"] = (x, y) => {
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      ndc.set(x * 2 - 1, 1 - y * 2);
      raycaster.setFromCamera(ndc, camera);
      const first = raycaster.intersectObjects(world.pickables, true)[0];
      if (!first) return null;
      let o: THREE.Object3D | null = first.object;
      while (o && !o.userData.hit) o = o.parent;
      return {
        hit: o ? (o.userData.hit as HitTag) : null,
        object: first.object.name || first.object.parent?.name || first.object.type,
        distance: Math.round(first.distance * 100) / 100,
      };
    };
    const holes: Harness["holes"] = () => {
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      renderer.render(scene, camera);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const c = scene.background instanceof THREE.Color ? scene.background : new THREE.Color(0);
      const target = [c.r, c.g, c.b].map((v) => Math.round(linearToSrgb(v) * 255));
      let backdrop = 0;
      const where: [number, number][] = [];
      for (let i = 0; i < px.length; i += 4) {
        if (
          Math.abs(px[i] - target[0]) <= 1 &&
          Math.abs(px[i + 1] - target[1]) <= 1 &&
          Math.abs(px[i + 2] - target[2]) <= 1
        ) {
          backdrop++;
          // first few offenders as viewport fractions (origin top-left), for a closer look
          if (where.length < 6) {
            const p = i / 4;
            where.push([(p % w) / w, 1 - Math.floor(p / w) / h]);
          }
        }
      }
      return { pixels: w * h, backdrop, where };
    };
    const disposeTest: Harness["disposeTest"] = () => {
      const mem = () => ({
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      });
      renderer.render(scene, camera); // make sure everything in view is already uploaded
      const before = mem();
      const extra = createWorld({ quality: "high", reducedMotion: false });
      scene.add(extra.root);
      extra.update(0.016, 1);
      renderer.render(scene, camera);
      const during = mem();
      scene.remove(extra.root);
      extra.dispose();
      renderer.render(scene, camera);
      return { before, during, after: mem() };
    };
    const allocTest: Harness["allocTest"] = (frames = 20000) => {
      const heap = () =>
        (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
      world.doors.forEach((d, i) => {
        d.setOpen(i % 2 === 0);
        d.ripple(i % 2 === 0 ? "in" : "out");
        d.setGlow(1);
      });
      world.starBurst();
      const before = heap();
      let t = clock;
      for (let i = 0; i < frames; i++) {
        t += 1 / 60;
        world.update(1 / 60, t);
        // keep every animated path busy for the whole run
        if (i % 60 === 0) {
          world.starBurst();
          for (let k = 0; k < world.doors.length; k++) {
            world.doors[k].setOpen((i / 60 + k) % 2 === 0);
            world.doors[k].ripple(k % 2 === 0 ? "in" : "out");
          }
        }
      }
      const after = heap();
      return { frames, heapDelta: before === null || after === null ? null : after - before };
    };
    const harness: Harness = {
      setCamera(pos, look, fov) {
        orbit = false;
        view = { pos, look, fov };
        applyView();
      },
      pick,
      holes,
      disposeTest,
      allocTest,
      info,
      world,
      setView,
      setOpen(open) {
        world.doors.forEach((d) => d.setOpen(open));
        if (frozen) step(2);
      },
      checkWalls() {
        let vertices = 0;
        let maxDistance = 0;
        const distTo = (x: number, z: number) => {
          let best = Infinity;
          for (const s of colliders.segments) {
            const dx = s.bx - s.ax;
            const dz = s.bz - s.az;
            const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz)));
            best = Math.min(best, Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)));
          }
          return best;
        };
        const wallPoints: [number, number][] = [];
        for (const name of ["walls-stone", "walls-plaster"]) {
          const mesh = world.root.getObjectByName(name) as THREE.Mesh | undefined;
          if (!mesh) continue;
          const p = mesh.geometry.getAttribute("position");
          for (let i = 0; i < p.count; i++) {
            if (p.getY(i) > 2.29) continue; // above the springline walls bridge the door gaps
            vertices++;
            wallPoints.push([p.getX(i), p.getZ(i)]);
            maxDistance = Math.max(maxDistance, distTo(p.getX(i), p.getZ(i)));
          }
        }
        // … and the other way round: every collider end has wall geometry on it
        let unmatchedColliderEnds = 0;
        for (const s of colliders.segments) {
          for (const [x, z] of [
            [s.ax, s.az],
            [s.bx, s.bz],
          ]) {
            if (!wallPoints.some(([wx, wz]) => Math.hypot(wx - x, wz - z) < 0.03)) unmatchedColliderEnds++;
          }
        }
        return { vertices, maxDistance, unmatchedColliderEnds };
      },
      probePainting(index, tx = 100, ty = 10) {
        const mesh = world.root.getObjectByName(`painting-${index}`);
        const spec = DOORS[index];
        if (!mesh || !spec) return null;
        const src = createPaintingCanvas(spec.id);
        const ctx = src.getContext("2d");
        if (!ctx) return null;
        const px = ctx.getImageData(tx, ty, 1, 1).data;
        // texel centre → painting-local → clip → drawing-buffer pixel
        const u = (tx + 0.5) / src.width;
        const vv = 1 - (ty + 0.5) / src.height;
        v.set((u - 0.5) * ROOM.paintingSize, (vv - 0.5) * ROOM.paintingSize, 0);
        renderer.render(scene, camera); // also refreshes the camera matrices after setView()
        mesh.localToWorld(v).project(camera);
        const gl = renderer.getContext();
        const bx = Math.floor((v.x * 0.5 + 0.5) * gl.drawingBufferWidth);
        const by = Math.floor((v.y * 0.5 + 0.5) * gl.drawingBufferHeight);
        const out = new Uint8Array(4);
        gl.readPixels(bx, by, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return { rendered: [out[0], out[1], out[2]], canvas: [px[0], px[1], px[2]] };
      },
    };
    window.__world = harness;

    /* ---- loop --------------------------------------------------------- */
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!frozen) {
        clock += dt;
        world.update(dt, clock);
      }
      if (orbit) {
        const a = now / 4000;
        persp.position.set(Math.sin(a) * 8.5, 4.2, Math.cos(a) * 8.5);
        persp.lookAt(0, 2.4, 0);
      }
      renderer.render(scene, camera);
      info.triangles = renderer.info.render.triangles;
      info.calls = renderer.info.render.calls;
      info.geometries = renderer.info.memory.geometries;
      info.textures = renderer.info.memory.textures;
      info.programs = renderer.info.programs?.length ?? 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (overlay) {
        overlay.traverse((o) => {
          if (o instanceof THREE.LineSegments) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
      }
      world.dispose();
      renderer.dispose();
      delete window.__world;
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label={`World harness. Views: ${VIEW_NAMES.join(", ")}`}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        imageRendering: "pixelated",
        background: "#0a0f2c",
        touchAction: "none",
      }}
    />
  );
}

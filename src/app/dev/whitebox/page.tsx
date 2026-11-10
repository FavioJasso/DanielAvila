"use client";

/**
 * Dev harness: renders the ACTIVE world + avatar modules (see
 * src/game/modules.ts) from a fixed camera so layout can be sanity-checked.
 * ?view=top | lobby | door0..door4   ?open=1 opens every door
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createAvatar, createWorld } from "@/game/modules";
import { DOOR_FRAMES, SPAWN } from "@/game/layout";

export default function WhiteboxPage() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") ?? "lobby";
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 200);
    const world = createWorld({ quality: "high", reducedMotion: false });
    const avatar = createAvatar({ quality: "high", reducedMotion: false });
    world.applyEnvironment(scene);
    scene.add(world.root, avatar.root, avatar.effects);
    avatar.root.position.set(SPAWN.x, 0, SPAWN.z);
    avatar.root.rotation.y = SPAWN.yaw;
    if (params.get("open")) world.doors.forEach((d) => d.setOpen(true));

    if (view === "top") {
      camera.position.set(0, 34, 0.01);
      camera.lookAt(0, 0, 0);
    } else if (view.startsWith("door")) {
      const f = DOOR_FRAMES[Number(view.slice(4))];
      const p = f.at(0.9, -5.5);
      camera.position.set(p.x, 2.4, p.z);
      camera.lookAt(f.painting.x, 2, f.painting.z);
    } else {
      camera.position.set(0, 5.5, 10.2);
      camera.lookAt(0, 2.2, -6);
    }

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      world.update(dt, (now - t0) / 1000);
      avatar.update(dt, (now - t0) / 1000);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      world.dispose();
      avatar.dispose();
      renderer.dispose();
    };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", display: "block" }} />;
}

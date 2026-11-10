/**
 * STUB engine: no rendering, just walks the UI store through the same phase
 * transitions the real engine produces, so the React UI can be built and
 * tested before src/game/engine exists. Replaced by src/game/engine.
 */
import { DOORS, doorIndexOf, type CreateGame, type GameApi } from "../contract";
import { collectStar, ui } from "../store";
import { getAudio } from "../services";

export const createGame: CreateGame = ({ canvas, reducedMotion, touch }) => {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, reducedMotion ? Math.min(ms, 60) : ms);
    timers.add(t);
  };

  // paint something so the canvas is visibly "alive"
  const ctx = canvas.getContext("2d");
  const paint = () => {
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#27358f");
    g.addColorStop(1, "#0a0f2c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px monospace";
    const s = ui.get();
    ctx.fillText(`MOCK ENGINE  phase=${s.phase}  door=${s.focusedDoor}`, 12, 24);
  };
  const off = ui.subscribe(paint);

  ui.set({ webgl: "ok", engineReady: true, phase: "title", touch, reducedMotion });
  paint();

  const audio = getAudio();

  const api: GameApi = {
    start() {
      if (ui.get().phase !== "title") return;
      audio.unlock();
      audio.play("start");
      ui.set({ phase: "intro" });
      later(1400, () => {
        audio.setMusic("lobby");
        ui.set({ phase: "lobby" });
      });
    },
    cycleDoor(delta) {
      const s = ui.get();
      if (s.phase !== "lobby" || s.paused) return;
      const n = DOORS.length;
      const next = s.focusedDoor < 0 ? (delta > 0 ? 0 : n - 1) : (s.focusedDoor + delta + n) % n;
      api.goToDoor(next);
    },
    goToDoor(index) {
      const s = ui.get();
      if (s.phase !== "lobby" || s.paused) return;
      audio.play("uiMove");
      ui.set({ focusedDoor: index, nearDoor: -1, controlMode: "guided" });
      later(700, () => {
        if (ui.get().focusedDoor !== index) return;
        audio.play("doorOpen");
        ui.set({ nearDoor: index });
      });
    },
    enterCourse(id, opts) {
      const s = ui.get();
      if (s.phase !== "lobby") return;
      const index = doorIndexOf(id);
      ui.set({ paused: false, phase: "entering", focusedDoor: index, nearDoor: index });
      later(opts?.instant ? 150 : 1100, () => {
        audio.play(id === "resume" ? "starPose" : "warpIn");
        const fresh = collectStar(id);
        ui.set({
          phase: "course",
          overlay: id,
          flash: ui.get().flash + 1,
          toast: fresh ? "New star!" : null,
        });
        if (fresh) audio.play("starGet");
        audio.setMusic("course");
      });
    },
    exitCourse() {
      const s = ui.get();
      if (s.phase !== "course") return;
      audio.play("warpOut");
      ui.set({ phase: "exiting", overlay: null, flash: s.flash + 1 });
      later(800, () => {
        audio.setMusic("lobby");
        ui.set({ phase: "lobby", toast: null });
      });
    },
    setStick(x, y) {
      if (x !== 0 || y !== 0) ui.set({ controlMode: "free", focusedDoor: -1 });
    },
    jump() {
      audio.play("jump");
    },
    setPaused(paused) {
      const s = ui.get();
      if (s.paused === paused || s.phase === "title" || s.phase === "intro") return;
      audio.play(paused ? "pause" : "unpause");
      ui.set({ paused });
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers.clear();
      off();
    },
  };
  return api;
};

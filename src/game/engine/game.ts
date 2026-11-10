/**
 * The game itself: owns the scene, the frame loop and the phase machine,
 * and implements every GameApi command.
 *
 *   title → intro → lobby → entering → course → exiting → lobby
 *
 * Rules that keep it robust:
 *  - `ctrl` (the character controller) is the single source of truth for the
 *    avatar's transform; free roam, guided runs and scripted sequences all
 *    write to it and the avatar's root is synced from it once per frame.
 *  - Every scripted moment runs on the one `seq` runner, so starting any
 *    command cancels whatever was in flight and nothing can get stuck.
 *  - The frame loop sleeps whenever nothing can change on screen (paused,
 *    overlay covering the canvas, tab hidden) and every command wakes it.
 */
import * as THREE from "three";
import {
  DOORS,
  doorIndexOf,
  type AudioEngine,
  type Avatar,
  type GameApi,
  type GameOptions,
  type OverlayId,
  type Phase,
  type World,
} from "../contract";
import {
  ALCOVE_BACK,
  ALCOVE_HALF_WIDTH,
  ARCH_DEPTH,
  DOOR_FRAMES,
  PAINTING_DIVE_RANGE,
  ROOM,
  SPAWN,
} from "../layout";
import { getAudio } from "../services";
import { collectStar, ui } from "../store";
import { CameraRig, SHOT_NONE, SHOT_PUSH, type ShotKind } from "./camera";
import { Controller } from "./controller";
import { installDevHook } from "./devHook";
import { DoorLogic } from "./doors";
import { Input } from "./input";
import { angleDelta, clamp, clamp01, damp, frameD, frameU, lerp } from "./math";
import { NAV_ARRIVED, NAV_RUNNING, PathFollower, clampWalkable, walkable } from "./nav";
import { resolveCreateAvatar, resolveCreateWorld } from "./overrides";
import { Picker } from "./picking";
import type { View } from "./renderer";
import { playEnter, playExit, playIntro, playResume, type EnterMode } from "./scripts";
import { SequenceRunner } from "./sequences";
import {
  COURSE_RENDER_TAIL,
  DOOR_BLOCK_OPEN,
  MAX_DT,
  RUN_SPEED,
  SNORE_PERIOD,
  STEP_LENGTH,
} from "./tuning";

const RESTART = { restart: true } as const;
/** Alternating footsteps, so a run does not sound like a metronome. */
const STEP_SOUND = [
  { volume: 0.5, rate: 0.96 },
  { volume: 0.5, rate: 1.06 },
] as const;
/** How fast the movement frame may follow a turning camera while a key is held. */
const BASIS_TURN_RATE = 1.4;
/** Beyond this error the camera has swung, not drifted: stop following it. */
const BASIS_FOLLOW_LIMIT = 0.35;
/** Canvas drag → orbit, radians per CSS pixel. */
const ORBIT_YAW_PER_PX = 0.0042;
const ORBIT_PITCH_PER_PX = 0.0035;

export class Game {
  readonly api: GameApi;
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
  readonly touch: boolean;
  readonly audio: AudioEngine;
  readonly world: World;
  readonly avatar: Avatar;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly ctrl = new Controller();
  readonly nav = new PathFollower();
  readonly seq = new SequenceRunner();
  readonly picker = new Picker();
  readonly doors: DoorLogic;
  readonly input: Input;

  phase: Phase = "title";
  paused = false;
  /** Simulated seconds (stops while paused or asleep). */
  time = 0;
  /** Frames rendered. */
  frames = 0;

  /* guided navigation */
  controlMode: "guided" | "free" = "guided";
  focusedDoor = -1;
  /** Yaw the idle avatar eases towards in guided mode; NaN = leave it. */
  faceYaw = NaN;
  /** Door the current auto-path leads to, or -1 (floor click). */
  private navDoor = -1;

  /* course state */
  /** Door of the course being entered / open / left, or -1. */
  courseDoor = -1;
  overlay: OverlayId | null = null;
  /** Target of the enter sequence in flight. */
  pendingId: OverlayId | null = null;
  /** The avatar has gone through the canvas (it is hidden). */
  inPainting = false;
  /** The course was entered by a free-roam jump (so return to free roam). */
  private entryFree = false;

  /* camera direction from sequences */
  private shot: ShotKind = SHOT_NONE;
  private shotDoor = 0;
  private shotSmooth = 0.3;
  cutNext = false;

  /* locomotion presentation */
  private basisYaw = Math.PI;
  private basisHeld = false;
  private heldX = 0;
  private heldY = 0;
  private landTime = 0;
  private pushTime = 0;
  private stepDist = 0;
  private stepFlip = 0;
  private snoreTime = 0;

  /* loop */
  private raf = 0;
  private last = 0;
  private disposed = false;
  private contextLost = false;
  private needsRender = true;
  private sizeDirty = true;
  /** In the course phase: simulated time at which rendering stops. */
  private sleepAt = Infinity;

  /* ui mirror (so the store is only written on change) */
  private uiNearDoor = -1;
  private uiNearStar = false;

  private hoverClickable = false;
  /** Frame of the last hover pick. */
  private hoverFrame = -100;
  private dragging = false;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly removeDevHook: () => void;

  constructor(
    opts: GameOptions,
    private readonly view: View,
  ) {
    this.canvas = opts.canvas;
    this.reducedMotion = opts.reducedMotion;
    this.touch = opts.touch;
    this.audio = getAudio();

    const quality = opts.touch ? "low" : "high";
    // Through the module registry (a dev harness may override it, see overrides.ts).
    this.world = resolveCreateWorld()({ quality, reducedMotion: opts.reducedMotion });
    this.avatar = resolveCreateAvatar()({ quality, reducedMotion: opts.reducedMotion });
    this.world.applyEnvironment(this.scene);
    this.scene.add(this.world.root, this.avatar.root, this.avatar.effects);
    this.doors = new DoorLogic(this.world, this.audio);

    this.ctrl.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
    this.syncAvatar();
    this.rig.setAspect(view.aspect);

    this.input = new Input(this.canvas, {
      active: () => this.acceptsInput(),
      onActivity: () => this.wake(),
      onTap: (x, y) => this.onTap(x, y),
      onDrag: (dx, dy) => this.onDrag(dx, dy),
      onDragState: (dragging) => {
        this.dragging = dragging;
        this.applyCursor();
      },
      onWheelStep: (direction) => this.cycleDoor(direction),
    });

    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(this.canvas);

    this.api = {
      start: () => this.start(),
      cycleDoor: (delta) => this.cycleDoor(delta),
      goToDoor: (index) => this.goToDoor(index),
      enterCourse: (id, o) => this.enterCourse(id, o),
      exitCourse: () => this.exitCourse(),
      setStick: (x, y) => this.setStick(x, y),
      jump: () => this.jump(),
      setPaused: (paused) => this.setPaused(paused),
      dispose: () => this.dispose(),
    };

    ui.set({
      webgl: "ok",
      engineReady: false,
      phase: "title",
      paused: false,
      focusedDoor: -1,
      nearDoor: -1,
      nearStar: false,
      overlay: null,
      controlMode: "guided",
      touch: opts.touch,
      reducedMotion: opts.reducedMotion,
      toast: null,
    });
    this.audio.setMusic("title");
    this.removeDevHook = installDevHook(this, view);
    this.wake();
  }

  /* ================================================================== */
  /* GameApi                                                             */
  /* ================================================================== */

  private start(): void {
    if (this.disposed || this.phase !== "title") return;
    this.audio.unlock();
    this.audio.play("start");
    this.avatar.wake();
    this.avatar.play("idle");
    this.setPhase("intro");
    if (this.reducedMotion) this.cutNext = true; // cut, do not swoop
    playIntro(this);
    this.wake();
  }

  private cycleDoor(delta: 1 | -1): void {
    if (!this.acceptsInput()) return;
    const n = DOORS.length;
    const step = delta < 0 ? -1 : 1;
    let next: number;
    if (this.focusedDoor >= 0) {
      next = (this.focusedDoor + step + n) % n;
    } else {
      // Start from the door nearest the avatar. Ties (the spawn point is as
      // far from the west door as from the east one) go to the side being
      // cycled away from, so NEXT begins at the left and PREV at the right.
      const c = this.ctrl;
      let best = -1;
      let bestDist = Infinity;
      for (let k = 0; k < n; k++) {
        const i = step > 0 ? k : n - 1 - k;
        const s = DOOR_FRAMES[i].standPoint;
        const dist = Math.hypot(c.x - s.x, c.z - s.z);
        if (dist < bestDist - 1e-6) {
          bestDist = dist;
          best = i;
        }
      }
      // already standing at that door → move on to its neighbour
      next = bestDist < 2 ? (best + step + n) % n : best;
    }
    this.goToDoor(next);
  }

  private goToDoor(index: number): void {
    if (!this.acceptsInput()) return;
    if (!Number.isInteger(index) || index < 0 || index >= DOORS.length) return;
    const c = this.ctrl;
    const f = DOOR_FRAMES[index];
    this.avatar.wake();
    this.audio.play("uiMove");
    this.controlMode = "guided";
    this.focusedDoor = index;
    this.doors.target = index;
    ui.set({ focusedDoor: index, controlMode: "guided" });
    this.rig.orbitYaw = 0;
    this.rig.orbitPitch = 0;
    if (this.reducedMotion) this.cutNext = true; // straight to the door shot
    if (Math.hypot(c.x - f.standPoint.x, c.z - f.standPoint.z) < 0.05) {
      this.nav.cancel();
      this.navDoor = -1;
      this.faceYaw = f.yawOut;
    } else {
      this.faceYaw = NaN;
      this.navDoor = index;
      this.nav.plan(c.x, c.z, f.standPoint.x, f.standPoint.z);
    }
    this.wake();
  }

  private enterCourse(id: OverlayId, opts?: { instant?: boolean }): void {
    if (this.disposed) return;
    if (id !== "resume" && doorIndexOf(id) < 0) return;
    let instant = opts?.instant === true;
    switch (this.phase) {
      case "title":
        return; // nothing to travel from yet
      case "intro":
        this.seq.cancel(); // → finishIntro(): the lobby is live
        break;
      case "lobby":
        break;
      case "entering":
        if (this.pendingId === id && !instant) {
          this.unpauseQuietly();
          this.wake();
          return; // already on the way
        }
        this.seq.cancel(); // → abortEnter() / abortResume()
        break;
      case "course":
        if (this.overlay === id) {
          this.unpauseQuietly();
          this.wake();
          return;
        }
        // overlay → overlay: the canvas is covered, so always cut
        if (this.overlay !== "resume") instant = true;
        this.leaveCourseQuietly();
        break;
      case "exiting":
        this.seq.cancel(); // → finishExit(): standing outside the door
        break;
    }
    this.unpauseQuietly();
    this.beginEnter(id, instant ? "instant" : "walk");
    this.wake();
  }

  private exitCourse(): void {
    if (this.disposed) return;
    if (this.phase === "course") {
      this.unpauseQuietly();
      if (this.overlay === "resume") this.closeResume();
      else this.beginExit(this.courseDoor);
    } else if (this.phase === "entering") {
      this.unpauseQuietly();
      if (this.inPainting && this.courseDoor >= 0) {
        // already through the canvas: come back out the proper way
        this.seq.clear();
        this.beginExit(this.courseDoor);
      } else {
        this.seq.cancel(); // → abortEnter() / abortResume()
        this.phase = "lobby";
        ui.set({ phase: "lobby", overlay: null });
      }
    }
    this.wake();
  }

  private setStick(x: number, y: number): void {
    if (this.disposed) return;
    this.input.setStick(x, y);
    this.wake();
  }

  private jump(): void {
    if (!this.acceptsInput()) return;
    this.input.queueJump();
    this.wake();
  }

  private setPaused(paused: boolean): void {
    if (this.disposed || paused === this.paused) return;
    if (this.phase === "title" || this.phase === "intro") return;
    this.paused = paused;
    ui.set({ paused });
    this.audio.play(paused ? "pause" : "unpause");
    this.input.clearJump();
    if (paused) {
      this.hoverClickable = false;
      this.applyCursor();
    }
    this.needsRender = true;
    this.wake();
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.seq.clear();
    this.nav.cancel();
    this.input.dispose();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.resizeObserver?.disconnect();
    this.removeDevHook();
    this.canvas.style.cursor = "";
    this.scene.remove(this.world.root, this.avatar.root, this.avatar.effects);
    this.world.dispose();
    this.avatar.dispose();
    this.view.dispose();
    this.audio.setMusic(null);
    ui.set({ engineReady: false });
  }

  /* ================================================================== */
  /* Frame loop                                                          */
  /* ================================================================== */

  /** Make sure a frame is scheduled. Safe to call from anywhere, any time. */
  wake(): void {
    if (this.raf || this.disposed || this.contextLost || document.hidden) return;
    // pretend the previous frame was one tick ago: no time jump after a sleep
    this.last = performance.now() - 1000 / 60;
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed || this.contextLost) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 1 / 60;
    else if (dt > MAX_DT) dt = MAX_DT;

    if (this.sizeDirty) {
      this.sizeDirty = false;
      this.view.sync();
      this.rig.setAspect(this.view.aspect);
      this.needsRender = true;
    }
    const simulate = !this.paused && !this.asleep();
    if (simulate) {
      this.time += dt;
      this.update(dt);
    }
    if (simulate || this.needsRender) {
      this.needsRender = false;
      this.view.renderer.render(this.scene, this.rig.camera);
      this.frames++;
      if (this.frames === 1) ui.set({ engineReady: true });
    }
    if (!this.paused && !this.asleep() && !document.hidden) {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  /** An overlay covers the canvas and the ripple behind it has played out. */
  private asleep(): boolean {
    return this.phase === "course" && this.time >= this.sleepAt;
  }

  private update(dt: number): void {
    this.input.sample();
    this.seq.update(dt);
    if (this.phase === "lobby") this.updateLobby(dt);
    this.doors.update(this.ctrl);
    this.syncUi();
    this.syncAvatar();
    this.world.update(dt, this.time);
    this.avatar.update(dt, this.time);
    this.aimCamera(dt);
    this.updateHover();
  }

  private syncAvatar(): void {
    const c = this.ctrl;
    const root = this.avatar.root;
    root.position.set(c.x, c.y, c.z);
    root.rotation.y = c.yaw;
  }

  private syncUi(): void {
    const d = this.doors;
    if (d.near !== this.uiNearDoor) {
      this.uiNearDoor = d.near;
      ui.set({ nearDoor: d.near });
    }
    if (d.nearStar !== this.uiNearStar) {
      this.uiNearStar = d.nearStar;
      ui.set({ nearStar: d.nearStar });
    }
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.audio.suspend();
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.input.releaseAll();
    } else {
      this.audio.resume();
      this.wake();
    }
  };

  private readonly onResize = (): void => {
    this.sizeDirty = true;
    this.wake();
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault(); // tells the browser we want the context back
    this.contextLost = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    ui.set({ webgl: "lost" });
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.needsRender = true;
    ui.set({ webgl: "ok" });
    this.wake();
  };

  /* ================================================================== */
  /* Lobby: free roam and guided runs                                    */
  /* ================================================================== */

  /** Gameplay input is live: in the lobby and not paused. */
  acceptsInput(): boolean {
    return !this.disposed && this.phase === "lobby" && !this.paused;
  }

  private updateLobby(dt: number): void {
    const input = this.input;
    const c = this.ctrl;
    const moving = input.mag > 0;
    const jump = input.consumeJump();
    if (moving || jump) this.takeFreeControl();
    if (jump && this.tryJumpDive()) return;

    if (this.nav.active) {
      if (this.runPath(dt)) {
        if (this.navDoor >= 0) this.faceYaw = DOOR_FRAMES[this.navDoor].yawOut;
        this.navDoor = -1;
      }
    } else {
      // Movement is relative to the camera, read when a direction is
      // pressed. While it is held the frame follows a slowly turning camera
      // (so holding "left" runs a lap of the room) but not a camera that
      // swings round (walking into an alcove, passing the pivot): then the
      // run keeps its heading until the player presses something else.
      const camYaw = Math.atan2(this.rig.forwardX, this.rig.forwardZ);
      if (!moving) {
        this.basisYaw = camYaw;
        this.basisHeld = false;
      } else {
        const ix = input.x / input.mag;
        const iy = input.y / input.mag;
        if (!this.basisHeld || ix * this.heldX + iy * this.heldY < 0.64) {
          this.basisYaw = camYaw; // new press, or a clear change of direction
          this.basisHeld = true;
          this.heldX = ix;
          this.heldY = iy;
        } else {
          const error = angleDelta(this.basisYaw, camYaw);
          if (Math.abs(error) < BASIS_FOLLOW_LIMIT) {
            const turn = BASIS_TURN_RATE * dt;
            this.basisYaw += clamp(error, -turn, turn);
          }
        }
      }
      let wx = 0;
      let wz = 0;
      if (moving) {
        const fx = Math.sin(this.basisYaw);
        const fz = Math.cos(this.basisYaw);
        wx = fx * input.y - fz * input.x;
        wz = fz * input.y + fx * input.x;
        const len = Math.hypot(wx, wz) || 1;
        wx /= len;
        wz /= len;
        // let a dragged camera drift back behind the avatar while it runs
        const ease = Math.exp(-dt * 1.3);
        this.rig.orbitYaw *= ease;
        this.rig.orbitPitch *= ease;
      }
      c.stepFree(wx, wz, input.mag, jump, dt, RUN_SPEED);
      if (!moving && c.grounded && !Number.isNaN(this.faceYaw)) {
        c.yaw += angleDelta(c.yaw, this.faceYaw) * damp(10, dt);
      }
      this.locomotion(dt, moving);
      if (!c.grounded && this.touchesCanvas()) return;
    }

    if (this.avatar.sleeping) {
      this.snoreTime -= dt;
      if (this.snoreTime <= 0) {
        this.snoreTime = SNORE_PERIOD;
        this.audio.play("snore");
      }
    } else {
      this.snoreTime = 1;
    }
  }

  /** Any free-roam input: drop the auto-path and the guided focus at once. */
  private takeFreeControl(): void {
    this.avatar.wake();
    this.nav.cancel();
    this.navDoor = -1;
    this.faceYaw = NaN;
    if (this.controlMode !== "free" || this.focusedDoor !== -1) {
      this.controlMode = "free";
      this.focusedDoor = -1;
      this.doors.target = -1;
      ui.set({ controlMode: "free", focusedDoor: -1 });
    }
  }

  /**
   * Advance the guided run by one frame. Returns true when it is over
   * (arrived, or abandoned because the way is blocked).
   */
  runPath(dt: number): boolean {
    const c = this.ctrl;
    const nav = this.nav;
    const status = nav.steer(c.x, c.z, dt, c.hitDoor >= 0);
    if (status === NAV_RUNNING) {
      c.stepAuto(nav.dirX, nav.dirZ, nav.speed, dt);
      this.locomotion(dt, true);
      return false;
    }
    if (status === NAV_ARRIVED && c.isValid(nav.endX, nav.endZ)) {
      c.x = nav.endX;
      c.z = nav.endZ;
    }
    c.vx = 0;
    c.vz = 0;
    this.standStill(dt);
    return true;
  }

  /** One frame of standing in place (gravity still applies if airborne). */
  standStill(dt: number): void {
    this.ctrl.stepFree(0, 0, 0, false, dt, RUN_SPEED);
    this.locomotion(dt, false);
  }

  /** Sounds and animation for whatever the controller just did. */
  private locomotion(dt: number, wantsMove: boolean): void {
    const c = this.ctrl;
    const avatar = this.avatar;
    if (c.jumped) this.audio.play("jump");
    if (c.landed) {
      this.audio.play("land");
      // a running landing rolls straight on; a standing one plays out
      this.landTime = wantsMove ? 0.06 : Math.min(0.22, avatar.duration("land"));
      avatar.play("land", RESTART);
    }
    if (c.hitDoor >= 0 && wantsMove) this.pushTime = 0.18;
    else if (this.pushTime > 0) this.pushTime -= dt;

    if (!c.grounded) {
      avatar.play(c.vy > 0 ? "jump" : "fall");
      this.landTime = 0;
      return;
    }
    const speed = Math.hypot(c.vx, c.vz);
    if (speed > 1.2) {
      this.stepDist += speed * dt;
      if (this.stepDist >= STEP_LENGTH) {
        this.stepDist -= STEP_LENGTH;
        this.stepFlip ^= 1;
        this.audio.play("step", STEP_SOUND[this.stepFlip]);
      }
    } else {
      this.stepDist = STEP_LENGTH * 0.55; // first step lands soon after setting off
    }
    if (this.landTime > 0) {
      this.landTime -= dt;
      return;
    }
    if (this.pushTime > 0) {
      avatar.play("push");
    } else if (speed > 0.6) {
      avatar.play("run");
      avatar.setMoveSpeed(Math.min(1, speed / RUN_SPEED));
    } else {
      avatar.play("idle");
    }
  }

  /** Jump pressed in front of a painting → dive into it. */
  private tryJumpDive(): boolean {
    const c = this.ctrl;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      const d = frameD(f, c.x, c.z);
      if (d < ARCH_DEPTH || ALCOVE_BACK - d > PAINTING_DIVE_RANGE) continue;
      if (Math.abs(frameU(f, c.x, c.z)) >= ALCOVE_HALF_WIDTH) continue;
      // not when plainly facing away from the canvas
      if (Math.sin(c.yaw) * f.dir.x + Math.cos(c.yaw) * f.dir.z < -0.25) return false;
      this.beginEnter(DOORS[i].id, "free");
      return true;
    }
    return false;
  }

  /** Airborne and against the canvas → dive into it. */
  private touchesCanvas(): boolean {
    const c = this.ctrl;
    if (c.y < 0.2) return false;
    const reach = ROOM.avatarRadius + 0.08;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const f = DOOR_FRAMES[i];
      if (ALCOVE_BACK - frameD(f, c.x, c.z) > reach) continue;
      if (Math.abs(frameU(f, c.x, c.z)) > ROOM.paintingSize / 2) continue;
      this.beginEnter(DOORS[i].id, "free");
      return true;
    }
    return false;
  }

  /* ================================================================== */
  /* Pointer                                                             */
  /* ================================================================== */

  private onTap(clientX: number, clientY: number): void {
    const hit = this.picker.pick(
      clientX,
      clientY,
      this.canvas,
      this.rig.camera,
      this.world.pickables,
    );
    if (!hit) return;
    this.avatar.wake();
    switch (hit.kind) {
      case "door":
      case "sign":
        this.goToDoor(hit.index);
        break;
      case "painting":
        // only an exposed painting can be jumped into
        if (
          hit.index >= 0 &&
          hit.index < DOORS.length &&
          this.world.doors[hit.index].openAmount >= DOOR_BLOCK_OPEN
        ) {
          this.enterCourse(DOORS[hit.index].id);
        } else {
          this.goToDoor(hit.index);
        }
        break;
      case "star":
        this.enterCourse("resume");
        break;
      case "floor":
        this.walkTo(hit.x, hit.z);
        break;
    }
  }

  /** Point-and-click on the floor: auto-walk there. */
  private walkTo(x: number, z: number): void {
    const c = this.ctrl;
    clampWalkable(x, z);
    if (!c.isValid(walkable.x, walkable.z)) return;
    this.controlMode = "guided";
    this.focusedDoor = -1;
    this.doors.target = -1;
    ui.set({ focusedDoor: -1, controlMode: "guided" });
    this.faceYaw = NaN;
    this.navDoor = -1;
    this.nav.plan(c.x, c.z, walkable.x, walkable.z);
    this.wake();
  }

  private onDrag(dx: number, dy: number): void {
    // the door shot is a composed frame; only the follow camera orbits
    this.avatar.wake(); // any input resets the idle / sleep timers
    if (this.controlMode === "guided" && this.focusedDoor >= 0) return;
    const rig = this.rig;
    rig.orbitYaw = clamp(rig.orbitYaw - dx * ORBIT_YAW_PER_PX, -2.4, 2.4);
    rig.orbitPitch = clamp(rig.orbitPitch + dy * ORBIT_PITCH_PER_PX, -0.3, 0.6);
  }

  private updateHover(): void {
    const input = this.input;
    // The scene can move under a resting mouse, so besides reacting to mouse
    // movement re-check a few times a second (never every frame: a raycast
    // allocates its hit list).
    // A mouse in constant motion re-picks at most every 4th frame.
    const due = this.frames - this.hoverFrame >= 4;
    if (!(input.hoverDirty && due) && (!input.hoverInside || (this.frames & 15) !== 0)) return;
    input.hoverDirty = false;
    this.hoverFrame = this.frames;
    let clickable = false;
    if (input.hoverInside && this.acceptsInput()) {
      const hit = this.picker.pick(
        input.hoverX,
        input.hoverY,
        this.canvas,
        this.rig.camera,
        this.world.pickables,
      );
      clickable = hit !== null && hit.kind !== "floor";
    }
    if (clickable !== this.hoverClickable) {
      this.hoverClickable = clickable;
      this.applyCursor();
    }
  }

  private applyCursor(): void {
    this.canvas.style.cursor = this.dragging
      ? "grabbing"
      : this.hoverClickable
        ? "pointer"
        : "";
  }

  /* ================================================================== */
  /* Camera                                                              */
  /* ================================================================== */

  private aimCamera(dt: number): void {
    const rig = this.rig;
    const c = this.ctrl;
    let smooth = 0.2;
    // a cut starts the follow direction afresh rather than turning to it
    if (this.cutNext) rig.resetFollow();
    if (this.shot !== SHOT_NONE) {
      rig.aimShot(this.shot, this.shotDoor);
      smooth = this.shotSmooth;
    } else if (this.phase === "title") {
      rig.aimTitle(this.time);
      smooth = 0;
    } else {
      rig.aimFollow(c.x, c.y, c.z, dt);
      if (this.phase === "intro") {
        smooth = 0.5; // the swoop in behind the avatar
      } else if (this.controlMode === "guided" && this.focusedDoor >= 0) {
        // Reduced motion: no travelling shot, just the framed door.
        const amount = this.reducedMotion
          ? 1
          : rig.doorShotAmount(this.focusedDoor, c.x, c.z);
        rig.blendDoorShot(this.focusedDoor, amount);
        smooth = lerp(0.2, 0.4, amount);
      }
    }
    if (this.cutNext) {
      this.cutNext = false;
      rig.cut();
    } else {
      rig.update(dt, smooth);
    }
  }

  /** Sequences direct the camera through this. */
  setShot(kind: ShotKind, door: number, smooth: number, cut: boolean): void {
    this.shot = kind;
    this.shotDoor = door;
    this.shotSmooth = smooth;
    if (cut || this.reducedMotion) this.cutNext = true;
  }

  shake(amount: number): void {
    if (!this.reducedMotion) this.rig.shake(amount);
  }

  /* ================================================================== */
  /* Phase transitions (used by the sequences in scripts.ts)             */
  /* ================================================================== */

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.input.clearJump();
    ui.set({ phase });
  }

  /** End of the intro, whether it played out or was cut short. */
  finishIntro(): void {
    if (this.phase !== "intro") return;
    this.setPhase("lobby");
    this.audio.setMusic("lobby");
  }

  setAvatarVisible(visible: boolean): void {
    this.avatar.root.visible = visible;
    this.avatar.effects.visible = visible;
  }

  private unpauseQuietly(): void {
    if (!this.paused) return;
    this.paused = false;
    ui.set({ paused: false });
  }

  private beginEnter(id: OverlayId, mode: EnterMode): void {
    this.nav.cancel();
    this.navDoor = -1;
    this.faceYaw = NaN;
    this.avatar.wake();
    this.pendingId = id;
    this.inPainting = false;
    this.phase = "entering";
    this.sleepAt = Infinity;
    this.input.clearJump();
    if (id === "resume") {
      this.courseDoor = -1;
      this.entryFree = false;
      this.controlMode = "guided";
      this.focusedDoor = -1;
      this.doors.target = -1;
      ui.set({ phase: "entering", focusedDoor: -1, controlMode: "guided" });
      playResume(this, mode === "instant");
      return;
    }
    const index = doorIndexOf(id);
    this.courseDoor = index;
    this.entryFree = mode === "free";
    this.doors.forced = index;
    if (mode !== "free") {
      this.controlMode = "guided";
      this.doors.target = index;
    }
    this.focusedDoor = index;
    ui.set({ phase: "entering", focusedDoor: index, controlMode: this.controlMode });
    playEnter(this, index, mode);
  }

  /**
   * The avatar reaches the canvas: ripple, splash and warp sounds, and the
   * camera starts pushing in. `u` / `y` locate the impact on the painting.
   */
  impact(index: number, u: number, y: number, pushIn: boolean): void {
    this.world.doors[index].ripple("in", {
      u: clamp01(0.5 + u / ROOM.paintingSize),
      v: clamp01(0.5 + (y + 0.45 - ROOM.paintingCenterY) / ROOM.paintingSize),
    });
    this.audio.play("dive");
    this.audio.play("warpIn");
    this.inPainting = true;
    if (pushIn) {
      this.setShot(SHOT_PUSH, index, 0.24, false);
      this.shake(0.05);
    }
  }

  /** White warp flash (the UI animates it). */
  flash(): void {
    ui.set({ flash: ui.get().flash + 1 });
  }

  /** The overlay opens: the end of every enter sequence. */
  openCourse(id: OverlayId): void {
    this.overlay = id;
    this.pendingId = null;
    this.phase = "course";
    ui.set({ overlay: id, phase: "course" });
    if (collectStar(id)) {
      ui.set({ toast: id === "resume" ? "Résumé unlocked!" : "New star!" });
      this.audio.play("starGet");
    }
    if (id === "resume") {
      // a small card: the lobby stays visible behind it, so keep rendering
      this.sleepAt = Infinity;
      return;
    }
    this.audio.setMusic("course");
    // park the hidden avatar in the alcove; stop rendering once the ripple
    // behind the overlay has played out
    const f = DOOR_FRAMES[this.courseDoor];
    this.ctrl.place(f.enterPoint.x, f.enterPoint.z, f.yawOut);
    this.sleepAt = this.time + COURSE_RENDER_TAIL;
  }

  /** An enter sequence was cancelled: put the avatar back on its feet. */
  abortEnter(index: number): void {
    const c = this.ctrl;
    this.nav.cancel();
    this.shot = SHOT_NONE;
    if (this.inPainting || !c.isValid(c.x, c.z)) {
      const f = DOOR_FRAMES[index];
      c.place(f.enterPoint.x, f.enterPoint.z, f.yawOut);
    } else {
      c.settle();
    }
    this.setAvatarVisible(true);
    this.inPainting = false;
    this.avatar.play("idle");
    this.doors.forced = -1;
    this.courseDoor = -1;
    this.pendingId = null;
    if (this.entryFree) {
      // a free-roam dive never had a guided focus to go back to
      this.focusedDoor = -1;
      ui.set({ focusedDoor: -1 });
    }
  }

  abortResume(): void {
    this.nav.cancel();
    this.shot = SHOT_NONE;
    this.ctrl.settle();
    this.avatar.play("idle");
    this.pendingId = null;
  }

  private closeResume(): void {
    this.overlay = null;
    this.shot = SHOT_NONE;
    this.avatar.play("idle");
    this.phase = "lobby";
    this.input.clearJump();
    ui.set({ overlay: null, phase: "lobby", toast: null });
  }

  /** Switching straight from one overlay to another (pause-menu travel). */
  private leaveCourseQuietly(): void {
    if (this.overlay !== "resume" && this.courseDoor >= 0) {
      const f = DOOR_FRAMES[this.courseDoor];
      this.ctrl.place(f.exitPoint.x, f.exitPoint.z, f.yawIn);
      this.audio.setMusic("lobby");
    }
    this.setAvatarVisible(true);
    this.inPainting = false;
    this.avatar.play("idle");
    this.shot = SHOT_NONE;
    this.doors.forced = -1;
    this.courseDoor = -1;
    this.overlay = null;
    ui.set({ overlay: null, toast: null });
  }

  private beginExit(index: number): void {
    this.overlay = null;
    this.pendingId = null;
    this.phase = "exiting";
    this.sleepAt = Infinity;
    this.doors.forced = index;
    ui.set({ overlay: null, phase: "exiting", flash: ui.get().flash + 1, toast: null });
    this.audio.setMusic("lobby");
    playExit(this, index);
  }

  /** End of the exit, whether it played out or was cut short. */
  finishExit(index: number): void {
    const f = DOOR_FRAMES[index];
    this.ctrl.place(f.exitPoint.x, f.exitPoint.z, f.yawIn);
    this.setAvatarVisible(true);
    this.inPainting = false;
    this.shot = SHOT_NONE;
    this.avatar.play("idle");
    this.doors.forced = -1;
    this.courseDoor = -1;
    this.faceYaw = NaN;
    if (this.entryFree) {
      // walked in under manual control → hand manual control back
      this.controlMode = "free";
      this.focusedDoor = -1;
      this.doors.target = -1;
    } else {
      this.controlMode = "guided";
      this.focusedDoor = index;
      this.doors.target = index;
    }
    this.phase = "lobby";
    this.input.clearJump();
    ui.set({ phase: "lobby", focusedDoor: this.focusedDoor, controlMode: this.controlMode });
  }
}

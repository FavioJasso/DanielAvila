/**
 * DANIEL AVILA 64 — shared contract.
 *
 * Every game module (world, avatar, audio, art, engine) and the React UI is
 * written against the types in this file. Do not change a signature here
 * without updating every implementer; add optional members instead.
 *
 * Conventions
 * - Units: 1 unit ≈ 1 metre. The avatar is ~1.75 units tall.
 * - Axes: +X = east (screen right when facing the doors), +Y = up,
 *   -Z = north (the centre door). The player spawns south of the centre
 *   facing north.
 * - Yaw: an object's forward is its local +Z. `rotation.y = yawFromDir(x, z)`
 *   = `Math.atan2(x, z)`. Facing north is yaw = Math.PI.
 * - All positions on the ground plane are plain `{ x, z }` objects so that
 *   layout maths can be shared with code that must not import three.
 */
import type * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Sections, doors, overlays                                           */
/* ------------------------------------------------------------------ */

export type SectionId =
  | "education"
  | "skills"
  | "career"
  | "certifications"
  | "about";

/** `resume` is the centre pedestal star (contact links + PDF résumé). */
export type OverlayId = SectionId | "resume";

/** Star emblem above a door: one star, three stars, or one big star. */
export type StarBadge = 1 | 3 | "big";

export interface DoorSpec {
  /** 0 = far left … 4 = far right, as seen from the spawn point. */
  index: number;
  id: SectionId;
  /** Text on the floating sign above the door. */
  label: string;
  badge: StarBadge;
  courseNumber: number;
  /** e.g. "Academic Foundation" */
  courseTitle: string;
  /** Name of the painting hanging in the alcove (original, non-Nintendo). */
  paintingTitle: string;
  /** One-line description of what the painting depicts. */
  paintingBlurb: string;
  /** Accent colour (CSS hex) used for the sign, glow and overlay header. */
  accent: string;
}

export const DOORS: readonly DoorSpec[] = [
  {
    index: 0,
    id: "education",
    label: "EDUCATION",
    badge: 1,
    courseNumber: 1,
    courseTitle: "Academic Foundation",
    paintingTitle: "The Royal Archive",
    paintingBlurb: "A fortress library and its courtyard.",
    accent: "#4f8cff",
  },
  {
    index: 1,
    id: "skills",
    label: "SKILLS",
    badge: 3,
    courseNumber: 2,
    courseTitle: "Technical Arsenal",
    paintingTitle: "Deep Rack Caverns",
    paintingBlurb: "A subterranean cyber cavern lit by retro terminals.",
    accent: "#35d6a4",
  },
  {
    index: 2,
    id: "career",
    label: "CAREER & LABS",
    badge: "big",
    courseNumber: 3,
    courseTitle: "Experience & Technical Projects",
    paintingTitle: "Clockwork Network",
    paintingBlurb: "Interlocking gears, firewalls and mission flags.",
    accent: "#ffb020",
  },
  {
    index: 3,
    id: "certifications",
    label: "CERTIFICATIONS",
    badge: 3,
    courseNumber: 4,
    courseTitle: "Credentials & Badges",
    paintingTitle: "Skyward Star Tower",
    paintingBlurb: "A sunlit sky tower ringed by floating gold stars.",
    accent: "#7cc8ff",
  },
  {
    index: 4,
    id: "about",
    label: "ABOUT & CONTACT",
    badge: 1,
    courseNumber: 5,
    courseTitle: "Player Profile & Comms",
    paintingTitle: "Sunset Courtyard",
    paintingBlurb: "A relaxed castle garden at sunset.",
    accent: "#ff7a59",
  },
] as const;

export const SECTION_IDS: readonly SectionId[] = DOORS.map((d) => d.id);

export const RESUME_STAR = {
  id: "resume" as const,
  title: "Résumé Star",
  subtitle: "Contact links and the official PDF résumé",
};

export function doorIndexOf(id: OverlayId): number {
  return DOORS.findIndex((d) => d.id === id);
}

/* ------------------------------------------------------------------ */
/* Ground-plane maths                                                  */
/* ------------------------------------------------------------------ */

export interface Vec2 {
  x: number;
  z: number;
}
/** A wall segment on the ground plane. */
export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Colliders {
  segments: Segment[];
  circles: Circle[];
}

export const yawFromDir = (x: number, z: number): number => Math.atan2(x, z);

/* ------------------------------------------------------------------ */
/* Picking                                                             */
/* ------------------------------------------------------------------ */

export type HitKind = "door" | "painting" | "sign" | "star" | "floor";
/**
 * The world tags pickable meshes with `mesh.userData.hit = HitTag`.
 * The engine raycasts `world.pickables` (recursive) and walks up the parent
 * chain until it finds a tag.
 */
export interface HitTag {
  kind: HitKind;
  /** Door index for door / painting / sign hits. */
  index?: number;
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

export type Quality = "low" | "high";

export interface DoorHandle {
  readonly spec: DoorSpec;
  /** 0 = closed … 1 = fully open. Animated inside `world.update`. */
  readonly openAmount: number;
  /** Ask the door to swing open / closed (the world eases towards it). */
  setOpen(open: boolean): void;
  /**
   * Fire the liquid ripple on this door's painting.
   * "in" = the avatar dives into the canvas, "out" = the avatar is ejected.
   * `uv` is the impact point in painting UV space (0..1), default centre.
   */
  ripple(direction: "in" | "out", uv?: { u: number; v: number }): void;
  /** Painting highlight 0..1 (focused / nearby). The world eases towards it. */
  setGlow(amount: number): void;
}

export interface World {
  /** Everything static and animated in the room, lights included. */
  readonly root: THREE.Group;
  readonly doors: readonly DoorHandle[];
  /** Objects to raycast; see HitTag. */
  readonly pickables: THREE.Object3D[];
  /** Set scene.background / scene.fog. */
  applyEnvironment(scene: THREE.Scene): void;
  /** Sparkle burst on the pedestal star (résumé collected / star pose). */
  starBurst(): void;
  /** `dt` seconds since last frame, `time` seconds since engine start. */
  update(dt: number, time: number): void;
  dispose(): void;
}

export interface WorldOptions {
  quality: Quality;
  reducedMotion: boolean;
}
export type CreateWorld = (opts: WorldOptions) => World;

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

/**
 * `idle` owns its own sub-states: a breathing bounce, a left/right glance
 * after 5 s, and after 20 s the avatar sits down and sleeps with floating
 * "Zzz" particles. Any `play()` of another animation or `wake()` resets it.
 *
 * `run`, `jump` (rising) and `fall` loop / hold while the engine moves the
 * root. `land`, `push`, `dive`, `backflip`, `starPose` are one-shots: they
 * run for `duration(name)` seconds and then hold their final pose until the
 * engine plays something else.
 */
export type AvatarAnim =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "land"
  | "push"
  | "dive"
  | "backflip"
  | "starPose";

export interface Avatar {
  /**
   * The engine owns `root.position` and `root.rotation.y`. Feet are at the
   * root's origin; the model faces local +Z. Animations must only move
   * children of `root`.
   */
  readonly root: THREE.Group;
  /**
   * World-space effects (dust puffs, Zzz, blob shadow). The engine adds this
   * to the scene at the origin and never transforms it.
   */
  readonly effects: THREE.Group;
  /** Standing height in units (≈ 1.75). */
  readonly height: number;
  readonly anim: AvatarAnim;
  /** True while the idle state machine is in its sleep sub-state. */
  readonly sleeping: boolean;
  play(anim: AvatarAnim, opts?: { restart?: boolean }): void;
  /** 0..1 run intensity; scales the run cycle and dust emission. */
  setMoveSpeed(v: number): void;
  /** Reset the idle timers (called on any user input). */
  wake(): void;
  /** Length in seconds of a one-shot animation. */
  duration(anim: AvatarAnim): number;
  update(dt: number, time: number): void;
  dispose(): void;
}

export interface AvatarOptions {
  quality: Quality;
  reducedMotion: boolean;
}
export type CreateAvatar = (opts: AvatarOptions) => Avatar;

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export type SfxName =
  | "start" // PRESS START chime
  | "uiMove" // prev / next door, menu cursor
  | "uiSelect"
  | "uiBack"
  | "pause"
  | "unpause"
  | "doorOpen" // wooden creak
  | "doorClose"
  | "step"
  | "jump"
  | "land"
  | "dive"
  | "warpIn" // entering a painting
  | "warpOut" // leaving a painting
  | "starGet" // new star collected
  | "starPose" // pedestal fanfare
  | "snore";

export type MusicTrack = "title" | "lobby" | "course";

export interface AudioEngine {
  /** Call inside a user gesture. Creates / resumes the AudioContext. */
  unlock(): void;
  readonly unlocked: boolean;
  play(name: SfxName, opts?: { volume?: number; rate?: number }): void;
  /** Cross-fade to a looping track, or `null` for silence. */
  setMusic(track: MusicTrack | null): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** Tab hidden / shown. */
  suspend(): void;
  resume(): void;
  dispose(): void;
}
export type CreateAudio = () => AudioEngine;

/* ------------------------------------------------------------------ */
/* Art                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Draws the original painting for a section onto a fresh square canvas
 * (default 128 px, drawn as chunky pixel art; consumers display it with
 * nearest-neighbour filtering). Used for the 3D painting textures and for
 * thumbnails in the HTML UI.
 */
export type CreatePaintingCanvas = (
  id: SectionId,
  size?: number,
) => HTMLCanvasElement;

/**
 * Draws the "DA" crest (Daniel's monogram) on a fresh square canvas with a
 * transparent background. Used on the carpet, the banners and in the UI.
 */
export type CreateEmblemCanvas = (size?: number) => HTMLCanvasElement;

/* ------------------------------------------------------------------ */
/* Engine <-> UI                                                       */
/* ------------------------------------------------------------------ */

export type Phase =
  | "title" // title screen, camera orbiting the lobby
  | "intro" // camera swooping in behind the avatar
  | "lobby" // playable
  | "entering" // diving into a painting
  | "course" // HTML overlay open
  | "exiting"; // being ejected from a painting

export interface GameOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  /** Coarse pointer: show touch controls, prefer low quality. */
  touch: boolean;
}

/** Commands the React UI sends to the engine. All are safe in any phase. */
export interface GameApi {
  /** PRESS START: title → intro swoop → lobby. */
  start(): void;
  /** Guided door cycling (< PREV DOOR / NEXT DOOR >, mouse wheel). */
  cycleDoor(delta: 1 | -1): void;
  /** Auto-run to a door; it opens and the camera frames the painting. */
  goToDoor(index: number): void;
  /**
   * Go into a course. Default: run to the door and jump into the painting.
   * `instant` (pause-menu fast travel): cut straight to the overlay.
   * `"resume"` runs to the pedestal, plays the star pose and opens the card.
   */
  enterCourse(id: OverlayId, opts?: { instant?: boolean }): void;
  /** Close the overlay: reverse ripple + backflip out onto the lobby floor. */
  exitCourse(): void;
  /** Virtual thumbstick, x = right, y = forward, each -1..1. (0,0) = release. */
  setStick(x: number, y: number): void;
  /** Virtual jump button. */
  jump(): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}
export type CreateGame = (opts: GameOptions) => GameApi;

/**
 * Door proximity logic: which doors should be open, which one the avatar is
 * "at", and whether it is standing by the résumé star.
 */
import type { AudioEngine, World } from "../contract";
import { DOOR_CLOSE_RADIUS, DOOR_FRAMES, DOOR_OPEN_RADIUS, PEDESTAL } from "../layout";
import type { Controller } from "./controller";
import { DOOR_BLOCK_OPEN, STAR_FAR_RADIUS, STAR_NEAR_RADIUS } from "./tuning";

export class DoorLogic {
  /** Guided-navigation target: held open however far away the avatar is. */
  target = -1;
  /** Door a scripted sequence needs open (the course being entered / left). */
  forced = -1;
  /** Dev aid: keep every door shut so the closed leaf can be tested. */
  locked = false;

  /** The open door nearest the avatar, or -1. */
  near = -1;
  nearStar = false;

  private readonly wantOpen: boolean[] = DOOR_FRAMES.map(() => false);
  private readonly glow: number[] = DOOR_FRAMES.map(() => 0);

  constructor(
    private readonly world: World,
    private readonly audio: AudioEngine,
  ) {}

  update(ctrl: Controller): void {
    const doors = this.world.doors;
    let near = -1;
    let nearDist = Infinity;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const c = DOOR_FRAMES[i].doorCenter;
      const dist = Math.hypot(ctrl.x - c.x, ctrl.z - c.z);
      // open inside the inner radius, stay open until past the outer one
      const want =
        !this.locked &&
        (i === this.target ||
          i === this.forced ||
          dist < DOOR_OPEN_RADIUS ||
          (this.wantOpen[i] && dist < DOOR_CLOSE_RADIUS));
      if (want !== this.wantOpen[i]) {
        this.wantOpen[i] = want;
        doors[i].setOpen(want);
        this.audio.play(want ? "doorOpen" : "doorClose");
      }
      if (want && dist < nearDist) {
        nearDist = dist;
        near = i;
      }
      // the leaf is solid until it has swung most of the way
      ctrl.leafBlocked[i] = doors[i].openAmount < DOOR_BLOCK_OPEN;
    }
    this.near = near;
    for (let i = 0; i < DOOR_FRAMES.length; i++) {
      const g = i === near ? 1 : this.wantOpen[i] ? 0.4 : 0;
      if (g !== this.glow[i]) {
        this.glow[i] = g;
        doors[i].setGlow(g);
      }
    }
    const starDist = Math.hypot(ctrl.x - PEDESTAL.x, ctrl.z - PEDESTAL.z);
    this.nearStar = starDist < (this.nearStar ? STAR_FAR_RADIUS : STAR_NEAR_RADIUS);
  }
}

/**
 * Development-only test seam. The engine always builds its world and avatar
 * through the registry in `src/game/modules.ts`; the engine harness
 * (`/dev/engine?avatar=real` / `?world=real`) can swap in another
 * implementation here to check camera framing against the real models before
 * the registry is flipped at integration. Ignored in production builds.
 */
import type { CreateAvatar, CreateWorld } from "../contract";
import { createAvatar, createWorld } from "../modules";

const overrides: { world: CreateWorld | null; avatar: CreateAvatar | null } = {
  world: null,
  avatar: null,
};

export function setModuleOverrides(next: {
  createWorld?: CreateWorld | null;
  createAvatar?: CreateAvatar | null;
}): void {
  if (process.env.NODE_ENV === "production") return;
  if (next.createWorld !== undefined) overrides.world = next.createWorld;
  if (next.createAvatar !== undefined) overrides.avatar = next.createAvatar;
}

export const resolveCreateWorld = (): CreateWorld =>
  (process.env.NODE_ENV !== "production" && overrides.world) || createWorld;

export const resolveCreateAvatar = (): CreateAvatar =>
  (process.env.NODE_ENV !== "production" && overrides.avatar) || createAvatar;

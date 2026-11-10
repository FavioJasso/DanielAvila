/**
 * 3D module registry — decides which implementation of the three.js modules
 * is live. Both entries point at the real modules:
 *
 *   world   → ./world   (createWorld)
 *   avatar  → ./avatar  (createAvatar)
 *
 * This file pulls in three.js, so it must only be imported by 3D code (the
 * engine and dev harnesses) — never by React UI that renders before the
 * engine chunk loads. UI-safe services live in ./services.
 */
import type { CreateAvatar, CreateWorld } from "./contract";
import { createWorld as realWorld } from "./world";
import { createAvatar as realAvatar } from "./avatar";

export const createWorld: CreateWorld = realWorld;
export const createAvatar: CreateAvatar = realAvatar;

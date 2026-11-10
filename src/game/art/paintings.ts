/**
 * The five course paintings — original pixel art, drawn procedurally.
 *
 * Each scene is painted once on a 64×64 logical grid (see ./scenes/*), cached
 * as RGBA bytes, and scaled to the requested size with exact nearest-neighbour
 * sampling. Output is deterministic: every scene uses a fixed-seed PRNG.
 *
 * Canvas-2D only — no three.js, no image files — because the first-paint UI
 * bundle imports this through `@/game/services`. Nothing touches the DOM
 * until `createPaintingCanvas` is called.
 */
import type { CreatePaintingCanvas, SectionId } from "../contract";
import { GRID, Pix, cleanSize, hex, rgbaToCanvas, type Color } from "./pixel";
import { ARCHIVE_PALETTE, drawArchive } from "./scenes/archive";
import { CAVERNS_PALETTE, drawCaverns } from "./scenes/caverns";
import { CLOCKWORK_PALETTE, drawClockwork } from "./scenes/clockwork";
import { COURTYARD_PALETTE, drawCourtyard } from "./scenes/courtyard";
import { TOWER_PALETTE, drawTower } from "./scenes/tower";

interface Scene {
  draw(p: Pix): void;
  /** Key colours: [outline, deep, mid, light, accent]. */
  palette: readonly Color[];
}

const SCENES: Readonly<Record<SectionId, Scene>> = {
  education: { draw: drawArchive, palette: ARCHIVE_PALETTE },
  skills: { draw: drawCaverns, palette: CAVERNS_PALETTE },
  career: { draw: drawClockwork, palette: CLOCKWORK_PALETTE },
  certifications: { draw: drawTower, palette: TOWER_PALETTE },
  about: { draw: drawCourtyard, palette: COURTYARD_PALETTE },
};

const sceneOf = (id: SectionId): Scene => SCENES[id] ?? SCENES.education;

/** Logical side length (pixels) every painting is drawn at. */
export const PAINTING_GRID = GRID;

/**
 * Paint a scene at logical resolution into a fresh buffer. Pure (no DOM), so
 * it can run in tests and tools as well as in the browser.
 */
export function renderPainting(id: SectionId): Pix {
  const p = new Pix(GRID, GRID, 0x000000);
  sceneOf(id).draw(p);
  return p;
}

const cache = new Map<SectionId, Uint8ClampedArray>();

function paintingBytes(id: SectionId): Uint8ClampedArray {
  let bytes = cache.get(id);
  if (!bytes) {
    bytes = renderPainting(id).toRGBA();
    cache.set(id, bytes);
  }
  return bytes;
}

/**
 * A fresh square canvas with the painting for a section, drawn as chunky
 * pixel art. Display it with nearest-neighbour filtering
 * (`image-rendering: pixelated` / `THREE.NearestFilter`). Sizes that are a
 * multiple of 64 keep every logical pixel perfectly square.
 */
export const createPaintingCanvas: CreatePaintingCanvas = (id, size = 128) =>
  rgbaToCanvas(paintingBytes(id), GRID, GRID, cleanSize(size, 128));

/**
 * The key colours of a painting as CSS hex strings, for UI accents:
 * `[outline, deep, mid, light, accent]` — darkest first, the luminous accent
 * last.
 */
export function paintingPalette(id: SectionId): readonly string[] {
  return sceneOf(id).palette.map(hex);
}

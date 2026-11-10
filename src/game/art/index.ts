/**
 * Art module — original pixel art drawn in code (canvas-2D only, no three.js,
 * no image files). The registries import `createPaintingCanvas` from
 * `./paintings` and `createEmblemCanvas` from `./emblem`; this barrel is a
 * convenience for the helpers.
 */
export {
  PAINTING_GRID,
  createPaintingCanvas,
  paintingPalette,
  renderPainting,
} from "./paintings";
export { createEmblemCanvas, renderEmblem } from "./emblem";
export { STAR_GRID, STAR_GRID_SMALL, createStarCanvas, renderStar } from "./star";

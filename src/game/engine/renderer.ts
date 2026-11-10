/**
 * The retro render target: a WebGLRenderer drawing at a deliberately low
 * internal resolution, upscaled by CSS with `image-rendering: pixelated`.
 *
 * The CSS size of the canvas belongs to whoever owns the element (the React
 * layer); this module only decides how many pixels are rendered into it.
 */
import * as THREE from "three";

/** Internal pixels along the short side of the canvas. */
const SHORT_SIDE_DESKTOP = 480;
const SHORT_SIDE_SMALL = 360;
/** CSS short side below which a non-touch screen counts as small. */
const SMALL_SCREEN = 560;

export interface View {
  readonly renderer: THREE.WebGLRenderer;
  /** Internal resolution actually rendered. */
  readonly width: number;
  readonly height: number;
  /** Width / height of the canvas on screen. */
  readonly aspect: number;
  /** Re-read the canvas CSS size. Returns true when the resolution changed. */
  sync(): boolean;
  dispose(): void;
}

/** Returns null when a WebGL context cannot be created. */
export function createView(canvas: HTMLCanvasElement, touch: boolean): View | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  const previousRendering = canvas.style.imageRendering;
  canvas.style.imageRendering = "pixelated";

  let width = 0;
  let height = 0;
  let aspect = 16 / 9;

  const view: View = {
    renderer,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get aspect() {
      return aspect;
    },
    sync() {
      const cssW = Math.max(1, canvas.clientWidth || window.innerWidth);
      const cssH = Math.max(1, canvas.clientHeight || window.innerHeight);
      const short = Math.min(cssW, cssH);
      // The guide asks for ~480 px (360 px on touch / small screens) of
      // internal height. Measuring the short side instead keeps the chunky
      // pixels the same size in portrait, where 360 px of *height* would
      // leave a phone with only ~165 px across.
      const target = touch || short < SMALL_SCREEN ? SHORT_SIDE_SMALL : SHORT_SIDE_DESKTOP;
      // never render more pixels than the display can show
      const scale = Math.min(target / short, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(cssW * scale));
      const h = Math.max(1, Math.round(cssH * scale));
      aspect = cssW / cssH;
      if (w === width && h === height) return false;
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      return true;
    },
    dispose() {
      canvas.style.imageRendering = previousRendering;
      // No forceContextLoss(): a canvas keeps its context for life, and the
      // same element may be handed to a new engine (React strict mode does
      // exactly that), which must find the context alive. And clean: a
      // leftover UNPACK_FLIP_Y makes the next renderer's start-up warn.
      renderer.resetState();
      renderer.dispose();
    },
  };
  view.sync();
  return view;
}

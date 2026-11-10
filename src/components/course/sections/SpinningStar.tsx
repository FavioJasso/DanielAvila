import type { CSSProperties } from "react";

/** Outline of the five-point star in a 100 × 100 box, clockwise from the top. */
const STAR: readonly (readonly [number, number])[] = [
  [50, 0],
  [61.8, 34.5],
  [97.6, 34.5],
  [68.6, 56],
  [79.4, 90.5],
  [50, 69.5],
  [20.6, 90.5],
  [31.4, 56],
  [2.4, 34.5],
  [38.2, 34.5],
];
const STAR_POINTS = STAR.map((p) => p.join(",")).join(" ");

/**
 * The ten rim faces that join the front and back of the gold star, one per
 * outline edge: where its centre sits, how long it is and how it is turned
 * (all as fractions of the star's size, consumed by `.cx-star3d__rim` in
 * course.css). Each face gets a fixed shade from its normal, as if lit from
 * the upper left — baked, low-poly shading.
 */
const RIM: readonly CSSProperties[] = STAR.map(([x1, y1], i) => {
  const [x2, y2] = STAR[(i + 1) % STAR.length];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  // Outward normal of a clockwise outline in screen space (y points down).
  const light = 0.5 + 0.5 * ((dy / length) * -0.45 + (-dx / length) * -0.89);
  return {
    "--cx-rim-x": ((x1 + x2) / 200).toFixed(4),
    "--cx-rim-y": ((y1 + y2) / 200).toFixed(4),
    "--cx-rim-length": (length / 100).toFixed(4),
    "--cx-rim-angle": `${Math.atan2(dy, dx).toFixed(4)}rad`,
    "--cx-rim-shade": `hsl(41 100% ${(30 + light * 26).toFixed(1)}%)`,
  } as CSSProperties;
});

/**
 * A CSS 3D star spinning around its vertical axis. Decorative.
 *  - "gold": a solid, faceted gold star — front and back faces joined by
 *    rim faces, so it reads as a real extruded shape at every angle
 *    (completed certifications, the résumé star).
 *  - "outline": a slower outlined star inside a dashed ring (in progress).
 * The animation is paused under `prefers-reduced-motion` (see course.css).
 */
export function SpinningStar({
  tone = "gold",
  size = 72,
}: {
  tone?: "gold" | "outline";
  /** CSS pixels. */
  size?: number;
}) {
  const style = { "--cx-star-size": `${size}px` } as CSSProperties;
  if (tone === "outline") {
    return (
      <span className="cx-star3d cx-star3d--outline" style={style} aria-hidden="true">
        <span className="cx-star3d__ring" />
        <span className="cx-star3d__spin">
          <svg className="cx-star3d__outline" viewBox="0 0 100 92">
            <polygon points={STAR_POINTS} />
          </svg>
        </span>
      </span>
    );
  }
  return (
    <span className="cx-star3d" style={style} aria-hidden="true">
      <span className="cx-star3d__glow" />
      <span className="cx-star3d__spin">
        <span className="cx-star3d__face cx-star3d__face--back" />
        {RIM.map((face, i) => (
          <span key={i} className="cx-star3d__rim" style={face} />
        ))}
        <span className="cx-star3d__face cx-star3d__face--front" />
      </span>
    </span>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { SectionId } from "@/game/contract";
import { createPaintingCanvas } from "@/game/services";

/**
 * A course painting as a crisp pixel-art thumbnail for the HTML UI.
 * Decorative by default (the course title is always printed next to it).
 */
export function PaintingThumb({
  id,
  size = 96,
  className,
  label,
}: {
  id: SectionId;
  /** CSS pixels (the art is drawn at 128 px and scaled with nearest-neighbour). */
  size?: number;
  className?: string;
  /** Provide to expose the image to assistive tech. */
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src = createPaintingCanvas(id, 128);
    canvas.width = src.width;
    canvas.height = src.height;
    canvas.getContext("2d")?.drawImage(src, 0, 0);
  }, [id]);
  return (
    <canvas
      ref={ref}
      width={128}
      height={128}
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

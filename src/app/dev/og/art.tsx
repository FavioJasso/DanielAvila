/**
 * Shared artwork for the pages under /dev/og — the social card and the app
 * icon. Everything here is plain HTML/CSS plus one inline SVG star, rendered
 * on the server so a headless screenshot is deterministic. It deliberately
 * does not import the game's art module: these images must be reproducible
 * without the 3D build.
 *
 * All artwork is original: a plain faceted gold star (no face), our own
 * chunky gold lettering, a pixel starfield and a checkerboard floor.
 */
import type { CSSProperties, ReactNode } from "react";

/** Design tokens, duplicated from globals.css so the art is self-contained. */
export const INK = "#0a0f2c";
export const NIGHT = "#131b4d";
export const DUSK = "#27358f";
export const ROYAL = "#3970eb";
export const SKY = "#8fc1ff";
export const STAR = "#ffc93c";
export const STAR_DEEP = "#e08a00";
export const CREAM = "#fff4d6";
export const MUTED = "#b7c0e8";

export const FONT_DISPLAY = 'var(--font-titan), "Arial Black", system-ui, sans-serif';
export const FONT_PIXEL = "var(--font-pixel-face), ui-monospace, monospace";
export const FONT_BODY = 'var(--font-outfit), system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Hides the Next.js dev indicator and removes page chrome so a screenshot of
 * the viewport is exactly the artwork.
 */
export function ScreenshotChrome() {
  return (
    <style>{`
      nextjs-portal { display: none !important; }
      html, body { margin: 0 !important; overflow: hidden !important; background: ${INK} !important; }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Starfield                                                           */
/* ------------------------------------------------------------------ */

/** Small deterministic PRNG so the starfield is identical on every render. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StarfieldProps {
  width: number;
  height: number;
  seed: number;
  count: number;
  /** Square "pixel" sizes in px, picked at random (repeat a value to weight it). */
  sizes: readonly number[];
  /** Optional predicate to keep stars out of an area (e.g. behind the logo). */
  keep?: (x: number, y: number) => boolean;
}

const STAR_TINTS = [CREAM, CREAM, "#ffffff", SKY, SKY, STAR] as const;

/** A field of square pixel stars. Purely decorative. */
export function Starfield({ width, height, seed, count, sizes, keep }: StarfieldProps) {
  const rnd = mulberry32(seed);
  const dots: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * width);
    const y = Math.round(rnd() * height);
    const size = sizes[Math.floor(rnd() * sizes.length)];
    const tint = STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)];
    const opacity = 0.35 + rnd() * 0.65;
    if (keep && !keep(x, y)) continue;
    dots.push(
      <i
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          background: tint,
          opacity,
        }}
      />,
    );
  }
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {dots}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gold star                                                           */
/* ------------------------------------------------------------------ */

const OUTER_R = 100;
const INNER_R = 52;

function starPoint(radius: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round(Math.cos(a) * radius * 100) / 100, Math.round(Math.sin(a) * radius * 100) / 100];
}

/** Ten vertices, clockwise from the top point. */
const STAR_VERTS: [number, number][] = Array.from({ length: 10 }, (_, i) =>
  starPoint(i % 2 === 0 ? OUTER_R : INNER_R, -90 + i * 36),
);
const STAR_OUTLINE = STAR_VERTS.map((p) => p.join(",")).join(" ");

/**
 * Facet shades, lit from the upper left. Facet i is the triangle (centre,
 * vertex i, vertex i + 1), so each point of the star is one lighter and one
 * darker facet — the flat-shaded low-poly look.
 */
const FACET_FILL = [
  "#f5ab1e", // top point, right side
  "#ffd65e", // right point, upper side
  "#e69200", // right point, lower side
  "#eb9a0c", // lower-right point, outer side
  "#ffc93c", // lower-right point, inner side
  "#f5ab1e", // lower-left point, inner side
  "#ffd65e", // lower-left point, outer side
  "#ffc93c", // left point, lower side
  "#fff0a8", // left point, upper side
  "#ffe488", // top point, left side
] as const;

/**
 * The plain gold five-point star: ten flat facets like a low-poly model, a
 * dark outline and a short hard extrusion. No face, no eyes.
 */
export function GoldStar({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="-125 -125 250 250"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      {/* hard drop shadow + extrusion */}
      <polygon points={STAR_OUTLINE} transform="translate(0 15)" fill={INK} stroke={INK} strokeWidth={22} strokeLinejoin="round" />
      <polygon points={STAR_OUTLINE} fill={INK} stroke={INK} strokeWidth={22} strokeLinejoin="round" />
      <polygon points={STAR_OUTLINE} transform="translate(0 9)" fill={STAR_DEEP} stroke={STAR_DEEP} strokeWidth={5} strokeLinejoin="round" />
      {/* faceted face */}
      {STAR_VERTS.map((p, i) => {
        const q = STAR_VERTS[(i + 1) % 10];
        return (
          <polygon
            key={i}
            points={`0,0 ${p.join(",")} ${q.join(",")}`}
            fill={FACET_FILL[i]}
            stroke={FACET_FILL[i]}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        );
      })}
      <polygon points={STAR_OUTLINE} fill="none" stroke="#fff6c9" strokeOpacity={0.55} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Soft halo behind the gold star, in Daniel's brand blue (ROYAL). A gold halo
 * on navy mixes to a muddy grey-brown, because the two colours are close to
 * complementary; blue stays clean and lets the gold star stand out.
 */
export function StarGlow({ size, style }: { size: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: size,
        height: size,
        background:
          "radial-gradient(closest-side, rgba(57,112,235,0.75) 0%, rgba(57,112,235,0.3) 50%, rgba(57,112,235,0) 100%)",
        ...style,
      }}
    />
  );
}

/** A small four-point sparkle. */
export function Sparkle({ size, color = CREAM, style }: { size: number; color?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="-10 -10 20 20" style={{ display: "block", ...style }}>
      <path d="M0,-10 L2.2,-2.2 L10,0 L2.2,2.2 L0,10 L-2.2,2.2 L-10,0 L-2.2,-2.2 Z" fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Chunky lettering                                                    */
/* ------------------------------------------------------------------ */

/** Lettering proportions, in em. */
const OUTLINE_EM = 0.06; // visible outline width around the face
const DEPTH_EM = 0.06; // extrusion under the face
const SHADOW_EM = 0.045; // hard drop shadow below the extrusion

export interface ChunkyPalette {
  /** CSS background for the letter faces (usually a vertical gradient). */
  face: string;
  /** Extrusion colour under the face. */
  depth: string;
  outline: string;
}

export const GOLD: ChunkyPalette = {
  face: "linear-gradient(180deg, #fff3b0 0%, #ffe07a 22%, #ffc93c 52%, #f7ad1f 100%)",
  depth: STAR_DEEP,
  outline: INK,
};

export const ICE: ChunkyPalette = {
  face: "linear-gradient(180deg, #ffffff 0%, #e4efff 35%, #b9d6ff 70%, #8fc1ff 100%)",
  depth: ROYAL,
  outline: INK,
};

/**
 * Our own logo lettering: the display face drawn as stacked layers — a dark
 * outline that also forms a hard drop shadow, a short extrusion, and a
 * gradient face. Layers are separate elements because a gradient-clipped fill
 * cannot share an element with an outline painted underneath it.
 */
export function Chunky({
  children,
  size,
  palette = GOLD,
  style,
}: {
  children: string;
  /** Font size in px. */
  size: number;
  palette?: ChunkyPalette;
  style?: CSSProperties;
}) {
  const layer: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    whiteSpace: "nowrap",
  };
  // The stroke is centred on the glyph edge, so half of it shows outside.
  const outline = (dy: number): CSSProperties => ({
    ...layer,
    color: palette.outline,
    WebkitTextStroke: `${size * OUTLINE_EM * 2}px ${palette.outline}`,
    transform: `translateY(${size * dy}px)`,
  });
  // Extrusion: the glyph repeated downwards one pixel at a time.
  const depthPx = Math.max(1, Math.round(size * DEPTH_EM));
  const extrusion = Array.from({ length: depthPx }, (_, i) => `0 ${i + 1}px 0 ${palette.depth}`).join(", ");
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: FONT_DISPLAY,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {/* in-flow copy sizes the box; it is invisible */}
      <span style={{ visibility: "hidden" }}>{children}</span>
      <span aria-hidden style={outline(DEPTH_EM + SHADOW_EM)}>{children}</span>
      <span aria-hidden style={outline((DEPTH_EM + SHADOW_EM) / 2)}>{children}</span>
      <span aria-hidden style={outline(0)}>{children}</span>
      <span aria-hidden style={{ ...layer, color: palette.depth, textShadow: extrusion }}>{children}</span>
      <span
        style={{
          ...layer,
          backgroundImage: palette.face,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {children}
      </span>
    </span>
  );
}

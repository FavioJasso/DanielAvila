/**
 * Dev-only source for public/og-image.png — the 1200 × 630 social card.
 * Screenshot the full viewport at exactly 1200 × 630, then run
 * build-images.mjs (see the README, "Icons and the social card").
 *
 * Pure HTML/CSS (plus the inline SVG star). All text comes from the content
 * file, so re-shoot the card after changing Daniel's name, role or employers.
 */
import type { Metadata } from "next";
import { credits, jobs, profile, SITE_URL } from "@/content/portfolio";
import {
  Chunky,
  CREAM,
  DUSK,
  FONT_BODY,
  FONT_PIXEL,
  GOLD,
  GoldStar,
  ICE,
  INK,
  MUTED,
  NIGHT,
  ScreenshotChrome,
  SKY,
  Sparkle,
  STAR,
  Starfield,
  StarGlow,
} from "../art";

export const metadata: Metadata = {
  title: "Social card (dev)",
  robots: { index: false, follow: false },
};

const W = 1200;
const H = 630;
/** y of the floor's far edge. */
const HORIZON = 506;
const TILE = 64;

/**
 * Areas the pixel stars stay out of, as [left, top, right, bottom]: the label,
 * the two wordmark rows and the role lines, each with a small margin. A star
 * that is half hidden by a letter's outline, or sits between two words, reads
 * as a speck of dirt on the lettering rather than as a star.
 */
const TEXT_ZONES: readonly (readonly [number, number, number, number])[] = [
  [64, 22, 492, 60], // "3D HUB-WORLD PORTFOLIO"
  [54, 60, 666, 236], // first name
  [54, 222, 832, 412], // last name + "64"
  [64, 398, 802, 494], // role and places
];

/** Largest star in the card's size list; a star is positioned by its top-left corner. */
const MAX_STAR = 5;

/** Keep pixel stars in the sky and clear of the lettering. */
const inOpenSky = (x: number, y: number) =>
  y < HORIZON - 12 &&
  !TEXT_ZONES.some(([left, top, right, bottom]) => x > left - MAX_STAR && x < right && y > top - MAX_STAR && y < bottom);

const pill = {
  border: `4px solid ${INK}`,
  borderRadius: 14,
  boxShadow: `0 6px 0 ${INK}`,
  fontFamily: FONT_PIXEL,
  whiteSpace: "nowrap",
} as const;

export default function OgCardPage() {
  const [first, last] = profile.name.toUpperCase().split(" ");
  const host = SITE_URL.replace(/^https?:\/\/(www\.)?/, "");
  const places = [...jobs.map((j) => j.company), profile.location];

  return (
    <>
      <ScreenshotChrome />
      <main
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: W,
          height: H,
          overflow: "hidden",
          background: `radial-gradient(120% 95% at 72% 32%, ${DUSK} 0%, ${NIGHT} 46%, ${INK} 100%)`,
          color: CREAM,
        }}
      >
        <Starfield width={W} height={H} seed={64} count={190} sizes={[2, 2, 3, 3, 4, MAX_STAR]} keep={inOpenSky} />

        {/* checkerboard floor: a plane hinged on the horizon and tipped towards the viewer */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: HORIZON,
            bottom: 0,
            overflow: "hidden",
            perspective: 500,
            perspectiveOrigin: "50% 0%",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -TILE * 12,
              right: -TILE * 12,
              top: 0,
              height: TILE * 8,
              transformOrigin: "50% 0%",
              transform: "rotateX(80deg)",
              backgroundImage: `repeating-conic-gradient(${CREAM} 0% 25%, #1c2769 0% 50%)`,
              backgroundSize: `${TILE * 2}px ${TILE * 2}px`,
              backgroundPosition: "50% 0",
            }}
          />
          {/* distance haze */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, rgba(19,27,77,0.82) 0%, rgba(19,27,77,0.45) 35%, rgba(10,15,44,0.1) 100%)`,
            }}
          />
        </div>
        <div
          aria-hidden
          style={{ position: "absolute", left: 0, right: 0, top: HORIZON - 3, height: 6, background: STAR, boxShadow: `0 3px 0 ${INK}` }}
        />

        {/* star + sparkles */}
        <StarGlow size={440} style={{ left: 750, top: 4 }} />
        <GoldStar size={320} style={{ position: "absolute", left: 812, top: 50, transform: "rotate(12deg)" }} />
        <Sparkle size={46} style={{ position: "absolute", left: 776, top: 56 }} />
        <Sparkle size={30} color={STAR} style={{ position: "absolute", left: 1124, top: 296 }} />
        <Sparkle size={24} style={{ position: "absolute", left: 1092, top: 40 }} />
        <Sparkle size={20} color={SKY} style={{ position: "absolute", left: 748, top: 300 }} />

        {/* top label */}
        <div
          style={{
            position: "absolute",
            left: 76,
            top: 32,
            fontFamily: FONT_PIXEL,
            fontSize: 17,
            letterSpacing: "0.08em",
            color: SKY,
          }}
        >
          3D HUB-WORLD PORTFOLIO
        </div>

        {/* wordmark */}
        <h1 style={{ position: "absolute", left: 72, top: 58, margin: 0, fontWeight: 400 }}>
          <Chunky size={150} palette={GOLD} style={{ display: "block" }}>
            {first}
          </Chunky>
          <span style={{ display: "flex", alignItems: "flex-end" }}>
            <Chunky size={150} palette={GOLD}>
              {last}
            </Chunky>
            <Chunky size={186} palette={ICE} style={{ marginLeft: 30, marginBottom: -6, transform: "rotate(-5deg)" }}>
              64
            </Chunky>
          </span>
        </h1>

        {/* role */}
        <div style={{ position: "absolute", left: 76, top: 409, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 35, lineHeight: 1.15, fontWeight: 700, color: CREAM }}>{credits.role}</div>
          <div style={{ fontSize: 23, lineHeight: 1.2, fontWeight: 500, color: MUTED, marginTop: 8, wordSpacing: "0.04em" }}>
            {places.join("  ·  ")}
          </div>
        </div>

        {/* bottom bar, standing on the floor */}
        <div
          style={{
            position: "absolute",
            left: 76,
            right: 76,
            bottom: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ ...pill, fontSize: 20, color: INK, background: STAR, padding: "16px 24px 14px", letterSpacing: "0.06em" }}>
            PRESS START
          </div>
          <div style={{ ...pill, fontSize: 17, color: CREAM, background: NIGHT, padding: "17px 22px 15px", letterSpacing: "0.04em" }}>
            {host}
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * Dev-only source for the app icons — a 512 × 512 square.
 *
 *   /dev/og/icon                  "DA" under a gold star (icon-512, icon-192,
 *                                 apple-touch-icon, src/app/icon.png)
 *   /dev/og/icon?variant=favicon  "DA" only, drawn larger so it survives being
 *                                 scaled to 16–48 px (src/app/favicon.ico)
 *   &guide=1                      overlays the maskable safe zone (design aid)
 *
 * Screenshot the full viewport at exactly 512 × 512, then run
 * build-images.mjs (see the README, "Icons and the social card").
 *
 * The background is full-bleed and the mark stays inside the central 80 %
 * circle, so the same file works as a "maskable" icon and under the rounded
 * mask iOS applies to apple-touch-icon.
 */
import type { Metadata } from "next";
import { profile } from "@/content/portfolio";
import { Chunky, DUSK, GoldStar, INK, NIGHT, ScreenshotChrome, Starfield, StarGlow } from "../art";

export const metadata: Metadata = {
  title: "App icon (dev)",
  robots: { index: false, follow: false },
};

const SIZE = 512;
const CENTER = SIZE / 2;
/** Maskable-icon safe zone: a centred circle 80 % of the icon wide. */
const SAFE_RADIUS = SIZE * 0.4;

/** Keep the decorative pixel stars outside the mark. */
const outsideMark = (x: number, y: number) => Math.hypot(x - CENTER, y - CENTER) > SAFE_RADIUS + 6;

export default async function OgIconPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; guide?: string }>;
}) {
  const { variant, guide } = await searchParams;
  const favicon = variant === "favicon";
  // Daniel's initials, from the content file.
  const monogram = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();

  return (
    <>
      <ScreenshotChrome />
      <main
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          overflow: "hidden",
          background: `radial-gradient(75% 75% at 50% 38%, ${DUSK} 0%, ${NIGHT} 58%, ${INK} 100%)`,
        }}
      >
        {!favicon && (
          <Starfield width={SIZE} height={SIZE} seed={7} count={26} sizes={[6, 6, 8, 10]} keep={outsideMark} />
        )}

        {favicon ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 84, display: "flex", justifyContent: "center" }}>
            <Chunky size={284} style={{ letterSpacing: "0" }}>
              {monogram}
            </Chunky>
          </div>
        ) : (
          <>
            <StarGlow size={300} style={{ left: CENTER - 150, top: 32 }} />
            <GoldStar size={168} style={{ position: "absolute", left: CENTER - 84, top: 74 }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 186, display: "flex", justifyContent: "center" }}>
              <Chunky size={196}>{monogram}</Chunky>
            </div>
          </>
        )}

        {/* ?guide=1 draws the maskable safe zone while designing; never shot */}
        {guide && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: CENTER - SAFE_RADIUS,
              top: CENTER - SAFE_RADIUS,
              width: SAFE_RADIUS * 2,
              height: SAFE_RADIUS * 2,
              borderRadius: "50%",
              border: "2px dashed #ff3b6b",
              boxSizing: "border-box",
            }}
          />
        )}
      </main>
    </>
  );
}

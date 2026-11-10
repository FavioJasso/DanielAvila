/**
 * danielavila.tech — DANIEL AVILA 64.
 *
 * The page is two layers:
 * - <PlainPortfolio>: the complete, server-rendered, semantic portfolio. It is
 *   what search engines, résumé parsers, screen readers and visitors without
 *   JavaScript or WebGL get, and anyone can switch to it at any time.
 * - <GameRoot>: the 3D hub world (title screen, lobby, paintings, overlays)
 *   layered on top. It lazy-loads three.js after first paint and falls back to
 *   the plain page when WebGL is unavailable.
 *
 * Structured data is rendered by the root layout.
 */
import { PlainPortfolio } from "@/components/course/PlainPortfolio";
import { GameRoot, PlayButton } from "@/components/game/GameRoot";

export default function Home() {
  return (
    <>
      {/* The game title screen owns the page's <h1>. */}
      <PlainPortfolio actions={<PlayButton />} nameHeadingLevel={2} />
      <GameRoot />
    </>
  );
}

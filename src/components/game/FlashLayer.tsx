"use client";

import { useEffect, useRef, useState } from "react";
import { useUi } from "@/game/store";

/**
 * Full-screen white warp flash. The engine bumps `ui.flash`; every change
 * replays the CSS animation (quick in, slower out; a brief soft fade under
 * reduced motion — see game.css). Nothing is rendered between flashes, so
 * re-showing the stage never replays a stale one.
 */
export function FlashLayer() {
  const flash = useUi((s) => s.flash);
  const seen = useRef(flash);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (flash === seen.current) return;
    seen.current = flash;
    setActive(flash);
  }, [flash]);

  if (active === null) return null;
  return (
    <div
      key={active}
      className="da64-flash"
      aria-hidden="true"
      onAnimationEnd={() => setActive(null)}
    />
  );
}

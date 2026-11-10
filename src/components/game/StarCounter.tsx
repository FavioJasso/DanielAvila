"use client";

import { StarIcon } from "@/components/shared/StarIcon";
import { TOTAL_STARS, useUi } from "@/game/store";
import { cx } from "./util";

const PIPS = Array.from({ length: TOTAL_STARS }, (_, i) => i);

/**
 * Stars collected so far: a row of star pips plus "n/6". On very narrow
 * screens the pips collapse to a single star (see game.css).
 */
export function StarCounter({ className }: { className?: string }) {
  const count = useUi((s) => s.collected.length);
  return (
    <div
      className={cx("da64-stars", className)}
      role="img"
      aria-label={`${count} of ${TOTAL_STARS} stars collected`}
    >
      <span className="da64-stars__pips" aria-hidden="true">
        {PIPS.map((i) => (
          <StarIcon key={i} size={18} filled={i < count} />
        ))}
      </span>
      <span className="da64-stars__single" aria-hidden="true">
        <StarIcon size={18} filled={count > 0} />
      </span>
      <span className="da64-stars__count" aria-hidden="true">
        {count}/{TOTAL_STARS}
      </span>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { missions } from "@/content/portfolio";
import { StarIcon } from "@/components/shared/StarIcon";
import { MissionDetail } from "./MissionDetail";
import { useTabs } from "./useTabs";

const MISSION_IDS = missions.map((m) => m.id);
/** Below this width the mission list is stacked above the detail panel. */
const STACKED_QUERY = "(max-width: 899px)";

/**
 * "Star Missions" (overlay only): the mission select list as an accessible
 * tab pattern, with the selected mission's briefing in the panel.
 */
export function MissionTabs({ initial }: { initial?: string }) {
  const { selected, select, tabProps, panelProps } = useTabs(MISSION_IDS, initial);
  const panelRef = useRef<HTMLDivElement>(null);
  const mission = missions.find((m) => m.id === selected) ?? missions[0];

  const choose = (id: string, pointer: boolean) => {
    select(id);
    // On stacked layouts the briefing sits below the list, so bring it into
    // view after a tap or click. Keyboard activation (Enter / Space fire a
    // click with `detail === 0`) keeps the focused tab in view instead.
    if (pointer && window.matchMedia(STACKED_QUERY).matches) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({
          block: "start",
          behavior: reduced ? "auto" : "smooth",
        }),
      );
    }
  };

  return (
    <div className="cx-missions">
      <div
        className="cx-missions__list"
        role="tablist"
        aria-label="Star missions"
        aria-orientation="vertical"
      >
        {missions.map((m) => (
          <button
            key={m.id}
            {...tabProps(m.id)}
            className="cx-mission-tab"
            onClick={(event) => choose(m.id, event.detail > 0)}
          >
            <span className="cx-mission-tab__star" aria-hidden="true">
              <StarIcon size={40} filled={m.id === selected} />
              <span className="cx-mission-tab__num">{m.star}</span>
            </span>
            <span>
              <span className="cx-mission-tab__kicker">
                Star {m.star} · {m.kindLabel}
              </span>
              <span className="cx-mission-tab__title">{m.title}</span>
            </span>
          </button>
        ))}
      </div>
      <div {...panelProps} ref={panelRef} className="cx-missions__panel">
        <MissionDetail mission={mission} level={3} />
      </div>
    </div>
  );
}

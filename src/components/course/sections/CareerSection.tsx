import { missions, type Mission } from "@/content/portfolio";
import { MissionDetail } from "./MissionDetail";
import { MissionTabs } from "./MissionTabs";
import type { SectionProps } from "./types";

/**
 * Plain version: missions grouped the way a résumé reads — work first,
 * then labs, then personal projects. `anchor` keeps the previous site's
 * #projects link working.
 */
const PLAIN_GROUPS: { kind: Mission["kind"]; heading: string; anchor?: string }[] = [
  { kind: "experience", heading: "Work experience" },
  { kind: "lab", heading: "Technical labs" },
  { kind: "project", heading: "Personal projects", anchor: "projects" },
];

/**
 * Course 3 — "Star Missions". The overlay shows a mission select list with
 * one briefing at a time; the plain version renders every mission in full.
 */
export function CareerSection({
  variant = "overlay",
  initialMission,
}: SectionProps & {
  /** Mission id to preselect in the overlay. */
  initialMission?: string;
}) {
  if (variant === "overlay") return <MissionTabs initial={initialMission} />;

  return (
    <div className="cx-section cx-career-plain">
      {PLAIN_GROUPS.map((group) => {
        const list = missions.filter((m) => m.kind === group.kind);
        if (list.length === 0) return null;
        const headingId = `cx-plain-missions-${group.kind}`;
        return (
          <section
            key={group.kind}
            id={group.anchor}
            className="cx-career-plain__group"
            aria-labelledby={headingId}
          >
            <h3 className="cx-h3" id={headingId}>
              {group.heading}
            </h3>
            <div
              className={
                list.length > 1
                  ? "cx-career-plain__list cx-career-plain__list--pair"
                  : "cx-career-plain__list"
              }
            >
              {list.map((mission) => (
                <div key={mission.id} className="cx-card">
                  <MissionDetail mission={mission} level={4} showStar={false} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import { skillGroups } from "@/content/portfolio";
import type { SectionProps } from "./types";

/** Entries longer than this get a double-width inventory slot. */
const WIDE_SLOT_CHARS = 34;

/**
 * Course 2 — the skills inventory: each group is a titled panel with its
 * items laid out as inventory slots.
 */
export function SkillsSection({ variant = "overlay" }: SectionProps) {
  return (
    <div className="cx-section cx-skills">
      {skillGroups.map((group) => {
        const headingId = `cx-${variant}-skills-${group.id}`;
        return (
          <section key={group.id} className="cx-inv" aria-labelledby={headingId}>
            <header className="cx-inv__head">
              <h3 className="cx-inv__title" id={headingId}>
                {group.title}
              </h3>
              <span className="cx-inv__count">
                <span aria-hidden="true">×{group.items.length}</span>
                <span className="cx-sr">{group.items.length} items</span>
              </span>
            </header>
            <ul className="cx-inv__grid">
              {group.items.map((item) => (
                <li
                  key={item}
                  className={item.length > WIDE_SLOT_CHARS ? "cx-slot cx-slot--wide" : "cx-slot"}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

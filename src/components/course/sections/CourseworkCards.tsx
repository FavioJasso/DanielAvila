"use client";

import { education } from "@/content/portfolio";
import { ChipList } from "./bits";
import { useTabs } from "./useTabs";

const COURSE_IDS = education.coursework.map((c) => c.id);

/**
 * Selectable coursework cards (overlay only): pick a card and its blurb and
 * topics appear in the description box underneath, like an item menu.
 * Semantically a tab list, so arrow keys move between the cards.
 */
export function CourseworkCards() {
  const { selected, select, tabProps, panelProps } = useTabs(COURSE_IDS);
  const course = education.coursework.find((c) => c.id === selected) ?? education.coursework[0];

  return (
    <div className="cx-courses">
      <div className="cx-courses__tabs" role="tablist" aria-label="Coursework">
        {education.coursework.map((c) => (
          <button
            key={c.id}
            {...tabProps(c.id)}
            className="cx-course-tab"
            onClick={() => select(c.id)}
          >
            <span className="cx-course-tab__mark" aria-hidden="true" />
            {c.title}
          </button>
        ))}
      </div>
      <div
        {...panelProps}
        className="cx-card cx-courses__panel"
        data-needs-review={course.needsReview || undefined}
      >
        <h4 className="cx-title">{course.title}</h4>
        <p>{course.blurb}</p>
        <p className="cx-label">Topics</p>
        <ChipList items={course.topics} label={`${course.title} topics`} />
      </div>
    </div>
  );
}

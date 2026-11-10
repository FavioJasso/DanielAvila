import { education } from "@/content/portfolio";
import { ChipList, LogoTile, StarList } from "./bits";
import { CourseworkCards } from "./CourseworkCards";
import { Icon } from "./icons";
import type { SectionProps } from "./types";

/**
 * Course 1 — institution, degree, expected graduation, milestones and the
 * coursework cards. In the overlay the coursework is a set of selectable
 * cards with a description box; in the plain version every card is expanded.
 */
export function EducationSection({ variant = "overlay" }: SectionProps) {
  return (
    <div className="cx-section">
      <article className="cx-card cx-school">
        <LogoTile logo={education.logo} />
        <div className="cx-block">
          <h3 className="cx-school__name">{education.institution}</h3>
          <p className="cx-school__degree">{education.degree}</p>
          <ul className="cx-meta">
            <li className="cx-school__status">
              <Icon name="calendar" />
              {education.status}
            </li>
            <li>
              <Icon name="pin" />
              {education.location}
            </li>
          </ul>
        </div>
      </article>

      <section className="cx-block" aria-labelledby={`cx-${variant}-milestones`}>
        <h3 className="cx-h3" id={`cx-${variant}-milestones`}>
          Milestones
        </h3>
        <StarList items={education.milestones} />
      </section>

      <section className="cx-block" aria-labelledby={`cx-${variant}-coursework`}>
        <h3 className="cx-h3" id={`cx-${variant}-coursework`}>
          Coursework
        </h3>
        {variant === "plain" ? (
          <ul className="cx-courses__grid">
            {education.coursework.map((course) => (
              <li key={course.id}>
                <article
                  className="cx-card cx-course"
                  data-needs-review={course.needsReview || undefined}
                >
                  <h4 className="cx-title">{course.title}</h4>
                  <p>{course.blurb}</p>
                  <ChipList items={course.topics} label={`${course.title} topics`} />
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <CourseworkCards />
        )}
      </section>
    </div>
  );
}

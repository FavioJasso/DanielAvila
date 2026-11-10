import { jobs, type Job, type Mission } from "@/content/portfolio";
import { ChipList, ExternalLink, LogoTile, StarList } from "./bits";
import { Icon } from "./icons";

type HeadingLevel = 3 | 4;
const tag = (level: number) => `h${level}` as "h3" | "h4" | "h5";

/** One job inside the "Professional Experience" mission. */
function JobCard({ job, level }: { job: Job; level: number }) {
  const Heading = tag(level);
  return (
    <article className="cx-card cx-job">
      <header className="cx-job__head">
        <LogoTile logo={job.logo} />
        <div className="cx-block">
          <Heading className="cx-title">{job.role}</Heading>
          <p className="cx-job__company">{job.company}</p>
          <ul className="cx-meta">
            <li>
              <Icon name="briefcase" />
              {job.type}
            </li>
            <li>
              <Icon name="pin" />
              {job.location}
            </li>
            <li>
              <Icon name="calendar" />
              {job.period}
            </li>
          </ul>
        </div>
      </header>
      <p className="cx-job__summary">{job.summary}</p>
      <StarList items={job.bullets} />
    </article>
  );
}

/**
 * A "Star Mission" in full: objective, tools used and outcome, then the
 * bullets, spec sheet, tags and links where the mission has them, and the
 * two jobs for the experience mission.
 */
export function MissionDetail({
  mission,
  level = 3,
  showStar = true,
}: {
  mission: Mission;
  /** Heading level of the mission title; nested headings go one deeper. */
  level?: HeadingLevel;
  /**
   * Print the "Star n · kind" kicker. The plain version leaves it out: it
   * groups missions under a heading per kind instead of numbering them.
   */
  showStar?: boolean;
}) {
  const Heading = tag(level);
  const SubHeading = tag(level + 1);
  return (
    <article className="cx-mission" data-needs-review={mission.needsReview || undefined}>
      <header>
        {showStar && (
          <p className="cx-mission__kicker">
            <span>Star {mission.star}</span>
            <span aria-hidden="true">·</span>
            <span>{mission.kindLabel}</span>
          </p>
        )}
        <Heading
          className={level === 3 ? "cx-mission__title" : "cx-mission__title cx-mission__title--sm"}
        >
          {mission.title}
        </Heading>
      </header>

      <dl className="cx-brief">
        <div className="cx-brief__row">
          <dt className="cx-label">Objective</dt>
          <dd>{mission.objective}</dd>
        </div>
        <div className="cx-brief__row">
          <dt className="cx-label">Tools used</dt>
          <dd>
            <ChipList items={mission.tools} label="Tools used" />
          </dd>
        </div>
        <div className="cx-brief__row">
          <dt className="cx-label">Outcome</dt>
          <dd>{mission.outcome}</dd>
        </div>
      </dl>

      {mission.bullets && (
        <div className="cx-mission__extra">
          <SubHeading className="cx-label">What it involved</SubHeading>
          <StarList items={mission.bullets} />
        </div>
      )}

      {mission.showJobs && (
        <div className="cx-jobs">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} level={level + 1} />
          ))}
        </div>
      )}

      {mission.specs && (
        <div className="cx-mission__extra">
          <SubHeading className="cx-label">Spec sheet</SubHeading>
          <dl className="cx-specs">
            {mission.specs.map((spec) => (
              <div key={spec.label} className="cx-specs__row">
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {mission.tags && <ChipList items={mission.tags} label="Tags" tags />}

      {mission.links && (
        <p>
          {mission.links.map((link) => (
            <ExternalLink key={link.href} href={link.href} className="cx-linkbtn">
              {link.label}
              <Icon name="external" />
            </ExternalLink>
          ))}
        </p>
      )}
    </article>
  );
}

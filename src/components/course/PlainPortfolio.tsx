/**
 * The plain HTML version: a conventional, semantic one-page portfolio with
 * every section fully expanded. It is what search engines, résumé parsers,
 * screen readers and visitors without JavaScript or WebGL get, and it is
 * built from the same section components as the course overlays.
 *
 * Server-renderable: no "use client" here; the only client children are
 * the contact form and (in the overlays) the tab widgets.
 */
import Image from "next/image";
import type { ReactNode } from "react";
import { credits, profile, sections, type SectionMeta } from "@/content/portfolio";
import type { SectionId } from "@/game/contract";
import { AboutProfile, ContactBlock } from "./sections/AboutSection";
import { CareerSection } from "./sections/CareerSection";
import { CertificationsSection } from "./sections/CertificationsSection";
import { EducationSection } from "./sections/EducationSection";
import { Icon } from "./sections/icons";
import { RESUME_HREF } from "./sections/ResumeStarButton";
import { SkillsSection } from "./sections/SkillsSection";
import "./course.css";
import "./plain.css";

/**
 * Heading level of Daniel's name in the hero. It is the page's only <h1>;
 * if the composed page ends up with another <h1> (the game title screen),
 * change this constant — or pass `nameHeadingLevel` — and nothing else.
 */
const NAME_HEADING_LEVEL: 1 | 2 = 1;

export interface PlainPortfolioProps {
  /** Extra controls for the header, e.g. the "Play the 3D version" button. */
  actions?: ReactNode;
  /** Overrides NAME_HEADING_LEVEL for this render. */
  nameHeadingLevel?: 1 | 2;
}

const meta = (id: SectionId): SectionMeta => {
  const found = sections.find((s) => s.id === id);
  if (!found) throw new Error(`Missing section meta for "${id}"`);
  return found;
};
const EDUCATION = meta("education");
const SKILLS = meta("skills");
const CAREER = meta("career");
const CERTIFICATIONS = meta("certifications");
const ABOUT = meta("about");

/**
 * Anchor nav. The ids match the previous site (#about, #experience,
 * #projects, #certification, #contact) plus #education and #skills.
 */
const NAV: { href: string; label: string }[] = [
  { href: "#about", label: "About" },
  { href: `#${EDUCATION.anchor}`, label: EDUCATION.navLabel },
  { href: `#${SKILLS.anchor}`, label: SKILLS.navLabel },
  { href: `#${CAREER.anchor}`, label: "Experience" },
  { href: "#projects", label: "Projects" },
  { href: `#${CERTIFICATIONS.anchor}`, label: CERTIFICATIONS.navLabel },
  { href: `#${ABOUT.anchor}`, label: "Contact" },
];

/** A page section with its eyebrow, <h2> and intro line. */
function Section({
  id,
  eyebrow,
  title,
  intro,
  tint = false,
  className,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  tint?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `pp-${id}-heading`;
  const classes = ["pp-section", tint ? "pp-section--tint" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <section id={id} className={classes} aria-labelledby={headingId}>
      <div className="pp-wrap">
        <header className="pp-section__head">
          <p className="pp-eyebrow">{eyebrow}</p>
          <h2 className="pp-h2" id={headingId}>
            {title}
          </h2>
          {intro && <p className="pp-section__intro">{intro}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

export function PlainPortfolio({
  actions,
  nameHeadingLevel = NAME_HEADING_LEVEL,
}: PlainPortfolioProps) {
  const NameHeading = nameHeadingLevel === 1 ? "h1" : "h2";

  return (
    <div className="cx cx--light pp">
      <a className="pp-skip" href="#plain-portfolio">
        Skip to main content
      </a>

      <header className="pp-header">
        <div className="pp-wrap pp-header__bar">
          <a className="pp-brand" href="#home">
            <Image src={credits.brandMark.src} alt="" width={40} height={40} />
            <span className="pp-brand__name">{profile.name}</span>
          </a>
          <nav className="pp-nav" aria-label="Sections">
            <ul className="pp-nav__list">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a className="pp-nav__link" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {actions && <div className="pp-actions">{actions}</div>}
        </div>
      </header>

      <main id="plain-portfolio" className="pp-main" tabIndex={-1}>
        <section id="home" className="pp-hero" aria-labelledby="pp-name">
          <div className="pp-wrap pp-hero__grid">
            <div>
              <p className="cx-pill cx-pill--open">{profile.availability}</p>
              <NameHeading className="pp-hero__name" id="pp-name">
                {profile.name}
              </NameHeading>
              <p className="pp-hero__title">{profile.title}</p>
              <p className="pp-hero__summary">{profile.summary}</p>
              <p className="pp-hero__cta">
                <a className="btn-retro" href={`#${ABOUT.anchor}`}>
                  Get in touch
                </a>
                <a
                  className="btn-retro btn-retro--gold"
                  href={RESUME_HREF}
                  download={profile.resumeFileName}
                >
                  <Icon name="download" />
                  Download résumé (PDF)
                </a>
              </p>
              <ul className="cx-meta pp-hero__meta">
                <li>
                  <Icon name="pin" />
                  {profile.location}
                </li>
              </ul>
            </div>
            <div className="pp-hero__photo">
              <Image
                src={profile.photo.src}
                alt={profile.photo.alt}
                width={profile.photo.width}
                height={profile.photo.height}
                sizes="(min-width: 820px) 336px, 80vw"
                priority
              />
            </div>
          </div>
        </section>

        <Section id="about" eyebrow={ABOUT.heading} title="About" intro={ABOUT.intro}>
          <AboutProfile variant="plain" identity={false} />
        </Section>

        <Section
          id={EDUCATION.anchor}
          eyebrow={EDUCATION.heading}
          title={EDUCATION.navLabel}
          intro={EDUCATION.intro}
          tint
        >
          <EducationSection variant="plain" />
        </Section>

        <Section
          id={SKILLS.anchor}
          eyebrow={SKILLS.heading}
          title={SKILLS.navLabel}
          intro={SKILLS.intro}
        >
          <SkillsSection variant="plain" />
        </Section>

        <Section
          id={CAREER.anchor}
          eyebrow={CAREER.navLabel}
          title={CAREER.heading}
          intro={CAREER.intro}
          tint
        >
          <CareerSection variant="plain" />
        </Section>

        <Section
          id={CERTIFICATIONS.anchor}
          eyebrow={CERTIFICATIONS.heading}
          title={CERTIFICATIONS.navLabel}
          intro={CERTIFICATIONS.intro}
        >
          <CertificationsSection variant="plain" />
        </Section>

        <Section
          id={ABOUT.anchor}
          eyebrow={ABOUT.navLabel}
          title="Contact"
          className="cx--dark pp-contact"
        >
          <ContactBlock variant="plain" />
        </Section>
      </main>

      <footer className="pp-footer">
        <div className="pp-wrap pp-footer__grid">
          <p className="pp-footer__tagline">“{profile.tagline}”</p>
          <div className="pp-footer__about">
            <p className="pp-footer__brand">
              <Image src={credits.brandMark.src} alt="" width={36} height={36} />
              {profile.name}
            </p>
            <p className="pp-footer__small">{credits.role}</p>
            <p className="pp-footer__small">{credits.copyright}</p>
          </div>
          <p className="pp-footer__credit">
            <span>{credits.builtByPrefix}</span>
            <a href={credits.builtBy.href} target="_blank" rel="noopener noreferrer">
              <Image
                src={credits.builtBy.logo}
                alt={`${credits.builtBy.label} (opens in a new tab)`}
                width={206}
                height={117}
              />
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

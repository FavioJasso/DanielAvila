import Image from "next/image";
import { profile } from "@/content/portfolio";
import { ContactForm } from "./ContactForm";
import { ContactLinks } from "./ContactLinks";
import { Credits } from "./Credits";
import { Icon } from "./icons";
import { ResumeStarButton } from "./ResumeStarButton";
import type { SectionProps } from "./types";

/**
 * Bio, the three highlights and career focus. With `identity` it also shows
 * the photo card (photo, name, title, tagline, availability, location) and
 * opens the bio with the one-line summary — the plain page leaves those out
 * because its hero and footer already carry them.
 */
export function AboutProfile({
  variant = "overlay",
  identity = true,
}: SectionProps & { identity?: boolean }) {
  return (
    <div className="cx-section">
      <div className={identity ? "cx-profile cx-profile--with-id" : "cx-profile"}>
        {identity && (
          <div className="cx-card cx-idcard">
            <div className="cx-photo">
              <Image
                src={profile.photo.src}
                alt={profile.photo.alt}
                width={profile.photo.width}
                height={profile.photo.height}
                sizes="(min-width: 760px) 240px, 208px"
              />
            </div>
            <h3 className="cx-idcard__name">{profile.name}</h3>
            <p className="cx-idcard__role">{profile.title}</p>
            <p className="cx-idcard__tagline">“{profile.tagline}”</p>
            <p className="cx-pill cx-pill--open">{profile.availability}</p>
            <ul className="cx-meta">
              <li>
                <Icon name="pin" />
                {profile.location}
              </li>
            </ul>
          </div>
        )}
        <div className="cx-profile__main">
          <div className="cx-bio">
            {identity && <p className="cx-bio__lead">{profile.summary}</p>}
            {profile.bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <section className="cx-card cx-focus" aria-labelledby={`cx-${variant}-focus`}>
            <h3 className="cx-h3" id={`cx-${variant}-focus`}>
              Career focus
            </h3>
            <p>{profile.careerFocus}</p>
          </section>
        </div>
      </div>

      <ul className="cx-highlights" aria-label="Highlights">
        {profile.highlights.map((highlight) => (
          <li key={highlight.title}>
            <article className="cx-card cx-highlight">
              <h3 className="cx-title">{highlight.title}</h3>
              <p>{highlight.text}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Contact details (email, phone, LinkedIn, GitHub, location), the résumé
 * star and the contact form.
 */
export function ContactBlock({ variant = "overlay" }: SectionProps) {
  return (
    <div className="cx-contact">
      <div className="cx-contact__side">
        <section aria-labelledby={`cx-${variant}-reach`}>
          <h3 className="cx-h3" id={`cx-${variant}-reach`}>
            Get in touch
          </h3>
          <ContactLinks showLocation />
        </section>
        <ResumeStarButton />
      </div>
      <section className="cx-contact__message" aria-labelledby={`cx-${variant}-message`}>
        <h3 className="cx-h3" id={`cx-${variant}-message`}>
          Send a message
        </h3>
        <div className="cx-form-wrap">
          <p className="cx-form__prompt">{profile.contactPrompt}</p>
          <ContactForm variant={variant} />
        </div>
      </section>
    </div>
  );
}

/** Course 5 — About & Contact in one piece, ending with the credits (the overlay). */
export function AboutSection({ variant = "overlay" }: SectionProps) {
  return (
    <div className="cx-section">
      <AboutProfile variant={variant} />
      <ContactBlock variant={variant} />
      <Credits />
    </div>
  );
}

import { certifications } from "@/content/portfolio";
import { ChipList, ExternalLink, LogoTile } from "./bits";
import { Icon } from "./icons";
import { SpinningStar } from "./SpinningStar";
import type { SectionProps } from "./types";

/**
 * Course 4 — each certification as a card with a spinning gold star
 * (completed) or a slower outlined badge (in progress). A verification
 * link is rendered only when the content provides a real `verifyUrl`.
 */
export function CertificationsSection({ variant = "overlay" }: SectionProps) {
  return (
    <ul className="cx-certs" data-variant={variant}>
      {certifications.map((cert) => {
        const done = cert.status === "completed";
        return (
          <li key={cert.id}>
            <article className={`cx-card cx-cert cx-cert--${cert.status}`}>
              <SpinningStar tone={done ? "gold" : "outline"} size={72} />
              <div className="cx-cert__head">
                <p className="cx-pills">
                  <span className={done ? "cx-pill cx-pill--done" : "cx-pill cx-pill--wip"}>
                    {cert.statusLabel}
                  </span>
                  {cert.verified && (
                    <span className="cx-pill cx-pill--verified">
                      <Icon name="check" />
                      Verified
                    </span>
                  )}
                </p>
                <h3 className="cx-title">{cert.name}</h3>
                <dl className="cx-cert__facts">
                  <div className={cert.logo ? "cx-cert__fact cx-cert__fact--logo" : "cx-cert__fact"}>
                    {cert.logo && <LogoTile logo={cert.logo} />}
                    <dt>Issuer</dt>
                    <dd>{cert.issuer}</dd>
                  </div>
                  {cert.date && (
                    <div className="cx-cert__fact">
                      <dt>Date</dt>
                      <dd>{cert.date}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="cx-cert__details">
                <p className="cx-cert__text">{cert.description}</p>
                <p className="cx-label">Competencies</p>
                <ChipList items={cert.competencies} label={`${cert.name} competencies`} />
                {cert.verifyUrl && (
                  <p>
                    <ExternalLink href={cert.verifyUrl} className="cx-linkbtn">
                      Verify this credential
                      <Icon name="external" />
                    </ExternalLink>
                  </p>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

import { profile } from "@/content/portfolio";
import { RESUME_STAR } from "@/game/contract";
import { ContactLinks } from "./ContactLinks";
import { Icon } from "./icons";
import { RESUME_HREF } from "./ResumeStarButton";
import { SpinningStar } from "./SpinningStar";

/**
 * The compact card behind the centre pedestal star: a celebratory heading,
 * the PDF résumé as the primary action, then the contact links.
 */
export function ResumeStarCard() {
  return (
    <div className="cx-resume-card">
      <SpinningStar size={88} />
      <h3 className="cx-resume-card__title text-chunky">Résumé unlocked!</h3>
      <p className="cx-resume-card__sub">{RESUME_STAR.subtitle}</p>
      <a
        className="btn-retro btn-retro--gold cx-resume-card__cta"
        href={RESUME_HREF}
        download={profile.resumeFileName}
      >
        <Icon name="download" />
        Download résumé (PDF)
      </a>
      <ContactLinks />
    </div>
  );
}

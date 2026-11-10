import { profile } from "@/content/portfolio";
import { StarIcon } from "@/components/shared/StarIcon";

/** The PDF lives in /public under a name with spaces, so encode the path. */
export const RESUME_HREF = encodeURI(profile.links.resume);

/**
 * The collectible star: a big gold push button that downloads the official
 * PDF résumé. A real `<a href download>`, so it works without JavaScript.
 */
export function ResumeStarButton() {
  return (
    <a className="cx-resume-star" href={RESUME_HREF} download={profile.resumeFileName}>
      <span className="cx-resume-star__star" aria-hidden="true">
        <StarIcon size={44} />
      </span>
      <span>
        <span className="cx-resume-star__title">Collect the résumé star</span>
        <span className="cx-resume-star__note">Download the official PDF résumé</span>
      </span>
    </a>
  );
}

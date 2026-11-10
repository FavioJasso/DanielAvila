import { profile } from "@/content/portfolio";
import { ExternalLink } from "./bits";
import { Icon, type IconName } from "./icons";

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x" for display. */
const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function LinkBody({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <>
      <span className="cx-link__icon">
        <Icon name={icon} />
      </span>
      <span>
        <span className="cx-link__label">{label}</span>
        <span className="cx-link__value">{value}</span>
      </span>
    </>
  );
}

/**
 * Direct contact links: email (mailto), phone (tel), LinkedIn and GitHub,
 * optionally followed by the location as a plain row.
 */
export function ContactLinks({ showLocation = false }: { showLocation?: boolean }) {
  return (
    <ul className="cx-links">
      <li>
        <a className="cx-link" href={`mailto:${profile.email}`}>
          <LinkBody icon="mail" label="Email" value={profile.email} />
        </a>
      </li>
      <li>
        <a className="cx-link" href={profile.phoneHref}>
          <LinkBody icon="phone" label="Phone" value={profile.phone} />
        </a>
      </li>
      <li>
        <ExternalLink className="cx-link" href={profile.links.linkedin}>
          <LinkBody icon="profile" label="LinkedIn" value={displayUrl(profile.links.linkedin)} />
        </ExternalLink>
      </li>
      <li>
        <ExternalLink className="cx-link" href={profile.links.github}>
          <LinkBody icon="code" label="GitHub" value={displayUrl(profile.links.github)} />
        </ExternalLink>
      </li>
      {showLocation && (
        <li className="cx-link">
          <LinkBody icon="pin" label="Location" value={profile.location} />
        </li>
      )}
    </ul>
  );
}

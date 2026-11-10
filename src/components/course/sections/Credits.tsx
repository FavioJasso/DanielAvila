import Image from "next/image";
import { credits } from "@/content/portfolio";

/**
 * Small print at the end of the About & Contact overlay: copyright, role
 * and the site-builder credit. (The plain page has its own footer.)
 */
export function Credits() {
  return (
    <footer className="cx-credits">
      <div className="cx-credits__who">
        <Image src={credits.brandMark.src} alt="" width={32} height={32} />
        <p>
          {credits.copyright}
          <br />
          {credits.role}
        </p>
      </div>
      <p className="cx-credits__by">
        <span>{credits.builtByPrefix}</span>
        <a
          className="cx-credits__logo"
          href={credits.builtBy.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={credits.builtBy.logo}
            alt={`${credits.builtBy.label} (opens in a new tab)`}
            width={206}
            height={117}
          />
        </a>
      </p>
    </footer>
  );
}

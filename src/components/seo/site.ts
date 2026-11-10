/**
 * Search / social copy shared by the root layout's metadata and the JSON-LD
 * component. Everything is derived from the content file, so a change to
 * Daniel's role, employer or school flows through to the page head.
 *
 * Not derived (static files, update by hand): public/manifest.json,
 * public/sitemap.xml, public/robots.txt and the generated images.
 */
import { credits, education, jobs, profile, SITE_URL } from "@/content/portfolio";

/** `og:site_name` and the WebSite name search engines may show. */
export const SITE_NAME = `${profile.name} Portfolio`;
/** The hub world's title, used as the installed-app name. */
export const GAME_NAME = `${profile.name} 64`;

/** Browser chrome colour — the deep navy `--ink` token from globals.css. */
export const THEME_COLOR = "#0a0f2c";

/** "Daniel Avila - Desktop Support Technician | IT Professional" */
export const siteTitle = `${profile.name} - ${credits.role}`;

const [currentJob] = jobs;

/** Kept near 160 characters so search results show it whole. */
export const siteDescription =
  `${profile.title} at ${currentJob.company} and Cyber Security student on the IT Help Desk at ` +
  `${education.institution}. Hardware, troubleshooting and IT support.`;

/** Link previews have room for one more sentence about the site itself. */
export const socialDescription = `${siteDescription} Explore the portfolio as a playable 3D hub world.`;

/**
 * The keywords meta tag is one comma-separated list, so a value that contains
 * a comma would be read as two keywords ("STORIS, Inc." → "STORIS" + "Inc.").
 * Keep the part before the first comma: "STORIS", "New Jersey".
 */
const keyword = (value: string): string => value.split(",")[0].trim();

export const siteKeywords: string[] = [
  profile.name,
  profile.title,
  "Desktop Support",
  "IT Help Desk",
  "IT Support",
  "Technical Support",
  "Hardware Troubleshooting",
  "Computer Diagnostics",
  "Software Installation",
  "IT Asset Management",
  "Cyber Security Student",
  ...new Set(jobs.map((job) => keyword(job.company))),
  keyword(profile.location),
];

/** The 1200 × 630 social card; regenerate it from /dev/og/card. */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${GAME_NAME} - ${credits.role}`,
} as const;

/** Site-relative path → absolute URL on the production domain. */
export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).toString();

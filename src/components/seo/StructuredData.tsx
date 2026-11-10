/**
 * JSON-LD for search engines: a schema.org WebSite, a Person and the
 * ProfilePage that ties them together. A server component (no client JS) —
 * every value is read from the content file, nothing is typed in here.
 */
import {
  type Certification,
  certifications,
  education,
  jobs,
  profile,
  SITE_URL,
  skillGroups,
} from "@/content/portfolio";
import { absoluteUrl, GAME_NAME, SITE_NAME, siteDescription } from "./site";

type JsonLd = Record<string, unknown>;

const WEBSITE_ID = `${SITE_URL}/#website`;
const PERSON_ID = `${SITE_URL}/#person`;
const PAGE_ID = `${SITE_URL}/#profile`;

/** schema.org prefers ISO 3166-1 alpha-2 country codes. */
const countryCode = (country: string): string => (/^(usa|u\.s\.a?\.?|united states)/i.test(country) ? "US" : country);

/** `profile.location` is "Region, Country". */
const [homeRegion, homeCountry] = profile.location.split(",").map((part) => part.trim());

/** Job and school locations are "City, State", in the same country as Daniel. */
function postalAddress(cityAndState: string): JsonLd {
  const [addressLocality, addressRegion] = cityAndState.split(",").map((part) => part.trim());
  return {
    "@type": "PostalAddress",
    addressLocality,
    addressRegion,
    addressCountry: countryCode(homeCountry),
  };
}

/**
 * One completed entry from the content file as a schema.org credential.
 *
 * The markup must not claim more than the page shows. Entries flagged
 * `verified` are certifications Daniel holds. The other completed entry is a
 * finished *course* (its label is "Course completed"), so that label stays in
 * its name and it is not categorised as a certification.
 *
 * The award date is left out on purpose: schema.org gives
 * EducationalOccupationalCredential no property for it (`validFrom` is
 * defined for other types, such as Offer and Permit). The date stays in the
 * page text.
 */
function credential(cert: Certification): JsonLd {
  const held = cert.verified === true;
  return {
    "@type": "EducationalOccupationalCredential",
    name: held ? cert.name : `${cert.name} (${cert.statusLabel.toLowerCase()})`,
    description: cert.description,
    ...(held ? { credentialCategory: "certification" } : {}),
    recognizedBy: { "@type": "Organization", name: cert.issuer },
    ...(cert.verifyUrl ? { url: cert.verifyUrl } : {}),
  };
}

export function buildStructuredData(): JsonLd {
  const languages = skillGroups.find((group) => group.id === "languages")?.items ?? [];
  const knowsAbout = skillGroups.filter((group) => group.id !== "languages").flatMap((group) => group.items);

  const website: JsonLd = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: GAME_NAME,
    description: siteDescription,
    inLanguage: "en-US",
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
  };

  const person: JsonLd = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: profile.name,
    givenName: profile.firstName,
    familyName: profile.lastName,
    jobTitle: profile.title,
    description: profile.summary,
    url: SITE_URL,
    image: {
      "@type": "ImageObject",
      url: absoluteUrl(profile.photo.src),
      width: profile.photo.width,
      height: profile.photo.height,
      caption: profile.photo.alt,
    },
    email: profile.email,
    telephone: profile.phoneHref.replace(/^tel:/, ""),
    address: {
      "@type": "PostalAddress",
      addressRegion: homeRegion,
      addressCountry: countryCode(homeCountry),
    },
    worksFor: jobs.map((job) => ({
      "@type": "Organization",
      name: job.company,
      address: postalAddress(job.location),
    })),
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: education.institution,
      address: postalAddress(education.location),
    },
    // Completed entries only — in-progress study is not a credential yet.
    hasCredential: certifications.filter((cert) => cert.status === "completed").map(credential),
    knowsAbout,
    ...(languages.length > 0 ? { knowsLanguage: languages } : {}),
    sameAs: [profile.links.linkedin, profile.links.github],
  };

  const profilePage: JsonLd = {
    "@type": "ProfilePage",
    "@id": PAGE_ID,
    url: SITE_URL,
    name: `${profile.name} - ${profile.title}`,
    inLanguage: "en-US",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
    mainEntity: { "@id": PERSON_ID },
  };

  return { "@context": "https://schema.org", "@graph": [website, person, profilePage] };
}

export function StructuredData() {
  // Escape "<" so no string in the content can close the script element.
  const json = JSON.stringify(buildStructuredData()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

# Deployment - Daniel Avila 64

## How this site is deployed

The site is hosted on **Vercel**, and the existing Vercel project is connected to
this GitHub repository (`FavioJasso/DanielAvila`).

- **Pushing to `main` publishes to production** at
  [https://www.danielavila.tech/](https://www.danielavila.tech/). There is no
  separate deploy step and no CLI command to run.
- By default Vercel's Git integration also builds a preview deployment, with its own
  URL, for other branches and pull requests. Use that to look at a change before
  merging.
- With Vercel's default Next.js settings the build runs the `build` script from
  `package.json` (`next build --turbopack`).
- The code reads no environment variables, so none need to be set in Vercel. The
  EmailJS identifiers the contact form uses are public by design and live in
  `src/content/portfolio.ts`.
- `@vercel/analytics` is included in the root layout. It only records data when Web
  Analytics is enabled for the project in the Vercel dashboard.

So a release is: merge to `main`, wait for the Vercel build, check the live site.

## Before merging to `main`

1. **Type-check and build locally.**

   ```bash
   npx tsc --noEmit -p .
   npm run build
   npm start        # then open http://localhost:3000
   ```

2. **Play it through** on a desktop browser and on a phone:
   title screen -> PRESS START -> walk or cycle to each door -> jump into the
   painting -> read the overlay -> jump back out; the résumé star; the pause menu
   (Esc) and its section links and PDF download; the sound toggle; the contact form;
   the plain HTML version.

3. **Check the fallbacks.** The plain HTML version must contain every section, and the
   page must still be useful with JavaScript disabled.

4. **Review the content.** Everything on the site comes from
   `src/content/portfolio.ts`. Entries marked `needsReview: true` were drafted from
   the design document and should be confirmed by Daniel before launch.

5. **Update the static SEO files if anything they repeat has changed.**

   | File | What to update |
   | --- | --- |
   | `public/sitemap.xml` | `lastmod` dates; the anchor list if a section id changes |
   | `public/manifest.json` | Name, description, colours, icon list |
   | `public/robots.txt` | The sitemap URL, if the domain changes |
   | `public/og-image.png`, icons, `src/app/favicon.ico` | Regenerate if Daniel's name or role changes (README, "Icons and the social card") |

   The page `<head>` (title, description, canonical, Open Graph, Twitter card) and the
   JSON-LD are generated from the content file and need no manual edit.

6. **Confirm `/dev` is private.** The harness pages under `/dev` return 404 in a
   production build; `npm run build && npm start` and open `/dev/whitebox` to check.

## After a deployment

- Open the live page source and confirm the `<title>`, description, canonical link
  and `og:` / `twitter:` tags are present, and that these load:
  `/og-image.png`, `/favicon.ico`, `/icon.png`, `/icon-192.png`, `/icon-512.png`,
  `/apple-touch-icon.png`, `/manifest.json`, `/sitemap.xml`, `/robots.txt`.
- Structured data: [Rich Results Test](https://search.google.com/test/rich-results) and
  the [Schema Markup Validator](https://validator.schema.org/).
- Link previews: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  and [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). Both cache
  the old card until asked to re-scrape.
- Google Search Console: resubmit `https://www.danielavila.tech/sitemap.xml`.
  No Search Console verification code is configured in the code. If the property is
  to be verified by meta tag, add the real code as `verification.google` in the
  `metadata` export of `src/app/layout.tsx`.

## Rolling back

Either revert the commit on `main` and push (Vercel deploys the revert), or promote
an earlier deployment to production from the project's Deployments list in the
Vercel dashboard.

## Domain

`https://www.danielavila.tech` is the canonical address. It is defined once in code,
as `SITE_URL` in `src/content/portfolio.ts`, and repeated in `public/sitemap.xml` and
`public/robots.txt`. If the domain ever changes, update those three places; the
domain itself is managed in the Vercel project's Domains settings.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Every route fails to compile, the error names `src/app/favicon.ico` | The `.ico` contains PNG frames without an alpha channel. Rebuild it with `src/app/dev/og/build-images.mjs`, which writes RGBA frames |
| An icon or the social card returns 404 | The file is missing from `public/`, or its name does not match `src/app/layout.tsx` / `public/manifest.json` exactly (names are case-sensitive) |
| A link preview shows the old image | The network cached it. Re-scrape with the debuggers above |
| The 3D view does not start | The visitor's browser could not create a WebGL context. The site switches to the plain HTML version; that is the intended fallback |
| The build fails on Vercel but not locally | Run `npm run build` locally on a clean checkout (`rm -rf .next`) and read the first error |

## Credits

Built and maintained by **Camino Code** ([caminocode.com](https://www.caminocode.com/)),
Applied AI Systems, Data Science and Product Engineering organization based in New Jersey.

- **Founder & CEO / Chief of Product:** Favio Jasso
- **Software Engineer:** John Rey Calesa

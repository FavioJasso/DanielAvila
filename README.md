# Daniel Avila 64

The portfolio of Daniel Avila, Desktop Support Technician and IT professional in
New Jersey, at [danielavila.tech](https://www.danielavila.tech/), built as a
1996-style low-poly 3D hub world that runs in the browser.

Visitors press start on a title screen, walk (or are guided) around an octagonal
castle foyer with five doors, and jump into the painting behind each door. Every
painting opens an ordinary HTML page section with Daniel's real content:
education, skills, career and labs, certifications, and about / contact. The
same content is always available as a plain HTML page.

**Developed by Camino Code**
Applied AI Systems, Data Science and Product Engineering organization based in New Jersey.
*Build Systems That Think With You.*

- **Founder & CEO / Chief of Product:** Favio Jasso
- **Software Engineer:** John Rey Calesa

---

## How the site works

| Step | What happens |
| --- | --- |
| Title screen | "DANIEL AVILA 64" logo over a slow camera orbit of the lobby, a PRESS START prompt, a sound toggle and a link to the plain HTML version |
| Lobby | The camera swoops in behind the low-poly avatar. Five labelled doors, and a résumé star on a pedestal in the centre |
| Door | Walking up to a door, or picking it, swings it open and shows the painting in its alcove |
| Painting | Jumping into the painting ripples the canvas, flashes the screen and opens that section as an HTML overlay |
| Back out | `JUMP OUT OF PAINTING (ESC)` closes the overlay and the avatar backflips out onto the lobby floor |

| Door | Painting | Section |
| --- | --- | --- |
| Education | The Royal Archive | Degree, institution, milestones, coursework |
| Skills | Deep Rack Caverns | Skill groups |
| Career & Labs | Clockwork Network | Work experience, labs and projects as "Star Missions" |
| Certifications | Skyward Star Tower | Completed and in-progress certifications |
| About & Contact | Sunset Courtyard | Bio, career focus, links, résumé PDF, contact form |

The centre pedestal's star opens a compact card with the PDF résumé and contact links.

All control schemes are active at once:

| Scheme | Input |
| --- | --- |
| Guided | `< PREV DOOR` / `NEXT DOOR >` buttons, mouse wheel |
| Point and click | Click or tap a door, sign, painting or the star |
| Free roam | WASD or arrow keys, Space to jump; on-screen thumbstick and jump button on touch devices |
| Pause menu | Esc or the `+ PAUSE / MENU` button: direct links to every section and the PDF résumé |

The full behaviour spec is in [`docs/hub-world/ARCHITECTURE.md`](docs/hub-world/ARCHITECTURE.md);
the original design document is [`docs/hub-world/blueprint.txt`](docs/hub-world/blueprint.txt).

## Tech stack

- **Next.js 15** (App Router, Turbopack), **React 19**, **TypeScript** (strict), **Tailwind CSS 4**
- **three.js**, used directly and imperatively. No React Three Fiber, no physics engine
- Every 3D asset is generated in code: geometry from primitives, textures drawn on 64 x 64
  canvases with nearest-neighbour filtering. No model or texture downloads
- Sound is synthesised with the Web Audio API. No audio files
- React renders only the HTML layer (title screen, HUD, pause menu, overlays, plain version).
  It talks to the engine through a small store (`src/game/store.ts`) and the `GameApi` interface
- The three.js engine chunk is lazy-loaded after the title screen paints
- Fonts (Titan One, Press Start 2P, Outfit) are self-hosted by `next/font`
- Contact form: EmailJS. Analytics: `@vercel/analytics`

## Run it

```bash
npm install          # once
npm run dev          # http://localhost:3000 (Turbopack, hot reload)
npx tsc --noEmit -p .  # type-check
npm run build        # production build
npm start            # serve the production build
```

## Project structure

```
src/
  app/
    layout.tsx        Document shell: fonts, metadata, viewport, JSON-LD
    page.tsx          The home page
    globals.css       Design tokens and shared UI primitives
    favicon.ico       Generated (see "Icons and the social card")
    icon.png          Generated
    dev/              Development-only harness pages (404 in production)
  content/
    portfolio.ts      All of Daniel's content. The single source of truth
  game/
    contract.ts       Shared types: World, Avatar, AudioEngine, GameApi, DOORS
    layout.ts         Room size, door frames, stand / enter / exit points, colliders
    store.ts          UI state shared by the engine and React
    modules.ts        Registry of the 3D modules (imports three.js)
    services.ts       Registry of UI-safe services (never imports three.js)
    engine/           Game loop, input, camera, flow        -> createGame
    world/            The lobby, doors, alcoves, paintings   -> createWorld
    avatar/           The procedural low-poly avatar         -> createAvatar
    art/              Procedural pixel-art paintings, "DA" emblem
    audio/            Synthesised music and sound effects    -> createAudio
    stubs/            Placeholder implementations the registries can point at
  components/
    game/             Title screen, HUD, pause menu, touch controls -> GameRoot
    course/           Course overlays and the plain HTML version   -> CourseOverlay, PlainPortfolio
    shared/           StarIcon, PaintingThumb
    seo/              Search / social copy and JSON-LD
public/               Résumé PDF, photo, logos, icons, og-image.png, manifest, sitemap, robots
docs/hub-world/       ARCHITECTURE.md (build guide), blueprint.txt (design document)
```

Modules import each other only through the two registries (`@/game/modules`,
`@/game/services`), never from another module's folder.

## Content: one file drives everything

`src/content/portfolio.ts` holds every fact shown on the site: profile, education,
skills, jobs, missions, certifications, links and the contact-form settings. The
course overlays, the plain HTML version, the pause menu, the page metadata and the
JSON-LD all read from it. To change what the site says, edit that file.

- Entries marked `needsReview: true` were drafted from the design document's wording
  and should be confirmed or rewritten by Daniel.
- Do not add employers, dates, grades or links anywhere else.
- Three static files repeat a little of this and are edited by hand:
  `public/manifest.json`, `public/sitemap.xml` (`lastmod`) and `public/robots.txt`.
- The social card and icons contain Daniel's name and role as pixels. Regenerate them
  after changing either (below).

## Dev harness pages

Everything under `/dev` is for development and returns 404 in a production build
(`src/app/dev/layout.tsx`). Each module keeps its own harness in
`src/app/dev/<module>/` (`engine`, `world`, `avatar`, `art`, `audio`, `ui`, `overlays`,
`plain`), plus:

| Page | Purpose |
| --- | --- |
| `/dev/whitebox` | The active world and avatar from a fixed camera. `?view=top`, `lobby` or `door0`..`door4`; `?open=1` opens every door |
| `/dev/og/card` | Source of `public/og-image.png` (1200 x 630) |
| `/dev/og/icon` | Source of the app icons (512 x 512). `?variant=favicon` is the simplified mark for the favicon; `?guide=1` draws the maskable safe zone |

In development the engine exposes `window.__da64` (`api`, `state()`, `teleport(x, z, yaw)`)
for scripted checks.

## Plain HTML version

The section components that fill the course overlays also render a normal,
server-rendered, semantic page with all of the content. It is what search engines,
résumé parsers, screen readers and visitors without JavaScript or WebGL get. Visitors
can switch to it from the title screen or the pause menu, and the game falls back to it
if a WebGL context cannot be created.

Its section anchors are `#about`, `#education`, `#skills`, `#experience`, `#projects`,
`#certification` and `#contact`. Five of them (`#about`, `#experience`, `#projects`,
`#certification`, `#contact`) are the previous site's section anchors, so old links to
those sections still land in the right place.

## Accessibility notes

These are requirements from the build guide; check them again after any UI change.

- All portfolio text is real HTML: selectable, high contrast (WCAG AA) and readable on a phone.
- Every control is a real `<button>` or `<a>` with a visible focus ring. Touch targets are at least 44 px.
- Keyboard: Enter or Space starts, WASD / arrows and Space move, Esc pauses or leaves a painting, M mutes.
- The pause menu reaches every section and the PDF résumé directly, without walking anywhere.
- `prefers-reduced-motion` is honoured: camera cuts instead of swoops, no shake, and anchor
  links jump instead of scrolling smoothly (`motion-safe:scroll-smooth` on `<html>`).
- Nothing plays until the visitor starts the game. The mute toggle is always visible and remembered.
- The plain HTML version is linked from the title screen and the pause menu.

## Search and social metadata

| File | Role |
| --- | --- |
| `src/components/seo/site.ts` | Title, descriptions and keywords, built from the content file |
| `src/app/layout.tsx` | `metadata` (canonical, Open Graph, Twitter card, icons, manifest) and `viewport` (theme colour) |
| `src/components/seo/StructuredData.tsx` | JSON-LD: a schema.org `WebSite`, `Person` and `ProfilePage`. `hasCredential` lists completed entries only; in-progress study is left out, and a completed course is named as a course, not as a certification |
| `public/manifest.json`, `sitemap.xml`, `robots.txt` | Static |

### Icons and the social card

`public/og-image.png`, `public/icon-512.png`, `public/icon-192.png`,
`public/apple-touch-icon.png`, `src/app/icon.png` and `src/app/favicon.ico` are
screenshots of the two `/dev/og` pages. To regenerate them (macOS, with `npm run dev`
running):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"   # keeps headless Chrome away from your own profile
shoot() { "$CHROME" --headless=new --user-data-dir="$PROFILE" --no-first-run \
  --hide-scrollbars --virtual-time-budget=6000 \
  --window-size="$1" --screenshot="$2" "$3"; }

shoot 1200,630 /tmp/card.png    http://localhost:3000/dev/og/card
shoot 512,512  /tmp/icon.png    http://localhost:3000/dev/og/icon
shoot 512,512  /tmp/favicon.png "http://localhost:3000/dev/og/icon?variant=favicon"

node src/app/dev/og/build-images.mjs /tmp/card.png /tmp/icon.png /tmp/favicon.png
```

`build-images.mjs` copies the card and the 512 px icon into place, derives the 192
and 180 px icons with `sips`, and packs the 48 / 32 / 16 px favicon. Add
`--out <dir>` to write somewhere else first. The favicon frames must be RGBA PNGs:
Next refuses an `.ico` whose PNG frames have no alpha channel, and a bad
`favicon.ico` fails every route.

## Originality

This project is inspired by the look and feel of 1996-era 3D platform games: low-poly
models, a hub world with doors and paintings, stars as progress, a playful camera and
chiptune sound. All art, audio and code are original and generated in this repository.
It contains no Nintendo assets and does not use or recreate Nintendo characters,
names, logos, fonts, artwork, music, sound effects, voice lines or levels. The
substitutions made from the original design document are listed in the build guide.

## Deployment

The existing Vercel project deploys this GitHub repository. Pushing to `main`
publishes to production. See [DEPLOYMENT.md](DEPLOYMENT.md).

## License and credits

- Source code: MIT License, see [`LICENSE`](LICENSE).
- Portfolio content (text, résumé, photo): © 2025 Daniel Avila. All rights reserved.
- Employer, school and certification logos belong to their owners.

Built by **Camino Code** - [caminocode.com](https://www.caminocode.com/)

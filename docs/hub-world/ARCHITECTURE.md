# DANIEL AVILA 64 — build guide

danielavila.tech is being rebuilt as an N64-era, low-poly 3D "hub world" portfolio:
a title screen, an octagonal castle lobby with five doors, a painting behind each
door, and an HTML overlay with the real portfolio content inside each painting.
The design document is `docs/hub-world/blueprint.txt` — read it. This file says how
we build it and who owns what.

## 1. Non-negotiables

1. **Original work only.** The blueprint is Super Mario 64 themed. We take the
   inspiration (low-poly 1996 look, hub world, doors and paintings, stars as
   progress, playful camera, chiptune audio) and build every asset ourselves.
   Never use or recreate Nintendo characters, names, logos, fonts, art, music,
   sound effects, voice lines or specific levels. Substitutions already decided:

   | Blueprint says | We build |
   | --- | --- |
   | Peach's Castle lobby | An original octagonal castle foyer ("the Keep") |
   | "DANIEL AVILA 64" logo | Same words, original chunky lettering and palette (not the SM64 logo's letterforms or colour order) |
   | Mario-face 3D bust title screen | The blueprint's other option: a slow camera orbit of the lobby |
   | Classic start / door / warp / pause sounds | Original synthesized sounds (Web Audio) |
   | Power Star | A plain gold five-point star, no face |
   | "Here we go!" star pose | An original victory pose, no voice clip; on-screen text "Résumé unlocked!" |
   | SM64 pause menu / Act-select screen | Original retro menus in our own style |
   | "Hazy Maze Server Room" | "Deep Rack Caverns" |
   | "Tick Tock Network" | "Clockwork Network" |
   | "Wing Cap Tower" / Cap Badge | "Skyward Star Tower" / badge |
   | "Peach's Courtyard" | "Sunset Courtyard" |
   | Rigged Blender `.glb` avatar | A procedural low-poly avatar built in code (600–800 triangles) |

   "The Royal Archive" is already original and stays.
2. **Daniel's real content only.** All copy comes from `src/content/portfolio.ts`.
   Do not invent employers, dates, grades, results or links. If something is
   missing, leave it out and report it.
3. **Nothing is deployed or pushed.** No `git commit`, `git stash`, `git switch`,
   `git reset`, `git push`. Other agents are editing this checkout at the same time.
4. **Stay in your lane.** Only create or edit the files your brief assigns to you.
   Never edit `src/game/contract.ts`, `layout.ts`, `store.ts`, `modules.ts`,
   `services.ts`, `src/game/stubs/*`, `src/content/portfolio.ts`,
   `src/app/globals.css`, `src/app/page.tsx`, `package.json` or another module's
   folder. If the contract is wrong or missing something, work around it inside
   your module and say so in your report.
5. **No new dependencies.** `three` (0.187) is installed, including
   `three/examples/jsm/*`. Do not run `npm install`.

## 2. Stack

- Next.js 15 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4.
- **Plain three.js**, imperative, in `src/game/*` — no React Three Fiber, no drei,
  no physics engine. (The well-known game-style portfolios all use plain three.js;
  a single flat room needs only circle-vs-segment collision.)
- React renders the HTML layer only: title screen, HUD, pause menu, overlays,
  plain version. The engine and React talk through `src/game/store.ts` (state) and
  the `GameApi` interface (commands). React never renders per frame.
- All 3D assets are generated in code: geometry from primitives, textures drawn on
  64×64 canvases with nearest-neighbour filtering. No model or image downloads.
- Audio is synthesized with the Web Audio API. No audio files.
- The engine chunk (three.js) is lazy-loaded after the title screen paints.

## 3. Shared foundation (read these before writing code)

| File | What it is |
| --- | --- |
| `src/game/contract.ts` | Every shared type: `World`, `Avatar`, `AudioEngine`, `GameApi`, `DOORS`, coordinate conventions |
| `src/game/layout.ts` | Where everything is: room size, door frames, stand/enter/exit points, colliders. **Authoritative** |
| `src/game/store.ts` | `ui` store, `useUi` hook, `collectStar`, persistence |
| `src/game/modules.ts` | Registry of 3D modules (`createWorld`, `createAvatar`). Imports three.js |
| `src/game/services.ts` | Registry of UI-safe services (`getAudio`, `setMuted`, `loadGame`, `createPaintingCanvas`, `createEmblemCanvas`). Must never import three.js |
| `src/game/stubs/*` | Working placeholder implementations of every module. The registries point at these until integration |
| `src/content/portfolio.ts` | All of Daniel's content |
| `src/app/globals.css` | Design tokens (`--ink`, `--night`, `--royal`, `--star`, `--cream` …) and shared primitives (`.text-chunky`, `.text-pixel`, `.panel-retro`, `.btn-retro`) |
| `src/components/shared/StarIcon.tsx`, `PaintingThumb.tsx` | Shared UI bits |

Import collaborators through the registries (`@/game/modules`, `@/game/services`),
never from another module's folder. Your own harness may import your own module
directly.

### Coordinates

- 1 unit ≈ 1 m. Avatar ≈ 1.75 tall. +Y up. −Z is north (centre door). +X is east.
- Forward is local +Z; `rotation.y = Math.atan2(dirX, dirZ)`.
- The lobby is an octagon, apothem 11. Doors on the W, NW, N, NE, E walls
  (indices 0–4). Each door: stone arch 1.0 deep → hinged door leaf → alcove 3.8
  wide × 3.4 deep → 2.4 m square painting on the back wall, centre height 2.05.
  Pedestal with the résumé star at the origin. Spawn at (0, 2.8) facing north.

## 4. Module map and ownership

| Module | Owner files | Exports |
| --- | --- | --- |
| Engine | `src/game/engine/**`, `src/app/dev/engine/**` | `createGame: CreateGame` from `src/game/engine/index.ts` |
| World | `src/game/world/**`, `src/app/dev/world/**` | `createWorld: CreateWorld` from `src/game/world/index.ts` |
| Avatar | `src/game/avatar/**`, `src/app/dev/avatar/**` | `createAvatar: CreateAvatar` from `src/game/avatar/index.ts` |
| Art | `src/game/art/**`, `src/app/dev/art/**` | `createPaintingCanvas` from `src/game/art/paintings.ts`; `createEmblemCanvas` from `src/game/art/emblem.ts` |
| Audio | `src/game/audio/**`, `src/app/dev/audio/**` | `createAudio: CreateAudio` from `src/game/audio/index.ts` |
| Game UI | `src/components/game/**`, `src/app/dev/ui/**` | `GameRoot` from `src/components/game/GameRoot.tsx` |
| Course overlays + plain version | `src/components/course/**`, `src/app/dev/overlays/**`, `src/app/dev/plain/**` | `CourseOverlay`, `PlainPortfolio` |
| SEO, assets, docs | `src/app/layout.tsx`, `src/components/seo/**`, `src/app/dev/og/**`, `public/*` (new files, manifest, sitemap, robots), `README.md`, `DEPLOYMENT.md`, `next.config.ts` | metadata, JSON-LD, icons, OG image |

Integration (flipping the registries, composing `src/app/page.tsx`) happens after
the parallel build and is not yours.

## 5. Look and feel

**3D.** 1996 cartridge look, bright and warm, never grim. Low internal resolution
(the engine renders at ~360–480 px tall and upscales with `image-rendering:
pixelated`), 64×64 nearest-filtered textures, flat or baked vertex shading, no
shadow maps (a blob shadow under the avatar), light fog at most. Saturated,
friendly colours: cream and warm-grey stone, a red carpet with gold trim, a
black-and-white checkerboard floor, warm wood doors with iron bands, gold stars,
Daniel's brand blue `#3970EB` on banners. Chunky proportions, visible facets.
Target for the whole scene: under ~8k triangles and ~60 draw calls.

**HTML UI.** Use the tokens and primitives in `globals.css`. Chunky rounded display
type (`font-display` / `.text-chunky`: gold face, dark outline, hard drop shadow)
for titles; the pixel face (`font-pixel` / `.text-pixel`) only for short HUD
labels; `font-body` for everything people actually read. Navy panels with gold
rims (`.panel-retro`), big push buttons (`.btn-retro`). Portfolio text must be
crisp, selectable, high-contrast (WCAG AA) and comfortable on a phone. Touch
targets ≥ 44 px. Every interactive control is a real `<button>` or `<a>` with a
visible focus ring. Honour `prefers-reduced-motion`.

## 6. Behaviour spec

### 6.1 Flow (store `phase`)

`title` → (PRESS START) → `intro` (camera swoops in behind the avatar) → `lobby`
(playable) → `entering` (dive into a painting, ripple, flash) → `course` (HTML
overlay open) → `exiting` (reverse ripple, backflip out) → `lobby`.

### 6.2 Controls — all active at once, no mode switch

| Scheme | Input | Behaviour |
| --- | --- | --- |
| Guided door cycling | `< PREV DOOR` / `NEXT DOOR >` buttons, mouse wheel | Avatar turns and sprints along a smooth path to the door, the door opens, the camera frames the painting over the avatar's shoulder |
| Point and click | Click / tap a door, sign or painting | Door or sign: run there and open it. Exposed painting: triple-jump into the canvas. Star or pedestal: run there, star pose, résumé card |
| Free roam | WASD, arrow keys, Space (jump), on-screen thumbstick + jump button | Cancels any auto-path at once; third-person follow camera; walk, jump, open doors by proximity, leap into paintings |
| Pause | Esc or the top-right `+ PAUSE / MENU` button | Pause chime, 2D menu with direct section links and the PDF résumé |

Who listens to what: **the engine** owns movement keys (WASD, arrows, Space),
pointer input on the canvas and the wheel on the canvas, and ignores them unless
`phase === "lobby"` and not paused. **The React UI** owns Esc, Enter/Space on the
title screen, M for mute, and every button. Esc is split so it is never handled
twice: `GameRoot` handles Esc only while no overlay is open (toggle pause in the
lobby; the pause menu closes itself), and `CourseOverlay` handles Esc itself while
it is open by calling its `onExit` prop.

### 6.3 Engine details

- Doors open when the avatar is within `DOOR_OPEN_RADIUS` of the door centre or the
  door is the guided target; they close beyond `DOOR_CLOSE_RADIUS` when not the
  target. Opening plays `doorOpen`; the avatar plays `push` if it is walking into
  the door. `ui.nearDoor` is the open door nearest the avatar (or −1).
- Entering a painting: by click / `enterCourse(id)` the avatar runs to the stand
  point, into the alcove, does three hops of growing height and dives. In free
  roam, pressing jump within `PAINTING_DIVE_RANGE` of the canvas (inside that
  alcove), or touching the canvas while airborne, starts the dive. Then:
  `door.ripple("in")`, `dive` + `warpIn` sounds, avatar hidden as it passes the
  canvas, camera pushes in, `ui.flash++`, `ui.overlay = id`, `phase = "course"`,
  `collectStar(id)` (new star → `toast` + `starGet`), music `course`.
- `enterCourse(id, { instant: true })` (pause-menu fast travel) cuts straight
  there: avatar placed in the alcove, door open, short ripple, flash, overlay.
- `enterCourse("resume")`: run to `STAR_STAND`, `starPose`, `world.starBurst()`,
  `starPose` sound, then the overlay. Leaving it just returns to the lobby.
- `exitCourse()`: `ui.overlay = null`, flash, `door.ripple("out")`, `warpOut`,
  avatar reappears at the canvas, `backflip` arc to the door's `exitPoint` facing
  the lobby, `land`, camera returns to follow, `phase = "lobby"`.
- Idle: the avatar module handles glance (5 s) and sleep (20 s) itself; the engine
  calls `avatar.wake()` on any input and may play `snore` while `avatar.sleeping`.
- Camera: title orbit; eased swoop for the intro; third-person follow that stays
  inside the room (when the avatar is in an alcove the camera sits in the lobby on
  the door's axis); an over-the-shoulder framing shot for a guided door; a push-in
  for the dive. Reduced motion: cut instead of swoop, no shake.
- Retro pipeline: internal height ≈ 480 px (360 px on touch / small screens),
  `antialias: false`, canvas CSS-scaled with `image-rendering: pixelated`.
- Robustness: WebGL creation failure → `ui.set({ webgl: "unavailable", mode:
  "plain" })`; handle `webglcontextlost` / `restored`; pause the loop when the tab
  is hidden; stop rendering while an overlay fully covers the canvas; no per-frame
  allocations; `ui.set` only when a value actually changes.
- In development expose `window.__da64 = { api, state(), teleport(x, z, yaw) }`
  for scripted checks.

### 6.4 Avatar ("Daniel 64")

600–800 triangles, flat shaded, 64×64 nearest textures where textured. Chunky
1996 proportions (large head, short limbs, mitten hands, big shoes). Likeness
from Daniel's photo: medium-brown skin, dark wavy hair long enough to reach the
jaw and neck, moustache and light chin beard, friendly face; navy blazer over a
light shirt, grey-khaki trousers, dark shoes. Segmented rig (groups, not skinning)
animated procedurally with smooth pose blending. Animations: idle (breathing
bounce, glance after 5 s, sit and sleep with floating "Zzz" after 20 s), run
(arms-out sprint with small white dust puffs at the feet), jump, fall, land,
push (reach forward to push a door), dive, backflip, starPose. Blob shadow, dust
and Zzz live in `avatar.effects` (world space).

### 6.5 World

Checkerboard floor; round red carpet with gold trim and the "DA" emblem; stone
walls with trim and corner pillars; five deep stone arches with wooden doors that
swing inward on their hinges; alcoves with a framed, softly glowing painting and
torches; a floating sign (the door label in its accent colour) and star emblems
above each frame (1 star, 3 stars, one big star, 3 stars, 1 star); the centre
pedestal with a wooden signpost and a rotating gold star; a ceiling painted as a
sky with slowly drifting clouds; a decorative entrance on the south wall and
brand-blue banners on the two plain walls. Paintings use a GLSL ripple material
(concentric radial UV displacement with an amplitude envelope) driven by
`door.ripple()`. Geometry must match `layout.ts` exactly — the colliders there are
what the avatar actually bumps into. Walls are single-sided facing inward so a
camera that slips outside sees through them. Merge static geometry by material.

### 6.6 Art

Five original pixel-art paintings, drawn procedurally and deterministically on a
canvas (no image files), plus the "DA" emblem used on the carpet, banners and
icons. Painting themes: The Royal Archive (fortress library and courtyard), Deep
Rack Caverns (underground cavern of server racks and glowing retro terminals),
Clockwork Network (interlocking gears, brick firewalls, mission flags), Skyward
Star Tower (sunlit tower in the clouds ringed by gold stars), Sunset Courtyard
(castle garden at sunset). They must read clearly at 128 px and from across the
room.

### 6.7 Audio

Original chiptune-style synthesis: three short looping tunes (`title`, `lobby`,
`course`) and the `SfxName` set. Nothing may quote or imitate an existing game's
melody or signature sound. Silent until `unlock()` is called in a user gesture.
A persistent mute toggle; music quieter than effects; no clipping.

### 6.8 HTML UI

Title screen: chunky "DANIEL AVILA 64" logo, flashing PRESS START (click, tap,
Enter or Space), a speaker toggle, and a visible "plain HTML version" link.
Lobby HUD: bottom bar `[ < PREV DOOR ]  LOBBY (Use WASD to walk or click a door)
[ NEXT DOOR > ]`; a top banner with the course title when a door is open; a
persistent top-right `+ PAUSE / MENU` button; a persistent speaker icon; a star
counter; on touch devices a thumbstick and a jump button. Pause menu: direct links
to all five sections and the résumé star, a one-click PDF résumé download, sound
toggle, plain-version link, resume button. White flash layer for warps.

### 6.9 Course overlays and plain version

Each course opens as a high-contrast, responsive HTML overlay in our own
"course select" style, with crisp selectable text, and closes with
`[ JUMP OUT OF PAINTING (ESC) ]`. Content mapping:

1. Education — degree, institution, milestones, selectable coursework cards.
2. Skills — categorized inventory grids.
3. Career & Labs — clickable "Star Missions", each with objective, tools, outcome.
4. Certifications — each certification as a spinning star or badge with issuer,
   date, competencies, status (and a verification link only where one exists).
5. About & Contact — bio, career focus, LinkedIn, GitHub, email, a collectible star
   button that downloads the PDF résumé, and the working contact form.

The résumé star opens a compact card with the PDF and contact links.

The same section components render the **plain HTML version**: a normal,
server-rendered, semantic page containing all of the above. It is what search
engines, résumé parsers, screen readers, no-JS and no-WebGL visitors get, and
visitors can switch to it at any time.

## 7. Checking your work

A Next dev server is already running at **http://localhost:3000** (Turbopack, hot
reload). Do **not** start, stop or restart servers and do **not** run `next build`
— other agents share this checkout. If port 3000 is unreachable, say so in your
report and fall back to type-checking.

- Type-check: `npx tsc --noEmit -p .` from the repo root. Fix every error in your
  own files; ignore errors in files you do not own (another agent may be mid-edit)
  but mention them.
- Put your harness under `src/app/dev/<your-module>/page.tsx` (a `"use client"`
  page). `/dev/*` 404s in production. `src/app/dev/whitebox/page.tsx` is a tiny
  example that renders the active world and avatar.
- Look at it. A headless Chrome driver is available:

  ```bash
  SHOT=/private/tmp/claude-501/-Users-faviojasso-Library-Application-Support-Claude-scratch-workspaces-2e78f3bf-6b09-4892-8e37-05d4f25b71e0-0f59886b-c83f-4098-9822-b751fbbcfb93-scratch-2026-11-10-cf9e80/381bbed9-222e-45b2-b07f-9df9e8e2450e/scratchpad
  node $SHOT/tools/shot.mjs "http://localhost:3000/dev/world?view=lobby" \
    --out $SHOT/shots/<module>/lobby.png --wait 2500
  # options: --size 1280x720 | --mobile (390x844, touch) | --reduced-motion | --console
  # --steps '[{"wait":500},{"click":[640,360]},{"key":"KeyW","ms":800},{"press":"Escape"},
  #           {"eval":"window.__da64.state()"},{"shot":"/abs/path.png"},{"wheel":120},
  #           {"drag":[x1,y1,x2,y2]},{"tap":[x,y]},{"waitFor":"css"},{"text":"css"}]'
  ```

  Then open the PNG with the Read tool and actually judge it. Iterate until it
  looks right — screenshots at several angles / states, desktop and `--mobile`
  where it matters. Create your own `shots/<module>/` folder. The driver prints
  page errors, console errors and failed requests; a clean run has none (a 404 for
  `/icon-192.png` is a known, unrelated gap).
- WebGL works in the headless driver. Audio output cannot be heard; verify it by
  rendering through an `OfflineAudioContext` and checking the samples.

## 8. Report

Finish with a structured report: what you built (files), anything in the contract
or another module that you needed and did not get, how you verified it (commands
and screenshot paths), known gaps, and any blueprint item you changed or dropped
with the reason.

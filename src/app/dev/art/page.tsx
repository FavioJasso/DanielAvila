"use client";

/**
 * Dev harness for the art module (src/game/art): every painting at 64, 128
 * and 384 CSS px, a "seen from across the room" strip, the emblem on red,
 * brand blue and a checker, and the star.
 *
 *   /dev/art                          the full sheet
 *   /dev/art?only=<id>&scale=<n>      one piece, n screen px per logical px
 *                                     id: education | skills | career |
 *                                         certifications | about | emblem | star
 *
 * It imports the module directly (not through the registry) so it shows the
 * real art even while `services.ts` still points at the stubs. In development
 * it also exposes `window.__art` with content hashes for scripted checks.
 */
import { useEffect, useRef, useState } from "react";
import { DOORS, type SectionId } from "@/game/contract";
import { createEmblemCanvas } from "@/game/art/emblem";
import { createPaintingCanvas, paintingPalette } from "@/game/art/paintings";
import { createStarCanvas } from "@/game/art/star";

type PieceId = SectionId | "emblem" | "star";

const RED = "#d8343a";
const BLUE = "#3970EB";
const CHECKER =
  "repeating-conic-gradient(#c9c9c9 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px";

/** Logical pixels along one side of a piece. */
const gridOf = (id: PieceId): number => (id === "star" ? 32 : 64);

/** Accessible name for a piece. */
function labelOf(id: PieceId): string {
  if (id === "emblem") return "DA emblem";
  if (id === "star") return "Gold star";
  const door = DOORS.find((d) => d.id === id);
  return door ? `${door.paintingTitle}: ${door.paintingBlurb}` : id;
}

function makeCanvas(id: PieceId, size: number): HTMLCanvasElement {
  if (id === "emblem") return createEmblemCanvas(size);
  if (id === "star") return createStarCanvas(size);
  return createPaintingCanvas(id, size);
}

/** FNV-1a over the canvas pixels — enough to prove two renders are identical. */
function hashCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "no-context";
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Mounts a canvas made by the art module. `px` is the backing size asked of
 * the module; `css` (default = px) is the on-screen size.
 */
function Piece({ id, px, css = px }: { id: PieceId; px: number; css?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = makeCanvas(id, px);
    // fill the host, which keeps its square aspect but never overflows a
    // narrow (phone) viewport
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "block";
    host.replaceChildren(canvas);
    return () => host.replaceChildren();
  }, [id, px, css]);
  return (
    <div
      ref={ref}
      style={{ width: css, maxWidth: "100%", aspectRatio: "1 / 1", flex: "0 1 auto" }}
      data-piece={id}
      role="img"
      aria-label={labelOf(id)}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: "12px/1.3 ui-monospace, monospace", color: "#b7c0e8", marginTop: 4 }}>
      {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        font: "700 15px/1.2 system-ui, sans-serif",
        color: "#ffc93c",
        margin: "28px 0 10px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h2>
  );
}

function Swatches({ id }: { id: SectionId }) {
  return (
    <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
      {paintingPalette(id).map((hex, i) => (
        <div
          key={i}
          title={hex}
          style={{ width: 22, height: 12, background: hex, outline: "1px solid rgba(255,255,255,0.25)" }}
        />
      ))}
    </div>
  );
}

function Single({ id, scale }: { id: PieceId; scale: number }) {
  const size = gridOf(id) * scale;
  const door = DOORS.find((d) => d.id === id);
  const transparent = id === "emblem" || id === "star";
  return (
    <main style={{ minHeight: "100vh", background: "#0a0f2c", padding: 16 }}>
      <div style={{ display: "inline-block", maxWidth: "100%", background: transparent ? CHECKER : "none" }}>
        <Piece id={id} px={size} />
      </div>
      <Label>
        {door ? `${door.courseNumber}. ${door.paintingTitle} — ${door.paintingBlurb}` : id} · {size}px (
        {scale}× the {gridOf(id)}px grid)
      </Label>
    </main>
  );
}

function Sheet({ report }: { report: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0f2c",
        color: "#fff4d6",
        padding: "16px 20px 40px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ font: "800 20px/1.2 system-ui, sans-serif", margin: 0 }}>
        DANIEL AVILA 64 — paintings, emblem and star
      </h1>
      <Label>{report}</Label>

      <Heading>Paintings — 384 px</Heading>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {DOORS.map((d) => (
          <figure key={d.id} style={{ margin: 0, width: 384, maxWidth: "100%" }}>
            <Piece id={d.id} px={384} />
            <figcaption>
              <div style={{ font: "700 14px/1.3 system-ui, sans-serif", marginTop: 6 }}>
                {d.courseNumber}. {d.paintingTitle}
              </div>
              <Label>
                {d.id} · {d.paintingBlurb}
              </Label>
              <Swatches id={d.id} />
            </figcaption>
          </figure>
        ))}
      </div>

      <Heading>Paintings — 128 px and 64 px</Heading>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        {DOORS.map((d) => (
          <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div>
              <Piece id={d.id} px={128} />
              <Label>{d.paintingTitle}</Label>
            </div>
            <Piece id={d.id} px={64} />
          </div>
        ))}
      </div>

      <Heading>Across the room — 48, 32 and 24 px on stone</Heading>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          background: "#b9b2a3",
          padding: 16,
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        {[48, 32, 24].map((css) => (
          <div key={css} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {DOORS.map((d) => (
              <div key={d.id} style={{ outline: "2px solid #5a4630" }}>
                <Piece id={d.id} px={64} css={css} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <Heading>Emblem — 256, 128 and 64 px</Heading>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {[
          { name: "carpet red", background: RED },
          { name: "brand blue #3970EB", background: BLUE },
          { name: "transparent", background: CHECKER },
        ].map((bg) => (
          <div key={bg.name}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "flex-end",
                padding: 16,
                background: bg.background,
              }}
            >
              <Piece id="emblem" px={256} />
              <Piece id="emblem" px={128} />
              <Piece id="emblem" px={64} />
            </div>
            <Label>{bg.name}</Label>
          </div>
        ))}
      </div>

      <Heading>Star — 128, 64, 32 and 16 px</Heading>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {["#131b4d", "#8fc1ff", CHECKER].map((background) => (
          <div
            key={background}
            style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", padding: 12, background }}
          >
            <Piece id="star" px={128} />
            <Piece id="star" px={64} />
            <Piece id="star" px={32} />
            <Piece id="star" px={16} />
          </div>
        ))}
      </div>
    </main>
  );
}

const PIECES: readonly PieceId[] = [...DOORS.map((d) => d.id), "emblem", "star"];

export default function ArtHarnessPage() {
  const [view, setView] = useState<{ only: PieceId | null; scale: number } | null>(null);
  const [report, setReport] = useState("checking…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const only = params.get("only");
    const scale = Math.max(1, Math.min(16, Math.round(Number(params.get("scale")) || 10)));
    setView({ only: PIECES.find((id) => id === only) ?? null, scale });

    // Determinism + "always a fresh canvas" self-check.
    const hashes: Record<string, string> = {};
    let stable = true;
    let fresh = true;
    for (const id of PIECES) {
      const a = makeCanvas(id, 128);
      const b = makeCanvas(id, 128);
      hashes[id] = hashCanvas(a);
      stable = stable && hashes[id] === hashCanvas(b);
      fresh = fresh && a !== b;
    }
    setReport(
      `deterministic: ${stable ? "yes" : "NO"} · fresh canvas per call: ${fresh ? "yes" : "NO"} · ` +
        PIECES.map((id) => `${id} ${hashes[id]}`).join(" · "),
    );
    (window as unknown as { __art?: unknown }).__art = { hashes, stable, fresh };
  }, []);

  if (!view) return <main style={{ minHeight: "100vh", background: "#0a0f2c" }} />;
  return view.only ? <Single id={view.only} scale={view.scale} /> : <Sheet report={report} />;
}

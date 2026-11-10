"use client";

/**
 * Dev harness for the course overlays.
 *
 *   /dev/overlays?id=education|skills|career|certifications|about|resume
 *     &mission=<mission id>   preselect a Star Mission (career)
 *     &open=0                 start closed (opener buttons only)
 *     &send=fail              make the mock contact form delivery fail
 *     &review=1               outline copy marked `needsReview`
 *
 * The overlay sits over a deliberately busy fake "canvas" so the backdrop's
 * opacity can be judged. Exits are logged on the page and on
 * `window.__da64OverlayLog` for scripted keyboard checks. The contact form
 * uses a mock transport — nothing is ever sent from here.
 */
import { use, useCallback, useState } from "react";
import { CourseOverlay } from "@/components/course/CourseOverlay";
import type { OverlayId } from "@/game/contract";
import { MockTransport } from "./MockTransport";

const IDS: OverlayId[] = ["education", "skills", "career", "certifications", "about", "resume"];

declare global {
  interface Window {
    __da64OverlayLog?: string[];
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OverlaysHarness({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const param = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const requested = IDS.find((id) => id === param("id")) ?? "education";

  const [open, setOpen] = useState<OverlayId | null>(param("open") === "0" ? null : requested);
  const [log, setLog] = useState<string[]>([]);

  // One log line per onExit call (kept out of state updaters, which React
  // Strict Mode runs twice).
  const exit = useCallback(() => {
    const line = `onExit(${open ?? "none"})`;
    (window.__da64OverlayLog ??= []).push(line);
    setLog((lines) => [...lines, line]);
    setOpen(null);
  }, [open]);

  return (
    <MockTransport fail={param("send") === "fail"} review={param("review") === "1"}>
      {/* Fake 3D canvas: bright, high-contrast shapes behind the overlay. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "repeating-conic-gradient(#f4f1e6 0 25%, #1b1b1b 0 50%) 0 0 / 120px 120px, #27358f",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 320,
            height: 320,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "#d8343a",
            border: "12px solid #ffc93c",
          }}
        />
      </div>

      <main
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 16,
          alignItems: "flex-start",
        }}
      >
        {IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="btn-retro"
            data-open={id}
            onClick={() => setOpen(id)}
          >
            Open {id}
          </button>
        ))}
        <ol
          id="harness-log"
          aria-label="Exit log"
          style={{
            flexBasis: "100%",
            margin: 0,
            padding: "8px 12px",
            minHeight: 40,
            color: "#fff4d6",
            background: "rgba(10,15,44,0.9)",
            borderRadius: 8,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          }}
        >
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </main>

      {open && <CourseOverlay id={open} onExit={exit} mission={param("mission")} />}
    </MockTransport>
  );
}

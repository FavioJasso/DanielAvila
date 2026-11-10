"use client";

/**
 * The HTML overlay shown "inside" a painting: a modal dialog above the 3D
 * canvas in our own retro course-select style. It owns its keyboard
 * handling while open — focus moves in, Tab is trapped, and Esc calls
 * `onExit` (GameRoot ignores Esc while an overlay is open).
 */
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { PaintingThumb } from "@/components/shared/PaintingThumb";
import { StarIcon } from "@/components/shared/StarIcon";
import { sections } from "@/content/portfolio";
import { DOORS, RESUME_STAR, type DoorSpec, type OverlayId, type SectionId } from "@/game/contract";
import { AboutSection } from "./sections/AboutSection";
import { CareerSection } from "./sections/CareerSection";
import { CertificationsSection } from "./sections/CertificationsSection";
import { EducationSection } from "./sections/EducationSection";
import { ResumeStarCard } from "./sections/ResumeStarCard";
import { SkillsSection } from "./sections/SkillsSection";
import "./course.css";

export interface CourseOverlayProps {
  id: OverlayId;
  /** Close the overlay (the engine plays the jump-out sequence). */
  onExit: () => void;
  /** Career & Labs only: the mission id to show first. */
  mission?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]';

/**
 * Opt-in fallback focus target after the overlay closes when the opener is
 * gone (see the effect below). Deliberately no built-in fallback to a HUD
 * button: in the lobby Space is the jump key, and a focused button would
 * swallow it (GameRoot follows the same rule for the pause menu).
 */
const RETURN_FOCUS_SELECTORS = ["[data-overlay-return-focus]"] as const;

/** How long to keep retrying the focus hand-back after close (40 × 100 ms). */
const RETURN_FOCUS_TRIES = 40;
const RETURN_FOCUS_INTERVAL_MS = 100;

/** Focus `el` if it can actually take focus (connected, rendered, enabled). */
function tryFocus(el: HTMLElement | null | undefined): boolean {
  if (!el || !el.isConnected || el.getClientRects().length === 0) return false;
  el.focus({ preventScroll: true });
  return document.activeElement === el;
}

/** Visible, tabbable elements inside `root`, in document order. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
}

function renderSection(id: SectionId, mission?: string): ReactNode {
  switch (id) {
    case "education":
      return <EducationSection variant="overlay" />;
    case "skills":
      return <SkillsSection variant="overlay" />;
    case "career":
      return <CareerSection variant="overlay" initialMission={mission} />;
    case "certifications":
      return <CertificationsSection variant="overlay" />;
    case "about":
      return <AboutSection variant="overlay" />;
  }
}

/** The star emblem above the door: one star, three stars or one big star. */
function DoorBadge({ badge }: { badge: DoorSpec["badge"] }) {
  const count = badge === 3 ? 3 : 1;
  const size = badge === "big" ? 20 : 14;
  return (
    <span className="cx-dialog__badge" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <StarIcon key={i} size={size} />
      ))}
    </span>
  );
}

export function CourseOverlay({ id, onExit, mission }: CourseOverlayProps) {
  const door = DOORS.find((d) => d.id === id);
  const meta = sections.find((s) => s.id === id);
  const title = door ? door.courseTitle : RESUME_STAR.title;

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Always call the latest onExit without re-running the focus effect.
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Whatever had focus when the overlay opened (ignoring our own nodes, so
    // a Strict Mode re-run of this effect cannot record the dialog itself).
    const focused = document.activeElement;
    const opener =
      focused instanceof HTMLElement && focused !== document.body && !dialog.contains(focused)
        ? focused
        : null;
    titleRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        // Capture + stopPropagation: Esc is handled exactly once, here.
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onExitRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = tabbables(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === titleRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    // Focus that lands outside by any other route is pulled back in.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        titleRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      // Do not lose focus on close: hand it back to whatever opened the
      // overlay, or — if that control is gone — to an opted-in fallback.
      // In the game the HUD is `inert` until the jump-out sequence has
      // landed, so the first attempt can fail: retry for a few seconds, and
      // give up as soon as anything else has taken focus.
      const hasFallback = () => document.querySelector(RETURN_FOCUS_SELECTORS.join(",")) !== null;
      if (!opener && !hasFallback()) return;
      const restore = () => {
        if (tryFocus(opener)) return true;
        for (const selector of RETURN_FOCUS_SELECTORS) {
          if (tryFocus(document.querySelector<HTMLElement>(selector))) return true;
        }
        return false;
      };
      if (restore()) return;
      let tries = 0;
      const timer = window.setInterval(() => {
        const active = document.activeElement;
        const idle = !active || active === document.body;
        if (!idle || restore() || ++tries >= RETURN_FOCUS_TRIES) window.clearInterval(timer);
      }, RETURN_FOCUS_INTERVAL_MS);
    };
  }, [id]);

  const accent = { "--cx-accent": door ? door.accent : "var(--star)" } as CSSProperties;

  return (
    <div
      className={door ? "cx cx--dark cx-overlay cx-overlay--full" : "cx cx--dark cx-overlay"}
      style={accent}
      data-overlay={id}
    >
      <div
        key={id}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={door ? "cx-dialog" : "cx-dialog cx-dialog--compact"}
      >
        <header className="cx-dialog__header">
          {door ? (
            <div className="cx-frame">
              <PaintingThumb id={door.id} size={96} />
            </div>
          ) : (
            <div className="cx-frame cx-frame--star" aria-hidden="true">
              <StarIcon size={48} />
            </div>
          )}
          <div className="cx-block">
            <p className="cx-dialog__eyebrow">
              {door ? (
                <>
                  <span>Course {door.courseNumber}</span>
                  <DoorBadge badge={door.badge} />
                  {meta && <span>{meta.navLabel}</span>}
                </>
              ) : (
                <span>Bonus star</span>
              )}
            </p>
            <h2
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              className="cx-dialog__title text-chunky"
            >
              {title}
            </h2>
            {door && (
              <p className="cx-dialog__painting">
                Painting: <b>{door.paintingTitle}</b>
                <span className="cx-dialog__blurb"> — {door.paintingBlurb}</span>
              </p>
            )}
          </div>
        </header>

        <div
          className="cx-dialog__body"
          role="region"
          aria-label={`${title} — content`}
          tabIndex={0}
        >
          {meta && <p className="cx-lead cx-dialog__intro">{meta.intro}</p>}
          {door ? renderSection(door.id, mission) : <ResumeStarCard />}
        </div>

        <footer className="cx-dialog__footer">
          <button
            type="button"
            className="btn-retro btn-retro--ruby cx-dialog__exit"
            onClick={onExit}
          >
            {door ? "[ JUMP OUT OF PAINTING (ESC) ]" : "[ BACK TO THE LOBBY (ESC) ]"}
          </button>
        </footer>
      </div>
    </div>
  );
}

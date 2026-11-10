"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PaintingThumb } from "@/components/shared/PaintingThumb";
import { StarIcon } from "@/components/shared/StarIcon";
import { profile } from "@/content/portfolio";
import { DOORS, RESUME_STAR } from "@/game/contract";
import { useUi } from "@/game/store";
import { useGameCommands } from "./commands";
import { DownloadIcon, PageIcon, SpeakerIcon } from "./icons";
import { StarCounter } from "./StarCounter";
import { PLAIN_HASH, sfx, toggleMuted } from "./util";

const FOCUSABLE = "a[href], button:not([disabled])";
/** Rows the arrow keys step through, in DOM order. */
const MENU_ITEM = "[data-menu-item]";

/**
 * The pause menu: a modal dialog that doubles as the fast-travel safety net.
 * Focus moves in on open, Tab is trapped inside and arrow keys step through
 * the rows. GameRoot owns the two things that outlive this component: Esc
 * (its window listener handles that key everywhere outside course overlays)
 * and returning focus to whatever opened the menu.
 */
export function PauseMenu() {
  const collected = useUi((s) => s.collected);
  const muted = useUi((s) => s.muted);
  const touch = useUi((s) => s.touch);
  const commands = useGameCommands();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the menu. (GameRoot hands it back to the opener on close.)
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;

    if (e.key === "Tab") {
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const lastItem = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !panel.contains(current))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (current === lastItem || !panel.contains(current))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    const step =
      e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "Home" ? "first" : e.key === "End" ? "last" : 0;
    if (step === 0) return;
    const rows = Array.from(panel.querySelectorAll<HTMLElement>(MENU_ITEM));
    if (rows.length === 0) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next =
      step === "first"
        ? 0
        : step === "last"
          ? rows.length - 1
          : at < 0
            ? 0
            : (at + step + rows.length) % rows.length;
    rows[next].focus();
    sfx("uiMove");
  };

  return (
    <div
      className="da64-pause"
      onPointerDown={(e) => {
        // A press on the dimmed backdrop (not the panel) closes the menu.
        if (e.target === e.currentTarget) commands.closePause();
      }}
    >
      <div
        ref={panelRef}
        className="panel-retro da64-pause__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="da64-pause-title"
        onKeyDown={onKeyDown}
      >
        <header className="da64-pause__head">
          <h2 id="da64-pause-title" className="text-chunky da64-pause__title">
            PAUSE
          </h2>
          <StarCounter className="da64-pause__stars" />
        </header>

        <div className="da64-pause__body">
          <section className="da64-pause__courses" aria-labelledby="da64-pause-warp">
            <h3 id="da64-pause-warp" className="text-pixel da64-pause__kicker">
              Warp to a course
            </h3>
            <ul className="da64-pause__list">
              {DOORS.map((door) => {
                const got = collected.includes(door.id);
                return (
                  <li key={door.id}>
                    <button
                      type="button"
                      className="da64-row"
                      data-menu-item
                      onClick={() => commands.fastTravel(door.id)}
                    >
                      <PaintingThumb id={door.id} size={52} className="da64-row__thumb" />
                      <span className="da64-row__text">
                        <span className="text-pixel da64-row__kicker">Course {door.courseNumber}</span>
                        <span className="da64-row__title">{door.label}</span>
                        <span className="da64-row__sub">{door.courseTitle}</span>
                      </span>
                      <StarIcon
                        size={28}
                        filled={got}
                        className="da64-row__star"
                        title={got ? "Star collected" : "Star not collected yet"}
                      />
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  className="da64-row da64-row--star"
                  data-menu-item
                  onClick={() => commands.fastTravel(RESUME_STAR.id)}
                >
                  <span className="da64-row__thumb da64-row__thumb--star" aria-hidden="true">
                    <StarIcon size={38} />
                  </span>
                  <span className="da64-row__text">
                    <span className="text-pixel da64-row__kicker">Centre pedestal</span>
                    <span className="da64-row__title">{RESUME_STAR.title}</span>
                    <span className="da64-row__sub">{RESUME_STAR.subtitle}</span>
                  </span>
                  <StarIcon
                    size={28}
                    filled={collected.includes(RESUME_STAR.id)}
                    className="da64-row__star"
                    title={
                      collected.includes(RESUME_STAR.id) ? "Star collected" : "Star not collected yet"
                    }
                  />
                </button>
              </li>
            </ul>
          </section>

          <section className="da64-pause__side" aria-label="Options">
            <button
              type="button"
              className="btn-retro btn-retro--ghost da64-pause__action"
              data-menu-item
              aria-pressed={!muted}
              onClick={() => {
                toggleMuted();
                sfx("uiSelect");
              }}
            >
              <SpeakerIcon muted={muted} />
              Sound: {muted ? "off" : "on"}
            </button>
            <a
              className="btn-retro btn-retro--ghost da64-pause__action"
              data-menu-item
              href={PLAIN_HASH}
              onClick={commands.goPlain}
            >
              <PageIcon />
              Plain HTML version
            </a>

            <div className="da64-pause__controls">
              <h3 className="text-pixel da64-pause__kicker">Controls</h3>
              <dl>
                <div>
                  <dt>Walk</dt>
                  <dd>
                    {touch ? (
                      "Drag the on-screen stick"
                    ) : (
                      <>
                        <kbd>WASD</kbd> or <kbd>arrows</kbd>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Jump</dt>
                  <dd>{touch ? "JUMP button" : <kbd>Space</kbd>}</dd>
                </div>
                <div>
                  <dt>Doors</dt>
                  <dd>{touch ? "Tap a door, or Prev / Next" : "Click a door, Prev / Next, or the mouse wheel"}</dd>
                </div>
                <div>
                  <dt>Courses</dt>
                  <dd>{touch ? "Tap a painting, or jump into it" : "Click a painting, or jump into it"}</dd>
                </div>
                {!touch && (
                  <div>
                    <dt>Menu</dt>
                    <dd>
                      <kbd>Esc</kbd> pause <span aria-hidden="true">·</span> <kbd>M</kbd> mute
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
        </div>

        {/* The PDF lives in the always-visible footer, so it is one click
            away on every screen size without scrolling the menu. */}
        <footer className="da64-pause__foot">
          <a
            className="btn-retro btn-retro--gold da64-pause__pdf"
            data-menu-item
            href={encodeURI(profile.links.resume)}
            download={profile.resumeFileName}
            aria-label="Download résumé (PDF)"
            onClick={() => sfx("uiSelect")}
          >
            <DownloadIcon />
            {/* one of the two is display:none, depending on the width */}
            <span className="da64-pause__long" aria-hidden="true">
              Download résumé (PDF)
            </span>
            <span className="da64-pause__short" aria-hidden="true">
              <span className="da64-pause__opt">Résumé </span>PDF
            </span>
          </a>
          <button
            type="button"
            className="btn-retro da64-pause__back"
            data-menu-item
            aria-label="Back to the lobby"
            onClick={commands.closePause}
          >
            <span aria-hidden="true">
              Back to <span className="da64-pause__long">the </span>lobby
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}

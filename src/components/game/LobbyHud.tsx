"use client";

import { useState } from "react";
import { PaintingThumb } from "@/components/shared/PaintingThumb";
import { StarIcon } from "@/components/shared/StarIcon";
import { DOORS, type DoorSpec } from "@/game/contract";
import { useUi } from "@/game/store";
import { useGameCommands } from "./commands";
import { ChevronIcon } from "./icons";
import { SpeakerToggle } from "./SpeakerToggle";
import { StarCounter } from "./StarCounter";
import { JumpButton, Thumbstick } from "./TouchControls";
import { releasePointerFocus } from "./util";

/**
 * Everything on screen while the lobby is playable. The HUD container lets
 * pointer events through to the canvas; only the controls themselves take
 * them. It is hidden during the intro swoop, dims during painting warps and
 * is inert whenever it is not fully active (including behind the pause menu).
 */
export function LobbyHud() {
  const phase = useUi((s) => s.phase);
  const paused = useUi((s) => s.paused);
  const focusedDoor = useUi((s) => s.focusedDoor);
  const nearDoor = useUi((s) => s.nearDoor);
  const nearStar = useUi((s) => s.nearStar);
  const touch = useUi((s) => s.touch);
  /** The context-lost notice is up: nothing behind it should be reachable. */
  const lost = useUi((s) => s.webgl === "lost");
  const commands = useGameCommands();

  // Hidden while the title fades out (intro) and behind a course overlay;
  // dimmed during the short painting warps so the screen does not jump.
  const state =
    phase === "lobby" ? "active" : phase === "entering" || phase === "exiting" ? "dim" : "hidden";
  const interactive = state === "active" && !paused && !lost;
  const focused: DoorSpec | undefined = DOORS[focusedDoor];
  const near: DoorSpec | undefined = DOORS[nearDoor];

  return (
    <div className="da64-hud" data-state={state} inert={!interactive}>
      <div className="da64-hud__top">
        <div className="da64-hud__corner">
          <SpeakerToggle />
          <StarCounter />
        </div>

        <DoorBanner door={near} />

        <button
          id="da64-pause-button"
          data-overlay-return-focus
          type="button"
          className="btn-retro btn-retro--ghost da64-hud__pause"
          aria-label="Pause menu"
          aria-haspopup="dialog"
          onClick={(e) => {
            releasePointerFocus(e);
            commands.openPause();
          }}
        >
          <span aria-hidden="true">
            + PAUSE<span className="da64-hud__pause-more"> / MENU</span>
          </span>
        </button>
      </div>

      <div className="da64-hud__bottom">
        <div className="da64-hud__mid" data-touch={touch || undefined}>
          {touch && <Thumbstick onMove={commands.setStick} disabled={!interactive} />}

          <div className="da64-hud__actions">
            {nearStar && (
              <button
                type="button"
                className="btn-retro da64-cta"
                onClick={(e) => {
                  releasePointerFocus(e);
                  commands.enterCourse("resume");
                }}
              >
                <StarIcon size={24} />
                Grab the résumé star
              </button>
            )}
            {near && (
              <button
                type="button"
                className="btn-retro btn-retro--gold da64-cta da64-cta--painting"
                onClick={(e) => {
                  releasePointerFocus(e);
                  commands.enterCourse(near.id);
                }}
              >
                <PaintingThumb id={near.id} size={30} className="da64-cta__thumb" />
                Jump into the painting
              </button>
            )}
          </div>

          {touch && <JumpButton onJump={commands.jump} />}
        </div>

        <nav className="da64-bar" aria-label="Door navigation">
          <button
            type="button"
            className="btn-retro da64-bar__btn da64-bar__btn--prev"
            aria-label="Previous door"
            onClick={(e) => {
              releasePointerFocus(e);
              commands.cycleDoor(-1);
            }}
          >
            <ChevronIcon dir="left" />
            <span aria-hidden="true">PREV DOOR</span>
          </button>

          <div className="da64-bar__label" role="status">
            <span className="text-chunky da64-bar__name">{focused ? focused.label : "LOBBY"}</span>
            <span className="da64-bar__hint">
              {focused
                ? `Course ${focused.courseNumber} · ${focused.courseTitle}`
                : touch
                  ? "Drag the stick to walk or tap a door"
                  : "Use WASD to walk or click a door"}
            </span>
          </div>

          <button
            type="button"
            className="btn-retro da64-bar__btn da64-bar__btn--next"
            aria-label="Next door"
            onClick={(e) => {
              releasePointerFocus(e);
              commands.cycleDoor(1);
            }}
          >
            <span aria-hidden="true">NEXT DOOR</span>
            <ChevronIcon dir="right" />
          </button>
        </nav>
      </div>
    </div>
  );
}

/**
 * Top banner for the open door nearby. It keeps showing the last door while
 * it slides away; a separate visually-hidden status line does the announcing
 * so screen readers hear each door exactly once.
 */
function DoorBanner({ door }: { door: DoorSpec | undefined }) {
  const [last, setLast] = useState(door);
  if (door && door !== last) setLast(door);
  const shown = door ?? last;

  return (
    <div className="da64-hud__banner-slot">
      <p className="da64-sr" role="status">
        {door
          ? `Door open. Course ${door.courseNumber}: ${door.courseTitle}. Painting: ${door.paintingTitle}.`
          : ""}
      </p>
      <div className="panel-retro da64-banner" data-open={door ? true : undefined} aria-hidden="true">
        {shown && (
          <>
            <PaintingThumb id={shown.id} size={52} className="da64-banner__thumb" />
            <div className="da64-banner__text">
              <span className="text-pixel da64-banner__kicker">Course {shown.courseNumber}</span>
              <span className="text-chunky da64-banner__title">{shown.courseTitle}</span>
              <span className="da64-banner__painting">{shown.paintingTitle}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

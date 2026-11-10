"use client";

import { credits } from "@/content/portfolio";
import { useUi } from "@/game/store";
import { useGameCommands } from "./commands";
import { SpeakerToggle } from "./SpeakerToggle";
import { PLAIN_HASH } from "./util";

/**
 * The logo is three words, each with its own colour treatment (see
 * `.da64-logo__word--*` in game.css). Every letter is its own span so it can
 * carry an extruded shadow stack plus a glossy face overlay (`::after` reads
 * the glyph from `data-ch`).
 */
const LOGO_WORDS = [
  { id: "daniel", text: "DANIEL" },
  { id: "avila", text: "AVILA" },
  { id: "n64", text: "64" },
] as const;

const [ROLE_MAIN, ROLE_SUB] = credits.role.split(" | ");

interface TitleScreenProps {
  /** The intro swoop has begun: fade out and stop taking input. */
  leaving: boolean;
  /** PRESS START was used before the engine was ready. */
  starting: boolean;
}

export function TitleScreen({ leaving, starting }: TitleScreenProps) {
  const engineReady = useUi((s) => s.engineReady);
  const touch = useUi((s) => s.touch);
  /** The context-lost notice covers the title: keep focus out of it. */
  const lost = useUi((s) => s.webgl === "lost");
  const commands = useGameCommands();

  return (
    <div className="da64-title" data-leaving={leaving || undefined} inert={leaving || lost}>
      <div className="da64-title__bar">
        <SpeakerToggle />
        <a
          className="btn-retro btn-retro--ghost da64-title__plain"
          href={PLAIN_HASH}
          onClick={commands.goPlain}
        >
          {/* one of the two is display:none, depending on the width */}
          <span className="da64-title__plain-full">View the plain HTML version</span>
          <span className="da64-title__plain-short">Plain HTML version</span>
        </a>
      </div>

      <div className="da64-title__main">
        <h1 className="da64-logo" aria-label="Daniel Avila 64">
          {LOGO_WORDS.map((word) => (
            <span
              key={word.id}
              className={`da64-logo__word da64-logo__word--${word.id}`}
              aria-hidden="true"
            >
              {Array.from(word.text, (ch, i) => (
                <span key={i} className="da64-logo__ch" data-ch={ch}>
                  {ch}
                </span>
              ))}{" "}
            </span>
          ))}
        </h1>

        <p className="da64-title__role">
          <span>{ROLE_MAIN}</span>
          {ROLE_SUB && (
            <>
              {" "}
              <span className="da64-title__role-sep" aria-hidden="true">
                |
              </span>{" "}
              <span>{ROLE_SUB}</span>
            </>
          )}
        </p>

        <button
          id="da64-start"
          type="button"
          className="btn-retro btn-retro--gold da64-start"
          data-busy={starting || undefined}
          onClick={commands.pressStart}
        >
          <span className="da64-start__label">{starting ? "STARTING…" : "PRESS START"}</span>
        </button>

        {/* One fixed-height slot: the loading note, then the control hints. */}
        <div className="da64-title__slot">
          <p className="da64-title__status" role="status">
            {!engineReady && (
              <>
                <span className="da64-spinner" aria-hidden="true" />
                Loading the 3D lobby…
              </>
            )}
          </p>
          {engineReady &&
            (touch ? (
              <p className="da64-title__hints">
                Drag the stick to walk <span aria-hidden="true">·</span> tap a door or a painting
              </p>
            ) : (
              <p className="da64-title__hints">
                <kbd>WASD</kbd> or <kbd>arrows</kbd> walk <span aria-hidden="true">·</span>{" "}
                <kbd>Space</kbd> jumps <span aria-hidden="true">·</span> or just click a door
              </p>
            ))}
        </div>
      </div>

      <p className="da64-title__credit">
        Crafted by{" "}
        <a href={credits.builtBy.href} target="_blank" rel="noopener">
          {credits.builtBy.label}
        </a>
      </p>
    </div>
  );
}

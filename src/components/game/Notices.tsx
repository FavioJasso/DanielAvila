"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGameCommands } from "./commands";
import { CloseIcon } from "./icons";
import { PLAIN_HASH } from "./util";

/**
 * Shown at the very top of the plain page when the 3D version could not
 * start. It is portalled into a host element prepended to <body>, so it sits
 * in the normal flow above the plain page's (sticky) header instead of
 * floating over its navigation, wherever GameRoot itself is rendered.
 */
export function WebglNotice({ onDismiss }: { onDismiss(): void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-da64-notice", "");
    document.body.prepend(el);
    setHost(el);
    return () => el.remove();
  }, []);

  if (!host) return null;
  return createPortal(
    <div className="da64-notice" role="status">
      <p>
        <strong>Heads up:</strong> the 3D version of this site needs WebGL, which is not available in
        this browser, so here is the plain HTML version.
      </p>
      <button
        type="button"
        className="da64-notice__close"
        aria-label="Dismiss this notice"
        onClick={onDismiss}
      >
        <CloseIcon />
      </button>
    </div>,
    host,
  );
}

/** The browser dropped the WebGL context (tab in the background, GPU reset…). */
export function ContextLostNotice() {
  const commands = useGameCommands();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Everything behind the notice is inert, so bring keyboard focus to it.
  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="da64-lost">
      <div
        className="panel-retro da64-lost__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="da64-lost-title"
        aria-describedby="da64-lost-text"
      >
        <p id="da64-lost-title" className="text-chunky da64-lost__title">
          3D took a nap
        </p>
        <p id="da64-lost-text" className="da64-lost__text">
          Your browser paused the 3D view. Nothing is lost — reload it and carry on.
        </p>
        <button
          ref={buttonRef}
          type="button"
          className="btn-retro btn-retro--gold"
          onClick={commands.reload3d}
        >
          Reload the 3D view
        </button>
        <a className="da64-lost__plain" href={PLAIN_HASH} onClick={commands.goPlain}>
          or view the plain HTML version
        </a>
      </div>
    </div>
  );
}

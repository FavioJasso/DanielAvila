"use client";

import { useEffect } from "react";
import { StarIcon } from "@/components/shared/StarIcon";
import { ui, useUi } from "@/game/store";

const TOAST_MS = 3400;

/**
 * Short messages from the engine ("New star!"). Sits above the course
 * overlay because a star is earned at the moment an overlay opens. The
 * message is cleared in the store when it times out, so the engine can show
 * the same text again later.
 */
export function ToastLayer() {
  const toast = useUi((s) => s.toast);
  // Over a course overlay the toast hugs the top edge so it covers as little
  // of the reading area as possible; in the lobby it sits under the banner.
  const overOverlay = useUi((s) => s.overlay !== null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      if (ui.get().toast === toast) ui.set({ toast: null });
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div
      className="da64-toasts"
      data-over-overlay={overOverlay || undefined}
      role="status"
      aria-live="polite"
    >
      {toast && (
        <div key={toast} className="da64-toast">
          <StarIcon size={24} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

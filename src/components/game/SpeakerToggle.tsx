"use client";

import { useUi } from "@/game/store";
import { SpeakerIcon } from "./icons";
import { cx, releasePointerFocus, toggleMuted } from "./util";

/** The persistent speaker button (title screen and HUD, top-left). */
export function SpeakerToggle({ className }: { className?: string }) {
  const muted = useUi((s) => s.muted);
  return (
    <button
      type="button"
      className={cx("btn-retro btn-retro--ghost da64-iconbtn", className)}
      aria-label="Sound"
      aria-pressed={!muted}
      title={muted ? "Sound is off (M)" : "Sound is on (M)"}
      onClick={(e) => {
        toggleMuted();
        releasePointerFocus(e);
      }}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}

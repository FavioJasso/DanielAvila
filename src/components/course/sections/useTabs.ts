"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";

/**
 * State and ARIA wiring for a tab list with automatic activation (WAI-ARIA
 * tabs pattern): arrow keys move and select, Home / End jump to the ends,
 * and only the selected tab is in the Tab order (roving tabindex).
 */
export function useTabs<T extends string>(ids: readonly T[], initial?: string) {
  const baseId = useId();
  const [selected, setSelected] = useState<T>(
    () => ids.find((id) => id === initial) ?? ids[0],
  );
  const tabs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const index = ids.indexOf(selected);
      let next = -1;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          next = (index + 1) % ids.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (index - 1 + ids.length) % ids.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = ids.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      // Keep arrow keys away from anything else listening (the game engine).
      event.stopPropagation();
      setSelected(ids[next]);
      tabs.current.get(ids[next])?.focus();
    },
    [ids, selected],
  );

  const panelId = `${baseId}-panel`;
  const tabId = (id: T) => `${baseId}-tab-${id}`;

  return {
    selected,
    select: setSelected,
    /** Spread onto each tab `<button>`. */
    tabProps: (id: T) => ({
      role: "tab" as const,
      type: "button" as const,
      id: tabId(id),
      "aria-selected": id === selected,
      "aria-controls": panelId,
      tabIndex: id === selected ? 0 : -1,
      onKeyDown,
      ref: (el: HTMLButtonElement | null) => {
        if (el) tabs.current.set(id, el);
        else tabs.current.delete(id);
      },
    }),
    /** Spread onto the single panel that shows the selected tab's content. */
    panelProps: {
      role: "tabpanel" as const,
      id: panelId,
      "aria-labelledby": tabId(selected),
      tabIndex: 0,
    },
  };
}

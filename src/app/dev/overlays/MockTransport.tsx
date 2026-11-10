"use client";

/**
 * Dev-only stand-in for the contact form's EmailJS delivery, so harness
 * pages and scripted checks never send a real email. It records what would
 * have been sent on `window.__da64ContactLog` and resolves (or rejects with
 * `fail`) after a short delay.
 */
import { useMemo, type ReactNode } from "react";
import {
  ContactTransportContext,
  type ContactTransport,
} from "@/components/course/sections/ContactForm";

declare global {
  interface Window {
    __da64ContactLog?: Record<string, string>[];
  }
}

export function MockTransport({
  fail = false,
  review = false,
  children,
}: {
  /** Simulate a delivery failure. */
  fail?: boolean;
  /** Outline copy the content file marks `needsReview`. */
  review?: boolean;
  children: ReactNode;
}) {
  const transport = useMemo<ContactTransport>(
    () => (form) =>
      new Promise((resolve, reject) => {
        const entry: Record<string, string> = {};
        new FormData(form).forEach((value, key) => {
          entry[key] = String(value);
        });
        (window.__da64ContactLog ??= []).push(entry);
        console.info("[harness] contact form submitted (mock, nothing sent)", entry);
        window.setTimeout(() => (fail ? reject(new Error("mock failure")) : resolve(entry)), 500);
      }),
    [fail],
  );
  return (
    <ContactTransportContext.Provider value={transport}>
      <div className={review ? "cx-show-review" : undefined}>{children}</div>
    </ContactTransportContext.Provider>
  );
}

"use client";

import { createContext, useContext, useState, type FormEvent } from "react";
import { contactForm } from "@/content/portfolio";
import type { Variant } from "./types";

/** Delivers a submitted contact form. Resolves on success, rejects on failure. */
export type ContactTransport = (form: HTMLFormElement) => Promise<unknown>;

/** Real delivery: EmailJS, loaded on first submit so it stays out of first paint. */
const sendWithEmailJs: ContactTransport = async (form) => {
  const { sendForm } = await import("emailjs-com");
  return sendForm(contactForm.serviceId, contactForm.templateId, form, contactForm.publicKey);
};

/**
 * How the form is delivered. Defaults to EmailJS; the dev harnesses provide
 * a fake so scripted checks never send a real email.
 */
export const ContactTransportContext = createContext<ContactTransport>(sendWithEmailJs);

type Status = "idle" | "sending" | "sent" | "failed";

const STATUS_TEXT: Record<Status, string> = {
  idle: "",
  sending: "Sending…",
  sent: contactForm.success,
  failed: contactForm.failure,
};

/**
 * The working contact form: name, email and message with visible labels and
 * native validation. The result is announced inline in a live region.
 */
export function ContactForm({ variant = "overlay" }: { variant?: Variant }) {
  const transport = useContext(ContactTransportContext);
  const [status, setStatus] = useState<Status>("idle");
  const sending = status === "sending";
  const id = (field: string) => `cx-${variant}-contact-${field}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    setStatus("sending");
    try {
      await transport(form);
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <form className="cx-form" onSubmit={onSubmit} aria-busy={sending}>
      <div className="cx-field">
        <label htmlFor={id("name")}>Name</label>
        <input
          className="cx-input"
          id={id("name")}
          name={contactForm.fields.name}
          type="text"
          autoComplete="name"
          placeholder={contactForm.placeholders.name}
          required
        />
      </div>
      <div className="cx-field">
        <label htmlFor={id("email")}>Email address</label>
        <input
          className="cx-input"
          id={id("email")}
          name={contactForm.fields.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={contactForm.placeholders.email}
          required
        />
      </div>
      <div className="cx-field">
        <label htmlFor={id("message")}>Message</label>
        <textarea
          className="cx-input"
          id={id("message")}
          name={contactForm.fields.message}
          rows={5}
          placeholder={contactForm.placeholders.message}
          required
        />
      </div>
      <div className="cx-form__actions">
        <button type="submit" className="btn-retro btn-retro--gold" disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
        <p className="cx-form__status" role="status" aria-live="polite" data-state={status}>
          {STATUS_TEXT[status]}
        </p>
      </div>
    </form>
  );
}

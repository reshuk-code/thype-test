"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";

import { submitEnquiryAction } from "@/app/(frontend)/contact/actions";
import { IDLE } from "@/lib/actions/result";

function Labelled({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-label text-[0.8125rem] font-bold uppercase text-ink">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const field =
  "w-full border border-line bg-white px-4 py-3 font-body text-base text-ink placeholder:text-meta focus:border-bronze focus:outline-none aria-[invalid=true]:border-red-700";

/**
 * Name, email, message. Posts to the same rate-limited enquiry action as the
 * template's contact form, so messages land in Enquiries in the admin; the
 * travel-booking fields that form carries are left out.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitEnquiryAction, IDLE);
  const errors = state.fieldErrors ?? {};

  // Cleared only after a successful send, so a rejected one keeps every word.
  const [formKey, setFormKey] = useState(0);
  const [lastHandled, setLastHandled] = useState(IDLE);
  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.ok) setFormKey((value) => value + 1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} noValidate className="space-y-6">
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Labelled id="contact-name" label="Name" error={errors.name?.[0]}>
          <input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            className={field}
          />
        </Labelled>
        <Labelled id="contact-email" label="Email" error={errors.email?.[0]}>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            className={field}
          />
        </Labelled>
      </div>

      <Labelled id="contact-message" label="Message" error={errors.message?.[0]}>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={7}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={field}
        />
      </Labelled>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="h-12 bg-bronze-strong px-8 font-body text-sm text-white transition-colors hover:bg-ink disabled:opacity-70"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        <p role="status" className={state.ok ? "text-sm text-ink" : "text-sm text-red-700"}>
          {state.message && !(state.fieldErrors && Object.keys(state.fieldErrors).length) ? state.message : ""}
        </p>
      </div>
    </form>
  );
}

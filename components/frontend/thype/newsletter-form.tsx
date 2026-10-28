"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import { subscribeAction } from "@/app/(frontend)/newsletter/actions";
import { IDLE } from "@/lib/actions/result";

/**
 * The signup field. Submits through `onSubmit` rather than the form's
 * `action` prop, so a rejected address stays in the box (see CLAUDE.md,
 * "Form rules").
 */
export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [state, formAction, pending] = useActionState(subscribeAction, IDLE);
  const emailError = state.fieldErrors?.email?.[0];
  const done = state.ok && Boolean(state.message);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-[27rem]">
      <input type="hidden" name="source" value={source} />

      {/* Honeypot. Off-screen and hidden from assistive tech; see contact/actions.ts. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          aria-invalid={emailError ? true : undefined}
          aria-describedby="newsletter-status"
          className="h-[2.875rem] min-w-0 flex-1 border border-line bg-white px-5 font-body text-sm text-ink placeholder:text-meta focus:border-bronze focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-[2.875rem] shrink-0 bg-bronze-strong px-3 font-body text-sm text-white transition-colors hover:bg-ink disabled:opacity-70"
        >
          {pending ? "Sending…" : "Subscribe"}
        </button>
      </div>

      <p
        id="newsletter-status"
        role="status"
        className={done ? "mt-3 text-sm text-ink" : "mt-3 min-h-5 text-sm text-red-700"}
      >
        {done ? state.message : (emailError ?? (!state.ok ? state.message : ""))}
      </p>
    </form>
  );
}

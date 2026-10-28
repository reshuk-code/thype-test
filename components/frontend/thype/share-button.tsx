"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Share without a third-party script.
 *
 * Uses the device's own share sheet where there is one (phones), and copies
 * the link otherwise. No network request leaves the page, which keeps the
 * article free of tracking widgets.
 */
export function ShareButton({
  url,
  title,
  className,
  label = "Share",
  showLabel = false,
}: {
  /** Absolute, or site-relative (resolved against the current origin). */
  url: string;
  title: string;
  className?: string;
  label?: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const href = new URL(url, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({ title, url: href });
        return;
      } catch (error) {
        // Dismissing the sheet is not a failure worth a fallback.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions): nothing sensible to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex items-center gap-1.5 text-meta transition-colors hover:text-bronze-strong",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
      {showLabel ? (
        <span>
          {copied ? "Link copied" : label}
          <span className="sr-only">: {title}</span>
        </span>
      ) : (
        <span className="sr-only">{copied ? "Link copied" : `${label}: ${title}`}</span>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </button>
  );
}

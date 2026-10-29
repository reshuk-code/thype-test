"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  ArticleSkeleton,
  DestinationsSkeleton,
  ListingSkeleton,
} from "@/components/frontend/thype/skeletons";
import {
  AUTHORS_BASE_PATH,
  BLOG_BASE_PATH,
  CATEGORY_BASE_PATH,
  DESTINATIONS_BASE_PATH,
  SEARCH_PATH,
  TAG_BASE_PATH,
} from "@/config/site-paths";
import { NAVIGATION_END, NAVIGATION_START, SHOW_DELAY_MS } from "@/components/ui/top-loader";

/*
 * Shows a skeleton of the page being opened while a link navigation loads.
 *
 * Deliberately not route `loading.tsx` files. A loading boundary streams the
 * response, and a streamed response has already sent its 200 by the time the
 * page finds out the story does not exist: missing pages became soft 404s and
 * the 308 redirects left behind by renamed stories became client-side hops.
 * Showing the skeleton from the browser, during client navigation only, keeps
 * every server response exactly as it was.
 */

/** The skeleton for a path, or null to leave the current page up (home, CMS pages). */
function skeletonFor(path: string): ReactNode {
  const segments = path.split("/").filter(Boolean);
  const [base, slug] = [`/${segments[0] ?? ""}`, segments[1]];

  switch (base) {
    case BLOG_BASE_PATH:
      return slug ? <ArticleSkeleton /> : <ListingSkeleton />;
    case DESTINATIONS_BASE_PATH:
      return slug ? <ListingSkeleton cover eyebrow /> : <DestinationsSkeleton />;
    case CATEGORY_BASE_PATH:
    case TAG_BASE_PATH:
    case AUTHORS_BASE_PATH:
      return slug ? <ListingSkeleton eyebrow /> : null;
    case SEARCH_PATH:
      return <ListingSkeleton eyebrow />;
    default:
      return null;
  }
}

type Pending = { target: string; from: string };

/*
 * Keyed on the pathname alone. Reading the query string as well would need a
 * Suspense boundary around the whole page; a query-only change is caught by
 * NAVIGATION_END instead, which the bar fires when the query changes.
 */
export function RouteSkeleton({ children }: { children: ReactNode }) {
  const current = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);

  // The new page has rendered: drop the skeleton in the same render, so the
  // two never show together and nothing flashes in between.
  if (pending && pending.from !== current) setPending(null);

  useEffect(() => {
    let timer: number | undefined;

    function onStart(event: Event) {
      const target = (event as CustomEvent<string>).detail;
      window.clearTimeout(timer);
      if (!skeletonFor(target)) return;
      const from = current;
      // Same delay as the bar: a prefetched page arrives before either shows.
      timer = window.setTimeout(() => {
        setPending({ target, from });
        const main = document.getElementById("main-content");
        if (main && main.getBoundingClientRect().top < 0) main.scrollIntoView();
      }, SHOW_DELAY_MS);
    }

    function onEnd() {
      window.clearTimeout(timer);
      setPending(null);
    }

    window.addEventListener(NAVIGATION_START, onStart);
    window.addEventListener(NAVIGATION_END, onEnd);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NAVIGATION_START, onStart);
      window.removeEventListener(NAVIGATION_END, onEnd);
    };
  }, [current]);

  return (
    <>
      {pending ? skeletonFor(pending.target) : null}
      {/* Hidden, not unmounted: a navigation that fails brings the page back intact. */}
      <div className={pending ? "hidden" : "contents"}>{children}</div>
    </>
  );
}

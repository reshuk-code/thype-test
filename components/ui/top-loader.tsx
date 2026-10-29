"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/*
 * A thin progress bar across the top of the window while a client-side
 * navigation is in flight.
 *
 * The App Router exposes no "navigation started" event, so the start is read
 * from the click on an internal link and the end from the pathname or query
 * changing. Written by hand rather than pulled in as a package: it is this one
 * file, and the packages that do it patch `history` globally.
 *
 * The bar is driven through the DOM, not React state, so a navigation never
 * re-renders the layout it sits in.
 */

/** Below this, a navigation feels instant and a flash of bar is just noise. */
export const SHOW_DELAY_MS = 120;

/**
 * Fired on `window` when a link navigation starts (detail: the target path)
 * and when it ends or is given up on. Lets other UI, such as the public site's
 * skeletons, follow the same navigation without detecting it a second time.
 */
export const NAVIGATION_START = "toploader:start";
export const NAVIGATION_END = "toploader:end";
/** A navigation that fails or is cancelled never changes the URL; stop waiting. */
const GIVE_UP_MS = 15_000;

function createProgress(bar: HTMLDivElement) {
  let value = 0;
  let pending = false;
  let visible = false;
  let showTimer: number | undefined;
  let trickleTimer: number | undefined;
  let hideTimer: number | undefined;
  let giveUpTimer: number | undefined;

  const paint = () => {
    bar.style.transform = `scaleX(${value})`;
  };

  const clearTimers = () => {
    window.clearTimeout(showTimer);
    window.clearInterval(trickleTimer);
    window.clearTimeout(hideTimer);
    window.clearTimeout(giveUpTimer);
  };

  function done() {
    if (!pending) return;
    pending = false;
    clearTimers();
    window.dispatchEvent(new Event(NAVIGATION_END));
    if (!visible) return;
    value = 1;
    paint();
    hideTimer = window.setTimeout(() => {
      bar.style.opacity = "0";
      visible = false;
    }, 200);
  }

  // Eases towards 90% and never reaches it: the real end is the URL change.
  const trickle = () => {
    trickleTimer = window.setInterval(() => {
      value += (0.9 - value) * 0.08;
      paint();
    }, 200);
  };

  function start() {
    const wasVisible = visible && pending;
    clearTimers();
    pending = true;
    giveUpTimer = window.setTimeout(done, GIVE_UP_MS);

    // A second click mid-navigation carries on rather than snapping back.
    if (wasVisible) {
      trickle();
      return;
    }

    showTimer = window.setTimeout(() => {
      // Jump back to the start without animating the bar shrinking.
      bar.style.transition = "none";
      value = 0.1;
      paint();
      bar.style.opacity = "1";
      void bar.offsetWidth;
      bar.style.transition = "";
      visible = true;
      trickle();
    }, SHOW_DELAY_MS);
  }

  return { start, done, dispose: clearTimers };
}

/** `/blog` and `/blog/` are the same page here (trailingSlash is on). */
function samePage(url: URL): boolean {
  const strip = (path: string) => path.replace(/\/+$/, "") || "/";
  return (
    strip(url.pathname) === strip(window.location.pathname) &&
    url.search === window.location.search
  );
}

function TopLoaderBar({ className }: { className?: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<ReturnType<typeof createProgress> | null>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const progress = createProgress(bar);
    progressRef.current = progress;

    // Capture phase: next/link calls preventDefault on its own click, so a
    // bubbling listener could not tell a link navigation from a cancelled one.
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (samePage(url)) return;
      progress.start();
      window.dispatchEvent(new CustomEvent(NAVIGATION_START, { detail: url.pathname }));
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      progress.dispose();
      progressRef.current = null;
    };
  }, []);

  useEffect(() => {
    progressRef.current?.done();
  }, [pathname, search]);

  return (
    <div
      ref={barRef}
      aria-hidden
      style={{ transform: "scaleX(0)" }}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] origin-left opacity-0",
        "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        className,
      )}
    />
  );
}

/**
 * Mount once per layout. `className` sets the colour, e.g. `bg-bronze`.
 *
 * Wrapped in Suspense because reading the query string would otherwise opt
 * every statically rendered page under the layout out of prerendering.
 */
export function TopLoader({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <TopLoaderBar className={className} />
    </Suspense>
  );
}

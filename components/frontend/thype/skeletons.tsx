import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Loading placeholders for the public site, shown by `RouteSkeleton` while a
 * link navigation loads. Each one copies the spacing and grid of the page it stands in for, so
 * the real content lands where the placeholder was instead of shifting the
 * layout. When a page's layout changes, change its skeleton too.
 */

export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse bg-line motion-reduce:animate-none", className)} />;
}

/** Announces the wait once, for screen readers; the bones themselves are hidden. */
function Loading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

const PAGE = "mx-auto w-full max-w-[71.75rem] px-4 pb-16 pt-8 sm:px-6 xl:px-0";
const WITH_SIDEBAR = "grid gap-14 lg:grid-cols-[minmax(0,46rem)_22rem] lg:justify-between lg:gap-6";

function BreadcrumbsSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Bone className="h-3.5 w-12" />
      <Bone className="h-3.5 w-16" />
      <Bone className="h-3.5 w-24" />
    </div>
  );
}

function TextLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Bone key={index} className={cn("h-4", index === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div>
      <Bone className="aspect-[3/2] w-full" />
      <div className="px-1 pt-6 sm:px-4">
        <Bone className="h-6 w-11/12" />
        <Bone className="mt-2 h-6 w-2/3" />
        <Bone className="mt-4 h-4 w-28" />
        <TextLines lines={3} className="mt-5" />
      </div>
    </div>
  );
}

function LeadCardSkeleton() {
  return (
    <div>
      <Bone className="aspect-[736/488] w-full" />
      <Bone className="mt-5 h-8 w-4/5" />
      <Bone className="mt-3 h-4 w-32" />
      <TextLines lines={3} className="mt-6" />
    </div>
  );
}

function FeedSkeleton({ lead = true }: { lead?: boolean }) {
  return (
    <div>
      {lead ? <LeadCardSkeleton /> : null}
      <div className={cn("grid gap-x-14 gap-y-14 sm:grid-cols-2", lead && "mt-14")}>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-14">
      <div>
        <Bone className="h-4 w-32" />
        <div className="mt-6 grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Bone key={index} className="aspect-square w-full" />
          ))}
        </div>
      </div>
      <div>
        <Bone className="h-4 w-28" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={index} className="h-4 w-40" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Blog index, category, tag, author, destination and search listings. */
export function ListingSkeleton({ cover = false, eyebrow = false }: { cover?: boolean; eyebrow?: boolean }) {
  return (
    <Loading className={PAGE}>
      <BreadcrumbsSkeleton />
      {cover ? <Bone className="mt-8 aspect-[1148/420] w-full" /> : null}
      <div className="mt-8 max-w-3xl">
        {eyebrow ? <Bone className="mb-3 h-3 w-24" /> : null}
        <Bone className="h-10 w-2/3" />
        <Bone className="mt-5 h-5 w-full max-w-xl" />
      </div>
      <div className={cn("mt-12", WITH_SIDEBAR)}>
        <FeedSkeleton />
        <SidebarSkeleton />
      </div>
    </Loading>
  );
}

/** A story: centred headline and meta, wide photo, body beside the sidebar. */
export function ArticleSkeleton() {
  return (
    <Loading className={PAGE}>
      <BreadcrumbsSkeleton />
      <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center">
        <Bone className="h-10 w-full max-w-3xl" />
        <Bone className="mt-3 h-10 w-2/3" />
        <div className="mt-6 flex flex-wrap justify-center gap-x-12 gap-y-3">
          <Bone className="h-5 w-32" />
          <Bone className="h-5 w-28" />
          <Bone className="h-5 w-24" />
        </div>
      </div>
      <Bone className="mt-8 aspect-[1114/488] w-full" />
      <div className={cn("mt-8", WITH_SIDEBAR)}>
        <div className="space-y-8">
          <TextLines lines={5} />
          <Bone className="h-7 w-1/2" />
          <TextLines lines={6} />
          <TextLines lines={4} />
        </div>
        <SidebarSkeleton />
      </div>
    </Loading>
  );
}

/** The destinations index: a grid of photo tiles. */
export function DestinationsSkeleton() {
  return (
    <Loading className={PAGE}>
      <BreadcrumbsSkeleton />
      <div className="mt-8 max-w-3xl">
        <Bone className="h-10 w-1/2" />
        <Bone className="mt-5 h-5 w-full max-w-xl" />
      </div>
      <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[1.8rem]">
        {Array.from({ length: 8 }, (_, index) => (
          <Bone key={index} className="aspect-[257/224] w-full" />
        ))}
      </div>
    </Loading>
  );
}

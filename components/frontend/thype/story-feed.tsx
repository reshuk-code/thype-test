"use client";

import { useState, useTransition } from "react";

import {
  loadFeedPageAction,
  type FeedPageRequest,
} from "@/app/(frontend)/blog/feed-actions";
import { LeadPostCard, PostCard, type CardPost } from "@/components/frontend/thype/post-card";

/**
 * A lead story, a two-column grid, and "Load more".
 *
 * The first page arrives server-rendered. "Load more" is a real link to the
 * next page of the listing, so it works without JavaScript and is crawlable;
 * with JavaScript it appends the next page in place instead of navigating,
 * which is what the design's button implies.
 */
export function StoryFeed({
  initial,
  query,
  basePath,
  hasMore: initialHasMore,
  lead = true,
  priorityLead = false,
  startPage = 1,
}: {
  initial: CardPost[];
  /** Filters and page size; `page` is managed here. */
  query: Omit<FeedPageRequest, "page">;
  /** The listing's URL; the button links to its next `?page=`, which works without JavaScript. */
  basePath: string;
  hasMore: boolean;
  /** Render the first story as the wide lead card. */
  lead?: boolean;
  priorityLead?: boolean;
  /** The page `initial` is, when the reader arrived on ?page=N. */
  startPage?: number;
}) {
  const [posts, setPosts] = useState(initial);
  const [page, setPage] = useState(startPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const nextHref = `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page + 1}`;
  const [first, ...rest] = posts;
  const grid = lead ? rest : posts;

  function loadMore(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, new window) follow the real link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();

    startTransition(async () => {
      try {
        const next = await loadFeedPageAction({ ...query, page: page + 1 });
        const known = new Set(posts.map((post) => post.id));
        setPosts((current) => [...current, ...next.items.filter((post) => !known.has(post.id))]);
        setPage((current) => current + 1);
        setHasMore(next.hasMore);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div>
      {lead && first ? <LeadPostCard post={first} priority={priorityLead} /> : null}

      {grid.length > 0 ? (
        <ul className={lead ? "mt-14 grid gap-x-14 gap-y-14 sm:grid-cols-2" : "grid gap-x-14 gap-y-14 sm:grid-cols-2"}>
          {grid.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {page > startPage ? `${posts.length} stories shown` : ""}
      </div>

      {hasMore ? (
        <div className="mt-14 flex flex-col items-center gap-3">
          <a
            href={nextHref}
            onClick={loadMore}
            aria-disabled={pending || undefined}
            className="inline-flex h-11 items-center border border-bronze px-8 font-body text-sm tracking-wide text-bronze-strong transition-colors hover:bg-bronze-strong hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            {pending ? "Loading…" : "Load More"}
          </a>
          {failed ? (
            <p role="alert" className="text-sm text-red-700">
              Those stories did not load. Try again, or follow the link.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

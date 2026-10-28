import type { ReactNode } from "react";

import type { FeedPageRequest } from "@/app/(frontend)/blog/feed-actions";
import { Breadcrumbs, type Crumb } from "@/components/frontend/thype/breadcrumbs";
import { CoverImage } from "@/components/frontend/thype/cover-image";
import { Sidebar } from "@/components/frontend/thype/sidebar";
import { StoryFeed } from "@/components/frontend/thype/story-feed";
import { toCardPost } from "@/lib/blog/card";
import { cms } from "@/lib/cms";

/** Stories per listing page. The homepage feed defaults to the same number. */
export const LISTING_PER_PAGE = 7;

/**
 * A story listing: blog index, category, tag, destination, author, search.
 *
 * `page` comes from `?page=` and is what a reader without JavaScript (and a
 * crawler) gets from the "Load more" link; with JavaScript the button appends
 * pages in place instead. Page 1 leads with a wide story.
 */
export async function ListingPage({
  title,
  eyebrow,
  intro,
  crumbs,
  query,
  basePath,
  page,
  activeCategory,
  empty,
  cover,
  before,
}: {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  crumbs: Crumb[];
  query: Omit<FeedPageRequest, "page" | "perPage">;
  /** The listing's own URL, for the next-page link. */
  basePath: string;
  page: number;
  activeCategory?: string | null;
  /** Shown when nothing matches. */
  empty: ReactNode;
  /** A wide photo above the heading: destinations and authors. */
  cover?: { src: string; alt: string } | null;
  /** Rendered between the header and the feed, e.g. a destination's guide text. */
  before?: ReactNode;
}) {
  const [site, result] = await Promise.all([
    cms.settings.get(),
    cms.posts.getPublishedPage({ ...query, page, perPage: LISTING_PER_PAGE }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[71.75rem] px-4 pb-16 pt-8 sm:px-6 xl:px-0">
      <Breadcrumbs items={crumbs} siteUrl={site.siteUrl} />

      {cover && page === 1 ? (
        <CoverImage
          src={cover.src}
          alt={cover.alt}
          sizes="(min-width: 1148px) 1148px, 100vw"
          ratio="1148 / 420"
          priority
          className="mt-8"
        />
      ) : null}

      <header className="mt-8 max-w-3xl">
        {eyebrow ? (
          <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-bronze-strong">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 font-serif text-[2rem] font-bold leading-tight text-ink sm:text-[2.5rem]">
          {title}
          {result.page > 1 ? <span className="sr-only">, page {result.page}</span> : null}
        </h1>
        {intro ? <div className="mt-4 text-lg leading-relaxed text-body">{intro}</div> : null}
      </header>

      {before && page === 1 ? <div className="mt-10">{before}</div> : null}

      <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,46rem)_22rem] lg:justify-between lg:gap-6">
        <div className="min-w-0">
          {result.items.length === 0 ? (
            <div className="border border-dashed border-line px-6 py-16 text-center text-body">
              {empty}
            </div>
          ) : (
            <StoryFeed
              // Remount when the listing changes, so client state never mixes two lists.
              key={`${basePath}-${result.page}`}
              initial={result.items.map(toCardPost)}
              query={{ ...query, perPage: LISTING_PER_PAGE }}
              basePath={basePath}
              hasMore={result.page < result.totalPages}
              lead={result.page === 1}
              startPage={result.page}
              priorityLead
            />
          )}
        </div>
        <Sidebar activeCategory={activeCategory} />
      </div>
    </div>
  );
}

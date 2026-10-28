import Link from "next/link";

import { CoverImage } from "@/components/frontend/thype/cover-image";
import { CompactPostCard, OverlayPostCard } from "@/components/frontend/thype/post-card";
import { Sidebar } from "@/components/frontend/thype/sidebar";
import { StoryFeed } from "@/components/frontend/thype/story-feed";
import { blogIndexPath, categoryPath } from "@/config/site-paths";
import { toCardPost } from "@/lib/blog/card";
import { cms } from "@/lib/cms";
import { isSafeHref } from "@/lib/rich-text";
import type { Post } from "@/types/content";

/*
 * Renderers for the Thype blocks registered in lib/cms/blocks.ts. Async Server
 * Components: each reads published posts when the page renders, through the
 * per-request index in the posts repository, so several blocks on one page
 * still cost one database read.
 */

type Props = Record<string, unknown>;

const text = (props: Props, key: string) => (typeof props[key] === "string" ? (props[key] as string).trim() : "");
const count = (props: Props, key: string, fallback: number) => {
  const value = Number(props[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

/** Featured stories first, then the latest, without repeats. */
async function featuredThenLatest(limit: number): Promise<Post[]> {
  const featured = await cms.posts.getFeatured(limit);
  if (featured.length >= limit) return featured;
  const latest = await cms.posts.getPublishedPage({ perPage: limit + featured.length });
  const seen = new Set(featured.map((post) => post.id));
  return [...featured, ...latest.items.filter((post) => !seen.has(post.id))].slice(0, limit);
}

export async function StoryStripBlock(props: Props) {
  const limit = Math.min(4, count(props, "limit", 4));
  const posts =
    props.source === "latest"
      ? (await cms.posts.getPublishedPage({ perPage: limit })).items
      : await featuredThenLatest(limit);

  if (posts.length === 0) return null;
  const heading = text(props, "heading") || "Featured stories";

  return (
    <section aria-label={heading} className="px-1 pt-1">
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post, index) => (
          <li key={post.id}>
            {/* The first tile is the largest above-the-fold image: load it first. */}
            <OverlayPostCard post={toCardPost(post)} priority={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CollectionTilesBlock(props: Props) {
  const tiles = [1, 2, 3, 4]
    .map((n) => ({
      label: text(props, `tile${n}Label`),
      image: text(props, `tile${n}Image`),
      href: text(props, `tile${n}Href`),
    }))
    .filter((tile) => tile.label && tile.href && isSafeHref(tile.href));

  if (tiles.length === 0) return null;
  const heading = text(props, "heading") || "Collections";

  return (
    <section aria-label={heading} className="mx-auto w-full max-w-[71.75rem] px-4 pt-10 sm:px-6 xl:px-0">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[1.8rem]">
        {tiles.map((tile) => (
          <li key={`${tile.label}-${tile.href}`}>
            <Link href={tile.href} className="group relative block overflow-hidden">
              <CoverImage
                src={tile.image || null}
                alt=""
                sizes="(min-width: 1024px) 257px, 50vw"
                ratio="257 / 224"
                imageClassName="transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span aria-hidden className="pointer-events-none absolute inset-2.5 border border-white/80" />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0"
              />
              <span className="absolute bottom-6 left-8 font-serif text-[1.375rem] font-bold text-white">
                {tile.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function CategoryStripBlock(props: Props) {
  const category = text(props, "category");
  const limit = count(props, "limit", 3);
  const heading = text(props, "heading") || category;

  const { items } = await cms.posts.getPublishedPage({
    category: category || undefined,
    perPage: limit,
  });
  if (items.length === 0) return null;

  const headingId = `strip-${category || "latest"}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  return (
    <section aria-labelledby={heading ? headingId : undefined} className="mt-10 bg-sage">
      <div className="mx-auto w-full max-w-[71.75rem] px-4 py-10 sm:px-6 xl:px-0">
        {heading ? (
          <h2 id={headingId} className="text-center font-serif text-[1.75rem] font-bold text-ink">
            {category ? (
              <Link href={categoryPath(category)} className="hover:text-bronze-strong">
                {heading}
              </Link>
            ) : (
              heading
            )}
            <span aria-hidden className="mx-auto mt-3 block h-0.5 w-56 bg-ink" />
          </h2>
        ) : null}
        <ul className="mt-7 grid gap-8 md:grid-cols-3 md:gap-6 lg:px-6">
          {items.map((post) => (
            <li key={post.id}>
              <CompactPostCard post={toCardPost(post)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function StoryFeedBlock(props: Props) {
  const category = text(props, "category");
  const perPage = Math.min(15, count(props, "perPage", 7));
  const showSidebar = props.showSidebar !== false;
  const heading = text(props, "heading");

  const result = await cms.posts.getPublishedPage({
    category: category || undefined,
    perPage,
  });
  if (result.items.length === 0) return null;

  const base = category ? categoryPath(category) : blogIndexPath;

  const feed = (
    <div className="min-w-0">
      {heading ? (
        <h2 className="mb-8 font-serif text-[1.75rem] font-bold text-ink">{heading}</h2>
      ) : null}
      <StoryFeed
        initial={result.items.map(toCardPost)}
        query={{ perPage, category: category || undefined }}
        basePath={base}
        hasMore={result.totalPages > 1}
      />
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-[71.75rem] px-4 py-12 sm:px-6 xl:px-0">
      {showSidebar ? (
        <div className="grid gap-14 lg:grid-cols-[minmax(0,46rem)_22rem] lg:justify-between lg:gap-6">
          {feed}
          <Sidebar activeCategory={category || null} />
        </div>
      ) : (
        feed
      )}
    </section>
  );
}

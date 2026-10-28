import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CoverImage } from "@/components/frontend/thype/cover-image";
import { ShareButton } from "@/components/frontend/thype/share-button";
import { postPath } from "@/config/site-paths";
import { formatPublicDate } from "@/lib/blog/format";
import { cn } from "@/lib/utils";
import type { CardPost } from "@/lib/blog/card";

export type { CardPost } from "@/lib/blog/card";

/**
 * Card alt text.
 *
 * A card's image sits beside a linked headline that already names the story,
 * so repeating the headline as alt would make a screen reader say it twice.
 * The editor's description is used when there is one, because it says what
 * the photo shows rather than what the article is called.
 */
function cardAlt(post: CardPost): string {
  return post.featuredImageAlt ?? "";
}

function PostDate({ post, className }: { post: CardPost; className?: string }) {
  if (!post.publishedAt) return null;
  return (
    <time dateTime={post.publishedAt} className={className}>
      {formatPublicDate(post.publishedAt)}
    </time>
  );
}

/** "Read more" as the design draws it: small caps, underline, arrow. */
export function ReadMore({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="group/more inline-flex items-center gap-2 font-body text-[0.6875rem] uppercase tracking-[0.06em] text-meta transition-colors hover:text-bronze-strong"
    >
      <span className="underline decoration-1 underline-offset-[5px]">
        Read more<span className="sr-only">: {title}</span>
      </span>
      <ArrowRight
        className="size-3.5 transition-transform group-hover/more:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden
      />
    </Link>
  );
}

/**
 * The standard listing card: photo, headline, date and share, excerpt, read
 * more. Used in the home feed and "You may also like".
 */
export function PostCard({
  post,
  headingLevel = "h3",
  sizes = "(min-width: 1024px) 335px, (min-width: 640px) 45vw, 100vw",
}: {
  post: CardPost;
  headingLevel?: "h2" | "h3";
  sizes?: string;
}) {
  const href = postPath(post.slug);
  const Heading = headingLevel;

  return (
    <article className="group flex h-full flex-col">
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        <CoverImage
          src={post.featuredImage}
          alt={cardAlt(post)}
          sizes={sizes}
          ratio="3 / 2"
          imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-6 sm:px-4">
        <Heading className="font-serif text-[1.375rem] font-bold leading-[1.1] text-ink">
          <Link href={href} className="transition-colors hover:text-bronze-strong">
            {post.title}
          </Link>
        </Heading>

        <div className="mt-3 flex items-center gap-4 text-sm text-meta">
          <PostDate post={post} />
          <span aria-hidden className="h-5 w-px bg-line" />
          <ShareButton url={href} title={post.title} />
        </div>

        {post.excerpt ? (
          <p className="mt-5 line-clamp-4 font-body text-base leading-7 text-body">
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-auto pt-6">
          <ReadMore href={href} title={post.title} />
        </div>
      </div>
    </article>
  );
}

/** The wide first card in the home feed: full-width photo, larger headline. */
export function LeadPostCard({ post, priority = false }: { post: CardPost; priority?: boolean }) {
  const href = postPath(post.slug);

  return (
    <article className="group">
      <Link href={href} tabIndex={-1} aria-hidden className="block">
        <CoverImage
          src={post.featuredImage}
          alt={cardAlt(post)}
          sizes="(min-width: 1024px) 736px, 100vw"
          ratio="736 / 488"
          priority={priority}
          imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </Link>

      <h2 className="mt-5 font-serif text-[1.75rem] font-bold leading-tight text-ink sm:text-[2rem]">
        <Link href={href} className="transition-colors hover:text-bronze-strong">
          {post.title}
        </Link>
      </h2>

      <div className="mt-2 flex items-center gap-4 text-sm text-meta">
        <PostDate post={post} />
        <span aria-hidden className="h-5 w-px bg-line" />
        <ShareButton url={href} title={post.title} />
      </div>

      {post.excerpt ? (
        <p className="mt-6 font-body text-base leading-7 text-body">{post.excerpt}</p>
      ) : null}

      <div className="mt-6">
        <ReadMore href={href} title={post.title} />
      </div>
    </article>
  );
}

/**
 * A full-bleed photo with the headline laid over it: the homepage hero strip.
 * The gradient is what keeps white type legible over any photograph.
 */
export function OverlayPostCard({
  post,
  priority = false,
  headingLevel = "h2",
}: {
  post: CardPost;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <article className="group relative">
      <CoverImage
        src={post.featuredImage}
        alt={cardAlt(post)}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
        className="aspect-[4/5] sm:aspect-[475/606]"
        imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/0"
      />
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
        <Heading className="max-w-[22rem] font-serif text-[1.375rem] font-bold leading-[1.1] text-white">
          {/* The whole tile is the link target; the headline carries the name. */}
          <Link
            href={postPath(post.slug)}
            className="after:absolute after:inset-0 hover:underline hover:decoration-1 hover:underline-offset-4"
          >
            {post.title}
          </Link>
        </Heading>
        <PostDate post={post} className="mt-3 block text-sm text-white/85" />
      </div>
    </article>
  );
}

/** Thumbnail beside headline and date: the "Travel Guides" strip. */
export function CompactPostCard({ post, className }: { post: CardPost; className?: string }) {
  const href = postPath(post.slug);

  return (
    <article className={cn("group flex items-start gap-6", className)}>
      <Link href={href} tabIndex={-1} aria-hidden className="block w-[7.5rem] shrink-0">
        <CoverImage src={post.featuredImage} alt={cardAlt(post)} sizes="120px" ratio="120 / 91" />
      </Link>
      <div className="min-w-0 pt-2">
        <h3 className="font-serif text-[1.0625rem] font-bold leading-[1.15] text-ink">
          <Link href={href} className="transition-colors hover:text-bronze-strong">
            {post.title}
          </Link>
        </h3>
        <PostDate post={post} className="mt-2 block text-sm text-meta" />
      </div>
    </article>
  );
}

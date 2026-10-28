import Link from "next/link";
import type { ReactNode } from "react";

import { EnquiryForm } from "@/components/frontend/enquiry-form";
import { RichText } from "@/components/frontend/rich-text";
import {
  CategoryStripBlock,
  CollectionTilesBlock,
  StoryFeedBlock,
  StoryStripBlock,
} from "@/components/frontend/thype/blocks";
import { cms } from "@/lib/cms";
import { formatDate } from "@/lib/utils";

/**
 * Which component renders which block.
 *
 * Kept apart from the registry in `lib/cms/blocks.ts` on purpose: that module
 * is imported by the block editor, which runs in the browser, and several of
 * the components below are async Server Components that query the database.
 * Registering them together would pull the CMS SDK into the client bundle.
 *
 * A project adding a block registers its schema in `config/` (or wherever it
 * likes) and adds an entry here. Anything not in this map is skipped by the
 * renderer rather than crashing the page.
 */
export type BlockComponent = (props: Record<string, unknown>) => ReactNode;

/* --------------------------------------------------------------- helpers */

function text(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

function count(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = Number(props[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/** Section shell shared by the collection blocks. */
function Band({
  heading,
  children,
  muted = false,
}: {
  heading: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      className={
        muted ? "border-t border-border bg-surface" : "border-t border-border"
      }
    >
      <div className="mx-auto w-full max-w-5xl px-6 py-16">
        {heading ? (
          <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        ) : null}
        <div className={heading ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <p className="rounded-card border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
      No published {what} yet.
    </p>
  );
}

function CardImage({ url, ratio = "4/3" }: { url: string | null; ratio?: string }) {
  return (
    <div className="overflow-hidden rounded-card bg-muted shadow-[var(--shadow-card)] dark:border dark:border-border">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          style={{ aspectRatio: ratio }}
          className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div style={{ aspectRatio: ratio }} className="w-full" />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- blocks */

function RichTextBlock(props: Record<string, unknown>) {
  const content = text(props, "content");
  if (!content) return null;

  return (
    <div className="thype-prose mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <RichText content={content} />
    </div>
  );
}

function HeroBlock(props: Record<string, unknown>) {
  const heading = text(props, "heading");
  const subheading = text(props, "subheading");
  const image = text(props, "image");
  const ctaLabel = text(props, "ctaLabel");
  const ctaHref = text(props, "ctaHref");

  return (
    <section className="relative overflow-hidden border-b border-border">
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-background via-background/92 to-background/60"
          />
        </>
      ) : null}

      <div className="relative mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        <div className="max-w-2xl">
          {heading ? (
            <h2 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {heading}
            </h2>
          ) : null}
          {subheading ? (
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {subheading}
            </p>
          ) : null}
          {ctaLabel && ctaHref ? (
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ImageBlock(props: Record<string, unknown>) {
  const url = text(props, "url");
  if (!url) return null;

  const caption = text(props, "caption");

  return (
    <figure className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="overflow-hidden rounded-card bg-muted shadow-[var(--shadow-card)] dark:border dark:border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={text(props, "alt")}
          data-lightbox
          className="w-full object-cover"
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function GalleryBlock(props: Record<string, unknown>) {
  const images = Array.isArray(props.images)
    ? (props.images as unknown[]).filter((url): url is string => typeof url === "string")
    : [];

  if (images.length === 0) return null;

  return (
    <Band heading={text(props, "heading")}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((url) => (
          <li key={url} className="overflow-hidden rounded-card bg-muted shadow-[var(--shadow-card)] dark:border dark:border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              data-lightbox
              className="aspect-[4/3] w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </Band>
  );
}

function CtaBlock(props: Record<string, unknown>) {
  const heading = text(props, "heading");
  const body = text(props, "text");
  const label = text(props, "buttonLabel");
  const href = text(props, "buttonHref");

  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        {heading ? (
          <h2 className="text-3xl font-semibold tracking-tight">{heading}</h2>
        ) : null}
        {body ? (
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
            {body}
          </p>
        ) : null}
        {label && href ? (
          <Link
            href={href}
            className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            {label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

async function DestinationGridBlock(props: Record<string, unknown>) {
  const items = await cms.destinations.getPublished({
    perPage: count(props, "limit", 6),
    featured: props.featuredOnly ? true : undefined,
  });

  return (
    <Band heading={text(props, "heading")}>
      {items.length === 0 ? (
        <Empty what="destinations" />
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="group">
              <Link href={`/destinations/${item.slug}`} className="block">
                <CardImage url={item.featuredImage} />
                <h3 className="mt-4 text-lg font-semibold tracking-tight group-hover:underline underline-offset-4">
                  {item.name}
                </h3>
                {item.shortDescription ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {item.shortDescription}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

async function TourGridBlock(props: Record<string, unknown>) {
  const items = await cms.tours.getPublished({
    perPage: count(props, "limit", 6),
    featured: props.featuredOnly ? true : undefined,
  });

  return (
    <Band heading={text(props, "heading")} muted>
      {items.length === 0 ? (
        <Empty what="trips" />
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tour) => (
            <li key={tour.id} className="group">
              <Link href={`/tours/${tour.slug}`} className="block">
                <CardImage url={tour.featuredImage} />
                <h3 className="mt-4 text-lg font-semibold tracking-tight group-hover:underline underline-offset-4">
                  {tour.name}
                </h3>
                {tour.price !== null ? (
                  <p className="mt-2 text-sm font-semibold">
                    {tour.currency} {tour.price.toLocaleString()}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

async function ActivityGridBlock(props: Record<string, unknown>) {
  const items = await cms.activities.getPublished({
    perPage: count(props, "limit", 8),
  });

  return (
    <Band heading={text(props, "heading")}>
      {items.length === 0 ? (
        <Empty what="activities" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((activity) => (
            <li key={activity.id}>
              <Link
                href={`/activities/${activity.slug}`}
                className="block rounded-card bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg dark:border dark:border-border"
              >
                <span className="font-medium">{activity.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

async function BlogGridBlock(props: Record<string, unknown>) {
  const category = text(props, "category");
  const items = await cms.posts.getPublished({
    perPage: count(props, "limit", 3),
    category: category || undefined,
  });

  return (
    <Band heading={text(props, "heading")} muted>
      {items.length === 0 ? (
        <Empty what="posts" />
      ) : (
        <ul className="grid gap-8 sm:grid-cols-3">
          {items.map((post) => (
            <li key={post.id} className="group">
              <Link href={`/blog/${post.slug}`} className="block">
                <CardImage url={post.featuredImage} ratio="16/10" />
                <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                  {[post.category, post.publishedAt ? formatDate(post.publishedAt) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h3 className="mt-1.5 font-semibold leading-snug tracking-tight group-hover:underline underline-offset-4">
                  {post.title}
                </h3>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

async function TestimonialsBlock(props: Record<string, unknown>) {
  const items = await cms.testimonials.getPublished({
    perPage: count(props, "limit", 3),
    featured: props.featuredOnly ? true : undefined,
  });

  return (
    <Band heading={text(props, "heading")}>
      {items.length === 0 ? (
        <Empty what="testimonials" />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((review) => (
            <li key={review.id} className="rounded-card bg-card p-6 shadow-[var(--shadow-card)] dark:border dark:border-border">
              <p className="text-amber-500" aria-label={`${review.rating} out of 5`}>
                {"★".repeat(review.rating)}
                <span className="text-muted-foreground/40">
                  {"★".repeat(5 - review.rating)}
                </span>
              </p>
              <blockquote className="mt-4 text-sm leading-relaxed">
                “{review.message}”
              </blockquote>
              <p className="mt-4 border-t border-border pt-4 text-sm font-medium">
                {review.name}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

async function FaqBlock(props: Record<string, unknown>) {
  const category = text(props, "category");
  const items = await cms.faqs.getPublished({
    perPage: count(props, "limit", 6),
    category: category || undefined,
  });

  return (
    <Band heading={text(props, "heading")} muted>
      {items.length === 0 ? (
        <Empty what="questions" />
      ) : (
        <dl className="mx-auto max-w-3xl divide-y divide-border border-y border-border">
          {items.map((faq) => (
            <details key={faq.id} className="group py-4">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-medium marker:content-['']">
                <dt>{faq.question}</dt>
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <dd className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </dd>
            </details>
          ))}
        </dl>
      )}
    </Band>
  );
}

async function ContactFormBlock(props: Record<string, unknown>) {
  const tours = await cms.tours.getPublished();

  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        {text(props, "heading") ? (
          <h2 className="text-2xl font-semibold tracking-tight">
            {text(props, "heading")}
          </h2>
        ) : null}
        {text(props, "text") ? (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {text(props, "text")}
          </p>
        ) : null}

        <div className="mt-8">
          <EnquiryForm tours={tours.map(({ id, name }) => ({ id, name }))} />
        </div>
      </div>
    </section>
  );
}

export const BLOCK_COMPONENTS: Record<string, BlockComponent> = {
  "rich-text": RichTextBlock,
  hero: HeroBlock,
  image: ImageBlock,
  gallery: GalleryBlock,
  cta: CtaBlock,
  "destination-grid": DestinationGridBlock as BlockComponent,
  "tour-grid": TourGridBlock as BlockComponent,
  "activity-grid": ActivityGridBlock as BlockComponent,
  "blog-grid": BlogGridBlock as BlockComponent,
  testimonials: TestimonialsBlock as BlockComponent,
  faq: FaqBlock as BlockComponent,
  "contact-form": ContactFormBlock as BlockComponent,
  // Thype editorial sections. See components/frontend/thype/blocks.tsx.
  "story-strip": StoryStripBlock as BlockComponent,
  "collection-tiles": CollectionTilesBlock,
  "category-strip": CategoryStripBlock as BlockComponent,
  "story-feed": StoryFeedBlock as BlockComponent,
};

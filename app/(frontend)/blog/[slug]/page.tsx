import { CalendarDays, Tag, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { PreviewBanner } from "@/components/frontend/preview-banner";
import { RichText } from "@/components/frontend/rich-text";
import { Breadcrumbs } from "@/components/frontend/thype/breadcrumbs";
import { CoverImage } from "@/components/frontend/thype/cover-image";
import { JsonLd } from "@/components/frontend/thype/json-ld";
import { PostCard, ReadMore } from "@/components/frontend/thype/post-card";
import { ShareButton } from "@/components/frontend/thype/share-button";
import { Sidebar } from "@/components/frontend/thype/sidebar";
import { TableOfContents } from "@/components/frontend/thype/table-of-contents";
import {
  authorPath,
  BLOG_BASE_PATH,
  blogIndexPath,
  categoryPath,
  destinationPath,
  postPath,
  tagPath,
} from "@/config/site-paths";
import { toCardPost } from "@/lib/blog/card";
import { formatPublicDate } from "@/lib/blog/format";
import { cms } from "@/lib/cms";
import { richDocToPlainText, toRichDoc } from "@/lib/rich-text";
import { buildToc } from "@/lib/rich-text-anchors";
import { generateCmsMetadata } from "@/lib/seo/metadata";
import { blogPostingJsonLd } from "@/lib/seo/structured-data";
import type { Post } from "@/types/content";

/**
 * One story.
 *
 * Honours draft mode, which the admin's session-gated Preview route switches
 * on: with it, drafts and scheduled posts render with a banner and a noindex.
 * Without it, only publicly visible posts resolve — enforced in the
 * repository, not here.
 */
export const revalidate = 300;

/** Fewer headings than this and a table of contents is just noise. */
const TOC_MIN_HEADINGS = 3;

type Props = { params: Promise<{ slug: string }> };

async function resolve(slug: string): Promise<{ post: Post | null; previewing: boolean }> {
  const { isEnabled } = await draftMode();
  const post = isEnabled
    ? await cms.posts.getBySlugIncludingDrafts(slug)
    : await cms.posts.getBySlug(slug);
  return { post, previewing: isEnabled };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { post, previewing } = await resolve(slug);
  if (!post) return { title: "Not found", robots: { index: false } };

  const metadata = await generateCmsMetadata({
    title: post.title,
    path: `${BLOG_BASE_PATH}/${post.slug}`,
    description: post.excerpt,
    image: post.featuredImage,
    seo: previewing ? { ...post.seo, robots: "noindex" } : post.seo,
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      section: post.category ?? undefined,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const { post, previewing } = await resolve(slug);

  if (!post) {
    // A renamed story leaves a redirect behind (see the blog save action).
    // Checked only after the lookup fails, so a rule can never shadow a post.
    const rule = await cms.redirects.match(`${BLOG_BASE_PATH}/${slug}`);
    if (rule) permanentRedirect(rule.destination);
    notFound();
  }

  const doc = toRichDoc(post.content);
  const toc = buildToc(doc);
  const showToc = (post.showToc ?? true) && toc.length >= TOC_MIN_HEADINGS;

  const [site, author, related, destinations] = await Promise.all([
    cms.settings.get(),
    post.authorProfileId
      ? cms.authors.getPublishedByIds([post.authorProfileId]).then((map) => map.get(post.authorProfileId ?? "") ?? null)
      : null,
    cms.posts.getRelated(post, 3),
    cms.destinations.getPublishedByIds(post.destinationIds ?? []),
  ]);

  const href = postPath(post.slug);
  const byline = author?.name ?? post.authorName;
  const wordCount = richDocToPlainText(doc).split(/\s+/).filter(Boolean).length;

  return (
    <>
      {previewing && post.status !== "published" ? (
        <PreviewBanner status={post.status} path={href} />
      ) : null}

      <JsonLd
        data={blogPostingJsonLd({
          url: href,
          headline: post.title,
          description: post.excerpt,
          image: post.seo.ogImage ?? post.featuredImage,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: byline,
          authorUrl: author ? authorPath(author.slug) : null,
          section: post.category,
          keywords: post.tags,
          wordCount,
          siteName: site.siteName,
          siteUrl: site.siteUrl,
        })}
      />

      <article className="mx-auto w-full max-w-[71.75rem] px-4 pb-16 pt-8 sm:px-6 xl:px-0">
        <Breadcrumbs
          siteUrl={site.siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: blogIndexPath },
            ...(post.category
              ? [{ label: post.category, href: categoryPath(post.category) }]
              : [{ label: post.title }]),
          ]}
        />

        <header className="mx-auto mt-8 max-w-4xl text-center">
          <h1 className="font-serif text-[2rem] font-bold leading-[1.15] text-ink sm:text-[2.5rem]">
            {post.title}
          </h1>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-base text-meta">
            {post.publishedAt ? (
              <li className="flex items-center gap-2.5">
                <CalendarDays aria-hidden className="size-5" />
                <span className="sr-only">Published</span>
                <time dateTime={post.publishedAt}>{formatPublicDate(post.publishedAt)}</time>
              </li>
            ) : null}
            {byline ? (
              <li className="flex items-center gap-2.5">
                <UserRound aria-hidden className="size-5" />
                <span>
                  By{" "}
                  {author ? (
                    <Link href={authorPath(author.slug)} rel="author" className="hover:text-bronze-strong hover:underline">
                      {byline}
                    </Link>
                  ) : (
                    byline
                  )}
                </span>
              </li>
            ) : null}
            {post.category ? (
              <li className="flex items-center gap-2.5">
                <Tag aria-hidden className="size-5" />
                <span className="sr-only">Category</span>
                <Link href={categoryPath(post.category)} className="hover:text-bronze-strong hover:underline">
                  {post.category}
                </Link>
              </li>
            ) : null}
            {post.readingMinutes ? <li>{post.readingMinutes} min read</li> : null}
          </ul>
        </header>

        {post.featuredImage ? (
          <figure className="mt-8">
            <CoverImage
              src={post.featuredImage}
              alt={post.featuredImageAlt ?? ""}
              sizes="(min-width: 1148px) 1114px, 100vw"
              ratio="1114 / 488"
              priority
            />
            {post.featuredImageCaption || post.featuredImageCredit ? (
              <figcaption className="mt-2 text-sm text-meta">
                {post.featuredImageCaption}
                {post.featuredImageCaption && post.featuredImageCredit ? " · " : null}
                {post.featuredImageCredit ? <span>Photo: {post.featuredImageCredit}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <div className="mt-8 grid gap-14 lg:grid-cols-[minmax(0,45.75rem)_22rem] lg:justify-between lg:gap-6">
          <div className="min-w-0">
            {showToc ? (
              <div className="mb-8">
                <TableOfContents entries={toc} />
              </div>
            ) : null}

            <div className="thype-prose">
              <RichText content={post.content} />
            </div>

            {post.tags.length > 0 || destinations.length > 0 ? (
              <div className="mt-10 space-y-4 border-t border-line pt-6 text-sm">
                {destinations.length > 0 ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-label font-bold uppercase text-ink">Places</span>
                    {destinations.map((place) => (
                      <Link
                        key={place.id}
                        href={destinationPath(place.slug)}
                        className="border border-line px-3 py-1 text-body transition-colors hover:border-bronze hover:text-bronze-strong"
                      >
                        {place.name}
                      </Link>
                    ))}
                  </p>
                ) : null}
                {post.tags.length > 0 ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-label font-bold uppercase text-ink">Tags</span>
                    {post.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={tagPath(tag)}
                        className="border border-line px-3 py-1 text-body transition-colors hover:border-bronze hover:text-bronze-strong"
                      >
                        {tag}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <ShareButton url={href} title={post.title} label="Share this story" showLabel className="text-sm" />
            </div>

            {author ? (
              <section aria-labelledby="about-author" className="mt-10 flex gap-5 sm:gap-6">
                {author.avatar ? (
                  <CoverImage
                    src={author.avatar}
                    alt=""
                    sizes="100px"
                    ratio="1 / 1"
                    className="size-20 shrink-0 rounded-full sm:size-[6.25rem]"
                  />
                ) : null}
                <div className="min-w-0 max-w-md">
                  <p className="text-base text-body">About the Author</p>
                  <h2 id="about-author" className="mt-1 font-serif text-[1.375rem] font-bold text-ink">
                    {author.name}
                  </h2>
                  {author.bio ? (
                    <p className="mt-1 line-clamp-2 text-base leading-7 text-body">{author.bio}</p>
                  ) : null}
                  <div className="mt-2">
                    <ReadMore href={authorPath(author.slug)} title={`More about ${author.name}`} />
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <Sidebar activeCategory={post.category} />
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-14">
            <h2 id="related-heading" className="font-serif text-[1.375rem] font-bold text-ink">
              You May Also Like
            </h2>
            <ul className="mt-6 grid gap-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-14">
              {related.map((other) => (
                <li key={other.id}>
                  <PostCard post={toCardPost(other)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </>
  );
}

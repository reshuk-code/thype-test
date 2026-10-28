import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CoverImage } from "@/components/frontend/thype/cover-image";
import { JsonLd } from "@/components/frontend/thype/json-ld";
import { ListingPage } from "@/components/frontend/thype/listing-page";
import { AUTHORS_BASE_PATH, authorPath, blogIndexPath } from "@/config/site-paths";
import { cms } from "@/lib/cms";
import { listingMetadata } from "@/lib/seo/listing";
import { absoluteUrl } from "@/lib/seo/structured-data";
import { publicListParamsSchema } from "@/schemas/post";
import { AUTHOR_LINK_KEYS, type AuthorLinkKey } from "@/types/content";

/**
 * An author's profile and their stories.
 *
 * Reads `cms.authors.getBySlug`, which returns the public projection only: the
 * linked CMS account never reaches this page. Unpublished profiles are a 404;
 * their stories still credit them by name.
 */
export const revalidate = 300;

const LINK_LABELS: Record<AuthorLinkKey, string> = {
  website: "Website",
  instagram: "Instagram",
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolve({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return {
    author: await cms.authors.getBySlug(slug),
    page: publicListParamsSchema.parse(query).page,
  };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { author, page } = await resolve(props);
  if (!author) return { title: "Not found", robots: { index: false } };

  return listingMetadata({
    title: author.name,
    path: `${AUTHORS_BASE_PATH}/${author.slug}`,
    description: author.bio ?? `Stories by ${author.name}.`,
    image: author.avatar,
    page,
    managed: null,
  });
}

export default async function AuthorPage(props: Props) {
  const { author, page } = await resolve(props);
  if (!author) notFound();

  const site = await cms.settings.get();
  const links = AUTHOR_LINK_KEYS.flatMap((key) => {
    const href = author.links?.[key];
    return href ? [{ key, href }] : [];
  });

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            name: author.name,
            ...(author.jobTitle ? { jobTitle: author.jobTitle } : {}),
            ...(author.bio ? { description: author.bio } : {}),
            ...(author.avatar ? { image: absoluteUrl(author.avatar, site.siteUrl) } : {}),
            url: absoluteUrl(authorPath(author.slug), site.siteUrl),
            ...(links.length ? { sameAs: links.map((link) => link.href) } : {}),
          },
        }}
      />
      <ListingPage
        eyebrow={author.jobTitle ?? "Author"}
        title={author.name}
        intro={
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {author.avatar ? (
              <CoverImage
                src={author.avatar}
                alt={`Portrait of ${author.name}`}
                sizes="100px"
                ratio="1 / 1"
                className="size-[6.25rem] shrink-0 rounded-full"
              />
            ) : null}
            <div>
              {author.bio ? <p className="whitespace-pre-line">{author.bio}</p> : null}
              {links.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {links.map((link) => (
                    <li key={link.key}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer me"
                        className="text-bronze-strong underline underline-offset-4 hover:text-ink"
                      >
                        {LINK_LABELS[link.key]}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        }
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Blog", href: blogIndexPath },
          { label: author.name },
        ]}
        query={{ authorProfileId: author.id }}
        basePath={authorPath(author.slug)}
        page={page}
        empty={`${author.name} has no published stories yet.`}
      />
    </>
  );
}

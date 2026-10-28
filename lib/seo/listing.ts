import "server-only";

import type { Metadata } from "next";

import { cms } from "@/lib/cms";
import { generateCmsMetadata } from "@/lib/seo/metadata";
import type { CmsPage } from "@/types/page";

/**
 * Metadata for a listing page (category, tag, destination, author, index).
 *
 * - An editor can manage a listing's title, intro and SEO by creating a CMS
 *   page with the same slug (e.g. `/category/europe`): the same pattern as
 *   `cmsMetadata: true` routes. That page is never rendered on its own; the
 *   hand-written route shadows it.
 * - Page 2+ is its own canonical (`?page=2`) and says so in the title, rather
 *   than pointing at page 1, which would ask search engines to drop the
 *   stories that only appear deeper in the list.
 */
export async function listingMetadata(input: {
  title: string;
  /** Path without a trailing slash, e.g. "/category/europe". */
  path: string;
  description?: string | null;
  image?: string | null;
  page: number;
  managed?: CmsPage | null;
  noindex?: boolean;
}): Promise<Metadata> {
  const managed = input.managed;
  const metadata = await generateCmsMetadata({
    title: managed?.title ?? input.title,
    path: input.path,
    description: managed?.excerpt ?? input.description ?? null,
    image: managed?.featuredImage ?? input.image ?? null,
    seo: input.noindex
      ? { ...(managed?.seo ?? {}), robots: "noindex" }
      : (managed?.seo ?? null),
  });

  if (input.page <= 1) return metadata;

  const site = await cms.settings.get();
  const origin = site.siteUrl.replace(/\/+$/, "");
  const canonical = `${origin}${input.path}/?page=${input.page}`;
  const title = `${typeof metadata.title === "string" ? metadata.title : input.title} (page ${input.page})`;

  return {
    ...metadata,
    title,
    alternates: { ...metadata.alternates, canonical },
    openGraph: { ...metadata.openGraph, url: canonical, title },
  };
}

/** The CMS page an editor may create to manage a listing's metadata and intro. */
export async function managedListingPage(path: string): Promise<CmsPage | null> {
  return cms.pages.getBySlug(path);
}

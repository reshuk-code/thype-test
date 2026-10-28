import type { MetadataRoute } from "next";

import developerRoutes from "@/config/routes";
import {
  authorPath,
  categoryPath,
  destinationPath,
  postPath,
  SEARCH_PATH,
  tagPath,
} from "@/config/site-paths";
import { cms } from "@/lib/cms";
import { getCmsConfig } from "@/lib/cms/config";

/**
 * Sitemap: declared routes, CMS pages, and every published, indexable story,
 * destination, author, category and tag.
 *
 * Only what the public can see goes in: every list below comes from a
 * repository method that already excludes drafts, scheduled-but-not-due and
 * archived records, and anything an editor marked noindex is dropped here.
 * Regenerated hourly, and on demand whenever the admin revalidates the site.
 */
export const revalidate = 3600;

/** Declared routes that exist but must not be indexed. */
const NOT_INDEXED = new Set([SEARCH_PATH]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = getCmsConfig();
  if (!config.frontend.sitemap) return [];

  const [site, pages, firstPage, destinations, authors, categories, tags] = await Promise.all([
    cms.settings.get(),
    cms.pages.getPublished(),
    cms.posts.getPublishedPage({ perPage: 1 }),
    cms.destinations.getPublished(),
    cms.authors.getPublished(),
    cms.posts.publishedCategories(),
    cms.posts.publishedTags(),
  ]);

  const origin = (site.siteUrl || config.siteUrl).replace(/\/+$/, "");
  const url = (path: string) => `${origin}${path === "/" ? "/" : path.endsWith("/") ? path : `${path}/`}`;

  // Every published post, through the same per-request index the listings
  // use; total is the whole published set, so one call with that page size.
  const posts = firstPage.total > 0
    ? (await cms.posts.getPublishedPage({ perPage: Math.max(1, firstPage.total) })).items
    : [];

  const cmsSlugs = new Set(pages.map((page) => page.slug));

  const entries: MetadataRoute.Sitemap = [
    ...developerRoutes
      .filter((route) => !route.path.includes(":") && !cmsSlugs.has(route.path) && !NOT_INDEXED.has(route.path))
      .map((route) => ({ url: url(route.path) })),
    ...pages
      .filter((page) => page.seo.robots !== "noindex")
      .map((page) => ({ url: url(page.slug), lastModified: page.updatedAt })),
    ...posts
      .filter((post) => post.seo.robots !== "noindex")
      .map((post) => ({
        url: url(postPath(post.slug)),
        lastModified: post.updatedAt,
        ...(post.featuredImage
          ? { images: [post.featuredImage.startsWith("/") ? `${origin}${post.featuredImage}` : post.featuredImage] }
          : {}),
      })),
    ...destinations
      .filter((place) => place.seo.robots !== "noindex")
      .map((place) => ({ url: url(destinationPath(place.slug)), lastModified: place.updatedAt })),
    ...authors
      .filter((author) => author.seo.robots !== "noindex")
      .map((author) => ({ url: url(authorPath(author.slug)), lastModified: author.updatedAt })),
    ...categories.map(({ name }) => ({ url: url(categoryPath(name)) })),
    ...tags.map(({ name }) => ({ url: url(tagPath(name)) })),
  ];

  // A CMS page that manages a listing's metadata shares that listing's URL.
  const seen = new Set<string>();
  return entries.filter((entry) => (seen.has(entry.url) ? false : (seen.add(entry.url), true)));
}

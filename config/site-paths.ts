import { termSlug } from "@/lib/blog/taxonomy";

/**
 * Where this project mounts each content type.
 *
 * The CMS stores bare slugs and deliberately has no opinion on URLs (see
 * CLAUDE.md, "Slugs"). This file is the project's opinion, written down once,
 * so the public routes, the sitemap, admin preview links and the redirects
 * recorded when a slug changes cannot drift apart. Changing a base path here
 * also needs the matching folder under `app/(frontend)/` renamed.
 */
export const BLOG_BASE_PATH = "/blog";
export const DESTINATIONS_BASE_PATH = "/destinations";
export const AUTHORS_BASE_PATH = "/authors";
export const CATEGORY_BASE_PATH = "/category";
export const TAG_BASE_PATH = "/tag";
export const SEARCH_PATH = "/search";

/*
 * Hrefs end in a slash because `next.config.ts` sets `trailingSlash: true`;
 * linking without it costs every click a 308 hop. Redirect sources and SEO
 * paths use the base constants above, which the CMS normalises either way.
 */
const page = (path: string) => (path.endsWith("/") ? path : `${path}/`);

export const postPath = (slug: string) => page(`${BLOG_BASE_PATH}/${slug}`);
export const destinationPath = (slug: string) => page(`${DESTINATIONS_BASE_PATH}/${slug}`);
export const authorPath = (slug: string) => page(`${AUTHORS_BASE_PATH}/${slug}`);
export const categoryPath = (name: string) => page(`${CATEGORY_BASE_PATH}/${termSlug(name)}`);
export const tagPath = (name: string) => page(`${TAG_BASE_PATH}/${termSlug(name)}`);
export const blogIndexPath = page(BLOG_BASE_PATH);
export const destinationsIndexPath = page(DESTINATIONS_BASE_PATH);
export const searchPath = page(SEARCH_PATH);

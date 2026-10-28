import { slugify } from "@/schemas/common";

/**
 * URL slugs for categories and tags.
 *
 * Categories and tags are plain strings on a post (see the note on the posts
 * repository), so they have no stored slug. One is derived here, and a slug
 * from a URL is resolved back by searching the names in use — never by
 * un-slugifying, which cannot recover "Food & Drink" from "food-drink".
 */
export function termSlug(name: string): string {
  return slugify(name);
}

/**
 * The name whose slug matches, or null.
 *
 * Two names that slugify alike ("Food & Drink", "Food Drink") share a URL; the
 * first in the list wins. Editors are expected to keep one spelling.
 */
export function findTermBySlug(names: Iterable<string>, slug: string): string | null {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;

  for (const name of names) {
    if (termSlug(name) === wanted) return name;
  }
  return null;
}

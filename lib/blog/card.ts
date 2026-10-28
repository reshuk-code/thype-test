import type { Post } from "@/types/content";

/** What a story card shows. See `toCardPost`. */
export type CardPost = Pick<
  Post,
  "id" | "title" | "slug" | "excerpt" | "featuredImage" | "featuredImageAlt" | "publishedAt"
>;

/**
 * Narrows a post to card fields before it crosses to a Client Component.
 *
 * Anything passed to a client component is serialised into the page, so a
 * whole post would ship its body, SEO block and internal ids to every reader
 * of a listing. Cards need seven fields; they get seven.
 */
export function toCardPost(post: Post | CardPost): CardPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featuredImage: post.featuredImage,
    featuredImageAlt: post.featuredImageAlt ?? null,
    publishedAt: post.publishedAt,
  };
}

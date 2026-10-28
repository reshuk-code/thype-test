"use server";

import { z } from "zod";

import { toCardPost, type CardPost } from "@/lib/blog/card";
import { cms } from "@/lib/cms";

const pageRequestSchema = z.object({
  page: z.number().int().min(2).max(1000),
  perPage: z.number().int().min(1).max(24),
  category: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(120).optional(),
  destinationId: z.string().trim().max(64).optional(),
  authorProfileId: z.string().trim().max(64).optional(),
  search: z.string().trim().max(100).optional(),
});

export type FeedPageRequest = z.input<typeof pageRequestSchema>;

/**
 * The next page of a story feed, for "Load more".
 *
 * Public and read-only: it returns only what the listing already shows to
 * anyone (published posts, card fields only), so it needs no permission
 * check. Input is still parsed, because it arrives from the browser.
 */
export async function loadFeedPageAction(
  request: FeedPageRequest,
): Promise<{ items: CardPost[]; hasMore: boolean }> {
  const parsed = pageRequestSchema.safeParse(request);
  if (!parsed.success) return { items: [], hasMore: false };

  const result = await cms.posts.getPublishedPage(parsed.data);

  // Past the end, getPublishedPage clamps to the last page; that would repeat
  // stories the reader already has.
  if (result.page !== parsed.data.page) return { items: [], hasMore: false };

  return {
    items: result.items.map(toCardPost),
    hasMore: result.page < result.totalPages,
  };
}

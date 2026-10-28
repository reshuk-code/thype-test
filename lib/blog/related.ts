/**
 * "Read next" selection.
 *
 * Pure so it can be unit-tested and so the repository can run it over the
 * published set it already holds, rather than querying once per candidate.
 */

export interface RelatedCandidate {
  id: string;
  category: string | null;
  tags: string[];
  destinationIds?: string[];
  publishedAt: string | null;
}

/*
 * Weights, highest first: a story about the same place is the strongest
 * signal on a travel site, the same section next, a shared tag weakest
 * because tags are loose and plentiful.
 */
const DESTINATION_WEIGHT = 3;
const CATEGORY_WEIGHT = 2;
const TAG_WEIGHT = 1;

export function relatedScore(post: RelatedCandidate, other: RelatedCandidate): number {
  let score = 0;

  const places = new Set(post.destinationIds ?? []);
  for (const id of other.destinationIds ?? []) {
    if (places.has(id)) score += DESTINATION_WEIGHT;
  }

  if (post.category && post.category === other.category) score += CATEGORY_WEIGHT;

  const tags = new Set(post.tags);
  for (const tag of other.tags) {
    if (tags.has(tag)) score += TAG_WEIGHT;
  }

  return score;
}

function recency(candidate: RelatedCandidate): number {
  return candidate.publishedAt ? Date.parse(candidate.publishedAt) || 0 : 0;
}

/**
 * Up to `limit` posts to read after `post`.
 *
 * The editor's hand-picked posts come first, in the order they were picked.
 * Remaining slots are filled by score, then by recency, so a post with nothing
 * in common with anything still gets the latest stories rather than an empty
 * section. `pool` must already be restricted to publicly visible posts — this
 * function does not know about publication status.
 */
export function pickRelated<T extends RelatedCandidate>(
  post: RelatedCandidate,
  pool: T[],
  manualIds: string[],
  limit: number,
): T[] {
  if (limit <= 0) return [];

  const byId = new Map(pool.map((candidate) => [candidate.id, candidate]));
  const chosen: T[] = [];
  const seen = new Set<string>([post.id]);

  for (const id of manualIds) {
    const candidate = byId.get(id);
    if (!candidate || seen.has(id)) continue;
    chosen.push(candidate);
    seen.add(id);
    if (chosen.length === limit) return chosen;
  }

  const ranked = pool
    .filter((candidate) => !seen.has(candidate.id))
    .map((candidate) => ({ candidate, score: relatedScore(post, candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score || recency(b.candidate) - recency(a.candidate),
    );

  for (const { candidate } of ranked) {
    chosen.push(candidate);
    if (chosen.length === limit) break;
  }

  return chosen;
}
